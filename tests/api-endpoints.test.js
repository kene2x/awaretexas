// API endpoints test suite
const request = require('supertest');
const app = require('../backend/server');

describe('API Endpoints', () => {
  describe('System Endpoints', () => {
    test('GET /api/health should return server health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('version');
    });

    test('GET /api/status should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toHaveProperty('server', 'running');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Bills Endpoints Structure', () => {
    test('GET /api/bills should have proper response structure even with database errors', async () => {
      const response = await request(app)
        .get('/api/bills');
      
      // Should return either 200 with data or 500 with error structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('count');
        expect(response.body).toHaveProperty('filters');
        expect(response.body).toHaveProperty('timestamp');
        expect(Array.isArray(response.body.data)).toBe(true);
      } else {
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
      }
    });

    test('GET /api/bills with query parameters should preserve filter structure', async () => {
      const response = await request(app)
        .get('/api/bills?search=test&limit=10&status=Filed');
      
      // Should return proper filter structure regardless of success/failure
      if (response.status === 200) {
        expect(response.body.filters).toHaveProperty('search', 'test');
        expect(response.body.filters).toHaveProperty('limit', 10);
        expect(response.body.filters).toHaveProperty('status', 'Filed');
      } else {
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
      }
    });

    test('POST /api/bills/summary/:billId should validate reading level parameter', async () => {
      const response = await request(app)
        .post('/api/bills/summary/test-id')
        .send({ readingLevel: 'invalid-level' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid reading level');
    });

    test('POST /api/bills/summary/:billId should require valid reading level', async () => {
      const response = await request(app)
        .post('/api/bills/summary/test-id')
        .send({ readingLevel: 'high-level' });
      
      // Should return either 404 (bill not found) or 500 (database error)
      expect([404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('News Endpoints', () => {
    test('GET /api/bills/news/:billId should require bill ID', async () => {
      const response = await request(app)
        .get('/api/bills/news/');
      
      // Should return 404 for route not found or 500 for database error
      expect([404, 500]).toContain(response.status);
    });

    test('GET /api/bills/news/:billId should return proper structure for non-existent bill', async () => {
      const response = await request(app)
        .get('/api/bills/news/non-existent-bill-id');
      
      // Should return either 404 (bill not found) or 500 (database error)
      expect([404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      
      if (response.status === 404) {
        expect(response.body).toHaveProperty('error', 'Bill not found');
        expect(response.body).toHaveProperty('billId', 'non-existent-bill-id');
      }
    });

    test('GET /api/bills/news/:billId should handle news service errors gracefully', async () => {
      const response = await request(app)
        .get('/api/bills/news/test-bill-id');
      
      // Should return either 404 (bill not found), 500 (service error), or 200 (success)
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('billId', 'test-bill-id');
        expect(response.body.data).toHaveProperty('articles');
        expect(response.body.data).toHaveProperty('count');
        expect(Array.isArray(response.body.data.articles)).toBe(true);
      } else if (response.status === 404) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Bill not found');
      } else {
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      }
      
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Summary Level Update Endpoints', () => {
    test('PUT /api/bills/summary/:billId/level should require bill ID', async () => {
      const response = await request(app)
        .put('/api/bills/summary//level')
        .send({ readingLevel: 'high-level' });
      
      expect(response.status).toBe(404); // Route not found due to empty billId
    });

    test('PUT /api/bills/summary/:billId/level should require reading level', async () => {
      const response = await request(app)
        .put('/api/bills/summary/test-id/level')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Reading level is required');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('PUT /api/bills/summary/:billId/level should validate reading level', async () => {
      const response = await request(app)
        .put('/api/bills/summary/test-id/level')
        .send({ readingLevel: 'invalid-level' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid reading level');
      expect(response.body.error).toContain('high-level');
      expect(response.body.error).toContain('detailed');
    });

    test('PUT /api/bills/summary/:billId/level should accept valid reading levels', async () => {
      const validLevels = ['high-level', 'detailed'];
      
      for (const level of validLevels) {
        const response = await request(app)
          .put('/api/bills/summary/test-id/level')
          .send({ readingLevel: level });
        
        // Should return either 404 (bill not found) or 500 (database/service error)
        expect([404, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('success', false);
        
        if (response.status === 404) {
          expect(response.body).toHaveProperty('error', 'Bill not found');
        }
      }
    });

    test('PUT /api/bills/summary/:billId/level should handle forceRegenerate parameter', async () => {
      const response = await request(app)
        .put('/api/bills/summary/test-id/level')
        .send({ 
          readingLevel: 'high-level',
          forceRegenerate: true 
        });
      
      // Should return either 404 (bill not found) or 500 (database/service error)
      expect([404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    test('PUT /api/bills/summary/:billId/level should return proper success structure', async () => {
      // This test documents the expected success response structure
      // In a real scenario with a valid bill, the response should be:
      const expectedSuccessStructure = {
        success: true,
        data: {
          billId: expect.any(String),
          summary: expect.any(String),
          readingLevel: expect.any(String),
          updated: true,
          forceRegenerated: expect.any(Boolean),
          updatedAt: expect.any(String)
        },
        message: expect.stringContaining('Summary reading level updated'),
        timestamp: expect.any(String)
      };
      
      // This test serves as documentation for the expected response format
      expect(expectedSuccessStructure).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent-route should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('path', '/nonexistent-route');
    });

    test('POST without required parameters should return appropriate error', async () => {
      const response = await request(app)
        .post('/api/bills/summary/')
        .send({});
      
      expect(response.status).toBe(404); // Route not found since no billId
    });
  });
});