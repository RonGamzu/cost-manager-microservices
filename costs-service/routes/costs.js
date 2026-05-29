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
            const userid = Number(body.userid);
            const sum = Number(body.sum);
            // basic shape validation before any database access
            if (typeof description !== 'string' || description.length === 0) {
                res.status(400).json({
                    id: 400,
                    message: 'description is required'
                });
                return;
            }
            if (!allowedCategories.includes(category)) {
                res.status(400).json({
                    id: 400,
                    message: `category must be one of ${allowedCategories.join(', ')}`
                });
                return;
            }
            if (!Number.isFinite(userid)) {
                res.status(400).json({
                    id: 400,
                    message: 'userid must be a number'
                });
                return;
            }
            if (!Number.isFinite(sum) || sum < 0) {
                res.status(400).json({
                    id: 400,
                    message: 'sum must be a non negative number'
                });
                return;
            }
            // edge case 2: default the date to "now" when none was sent
            let costDate = new Date();
            const rawDate = body.date || body.createdAt;
            if (typeof rawDate === 'string' && rawDate.length > 0) {
                const parsed = new Date(rawDate);
                if (Number.isNaN(parsed.getTime())) {
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
                res.status(400).json({
                    id: 400,
                    message: 'cost date must not be in the past'
                });
                return;
            }
            // edge case 1: confirm the user actually exists
            const userExists = await User.findOne({ id: userid });
            if (userExists === null) {
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
            // strict input validation at the system boundary
            if (!Number.isFinite(userid) || !Number.isFinite(year) || !Number.isFinite(month)) {
                res.status(400).json({
                    id: 400,
                    message: 'id, year and month query parameters are required'
                });
                return;
            }
            if (month < 1 || month > 12) {
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
