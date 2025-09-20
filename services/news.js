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
   * Validate article relevance using Gemini AI
   * @param {Object} article - News article to validate
   * @param {Object} billData - Bill data for context
   * @returns {Promise<boolean>} True if article is relevant
   * @private
   */
  async validateArticleRelevance(article, billData) {
    try {
      // Initialize Gemini AI if not already done
      if (!this.genAI) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return true; // Skip validation if no API key
        
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.geminiModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }

      const prompt = `
You are analyzing whether a news article is relevant to a specific Texas legislative bill.

BILL INFORMATION:
- Bill Number: ${billData.billNumber}
- Title: ${billData.shortTitle || billData.fullTitle || 'N/A'}
- Topics: ${billData.topics ? billData.topics.join(', ') : 'N/A'}

NEWS ARTICLE:
- Headline: ${article.title}
- Description: ${article.description || 'N/A'}

TASK: Determine if this news article is specifically about or directly related to this bill or its subject matter.

CRITERIA FOR RELEVANCE:
- Article mentions the specific bill number
- Article discusses the same policy area/topic as the bill
- Article covers legislative activity related to the bill's subject
- Article discusses the bill's sponsors in context of this legislation

CRITERIA FOR IRRELEVANCE:
- General news not about legislation
- Different bills or unrelated legislative topics
- Sports, entertainment, weather, or other non-legislative content
- Articles about different policy areas

Respond with only "RELEVANT" or "NOT_RELEVANT" - no explanation needed.`;

      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim().toUpperCase();
      
      return text.includes('RELEVANT') && !text.includes('NOT_RELEVANT');
    } catch (error) {
      console.log(`⚠️ AI validation failed for article "${article.title}": ${error.message}`);
      // Fallback to basic validation if AI fails
      return this.isRelevantArticle(article, billData);
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
          
          // Process and filter articles with AI validation
          const processedArticles = await this.processArticles(articles, billData);
          
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
      // Also add variations like "SB 1" and "SB1"
      const billNum = billData.billNumber.replace(/\s+/g, '');
      if (billNum !== billData.billNumber) {
        keywords.push(billNum);
      }
    }
    
    // Extract key terms from title
    if (billData.shortTitle || billData.fullTitle) {
      const title = billData.shortTitle || billData.fullTitle;
      
      // Remove common legislative words and extract meaningful terms
      const meaningfulWords = title
        .toLowerCase()
        .replace(/\b(relating|to|an|act|bill|senate|house|texas|legislature|amending|creating|establishing|concerning|regarding)\b/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word))
        .slice(0, 4); // Increased to 4 key terms
      
      keywords.push(...meaningfulWords);
    }
    
    // Add topics if available
    if (billData.topics && Array.isArray(billData.topics)) {
      keywords.push(...billData.topics.slice(0, 3)); // Increased to 3 topics
    }
    
    // Extract keywords from abstract if available
    if (billData.abstract) {
      const abstractWords = billData.abstract
        .toLowerCase()
        .replace(/\b(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use|this|that|with|have|from|they|know|want|been|good|much|some|time|very|when|come|here|just|like|long|make|many|over|such|take|than|them|well|were)\b/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4 && !this.isCommonWord(word))
        .slice(0, 2);
      
      keywords.push(...abstractWords);
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
      
      // Try multiple search strategies with improved coverage
      const searchStrategies = [
        // Strategy 1: Exact bill number + Texas
        keywords.length > 0 ? `"${keywords[0]}" AND Texas` : null,
        
        // Strategy 2: Bill number without quotes + legislature
        keywords.length > 0 ? `${keywords[0]} AND "Texas legislature"` : null,
        
        // Strategy 3: Key topics + Texas + legislative terms
        keywords.length > 2 ? `(${keywords.slice(1, 4).join(' OR ')}) AND Texas AND (bill OR legislation OR senate OR house OR law)` : null,
        
        // Strategy 4: Broader topic search with Texas government
        keywords.length > 1 ? `${keywords.slice(1, 3).join(' ')} AND "Texas" AND (government OR policy OR legislature)` : null,
        
        // Strategy 5: Topic-based search without bill numbers
        keywords.length > 3 ? `(${keywords.slice(3, 6).join(' OR ')}) AND Texas` : null,
        
        // Strategy 6: Very broad Texas legislature search
        'Texas legislature AND (bill OR senate OR house OR law OR policy)'
      ].filter(Boolean);
      
      console.log('🔍 Trying search strategies:', searchStrategies);
      
      for (const query of searchStrategies) {
        console.log(`🔎 Searching with query: "${query}"`);
        
        if (query.length > 500) {
          console.log('⚠️ Query too long, skipping');
          continue;
        }
        
        // Search for articles from the last 30 days (News API free plan limit)
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 29); // Stay within free plan limits
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
          const response = await this.newsapi.v2.everything({
            q: query,
            language: 'en',
            sortBy: 'relevancy',
            pageSize: 20, // Get more articles to filter
            from: fromDate.toISOString().split('T')[0],
            // Remove domain restriction to get more results
            // domains: 'texastribune.org,statesman.com,dallasnews.com,houstonchronicle.com,expressnews.com,star-telegram.com'
          });
          
          clearTimeout(timeoutId);
          
          if (response.status === 'ok' && response.articles && response.articles.length > 0) {
            console.log(`✅ Found ${response.articles.length} articles with strategy: "${query}"`);
            return response.articles;
          } else {
            console.log(`❌ No articles found with strategy: "${query}"`);
          }
        } catch (apiError) {
          clearTimeout(timeoutId);
          console.log(`❌ API error with strategy "${query}":`, apiError.message);
          
          if (apiError.name === 'AbortError') {
            throw new AppError('News API request timeout', 'TIMEOUT');
          }
          // Continue to next strategy for other errors
        }
        
        // Rate limit between strategies
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If no strategy worked, return empty array
      console.log('❌ All search strategies failed');
      return [];
      
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
   * Process and filter articles for relevance using AI validation
   * @private
   */
  async processArticles(articles, billData) {
    if (!articles || articles.length === 0) {
      return [];
    }
    
    const relevantArticles = [];
    
    // First pass: basic filtering
    const basicFiltered = articles.filter(article => this.isRelevantArticle(article, billData));
    
    // Second pass: AI validation for better accuracy
    for (const article of basicFiltered.slice(0, this.maxArticles * 2)) { // Check more than we need
      const isRelevant = await this.validateArticleRelevance(article, billData);
      
      if (isRelevant) {
        relevantArticles.push({
          headline: article.title,
          source: article.source?.name || 'Unknown Source',
          url: article.url,
          publishedAt: new Date(article.publishedAt),
          description: article.description,
          urlToImage: article.urlToImage
        });
        
        // Stop when we have enough relevant articles
        if (relevantArticles.length >= this.maxArticles) {
          break;
        }
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return relevantArticles;
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
    const irrelevantKeywords = ['sports', 'weather', 'entertainment', 'celebrity', 'movie', 'music', 'recipe', 'fashion', 'obituary', 'wedding'];
    const title = article.title.toLowerCase();
    const description = (article.description || '').toLowerCase();
    const content = title + ' ' + description;
    
    if (irrelevantKeywords.some(keyword => content.includes(keyword))) {
      return false;
    }
    
    // Check if article mentions bill number or key terms
    const billNumber = billData.billNumber?.toLowerCase();
    
    if (billNumber && content.includes(billNumber)) {
      return true; // High relevance if bill number is mentioned
    }
    
    // More lenient legislative keywords check
    const legislativeKeywords = ['bill', 'legislation', 'senate', 'house', 'legislature', 'law', 'policy', 'government', 'texas', 'capitol', 'lawmaker', 'representative', 'senator', 'committee', 'vote', 'passed', 'filed'];
    const hasLegislativeContent = legislativeKeywords.some(keyword => content.includes(keyword));
    
    // Check for topic relevance (more lenient)
    if (billData.topics && Array.isArray(billData.topics)) {
      const hasTopicMatch = billData.topics.some(topic => 
        content.includes(topic.toLowerCase())
      );
      if (hasTopicMatch && hasLegislativeContent) {
        return true;
      }
    }
    
    // Check for title keywords (more lenient)
    if (billData.shortTitle || billData.fullTitle) {
      const titleWords = (billData.shortTitle || billData.fullTitle)
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word));
      
      const hasTitleMatch = titleWords.some(word => content.includes(word));
      if (hasTitleMatch && hasLegislativeContent) {
        return true;
      }
    }
    
    // If it has strong legislative content, include it even without specific matches
    const strongLegislativeKeywords = ['texas legislature', 'texas senate', 'texas house', 'state capitol', 'austin legislature'];
    const hasStrongLegislativeContent = strongLegislativeKeywords.some(keyword => content.includes(keyword));
    
    if (hasStrongLegislativeContent) {
      return true;
    }
    
    // More lenient check - if it mentions Texas and has any legislative context
    return content.includes('texas') && hasLegislativeContent;
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

      // Try Firebase cache only if database is connected
      if (databaseService.isConnected) {
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
      // Always add to memory cache
      this.cache.set(billId, {
        articles,
        timestamp: Date.now()
      });
      
      // Try Firebase cache only if database is connected
      if (databaseService.isConnected) {
        const db = databaseService.getDb();
        const newsRef = db.collection('news_cache').doc(billId);
        
        const cacheData = {
          billId,
          articles,
          lastFetched: new Date(),
          articleCount: articles.length
        };
        
        await newsRef.set(cacheData);
        console.log(`💾 Cached ${articles.length} news articles for bill ${billId} in Firebase`);
      } else {
        console.log(`💾 Cached ${articles.length} news articles for bill ${billId} in memory only`);
      }
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