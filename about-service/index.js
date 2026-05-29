const path = require('path');

// load the .env values before anything else needs them
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { connectDb } = require('../shared/db');
const { createLogger } = require('../shared/logger');
const { buildApp } = require('./app');

/**
 * Bootstraps the about microservice.
 * @returns {Promise<void>}
 */
const startService = async () => {
    const host = process.env.HOST;
    const port = Number(process.env.PORT);
    const uri = process.env.MONGODB_URI;
    try {
        // connect first so the logger has a working sink
        await connectDb(uri);
        const logger = createLogger('about-service');
        const app = buildApp(logger);
        // host and port come strictly from .env
        app.listen(port, host, () => {
            console.log(`about service listening on http://${host}:${port}`);
        });
    } catch (error) {
        console.error(`about service failed to start: ${error.message}`);
        process.exit(1);
    }
};

startService();
