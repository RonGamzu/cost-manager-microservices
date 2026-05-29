const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { connectDb } = require('../shared/db');
const { createLogger } = require('../shared/logger');
const { buildApp } = require('./app');

/**
 * Bootstraps the logs microservice.
 * @returns {Promise<void>}
 */
const startService = async () => {
    const host = process.env.HOST;
    const port = Number(process.env.PORT);
    const uri = process.env.MONGODB_URI;
    try {
        await connectDb(uri);
        const logger = createLogger('logs-service');
        const app = buildApp(logger);
        app.listen(port, host, () => {
            console.log(`logs service listening on http://${host}:${port}`);
        });
    } catch (error) {
        console.error(`logs service failed to start: ${error.message}`);
        process.exit(1);
    }
};

startService();
