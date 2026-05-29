const mongoose = require('mongoose');

// the users collection uses a custom numeric id that is independent
// from the native _id mongo assigns to every document
const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    first_name: {
        type: String,
        required: true,
        trim: true
    },
    last_name: {
        type: String,
        required: true,
        trim: true
    },
    // birthday is optional because the seed user does not have one
    birthday: {
        type: Date,
        required: false
    }
}, {
    collection: 'users',
    versionKey: false
});

module.exports = mongoose.model('User', userSchema);
