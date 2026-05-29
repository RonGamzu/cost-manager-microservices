const mongoose = require('mongoose');

/**
 * Opens a single connection to the MongoDB Atlas database. Every
 * microservice calls this once at startup.
 * @param {string} uri - the full mongodb connection string.
 * @returns {Promise<typeof mongoose>} the connected mongoose instance.
 */
const connectDb = async (uri) => {
    // surface a clear error early instead of letting mongoose hang
    if (typeof uri !== 'string' || uri.length === 0) {
        throw new Error('MONGODB_URI is missing');
    }
    try {
        // the default options are fine for a modern mongoose version
        const connection = await mongoose.connect(uri);
        return connection;
    } catch (error) {
        // wrap the original error so callers know where it came from
        throw new Error(`failed to connect to mongo: ${error.message}`);
    }
};

module.exports = { connectDb };
