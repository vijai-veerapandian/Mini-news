const express = require('express');
const bcrypt = require('bcryptjs');
const { getQuery, runQuery, allQuery } = require('../database/db');

const router = express.Router();

// Middleware to authenticate requests
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = await getQuery(`
      SELECT user_id FROM user_sessions 
      WHERE token = ? AND expires_at > datetime('now')
    `, [token]);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await getQuery(`
      SELECT id, email, first_name, last_name, career_field, industries,
             city, state, country, preferences, created_at, updated_at
      FROM users WHERE id = ?
    `, [req.userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
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
                preferences: JSON.parse(user.preferences || '{}'),
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            careerField,
            industries,
            city,
            state,
            country,
            preferences
        } = req.body;

        // Validate input
        if (!firstName || !lastName || !careerField) {
            return res.status(400).json({ error: 'First name, last name, and career field are required' });
        }

        // Sanitize inputs
        const sanitizedData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            careerField: careerField.trim(),
            industries: Array.isArray(industries) ? industries : [],
            city: city?.trim() || '',
            state: state?.trim() || '',
            country: country?.trim() || '',
            preferences: typeof preferences === 'object' ? preferences : {}
        };

        // Update user profile
        await runQuery(`
      UPDATE users 
      SET first_name = ?, last_name = ?, career_field = ?, industries = ?,
          city = ?, state = ?, country = ?, preferences = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [
            sanitizedData.firstName,
            sanitizedData.lastName,
            sanitizedData.careerField,
            JSON.stringify(sanitizedData.industries),
            sanitizedData.city,
            sanitizedData.state,
            sanitizedData.country,
            JSON.stringify(sanitizedData.preferences),
            req.userId
        ]);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: sanitizedData
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get current user
        const user = await getQuery('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await runQuery(`
      UPDATE users 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [newPasswordHash, req.userId]);

        // Invalidate all existing sessions for security
        await runQuery('DELETE FROM user_sessions WHERE user_id = ?', [req.userId]);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again.',
            requireReauth: true
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Get user reading statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Get reading statistics
        const readingStats = await allQuery(`
      SELECT 
        COUNT(*) as total_articles_read,
        AVG(reading_time) as avg_reading_time,
        SUM(reading_time) as total_reading_time,
        DATE(read_at) as read_date,
        COUNT(*) as daily_count
      FROM user_reading_history 
      WHERE user_id = ? AND read_at >= date('now', '-30 days')
      GROUP BY DATE(read_at)
      ORDER BY read_date DESC
    `, [req.userId]);

        // Get bookmark count
        const bookmarkCount = await getQuery(`
      SELECT COUNT(*) as count FROM user_bookmarks WHERE user_id = ?
    `, [req.userId]);

        // Get top categories
        const topCategories = await allQuery(`
      SELECT 
        n.category,
        COUNT(*) as count
      FROM user_reading_history h
      JOIN news_articles n ON h.article_id = n.id
      WHERE h.user_id = ? AND h.read_at >= date('now', '-30 days')
      GROUP BY n.category
      ORDER BY count DESC
      LIMIT 5
    `, [req.userId]);

        // Calculate totals
        const totalArticles = readingStats.reduce((sum, day) => sum + day.daily_count, 0);
        const totalTime = readingStats.reduce((sum, day) => sum + (day.total_reading_time || 0), 0);
        const avgTime = totalArticles > 0 ? totalTime / totalArticles : 0;

        res.json({
            success: true,
            stats: {
                totalArticlesRead: totalArticles,
                totalReadingTime: Math.round(totalTime), // in seconds
                averageReadingTime: Math.round(avgTime), // in seconds
                bookmarkedArticles: bookmarkCount?.count || 0,
                dailyReadingHistory: readingStats,
                topCategories: topCategories,
                period: '30 days'
            }
        });

    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password confirmation required' });
        }

        // Verify password
        const user = await getQuery('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Password is incorrect' });
        }

        // Delete user data (in order due to foreign key constraints)
        await runQuery('DELETE FROM user_reading_history WHERE user_id = ?', [req.userId]);
        await runQuery('DELETE FROM user_bookmarks WHERE user_id = ?', [req.userId]);
        await runQuery('DELETE FROM user_sessions WHERE user_id = ?', [req.userId]);
        await runQuery('DELETE FROM users WHERE id = ?', [req.userId]);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting user account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Get available career fields (public endpoint)
router.get('/career-fields', async (req, res) => {
    try {
        const careerFields = [
            { value: 'technology', label: 'Technology', industries: ['Software', 'AI/ML', 'Cybersecurity', 'Cloud Computing'] },
            { value: 'finance', label: 'Finance', industries: ['Banking', 'Investment', 'Insurance', 'Fintech'] },
            { value: 'healthcare', label: 'Healthcare', industries: ['Medical', 'Pharmaceutical', 'Biotech', 'Health Tech'] },
            { value: 'real_estate', label: 'Real Estate', industries: ['Commercial', 'Residential', 'Property Management', 'Construction'] },
            { value: 'retail', label: 'Retail', industries: ['E-commerce', 'Consumer Goods', 'Fashion', 'Food & Beverage'] },
            { value: 'energy', label: 'Energy', industries: ['Oil & Gas', 'Renewable Energy', 'Utilities', 'Mining'] },
            { value: 'manufacturing', label: 'Manufacturing', industries: ['Automotive', 'Aerospace', 'Industrial', 'Electronics'] },
            { value: 'consulting', label: 'Consulting', industries: ['Management', 'Strategy', 'Business Services', 'HR'] },
            { value: 'legal', label: 'Legal', industries: ['Corporate Law', 'Compliance', 'Regulatory', 'Litigation'] },
            { value: 'marketing', label: 'Marketing', industries: ['Digital Marketing', 'Advertising', 'PR', 'Content Marketing'] },
            { value: 'education', label: 'Education', industries: ['EdTech', 'Higher Education', 'Training', 'Publishing'] },
            { value: 'government', label: 'Government', industries: ['Public Policy', 'Defense', 'Municipal', 'Federal'] }
        ];

        res.json({
            success: true,
            careerFields
        });

    } catch (error) {
        console.error('Error fetching career fields:', error);
        res.status(500).json({ error: 'Failed to fetch career fields' });
    }
});

module.exports = router;