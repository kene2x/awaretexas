// End-to-End User Workflow Tests
const request = require('supertest');
const app = require('../../backend/server');
const { databaseService } = require('../../config/database');
const { summaryService } = require('../../services/ai-summary');
const { newsService } = require('../../services/news');

// Mock external services for E2E testing
jest.mock('../../config/database');
jest.mock('../../services/ai-summary');
jest.mock('../../services/news');

describe('End-to-End User Workflows', () => {
  let mockDb;
  let mockBills;

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

    // Mock bills data
    mockBills = [
      {
        id: 'sb1',
        billNumber: 'SB1',
        shortTitle: 'Education Funding Reform Act',
        fullTitle: 'An Act relating to public education funding, teacher salaries, and school infrastructure improvements',
        status: 'Filed',
        sponsors: [
          { 
            name: 'Senator Jane Smith', 
            district: '15',
            photoUrl: 'https://example.com/senator-smith.jpg'
          }
        ],
        topics: ['Education', 'Finance'],
        abstract: 'This comprehensive education bill provides $2.5 billion in additional funding for public schools, increases teacher salaries by 15%, and allocates resources for infrastructure improvements across Texas school districts.',
        billText: 'SECTION 1. This Act may be cited as the "Education Funding Reform Act". SECTION 2. The legislature finds that adequate funding for public education is essential...',
        committee: 'Education Committee',
        filedDate: '2024-01-15T00:00:00Z',
        lastUpdated: '2024-01-20T10:30:00Z',
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1'
      },
      {
        id: 'sb2',
        billNumber: 'SB2',
        shortTitle: 'Healthcare Access Expansion',
        fullTitle: 'An Act relating to healthcare access, insurance reform, and rural healthcare initiatives',
        status: 'In Committee',
        sponsors: [
          { 
            name: 'Senator Robert Johnson', 
            district: '8',
            photoUrl: 'https://example.com/senator-johnson.jpg'
          }
        ],
        topics: ['Healthcare', 'Insurance'],
        abstract: 'This bill expands healthcare access in rural areas, reforms insurance regulations, and establishes new community health centers.',
        billText: 'SECTION 1. This Act may be cited as the "Healthcare Access Expansion Act". SECTION 2. The legislature finds that healthcare access is a fundamental right...',
        committee: 'Health and Human Services Committee',
        filedDate: '2024-01-10T00:00:00Z',
        lastUpdated: '2024-01-18T14:45:00Z',
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB2'
      },
      {
        id: 'sb3',
        billNumber: 'SB3',
        shortTitle: 'Transportation Infrastructure Investment',
        fullTitle: 'An Act relating to highway construction, public transportation, and infrastructure maintenance',
        status: 'Passed',
        sponsors: [
          { 
            name: 'Senator Maria Williams', 
            district: '22',
            photoUrl: 'https://example.com/senator-williams.jpg'
          }
        ],
        topics: ['Transportation', 'Infrastructure'],
        abstract: 'This bill allocates $5 billion for highway construction and maintenance, expands public transportation options, and improves infrastructure across Texas.',
        billText: 'SECTION 1. This Act may be cited as the "Transportation Infrastructure Investment Act". SECTION 2. The legislature finds that modern infrastructure is vital...',
        committee: 'Transportation Committee',
        filedDate: '2024-01-05T00:00:00Z',
        lastUpdated: '2024-01-25T16:20:00Z',
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB3'
      }
    ];
  });

  describe('Complete User Journey: Homepage to Bill Details', () => {
    it('should complete full workflow from homepage browsing to detailed bill view', async () => {
      // Step 1: User visits homepage and loads all bills
      mockDb.get.mockResolvedValue({
        docs: mockBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const homepageResponse = await request(app)
        .get('/api/bills')
        .expect(200);

      expect(homepageResponse.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            billNumber: 'SB1',
            shortTitle: 'Education Funding Reform Act'
          }),
          expect.objectContaining({
            billNumber: 'SB2',
            shortTitle: 'Healthcare Access Expansion'
          }),
          expect.objectContaining({
            billNumber: 'SB3',
            shortTitle: 'Transportation Infrastructure Investment'
          })
        ]),
        count: 3
      });

      // Step 2: User searches for education-related bills
      const searchResponse = await request(app)
        .get('/api/bills?search=education')
        .expect(200);

      expect(searchResponse.body.data).toHaveLength(1);
      expect(searchResponse.body.data[0].shortTitle).toContain('Education');
      expect(searchResponse.body.filters.search).toBe('education');

      // Step 3: User clicks on education bill to view details
      const selectedBill = mockBills[0]; // SB1 - Education bill
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => selectedBill
      });

      const billDetailResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      expect(billDetailResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          billNumber: 'SB1',
          fullTitle: expect.stringContaining('public education funding'),
          sponsors: expect.arrayContaining([
            expect.objectContaining({
              name: 'Senator Jane Smith',
              district: '15'
            })
          ]),
          committee: 'Education Committee'
        })
      });

      // Step 4: User requests AI summary
      const mockSummary = 'This education bill provides significant funding increases for Texas public schools. It raises teacher salaries and improves school infrastructure statewide.';
      summaryService.generateSummary.mockResolvedValue(mockSummary);

      const summaryResponse = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(200);

      expect(summaryResponse.body).toMatchObject({
        success: true,
        data: {
          billId: 'sb1',
          summary: mockSummary,
          readingLevel: 'high-level'
        }
      });

      // Step 5: User requests related news
      const mockNews = [
        {
          headline: 'Texas Senate Advances Education Funding Bill',
          source: 'Texas Tribune',
          url: 'https://texastribune.org/education-funding-sb1',
          publishedAt: new Date('2024-01-20'),
          description: 'The Texas Senate Education Committee approved SB1, which would provide billions in new funding for public schools.'
        },
        {
          headline: 'Teachers Rally for Salary Increases',
          source: 'Austin American-Statesman',
          url: 'https://statesman.com/teacher-rally-sb1',
          publishedAt: new Date('2024-01-18'),
          description: 'Educators across Texas gathered at the Capitol to support the education funding bill.'
        }
      ];
      newsService.getNewsForBill.mockResolvedValue(mockNews);

      const newsResponse = await request(app)
        .get('/api/bills/news/sb1')
        .expect(200);

      expect(newsResponse.body).toMatchObject({
        success: true,
        data: {
          billId: 'sb1',
          articles: expect.arrayContaining([
            expect.objectContaining({
              headline: expect.stringContaining('Education Funding'),
              source: 'Texas Tribune'
            })
          ]),
          count: 2
        }
      });

      // Verify all services were called with correct parameters
      expect(summaryService.generateSummary).toHaveBeenCalledWith(
        'sb1',
        selectedBill.billText,
        'high-level'
      );
      expect(newsService.getNewsForBill).toHaveBeenCalledWith('sb1', selectedBill);
    });

    it('should handle user workflow with filtering and status changes', async () => {
      // Step 1: User loads bills and filters by status
      mockDb.get.mockResolvedValue({
        docs: mockBills.filter(bill => bill.status === 'In Committee').map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const statusFilterResponse = await request(app)
        .get('/api/bills?status=In Committee')
        .expect(200);

      expect(statusFilterResponse.body.data).toHaveLength(1);
      expect(statusFilterResponse.body.data[0].status).toBe('In Committee');
      expect(statusFilterResponse.body.filters.status).toBe('In Committee');

      // Step 2: User views the healthcare bill details
      const healthcareBill = mockBills[1];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => healthcareBill
      });

      const billResponse = await request(app)
        .get('/api/bills/sb2')
        .expect(200);

      expect(billResponse.body.data.shortTitle).toBe('Healthcare Access Expansion');

      // Step 3: User requests detailed summary
      const detailedSummary = 'This comprehensive healthcare bill addresses rural healthcare shortages by establishing new community health centers and expanding telemedicine services. The legislation also reforms insurance regulations to improve coverage accessibility and affordability for Texas residents.';
      summaryService.generateSummary.mockResolvedValue(detailedSummary);

      const detailedSummaryResponse = await request(app)
        .post('/api/bills/summary/sb2')
        .send({ readingLevel: 'detailed' })
        .expect(200);

      expect(detailedSummaryResponse.body.data.summary).toBe(detailedSummary);
      expect(detailedSummaryResponse.body.data.readingLevel).toBe('detailed');
    });
  });

  describe('User Workflow: Search and Discovery', () => {
    it('should support complex search and filtering workflows', async () => {
      // Step 1: User performs keyword search
      const searchTerm = 'infrastructure';
      mockDb.get.mockResolvedValue({
        docs: mockBills.filter(bill => 
          bill.shortTitle.toLowerCase().includes(searchTerm) ||
          bill.fullTitle.toLowerCase().includes(searchTerm) ||
          bill.abstract.toLowerCase().includes(searchTerm)
        ).map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const searchResponse = await request(app)
        .get(`/api/bills?search=${searchTerm}`)
        .expect(200);

      expect(searchResponse.body.data).toHaveLength(1);
      expect(searchResponse.body.data[0].shortTitle).toContain('Transportation Infrastructure');

      // Step 2: User combines search with status filter
      mockDb.get.mockResolvedValue({
        docs: mockBills.filter(bill => 
          bill.status === 'Passed' &&
          (bill.shortTitle.toLowerCase().includes(searchTerm) ||
           bill.fullTitle.toLowerCase().includes(searchTerm) ||
           bill.abstract.toLowerCase().includes(searchTerm))
        ).map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const combinedFilterResponse = await request(app)
        .get(`/api/bills?search=${searchTerm}&status=Passed`)
        .expect(200);

      expect(combinedFilterResponse.body.data).toHaveLength(1);
      expect(combinedFilterResponse.body.data[0].status).toBe('Passed');
      expect(combinedFilterResponse.body.filters).toMatchObject({
        search: searchTerm,
        status: 'Passed'
      });

      // Step 3: User clears filters to see all bills
      mockDb.get.mockResolvedValue({
        docs: mockBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const allBillsResponse = await request(app)
        .get('/api/bills')
        .expect(200);

      expect(allBillsResponse.body.data).toHaveLength(3);
      expect(allBillsResponse.body.filters).toMatchObject({
        search: '',
        status: '',
        topics: [],
        sponsors: []
      });
    });

    it('should handle pagination and large result sets', async () => {
      // Create larger dataset for pagination testing
      const largeBillSet = Array(50).fill().map((_, index) => ({
        id: `sb${index + 10}`,
        billNumber: `SB${index + 10}`,
        shortTitle: `Test Bill ${index + 10}`,
        fullTitle: `An Act relating to test legislation ${index + 10}`,
        status: index % 3 === 0 ? 'Filed' : index % 3 === 1 ? 'In Committee' : 'Passed',
        sponsors: [{ name: `Senator Test ${index + 10}`, district: `${index + 1}` }],
        topics: ['Test'],
        abstract: `This is test bill number ${index + 10} for pagination testing.`,
        lastUpdated: new Date().toISOString()
      }));

      mockDb.get.mockResolvedValue({
        docs: largeBillSet.slice(0, 20).map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const paginatedResponse = await request(app)
        .get('/api/bills?limit=20&offset=0')
        .expect(200);

      expect(paginatedResponse.body.data).toHaveLength(20);
      expect(paginatedResponse.body.filters.limit).toBe(20);
      expect(paginatedResponse.body.filters.offset).toBe(0);
    });
  });

  describe('User Workflow: Reading Level Preferences', () => {
    it('should support reading level switching workflow', async () => {
      const bill = mockBills[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => bill
      });

      // Step 1: User requests high-level summary
      const highLevelSummary = 'This bill gives more money to schools and raises teacher pay.';
      summaryService.generateSummary.mockResolvedValueOnce(highLevelSummary);

      const highLevelResponse = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(200);

      expect(highLevelResponse.body.data.summary).toBe(highLevelSummary);
      expect(highLevelResponse.body.data.readingLevel).toBe('high-level');

      // Step 2: User switches to detailed summary
      const detailedSummary = 'This comprehensive education funding bill allocates $2.5 billion in additional state funding for public schools across Texas. The legislation includes provisions for a 15% increase in teacher salaries, infrastructure improvements, and enhanced educational resources. The bill also establishes new accountability measures and performance standards for school districts receiving the additional funding.';
      summaryService.generateSummary.mockResolvedValueOnce(detailedSummary);

      const detailedResponse = await request(app)
        .put('/api/bills/summary/sb1/level')
        .send({ readingLevel: 'detailed', forceRegenerate: true })
        .expect(200);

      expect(detailedResponse.body.data.summary).toBe(detailedSummary);
      expect(detailedResponse.body.data.readingLevel).toBe('detailed');
      expect(detailedResponse.body.data.forceRegenerated).toBe(true);

      // Verify both summary requests were made with correct parameters
      expect(summaryService.generateSummary).toHaveBeenCalledTimes(2);
      expect(summaryService.generateSummary).toHaveBeenNthCalledWith(1, 'sb1', bill.billText, 'high-level');
      expect(summaryService.generateSummary).toHaveBeenNthCalledWith(2, 'sb1', bill.billText, 'detailed');
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle service failures gracefully in user workflow', async () => {
      const bill = mockBills[0];
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => bill
      });

      // Step 1: User successfully loads bill details
      const billResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      expect(billResponse.body.success).toBe(true);

      // Step 2: AI summary service fails
      summaryService.generateSummary.mockRejectedValue(new Error('AI service temporarily unavailable'));

      const summaryResponse = await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(500);

      expect(summaryResponse.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to generate summary'),
        timestamp: expect.any(String)
      });

      // Step 3: News service also fails
      newsService.getNewsForBill.mockRejectedValue(new Error('News API rate limit exceeded'));

      const newsResponse = await request(app)
        .get('/api/bills/news/sb1')
        .expect(500);

      expect(newsResponse.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to fetch news'),
        timestamp: expect.any(String)
      });

      // Step 4: User can still access basic bill information
      const retryBillResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      expect(retryBillResponse.body.success).toBe(true);
      expect(retryBillResponse.body.data.billNumber).toBe('SB1');
    });

    it('should handle database connectivity issues', async () => {
      // Simulate database connection failure
      databaseService.isConnected = false;
      mockDb.get.mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .get('/api/bills')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Database'),
        timestamp: expect.any(String)
      });

      // Simulate recovery
      databaseService.isConnected = true;
      mockDb.get.mockResolvedValue({
        docs: mockBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      const recoveryResponse = await request(app)
        .get('/api/bills')
        .expect(200);

      expect(recoveryResponse.body.success).toBe(true);
      expect(recoveryResponse.body.data).toHaveLength(3);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent user requests efficiently', async () => {
      // Setup successful responses
      mockDb.get.mockResolvedValue({
        docs: mockBills.map(bill => ({
          id: bill.id,
          data: () => bill,
          exists: true
        }))
      });

      summaryService.generateSummary.mockResolvedValue('Test summary');
      newsService.getNewsForBill.mockResolvedValue([]);

      // Simulate 10 concurrent users
      const concurrentRequests = Array(10).fill().map(async (_, index) => {
        const billsResponse = await request(app).get('/api/bills');
        const billDetailResponse = await request(app).get('/api/bills/sb1');
        const summaryResponse = await request(app)
          .post('/api/bills/summary/sb1')
          .send({ readingLevel: 'high-level' });
        
        return {
          billsStatus: billsResponse.status,
          detailStatus: billDetailResponse.status,
          summaryStatus: summaryResponse.status
        };
      });

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      results.forEach(result => {
        expect(result.billsStatus).toBe(200);
        expect(result.detailStatus).toBe(200);
        expect(result.summaryStatus).toBe(200);
      });
    });
  });

  describe('Data Consistency Workflows', () => {
    it('should maintain data consistency across related requests', async () => {
      const bill = mockBills[0];
      
      // Step 1: User loads bill details
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => bill
      });

      const billResponse = await request(app)
        .get('/api/bills/sb1')
        .expect(200);

      const billData = billResponse.body.data;

      // Step 2: User requests summary - should use same bill data
      summaryService.generateSummary.mockResolvedValue('Consistent summary');

      await request(app)
        .post('/api/bills/summary/sb1')
        .send({ readingLevel: 'high-level' })
        .expect(200);

      // Step 3: User requests news - should use same bill data
      newsService.getNewsForBill.mockResolvedValue([]);

      await request(app)
        .get('/api/bills/news/sb1')
        .expect(200);

      // Verify services were called with consistent bill data
      expect(summaryService.generateSummary).toHaveBeenCalledWith(
        'sb1',
        bill.billText,
        'high-level'
      );
      expect(newsService.getNewsForBill).toHaveBeenCalledWith('sb1', bill);
    });
  });
});