// Comprehensive API Integration Tests
const request = require('supertest');
const app = require('../../backend/server');
const { databaseService } = require('../../config/database');
const { summaryService } = require('../../services/ai-summary');
const { newsService } = require('../../services/news');
const { TexasLegislatureScraper } = require('../../services/scraper');

// Mock external services for integration testing
jest.mock('../../config/database');
jest.mock('../../services/ai-summary');
jest.mock('../../services/news');
jest.mock('../../services/scraper');

describe('API Integration Tests', () => {
  let mockDb;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock database service
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    };
    
    databaseService.getDb.mockReturnValue(mockDb);
    databaseService.isConnected = true;
  });

  describe('Bills API Integration', () => {
    const mockBills = [
      {
        id: 'sb1',
        billNumber: 'SB1',
        shortTitle: 'Education Funding Act',
        fullTitle: 'An Act relating to public education funding',
        status: 'Filed',
        sponsors: [{ name: 'Senator Smith', district: '1' }],
        topics: ['Education'],
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'sb2',
        billNumber: 'SB2',
        shortTitle: 'Healthcare Reform Bill',
        fullTitle: 'An Act relating to healthcare reform',
        status: 'In Committee',
        sponsors: [{ name: 'Senator Johnson', district: '2' }],
        topics: ['Healthcare'],
        lastUpdated: new Date().toISOString()
      }
    ];

    it('should retrieve all bills with proper pagination', async () => {
      mockDb.get.mockResolvedValue({
        docs: mockBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const response = await request(app)
        .get('/api/bills')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            billNumber: 'SB1',
            shortTitle: 'Education Funding Act'
          })
        ]),
        count: expect.any(Number),
        filters: expect.any(Object),
        timestamp: expect.any(String)
      });
    });

    it('should filter bills by search query', async () => {
      const filteredBills = mockBills.filter(bill => 
        bill.shortTitle.toLowerCase().includes('education')
      );
      
      mockDb.get.mockResolvedValue({
        docs: filteredBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const response = await request(app)
        .get('/api/bills?search=education')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].shortTitle).toContain('Education');
      expect(response.body.filters.search).toBe('education');
    });

    it('should filter bills by status', async () => {
      const filedBills = mockBills.filter(bill => bill.status === 'Filed');
      
      mockDb.get.mockResolvedValue({
        docs: filedBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const response = await request(app)
        .get('/api/bills?status=Filed')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('Filed');
      expect(response.body.filters.status).toBe('Filed');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/bills')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Database'),
        timestamp: expect.any(String)
      });
    });

    it('should retrieve individual bill details', async () => {
      const mockBill = mockBills[0];
      
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => mockBill
      });

      const response = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          billNumber: 'SB1',
          shortTitle: 'Education Funding Act'
        }),
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent bill', async () => {
      mockDb.get.mockResolvedValue({
        exists: false
      });

      const response = await request(app)
        .get('/api/bills/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Bill not found',
        billId: 'nonexistent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Summary API Integration', () => {
    const mockBill = {
      id: 'sb1',
      billNumber: 'SB1',
      billText: 'This is a comprehensive bill about education funding...',
      shortTitle: 'Education Funding Act'
    };

    beforeEach(() => {
      // Mock bill exists
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => mockBill
      });
    });

    it('should generate AI summary successfully', async () => {
      const mockSummary = 'This bill provides additional funding for public schools and improves educational resources.';
      
      summaryService.generateSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          billId: 'sb1',
          summary: mockSummary,
          readingLevel: 'high-level',
          generatedAt: expect.any(String)
        },
        timestamp: expect.any(String)
      });

      expect(summaryService.generateSummary).toHaveBeenCalledWith(
        'sb1',
        mockBill.billText,
        'high-level'
      );
    });

    it('should validate reading level parameter', async () => {
      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'invalid-level' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid reading level'),
        timestamp: expect.any(String)
      });
    });

    it('should handle AI service failures gracefully', async () => {
      summaryService.generateSummary.mockRejectedValue(new Error('AI service unavailable'));

      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to generate summary'),
        timestamp: expect.any(String)
      });
    });

    it('should update reading level for existing summary', async () => {
      const mockSummary = 'Detailed summary with more technical information about education funding mechanisms.';
      
      summaryService.generateSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .put('/api/bills/summary/sb1/level')
        .send({ readingLevel: 'detailed', forceRegenerate: true })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          billId: 'sb1',
          summary: mockSummary,
          readingLevel: 'detailed',
          updated: true,
          forceRegenerated: true
        },
        message: expect.stringContaining('Summary reading level updated'),
        timestamp: expect.any(String)
      });
    });
  });

  describe('News API Integration', () => {
    const mockBill = {
      id: 'sb1',
      billNumber: 'SB1',
      shortTitle: 'Education Funding Act',
      topics: ['Education']
    };

    const mockNewsArticles = [
      {
        headline: 'Texas Senate Considers Education Funding Bill',
        source: 'Texas Tribune',
        url: 'https://example.com/article1',
        publishedAt: new Date(),
        description: 'The Texas Senate is reviewing SB1 for education funding.'
      },
      {
        headline: 'Education Reform Advances in Legislature',
        source: 'Austin American-Statesman',
        url: 'https://example.com/article2',
        publishedAt: new Date(),
        description: 'New education funding proposal gains support.'
      }
    ];

    beforeEach(() => {
      // Mock bill exists
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => mockBill
      });
    });

    it('should fetch related news articles successfully', async () => {
      newsService.getNewsForBill.mockResolvedValue(mockNewsArticles);

      const response = await request(app)
        .get('/api/bills/news/sb1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          billId: 'sb1',
          articles: expect.arrayContaining([
            expect.objectContaining({
              headline: expect.any(String),
              source: expect.any(String),
              url: expect.any(String)
            })
          ]),
          count: 2
        },
        timestamp: expect.any(String)
      });

      expect(newsService.getNewsForBill).toHaveBeenCalledWith('sb1', mockBill);
    });

    it('should handle news service failures gracefully', async () => {
      newsService.getNewsForBill.mockRejectedValue(new Error('News API rate limit exceeded'));

      const response = await request(app)
        .get('/api/bills/news/sb1')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to fetch news'),
        timestamp: expect.any(String)
      });
    });

    it('should return empty array when no news found', async () => {
      newsService.getNewsForBill.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/bills/news/sb1')
        .expect(200);

      expect(response.body.data.articles).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid JSON'),
        timestamp: expect.any(String)
      });
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(400);

      // Should still work with proper middleware handling
      expect([200, 400]).toContain(response.status);
    });

    it('should handle database connection failures', async () => {
      databaseService.isConnected = false;
      databaseService.getDb.mockImplementation(() => {
        throw new Error('Database not connected');
      });

      const response = await request(app)
        .get('/api/bills')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Database'),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Performance and Rate Limiting', () => {
    it('should handle concurrent requests efficiently', async () => {
      mockDb.get.mockResolvedValue({
        docs: [
          {
            id: 'sb1',
            data: () => ({ billNumber: 'SB1', shortTitle: 'Test Bill' }),
            exists: true
          }
        ]
      });

      // Make 5 concurrent requests
      const requests = Array(5).fill().map(() => 
        request(app).get('/api/bills')
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should implement proper caching headers', async () => {
      mockDb.get.mockResolvedValue({
        docs: []
      });

      const response = await request(app)
        .get('/api/bills')
        .expect(200);

      // Check for appropriate cache headers
      expect(response.headers).toHaveProperty('cache-control');
    });
  });

  describe('CORS and Security', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/bills')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should sanitize input parameters', async () => {
      const response = await request(app)
        .get('/api/bills?search=<script>alert("xss")</script>')
        .expect(200);

      // Should not include raw script tags in response
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });
  });
});