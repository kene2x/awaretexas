// Comprehensive error handling middleware for the Texas Senate Bill Tracker
const { databaseService } = require('../../config/database');

/**
 * Error types and their corresponding HTTP status codes
 */
const ERROR_TYPES = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 408,
  NETWORK_ERROR: 502,
  DATABASE_ERROR: 503,
  AI_SERVICE_ERROR: 503,
  NEWS_SERVICE_ERROR: 503,
  SCRAPING_ERROR: 502
};

/**
 * User-friendly error messages for different error types
 */
const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'The request contains invalid data. Please check your input and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  SERVER_ERROR: 'An internal server error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
  DATABASE_ERROR: 'Database service is temporarily unavailable. Please try again later.',
  AI_SERVICE_ERROR: 'AI summary service is temporarily unavailable. Please try again later.',
  NEWS_SERVICE_ERROR: 'News service is temporarily unavailable. Please try again later.',
  SCRAPING_ERROR: 'Data scraping service encountered an error. Using cached data where available.'
};

/**
 * Enhanced error class with additional context
 */
class AppError extends Error {
  constructor(message, type = 'SERVER_ERROR', statusCode = null, context = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode || ERROR_TYPES[type] || 500;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguishes operational errors from programming errors
  }

  toJSON() {
    return {
      success: false,
      error: this.getUserMessage(),
      type: this.type,
      message: process.env.NODE_ENV === 'development' ? this.message : undefined,
      context: process.env.NODE_ENV === 'development' ? this.context : undefined,
      timestamp: this.timestamp
    };
  }

  getUserMessage() {
    return ERROR_MESSAGES[this.type] || ERROR_MESSAGES.SERVER_ERROR;
  }
}

/**
 * Retry mechanism with exponential backoff
 */
class RetryManager {
  constructor() {
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 30000; // 30 seconds
  }

  async executeWithRetry(operation, key, options = {}) {
    const {
      maxRetries = this.maxRetries,
      baseDelay = this.baseDelay,
      maxDelay = this.maxDelay,
      retryCondition = (error) => this.shouldRetry(error)
    } = options;

    let lastError;
    const attempts = this.retryAttempts.get(key) || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        // Reset retry count on success
        this.retryAttempts.delete(key);
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry if condition not met or max attempts reached
        if (!retryCondition(error) || attempt === maxRetries) {
          this.retryAttempts.set(key, attempts + attempt + 1);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );

        console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} for ${key} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  shouldRetry(error) {
    // Retry on network errors, timeouts, and temporary service issues
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE'
    ];

    return retryableErrors.some(errorType => 
      error.message.includes(errorType) || 
      error.type === errorType ||
      error.code === errorType
    );
  }

  getRetryCount(key) {
    return this.retryAttempts.get(key) || 0;
  }

  resetRetryCount(key) {
    this.retryAttempts.delete(key);
  }
}

/**
 * Fallback data manager for graceful degradation
 */
class FallbackManager {
  constructor() {
    this.fallbackData = new Map();
    this.fallbackTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  setFallback(key, data) {
    this.fallbackData.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getFallback(key) {
    const fallback = this.fallbackData.get(key);
    if (!fallback) return null;

    // Check if fallback data is still valid
    if (Date.now() - fallback.timestamp > this.fallbackTTL) {
      this.fallbackData.delete(key);
      return null;
    }

    return fallback.data;
  }

  generateFallbackBills() {
    return [{
      id: 'fallback-1',
      billNumber: 'SB 1',
      shortTitle: 'Sample Bill - Service Temporarily Unavailable',
      fullTitle: 'A sample bill displayed while the bill tracking service is temporarily unavailable',
      status: 'Filed',
      sponsors: [{ name: 'System', photoUrl: '', district: '' }],
      officialUrl: '#',
      billText: 'Bill text is temporarily unavailable due to service issues.',
      abstract: 'This is a placeholder bill shown when the main service is unavailable. Please try refreshing the page in a few minutes.',
      committee: '',
      coSponsors: [],
      filedDate: new Date(),
      lastUpdated: new Date(),
      topics: ['System'],
      isPlaceholder: true
    }];
  }

  generateFallbackSummary(billId) {
    return 'Summary generation is temporarily unavailable. Please try again later or refer to the official bill text for details.';
  }

  generateFallbackNews(billId) {
    return [{
      headline: 'News service temporarily unavailable',
      source: 'System',
      url: '#',
      publishedAt: new Date(),
      description: 'Related news articles are temporarily unavailable. Please try again later.',
      urlToImage: null,
      isError: true
    }];
  }
}

/**
 * Circuit breaker pattern for external services
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`Circuit breaker ${this.name}: Transitioning to HALF_OPEN`);
      } else {
        throw new AppError(
          `Service ${this.name} is temporarily unavailable`,
          'SERVICE_UNAVAILABLE',
          503,
          { circuitBreakerState: this.state }
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.requestCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
        this.failureCount = 0;
        console.log(`Circuit breaker ${this.name}: Transitioning to CLOSED`);
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.requestCount++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`Circuit breaker ${this.name}: Transitioning to OPEN`);
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log(`Circuit breaker ${this.name}: Transitioning back to OPEN`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Main error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle specific error types
  let appError;

  if (err.name === 'ValidationError') {
    appError = new AppError(err.message, 'VALIDATION_ERROR', 400);
  } else if (err.name === 'CastError') {
    appError = new AppError('Invalid ID format', 'VALIDATION_ERROR', 400);
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    appError = new AppError('External service unavailable', 'NETWORK_ERROR', 502);
  } else if (err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
    appError = new AppError('Request timeout', 'TIMEOUT', 408);
  } else if (err.message && err.message.includes('rate limit')) {
    appError = new AppError('Rate limit exceeded', 'RATE_LIMIT', 429);
  } else {
    // Generic server error
    appError = new AppError(
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      'SERVER_ERROR',
      500
    );
  }

  res.status(appError.statusCode).json(appError.toJSON());
}

/**
 * Async error wrapper to catch async errors in route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Health check with error context
 */
async function healthCheck() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
    errors: []
  };

  try {
    // Check database connection
    const dbConnected = databaseService.isConnected;
    health.services.database = {
      status: dbConnected ? 'healthy' : 'unhealthy',
      connected: dbConnected
    };

    if (!dbConnected) {
      health.status = 'degraded';
      health.errors.push('Database connection unavailable');
    }
  } catch (error) {
    health.services.database = {
      status: 'error',
      error: error.message
    };
    health.status = 'unhealthy';
    health.errors.push(`Database error: ${error.message}`);
  }

  return health;
}

// Create singleton instances
const retryManager = new RetryManager();
const fallbackManager = new FallbackManager();

// Circuit breakers for external services
const circuitBreakers = {
  scraper: new CircuitBreaker('scraper', { failureThreshold: 3, resetTimeout: 120000 }),
  aiService: new CircuitBreaker('aiService', { failureThreshold: 5, resetTimeout: 300000 }),
  newsService: new CircuitBreaker('newsService', { failureThreshold: 3, resetTimeout: 180000 })
};

module.exports = {
  AppError,
  RetryManager,
  FallbackManager,
  CircuitBreaker,
  errorHandler,
  asyncHandler,
  healthCheck,
  retryManager,
  fallbackManager,
  circuitBreakers,
  ERROR_TYPES,
  ERROR_MESSAGES
};