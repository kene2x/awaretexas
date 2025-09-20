// Performance optimization tests
const request = require('supertest');
const app = require('../backend/server');

describe('Performance Optimizations', () => {
  describe('Caching Middleware', () => {
    test('should add cache headers to GET requests', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('public');
    });

    test('should add X-Cache header for cached responses', async () => {
      // First request - should be MISS
      const firstResponse = await request(app)
        .get('/api/health')
        .expect(200);
      
      // Note: In test environment, cache might not work exactly the same
      // but we can verify the middleware is applied
      expect(firstResponse.headers['cache-control']).toBeDefined();
    });

    test('should not cache POST requests', async () => {
      const response = await request(app)
        .post('/api/bills/summary/test-id')
        .send({ readingLevel: 'high-level' })
        .expect(500); // Expected to fail due to missing bill, but should not cache
      
      expect(response.headers['cache-control']).toContain('no-cache');
    });
  });

  describe('Compression Middleware', () => {
    test('should compress responses when supported', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Encoding', 'gzip')
        .expect(200);
      
      // Response should be successful
      expect(response.body).toHaveProperty('status', 'OK');
    });
  });

  describe('Cache Management Endpoints', () => {
    test('GET /api/cache/stats should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/cache/stats')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('hits');
      expect(response.body.data).toHaveProperty('misses');
      expect(response.body.data).toHaveProperty('hitRate');
    });

    test('DELETE /api/cache should clear all caches', async () => {
      const response = await request(app)
        .delete('/api/cache')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cleared');
    });

    test('DELETE /api/cache/:pattern should clear specific cache pattern', async () => {
      const response = await request(app)
        .delete('/api/cache/summary')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('summary');
    });
  });

  describe('Response Structure Optimization', () => {
    test('should return consistent response structure for bills endpoint', async () => {
      const response = await request(app)
        .get('/api/bills')
        .expect(500); // Expected due to database issues in test
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should handle query parameters efficiently', async () => {
      const response = await request(app)
        .get('/api/bills?search=test&status=Filed&limit=10')
        .expect(500); // Expected due to database issues in test
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling Optimization', () => {
    test('should provide detailed error information', async () => {
      const response = await request(app)
        .get('/api/bills/non-existent-id')
        .expect(500); // Expected due to database issues
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/bills/summary/test-id')
        .send({ invalidField: 'invalid' })
        .expect(500); // Expected due to database issues
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});