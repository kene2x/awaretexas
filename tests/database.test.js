// Comprehensive Database Tests
const { BillDatabase } = require('../config/bill-database');
const { SummaryDatabase } = require('../config/summary-database');
const { NewsDatabase } = require('../config/news-database');
const { databaseService } = require('../config/database');
const { MockDataGenerator, DatabaseMockHelper, TestEnvironmentHelper } = require('./utils/test-helpers');

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
    batch: jest.fn()
  }))
}));

// Create instances for testing validation methods
const billDatabase = new BillDatabase();
const summaryDatabase = new SummaryDatabase();
const newsDatabase = new NewsDatabase();

describe('Bill Database', () => {

  test('should validate bill data correctly', () => {
    const validBill = {
      billNumber: 'SB123',
      shortTitle: 'Test Bill',
      status: 'Filed',
      sponsors: ['John Doe'],
      topics: ['Education']
    };

    expect(() => billDatabase.validateBillData(validBill)).not.toThrow();
  });

  test('should reject invalid bill data', () => {
    const invalidBill = {
      shortTitle: 'Test Bill',
      status: 'Invalid Status'
    };

    expect(() => billDatabase.validateBillData(invalidBill)).toThrow();
  });

  test('should reject invalid status', () => {
    const invalidBill = {
      billNumber: 'SB123',
      shortTitle: 'Test Bill',
      status: 'Invalid Status'
    };

    expect(() => billDatabase.validateBillData(invalidBill)).toThrow('Invalid status');
  });
});

describe('Summary Database', () => {

  test('should validate summary data correctly', () => {
    const validSummaries = {
      'high-level': 'This is a high-level summary',
      'detailed': 'This is a detailed summary'
    };

    expect(() => summaryDatabase.validateSummaryData(validSummaries)).not.toThrow();
  });

  test('should reject invalid summary levels', () => {
    const invalidSummaries = {
      'invalid-level': 'This is invalid'
    };

    expect(() => summaryDatabase.validateSummaryData(invalidSummaries)).toThrow('Invalid summary level');
  });

  test('should reject empty summaries object', () => {
    expect(() => summaryDatabase.validateSummaryData({})).toThrow('At least one summary level must be provided');
  });
});

describe('News Database', () => {

  test('should validate news articles correctly', () => {
    const validArticles = [
      {
        headline: 'Test Article',
        source: 'Test Source',
        url: 'https://example.com/article'
      }
    ];

    expect(() => newsDatabase.validateNewsData(validArticles)).not.toThrow();
  });

  test('should reject articles with invalid URLs', () => {
    const invalidArticles = [
      {
        headline: 'Test Article',
        source: 'Test Source',
        url: 'invalid-url'
      }
    ];

    expect(() => newsDatabase.validateNewsData(invalidArticles)).toThrow('invalid URL');
  });

  test('should reject articles missing required fields', () => {
    const invalidArticles = [
      {
        headline: 'Test Article'
        // missing source and url
      }
    ];

    expect(() => newsDatabase.validateNewsData(invalidArticles)).toThrow('missing required field');
  });
});

describe('Database Service Integration', () => {
  let mockDb;

  beforeEach(() => {
    TestEnvironmentHelper.setupTestEnvironment();
    mockDb = DatabaseMockHelper.createMockDb();
    jest.clearAllMocks();
  });

  afterEach(() => {
    TestEnvironmentHelper.cleanupTestEnvironment();
  });

  describe('Connection Management', () => {
    it('should initialize database connection', async () => {
      databaseService.db = mockDb;
      databaseService.isConnected = true;

      expect(databaseService.isConnected).toBe(true);
      expect(databaseService.getDb()).toBe(mockDb);
    });

    it('should handle connection failures gracefully', async () => {
      databaseService.isConnected = false;
      
      expect(() => databaseService.getDb()).toThrow();
    });

    it('should initialize collections properly', async () => {
      databaseService.db = mockDb;
      
      await databaseService.initializeCollections();
      
      expect(mockDb.collection).toHaveBeenCalledWith('bills');
      expect(mockDb.collection).toHaveBeenCalledWith('summaries');
      expect(mockDb.collection).toHaveBeenCalledWith('news_cache');
    });
  });

  describe('CRUD Operations', () => {
    const mockBill = MockDataGenerator.generateBill();

    beforeEach(() => {
      billDatabase.db = mockDb;
    });

    it('should save bill successfully', async () => {
      mockDb.set.mockResolvedValue();

      await billDatabase.saveBill(mockBill);

      expect(mockDb.collection).toHaveBeenCalledWith('bills');
      expect(mockDb.doc).toHaveBeenCalledWith(mockBill.id);
      expect(mockDb.set).toHaveBeenCalledWith(mockBill);
    });

    it('should retrieve bill by ID', async () => {
      DatabaseMockHelper.mockSingleBill(mockDb, mockBill);

      const result = await billDatabase.getBill(mockBill.id);

      expect(result).toEqual(mockBill);
      expect(mockDb.collection).toHaveBeenCalledWith('bills');
      expect(mockDb.doc).toHaveBeenCalledWith(mockBill.id);
    });

    it('should return null for non-existent bill', async () => {
      DatabaseMockHelper.mockBillNotFound(mockDb);

      const result = await billDatabase.getBill('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      DatabaseMockHelper.mockDatabaseError(mockDb, 'Connection timeout');

      await expect(billDatabase.getBill('sb1')).rejects.toThrow('Connection timeout');
    });
  });

  describe('Performance and Optimization', () => {
    it('should use appropriate indexes for common queries', async () => {
      const mockBills = MockDataGenerator.generateBills(10);
      DatabaseMockHelper.mockBillsCollection(mockDb, mockBills);

      await billDatabase.getAllBills({ status: 'Filed' });
      expect(mockDb.where).toHaveBeenCalledWith('status', '==', 'Filed');

      await billDatabase.getAllBills({ orderBy: 'lastUpdated' });
      expect(mockDb.orderBy).toHaveBeenCalledWith('lastUpdated', 'desc');

      await billDatabase.getAllBills({ limit: 50 });
      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });

    it('should handle large result sets efficiently', async () => {
      const largeBillSet = MockDataGenerator.generateBills(1000);
      DatabaseMockHelper.mockBillsCollection(mockDb, largeBillSet);

      const result = await billDatabase.getAllBills({ limit: 100 });

      expect(Array.isArray(result)).toBe(true);
      expect(mockDb.limit).toHaveBeenCalledWith(100);
    });
  });
});

