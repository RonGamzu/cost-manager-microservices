const express = require('express');
const { buildUsersRouter } = require('./routes/users');

/**
 * Builds the express application for the users service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Express}
 */
const buildApp = (logger) => {
    const app = express();

    // parse incoming json bodies for POST /api/add
    app.use(express.json());

    // log every incoming request so the logs collection has request rows
    app.use((req, res, next) => {
        logger.info({ method: req.method, url: req.url }, 'request');
        next();
    });

    // mount the users router under /api
    app.use('/api', buildUsersRouter(logger));

    // catch-all for unknown routes
    app.use((req, res) => {
        res.status(404).json({
            id: 404,
            message: `route ${req.method} ${req.url} not found`
        });
    });

    return app;
};

module.exports = { buildApp };
