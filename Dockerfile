# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in the container
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p data && chown -R nodejs:nodejs data

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Change ownership of app directory to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]