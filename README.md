# NewsMini - Personalized Business News Aggregator

A secure, personalized business news aggregation platform that delivers curated news based on user location, career field, and professional interests.

## 🌟 Features

### Core Functionality
- **Personalized News Feed**: Curated business news based on user's location, career, and interests
- **Multi-Source Aggregation**: Integrates multiple news APIs for comprehensive coverage
- **Location-Based News**: Local → Regional → National → Global news hierarchy
- **Industry-Specific Content**: Career field-focused news filtering
- **Real-time Updates**: Auto-refreshing news every 2 hours
- **Advanced Search**: Full-text search with relevance scoring
- **Bookmarking System**: Save articles for later reading
- **Reading Analytics**: Track reading habits and preferences

### Security Features
- **JWT Authentication**: Secure user session management
- **Password Hashing**: bcrypt with salt rounds
- **Input Sanitization**: XSS protection and input validation
- **Rate Limiting**: API abuse prevention
- **Security Headers**: Helmet.js implementation
- **CORS Protection**: Configurable cross-origin policies
- **SQL Injection Protection**: Parameterized queries

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite (production-ready with migrations)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Authentication**: JWT tokens with session management
- **News APIs**: NewsAPI.org, custom fallback system
- **Security**: Helmet, bcrypt, rate limiting, input validation

### Project Structure
```
business-news-aggregator/
├── server.js                 # Main application server
├── routes/
│   ├── auth.js              # Authentication endpoints
│   ├── news.js              # News API endpoints
│   └── user.js              # User management endpoints
├── services/
│   └── newsService.js       # News aggregation logic
├── database/
│   └── db.js                # Database configuration and helpers
├── public/
│   ├── index.html           # Main frontend interface
│   └── app.js               # Frontend JavaScript application
├── data/                    # SQLite database storage
├── logs/                    # Application logs
├── Dockerfile               # Container configuration
├── docker-compose.yml       # Development environment
├── Jenkinsfile             # CI/CD pipeline configuration
└── package.json            # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- NewsAPI.org API key (free tier available)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd business-news-aggregator
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Access the application**
Open http://localhost:3000 in your browser

### Environment Configuration

Create a `.env` file with the following variables:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
NEWS_API_KEY=your_newsapi_key_from_newsapi_org
```

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
# Build image
docker build -t business-news-aggregator .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_production_secret \
  -e NEWS_API_KEY=your_api_key \
  -v $(pwd)/data:/app/data \
  business-news-aggregator
```

## 🔒 Security Features

### Jenkins CI/CD Security Pipeline

This project includes a comprehensive Jenkins pipeline that performs:

1. **Dependency Security Scanning**
   - NPM audit for known vulnerabilities
   - License compliance checking
   - Dependency tree analysis

2. **OWASP Security Analysis**
   - Dependency check for known vulnerabilities
   - Security vulnerability database scanning
   - Retired/experimental package detection

3. **SAST (Static Application Security Testing)**
   - SonarQube code quality and security analysis
   - Code smell detection
   - Security hotspot identification

4. **Container Security Scanning**
   - Trivy vulnerability scanning
   - Base image security analysis
   - Runtime dependency scanning

5. **Custom Security Checks**
   - Secret detection (API keys, passwords)
   - File permission validation
   - Configuration security review
   - Application security testing

### Security Best Practices Implemented

- ✅ Input validation and sanitization
- ✅ Parameterized SQL queries
- ✅ Password hashing with bcrypt
- ✅ JWT token management
- ✅ Rate limiting and DDoS protection
- ✅ Security headers (Helmet.js)
- ✅ CORS configuration
- ✅ Non-root Docker user
- ✅ Environment variable management
- ✅ Session management and cleanup
- ✅ Error handling without information disclosure

## 📊 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "Vijai",
  "lastName": "Veerapandian", 
  "email": "vijai@example.com",
  "password": "securepassword123",
  "careerField": "technology",
  "city": "Ottawa",
  "state": "ON",
  "country": "CA"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "vijai@example.com",
  "password": "securepassword123"
}
```

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <jwt_token>
```

### News Endpoints

#### Get Personalized News
```http
GET /api/news/personalized
Authorization: Bearer <jwt_token>
```

#### Search News
```http
GET /api/news/search?q=artificial+intelligence&limit=20
Authorization: Bearer <jwt_token>
```

#### Get Trending News (Public)
```http
GET /api/news/trending?limit=10
```

#### Bookmark Article
```http
POST /api/news/bookmark
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "articleId": "article-uuid",
  "title": "Article Title",
  "url": "https://example.com/article"
}
```

### User Management Endpoints

#### Get User Profile
```http
GET /api/user/profile
Authorization: Bearer <jwt_token>
```

#### Update Profile
```http
PUT /api/user/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "careerField": "finance",
  "city": "New York",
  "state": "NY",
  "country": "US"
}
```

#### Get Reading Statistics
```http
GET /api/user/stats
Authorization: Bearer <jwt_token>
```

## 🔧 Configuration

### Career Fields Supported
- Technology (Software, AI/ML, Cybersecurity)
- Finance (Banking, Investment, Fintech)
- Healthcare (Medical, Pharmaceutical, Biotech)
- Real Estate (Commercial, Residential, Construction)
- Retail (E-commerce, Consumer Goods, Fashion)
- Energy (Oil & Gas, Renewable Energy, Utilities)
- Manufacturing (Automotive, Aerospace, Industrial)
- Consulting (Management, Strategy, Business Services)
- Legal (Corporate Law, Compliance, Regulatory)
- Marketing (Digital Marketing, Advertising, PR)

### News Categories
- **Local**: City-specific business news
- **Regional**: State/regional economic news
- **National**: Country-wide business news
- **Industry**: Career field-specific news
- **Global**: International business news

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run security tests
npm run test:security
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] News personalization based on profile
- [ ] Search functionality
- [ ] Bookmark system
- [ ] Profile management
- [ ] Location detection
- [ ] Responsive design
- [ ] Error handling
- [ ] Security headers validation

## 📈 Monitoring and Logging

### Health Check Endpoint
```http
GET /health
```
Returns application status and basic metrics.

### Logging Levels
- `error`: Application errors and exceptions
- `warn`: Warning messages and deprecated features
- `info`: General application information
- `debug`: Detailed debugging information

### Metrics Tracked
- User registrations and logins
- News article requests and views
- API response times
- Error rates and types
- Security events (failed logins, rate limiting)

## 🚀 Deployment

### Production Checklist
- [ ] Set strong JWT secret (min 32 characters)
- [ ] Configure NEWS_API_KEY with valid API key
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/SSL
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Review security headers configuration

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your_super_secure_production_jwt_secret_min_32_chars
NEWS_API_KEY=your_production_newsapi_key
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=warn
```

### Nginx Configuration (Optional)
```nginx
upstream app {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Run security checks: `npm run security-check`
7. Commit changes: `git commit -m "Add new feature"`
8. Push to branch: `git push origin feature/new-feature`
9. Submit pull request

### Code Style Guidelines
- Use ESLint configuration provided
- Follow conventional commit messages
- Add JSDoc comments for functions
- Write tests for new features
- Update documentation as needed

### Security Guidelines for Contributors
- Never commit API keys or secrets
- Use parameterized queries for database operations
- Validate all user inputs
- Follow OWASP security guidelines
- Test for common vulnerabilities (XSS, CSRF, SQL injection)

## 🐛 Troubleshooting

### Common Issues

**Application won't start**
- Check Node.js version (requires 18+)
- Verify environment variables are set
- Ensure port 3000 is available
- Check database permissions

**News not loading**
- Verify NEWS_API_KEY is valid
- Check API rate limits
- Review network connectivity
- Check console for API errors

**Authentication issues**
- Verify JWT_SECRET is set
- Check token expiration
- Clear browser localStorage
- Review CORS configuration

**Database errors**
- Check database file permissions
- Verify data directory exists
- Review SQLite version compatibility
- Check disk space availability

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Check application logs
tail -f logs/app.log
```

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [NewsAPI.org](https://newsapi.org/) for news data
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Font Awesome](https://fontawesome.com/) for icons
- [Express.js](https://expressjs.com/) for web framework
- OWASP for security guidelines
