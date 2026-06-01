const express = require('express');
const Cost = require('../../shared/models/Cost');
const User = require('../../shared/models/User');
const Report = require('../../shared/models/Report');

// the categories must appear in this exact order in the report, even
// when one or more of them have no matching cost documents
const reportCategoriesOrder = ['food', 'education', 'health', 'housing', 'sports'];

const allowedCategories = Cost.allowedCategories;

/**
 * Returns true when the given year and month are strictly before the
 * current calendar month. Equal year and month means "current month"
 * and is NOT considered past.
 * @param {number} year
 * @param {number} month - 1-based, like the http query string.
 * @returns {boolean}
 */
const isMonthInPast = (year, month) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    // getMonth is zero based; add one to align with the query
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear) {
        return true;
    }
    if (year === currentYear && month < currentMonth) {
        return true;
    }
    return false;
};

/**
 * Groups a list of cost documents by category into the exact shape
 * the assignment requires. Every one of the five categories appears,
 * even when its array is empty.
 * @param {Array<{description: string, sum: number, createdAt: Date, category: string}>} costs
 * @returns {Array<object>}
 */
const groupCostsByCategory = (costs) => {
    // start each bucket as an empty array so missing categories stay visible
    const buckets = {};
    reportCategoriesOrder.forEach(name => {
        buckets[name] = [];
    });
    // every cost is reduced to the three properties the spec asks for
    costs.forEach(cost => {
        const item = {
            sum: Number(cost.sum),
            description: String(cost.description),
            day: new Date(cost.createdAt).getDate()
        };
        // ignore costs whose category somehow falls outside the enum
        if (buckets[cost.category]) {
            buckets[cost.category].push(item);
        }
    });
    // produce the final array in the required order
    return reportCategoriesOrder.map(name => ({ [name]: buckets[name] }));
};

/**
 * Builds the express router for the costs service.
 * @param {import('pino').Logger} logger
 * @returns {import('express').Router}
 */
const buildCostsRouter = (logger) => {
    const router = express.Router();

    /*
     * POST /api/add - adds a new cost item.
     * Edge cases:
     *   1. the userid must already exist in the users collection
     *   2. when no date is supplied the current date is used
     *   3. dates that fall before the start of today are rejected
     */
    router.post('/add', async (req, res) => {
        try {
            logger.info({ endpoint: '/api/add', service: 'costs' }, 'add cost');
            const body = req.body || {};
            const description = body.description;
            const category = body.category;
            if (typeof description !== 'string' || description.length === 0) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'description is required');
                res.status(400).json({ id: 400, message: 'description is required' });
                return;
            }
            if (category === undefined || category === null) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'category is required');
                res.status(400).json({ id: 400, message: 'category is required' });
                return;
            }
            if (!allowedCategories.includes(category)) {
                logger.warn({ endpoint: '/api/add', service: 'costs', category }, `category must be one of ${allowedCategories.join(', ')}`);
                res.status(400).json({
                    id: 400,
                    message: `category must be one of ${allowedCategories.join(', ')}`
                });
                return;
            }
            if (body.userid === undefined || body.userid === null) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'userid is required');
                res.status(400).json({ id: 400, message: 'userid is required' });
                return;
            }
            const userid = Number(body.userid);
            if (!Number.isFinite(userid)) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'userid must be a number');
                res.status(400).json({ id: 400, message: 'userid must be a number' });
                return;
            }
            if (body.sum === undefined || body.sum === null) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'sum is required');
                res.status(400).json({ id: 400, message: 'sum is required' });
                return;
            }
            const sum = Number(body.sum);
            if (!Number.isFinite(sum)) {
                logger.warn({ endpoint: '/api/add', service: 'costs' }, 'sum must be a valid number');
                res.status(400).json({ id: 400, message: 'sum must be a valid number' });
                return;
            }
            if (sum < 0) {
                logger.warn({ endpoint: '/api/add', service: 'costs', sum }, 'sum cannot be a negative number');
                res.status(400).json({ id: 400, message: 'sum cannot be a negative number' });
                return;
            }
            // edge case 2: default the date to "now" when none was sent
            let costDate = new Date();
            const rawDate = body.date || body.createdAt;
            if (typeof rawDate === 'string' && rawDate.length > 0) {
                const parsed = new Date(rawDate);
                if (Number.isNaN(parsed.getTime())) {
                    logger.warn({ endpoint: '/api/add', service: 'costs', date: rawDate }, 'date is not a valid timestamp');
                    res.status(400).json({
                        id: 400,
                        message: 'date is not a valid timestamp'
                    });
                    return;
                }
                costDate = parsed;
            }
            // edge case 3: reject any date earlier than today
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            if (costDate.getTime() < startOfToday.getTime()) {
                logger.warn({ endpoint: '/api/add', service: 'costs', costDate }, 'cost date must not be in the past');
                res.status(400).json({
                    id: 400,
                    message: 'cost date must not be in the past'
                });
                return;
            }
            // edge case 1: confirm the user actually exists
            const userExists = await User.findOne({ id: userid });
            if (userExists === null) {
                logger.warn({ endpoint: '/api/add', service: 'costs', userid }, `user with id ${userid} does not exist`);
                res.status(400).json({
                    id: 400,
                    message: `user with id ${userid} does not exist`
                });
                return;
            }
            // persist the new cost and return the public fields back
            const created = await Cost.create({
                description,
                category,
                userid,
                sum,
                createdAt: costDate
            });
            res.status(201).json({
                description: created.description,
                category: created.category,
                userid: created.userid,
                sum: created.sum,
                createdAt: created.createdAt
            });
        } catch (error) {
            logger.error({ endpoint: '/api/add', service: 'costs', err: error.message }, 'unexpected error adding cost');
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    /*
     * GET /api/report - implements the Computed Design Pattern.
     * The pattern: heavy reports are expensive to recompute; once a
     * month has already ended its costs cannot change anymore, so the
     * server caches the grouped result inside the reports collection.
     * On every request for a past month the cache is consulted first;
     * a miss triggers a fresh computation and a write into the cache.
     * Current and future months are computed on every request so new
     * costs are visible immediately.
     */
    router.get('/report', async (req, res) => {
        try {
            const userid = Number(req.query.id);
            const year = Number(req.query.year);
            const month = Number(req.query.month);
            logger.info({
                endpoint: '/api/report',
                service: 'costs',
                userid,
                year,
                month
            }, 'monthly report');
            if (!Number.isFinite(userid)) {
                logger.warn({ endpoint: '/api/report', service: 'costs' }, 'id query parameter is required and must be a number');
                res.status(400).json({
                    id: 400,
                    message: 'id query parameter is required and must be a number'
                });
                return;
            }
            if (!Number.isFinite(year)) {
                logger.warn({ endpoint: '/api/report', service: 'costs', userid }, 'year query parameter is required and must be a number');
                res.status(400).json({
                    id: 400,
                    message: 'year query parameter is required and must be a number'
                });
                return;
            }
            if (year <= 0) {
                logger.warn({ endpoint: '/api/report', service: 'costs', userid, year }, 'year must be a positive number');
                res.status(400).json({
                    id: 400,
                    message: 'year must be a positive number'
                });
                return;
            }
            if (!Number.isFinite(month)) {
                logger.warn({ endpoint: '/api/report', service: 'costs', userid, year }, 'month query parameter is required and must be a number');
                res.status(400).json({
                    id: 400,
                    message: 'month query parameter is required and must be a number'
                });
                return;
            }
            if (month < 1 || month > 12) {
                logger.warn({ endpoint: '/api/report', service: 'costs', userid, year, month }, 'month must be between 1 and 12');
                res.status(400).json({
                    id: 400,
                    message: 'month must be between 1 and 12'
                });
                return;
            }
            // computed pattern: try the cache for past months first
            if (isMonthInPast(year, month)) {
                const cached = await Report.findOne({ userid, year, month });
                if (cached !== null) {
                    // return the cached report immediately
                    res.status(200).json({
                        userid,
                        year,
                        month,
                        costs: cached.costs
                    });
                    return;
                }
            }
            // either the month is current/future or the cache missed
            const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const monthEnd = new Date(year, month, 1, 0, 0, 0, 0);
            const costs = await Cost.find({
                userid,
                createdAt: { $gte: monthStart, $lt: monthEnd }
            });
            // shape the result to match the assignment example exactly
            const grouped = groupCostsByCategory(costs);
            // only past months get persisted to the cache
            if (isMonthInPast(year, month)) {
                try {
                    await Report.create({
                        userid,
                        year,
                        month,
                        costs: grouped
                    });
                } catch (_err) {
                    // a duplicate-key race is fine; another request cached it
                }
            }
            res.status(200).json({
                userid,
                year,
                month,
                costs: grouped
            });
        } catch (error) {
            logger.error({ endpoint: '/api/report', service: 'costs', err: error.message }, 'unexpected error generating report');
            res.status(500).json({
                id: 500,
                message: error.message
            });
        }
    });

    return router;
};

module.exports = {
    buildCostsRouter,
    groupCostsByCategory,
    isMonthInPast,
    reportCategoriesOrder
};
