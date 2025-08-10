const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { runQuery, allQuery } = require('../database/db');

// News API configuration
const NEWS_API_KEY = process.env.NEWS_API_KEY || 'your_newsapi_key_here';
const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';

// Career field to industry mapping
const CAREER_INDUSTRIES = {
    'technology': ['technology', 'startups', 'artificial intelligence', 'cybersecurity'],
    'finance': ['finance', 'banking', 'cryptocurrency', 'fintech', 'stock market'],
    'healthcare': ['healthcare', 'medical', 'pharmaceutical', 'biotech'],
    'real_estate': ['real estate', 'property', 'construction', 'housing market'],
    'retail': ['retail', 'e-commerce', 'consumer goods', 'fashion'],
    'energy': ['energy', 'oil', 'renewable energy', 'utilities'],
    'manufacturing': ['manufacturing', 'automotive', 'aerospace', 'industrial'],
    'consulting': ['consulting', 'business services', 'management'],
    'legal': ['legal', 'law', 'compliance', 'regulatory'],
    'marketing': ['marketing', 'advertising', 'digital marketing', 'social media']
};

class NewsService {
    constructor() {
        this.cache = new Map();
        this.lastRefresh = null;
    }

    async fetchNewsFromAPI(query, pageSize = 20) {
        try {
            const response = await axios.get(`${NEWSAPI_BASE_URL}/everything`, {
                params: {
                    q: query,
                    language: 'en',
                    sortBy: 'publishedAt',
                    pageSize: pageSize,
                    apiKey: NEWS_API_KEY
                },
                timeout: 10000
            });

            return response.data.articles || [];
        } catch (error) {
            console.error('NewsAPI error:', error.message);

            // Return mock data if API fails (for development/demo)
            return this.getMockNewsData(query);
        }
    }

    getMockNewsData(query) {
        const mockArticles = [
            {
                title: `Breaking: Major ${query} Development Announced`,
                description: `Important news in the ${query} sector affecting business operations and market trends.`,
                url: 'https://example.com/news/1',
                urlToImage: 'https://via.placeholder.com/400x200?text=News+Image',
                publishedAt: new Date().toISOString(),
                source: { name: 'Business Times' }
            },
            {
                title: `${query} Market Shows Strong Growth This Quarter`,
                description: `Analysis of recent ${query} market performance and future outlook for investors.`,
                url: 'https://example.com/news/2',
                urlToImage: 'https://via.placeholder.com/400x200?text=Market+News',
                publishedAt: moment().subtract(1, 'hour').toISOString(),
                source: { name: 'Economic Daily' }
            },
            {
                title: `Innovation in ${query}: What Business Leaders Need to Know`,
                description: `Expert insights on emerging trends in ${query} and their impact on business strategy.`,
                url: 'https://example.com/news/3',
                urlToImage: 'https://via.placeholder.com/400x200?text=Innovation+News',
                publishedAt: moment().subtract(2, 'hours').toISOString(),
                source: { name: 'Industry Weekly' }
            }
        ];

        return mockArticles;
    }

    async getLocationBasedNews(city, state, country, limit = 5) {
        const queries = [
            `${city} business`,
            `${state} economy`,
            `${country} business news`
        ];

        const allNews = [];

        for (const query of queries) {
            const articles = await this.fetchNewsFromAPI(query, limit);
            const processedArticles = articles.map(article => ({
                id: uuidv4(),
                title: this.sanitizeText(article.title),
                description: this.sanitizeText(article.description),
                url: article.url,
                image_url: article.urlToImage,
                published_at: article.publishedAt,
                source_name: article.source?.name || 'Unknown',
                source_url: article.source?.url || '',
                category: 'business',
                location_type: this.getLocationType(query),
                location_value: this.getLocationValue(query, city, state, country),
                relevance_score: this.calculateRelevanceScore(article, query)
            }));

            allNews.push(...processedArticles);
        }

        return allNews.slice(0, limit * 3);
    }

    async getIndustryNews(careerField, limit = 5) {
        const industries = CAREER_INDUSTRIES[careerField] || [careerField];
        const allNews = [];

        for (const industry of industries.slice(0, 2)) { // Limit to 2 industries to avoid API limits
            const articles = await this.fetchNewsFromAPI(`${industry} business news`, limit);
            const processedArticles = articles.map(article => ({
                id: uuidv4(),
                title: this.sanitizeText(article.title),
                description: this.sanitizeText(article.description),
                url: article.url,
                image_url: article.urlToImage,
                published_at: article.publishedAt,
                source_name: article.source?.name || 'Unknown',
                source_url: article.source?.url || '',
                category: 'industry',
                industry: industry,
                relevance_score: this.calculateRelevanceScore(article, industry)
            }));

            allNews.push(...processedArticles);
        }

        return allNews.slice(0, limit);
    }

    async getPersonalizedNews(userProfile) {
        try {
            const { city, state, country, career_field } = userProfile;

            // Fetch different types of news
            const [locationNews, industryNews, globalNews] = await Promise.all([
                this.getLocationBasedNews(city, state, country, 5),
                this.getIndustryNews(career_field, 5),
                this.fetchNewsFromAPI('global business economy', 5)
            ]);

            // Process global news
            const processedGlobalNews = globalNews.map(article => ({
                id: uuidv4(),
                title: this.sanitizeText(article.title),
                description: this.sanitizeText(article.description),
                url: article.url,
                image_url: article.urlToImage,
                published_at: article.publishedAt,
                source_name: article.source?.name || 'Unknown',
                source_url: article.source?.url || '',
                category: 'global',
                location_type: 'global',
                relevance_score: this.calculateRelevanceScore(article, 'business')
            }));

            return {
                local: locationNews.filter(n => n.location_type === 'local').slice(0, 5),
                regional: locationNews.filter(n => n.location_type === 'regional').slice(0, 5),
                national: locationNews.filter(n => n.location_type === 'national').slice(0, 5),
                industry: industryNews.slice(0, 5),
                global: processedGlobalNews.slice(0, 5)
            };
        } catch (error) {
            console.error('Error fetching personalized news:', error);
            throw new Error('Failed to fetch personalized news');
        }
    }

    sanitizeText(text) {
        if (!text) return '';
        // Remove HTML tags and decode HTML entities
        return text.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, '').trim();
    }

    getLocationType(query) {
        if (query.includes('business')) return 'local';
        if (query.includes('economy')) return 'regional';
        return 'national';
    }

    getLocationValue(query, city, state, country) {
        if (query.includes(city)) return city;
        if (query.includes(state)) return state;
        return country;
    }

    calculateRelevanceScore(article, keyword) {
        let score = 0;
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const searchTerm = keyword.toLowerCase();

        // Score based on keyword presence
        if (title.includes(searchTerm)) score += 3;
        if (description.includes(searchTerm)) score += 2;

        // Score based on recency (newer articles get higher scores)
        const publishedAt = moment(article.publishedAt);
        const hoursAgo = moment().diff(publishedAt, 'hours');
        if (hoursAgo < 6) score += 2;
        else if (hoursAgo < 24) score += 1;

        // Score based on source credibility (mock scoring)
        const trustedSources = ['Reuters', 'Bloomberg', 'Wall Street Journal', 'Financial Times'];
        if (trustedSources.some(source => (article.source?.name || '').includes(source))) {
            score += 2;
        }

        return Math.min(score, 10); // Cap at 10
    }

    async refreshNewsCache() {
        console.log('Refreshing news cache...');
        try {
            // Clear old cache entries (older than 6 hours)
            const sixHoursAgo = moment().subtract(6, 'hours').format('YYYY-MM-DD HH:mm:ss');
            await runQuery('DELETE FROM news_articles WHERE created_at < ?', [sixHoursAgo]);

            this.lastRefresh = new Date();
            console.log('News cache refreshed successfully');
        } catch (error) {
            console.error('Error refreshing news cache:', error);
        }
    }

    async saveArticleToCache(article) {
        try {
            await runQuery(`
        INSERT OR REPLACE INTO news_articles 
        (id, title, description, url, image_url, published_at, source_name, source_url, 
         category, location_type, location_value, industry, relevance_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                article.id,
                article.title,
                article.description,
                article.url,
                article.image_url,
                article.published_at,
                article.source_name,
                article.source_url,
                article.category,
                article.location_type || null,
                article.location_value || null,
                article.industry || null,
                article.relevance_score
            ]);
        } catch (error) {
            console.error('Error saving article to cache:', error);
        }
    }
}

module.exports = new NewsService();