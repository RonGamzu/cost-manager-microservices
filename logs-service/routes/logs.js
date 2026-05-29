const express = require('express');
const Log = require('../../shared/models/Log');

/**
 * Builds the express router for the logs admin service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Router}
 */
const buildLogsRouter = (logger) => {
    const router = express.Router();

    // GET /api/logs - returns every log document currently stored
    router.get('/logs', async (req, res) => {
        try {
            logger.info({ endpoint: '/api/logs', service: 'logs' }, 'fetch logs');
            // sort by time so newest entries appear last
            const logs = await Log.find({}, { _id: 0 }).sort({ time: 1 });
            res.status(200).json(logs);
        } catch (error) {
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    return router;
};

module.exports = { buildLogsRouter };
