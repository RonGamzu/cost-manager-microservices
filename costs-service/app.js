const express = require('express');
const { buildCostsRouter } = require('./routes/costs');

/**
 * Builds the express application for the costs service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Express}
 */
const buildApp = (logger) => {
    const app = express();

    // accept json bodies for POST /api/add
    app.use(express.json());

    // log every incoming http request
    app.use((req, res, next) => {
        logger.info({ method: req.method, url: req.url }, 'request');
        next();
    });

    // mount the costs router under /api so the urls match the spec
    app.use('/api', buildCostsRouter(logger));

    // unmatched routes return the project wide json error shape
    app.use((req, res) => {
        res.status(404).json({
            id: 404,
            message: `route ${req.method} ${req.url} not found`
        });
    });

    return app;
};

module.exports = { buildApp };
