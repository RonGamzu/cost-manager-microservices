const mongoose = require('mongoose');

// only five categories are accepted by the assignment
const allowedCategories = ['food', 'health', 'housing', 'sports', 'education'];

const costSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: allowedCategories
    },
    // userid is the custom numeric id of the user, not the mongo _id
    userid: {
        type: Number,
        required: true,
        index: true
    },
    sum: {
        type: Number,
        required: true,
        min: 0
    },
    // createdAt defaults to the moment the document is created
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    collection: 'costs',
    versionKey: false
});

module.exports = mongoose.model('Cost', costSchema);
module.exports.allowedCategories = allowedCategories;
