const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/news_aggregator.db');

let db;

const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        // Ensure data directory exists
        const fs = require('fs');
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            console.log('Connected to SQLite database');
            createTables().then(resolve).catch(reject);
        });
    });
};

const createTables = () => {
    return new Promise((resolve, reject) => {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        career_field TEXT,
        industries TEXT, -- JSON array
        city TEXT,
        state TEXT,
        country TEXT,
        preferences TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

            // User sessions
            `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

            // News articles cache
            `CREATE TABLE IF NOT EXISTS news_articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        published_at DATETIME,
        source_name TEXT,
        source_url TEXT,
        category TEXT,
        location_type TEXT, -- 'local', 'state', 'national', 'global'
        location_value TEXT,
        industry TEXT,
        relevance_score REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

            // User reading history
            `CREATE TABLE IF NOT EXISTS user_reading_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reading_time INTEGER, -- seconds spent reading
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (article_id) REFERENCES news_articles (id)
      )`,

            // User bookmarks
            `CREATE TABLE IF NOT EXISTS user_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        bookmarked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (article_id) REFERENCES news_articles (id),
        UNIQUE(user_id, article_id)
      )`
        ];

        let completed = 0;
        const total = tables.length;

        tables.forEach((sql, index) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error(`Error creating table ${index}:`, err);
                    reject(err);
                    return;
                }

                completed++;
                if (completed === total) {
                    console.log('All database tables created successfully');
                    resolve();
                }
            });
        });
    });
};

const getDatabase = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
};

// Helper functions for common database operations
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const closeDatabase = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
};

module.exports = {
    initializeDatabase,
    getDatabase,
    runQuery,
    getQuery,
    allQuery,
    closeDatabase
};