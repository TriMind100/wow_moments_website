const mongoose = require('mongoose');

const reviewInviteSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    type: {
        type: String,
        enum: ['single', 'multi'],
        default: 'single'
    },
    status: {
        type: String,
        enum: ['active', 'used'],
        default: 'active'
    },
    submissions: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ReviewInvite', reviewInviteSchema);
