const request = require('supertest');
const mongoose = require('mongoose');
const pino = require('pino');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { buildApp } = require('../app');
const Log = require('../../shared/models/Log');

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
    // empty the logs collection so every test starts clean
    await Log.deleteMany({});
});

describe('logs service - GET /api/logs', () => {
    test('returns an empty array when no logs exist', async () => {
        const response = await request(app).get('/api/logs/');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
    });

    test('returns the stored log documents', async () => {
        // insert two synthetic log rows so the endpoint has data
        await Log.create({ level: 30, msg: 'first', time: new Date() });
        await Log.create({ level: 40, msg: 'second', time: new Date() });
        const response = await request(app).get('/api/logs');
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
        // each row should expose at least the message text
        const messages = response.body.map(row => row.msg);
        expect(messages).toContain('first');
        expect(messages).toContain('second');
    });
});
