const { SummaryService } = require('../../services/ai-summary');
const { databaseService } = require('../../config/database');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../../backend/middleware/error-handler');

// Mock the Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn()
    })
  }))
}));

// Mock the database service
jest.mock('../../config/database', () => ({
  databaseService: {
    getDb: jest.fn()
  }
}));

// Mock error handling middleware
jest.mock('../../backend/middleware/error-handler', () => ({
  AppError: jest.fn().mockImplementation((message, type) => {
    const error = new Error(message);
    error.type = type;
    return error;
  }),
  retryManager: {
    executeWithRetry: jest.fn()
  },
  fallbackManager: {
    setFallback: jest.fn(),
    getFallback: jest.fn()
  },
  circuitBreakers: {
    aiService: {
      execute: jest.fn()
    }
  }
}));

describe('SummaryService', () => {
  let summaryService;
  let mockModel;
  let mockDb;

  beforeEach(() => {
    // Reset environment
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    // Create fresh service instance
    summaryService = new SummaryService();
    
    // Setup mocks
    mockModel = {
      generateContent: jest.fn()
    };
    
    mockDb = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn(),
          set: jest.fn()
        })
      })
    };
    
    databaseService.getDb.mockReturnValue(mockDb);
    
    // Mock the model
    summaryService.model = mockModel;
    summaryService.isInitialized = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid API key', async () => {
      const service = new SummaryService();
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(service.isInitialized).toBe(true);
    });

    it('should fail initialization without API key', async () => {
      delete process.env.GEMINI_API_KEY;
      const service = new SummaryService();
      
      await expect(service.initialize()).rejects.toThrow('GEMINI_API_KEY environment variable is required');
    });
  });

  describe('generateSummary', () => {
    const mockBillText = 'This is a sample bill about healthcare reform that aims to improve access to medical services.';
    const mockBillId = 'SB123';

    beforeEach(() => {
      // Mock circuit breaker and retry manager to pass through
      circuitBreakers.aiService.execute.mockImplementation(async (fn) => await fn());
      retryManager.executeWithRetry.mockImplementation(async (fn) => await fn());
    });

    it('should generate high-level summary successfully', async () => {
      const mockSummary = 'This bill improves healthcare access for all citizens.';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockSummary
        }
      });

      // Mock no cached summary
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const result = await summaryService.generateSummary(mockBillId, mockBillText, 'high-level');
      
      expect(result).toBe(mockSummary);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Provide a 2-3 sentence summary in simple, everyday language')
      );
    });

    it('should generate detailed summary successfully', async () => {
      const mockSummary = 'This comprehensive healthcare bill establishes new frameworks for medical access, includes provisions for rural healthcare, and allocates funding for community health centers.';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockSummary
        }
      });

      // Mock no cached summary
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const result = await summaryService.generateSummary(mockBillId, mockBillText, 'detailed');
      
      expect(result).toBe(mockSummary);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Provide a comprehensive 4-5 sentence summary')
      );
    });

    it('should return cached summary when available', async () => {
      const cachedSummary = 'Cached healthcare summary';
      
      // Mock cached summary exists
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          summaries: {
            'high-level': cachedSummary
          }
        })
      });

      const result = await summaryService.generateSummary(mockBillId, mockBillText, 'high-level');
      
      expect(result).toBe(cachedSummary);
      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should handle API failures gracefully with fallback', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));
      
      // Mock no cached summary
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const result = await summaryService.generateSummary(mockBillId, mockBillText, 'high-level');
      
      expect(result).toContain('This is a sample bill about healthcare reform');
      expect(result).toMatch(/\.$/); // Should end with period
    });

    it('should validate required parameters', async () => {
      await expect(summaryService.generateSummary('', mockBillText)).rejects.toThrow('Bill ID and text are required');
      await expect(summaryService.generateSummary(mockBillId, '')).rejects.toThrow('Bill ID and text are required');
    });

    it('should validate reading level', async () => {
      await expect(summaryService.generateSummary(mockBillId, mockBillText, 'invalid')).rejects.toThrow('Invalid reading level: invalid');
    });

    it('should truncate long summaries', async () => {
      const longSummary = 'A'.repeat(500); // Longer than high-level max (200)
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => longSummary
        }
      });

      // Mock no cached summary
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const result = await summaryService.generateSummary(mockBillId, mockBillText, 'high-level');
      
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).toMatch(/\.\.\.$/); // Should end with ellipsis
    });
  });

  describe('classifyTopics', () => {
    it('should classify bill topics successfully', async () => {
      const mockTopicsResponse = 'Healthcare, Public Safety, Finance';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockTopicsResponse
        }
      });

      const result = await summaryService.classifyTopics('Bill about healthcare and safety');
      
      expect(result).toEqual(['Healthcare', 'Public Safety', 'Finance']);
    });

    it('should handle classification failures with fallback', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Classification failed'));
      
      const result = await summaryService.classifyTopics('Some bill text');
      
      expect(result).toEqual(['General']);
    });

    it('should limit topics to maximum of 4', async () => {
      const mockTopicsResponse = 'Healthcare, Education, Transportation, Criminal Justice, Environment, Business';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockTopicsResponse
        }
      });

      const result = await summaryService.classifyTopics('Complex bill text');
      
      expect(result.length).toBeLessThanOrEqual(4);
    });
  });

  describe('caching', () => {
    it('should cache summaries in Firebase', async () => {
      const mockSummary = 'Test summary';
      const mockBillId = 'SB123';
      
      const mockDocRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue()
      };
      
      mockDb.collection().doc.mockReturnValue(mockDocRef);
      
      await summaryService.cacheSummary(mockBillId, 'high-level', mockSummary);
      
      expect(mockDocRef.set).toHaveBeenCalledWith({
        billId: mockBillId,
        summaries: {
          'high-level': mockSummary
        },
        generatedAt: expect.any(Date),
        cached: true
      });
    });

    it('should use memory cache for repeated requests', async () => {
      const mockSummary = 'Cached summary';
      const mockBillId = 'SB123';
      
      // Add to memory cache
      summaryService.cache.set(`${mockBillId}_high-level`, mockSummary);
      
      const result = await summaryService.getCachedSummary(mockBillId, 'high-level');
      
      expect(result).toBe(mockSummary);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it('should clear cache correctly', () => {
      summaryService.cache.set('SB123_high-level', 'summary1');
      summaryService.cache.set('SB123_detailed', 'summary2');
      summaryService.cache.set('SB456_high-level', 'summary3');
      
      summaryService.clearCache('SB123');
      
      expect(summaryService.cache.has('SB123_high-level')).toBe(false);
      expect(summaryService.cache.has('SB123_detailed')).toBe(false);
      expect(summaryService.cache.has('SB456_high-level')).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should return reading levels configuration', () => {
      const levels = summaryService.getReadingLevels();
      
      expect(levels).toHaveProperty('high-level');
      expect(levels).toHaveProperty('detailed');
      expect(levels['high-level']).toHaveProperty('name');
      expect(levels['high-level']).toHaveProperty('maxLength');
    });

    it('should return service status', () => {
      const status = summaryService.getStatus();
      
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('readingLevels');
      expect(status).toHaveProperty('apiKeyConfigured');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      databaseService.getDb.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await summaryService.getCachedSummary('SB123', 'high-level');
      
      expect(result).toBeNull();
    });

    it('should handle caching errors without breaking main flow', async () => {
      const mockDocRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockRejectedValue(new Error('Cache write failed'))
      };
      
      mockDb.collection().doc.mockReturnValue(mockDocRef);
      
      // Should not throw error
      await expect(summaryService.cacheSummary('SB123', 'high-level', 'summary')).resolves.toBeUndefined();
    });
  });
});