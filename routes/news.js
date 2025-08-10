const express = require('express');
const { getQuery, allQuery, runQuery } = require('../database/db');
const newsService = require('../services/newsService');

const router = express.Router();

// Middleware to authenticate requests (reusing from auth.js)
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

// Get personalized news for authenticated user
router.get('/personalized', authenticateToken, async (req, res) => {
    try {
        // Get user profile
        const user = await getQuery(`
      SELECT first_name, last_name, career_field, industries, city, state, country, preferences
      FROM users WHERE id = ?
    `, [req.userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userProfile = {
            firstName: user.first_name,
            lastName: user.last_name,
            career_field: user.career_field,
            industries: JSON.parse(user.industries || '[]'),
            city: user.city || 'San Francisco', // Default fallback
            state: user.state || 'CA',
            country: user.country || 'US',
            preferences: JSON.parse(user.preferences || '{}')
        };

        // Fetch personalized news
        const personalizedNews = await newsService.getPersonalizedNews(userProfile);

        // Save articles to cache for future reference
        const allArticles = [
            ...personalizedNews.local,
            ...personalizedNews.regional,
            ...personalizedNews.national,
            ...personalizedNews.industry,
            ...personalizedNews.global
        ];

        for (const article of allArticles) {
            await newsService.saveArticleToCache(article);
        }

        res.json({
            success: true,
            user: {
                name: `${userProfile.firstName} ${userProfile.lastName}`,
                location: `${userProfile.city}, ${userProfile.state}, ${userProfile.country}`,
                career: userProfile.career_field
            },
            news: personalizedNews,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching personalized news:', error);
        res.status(500).json({ error: 'Failed to fetch personalized news' });
    }
});

// Get news by category for authenticated user
router.get('/category/:category', authenticateToken, async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 10 } = req.query;

        const validCategories = ['local', 'regional', 'national', 'industry', 'global'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        // Get user profile for context
        const user = await getQuery(`
      SELECT career_field, city, state, country FROM users WHERE id = ?
    `, [req.userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let articles = [];

        if (category === 'industry') {
            articles = await newsService.getIndustryNews(user.career_field, parseInt(limit));
        } else if (category === 'local' || category === 'regional' || category === 'national') {
            const locationNews = await newsService.getLocationBasedNews(
                user.city, user.state, user.country, parseInt(limit)
            );
            articles = locationNews.filter(article => article.location_type === category);
        } else if (category === 'global') {
            const globalArticles = await newsService.fetchNewsFromAPI('global business economy', parseInt(limit));
            articles = globalArticles.map(article => ({
                id: require('uuid').v4(),
                title: newsService.sanitizeText(article.title),
                description: newsService.sanitizeText(article.description),
                url: article.url,
                image_url: article.urlToImage,
                published_at: article.publishedAt,
                source_name: article.source?.name || 'Unknown',
                category: 'global'
            }));
        }

        res.json({
            success: true,
            category,
            articles,
            count: articles.length
        });

    } catch (error) {
        console.error('Error fetching category news:', error);
        res.status(500).json({ error: 'Failed to fetch category news' });
    }
});

// Search news articles
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Sanitize search query
        const sanitizedQuery = query.replace(/[^\w\s-]/g, '').trim();
        if (!sanitizedQuery) {
            return res.status(400).json({ error: 'Invalid search query' });
        }

        // Search using news service
        const articles = await newsService.fetchNewsFromAPI(`${sanitizedQuery} business`, parseInt(limit));

        const searchResults = articles.map(article => ({
            id: require('uuid').v4(),
            title: newsService.sanitizeText(article.title),
            description: newsService.sanitizeText(article.description),
            url: article.url,
            image_url: article.urlToImage,
            published_at: article.publishedAt,
            source_name: article.source?.name || 'Unknown',
            relevance_score: newsService.calculateRelevanceScore(article, sanitizedQuery)
        }));

        // Sort by relevance score
        searchResults.sort((a, b) => b.relevance_score - a.relevance_score);

        res.json({
            success: true,
            query: sanitizedQuery,
            articles: searchResults,
            count: searchResults.length
        });

    } catch (error) {
        console.error('Error searching news:', error);
        res.status(500).json({ error: 'Failed to search news' });
    }
});

// Get trending business topics (public endpoint)
router.get('/trending', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Fetch trending business topics
        const trendingTopics = [
            'artificial intelligence business',
            'cryptocurrency market',
            'remote work trends',
            'sustainable business',
            'fintech innovation',
            'supply chain',
            'digital transformation',
            'startup funding',
            'stock market analysis',
            'economic outlook'
        ];

        // Get articles for random trending topics
        const randomTopic = trendingTopics[Math.floor(Math.random() * trendingTopics.length)];
        const articles = await newsService.fetchNewsFromAPI(randomTopic, parseInt(limit));

        const trendingArticles = articles.map(article => ({
            id: require('uuid').v4(),
            title: newsService.sanitizeText(article.title),
            description: newsService.sanitizeText(article.description),
            url: article.url,
            image_url: article.urlToImage,
            published_at: article.publishedAt,
            source_name: article.source?.name || 'Unknown',
            topic: randomTopic
        }));

        res.json({
            success: true,
            trending_topic: randomTopic,
            articles: trendingArticles,
            count: trendingArticles.length,
            available_topics: trendingTopics
        });

    } catch (error) {
        console.error('Error fetching trending news:', error);
        res.status(500).json({ error: 'Failed to fetch trending news' });
    }
});

// Bookmark article
router.post('/bookmark', authenticateToken, async (req, res) => {
    try {
        const { articleId, title, url, source } = req.body;

        if (!articleId || !title || !url) {
            return res.status(400).json({ error: 'Article ID, title, and URL are required' });
        }

        const bookmarkId = require('uuid').v4();

        // Check if already bookmarked
        const existing = await getQuery(`
      SELECT id FROM user_bookmarks WHERE user_id = ? AND article_id = ?
    `, [req.userId, articleId]);

        if (existing) {
            return res.status(400).json({ error: 'Article already bookmarked' });
        }

        // Add bookmark
        await runQuery(`
      INSERT INTO user_bookmarks (id, user_id, article_id)
      VALUES (?, ?, ?)
    `, [bookmarkId, req.userId, articleId]);

        res.json({
            success: true,
            message: 'Article bookmarked successfully',
            bookmarkId
        });

    } catch (error) {
        console.error('Error bookmarking article:', error);
        res.status(500).json({ error: 'Failed to bookmark article' });
    }
});

// Get user bookmarks
router.get('/bookmarks', authenticateToken, async (req, res) => {
    try {
        const bookmarks = await allQuery(`
      SELECT b.id, b.article_id, b.bookmarked_at,
             n.title, n.description, n.url, n.image_url, n.source_name
      FROM user_bookmarks b
      LEFT JOIN news_articles n ON b.article_id = n.id
      WHERE b.user_id = ?
      ORDER BY b.bookmarked_at DESC
    `, [req.userId]);

        res.json({
            success: true,
            bookmarks,
            count: bookmarks.length
        });

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});

// Remove bookmark
router.delete('/bookmark/:bookmarkId', authenticateToken, async (req, res) => {
    try {
        const { bookmarkId } = req.params;

        const result = await runQuery(`
      DELETE FROM user_bookmarks WHERE id = ? AND user_id = ?
    `, [bookmarkId, req.userId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        res.json({
            success: true,
            message: 'Bookmark removed successfully'
        });

    } catch (error) {
        console.error('Error removing bookmark:', error);
        res.status(500).json({ error: 'Failed to remove bookmark' });
    }
});

// Track article reading (for analytics)
router.post('/read', authenticateToken, async (req, res) => {
    try {
        const { articleId, readingTime = 0 } = req.body;

        if (!articleId) {
            return res.status(400).json({ error: 'Article ID is required' });
        }

        const readingId = require('uuid').v4();
        await runQuery(`
      INSERT INTO user_reading_history (id, user_id, article_id, reading_time)
      VALUES (?, ?, ?, ?)
    `, [readingId, req.userId, articleId, parseInt(readingTime)]);

        res.json({
            success: true,
            message: 'Reading tracked successfully'
        });

    } catch (error) {
        console.error('Error tracking reading:', error);
        res.status(500).json({ error: 'Failed to track reading' });
    }
});

module.exports = router;