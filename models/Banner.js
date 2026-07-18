const mongoose = require('mongoose');

/**
 * Banner document — only ever one record.
 * `active: true`  → show popup on main site.
 * `active: false` → popup hidden (sale cleared or banner removed).
 */
const bannerSchema = new mongoose.Schema({
    // Singleton key so we can always findOneAndUpdate({ key: 'main' }, ...)
    key: {
        type: String,
        default: 'main',
        unique: true,
        index: true
    },
    active: {
        type: Boolean,
        default: false
    },
    // Base64 data URL of the banner image
    image: {
        type: String,
        default: null
    },
    // Optional caption / sub-text shown below the image in the popup
    caption: {
        type: String,
        default: null
    },
    // Optional CTA link (e.g. anchor to #templates)
    ctaLink: {
        type: String,
        default: '#templates'
    },
    // Optional CTA button text
    ctaText: {
        type: String,
        default: 'Shop Sale'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Banner', bannerSchema);
