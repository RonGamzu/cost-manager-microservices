const request = require('supertest');
const mongoose = require('mongoose');
const pino = require('pino');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { buildApp } = require('../app');
const {
    groupCostsByCategory,
    isMonthInPast,
    reportCategoriesOrder
} = require('../routes/costs');
const User = require('../../shared/models/User');
const Cost = require('../../shared/models/Cost');
const Report = require('../../shared/models/Report');

// silent logger keeps the suite output clean
const silentLogger = pino({ enabled: false });
const app = buildApp(silentLogger);

let memoryServer = null;

beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    if (memoryServer !== null) {
        await memoryServer.stop();
    }
});

beforeEach(async () => {
    // wipe every collection so tests do not leak state
    await User.deleteMany({});
    await Cost.deleteMany({});
    await Report.deleteMany({});
});

describe('costs service - groupCostsByCategory helper', () => {
    test('returns the five categories in the documented order', () => {
        // pass an empty list to focus on the order alone
        const result = groupCostsByCategory([]);
        // every bucket key is the only key inside its object
        const keys = result.map(entry => Object.keys(entry)[0]);
        expect(keys).toEqual(reportCategoriesOrder);
        // every bucket starts as an empty array
        result.forEach(entry => {
            const value = Object.values(entry)[0];
            expect(value).toEqual([]);
        });
    });

    test('extracts sum, description and day exactly (edge case 4)', () => {
        // a single cost gives a tight check on the projection shape
        const date = new Date(2026, 4, 17, 10, 0, 0);
        const grouped = groupCostsByCategory([{
            description: 'milk',
            sum: 12,
            category: 'food',
            createdAt: date
        }]);
        // the food bucket should hold one item with three properties
        const foodEntry = grouped.find(entry => Object.keys(entry)[0] === 'food');
        expect(foodEntry.food.length).toBe(1);
        const item = foodEntry.food[0];
        expect(item).toEqual({ sum: 12, description: 'milk', day: 17 });
    });
});

describe('costs service - isMonthInPast helper', () => {
    test('correctly classifies past months', () => {
        // january 1900 will be in the past for any reasonable test run
        expect(isMonthInPast(1900, 1)).toBe(true);
    });

    test('does not classify the current month as past', () => {
        const now = new Date();
        const result = isMonthInPast(now.getFullYear(), now.getMonth() + 1);
        expect(result).toBe(false);
    });
});

describe('costs service - POST /api/add', () => {
    test('rejects a cost whose user does not exist (edge case 1)', async () => {
        const response = await request(app)
            .post('/api/add/')
            .send({ description: 'x', category: 'food', userid: 9999, sum: 5 });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('id', 400);
    });

    test('defaults the date to the current moment when none is sent (edge case 2)', async () => {
        // the test user must exist for the cost to be accepted
        await User.create({ id: 1, first_name: 'a', last_name: 'b' });
        const before = Date.now();
        const response = await request(app)
            .post('/api/add')
            .send({ description: 'snack', category: 'food', userid: 1, sum: 7 });
        const after = Date.now();
        expect(response.status).toBe(201);
        const createdAt = new Date(response.body.createdAt).getTime();
        // the assigned date must fall inside the request time window
        expect(createdAt).toBeGreaterThanOrEqual(before - 1000);
        expect(createdAt).toBeLessThanOrEqual(after + 1000);
    });

    test('rejects a date that lies before today (edge case 3)', async () => {
        // make sure the user exists before the date check is reached
        await User.create({ id: 2, first_name: 'a', last_name: 'b' });
        // a date well before today is unambiguously in the past
        const response = await request(app)
            .post('/api/add')
            .send({
                description: 'old',
                category: 'food',
                userid: 2,
                sum: 4,
                date: '2000-01-01T00:00:00.000Z'
            });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/past/);
    });

    test('rejects categories outside the allowed enum', async () => {
        await User.create({ id: 3, first_name: 'a', last_name: 'b' });
        const response = await request(app)
            .post('/api/add')
            .send({ description: 'x', category: 'luxury', userid: 3, sum: 1 });
        expect(response.status).toBe(400);
    });

    test('happy path returns the inserted cost', async () => {
        await User.create({ id: 123123, first_name: 'mosh', last_name: 'israeli' });
        const response = await request(app)
            .post('/api/add/')
            .send({ userid: 123123, description: 'milk 9', category: 'food', sum: 8 });
        expect(response.status).toBe(201);
        expect(response.body.description).toBe('milk 9');
        expect(response.body.sum).toBe(8);
        expect(response.body.category).toBe('food');
    });
});

describe('costs service - GET /api/report', () => {
    test('returns the five categories even when nothing exists (edge case 4)', async () => {
        const response = await request(app).get('/api/report/?id=1&year=2026&month=1');
        expect(response.status).toBe(200);
        expect(response.body.costs.length).toBe(5);
        // verify the documented order is respected
        const keys = response.body.costs.map(entry => Object.keys(entry)[0]);
        expect(keys).toEqual(reportCategoriesOrder);
        // every bucket is an empty array on a fresh database
        response.body.costs.forEach(entry => {
            const value = Object.values(entry)[0];
            expect(value).toEqual([]);
        });
    });

    test('caches a past month into the reports collection (computed pattern)', async () => {
        // pick a month that was clearly in the past
        const pastYear = 2000;
        const pastMonth = 1;
        // a matching cost so the bucket is not empty
        await Cost.create({
            description: 'historical bread',
            category: 'food',
            userid: 42,
            sum: 3,
            createdAt: new Date(pastYear, pastMonth - 1, 15)
        });
        // first call computes and stores
        const first = await request(app)
            .get(`/api/report?id=42&year=${pastYear}&month=${pastMonth}`);
        expect(first.status).toBe(200);
        // the cache row must exist after the first call
        const cached = await Report.findOne({ userid: 42, year: pastYear, month: pastMonth });
        expect(cached).not.toBeNull();
        // when the underlying cost is removed, a cached report still
        // serves the same costs array because the cache was already saved
        await Cost.deleteMany({});
        const second = await request(app)
            .get(`/api/report?id=42&year=${pastYear}&month=${pastMonth}`);
        expect(second.status).toBe(200);
        const foodSecond = second.body.costs.find(entry => Object.keys(entry)[0] === 'food');
        expect(foodSecond.food.length).toBe(1);
    });

    test('does not cache current month reports', async () => {
        const now = new Date();
        const response = await request(app)
            .get(`/api/report?id=99&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
        expect(response.status).toBe(200);
        const cached = await Report.findOne({
            userid: 99,
            year: now.getFullYear(),
            month: now.getMonth() + 1
        });
        expect(cached).toBeNull();
    });

    test('rejects requests with missing query parameters', async () => {
        const response = await request(app).get('/api/report?id=1');
        expect(response.status).toBe(400);
    });
});
