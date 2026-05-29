const request = require('supertest');
const mongoose = require('mongoose');
const pino = require('pino');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { buildApp } = require('../app');
const User = require('../../shared/models/User');
const Cost = require('../../shared/models/Cost');

// silent logger so the tests do not write to a real mongo logs sink
const silentLogger = pino({ enabled: false });
const app = buildApp(silentLogger);

let memoryServer = null;

// connect to a throw-away in-memory mongo before any test runs
beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
});

// disconnect cleanly so jest can finish without dangling handles
afterAll(async () => {
    await mongoose.disconnect();
    if (memoryServer !== null) {
        await memoryServer.stop();
    }
});

// each test starts with a fresh state
beforeEach(async () => {
    await User.deleteMany({});
    await Cost.deleteMany({});
});

describe('users service - POST /api/add', () => {
    test('creates a new user and returns its public fields', async () => {
        const response = await request(app)
            .post('/api/add/')
            .send({ id: 1001, first_name: 'dana', last_name: 'levi' });
        expect(response.status).toBe(201);
        expect(response.body.id).toBe(1001);
        expect(response.body.first_name).toBe('dana');
        expect(response.body.last_name).toBe('levi');
    });

    test('rejects a duplicate id (edge case 5)', async () => {
        // insert the first user successfully
        await User.create({ id: 222, first_name: 'a', last_name: 'b' });
        // and then attempt to create a second user with the same id
        const response = await request(app)
            .post('/api/add')
            .send({ id: 222, first_name: 'c', last_name: 'd' });
        expect(response.status).toBe(400);
        expect(response.body.id).toBe(400);
        expect(response.body.message).toMatch(/already exists/);
    });

    test('rejects when required fields are missing', async () => {
        const response = await request(app)
            .post('/api/add')
            .send({ id: 5 });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
    });
});

describe('users service - GET /api/users', () => {
    test('returns every user', async () => {
        // seed two users so the response is easy to verify
        await User.create({ id: 1, first_name: 'a', last_name: 'aa' });
        await User.create({ id: 2, first_name: 'b', last_name: 'bb' });
        const response = await request(app).get('/api/users');
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
    });
});

describe('users service - GET /api/users/:id', () => {
    test('returns the user with a total of zero when no costs exist', async () => {
        await User.create({ id: 9, first_name: 'tom', last_name: 'cohen' });
        const response = await request(app).get('/api/users/9');
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(9);
        expect(response.body.first_name).toBe('tom');
        expect(response.body.total).toBe(0);
    });

    test('sums every cost that belongs to the user', async () => {
        await User.create({ id: 7, first_name: 'gal', last_name: 'azulay' });
        // create a few costs across different categories
        await Cost.create({ description: 'a', category: 'food', userid: 7, sum: 10 });
        await Cost.create({ description: 'b', category: 'sports', userid: 7, sum: 25 });
        await Cost.create({ description: 'c', category: 'food', userid: 8, sum: 99 });
        const response = await request(app).get('/api/users/7');
        expect(response.status).toBe(200);
        // only the costs belonging to user 7 are counted
        expect(response.body.total).toBe(35);
    });

    test('returns 404 when the user does not exist', async () => {
        const response = await request(app).get('/api/users/404404');
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('id', 404);
    });
});
