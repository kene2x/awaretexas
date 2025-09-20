// Main server file - Express.js server with CORS and middleware configuration
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import services
const { scrapingScheduler } = require('../services/scheduler');
const { databaseService } = require('../config/database');

// Import middleware
const cacheMiddleware = require('./middleware/cache');
const { errorHandler, asyncHandler, healthCheck } = require('./middleware/error-handler');

// Import routes
const billsRoutes = require('./routes/bills');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance middleware
app.use(cacheMiddleware.compressionMiddleware());
app.use(cacheMiddleware.cacheControlMiddleware());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('frontend'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/bills', billsRoutes);

// Cache management endpoints
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = cacheMiddleware.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      message: error.message
    });
  }
});

app.delete('/api/cache/:pattern?', (req, res) => {
  try {
    const { pattern } = req.params;
    cacheMiddleware.clearCache(pattern);
    
    res.json({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All caches cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// System endpoints with enhanced error handling
app.get('/api/health', asyncHandler(async (req, res) => {
  const health = await healthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    ...health,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
}));

app.get('/api/status', asyncHandler(async (req, res) => {
  const dbConnected = databaseService.isConnected;
  const schedulerStatus = scrapingScheduler.getStatus();
  
  res.json({
    success: true,
    status: {
      database: dbConnected ? 'connected' : 'disconnected',
      scheduler: schedulerStatus,
      server: 'running',
      lastUpdate: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}));

// Scheduler management endpoints
app.get('/api/scheduler/status', (req, res) => {
  try {
    const status = scrapingScheduler.getStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

app.post('/api/scheduler/start', async (req, res) => {
  try {
    await scrapingScheduler.initialize();
    scrapingScheduler.start();
    
    res.json({
      success: true,
      message: 'Scheduler started successfully',
      status: scrapingScheduler.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start scheduler',
      error: error.message
    });
  }
});

app.post('/api/scheduler/stop', (req, res) => {
  try {
    scrapingScheduler.stop();
    
    res.json({
      success: true,
      message: 'Scheduler stopped successfully',
      status: scrapingScheduler.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop scheduler',
      error: error.message
    });
  }
});

app.post('/api/scheduler/run', async (req, res) => {
  try {
    const result = await scrapingScheduler.runManualScrape();
    
    res.json({
      success: true,
      message: 'Manual scraping completed',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Manual scraping failed',
      error: error.message
    });
  }
});

// Initialize and start services on server startup
async function initializeServer() {
  try {
    console.log('🚀 Initializing server...');
    
    // Initialize database connection
    await databaseService.connect();
    await databaseService.initializeCollections();
    
    // Initialize scheduler
    await scrapingScheduler.initialize();
    scrapingScheduler.start();
    
    // Warm up cache with common data
    await cacheMiddleware.warmupCache(require('../config/bill-database').billDatabase);
    
    console.log('✅ Server initialization completed');
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    // Don't exit the process, just log the error
    // Services can be started manually via API
  }
}

// Enhanced error handling middleware
app.use(errorHandler);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeServer();
  });
}

module.exports = app;