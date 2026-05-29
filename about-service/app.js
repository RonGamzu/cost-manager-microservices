const express = require('express');
const { buildAboutRouter } = require('./routes/about');

/**
 * Builds the express application for the about service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Express}
 */
const buildApp = (logger) => {
    const app = express();

    // accept json bodies even though the about endpoint does not need
    // it; keeps the middleware list consistent with the other services
    app.use(express.json());

    // simple request log line for every incoming http call
    app.use((req, res, next) => {
        // record method and url before the response is written
        logger.info({ method: req.method, url: req.url }, 'request');
        next();
    });

    // every route is mounted under /api
    app.use('/api', buildAboutRouter(logger));

    // fallback for paths that were not matched above
    app.use((req, res) => {
        res.status(404).json({
            id: 404,
            message: `route ${req.method} ${req.url} not found`
        });
    });

    return app;
};

module.exports = { buildApp };
