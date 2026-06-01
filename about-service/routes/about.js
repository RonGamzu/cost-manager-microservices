const express = require('express');

// the team members are hardcoded on purpose. the assignment forbids
// keeping these values in the database, because the submitted db must
// be empty except for the seed user
const teamMembers = [
    { first_name: 'Ron', last_name: 'Gam Ze Letova' },
    { first_name: 'Rotem', last_name: 'Bar' }
];

/**
 * Builds the express router for the about service. The logger is
 * injected so the same router can be reused inside the unit tests
 * with a different (or muted) logger.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Router}
 */
const buildAboutRouter = (logger) => {
    const router = express.Router();

    // GET /api/about - returns the developer list
    router.get('/about', (req, res) => {
        try {
            // record that the endpoint was accessed
            logger.info({ endpoint: '/api/about' }, 'about endpoint hit');
            // send only the two required properties per member
            res.status(200).json(teamMembers);
        } catch (error) {
            logger.error({ endpoint: '/api/about', service: 'about', err: error.message }, 'unexpected error in about endpoint');
            // unified error shape used across every service
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    return router;
};

module.exports = { buildAboutRouter, teamMembers };
