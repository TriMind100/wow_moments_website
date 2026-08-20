require('dotenv').config();
const express = require('express');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const Template = require('./models/Template');
const Banner   = require('./models/Banner');
const Review   = require('./models/Review');
const ReviewInvite = require('./models/ReviewInvite');

const app = express();
app.use(compression());
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// JWT secret — use env var in production
const JWT_SECRET = process.env.JWT_SECRET || 'wow-moments-jwt-secret-12345';
const JWT_EXPIRY = '14d';

const bcrypt = require('bcryptjs');

// Admin credentials loaded from environment variables (hidden in production)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || 'Kolkode@123';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD_RAW, 10);

// ─── Database Connection (Cached for Serverless) ──────────────────────────────
// On Vercel, each function invocation is stateless but the module may be reused.
// We cache the connection promise so we only connect once per warm container.
let _dbConnectionPromise = null;
let lastMongoError = null;

async function connectDB() {
    if (!process.env.MONGODB_URI) {
        lastMongoError = 'MONGODB_URI environment variable is missing.';
        return false;
    }

    // If already connected, return immediately
    if (mongoose.connection.readyState === 1) {
        lastMongoError = null;
        return true;
    }

    // If a connection attempt is already in progress, wait for it
    if (!_dbConnectionPromise) {
        _dbConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 10000,
            connectTimeoutMS: 8000,
            maxPoolSize: 10,
            minPoolSize: 1,
            retryWrites: true
        }).then(() => {
            console.log('MongoDB connected successfully.');
            lastMongoError = null;
            return true;
        }).catch(err => {
            console.error('MongoDB connection failed:', err.message);
            lastMongoError = err.message;
            _dbConnectionPromise = null; // allow retry on next request
            return false;
        });
    }

    return _dbConnectionPromise;
}

// Handle mongoose connection errors
mongoose.connection.on('error', (err) => {
    console.error('Mongoose runtime error:', err.message);
    lastMongoError = err.message;
    _dbConnectionPromise = null; // reset so next request retries
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// ─── Static Files & Page Routes ────────────────────────────────────────────────
// Serve static assets and files from the client directory
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
if (process.env.VERCEL) {
    app.use('/assets', express.static('/tmp'));
}
app.use('/admin.js', express.static(path.join(__dirname, '../client/admin.js')));
app.use('/script.js', express.static(path.join(__dirname, '../client/script.js')));
app.use('/style.css', express.static(path.join(__dirname, '../client/style.css')));

// Explicit page and SEO routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

app.get('/write-review.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/write-review.html'));
});

app.get('/write-review', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/write-review.html'));
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/sitemap.xml'));
});


// ─── Multer (Image Uploads) ───────────────────────────────────────────────────
// Using memoryStorage so uploaded files are kept as Buffer in RAM.
// We then convert them to a Base64 data URL and store directly in MongoDB.
// This avoids Vercel's ephemeral /tmp filesystem problem (files are wiped
// between cold starts, making stored asset/ paths point to missing files).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024,  // 15 MB file max
        fieldSize: 25 * 1024 * 1024  // 25 MB field max
    }
});

// Helper: convert an uploaded multer file (in memory) to a Base64 data URL
function fileToDataUrl(file) {
    const mimeType = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

// ─── File-based Fallback (Local Dev Only) ─────────────────────────────────────
// Resolve DATA_FILE using process.cwd() first (correct on Vercel) then fall back to __dirname
const DATA_FILE = fs.existsSync(path.join(process.cwd(), 'data', 'templates.json'))
    ? path.join(process.cwd(), 'data', 'templates.json')
    : path.join(__dirname, 'data', 'templates.json');

function readTemplates() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            if (!process.env.VERCEL) {
                fs.writeFileSync(DATA_FILE, JSON.stringify([]));
            } else {
                console.warn('Fallback template file not found on Vercel. Returning empty array.');
                return [];
            }
        }
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('Error reading templates file:', err);
        return [];
    }
}

function writeTemplates(templates) {
    if (process.env.VERCEL) {
        throw new Error('Filesystem is read-only on Vercel. MongoDB Atlas is required.');
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(templates, null, 2));
}

// ─── Reviews file-based fallback ──────────────────────────────────────────────
const REVIEWS_FILE = fs.existsSync(path.join(process.cwd(), 'data', 'reviews.json'))
    ? path.join(process.cwd(), 'data', 'reviews.json')
    : path.join(__dirname, 'data', 'reviews.json');

function readReviews() {
    try {
        if (!fs.existsSync(REVIEWS_FILE)) {
            if (!process.env.VERCEL) {
                fs.writeFileSync(REVIEWS_FILE, JSON.stringify([]));
            } else {
                console.warn('Fallback reviews file not found on Vercel. Returning empty array.');
                return [];
            }
        }
        return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
    } catch (err) {
        console.error('Error reading reviews file:', err);
        return [];
    }
}

function writeReviews(reviews) {
    if (process.env.VERCEL) {
        throw new Error('Filesystem is read-only on Vercel. MongoDB Atlas is required.');
    }
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

// ─── Banner file-based fallback ───────────────────────────────────────────────
const BANNER_FILE = path.join(path.dirname(DATA_FILE), 'banner.json');

function readBannerFile() {
    try {
        if (!fs.existsSync(BANNER_FILE)) return null;
        return JSON.parse(fs.readFileSync(BANNER_FILE, 'utf8'));
    } catch { return null; }
}

function writeBannerFile(data) {
    if (process.env.VERCEL) throw new Error('Filesystem is read-only on Vercel.');
    fs.writeFileSync(BANNER_FILE, JSON.stringify(data, null, 2));
}

// ─── Invites file-based fallback ───────────────────────────────────────────────
const INVITES_FILE = fs.existsSync(path.join(process.cwd(), 'data', 'invites.json'))
    ? path.join(process.cwd(), 'data', 'invites.json')
    : path.join(__dirname, 'data', 'invites.json');

function readInvites() {
    try {
        if (!fs.existsSync(INVITES_FILE)) {
            if (!process.env.VERCEL) {
                fs.writeFileSync(INVITES_FILE, JSON.stringify([]));
            } else {
                console.warn('Fallback invites file not found on Vercel. Returning empty array.');
                return [];
            }
        }
        return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8'));
    } catch (err) {
        console.error('Error reading invites file:', err);
        return [];
    }
}

function writeInvites(invites) {
    if (process.env.VERCEL) {
        throw new Error('Filesystem is read-only on Vercel. MongoDB Atlas is required.');
    }
    fs.writeFileSync(INVITES_FILE, JSON.stringify(invites, null, 2));
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    let token = req.cookies && req.cookies.admin_token;
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized. Admin login required.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) return res.status(401).json({ error: 'Unauthorized.' });
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
}

// ─── API: Auth ────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
        const token = jwt.sign({ isAdmin: true, username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: isHttps,
            sameSite: isHttps ? 'none' : 'lax',
            maxAge: 14 * 24 * 60 * 60 * 1000
        });
        res.json({ success: true, message: 'Logged in successfully', token, isAdmin: true });
    } else {
        res.status(400).json({ success: false, error: 'Invalid username or password' });
    }
});

app.post('/api/logout', (req, res) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax'
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/check-auth', (req, res) => {
    let token = req.cookies && req.cookies.admin_token;
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
    }
    if (!token) return res.json({ isAdmin: false });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ isAdmin: !!decoded.isAdmin, username: decoded.username });
    } catch {
        res.json({ isAdmin: false });
    }
});

// ─── API: Status (Diagnostic) ─────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
    const connected = await connectDB();
    res.json({
        mongoConnected: connected && mongoose.connection.readyState === 1,
        mongoReadyState: mongoose.connection.readyState,
        mongoError: lastMongoError,
        isVercel: !!process.env.VERCEL,
        nodeEnv: process.env.NODE_ENV || 'development',
        hasMongoDB_URI: !!process.env.MONGODB_URI,
        dirname: __dirname,
        cwd: process.cwd(),
        dataFile: DATA_FILE,
        dataFileExists: fs.existsSync(DATA_FILE)
    });
});

// ─── Templates Cache ──────────────────────────────────────────────────────────
let cachedTemplates = null;

function invalidateTemplatesCache() {
    cachedTemplates = null;
    console.log('Templates cache invalidated.');
}

// ─── API: Templates ───────────────────────────────────────────────────────────
app.get('/api/templates', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
        if (cachedTemplates) {
            return res.json(cachedTemplates);
        }

        let templates = [];
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            templates = await Template.find().sort({ createdAt: 1 }).lean();
        } else {
            // Fallback to local file (do not cache local file so DB retries can succeed)
            const fallbackTemplates = readTemplates();
            const optimized = fallbackTemplates.map(t => {
                const temp = { ...t };
                if (temp.image && temp.image.startsWith('data:')) {
                    temp.image = `/api/templates/${temp.id}/image`;
                }
                return temp;
            });
            return res.json(optimized);
        }

        // Optimize templates by stripping base64 strings and serving URL instead
        const optimizedTemplates = templates.map(t => {
            const temp = { ...t };
            if (temp.image && temp.image.startsWith('data:')) {
                temp.image = `/api/templates/${temp.id}/image`;
            }
            return temp;
        });

        // Save to cache
        cachedTemplates = optimizedTemplates;

        res.json(optimizedTemplates);
    } catch (err) {
        console.error('Error getting templates:', err);
        res.status(500).json({ error: 'Server error fetching templates.' });
    }
});

// GET /api/templates/:id/image - serve template image as binary payload
app.get('/api/templates/:id/image', async (req, res) => {
    try {
        const { id } = req.params;
        let template = null;
        
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            template = await Template.findOne({ id }).select('image').lean();
        } else {
            const templates = readTemplates();
            template = templates.find(t => t.id === id);
        }

        if (!template || !template.image) {
            return res.status(404).send('Image not found');
        }

        if (template.image.startsWith('data:')) {
            const matches = template.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (!matches) {
                return res.status(400).send('Invalid image format');
            }
            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return res.send(buffer);
        } else {
            return res.redirect(template.image);
        }
    } catch (err) {
        console.error('Error serving template image:', err);
        res.status(500).send('Server error serving image');
    }
});

app.post('/api/templates', requireAuth, upload.single('imageFile'), async (req, res) => {
    try {
        const { name, price, tag, tagColor, description, preview, categories } = req.body;
        if (!name || !price || !description) {
            return res.status(400).json({ error: 'Name, price, and description are required.' });
        }

        const id = 't' + Date.now();
        let imagePath = '';
        if (req.file) imagePath = fileToDataUrl(req.file); // Base64 data URL stored in MongoDB
        else if (req.body.imageUrl) imagePath = req.body.imageUrl;
        else return res.status(400).json({ error: 'An image file or URL is required.' });

        let parsedCategories = [];
        if (categories) {
            parsedCategories = Array.isArray(categories)
                ? categories
                : categories.split(',').map(c => c.trim()).filter(Boolean);
        }

        const newTemplateData = {
            id, name,
            price: price.startsWith('₹') ? price : '₹' + price,
            tag: tag || null,
            tagColor: tag ? (tagColor || 'bg-primary') : '',
            description, image: imagePath,
            preview: preview || null,
            categories: parsedCategories
        };

        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const newTemplate = new Template(newTemplateData);
            await newTemplate.save();
            invalidateTemplatesCache();
            return res.status(201).json(newTemplate);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection and Vercel environment variables.' });
        }

        const templates = readTemplates();
        templates.push(newTemplateData);
        writeTemplates(templates);
        invalidateTemplatesCache();
        res.status(201).json(newTemplateData);
    } catch (err) {
        console.error('Error adding template:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

app.put('/api/templates/:id', requireAuth, upload.single('imageFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, tag, tagColor, description, preview, categories } = req.body;
        if (!name || !price || !description) {
            return res.status(400).json({ error: 'Name, price, and description are required.' });
        }

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        let existingTemplate;
        if (useMongoNow) {
            existingTemplate = await Template.findOne({ id });
        } else {
            const templates = readTemplates();
            existingTemplate = templates.find(t => t.id === id);
        }

        if (!existingTemplate) return res.status(404).json({ error: 'Template not found' });

        let imagePath = existingTemplate.image;
        if (req.file) {
            imagePath = fileToDataUrl(req.file); // Base64 data URL stored in MongoDB
        } else if (req.body.imageUrl) {
            // Keep the original base64 if frontend passes our virtual image endpoint back to us
            if (!req.body.imageUrl.startsWith('/api/templates/')) {
                imagePath = req.body.imageUrl;
            }
        }

        let parsedCategories = [];
        if (categories) {
            parsedCategories = Array.isArray(categories)
                ? categories
                : categories.split(',').map(c => c.trim()).filter(Boolean);
        }

        const updatedData = {
            name,
            price: price.startsWith('₹') ? price : '₹' + price,
            tag: tag || null,
            tagColor: tag ? (tagColor || 'bg-primary') : '',
            description, image: imagePath,
            preview: preview || null,
            categories: parsedCategories
        };

        if (useMongoNow) {
            const updatedTemplate = await Template.findOneAndUpdate(
                { id }, { $set: updatedData }, { new: true }
            );
            invalidateTemplatesCache();
            return res.json(updatedTemplate);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection and Vercel environment variables.' });
        }

        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates[index] = { ...templates[index], ...updatedData };
        writeTemplates(templates);
        invalidateTemplatesCache();
        res.json(templates[index]);
    } catch (err) {
        console.error('Error updating template:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        let template;
        if (useMongoNow) {
            template = await Template.findOne({ id });
        } else {
            const templates = readTemplates();
            template = templates.find(t => t.id === id);
        }

        if (!template) return res.status(404).json({ error: 'Template not found' });

        if (useMongoNow) {
            await Template.findOneAndDelete({ id });
            invalidateTemplatesCache();
            return res.json({ success: true, message: 'Template deleted' });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection.' });
        }

        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates.splice(index, 1);
        writeTemplates(templates);
        invalidateTemplatesCache();
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── API: Sales ───────────────────────────────────────────────────────────────
// POST /api/sales/run  — apply a discount to one or more templates
app.post('/api/sales/run', requireAuth, async (req, res) => {
    try {
        const { templateIds, discountPercent } = req.body;
        const pct = parseFloat(discountPercent);

        if (!Array.isArray(templateIds) || templateIds.length === 0) {
            return res.status(400).json({ error: 'templateIds must be a non-empty array.' });
        }
        if (isNaN(pct) || pct <= 0 || pct >= 100) {
            return res.status(400).json({ error: 'discountPercent must be between 1 and 99.' });
        }

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        if (useMongoNow) {
            const templates = await Template.find({ id: { $in: templateIds } });
            const bulkOps = templates.map(t => {
                // Only save originalPrice once (don't overwrite if already on sale)
                const storedOriginal = t.originalPrice || t.price;
                const originalNum = parseFloat(storedOriginal.replace(/[^\d.]/g, ''));
                const discounted = Math.round(originalNum * (1 - pct / 100));
                return {
                    updateOne: {
                        filter: { id: t.id },
                        update: {
                            $set: {
                                originalPrice: storedOriginal,
                                discountPercent: pct,
                                price: '₹' + discounted
                            }
                        }
                    }
                };
            });
            await Template.bulkWrite(bulkOps);
            const updated = await Template.find({ id: { $in: templateIds } });
            invalidateTemplatesCache();
            return res.json({ success: true, updated });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const templates = readTemplates();
        const updated = [];
        templates.forEach((t, i) => {
            if (templateIds.includes(t.id)) {
                const storedOriginal = t.originalPrice || t.price;
                const originalNum = parseFloat(storedOriginal.replace(/[^\d.]/g, ''));
                const discounted = Math.round(originalNum * (1 - pct / 100));
                templates[i] = { ...t, originalPrice: storedOriginal, discountPercent: pct, price: '₹' + discounted };
                updated.push(templates[i]);
            }
        });
        writeTemplates(templates);
        invalidateTemplatesCache();
        res.json({ success: true, updated });
    } catch (err) {
        console.error('Error running sale:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// DELETE /api/sales/clear  — remove discount from one or more templates (or all)
app.delete('/api/sales/clear', requireAuth, async (req, res) => {
    try {
        // Body can have { templateIds: [...] } or be empty to clear all
        const { templateIds } = req.body || {};

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        const filter = templateIds && templateIds.length > 0
            ? { id: { $in: templateIds } }
            : {};

        if (useMongoNow) {
            const templates = await Template.find({ ...filter, discountPercent: { $gt: 0 } });
            const bulkOps = templates.map(t => ({
                updateOne: {
                    filter: { id: t.id },
                    update: {
                        $set: {
                            price: t.originalPrice || t.price,
                            originalPrice: null,
                            discountPercent: 0
                        }
                    }
                }
            }));
            if (bulkOps.length > 0) await Template.bulkWrite(bulkOps);
            invalidateTemplatesCache();
            return res.json({ success: true, clearedCount: bulkOps.length });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const templates = readTemplates();
        let clearedCount = 0;
        templates.forEach((t, i) => {
            const match = !templateIds || templateIds.length === 0 || templateIds.includes(t.id);
            if (match && t.discountPercent > 0) {
                templates[i] = { ...t, price: t.originalPrice || t.price, originalPrice: null, discountPercent: 0 };
                clearedCount++;
            }
        });
        writeTemplates(templates);
        invalidateTemplatesCache();
        res.json({ success: true, clearedCount });
    } catch (err) {
        console.error('Error clearing sale:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── API: Banner ──────────────────────────────────────────────────────────────
// GET /api/banner  — public; returns the active banner or { active: false }
app.get('/api/banner', async (req, res) => {
    try {
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const banner = await Banner.findOne({ key: 'main' });
            if (banner && banner.active) {
                return res.json({ active: true, image: banner.image, caption: banner.caption, ctaLink: banner.ctaLink, ctaText: banner.ctaText });
            }
            return res.json({ active: false });
        }
        // File fallback
        const b = readBannerFile();
        if (b && b.active) return res.json(b);
        return res.json({ active: false });
    } catch (err) {
        console.error('Error getting banner:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// POST /api/banner  — admin; upsert banner (activate / update)
app.post('/api/banner', requireAuth, upload.single('bannerImage'), async (req, res) => {
    try {
        const { caption, ctaLink, ctaText, imageUrl } = req.body;

        let imageData = imageUrl || null;
        if (req.file) imageData = fileToDataUrl(req.file);

        if (!imageData) {
            return res.status(400).json({ error: 'A banner image file or URL is required.' });
        }

        const bannerData = {
            active: true,
            image: imageData,
            caption: caption || null,
            ctaLink: ctaLink || '#templates',
            ctaText: ctaText || 'Shop Sale',
            updatedAt: new Date()
        };

        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const banner = await Banner.findOneAndUpdate(
                { key: 'main' },
                { $set: bannerData },
                { upsert: true, new: true }
            );
            return res.json({ success: true, banner });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const existing = readBannerFile() || { key: 'main' };
        const updated = { ...existing, ...bannerData };
        writeBannerFile(updated);
        res.json({ success: true, banner: updated });
    } catch (err) {
        console.error('Error saving banner:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// DELETE /api/banner  — admin; deactivate banner (keeps image, just hides popup)
app.delete('/api/banner', requireAuth, async (req, res) => {
    try {
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            await Banner.findOneAndUpdate(
                { key: 'main' },
                { $set: { active: false, updatedAt: new Date() } },
                { upsert: true }
            );
            return res.json({ success: true });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const existing = readBannerFile() || { key: 'main' };
        writeBannerFile({ ...existing, active: false, updatedAt: new Date() });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deactivating banner:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── API: Review Invitations (Admin only / Public validation) ───────────────────

// GET /api/reviews/invites - admin list all invites
app.get('/api/reviews/invites', requireAuth, async (req, res) => {
    try {
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const invites = await ReviewInvite.find().sort({ createdAt: -1 });
            return res.json(invites);
        }
        res.json(readInvites().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
        console.error('Error getting invites:', err);
        res.status(500).json({ error: 'Server error fetching invitations.' });
    }
});

// POST /api/reviews/invites - admin create a new invite
app.post('/api/reviews/invites', requireAuth, async (req, res) => {
    try {
        const { type } = req.body;
        if (!type || !['single', 'multi'].includes(type)) {
            return res.status(400).json({ error: 'Invalid invite type. Must be single or multi.' });
        }

        const token = 'rev-' + Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
        const inviteData = {
            token,
            type,
            status: 'active',
            submissions: 0,
            createdAt: new Date()
        };

        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const newInvite = new ReviewInvite(inviteData);
            await newInvite.save();
            return res.status(201).json(newInvite);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const invites = readInvites();
        invites.push(inviteData);
        writeInvites(invites);
        res.status(201).json(inviteData);
    } catch (err) {
        console.error('Error creating invite:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// DELETE /api/reviews/invites/:token - admin delete/revoke an invite
app.delete('/api/reviews/invites/:token', requireAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        if (useMongoNow) {
            const deleted = await ReviewInvite.findOneAndDelete({ token });
            if (!deleted) return res.status(404).json({ error: 'Invitation not found' });
            return res.json({ success: true, message: 'Invitation deleted' });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const invites = readInvites();
        const index = invites.findIndex(inv => inv.token === token);
        if (index === -1) return res.status(404).json({ error: 'Invitation not found' });

        invites.splice(index, 1);
        writeInvites(invites);
        res.json({ success: true, message: 'Invitation deleted' });
    } catch (err) {
        console.error('Error deleting invite:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/reviews/verify-invite - public check if invite is valid
app.get('/api/reviews/verify-invite', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ valid: false, error: 'Token is required' });

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        let invite;
        if (useMongoNow) {
            invite = await ReviewInvite.findOne({ token });
        } else {
            invite = readInvites().find(inv => inv.token === token);
        }

        if (!invite) {
            return res.status(404).json({ valid: false, error: 'Invalid invitation link.' });
        }

        if (invite.type === 'single' && invite.status === 'used') {
            return res.status(400).json({ valid: false, error: 'This invitation link has already been used.' });
        }

        res.json({ valid: true, type: invite.type });
    } catch (err) {
        console.error('Error verifying invite:', err);
        res.status(500).json({ valid: false, error: 'Server error verifying invitation.' });
    }
});

// ─── API: Reviews ─────────────────────────────────────────────────────────────
let _cachedAdminReviews = null;
let _cachedAdminReviewsTime = 0;
let _cachedPublicReviews = null;
let _cachedPublicReviewsTime = 0;

function invalidateReviewsCache() {
    _cachedAdminReviews = null;
    _cachedAdminReviewsTime = 0;
    _cachedPublicReviews = null;
    _cachedPublicReviewsTime = 0;
}

// GET /api/reviews - public approved reviews
app.get('/api/reviews', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
        if (_cachedPublicReviews && (Date.now() - _cachedPublicReviewsTime < 30000)) {
            return res.json(_cachedPublicReviews);
        }
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const reviews = await Review.find({ status: 'approved' })
                .select('-__v')
                .sort({ createdAt: -1 })
                .lean();
            _cachedPublicReviews = reviews;
            _cachedPublicReviewsTime = Date.now();
            return res.json(reviews);
        }
        const reviews = readReviews().filter(r => r.status === 'approved');
        _cachedPublicReviews = reviews;
        _cachedPublicReviewsTime = Date.now();
        res.json(reviews);
    } catch (err) {
        console.error('Error getting reviews:', err);
        res.status(500).json({ error: 'Server error fetching reviews.' });
    }
});

// GET /api/reviews/admin - admin view of all reviews
app.get('/api/reviews/admin', requireAuth, async (req, res) => {
    try {
        if (_cachedAdminReviews && (Date.now() - _cachedAdminReviewsTime < 15000)) {
            return res.json(_cachedAdminReviews);
        }
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const reviews = await Review.find()
                .select('-__v')
                .sort({ createdAt: -1 })
                .lean();
            _cachedAdminReviews = reviews;
            _cachedAdminReviewsTime = Date.now();
            return res.json(reviews);
        }
        const reviews = readReviews().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        _cachedAdminReviews = reviews;
        _cachedAdminReviewsTime = Date.now();
        res.json(reviews);
    } catch (err) {
        console.error('Error getting admin reviews:', err);
        res.status(500).json({ error: 'Server error fetching reviews.' });
    }
});

// POST /api/reviews - submit a new review (public or admin)
app.post('/api/reviews', upload.single('avatarFile'), async (req, res) => {
    try {
        const { name, rating, comment, location, avatarUrl, status, token: inviteToken } = req.body;
        const score = parseInt(rating);

        if (!name || isNaN(score) || score < 1 || score > 5 || !comment) {
            return res.status(400).json({ error: 'Name, rating (1-5), and comment are required.' });
        }

        // Check if admin is logged in (to auto-approve and accept admin status/avatar parameters)
        let isAdmin = false;
        let token = req.cookies && req.cookies.admin_token;
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
        }
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.isAdmin) isAdmin = true;
            } catch (err) {}
        }

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        // Validate invite token if provided
        let validatedInvite = null;
        if (inviteToken) {
            if (useMongoNow) {
                validatedInvite = await ReviewInvite.findOne({ token: inviteToken });
            } else {
                validatedInvite = readInvites().find(inv => inv.token === inviteToken);
            }

            if (!validatedInvite) {
                return res.status(400).json({ error: 'Invalid invitation link.' });
            }
            if (validatedInvite.type === 'single' && validatedInvite.status === 'used') {
                return res.status(400).json({ error: 'This invitation link has already been used.' });
            }
        }

        const id = 'r' + Date.now();
        let avatarPath = null;
        if (req.file) {
            avatarPath = fileToDataUrl(req.file);
        } else if (avatarUrl) {
            avatarPath = avatarUrl;
        }

        // If admin submits directly (without invite token), default is 'approved', otherwise 'pending'
        const reviewStatus = (isAdmin && !inviteToken) ? (status || 'approved') : 'pending';

        const newReviewData = {
            id,
            name,
            rating: score,
            comment,
            location: location || '',
            avatar: avatarPath,
            status: reviewStatus,
            createdAt: new Date()
        };

        if (useMongoNow) {
            const newReview = new Review(newReviewData);
            await newReview.save();

            // Invalidate cached reviews
            invalidateReviewsCache();

            // Update token usage if validated
            if (validatedInvite) {
                if (validatedInvite.type === 'single') {
                    await ReviewInvite.findOneAndUpdate({ token: inviteToken }, { $set: { status: 'used' }, $inc: { submissions: 1 } });
                } else {
                    await ReviewInvite.findOneAndUpdate({ token: inviteToken }, { $inc: { submissions: 1 } });
                }
            }

            return res.status(201).json(newReview);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const reviews = readReviews();
        reviews.push(newReviewData);
        writeReviews(reviews);
        invalidateReviewsCache();

        // Update token usage if validated
        if (validatedInvite) {
            const invites = readInvites();
            const idx = invites.findIndex(inv => inv.token === inviteToken);
            if (idx !== -1) {
                invites[idx].submissions += 1;
                if (invites[idx].type === 'single') {
                    invites[idx].status = 'used';
                }
                writeInvites(invites);
            }
        }

        res.status(201).json(newReviewData);
    } catch (err) {
        console.error('Error submitting review:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Update a review (admin only - preserves past avatar and unmodified fields)
async function handleReviewUpdate(req, res) {
    try {
        const { id } = req.params;
        const { name, rating, comment, location, avatarUrl, status } = req.body;
        const score = rating !== undefined ? parseInt(rating) : NaN;

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        let existingReview;
        const reviewQuery = (useMongoNow && mongoose.Types.ObjectId.isValid(id)) ? { $or: [{ id }, { _id: id }] } : { id };

        if (useMongoNow) {
            existingReview = await Review.findOne(reviewQuery);
        } else {
            existingReview = readReviews().find(r => r.id === id || r._id === id);
        }

        if (!existingReview) return res.status(404).json({ error: 'Review not found' });

        // Preserve previous avatar if no new file is uploaded
        let avatarPath = existingReview.avatar;
        if (req.file && req.file.buffer && req.file.buffer.length > 0) {
            avatarPath = fileToDataUrl(req.file);
        } else if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
            avatarPath = avatarUrl.trim();
        }

        const updatedData = {
            name: (name && name.trim()) ? name.trim() : existingReview.name,
            rating: (!isNaN(score) && score >= 1 && score <= 5) ? score : existingReview.rating,
            comment: (comment && comment.trim()) ? comment.trim() : existingReview.comment,
            location: location !== undefined ? location.trim() : existingReview.location,
            avatar: avatarPath,
            status: (status && ['approved', 'pending'].includes(status)) ? status : existingReview.status
        };

        invalidateReviewsCache();

        if (useMongoNow) {
            const updatedReview = await Review.findOneAndUpdate(
                reviewQuery, { $set: updatedData }, { new: true }
            );
            return res.json(updatedReview);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const reviews = readReviews();
        const index = reviews.findIndex(r => r.id === id || r._id === id);
        reviews[index] = { ...reviews[index], ...updatedData };
        writeReviews(reviews);
        res.json(reviews[index]);
    } catch (err) {
        console.error('Error updating review:', err);
        res.status(500).json({ error: 'Server error updating review: ' + err.message });
    }
}

app.put('/api/reviews/:id', requireAuth, upload.single('avatarFile'), handleReviewUpdate);
app.post('/api/reviews/:id/edit', requireAuth, upload.single('avatarFile'), handleReviewUpdate);

// Handler for status update (supports POST, PATCH, and PUT)
async function handleReviewStatusUpdate(req, res) {
    try {
        const { id } = req.params;
        const status = req.body.status || (req.path.endsWith('/approve') ? 'approved' : null);

        if (!status || !['approved', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "approved" or "pending".' });
        }

        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;
        const reviewQuery = (useMongoNow && mongoose.Types.ObjectId.isValid(id)) ? { $or: [{ id }, { _id: id }] } : { id };

        invalidateReviewsCache();

        if (useMongoNow) {
            const updatedReview = await Review.findOneAndUpdate(
                reviewQuery,
                { $set: { status } },
                { new: true }
            );
            if (!updatedReview) return res.status(404).json({ error: 'Review not found' });
            return res.json({ success: true, review: updatedReview });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const reviews = readReviews();
        const index = reviews.findIndex(r => r.id === id || r._id === id);
        if (index === -1) return res.status(404).json({ error: 'Review not found' });

        reviews[index].status = status;
        writeReviews(reviews);
        res.json({ success: true, review: reviews[index] });
    } catch (err) {
        console.error('Error updating review status:', err);
        res.status(500).json({ error: 'Server error updating review status: ' + err.message });
    }
}

app.patch('/api/reviews/:id/status', requireAuth, handleReviewStatusUpdate);
app.post('/api/reviews/:id/status', requireAuth, handleReviewStatusUpdate);
app.post('/api/reviews/:id/approve', requireAuth, handleReviewStatusUpdate);

// DELETE /api/reviews/:id - delete a review (admin only)
app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const mongoOk = await connectDB();
        const useMongoNow = mongoOk && mongoose.connection.readyState === 1;

        let review;
        if (useMongoNow) {
            review = await Review.findOne({ id });
        } else {
            review = readReviews().find(r => r.id === id);
        }

        if (!review) return res.status(404).json({ error: 'Review not found' });

        invalidateReviewsCache();

        if (useMongoNow) {
            await Review.findOneAndDelete({ id });
            return res.json({ success: true, message: 'Review deleted' });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected.' });
        }

        const reviews = readReviews();
        const index = reviews.findIndex(r => r.id === id);
        reviews.splice(index, 1);
        writeReviews(reviews);
        res.json({ success: true, message: 'Review deleted' });
    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── API: Health Check & Self-Pinging (Render Keep-Alive) ──────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// Self-pinging mechanism (runs every 10 minutes on Render)
const HEALTH_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const serviceUrl = process.env.RENDER_EXTERNAL_URL;

if (serviceUrl && !process.env.VERCEL) {
    const keepAliveTimer = setInterval(() => {
        try {
            const https = require('https');
            const http = require('http');
            const client = serviceUrl.startsWith('https') ? https : http;

            const req = client.get(`${serviceUrl}/api/health`, { timeout: 10000 }, (resp) => {
                resp.resume(); // Discard data immediately to free memory
                resp.on('end', () => {
                    // Completed ping
                });
            });

            req.on('timeout', () => {
                req.destroy();
            });

            req.on('error', (err) => {
                // Silently handle offline/dns error during restarts
            });
        } catch (err) {
            // Ignore timer exceptions
        }
    }, HEALTH_CHECK_INTERVAL);

    if (keepAliveTimer.unref) keepAliveTimer.unref();
}

// ─── Start Server (Local Only) ────────────────────────────────────────────────
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
