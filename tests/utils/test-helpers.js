// Test Utilities and Helpers
const { EventEmitter } = require('events');

/**
 * Mock data generators for consistent testing
 */
class MockDataGenerator {
  static generateBill(overrides = {}) {
    const defaultBill = {
      id: 'sb1',
      billNumber: 'SB1',
      shortTitle: 'Test Bill',
      fullTitle: 'An Act relating to test legislation',
      status: 'Filed',
      sponsors: [
        {
          name: 'Senator Test',
          district: '1',
          photoUrl: 'https://example.com/photo.jpg'
        }
      ],
      topics: ['Test'],
      abstract: 'This is a test bill for testing purposes.',
      billText: 'SECTION 1. This Act may be cited as the "Test Act".',
      committee: 'Test Committee',
      coSponsors: [],
      filedDate: new Date('2024-01-15').toISOString(),
      lastUpdated: new Date().toISOString(),
      officialUrl: 'https://capitol.texas.gov/test'
    };

    return { ...defaultBill, ...overrides };
  }

  static generateBills(count = 5, baseOverrides = {}) {
    return Array(count).fill().map((_, index) => 
      this.generateBill({
        id: `sb${index + 1}`,
        billNumber: `SB${index + 1}`,
        shortTitle: `Test Bill ${index + 1}`,
        ...baseOverrides
      })
    );
  }

  static generateNewsArticle(overrides = {}) {
    const defaultArticle = {
      headline: 'Test News Article',
      source: 'Test Source',
      url: 'https://example.com/news',
      publishedAt: new Date(),
      description: 'Test news description',
      urlToImage: 'https://example.com/image.jpg'
    };

    return { ...defaultArticle, ...overrides };
  }

  static generateNewsArticles(count = 3, baseOverrides = {}) {
    return Array(count).fill().map((_, index) =>
      this.generateNewsArticle({
        headline: `Test News Article ${index + 1}`,
        url: `https://example.com/news${index + 1}`,
        ...baseOverrides
      })
    );
  }

  static generateSummary(readingLevel = 'high-level') {
    const summaries = {
      'high-level': 'This bill makes important changes to state law.',
      'detailed': 'This comprehensive bill establishes new frameworks and procedures for state agencies, includes specific provisions for implementation, and allocates resources for enforcement and monitoring.'
    };

    return summaries[readingLevel] || summaries['high-level'];
  }
}

/**
 * Database mock utilities
 */
class DatabaseMockHelper {
  static createMockDb() {
    const mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis()
    };

    return mockDb;
  }

  static mockBillsCollection(mockDb, bills) {
    mockDb.get.mockResolvedValue({
      docs: bills.map(bill => ({
        id: bill.id,
        data: () => bill,
        exists: true
      }))
    });
  }

  static mockSingleBill(mockDb, bill) {
    mockDb.get.mockResolvedValue({
      exists: true,
      data: () => bill
    });
  }

  static mockBillNotFound(mockDb) {
    mockDb.get.mockResolvedValue({
      exists: false
    });
  }

  static mockDatabaseError(mockDb, errorMessage = 'Database error') {
    mockDb.get.mockRejectedValue(new Error(errorMessage));
  }
}

/**
 * API response validators
 */
class ApiResponseValidator {
  static validateBillsResponse(response) {
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('filters');
    expect(response.body).toHaveProperty('timestamp');
    
    if (response.body.success) {
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(typeof response.body.count).toBe('number');
      expect(typeof response.body.filters).toBe('object');
    }
  }

  static validateBillDetailResponse(response) {
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('timestamp');
    
    if (response.body.success) {
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('billNumber');
      expect(response.body.data).toHaveProperty('shortTitle');
      expect(response.body.data).toHaveProperty('status');
    } else {
      expect(response.body).toHaveProperty('error');
    }
  }

  static validateSummaryResponse(response) {
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('timestamp');
    
    if (response.body.success) {
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('billId');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('readingLevel');
    } else {
      expect(response.body).toHaveProperty('error');
    }
  }

  static validateNewsResponse(response) {
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('timestamp');
    
    if (response.body.success) {
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('billId');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.articles)).toBe(true);
    } else {
      expect(response.body).toHaveProperty('error');
    }
  }

  static validateErrorResponse(response) {
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.error).toBe('string');
  }
}

/**
 * Service mock utilities
 */
class ServiceMockHelper {
  static mockSummaryService(summaryService) {
    summaryService.generateSummary = jest.fn();
    summaryService.classifyTopics = jest.fn();
    summaryService.getCachedSummary = jest.fn();
    summaryService.cacheSummary = jest.fn();
    summaryService.clearCache = jest.fn();
    summaryService.getStatus = jest.fn();
    summaryService.initialize = jest.fn();

    return summaryService;
  }

  static mockNewsService(newsService) {
    newsService.getNewsForBill = jest.fn();
    newsService.extractKeywords = jest.fn();
    newsService.clearCache = jest.fn();
    newsService.getStatus = jest.fn();
    newsService.initialize = jest.fn();
    newsService.testConnection = jest.fn();

    return newsService;
  }

  static mockScraperService(scraperClass) {
    const mockScraper = {
      scrapeBills: jest.fn(),
      getBillDetails: jest.fn(),
      scrapeBillsWithDetails: jest.fn(),
      validateBillData: jest.fn(),
      extractShortTitle: jest.fn(),
      normalizeStatus: jest.fn()
    };

    scraperClass.mockImplementation(() => mockScraper);
    return mockScraper;
  }
}

/**
 * Performance testing utilities
 */
class PerformanceTestHelper {
  static async measureResponseTime(requestFunction) {
    const startTime = Date.now();
    const result = await requestFunction();
    const endTime = Date.now();
    
    return {
      result,
      responseTime: endTime - startTime
    };
  }

  static async measureMemoryUsage(operationFunction) {
    const initialMemory = process.memoryUsage();
    const result = await operationFunction();
    const finalMemory = process.memoryUsage();
    
    return {
      result,
      memoryDelta: {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external
      }
    };
  }

  static async runConcurrentRequests(requestFunction, concurrency = 10) {
    const requests = Array(concurrency).fill().map(() => requestFunction());
    const startTime = Date.now();
    const results = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    return {
      results,
      totalTime,
      averageTime: totalTime / concurrency,
      successCount: results.filter(r => r.status < 400).length,
      errorCount: results.filter(r => r.status >= 400).length
    };
  }
}

/**
 * Frontend testing utilities
 */
class FrontendTestHelper {
  static createMockDOM() {
    // Create basic DOM structure for testing
    document.body.innerHTML = `
      <div id="loading" class="hidden">Loading...</div>
      <div id="bill-grid"></div>
      <div id="no-results" class="hidden">No results</div>
      <div id="results-summary">
        <span id="results-count">0</span>
        <div id="filter-summary"></div>
      </div>
      
      <input id="search-input" type="text" />
      <select id="topics-filter" multiple></select>
      <select id="sponsors-filter" multiple></select>
      <select id="status-filter">
        <option value="">All Statuses</option>
        <option value="Filed">Filed</option>
        <option value="In Committee">In Committee</option>
        <option value="Passed">Passed</option>
      </select>
      <button id="clear-filters">Clear Filters</button>
    `;
  }

  static createBillDetailDOM() {
    document.body.innerHTML = `
      <div id="loading" class="hidden">Loading...</div>
      <div id="bill-detail-content">
        <div id="bill-header"></div>
        <div id="sponsor-info"></div>
        <div id="summary-section"></div>
        <div id="news-section"></div>
        <div id="official-link"></div>
      </div>
      <div id="error-state" class="hidden">
        <div id="error-message"></div>
      </div>
    `;
  }

  static mockGlobalObjects() {
    // Mock global objects that frontend components use
    global.fetch = jest.fn();
    global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
    global.requestIdleCallback = jest.fn(cb => setTimeout(cb, 0));

    window.cacheManager = {
      generateKey: jest.fn(() => 'cache-key'),
      get: jest.fn(() => null),
      set: jest.fn(),
      cachedFetch: jest.fn(() => null)
    };

    window.errorBoundary = {
      wrapAsync: jest.fn(fn => fn)
    };

    window.enhancedFetch = {
      fetch: global.fetch
    };

    window.loadingManager = {
      showBillGridSkeleton: jest.fn(),
      showBillDetailSkeleton: jest.fn(),
      showToast: jest.fn()
    };

    window.apiOptimizer = {
      optimizedFetch: jest.fn(),
      prefetchData: jest.fn()
    };
  }

  static cleanupGlobalObjects() {
    delete window.cacheManager;
    delete window.errorBoundary;
    delete window.enhancedFetch;
    delete window.loadingManager;
    delete window.apiOptimizer;
  }

  static simulateUserInteraction(element, eventType, eventData = {}) {
    const event = new Event(eventType, { bubbles: true });
    Object.assign(event, eventData);
    element.dispatchEvent(event);
  }
}

/**
 * Test data validation utilities
 */
class TestDataValidator {
  static validateBillStructure(bill) {
    const requiredFields = [
      'id', 'billNumber', 'shortTitle', 'fullTitle', 'status', 
      'sponsors', 'topics', 'lastUpdated'
    ];
    
    requiredFields.forEach(field => {
      expect(bill).toHaveProperty(field);
    });

    expect(Array.isArray(bill.sponsors)).toBe(true);
    expect(Array.isArray(bill.topics)).toBe(true);
    expect(['Filed', 'In Committee', 'Passed']).toContain(bill.status);
  }

  static validateNewsArticleStructure(article) {
    const requiredFields = ['headline', 'source', 'url', 'publishedAt'];
    
    requiredFields.forEach(field => {
      expect(article).toHaveProperty(field);
    });

    expect(typeof article.headline).toBe('string');
    expect(typeof article.source).toBe('string');
    expect(typeof article.url).toBe('string');
    expect(article.publishedAt instanceof Date || typeof article.publishedAt === 'string').toBe(true);
  }

  static validateSummaryStructure(summary) {
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThan(1000); // Reasonable summary length
  }
}

/**
 * Error simulation utilities
 */
class ErrorSimulator {
  static networkError() {
    return new Error('Network error: Failed to fetch');
  }

  static timeoutError() {
    const error = new Error('Request timeout');
    error.name = 'AbortError';
    return error;
  }

  static databaseError() {
    return new Error('Database connection failed');
  }

  static aiServiceError() {
    return new Error('AI service temporarily unavailable');
  }

  static newsApiError() {
    return new Error('News API rate limit exceeded');
  }

  static validationError(message = 'Validation failed') {
    const error = new Error(message);
    error.type = 'VALIDATION_ERROR';
    return error;
  }

  static async simulateIntermittentFailure(successFunction, failureRate = 0.3) {
    if (Math.random() < failureRate) {
      throw this.networkError();
    }
    return await successFunction();
  }
}

/**
 * Test environment setup utilities
 */
class TestEnvironmentHelper {
  static setupTestEnvironment() {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.NEWS_API_KEY = 'test-news-key';
    
    // Mock console methods to reduce test noise
    global.console = {
      ...console,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
  }

  static cleanupTestEnvironment() {
    // Clean up environment variables
    delete process.env.GEMINI_API_KEY;
    delete process.env.NEWS_API_KEY;
    
    // Restore console
    global.console = console;
  }

  static mockDateNow(fixedDate = new Date('2024-01-20T10:00:00Z')) {
    const originalDateNow = Date.now;
    Date.now = jest.fn(() => fixedDate.getTime());
    
    return () => {
      Date.now = originalDateNow;
    };
  }
}

module.exports = {
  MockDataGenerator,
  DatabaseMockHelper,
  ApiResponseValidator,
  ServiceMockHelper,
  PerformanceTestHelper,
  FrontendTestHelper,
  TestDataValidator,
  ErrorSimulator,
  TestEnvironmentHelper
};