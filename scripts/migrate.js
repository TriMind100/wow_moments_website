require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Template = require('../models/Template');

const DATA_FILE = path.join(__dirname, '..', 'data', 'templates.json');

async function runMigration() {
    console.log('Starting data migration...');

    const dbUri = process.env.MONGODB_URI;
    if (!dbUri) {
        console.error('Error: MONGODB_URI is not set in your .env file.');
        process.exit(1);
    }

    if (!fs.existsSync(DATA_FILE)) {
        console.error(`Error: Local template file not found at ${DATA_FILE}`);
        process.exit(1);
    }

    let templates = [];
    try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        templates = JSON.parse(fileContent);
    } catch (err) {
        console.error('Error reading/parsing templates.json:', err);
        process.exit(1);
    }

    if (!Array.isArray(templates) || templates.length === 0) {
        console.log('No templates to migrate in local data file.');
        process.exit(0);
    }

    console.log(`Found ${templates.length} local templates. Connecting to database...`);

    try {
        await mongoose.connect(dbUri);
        console.log('Connected to cloud MongoDB database.');

        let migratedCount = 0;
        let skippedCount = 0;

        for (const templateData of templates) {
            const { id } = templateData;
            if (!id) {
                console.warn('Skipping item without an ID:', templateData);
                continue;
            }

            // Clean up template structure to fit the schema
            const doc = {
                id: templateData.id,
                name: templateData.name,
                price: templateData.price,
                tag: templateData.tag || null,
                tagColor: templateData.tagColor || '',
                description: templateData.description,
                image: templateData.image,
                preview: templateData.preview || null,
                categories: Array.isArray(templateData.categories) ? templateData.categories : []
            };

            // Use findOneAndUpdate with upsert to prevent duplicates and update if needed
            const result = await Template.findOneAndUpdate(
                { id },
                { $set: doc },
                { upsert: true, new: true, rawResult: true }
            );

            if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                console.log(`Template "${doc.name}" (${id}) updated in database.`);
                skippedCount++;
            } else {
                console.log(`Template "${doc.name}" (${id}) newly inserted into database.`);
                migratedCount++;
            }
        }

        console.log('\nMigration Summary:');
        console.log(`- Newly inserted: ${migratedCount}`);
        console.log(`- Updated existing: ${skippedCount}`);
        console.log('Migration completed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database.');
    }
}

runMigration();
