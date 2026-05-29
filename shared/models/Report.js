const mongoose = require('mongoose');

/*
 * Report stores the result of a monthly cost report so the Computed
 * Design Pattern can return it directly on the next request instead of
 * recomputing it. Only reports for months that already ended are saved.
 */
const reportSchema = new mongoose.Schema({
    userid: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    // costs holds the same grouped structure the api returns
    costs: {
        type: Array,
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'reports',
    versionKey: false
});

// the combination of user + year + month must be unique
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
