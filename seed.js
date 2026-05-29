const path = require('path');
const mongoose = require('mongoose');

// reuse the costs-service .env so the connection string lives in one
// place; every service shares the same MONGODB_URI value anyway
require('dotenv').config({
    path: path.join(__dirname, 'costs-service', '.env')
});

const { connectDb } = require('./shared/db');
const User = require('./shared/models/User');
const Cost = require('./shared/models/Cost');
const Log = require('./shared/models/Log');
const Report = require('./shared/models/Report');

// the single user the assignment requires to exist in the database
const seedUser = {
    id: 123123,
    first_name: 'mosh',
    last_name: 'israeli'
};

/**
 * Wipes the four collections used by the project and inserts the
 * single mandatory user. Intended to be run once before submission.
 * @returns {Promise<void>}
 */
const runSeed = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        // open the connection through the shared helper
        await connectDb(uri);
        // remove anything that was left from previous runs
        await Promise.all([
            User.deleteMany({}),
            Cost.deleteMany({}),
            Log.deleteMany({}),
            Report.deleteMany({})
        ]);
        // insert the one and only user
        await User.create(seedUser);
        // a friendly confirmation for the operator
        console.log(`database is empty except for user ${seedUser.first_name} ${seedUser.last_name}`);
    } catch (error) {
        console.error(`seed failed: ${error.message}`)
        // a non zero exit code lets shell scripts detect failure
        process.exitCode = 1;
    } finally {
        // always release the connection so the process can exit
        await mongoose.disconnect();
    }
};

runSeed();
