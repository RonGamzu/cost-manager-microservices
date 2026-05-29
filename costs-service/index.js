const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { connectDb } = require('../shared/db');
const { createLogger } = require('../shared/logger');
const { buildApp } = require('./app');

/**
 * Bootstraps the costs microservice.
 * @returns {Promise<void>}
 */
const startService = async () => {
    const host = process.env.HOST;
    const port = Number(process.env.PORT);
    const uri = process.env.MONGODB_URI;
    try {
        await connectDb(uri);
        const logger = createLogger('costs-service');
        const app = buildApp(logger);
        app.listen(port, host, () => {
            console.log(`costs service listening on http://${host}:${port}`);
        });
    } catch (error) {
        console.error(`costs service failed to start: ${error.message}`);
        process.exit(1);
    }
};

startService();
