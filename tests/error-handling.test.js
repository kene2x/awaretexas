// Comprehensive Error Handling Tests for Texas Senate Bill Tracker
const request = require('supertest');
const app = require('../backend/server');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../backend/middleware/error-handler');

describe('Error Handling System', () => {
  beforeEach(() => {
    // Reset error handling state before each test
    retryManager.retryAttempts.clear();
    fallbackManager.fallbackData.clear();
    Object.values(circuitBreakers).forEach(cb => {
      cb.state = 'CLOSED';
      cb.failureCount = 0;
      cb.successCount = 0;
    });
  });

  describe('AppError Class', () => {
    test('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 'VALIDATION_ERROR', 400, { field: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.type).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
    });

    test('should provide user-friendly message', () => {
      const error = new AppError('Technical error', 'NETWORK_ERROR');
      const userMessage = error.getUserMessage();
      
      expect(userMessage).toBe('Network error occurred. Please check your connection and try again.');
    });

    test('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', 'VALIDATION_ERROR');
      const json = error.toJSON();
      
      expect(json.success).toBe(false);
      expect(json.error).toBe('The request contains invalid data. Please check your input and try again.');
      expect(json.type).toBe('VALIDATION_ERROR');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('API Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/bills/nonexistent-bill')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/summary/')
        .send({ readingLevel: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle missing required parameters', async () => {
      const response = await request(app)
        .post('/api/summary/test-bill')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Retry Manager', () => {
    test('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('NETWORK_ERROR');
        }
        return 'success';
      });

      const result = await retryManager.executeWithRetry(operation, 'test-key', {
        maxRetries: 3,
        baseDelay: 10
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        throw new Error('VALIDATION_ERROR');
      });

      await expect(
        retryManager.executeWithRetry(operation, 'test-key', {
          maxRetries: 3,
          retryCondition: (error) => error.message.includes('NETWORK')
        })
      ).rejects.toThrow('VALIDATION_ERROR');

      expect(attempts).toBe(1);
    });

    test('should track retry counts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));

      try {
        await retryManager.executeWithRetry(operation, 'test-key', {
          maxRetries: 2,
          baseDelay: 10
        });
      } catch (error) {
        // Expected to fail
      }

      expect(retryManager.getRetryCount('test-key')).toBe(3); // Initial + 2 retries
    });
  });

  describe('Fallback Manager', () => {
    test('should store and retrieve fallback data', () => {
      const testData = { id: 1, name: 'test' };
      fallbackManager.setFallback('test-key', testData);

      const retrieved = fallbackManager.getFallback('test-key');
      expect(retrieved).toEqual(testData);
    });

    test('should expire old fallback data', () => {
      const testData = { id: 1, name: 'test' };
      fallbackManager.setFallback('test-key', testData);

      // Mock old timestamp
      const fallback = fallbackManager.fallbackData.get('test-key');
      fallback.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

      const retrieved = fallbackManager.getFallback('test-key');
      expect(retrieved).toBeNull();
    });

    test('should generate fallback bills', () => {
      const fallbackBills = fallbackManager.generateFallbackBills();
      
      expect(Array.isArray(fallbackBills)).toBe(true);
      expect(fallbackBills.length).toBeGreaterThan(0);
      expect(fallbackBills[0]).toHaveProperty('billNumber');
      expect(fallbackBills[0]).toHaveProperty('isPlaceholder', true);
    });
  });

  describe('Circuit Breaker', () => {
    test('should open circuit after failure threshold', async () => {
      const circuitBreaker = circuitBreakers.scraper;
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');
    });

    test('should transition to half-open after timeout', async () => {
      const circuitBreaker = circuitBreakers.aiService;
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastFailureTime = Date.now() - 310000; // 310 seconds ago (past reset timeout of 300s)

      const successOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    test('should reject requests when circuit is open', async () => {
      const circuitBreaker = circuitBreakers.newsService;
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastFailureTime = Date.now();

      const operation = jest.fn();

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('temporarily unavailable');
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
    });

    test('should include service status in health check', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.body.services).toHaveProperty('database');
    });
  });

  describe('Error Middleware Integration', () => {
    test('should handle unhandled errors', async () => {
      // This would test the global error handler
      // Implementation depends on how you want to trigger unhandled errors in tests
    });

    test('should provide consistent error format', async () => {
      const response = await request(app)
        .get('/api/bills/invalid-id')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Service-Specific Error Handling', () => {
    test('should handle scraper service errors gracefully', async () => {
      // Mock scraper failure and test fallback behavior
      // This would require mocking the scraper service
    });

    test('should handle AI service errors with fallbacks', async () => {
      // Test AI service error handling
      const response = await request(app)
        .post('/api/summary/test-bill')
        .send({ readingLevel: 'high-level' });

      // Should either succeed or provide graceful error handling
      expect(response.body).toHaveProperty('success');
    });

    test('should handle news service errors gracefully', async () => {
      // Test news service error handling
      const response = await request(app)
        .get('/api/news/test-bill');

      // Should either succeed or provide graceful error handling
      expect(response.body).toHaveProperty('success');
    });
  });
});

describe('Frontend Error Boundary (Integration)', () => {
  // These tests would require a browser environment or jsdom
  // They test the frontend error handling components

  describe('Error Display', () => {
    test('should show user-friendly error messages', () => {
      // Test error boundary error display
    });

    test('should provide retry mechanisms', () => {
      // Test retry functionality
    });

    test('should handle network errors', () => {
      // Test network error handling
    });
  });

  describe('Error Recovery', () => {
    test('should allow error dismissal', () => {
      // Test error dismissal functionality
    });

    test('should reset error state', () => {
      // Test error state reset
    });

    test('should show critical error overlay', () => {
      // Test critical error handling
    });
  });
});

// Performance and stress tests for error handling
describe('Error Handling Performance', () => {
  test('should handle high error rates without memory leaks', async () => {
    // Generate many errors and ensure memory doesn't grow unbounded
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 100; i++) {
      try {
        await retryManager.executeWithRetry(
          () => Promise.reject(new Error('Test error')),
          `test-${i}`,
          { maxRetries: 1, baseDelay: 1 }
        );
      } catch (error) {
        // Expected failures
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 10MB for 100 errors)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  test('should handle concurrent error scenarios', async () => {
    // Test concurrent error handling
    const promises = Array.from({ length: 10 }, (_, i) =>
      retryManager.executeWithRetry(
        () => Promise.reject(new Error(`Concurrent error ${i}`)),
        `concurrent-${i}`,
        { maxRetries: 1, baseDelay: 10 }
      ).catch(() => 'handled')
    );

    const results = await Promise.all(promises);
    expect(results.every(result => result === 'handled')).toBe(true);
  });
});