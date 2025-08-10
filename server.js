const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const geoip = require('geoip-lite');
const cron = require('node-cron');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const userRoutes = require('./routes/user');
const { initializeDatabase } = require('./database/db');
const newsService = require('./services/newsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://newsapi.org", "https://api.marketaux.com"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/user', userRoutes);

// Location detection endpoint
app.get('/api/location', (req, res) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const geo = geoip.lookup(clientIP);

        if (geo) {
            res.json({
                city: geo.city,
                state: geo.region,
                country: geo.country,
                timezone: geo.timezone
            });
        } else {
            // Fallback location for development/localhost
            res.json({
                city: 'San Francisco',
                state: 'CA',
                country: 'US',
                timezone: 'America/Los_Angeles'
            });
        }
    } catch (error) {
        console.error('Location detection error:', error);
        res.status(500).json({ error: 'Failed to detect location' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Scheduled news refresh every 2 hours
cron.schedule('0 */2 * * *', () => {
    console.log('Running scheduled news refresh...');
    newsService.refreshNewsCache();
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        console.log('Database initialized successfully');

        app.listen(PORT, () => {
            console.log(`Business News Aggregator running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

            // Initial news cache population
            newsService.refreshNewsCache();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;