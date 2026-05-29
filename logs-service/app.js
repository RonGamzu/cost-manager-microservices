const express = require('express');
const { buildLogsRouter } = require('./routes/logs');

/**
 * Builds the express application for the logs admin service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Express}
 */
const buildApp = (logger) => {
    const app = express();

    // accept json bodies for consistency with the other services
    app.use(express.json());

    // log every request that reaches the service
    app.use((req, res, next) => {
        logger.info({ method: req.method, url: req.url }, 'request');
        next();
    });

    // mount the logs router under /api
    app.use('/api', buildLogsRouter(logger));

    // generic not-found handler returning the standard error shape
    app.use((req, res) => {
        res.status(404).json({
            id: 404,
            message: `route ${req.method} ${req.url} not found`
        });
    });

    return app;
};

module.exports = { buildApp };
