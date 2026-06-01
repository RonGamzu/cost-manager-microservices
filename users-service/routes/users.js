const express = require('express');
const User = require('../../shared/models/User');
const Cost = require('../../shared/models/Cost');

/**
 * Builds the express router for the users service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Router}
 */
const buildUsersRouter = (logger) => {
    const router = express.Router();

    /*
     * POST /api/add - creates a new user.
     * Edge case 5: the assignment forbids two users sharing the same
     * custom id, so a duplicate check is performed before the insert.
     */
    router.post('/add', async (req, res) => {
        try {
            logger.info({ endpoint: '/api/add', service: 'users' }, 'add user');
            const body = req.body || {};
            // explicit numeric conversion at the system boundary
            const id = Number(body.id);
            const firstName = body.first_name;
            const lastName = body.last_name;
            if (!Number.isFinite(id)) {
                logger.warn({ endpoint: '/api/add', service: 'users' }, 'id is required and must be a number');
                res.status(400).json({ id: 400, message: 'id is required and must be a number' });
                return;
            }
            if (typeof firstName !== 'string' || firstName.trim().length === 0) {
                logger.warn({ endpoint: '/api/add', service: 'users' }, 'first_name is required');
                res.status(400).json({ id: 400, message: 'first_name is required' });
                return;
            }
            if (typeof lastName !== 'string' || lastName.trim().length === 0) {
                logger.warn({ endpoint: '/api/add', service: 'users' }, 'last_name is required');
                res.status(400).json({ id: 400, message: 'last_name is required' });
                return;
            }
            // edge case 5: reject duplicate custom ids
            const existing = await User.findOne({ id });
            if (existing !== null) {
                logger.warn({ endpoint: '/api/add', service: 'users', id }, `user with id ${id} already exists`);
                res.status(400).json({
                    id: 400,
                    message: `user with id ${id} already exists`
                });
                return;
            }
            // birthday is optional; only set when a parseable value is sent
            const payload = {
                id,
                first_name: firstName,
                last_name: lastName
            };
            if (typeof body.birthday === 'string' && body.birthday.length > 0) {
                const birthdayDate = new Date(body.birthday);
                // ignore unparseable strings rather than crashing
                if (!Number.isNaN(birthdayDate.getTime())) {
                    payload.birthday = birthdayDate;
                }
            }
            const created = await User.create(payload);
            // return only the relevant public fields
            res.status(201).json({
                id: created.id,
                first_name: created.first_name,
                last_name: created.last_name,
                birthday: created.birthday
            });
        } catch (error) {
            logger.error({ endpoint: '/api/add', service: 'users', err: error.message }, 'unexpected error adding user');
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    // GET /api/users - returns every user in the collection
    router.get('/users', async (req, res) => {
        try {
            logger.info({ endpoint: '/api/users', service: 'users' }, 'list users');
            // project out the internal _id since the spec does not need it
            const users = await User.find({}, { _id: 0, id: 1, first_name: 1, last_name: 1, birthday: 1 });
            res.status(200).json(users);
        } catch (error) {
            logger.error({ endpoint: '/api/users', service: 'users', err: error.message }, 'unexpected error listing users');
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    /*
     * GET /api/users/:id - returns the user plus the total cost sum.
     * The total is the sum of every cost document whose userid matches
     * the requested id.
     */
    router.get('/users/:id', async (req, res) => {
        try {
            const requestedId = Number(req.params.id);
            logger.info({ endpoint: `/api/users/${requestedId}`, service: 'users' }, 'get user');
            if (!Number.isFinite(requestedId)) {
                logger.warn({ endpoint: '/api/users/:id', service: 'users' }, 'id must be a number');
                res.status(400).json({
                    id: 400,
                    message: 'id must be a number'
                });
                return;
            }
            // look the user up by the custom id, not the mongo _id
            const user = await User.findOne({ id: requestedId });
            if (user === null) {
                logger.warn({ endpoint: `/api/users/${requestedId}`, service: 'users', requestedId }, `user with id ${requestedId} was not found`);
                res.status(404).json({
                    id: 404,
                    message: `user with id ${requestedId} was not found`
                });
                return;
            }
            // aggregate the cost sum in mongo instead of pulling docs back
            const aggregation = await Cost.aggregate([
                { $match: { userid: requestedId } },
                { $group: { _id: null, total: { $sum: '$sum' } } }
            ]);
            // when the user has no costs the aggregation array is empty
            const total = aggregation.length > 0 ? aggregation[0].total : 0;
            res.status(200).json({
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                total
            });
        } catch (error) {
            logger.error({ endpoint: '/api/users/:id', service: 'users', err: error.message }, 'unexpected error getting user');
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    return router;
};

module.exports = { buildUsersRouter };
