// Performance and Load Tests
const request = require('supertest');
const app = require('../../backend/server');
const { databaseService } = require('../../config/database');
const { summaryService } = require('../../services/ai-summary');
const { newsService } = require('../../services/news');

// Mock external services for performance testing
jest.mock('../../config/database');
jest.mock('../../services/ai-summary');
jest.mock('../../services/news');

describe('Performance and Load Tests', () => {
  let mockDb;
  let largeBillDataset;

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

    // Create large dataset for performance testing
    largeBillDataset = Array(1000).fill().map((_, index) => ({
      id: `sb${index + 1}`,
      billNumber: `SB${index + 1}`,
      shortTitle: `Test Bill ${index + 1} - ${getRandomTopic()}`,
      fullTitle: `An Act relating to ${getRandomTopic().toLowerCase()} and various legislative matters for bill ${index + 1}`,
      status: getRandomStatus(),
      sponsors: [
        { 
          name: `Senator ${getRandomName()} ${getRandomLastName()}`, 
          district: `${Math.floor(Math.random() * 31) + 1}` 
        }
      ],
      topics: [getRandomTopic(), getRandomTopic()],
      abstract: `This is a comprehensive bill addressing ${getRandomTopic().toLowerCase()} issues. The legislation includes provisions for various improvements and reforms. Bill number ${index + 1} represents important legislative work for the state of Texas.`,
      billText: generateLongBillText(index + 1),
      committee: `${getRandomTopic()} Committee`,
      filedDate: new Date(2024, 0, Math.floor(Math.random() * 30) + 1).toISOString(),
      lastUpdated: new Date().toISOString(),
      officialUrl: `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB${index + 1}`
    }));

    // Mock services with realistic delays
    summaryService.generateSummary.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate AI processing time
      return 'This is a generated summary for performance testing purposes.';
    });

    newsService.getNewsForBill.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate news API delay
      return [
        {
          headline: 'Test News Article',
          source: 'Test Source',
          url: 'https://example.com/news',
          publishedAt: new Date(),
          description: 'Test news description'
        }
      ];
    });
  });

  // Helper functions for generating test data
  function getRandomTopic() {
    const topics = ['Education', 'Healthcare', 'Transportation', 'Finance', 'Environment', 'Criminal Justice', 'Agriculture', 'Technology'];
    return topics[Math.floor(Math.random() * topics.length)];
  }

  function getRandomStatus() {
    const statuses = ['Filed', 'In Committee', 'Passed'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  function getRandomName() {
    const names = ['John', 'Jane', 'Robert', 'Mary', 'Michael', 'Sarah', 'David', 'Lisa'];
    return names[Math.floor(Math.random() * names.length)];
  }

  function getRandomLastName() {
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    return lastNames[Math.floor(Math.random() * lastNames.length)];
  }

  function generateLongBillText(billNumber) {
    return `SECTION 1. This Act may be cited as "Test Bill ${billNumber}".
    
SECTION 2. The legislature finds that this legislation addresses important state matters and serves the public interest.

SECTION 3. For purposes of this Act:
(1) "Test provision" means any provision included for testing purposes;
(2) "Implementation" means the process of putting this Act into effect;
(3) "Compliance" means adherence to the requirements of this Act.

SECTION 4. This Act establishes new requirements for state agencies and local governments to ensure proper implementation of the provisions contained herein.

SECTION 5. The following procedures shall be followed:
(a) Initial assessment and planning phase;
(b) Implementation and monitoring phase;
(c) Evaluation and reporting phase.

SECTION 6. This Act takes effect September 1, 2024.`.repeat(5); // Make it longer
  }

  describe('API Response Time Performance', () => {
    it('should respond to /api/bills within acceptable time limits', async () => {
      // Mock first 50 bills for reasonable response size
      mockDb.get.mockResolvedValue({
        docs: largeBillDataset.slice(0, 50).map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/bills')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(50);
    });

    it('should handle individual bill requests efficiently', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(500); // Should respond within 500ms
      expect(response.body.success).toBe(true);
      expect(response.body.data.billNumber).toBe('SB1');
    });

    it('should handle search queries efficiently with large datasets', async () => {
      // Filter bills that match search term
      const searchTerm = 'education';
      const filteredBills = largeBillDataset.filter(bill => 
        bill.shortTitle.toLowerCase().includes(searchTerm) ||
        bill.fullTitle.toLowerCase().includes(searchTerm) ||
        bill.abstract.toLowerCase().includes(searchTerm)
      );

      mockDb.get.mockResolvedValue({
        docs: filteredBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/bills?search=${searchTerm}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.success).toBe(true);
      expect(response.body.filters.search).toBe(searchTerm);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent bill list requests', async () => {
      mockDb.get.mockResolvedValue({
        docs: largeBillDataset.slice(0, 20).map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill().map(() =>
        request(app).get('/api/bills')
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable (not much longer than single request)
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle concurrent summary generation requests', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      const concurrentRequests = 5;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill().map((_, index) =>
        request(app)
          .post('/api/bills/summary/sb1')
          .send({ readingLevel: index % 2 === 0 ? 'high-level' : 'detailed' })
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrent AI requests reasonably
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle mixed concurrent requests (bills, summaries, news)', async () => {
      const testBill = largeBillDataset[0];
      
      // Setup mocks for different request types
      mockDb.get.mockImplementation((path) => {
        if (path) {
          // Individual bill request
          return Promise.resolve({
            exists: true,
            data: () => testBill
          });
        } else {
          // Bills list request
          return Promise.resolve({
            docs: largeBillDataset.slice(0, 10).map(bill => ({
              id: bill.id,
              data: () => bill,
              exists: true
            }))
          });
        }
      });

      const startTime = Date.now();

      const mixedRequests = [
        request(app).get('/api/bills'),
        request(app).get('/api/bills/sb1'),
        request(app).post('/api/bills/summary/sb1').send({ readingLevel: 'high-level' }),
        request(app).get('/api/bills/news/sb1'),
        request(app).get('/api/bills?search=education'),
        request(app).get('/api/bills?status=Filed')
      ];

      const responses = await Promise.all(mixedRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should handle large bill datasets without memory issues', async () => {
      // Use the full large dataset
      mockDb.get.mockResolvedValue({
        docs: largeBillDataset.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const initialMemory = process.memoryUsage();

      const response = await request(app)
        .get('/api/bills')
        .expect(200);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1000);
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should efficiently handle pagination with large datasets', async () => {
      const pageSize = 50;
      const totalPages = Math.ceil(largeBillDataset.length / pageSize);

      for (let page = 0; page < Math.min(totalPages, 5); page++) {
        const offset = page * pageSize;
        const pageData = largeBillDataset.slice(offset, offset + pageSize);

        mockDb.get.mockResolvedValue({
          docs: pageData.map(bill => ({
            id: bill.id,
            data: () => bill,
            exists: true
          }))
        });

        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/bills?limit=${pageSize}&offset=${offset}`)
          .expect(200);

        const responseTime = Date.now() - startTime;

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(Math.min(pageSize, pageData.length));
        expect(responseTime).toBeLessThan(1000); // Each page should load quickly
      }
    });
  });

  describe('Database Query Performance', () => {
    it('should optimize database queries for filtering operations', async () => {
      let queryCount = 0;
      
      // Track database query calls
      mockDb.get.mockImplementation(() => {
        queryCount++;
        return Promise.resolve({
          docs: largeBillDataset.slice(0, 10).map(bill => ({
            id: bill.id,
            data: () => bill,
            exists: true
          }))
        });
      });

      // Perform multiple filtered requests
      await request(app).get('/api/bills?status=Filed').expect(200);
      await request(app).get('/api/bills?search=education').expect(200);
      await request(app).get('/api/bills?status=In Committee&search=healthcare').expect(200);

      // Should not make excessive database queries
      expect(queryCount).toBeLessThan(10);
    });

    it('should handle complex filter combinations efficiently', async () => {
      const complexFilteredBills = largeBillDataset.filter(bill => 
        bill.status === 'Filed' &&
        bill.topics.includes('Education') &&
        bill.sponsors[0].name.includes('Smith')
      );

      mockDb.get.mockResolvedValue({
        docs: complexFilteredBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/bills?status=Filed&topics=Education&sponsor=Smith')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Service Integration Performance', () => {
    it('should handle AI service delays gracefully', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      // Simulate slower AI service
      summaryService.generateSummary.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        return 'This summary took longer to generate due to AI processing.';
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeGreaterThan(1900); // Should reflect the delay
      expect(responseTime).toBeLessThan(3000); // But not exceed reasonable timeout
    });

    it('should handle news service rate limiting', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      // Simulate rate limiting with delays
      let requestCount = 0;
      newsService.getNewsForBill.mockImplementation(async () => {
        requestCount++;
        if (requestCount > 3) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit delay
        }
        return [];
      });

      const requests = Array(5).fill().map(() =>
        request(app).get('/api/bills/news/sb1')
      );

      const responses = await Promise.all(requests);

      // All requests should eventually succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Error Handling Performance', () => {
    it('should fail fast on invalid requests', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/bills/invalid-bill-id-that-does-not-exist')
        .expect(404);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(false);
      expect(responseTime).toBeLessThan(100); // Should fail quickly
    });

    it('should handle service timeouts efficiently', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      // Simulate service timeout
      summaryService.generateSummary.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
        return 'This should timeout';
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' });

      const responseTime = Date.now() - startTime;

      // Should timeout and return error within reasonable time
      expect(responseTime).toBeLessThan(15000); // Should timeout before 15 seconds
      expect([500, 408]).toContain(response.status); // Server error or timeout
    });
  });

  describe('Caching Performance', () => {
    it('should demonstrate improved performance with caching', async () => {
      const testBill = largeBillDataset[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => testBill
      });

      // First request (no cache)
      const firstStartTime = Date.now();
      const firstResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);
      const firstResponseTime = Date.now() - firstStartTime;

      // Second request (should be faster if caching is implemented)
      const secondStartTime = Date.now();
      const secondResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);
      const secondResponseTime = Date.now() - secondStartTime;

      expect(firstResponse.body.success).toBe(true);
      expect(secondResponse.body.success).toBe(true);
      
      // Second request should be same or faster
      expect(secondResponseTime).toBeLessThanOrEqual(firstResponseTime + 50); // Allow small variance
    });
  });
});