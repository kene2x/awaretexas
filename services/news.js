const NewsAPI = require('newsapi');
const { databaseService } = require('../config/database');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../backend/middleware/error-handler');

/**
 * NewsService - Handles news article fetching using News API
 * 
 * Features:
 * - Search for relevant articles by bill keywords
 * - Cache news articles to avoid repeated API calls
 * - Error handling for News API failures and rate limits
 * - Intelligent keyword extraction from bill data
 */
class NewsService {
  constructor() {
    this.newsapi = null;
    this.isInitialized = false;
    this.cache = new Map(); // In-memory cache for frequently accessed news
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Rate limiting configuration
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
    this.maxArticles = 5; // Maximum articles to return per bill
  }

  /**
   * Initialize the News API service
   */
  async initialize() {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        throw new Error('NEWS_API_KEY environment variable is required');
      }

      this.newsapi = new NewsAPI(apiKey);
      this.isInitialized = true;
      
      console.log('✅ News API service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize News API service:', error.message);
      this.isInitialized = false;
      throw new Error(`News service initialization failed: ${error.message}`);
    }
  }

  /**
   * Fetch relevant news articles for a bill with comprehensive error handling
   * @param {string} billId - Unique bill identifier
   * @param {Object} billData - Bill data containing title, keywords, etc.
   * @returns {Promise<Array>} Array of news articles
   */
  async getNewsForBill(billId, billData) {
    if (!billId || !billData) {
      throw new AppError('Bill ID and data are required', 'VALIDATION_ERROR');
    }

    const operationKey = `news-${billId}`;

    try {
      // Check cache first
      const cachedNews = await this.getCachedNews(billId);
      if (cachedNews) {
        console.log(`📰 Using cached news for bill ${billId}`);
        return cachedNews;
      }

      // Use circuit breaker for news service
      return await circuitBreakers.newsService.execute(async () => {
        return await retryManager.executeWithRetry(async () => {
          // Ensure service is initialized
          if (!this.isInitialized) {
            await this.initialize();
          }

          // Extract keywords from bill data
          const keywords = this.extractKeywords(billData);
          
          console.log(`🔍 Searching news for bill ${billId} with keywords: ${keywords.join(', ')}`);
          
          // Fetch news articles
          const articles = await this._searchNews(keywords);
          
          // Process and filter articles
          const processedArticles = this.processArticles(articles, billData);
          
          // Cache the results
          await this.cacheNews(billId, processedArticles);
          
          // Store as fallback for future failures
          fallbackManager.setFallback(`news-${billId}`, processedArticles);
          
          return processedArticles;
        }, operationKey, {
          maxRetries: 2,
          baseDelay: 3000,
          retryCondition: (error) => {
            return error.type === 'NETWORK_ERROR' || 
                   error.type === 'TIMEOUT' ||
                   error.message.includes('rate limit') ||
                   error.message.includes('503');
          }
        });
      });
    } catch (error) {
      console.error(`❌ Failed to fetch news for bill ${billId}:`, error.message);
      
      // Try fallback from cache
      const fallbackNews = fallbackManager.getFallback(`news-${billId}`);
      if (fallbackNews) {
        console.log(`Using fallback news for bill ${billId}`);
        return fallbackNews.map(article => ({
          ...article,
          isStale: true,
          fallbackMessage: 'This news data may be outdated due to service issues'
        }));
      }
      
      // Return fallback news with error info
      return this._getFallbackNews(error.message);
    }
  }

  /**
   * Extract relevant keywords from bill data
   * @private
   */
  extractKeywords(billData) {
    const keywords = [];
    
    // Add bill number (most specific)
    if (billData.billNumber) {
      keywords.push(billData.billNumber);
    }
    
    // Extract key terms from title
    if (billData.shortTitle || billData.fullTitle) {
      const title = billData.shortTitle || billData.fullTitle;
      
      // Remove common legislative words and extract meaningful terms
      const meaningfulWords = title
        .toLowerCase()
        .replace(/\b(relating|to|an|act|bill|senate|house|texas|legislature|amending|creating|establishing)\b/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word))
        .slice(0, 3); // Limit to 3 key terms
      
      keywords.push(...meaningfulWords);
    }
    
    // Add topics if available
    if (billData.topics && Array.isArray(billData.topics)) {
      keywords.push(...billData.topics.slice(0, 2)); // Limit to 2 topics
    }
    
    // Add "Texas" to make results more relevant
    keywords.push('Texas');
    
    return keywords.filter(k => k && k.length > 0);
  }

  /**
   * Check if a word is too common to be useful for search
   * @private
   */
  isCommonWord(word) {
    const commonWords = [
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    ];
    return commonWords.includes(word.toLowerCase());
  }

  /**
   * Search for news articles using News API with enhanced error handling
   * @private
   */
  async _searchNews(keywords) {
    try {
      // Implement rate limiting
      await this._enforceRateLimit();
      
      // Build search query
      const query = keywords.join(' OR ');
      
      if (query.length > 500) {
        throw new AppError('Search query too long', 'VALIDATION_ERROR');
      }
      
      // Search for articles from the last 30 days
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const response = await this.newsapi.v2.everything({
          q: query,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: this.maxArticles * 2, // Get more to filter later
          from: fromDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
          domains: 'texastribune.org,statesman.com,dallasnews.com,houstonchronicle.com,expressnews.com,star-telegram.com' // Texas news sources
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 'ok') {
          return response.articles || [];
        } else {
          throw new AppError(`News API error: ${response.message || 'Unknown error'}`, 'NEWS_SERVICE_ERROR');
        }
      } catch (apiError) {
        clearTimeout(timeoutId);
        
        if (apiError.name === 'AbortError') {
          throw new AppError('News API request timeout', 'TIMEOUT');
        } else {
          throw apiError;
        }
      }
    } catch (error) {
      console.error('News API search failed:', error.message);
      
      // Handle specific error types
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new AppError('News API rate limit exceeded', 'RATE_LIMIT');
      } else if (error.message.includes('API key') || error.message.includes('401')) {
        throw new AppError('News API authentication failed', 'NEWS_SERVICE_ERROR');
      } else if (error.message.includes('quota') || error.message.includes('402')) {
        throw new AppError('News API quota exceeded', 'RATE_LIMIT');
      } else if (error.message.includes('503') || error.message.includes('502')) {
        throw new AppError('News API temporarily unavailable', 'SERVICE_UNAVAILABLE');
      } else if (error.type) {
        throw error; // Re-throw AppError instances
      } else {
        throw new AppError(`News search failed: ${error.message}`, 'NEWS_SERVICE_ERROR');
      }
    }
  }

  /**
   * Enforce rate limiting between API calls
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Process and filter articles for relevance
   * @private
   */
  processArticles(articles, billData) {
    if (!articles || articles.length === 0) {
      return [];
    }
    
    return articles
      .filter(article => this.isRelevantArticle(article, billData))
      .slice(0, this.maxArticles)
      .map(article => ({
        headline: article.title,
        source: article.source?.name || 'Unknown Source',
        url: article.url,
        publishedAt: new Date(article.publishedAt),
        description: article.description,
        urlToImage: article.urlToImage
      }));
  }

  /**
   * Check if an article is relevant to the bill
   * @private
   */
  isRelevantArticle(article, billData) {
    if (!article.title || !article.url) {
      return false;
    }
    
    // Filter out articles that are clearly not about legislation
    const irrelevantKeywords = ['sports', 'weather', 'entertainment', 'celebrity', 'movie', 'music'];
    const title = article.title.toLowerCase();
    
    if (irrelevantKeywords.some(keyword => title.includes(keyword))) {
      return false;
    }
    
    // Check if article mentions bill number or key terms
    const billNumber = billData.billNumber?.toLowerCase();
    const content = (article.title + ' ' + (article.description || '')).toLowerCase();
    
    if (billNumber && content.includes(billNumber)) {
      return true; // High relevance if bill number is mentioned
    }
    
    // Check for topic relevance
    if (billData.topics && Array.isArray(billData.topics)) {
      const hasTopicMatch = billData.topics.some(topic => 
        content.includes(topic.toLowerCase())
      );
      if (hasTopicMatch) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get cached news from Firebase
   * @private
   */
  async getCachedNews(billId) {
    try {
      // Check in-memory cache first
      if (this.cache.has(billId)) {
        const cached = this.cache.get(billId);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.articles;
        } else {
          this.cache.delete(billId); // Remove expired cache
        }
      }

      // Check Firebase cache
      const db = databaseService.getDb();
      const newsDoc = await db.collection('news_cache').doc(billId).get();
      
      if (newsDoc.exists) {
        const data = newsDoc.data();
        const cacheAge = Date.now() - data.lastFetched.toMillis();
        
        if (cacheAge < this.cacheExpiry) {
          // Add to memory cache
          this.cache.set(billId, {
            articles: data.articles,
            timestamp: data.lastFetched.toMillis()
          });
          return data.articles;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to retrieve cached news:', error.message);
      return null;
    }
  }

  /**
   * Cache news articles in Firebase and memory
   * @private
   */
  async cacheNews(billId, articles) {
    try {
      const db = databaseService.getDb();
      const newsRef = db.collection('news_cache').doc(billId);
      
      const cacheData = {
        billId,
        articles,
        lastFetched: new Date(),
        articleCount: articles.length
      };
      
      await newsRef.set(cacheData);
      
      // Add to memory cache
      this.cache.set(billId, {
        articles,
        timestamp: Date.now()
      });
      
      console.log(`💾 Cached ${articles.length} news articles for bill ${billId}`);
    } catch (error) {
      console.error('Failed to cache news:', error.message);
      // Don't throw - caching failure shouldn't break the main flow
    }
  }

  /**
   * Generate fallback response when news fetching fails
   * @private
   */
  _getFallbackNews(errorMessage) {
    return [{
      headline: 'News articles temporarily unavailable',
      source: 'System',
      url: '#',
      publishedAt: new Date(),
      description: `Unable to fetch news articles at this time: ${errorMessage}`,
      urlToImage: null,
      isError: true
    }];
  }

  /**
   * Clear cache for a specific bill or all bills
   * @param {string} billId - Optional bill ID to clear specific cache
   */
  clearCache(billId = null) {
    if (billId) {
      this.cache.delete(billId);
      console.log(`🗑️ Cleared news cache for bill ${billId}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Cleared all news cache');
    }
  }

  /**
   * Get service status and statistics
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      maxArticles: this.maxArticles,
      cacheExpiry: this.cacheExpiry,
      rateLimitDelay: this.rateLimitDelay,
      apiKeyConfigured: !!process.env.NEWS_API_KEY
    };
  }

  /**
   * Test the News API connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test with a simple query
      await this._enforceRateLimit();
      const response = await this.newsapi.v2.everything({
        q: 'Texas',
        pageSize: 1,
        language: 'en'
      });

      return response.status === 'ok';
    } catch (error) {
      console.error('News API connection test failed:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const newsService = new NewsService();

module.exports = { NewsService, newsService };