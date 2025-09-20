const { GoogleGenerativeAI } = require('@google/generative-ai');
const { databaseService } = require('../config/database');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../backend/middleware/error-handler');

/**
 * SummaryService - Handles AI-powered bill summaries using Google Gemini API
 * 
 * Features:
 * - Generate plain-language summaries in multiple reading levels
 * - Cache summaries in Firebase to avoid repeated API calls
 * - Auto-classify bill topics for filtering
 * - Error handling with graceful fallbacks
 */
class SummaryService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
    this.cache = new Map(); // In-memory cache for frequently accessed summaries
    
    // Reading level configurations
    this.readingLevels = {
      'high-level': {
        name: 'High-Level Overview',
        prompt: `You are a legislative analyst explaining a Texas bill to a general audience. Create a clear, concise summary that explains what this bill actually does in plain English.

Your summary should:
- Be exactly 2-3 complete sentences
- Use simple, everyday language (no legal jargon)
- Explain the bill's main purpose and what it would change
- Mention who would be affected (citizens, businesses, government, etc.)
- Focus on practical impact, not technical details
- End with a complete sentence (no ellipsis or truncation)

Write as if you're explaining it to a friend who asked "What does this bill do?" 

IMPORTANT: Write complete sentences only. Do not use ellipsis (...) or cut off mid-sentence. If you need to be brief, use fewer complete sentences rather than incomplete ones.`,
        maxLength: 250
      },
      'detailed': {
        name: 'Detailed Analysis',
        prompt: `You are a legislative analyst providing a comprehensive explanation of a Texas bill for an informed audience.

Your analysis should be exactly 3-4 complete sentences and include:
- The bill's main purpose and key provisions
- Specific changes it would make to current law or policy
- Who would be affected and how (individuals, businesses, agencies)
- Any important implementation details, timelines, or funding aspects
- Potential benefits or concerns if clearly evident

Use clear, professional language that's accessible but more detailed than a basic summary. 

IMPORTANT: Write only complete sentences. Do not use ellipsis (...) or cut off mid-sentence. If you need to be concise, use fewer complete sentences rather than incomplete ones.`,
        maxLength: 500
      }
    };
  }

  /**
   * Initialize the Gemini AI service
   */
  async initialize() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      this.isInitialized = true;
      
      console.log('✅ Gemini AI service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI service:', error.message);
      this.isInitialized = false;
      throw new Error(`AI service initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate or retrieve cached summary for a bill with comprehensive error handling
   * @param {string} billId - Unique bill identifier
   * @param {string} billText - Full text of the bill
   * @param {string} readingLevel - 'high-level' or 'detailed'
   * @returns {Promise<string>} Generated summary
   */
  async generateSummary(billId, billText, readingLevel = 'high-level') {
    // Validate inputs first
    if (!billId || !billText) {
      throw new AppError('Bill ID and text are required', 'VALIDATION_ERROR');
    }

    if (!this.readingLevels[readingLevel]) {
      throw new AppError(`Invalid reading level: ${readingLevel}`, 'VALIDATION_ERROR');
    }

    const operationKey = `summary-${billId}-${readingLevel}`;

    try {
      // Check cache first
      const cachedSummary = await this.getCachedSummary(billId, readingLevel);
      if (cachedSummary) {
        console.log(`📋 Using cached summary for bill ${billId} (${readingLevel})`);
        return cachedSummary;
      }

      // Use circuit breaker for AI service
      return await circuitBreakers.aiService.execute(async () => {
        return await retryManager.executeWithRetry(async () => {
          // Ensure AI service is initialized
          if (!this.isInitialized) {
            await this.initialize();
          }

          console.log(`🤖 Generating ${readingLevel} summary for bill ${billId}...`);
          
          // Always generate a new AI summary, don't just return the bill text
          const summary = await this._callGeminiAPI(billText, readingLevel);
          
          // Cache the result
          await this.cacheSummary(billId, readingLevel, summary);
          
          // Store as fallback for future failures
          fallbackManager.setFallback(`summary-${billId}-${readingLevel}`, summary);
          
          return summary;
        }, operationKey, {
          maxRetries: 3,
          baseDelay: 2000,
          retryCondition: (error) => {
            return error.type === 'NETWORK_ERROR' || 
                   error.type === 'TIMEOUT' ||
                   error.message.includes('rate limit') ||
                   error.message.includes('quota') ||
                   error.message.includes('503');
          }
        });
      });
    } catch (error) {
      console.error(`❌ Failed to generate summary for bill ${billId}:`, error.message);
      
      // Try fallback from cache
      const fallbackSummary = fallbackManager.getFallback(`summary-${billId}-${readingLevel}`);
      if (fallbackSummary) {
        console.log(`Using fallback summary for bill ${billId}`);
        return `${fallbackSummary} [Note: This summary may be outdated due to AI service issues]`;
      }
      
      // Generate basic fallback summary
      return this._getFallbackSummary(billText, readingLevel);
    }
  }

  /**
   * Call Gemini API to generate summary with enhanced error handling
   * @private
   */
  async _callGeminiAPI(billText, readingLevel) {
    const config = this.readingLevels[readingLevel];
    
    // Truncate bill text if too long (Gemini has input limits)
    const maxInputLength = 30000; // Conservative limit
    const truncatedText = billText.length > maxInputLength 
      ? billText.substring(0, maxInputLength) + '...[truncated]'
      : billText;

    const prompt = `
${config.prompt}

Bill Text:
${truncatedText}

Summary (${config.maxLength} characters max):`;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    let timeoutId;
    
    try {
      timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const result = await this.model.generateContent(prompt);
      clearTimeout(timeoutId);
      
      const response = await result.response;
      
      if (!response) {
        throw new AppError('Empty response from Gemini API', 'AI_SERVICE_ERROR');
      }
      
      const summary = response.text().trim();
      
      if (!summary || summary.length < 10) {
        throw new AppError('Invalid summary generated by AI', 'AI_SERVICE_ERROR');
      }
      
      // Clean up the summary and handle length properly
      let cleanedSummary = summary.trim();
      
      // Remove any trailing ellipsis that might have been added by the AI
      cleanedSummary = cleanedSummary.replace(/\.{3,}$/, '').replace(/…$/, '');
      
      // Handle length constraints more intelligently
      if (cleanedSummary.length > config.maxLength) {
        // Find the last complete sentence within a reasonable range
        const targetLength = config.maxLength - 50; // Leave some buffer
        const truncated = cleanedSummary.substring(0, targetLength);
        
        // Look for sentence endings
        const lastSentenceEnd = Math.max(
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf('!'),
          truncated.lastIndexOf('?')
        );
        
        if (lastSentenceEnd > targetLength * 0.6) {
          // Use the last complete sentence
          cleanedSummary = cleanedSummary.substring(0, lastSentenceEnd + 1);
        } else {
          // Find the last word boundary and add proper ending
          const lastSpace = truncated.lastIndexOf(' ');
          if (lastSpace > targetLength * 0.8) {
            cleanedSummary = cleanedSummary.substring(0, lastSpace).trim() + '.';
          } else {
            // As last resort, truncate at word boundary
            cleanedSummary = truncated.trim() + '.';
          }
        }
      }
      
      // Ensure proper sentence ending
      if (!cleanedSummary.endsWith('.') && !cleanedSummary.endsWith('!') && !cleanedSummary.endsWith('?')) {
        cleanedSummary += '.';
      }
      
      return cleanedSummary;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Gemini API call failed:', error.message);
      
      // Handle specific API errors
      if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new AppError('AI service quota exceeded', 'RATE_LIMIT');
      } else if (error.message.includes('timeout') || error.name === 'AbortError') {
        throw new AppError('AI service request timeout', 'TIMEOUT');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        throw new AppError('AI service authentication failed', 'AI_SERVICE_ERROR');
      } else if (error.message.includes('503') || error.message.includes('502')) {
        throw new AppError('AI service temporarily unavailable', 'SERVICE_UNAVAILABLE');
      } else {
        throw new AppError(`AI generation failed: ${error.message}`, 'AI_SERVICE_ERROR');
      }
    }
  }

  /**
   * Get cached summary from Firebase
   * @private
   */
  async getCachedSummary(billId, readingLevel) {
    try {
      // Check in-memory cache first
      const memoryKey = `${billId}_${readingLevel}`;
      if (this.cache.has(memoryKey)) {
        return this.cache.get(memoryKey);
      }

      // Check Firebase cache
      const db = databaseService.getDb();
      const summaryDoc = await db.collection('summaries').doc(billId).get();
      
      if (summaryDoc.exists) {
        const data = summaryDoc.data();
        const summary = data.summaries?.[readingLevel];
        
        if (summary) {
          // Add to memory cache
          this.cache.set(memoryKey, summary);
          return summary;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to retrieve cached summary:', error.message);
      return null;
    }
  }

  /**
   * Cache summary in Firebase and memory
   * @private
   */
  async cacheSummary(billId, readingLevel, summary) {
    try {
      const db = databaseService.getDb();
      const summaryRef = db.collection('summaries').doc(billId);
      
      // Get existing document or create new one
      const existingDoc = await summaryRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};
      
      // Update with new summary
      const updatedData = {
        ...existingData,
        billId,
        summaries: {
          ...existingData.summaries,
          [readingLevel]: summary
        },
        generatedAt: new Date(),
        cached: true
      };
      
      await summaryRef.set(updatedData);
      
      // Add to memory cache
      const memoryKey = `${billId}_${readingLevel}`;
      this.cache.set(memoryKey, summary);
      
      console.log(`💾 Cached ${readingLevel} summary for bill ${billId}`);
    } catch (error) {
      console.error('Failed to cache summary:', error.message);
      // Don't throw - caching failure shouldn't break the main flow
    }
  }

  /**
   * Generate fallback summary when AI fails
   * @private
   */
  _getFallbackSummary(billText, readingLevel) {
    const isDetailed = readingLevel === 'detailed';
    
    // Extract first few sentences as fallback
    const sentences = billText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const numSentences = isDetailed ? 3 : 2;
    const fallback = sentences.slice(0, numSentences).join('. ').trim();
    
    if (fallback.length > 0) {
      return fallback + (fallback.endsWith('.') ? '' : '.');
    }
    
    return isDetailed 
      ? 'This bill contains legislative text that requires review. Please refer to the official bill text for complete details.'
      : 'Summary unavailable. Please refer to the official bill text.';
  }

  /**
   * Auto-classify bill topics using AI
   * @param {string} billText - Full text of the bill
   * @returns {Promise<string[]>} Array of topic tags
   */
  async classifyTopics(billText) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const prompt = `
Analyze this Texas Senate bill and classify it into relevant topic categories. 
Return only a comma-separated list of 2-4 most relevant topics from these categories:
Healthcare, Education, Transportation, Criminal Justice, Environment, Business, Agriculture, 
Technology, Finance, Government Operations, Civil Rights, Public Safety, Energy, Housing

Bill Text:
${billText.substring(0, 10000)}

Topics (comma-separated):`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const topicsText = response.text().trim();
      
      // Parse and clean topics
      const topics = topicsText
        .split(',')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 4); // Limit to 4 topics max
      
      return topics;
    } catch (error) {
      console.error('Failed to classify topics:', error.message);
      return ['General']; // Fallback topic
    }
  }

  /**
   * Get available reading levels
   * @returns {Object} Reading level configurations
   */
  getReadingLevels() {
    return Object.keys(this.readingLevels).reduce((levels, key) => {
      levels[key] = {
        name: this.readingLevels[key].name,
        maxLength: this.readingLevels[key].maxLength
      };
      return levels;
    }, {});
  }

  /**
   * Clear cache for a specific bill or all bills
   * @param {string} billId - Optional bill ID to clear specific cache
   */
  async clearCache(billId = null) {
    if (billId) {
      // Clear specific bill from memory cache
      for (const level of Object.keys(this.readingLevels)) {
        this.cache.delete(`${billId}_${level}`);
      }
      
      // Also clear from Firebase cache
      try {
        const db = databaseService.getDb();
        await db.collection('summaries').doc(billId).delete();
        console.log(`🗑️ Cleared Firebase cache for bill ${billId}`);
      } catch (error) {
        console.log(`⚠️ Could not clear Firebase cache for ${billId}: ${error.message}`);
      }
      
      console.log(`🗑️ Cleared all caches for bill ${billId}`);
    } else {
      // Clear all memory cache
      this.cache.clear();
      console.log('🗑️ Cleared all summary cache');
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
      readingLevels: Object.keys(this.readingLevels),
      apiKeyConfigured: !!process.env.GEMINI_API_KEY
    };
  }
}

// Create singleton instance
const summaryService = new SummaryService();

module.exports = { SummaryService, summaryService };