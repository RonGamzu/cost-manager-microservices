const pino = require('pino');
const { Writable } = require('stream');
const Log = require('./models/Log');

/*
 * MongoWritable is a writable stream that consumes the json lines pino
 * emits. Each line is parsed and inserted into the logs collection as
 * a single document. Errors during the insert are swallowed on
 * purpose: logging must never block or crash the request pipeline.
 */
const buildMongoStream = () => {
    // an internal queue is not needed because mongoose buffers itself
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            // every chunk pino sends is a single ndjson line
            const raw = chunk.toString('utf8').trim();
            if (raw.length === 0) {
                callback();
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                // fire-and-forget; we still call back synchronously
                Log.create(parsed).catch(() => {});
            } catch (_err) {
                // ignore malformed lines so the stream stays alive
            }
            callback();
        }
    });
    return stream;
};

/**
 * Creates a pino logger that writes every record to the mongo logs
 * collection through the custom writable stream.
 * @param {string} serviceName - shown on each log line.
 * @returns {import('pino').Logger}
 */
const createLogger = (serviceName) => {
    // include the service name so logs from multiple services can be
    // told apart when the logs collection is queried later
    const baseFields = {
        service: serviceName
    };
    const logger = pino({
        base: baseFields,
        timestamp: pino.stdTimeFunctions.isoTime
    }, buildMongoStream());
    return logger;
};

module.exports = { createLogger };
