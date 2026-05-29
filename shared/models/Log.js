const mongoose = require('mongoose');

// the logs collection holds anything pino sends to it. the schema is
// kept open with strict:false so unexpected fields are saved as well
const logSchema = new mongoose.Schema({
    level: {
        type: Number
    },
    time: {
        type: Date
    },
    pid: {
        type: Number
    },
    hostname: {
        type: String
    },
    msg: {
        type: String
    },
    method: {
        type: String
    },
    url: {
        type: String
    },
    statusCode: {
        type: Number
    },
    endpoint: {
        type: String
    }
}, {
    collection: 'logs',
    versionKey: false,
    strict: false,
    timestamps: false
});

module.exports = mongoose.model('Log', logSchema);
