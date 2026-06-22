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

// Connect to MongoDB Atlas (if URI provided)
function useMongo() {
    return !!(process.env.MONGODB_URI && mongoose.connection.readyState === 1);
}

// Catch mongoose connection errors to prevent unhandled rejection crashes
mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err.message);
});

if (process.env.MONGODB_URI) {
    console.log('Connecting to cloud MongoDB database...');
    mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
        .then(() => {
            console.log('Successfully connected to Cloud MongoDB!');
        })
        .catch(err => {
            console.error('MongoDB connection error. Falling back to local file-based database.', err.message);
        });
} else {
    console.warn('WARNING: MONGODB_URI not defined. CMS will run in Local Fallback Mode.');
}

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static directories/files
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/admin.js', express.static(path.join(__dirname, 'admin.js')));
app.use('/admin.css', express.static(path.join(__dirname, 'admin.css')));
app.use('/script.js', express.static(path.join(__dirname, 'script.js')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'code.html'));
});

// Admin page route
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = path.join(__dirname, 'assets');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Helper functions for reading/writing templates data
const DATA_FILE = path.join(__dirname, 'data', 'templates.json');

function readTemplates() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading templates file:', err);
        return [];
    }
}

function writeTemplates(templates) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(templates, null, 2));
    } catch (err) {
        console.error('Error writing templates file:', err);
    }
}

// JWT Authentication Middleware
// Works statelessly — no session store needed, no cross-container issues on Vercel
function requireAuth(req, res, next) {
    // Support token from cookie OR Authorization header (Bearer token)
    let token = req.cookies && req.cookies.admin_token;
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized. Session expired or invalid. Please log in again.' });
    }
}

// API Routes

// Admin Login — issues a JWT cookie
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'Kolkode@123') {
        const token = jwt.sign({ isAdmin: true, username: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
        });
        res.json({ success: true, message: 'Logged in successfully' });
    } else {
        res.status(400).json({ success: false, error: 'Invalid username or password' });
    }
});

// Admin Logout — clears the JWT cookie
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

// Check Auth Status — verifies JWT from cookie
app.get('/api/check-auth', (req, res) => {
    let token = req.cookies && req.cookies.admin_token;
    if (!token) {
        return res.json({ isAdmin: false });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ isAdmin: !!decoded.isAdmin });
    } catch (err) {
        res.json({ isAdmin: false });
    }
});

// Get all templates
app.get('/api/templates', async (req, res) => {
    try {
        if (useMongo()) {
            const templates = await Template.find().sort({ createdAt: 1 });
            return res.json(templates);
        }

        // Fallback to local file
        const templates = readTemplates();
        res.json(templates);
    } catch (err) {
        console.error('Error getting templates:', err);
        res.status(500).json({ error: 'Server error fetching templates.' });
    }
});

// Add new template (Requires Auth and Image Upload)
app.post('/api/templates', requireAuth, upload.single('imageFile'), async (req, res) => {
    try {
        const { name, price, tag, tagColor, description, preview, categories } = req.body;

        if (!name || !price || !description) {
            return res.status(400).json({ error: 'Name, price, and description are required.' });
        }

        const id = 't' + (Date.now());

        let imagePath = '';
        if (req.file) {
            imagePath = 'assets/' + req.file.filename;
        } else if (req.body.imageUrl) {
            imagePath = req.body.imageUrl;
        } else {
            return res.status(400).json({ error: 'Either an image file or an image URL is required.' });
        }

        let parsedCategories = [];
        if (categories) {
            parsedCategories = Array.isArray(categories)
                ? categories
                : categories.split(',').map(c => c.trim()).filter(Boolean);
        }

        const newTemplateData = {
            id,
            name,
            price: price.startsWith('₹') ? price : '₹' + price,
            tag: tag || null,
            tagColor: tag ? (tagColor || 'bg-primary') : '',
            description,
            image: imagePath,
            preview: preview || null,
            categories: parsedCategories
        };

        if (useMongo()) {
            const newTemplate = new Template(newTemplateData);
            await newTemplate.save();
            return res.status(201).json(newTemplate);
        }

        // Fallback to local file
        const templates = readTemplates();
        templates.push(newTemplateData);
        writeTemplates(templates);

        res.status(201).json(newTemplateData);
    } catch (err) {
        console.error('Error adding template:', err);
        res.status(500).json({ error: 'Server error adding template.' });
    }
});

// Update/Edit template (Requires Auth and optional Image Upload)
app.put('/api/templates/:id', requireAuth, upload.single('imageFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, tag, tagColor, description, preview, categories } = req.body;

        if (!name || !price || !description) {
            return res.status(400).json({ error: 'Name, price, and description are required.' });
        }

        let existingTemplate;
        if (useMongo()) {
            existingTemplate = await Template.findOne({ id });
        } else {
            const templates = readTemplates();
            existingTemplate = templates.find(t => t.id === id);
        }

        if (!existingTemplate) {
            return res.status(404).json({ error: 'Template not found' });
        }

        let imagePath = existingTemplate.image;
        if (req.file) {
            // Delete old uploaded image if it's not a default asset
            if (existingTemplate.image && existingTemplate.image.startsWith('assets/') &&
                !existingTemplate.id.startsWith('t1') &&
                !existingTemplate.id.startsWith('t2') &&
                !existingTemplate.id.startsWith('t3') &&
                !existingTemplate.id.startsWith('t4') &&
                !existingTemplate.id.startsWith('t5') &&
                !existingTemplate.id.startsWith('t6') &&
                !existingTemplate.id.startsWith('t7') &&
                !existingTemplate.id.startsWith('t8')) {
                const oldImgFilePath = path.join(__dirname, existingTemplate.image);
                if (fs.existsSync(oldImgFilePath)) {
                    try {
                        fs.unlinkSync(oldImgFilePath);
                    } catch (unlinkErr) {
                        console.error('Error deleting old image file:', unlinkErr);
                    }
                }
            }
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
            description,
            image: imagePath,
            preview: preview || null,
            categories: parsedCategories
        };

        if (useMongo()) {
            const updatedTemplate = await Template.findOneAndUpdate(
                { id },
                { $set: updatedData },
                { new: true }
            );
            return res.json(updatedTemplate);
        }

        // Fallback to local file update
        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates[index] = {
            ...templates[index],
            ...updatedData
        };
        writeTemplates(templates);

        res.json(templates[index]);
    } catch (err) {
        console.error('Error updating template:', err);
        res.status(500).json({ error: 'Server error updating template.' });
    }
});

// Delete template
app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let template;

        if (useMongo()) {
            template = await Template.findOne({ id });
        } else {
            const templates = readTemplates();
            template = templates.find(t => t.id === id);
        }

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        if (template.image && template.image.startsWith('assets/')) {
            const imgFilePath = path.join(__dirname, template.image);
            if (fs.existsSync(imgFilePath)) {
                // Keep default assets from deletion, only delete dynamically uploaded ones
                if (!template.id.startsWith('t1') &&
                    !template.id.startsWith('t2') &&
                    !template.id.startsWith('t3') &&
                    !template.id.startsWith('t4') &&
                    !template.id.startsWith('t5') &&
                    !template.id.startsWith('t6') &&
                    !template.id.startsWith('t7') &&
                    !template.id.startsWith('t8')) {
                    try {
                        fs.unlinkSync(imgFilePath);
                    } catch (unlinkErr) {
                        console.error('Error deleting image file:', unlinkErr);
                    }
                }
            }
        }

        if (useMongo()) {
            await Template.findOneAndDelete({ id });
            return res.json({ success: true, message: 'Template deleted' });
        }

        // Fallback to local file delete
        const templates = readTemplates();
        const index = templates.findIndex(t => t.id === id);
        templates.splice(index, 1);
        writeTemplates(templates);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Server error deleting template.' });
    }
});


// Start Server
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
