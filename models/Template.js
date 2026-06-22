const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: String,
        required: true,
        trim: true
    },
    tag: {
        type: String,
        default: null
    },
    tagColor: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    preview: {
        type: String,
        default: null
    },
    categories: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Template', templateSchema);
