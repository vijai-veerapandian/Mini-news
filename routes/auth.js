const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery } = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const JWT_EXPIRES_IN = '7d';

// Input validation middleware
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    return password && password.length >= 6;
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            careerField,
            industries,
            city,
            state,
            country
        } = req.body;

        // Validate input
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (!firstName || !lastName || !careerField) {
            return res.status(400).json({ error: 'First name, last name, and career field are required' });
        }

        // Check if user already exists
        const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const userId = uuidv4();
        const industriesJson = JSON.stringify(industries || []);
        const preferencesJson = JSON.stringify({
            emailNotifications: true,
            newsRefreshInterval: 2, // hours
            articlesPerCategory: 5
        });

        await runQuery(`
      INSERT INTO users 
      (id, email, password_hash, first_name, last_name, career_field, industries, 
       city, state, country, preferences)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            userId,
            email.toLowerCase().trim(),
            passwordHash,
            firstName.trim(),
            lastName.trim(),
            careerField,
            industriesJson,
            city?.trim() || '',
            state?.trim() || '',
            country?.trim() || '',
            preferencesJson
        ]);

        // Generate JWT token
        const token = jwt.sign(
            { userId, email: email.toLowerCase() },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Save session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await runQuery(`
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, userId, token, expiresAt.toISOString()]);

        // Return user data (excluding password hash)
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: userId,
                email: email.toLowerCase(),
                firstName,
                lastName,
                careerField,
                industries: industries || [],
                city: city || '',
                state: state || '',
                country: country || ''
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Find user
        const user = await getQuery(`
      SELECT id, email, password_hash, first_name, last_name, career_field, 
             industries, city, state, country, preferences
      FROM users WHERE email = ?
    `, [email.toLowerCase().trim()]);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Clean up old sessions for this user
        await runQuery('DELETE FROM user_sessions WHERE user_id = ? AND expires_at < datetime("now")', [user.id]);

        // Save new session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await runQuery(`
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, user.id, token, expiresAt.toISOString()]);

        // Return user data (excluding password hash)
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                careerField: user.career_field,
                industries: JSON.parse(user.industries || '[]'),
                city: user.city,
                state: user.state,
                country: user.country,
                preferences: JSON.parse(user.preferences || '{}')
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login user' });
    }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.token;

        // Remove session from database
        await runQuery('DELETE FROM user_sessions WHERE token = ?', [token]);

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Verify token endpoint
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        const user = await getQuery(`
      SELECT id, email, first_name, last_name, career_field, industries, 
             city, state, country, preferences
      FROM users WHERE id = ?
    `, [req.userId]);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                careerField: user.career_field,
                industries: JSON.parse(user.industries || '[]'),
                city: user.city,
                state: user.state,
                country: user.country,
                preferences: JSON.parse(user.preferences || '{}')
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Failed to verify token' });
    }
});

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if session exists and is valid
        const session = await getQuery(`
      SELECT user_id FROM user_sessions 
      WHERE token = ? AND expires_at > datetime('now')
    `, [token]);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.token = token;
        next();
    } catch (error) {
        console.error('Token authentication error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(500).json({ error: 'Token verification failed' });
    }
}

module.exports = router;