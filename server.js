require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const Template = require('./models/Template');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// JWT secret — use env var in production
const JWT_SECRET = process.env.JWT_SECRET || 'wow-moments-jwt-secret-12345';
const JWT_EXPIRY = '14d';

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/assets', express.static(path.join(__dirname, 'assets')));
if (process.env.VERCEL) {
    app.use('/assets', express.static('/tmp'));
}
app.use('/admin.js', express.static(path.join(__dirname, 'admin.js')));
app.use('/admin.css', express.static(path.join(__dirname, 'admin.css')));
app.use('/script.js', express.static(path.join(__dirname, 'script.js')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));

// ─── Page Routes ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'code.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Multer (Image Uploads) ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'assets');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

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
    if (username === 'admin' && password === 'Kolkode@123') {
        const token = jwt.sign({ isAdmin: true, username: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 14 * 24 * 60 * 60 * 1000
        });
        res.json({ success: true, message: 'Logged in successfully' });
    } else {
        res.status(400).json({ success: false, error: 'Invalid username or password' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/check-auth', (req, res) => {
    let token = req.cookies && req.cookies.admin_token;
    if (!token) return res.json({ isAdmin: false });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ isAdmin: !!decoded.isAdmin });
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

// ─── API: Templates ───────────────────────────────────────────────────────────
app.get('/api/templates', async (req, res) => {
    try {
        const mongoOk = await connectDB();
        if (mongoOk && mongoose.connection.readyState === 1) {
            const templates = await Template.find().sort({ createdAt: 1 });
            return res.json(templates);
        }
        // Fallback to local file
        res.json(readTemplates());
    } catch (err) {
        console.error('Error getting templates:', err);
        res.status(500).json({ error: 'Server error fetching templates.' });
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
        if (req.file) imagePath = 'assets/' + req.file.filename;
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
            return res.status(201).json(newTemplate);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection and Vercel environment variables.' });
        }

        const templates = readTemplates();
        templates.push(newTemplateData);
        writeTemplates(templates);
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
            imagePath = 'assets/' + req.file.filename;
        } else if (req.body.imageUrl) {
            imagePath = req.body.imageUrl;
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
            return res.json(updatedTemplate);
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection and Vercel environment variables.' });
        }

        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates[index] = { ...templates[index], ...updatedData };
        writeTemplates(templates);
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
            return res.json({ success: true, message: 'Template deleted' });
        }

        if (process.env.VERCEL) {
            return res.status(503).json({ error: 'Database not connected. Please check MongoDB Atlas connection.' });
        }

        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates.splice(index, 1);
        writeTemplates(templates);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ─── Start Server (Local Only) ────────────────────────────────────────────────
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
