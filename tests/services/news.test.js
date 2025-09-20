const { NewsService } = require('../../services/news');
const { databaseService } = require('../../config/database');

// Mock NewsAPI
jest.mock('newsapi');
const NewsAPI = require('newsapi');

// Mock database service
jest.mock('../../config/database');

describe('NewsService', () => {
  let newsService;
  let mockNewsAPI;
  let mockDb;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create new service instance for each test
    newsService = new NewsService();
    
    // Mock NewsAPI instance
    mockNewsAPI = {
      v2: {
        everything: jest.fn()
      }
    };
    NewsAPI.mockImplementation(() => mockNewsAPI);
    
    // Mock database
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn()
    };
    databaseService.getDb.mockReturnValue(mockDb);
    
    // Set test environment variable
    process.env.NEWS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.NEWS_API_KEY;
  });

  describe('initialization', () => {
    test('should initialize successfully with valid API key', async () => {
      const result = await newsService.initialize();
      
      expect(result).toBe(true);
      expect(newsService.isInitialized).toBe(true);
      expect(NewsAPI).toHaveBeenCalledWith('test-api-key');
    });

    test('should fail initialization without API key', async () => {
      delete process.env.NEWS_API_KEY;
      
      await expect(newsService.initialize()).rejects.toThrow('NEWS_API_KEY environment variable is required');
      expect(newsService.isInitialized).toBe(false);
    });

    test('should handle initialization errors gracefully', async () => {
      NewsAPI.mockImplementation(() => {
        throw new Error('API initialization failed');
      });
      
      await expect(newsService.initialize()).rejects.toThrow('News service initialization failed');
      expect(newsService.isInitialized).toBe(false);
    });
  });

  describe('getNewsForBill', () => {
    const mockBillData = {
      billNumber: 'SB123',
      shortTitle: 'Education Funding Reform Act',
      topics: ['Education', 'Finance']
    };

    const mockArticles = [
      {
        title: 'Texas Senate Passes Education Funding Bill SB123',
        source: { name: 'Texas Tribune' },
        url: 'https://example.com/article1',
        publishedAt: '2024-01-15T10:00:00Z',
        description: 'The Texas Senate approved SB123 for education funding reform.',
        urlToImage: 'https://example.com/image1.jpg'
      },
      {
        title: 'Sports Update: Cowboys Win',
        source: { name: 'Sports News' },
        url: 'https://example.com/sports',
        publishedAt: '2024-01-15T09:00:00Z',
        description: 'Dallas Cowboys victory in latest game.',
        urlToImage: null
      }
    ];

    beforeEach(async () => {
      await newsService.initialize();
    });

    test('should fetch and process news articles successfully', async () => {
      mockNewsAPI.v2.everything.mockResolvedValue({
        status: 'ok',
        articles: mockArticles
      });

      const result = await newsService.getNewsForBill('bill123', mockBillData);
      
      expect(result).toHaveLength(1); // Sports article should be filtered out
      expect(result[0]).toMatchObject({
        headline: 'Texas Senate Passes Education Funding Bill SB123',
        source: 'Texas Tribune',
        url: 'https://example.com/article1'
      });
      expect(result[0].publishedAt).toBeInstanceOf(Date);
    });

    test('should return cached news if available', async () => {
      const cachedArticles = [
        {
          headline: 'Cached Article',
          source: 'Cache Source',
          url: 'https://cached.com',
          publishedAt: new Date(),
          description: 'Cached description'
        }
      ];

      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({
          articles: cachedArticles,
          lastFetched: { toMillis: () => Date.now() - 1000 } // 1 second ago
        })
      });

      const result = await newsService.getNewsForBill('bill123', mockBillData);
      
      expect(result).toEqual(cachedArticles);
      expect(mockNewsAPI.v2.everything).not.toHaveBeenCalled();
    });

    test('should handle News API errors gracefully', async () => {
      mockNewsAPI.v2.everything.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await newsService.getNewsForBill('bill123', mockBillData);
      
      expect(result).toHaveLength(1);
      expect(result[0].isError).toBe(true);
      expect(result[0].headline).toContain('temporarily unavailable');
    });

    test('should validate required parameters', async () => {
      await expect(newsService.getNewsForBill(null, mockBillData)).rejects.toThrow('Bill ID and data are required');
      await expect(newsService.getNewsForBill('bill123', null)).rejects.toThrow('Bill ID and data are required');
    });

    test('should handle empty API response', async () => {
      mockNewsAPI.v2.everything.mockResolvedValue({
        status: 'ok',
        articles: []
      });

      const result = await newsService.getNewsForBill('bill123', mockBillData);
      
      expect(result).toEqual([]);
    });
  });

  describe('keyword extraction', () => {
    test('should extract keywords from bill data', () => {
      const billData = {
        billNumber: 'SB456',
        shortTitle: 'Relating to healthcare and medical insurance reform',
        topics: ['Healthcare', 'Insurance']
      };

      const keywords = newsService.extractKeywords(billData);
      
      expect(keywords).toContain('SB456');
      expect(keywords).toContain('healthcare');
      expect(keywords).toContain('medical');
      expect(keywords).toContain('insurance');
      expect(keywords).toContain('Healthcare');
      expect(keywords).toContain('Insurance');
      expect(keywords).toContain('Texas');
      
      // Should not contain common words
      expect(keywords).not.toContain('relating');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('and');
    });

    test('should handle missing bill data gracefully', () => {
      const billData = {};
      const keywords = newsService.extractKeywords(billData);
      
      expect(keywords).toContain('Texas');
      expect(keywords.length).toBeGreaterThan(0);
    });

    test('should limit number of keywords', () => {
      const billData = {
        billNumber: 'SB789',
        shortTitle: 'Very long title with many different words that should be limited appropriately',
        topics: ['Topic1', 'Topic2', 'Topic3', 'Topic4', 'Topic5']
      };

      const keywords = newsService.extractKeywords(billData);
      
      // Should be reasonable number of keywords (not too many)
      expect(keywords.length).toBeLessThan(10);
    });
  });

  describe('article filtering', () => {
    const billData = {
      billNumber: 'SB123',
      topics: ['Education']
    };

    test('should filter relevant articles', () => {
      const relevantArticle = {
        title: 'Texas Education Bill SB123 Passes Committee',
        url: 'https://example.com/relevant',
        description: 'Education reform bill advances'
      };

      const result = newsService.isRelevantArticle(relevantArticle, billData);
      expect(result).toBe(true);
    });

    test('should filter out irrelevant articles', () => {
      const irrelevantArticle = {
        title: 'Cowboys Win Football Game',
        url: 'https://example.com/sports',
        description: 'Sports news about football'
      };

      const result = newsService.isRelevantArticle(irrelevantArticle, billData);
      expect(result).toBe(false);
    });

    test('should filter out articles without required fields', () => {
      const incompleteArticle = {
        title: null,
        url: 'https://example.com/incomplete'
      };

      const result = newsService.isRelevantArticle(incompleteArticle, billData);
      expect(result).toBe(false);
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await newsService.initialize();
    });

    test('should cache news articles in Firebase', async () => {
      const articles = [
        {
          headline: 'Test Article',
          source: 'Test Source',
          url: 'https://test.com',
          publishedAt: new Date(),
          description: 'Test description'
        }
      ];

      await newsService.cacheNews('bill123', articles);
      
      expect(mockDb.collection).toHaveBeenCalledWith('news_cache');
      expect(mockDb.doc).toHaveBeenCalledWith('bill123');
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        billId: 'bill123',
        articles,
        articleCount: 1
      }));
    });

    test('should handle caching errors gracefully', async () => {
      mockDb.set.mockRejectedValue(new Error('Database error'));
      
      // Should not throw error
      await expect(newsService.cacheNews('bill123', [])).resolves.not.toThrow();
    });

    test('should clear cache correctly', () => {
      // Add some items to memory cache
      newsService.cache.set('bill1', { articles: [], timestamp: Date.now() });
      newsService.cache.set('bill2', { articles: [], timestamp: Date.now() });
      
      expect(newsService.cache.size).toBe(2);
      
      // Clear specific bill
      newsService.clearCache('bill1');
      expect(newsService.cache.size).toBe(1);
      expect(newsService.cache.has('bill1')).toBe(false);
      expect(newsService.cache.has('bill2')).toBe(true);
      
      // Clear all cache
      newsService.clearCache();
      expect(newsService.cache.size).toBe(0);
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      await newsService.initialize();
    });

    test('should enforce rate limiting between requests', async () => {
      const startTime = Date.now();
      
      // Make two requests quickly
      await newsService._enforceRateLimit();
      await newsService._enforceRateLimit();
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have waited at least the rate limit delay
      expect(elapsed).toBeGreaterThanOrEqual(newsService.rateLimitDelay - 50); // Allow 50ms tolerance
    });
  });

  describe('service status', () => {
    test('should return correct status information', () => {
      const status = newsService.getStatus();
      
      expect(status).toMatchObject({
        isInitialized: expect.any(Boolean),
        cacheSize: expect.any(Number),
        maxArticles: expect.any(Number),
        cacheExpiry: expect.any(Number),
        rateLimitDelay: expect.any(Number),
        apiKeyConfigured: expect.any(Boolean)
      });
    });
  });

  describe('connection testing', () => {
    beforeEach(async () => {
      await newsService.initialize();
    });

    test('should test connection successfully', async () => {
      mockNewsAPI.v2.everything.mockResolvedValue({
        status: 'ok',
        articles: []
      });

      const result = await newsService.testConnection();
      expect(result).toBe(true);
    });

    test('should handle connection test failures', async () => {
      mockNewsAPI.v2.everything.mockRejectedValue(new Error('Connection failed'));

      const result = await newsService.testConnection();
      expect(result).toBe(false);
    });
  });
});