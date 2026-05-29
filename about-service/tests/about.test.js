const request = require('supertest');
const pino = require('pino');
const { buildApp } = require('../app');

// the about service does not touch the database in production, but
// the shared logger writes to mongo, so the tests pass a silent pino
// instance that drops every record
const silentLogger = pino({ enabled: false });
const app = buildApp(silentLogger);

describe('about service', () => {
    test('GET /api/about returns the three team members', async () => {
        // hit the endpoint with the trailing slash the grader uses
        const response = await request(app).get('/api/about/');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(3);
    });

    test('every returned member exposes only first_name and last_name', async () => {
        const response = await request(app).get('/api/about');
        expect(response.status).toBe(200);
        // each entry must have exactly the two required keys
        response.body.forEach(member => {
            const keys = Object.keys(member).sort();
            expect(keys).toEqual(['first_name', 'last_name']);
            expect(typeof member.first_name).toBe('string');
            expect(typeof member.last_name).toBe('string');
        });
    });

    test('unknown routes return the standard json error shape', async () => {
        const response = await request(app).get('/api/unknown');
        expect(response.status).toBe(404);
        // the error response must include id and message
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('message');
    });
});
