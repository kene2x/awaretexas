const request = require('supertest');
const app = require('../backend/server');

describe('Server Setup', () => {
  test('Health check endpoint should work', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
  });
});