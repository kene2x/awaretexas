/**
 * @typedef {Object} SummaryData
 * @property {string} billId - ID of the associated bill
 * @property {Object} summaries - Summary content by reading level
 * @property {string} summaries.high-level - High-level summary
 * @property {string} summaries.detailed - Detailed summary
 * @property {Date} generatedAt - When the summary was generated
 * @property {boolean} cached - Whether this is cached content
 */

/**
 * @typedef {Object} NewsArticle
 * @property {string} headline - Article headline
 * @property {string} source - News source name
 * @property {string} url - Article URL
 * @property {Date} publishedAt - Publication date
 */

/**
 * @typedef {Object} NewsData
 * @property {string} billId - ID of the associated bill
 * @property {NewsArticle[]} articles - Array of news articles
 * @property {Date} lastFetched - When news was last fetched
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - Response data if successful
 * @property {string} [message] - Success or error message
 * @property {string} [error] - Error details if failed
 * @property {number} timestamp - Response timestamp
 */

/**
 * @typedef {Object} FilterOptions
 * @property {string} [keyword] - Search keyword
 * @property {string[]} [topics] - Selected topic filters
 * @property {string[]} [sponsors] - Selected sponsor filters
 * @property {string[]} [statuses] - Selected status filters
 */

/**
 * Data validation utilities
 */
class DataValidator {
  /**
   * Validate summary data structure
   * @param {SummaryData} data - Summary data to validate
   * @returns {Object} Validation result
   */
  static validateSummaryData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Summary data must be an object');
      return { isValid: false, errors };
    }

    if (!data.billId || typeof data.billId !== 'string') {
      errors.push('Bill ID is required and must be a string');
    }

    if (!data.summaries || typeof data.summaries !== 'object') {
      errors.push('Summaries object is required');
    } else {
      const requiredLevels = ['high-level', 'detailed'];
      for (const level of requiredLevels) {
        if (!data.summaries[level] || typeof data.summaries[level] !== 'string') {
          errors.push(`Summary for '${level}' is required and must be a string`);
        }
      }
    }

    if (data.generatedAt && !(data.generatedAt instanceof Date) && isNaN(Date.parse(data.generatedAt))) {
      errors.push('Generated date must be a valid date');
    }

    if (data.cached !== undefined && typeof data.cached !== 'boolean') {
      errors.push('Cached flag must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate news article structure
   * @param {NewsArticle} article - News article to validate
   * @returns {Object} Validation result
   */
  static validateNewsArticle(article) {
    const errors = [];

    if (!article || typeof article !== 'object') {
      errors.push('Article must be an object');
      return { isValid: false, errors };
    }

    const requiredFields = ['headline', 'source', 'url'];
    for (const field of requiredFields) {
      if (!article[field] || typeof article[field] !== 'string') {
        errors.push(`${field} is required and must be a string`);
      }
    }

    // Validate URL format
    if (article.url) {
      try {
        new URL(article.url);
      } catch {
        errors.push('URL must be a valid URL format');
      }
    }

    if (article.publishedAt && !(article.publishedAt instanceof Date) && isNaN(Date.parse(article.publishedAt))) {
      errors.push('Published date must be a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate news data structure
   * @param {NewsData} data - News data to validate
   * @returns {Object} Validation result
   */
  static validateNewsData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('News data must be an object');
      return { isValid: false, errors };
    }

    if (!data.billId || typeof data.billId !== 'string') {
      errors.push('Bill ID is required and must be a string');
    }

    if (!Array.isArray(data.articles)) {
      errors.push('Articles must be an array');
    } else {
      data.articles.forEach((article, index) => {
        const validation = DataValidator.validateNewsArticle(article);
        if (!validation.isValid) {
          errors.push(`Article at index ${index}: ${validation.errors.join(', ')}`);
        }
      });
    }

    if (data.lastFetched && !(data.lastFetched instanceof Date) && isNaN(Date.parse(data.lastFetched))) {
      errors.push('Last fetched date must be a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate filter options
   * @param {FilterOptions} filters - Filter options to validate
   * @returns {Object} Validation result
   */
  static validateFilterOptions(filters) {
    const errors = [];

    if (!filters || typeof filters !== 'object') {
      return { isValid: true, errors: [] }; // Filters are optional
    }

    if (filters.keyword !== undefined && typeof filters.keyword !== 'string') {
      errors.push('Keyword filter must be a string');
    }

    const arrayFields = ['topics', 'sponsors', 'statuses'];
    for (const field of arrayFields) {
      if (filters[field] !== undefined) {
        if (!Array.isArray(filters[field])) {
          errors.push(`${field} filter must be an array`);
        } else if (!filters[field].every(item => typeof item === 'string')) {
          errors.push(`All ${field} filter items must be strings`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize string input to prevent XSS
   * @param {string} input - Input string to sanitize
   * @returns {string} Sanitized string
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate and sanitize bill data for API responses
   * @param {Object} data - Raw bill data
   * @returns {Object} Sanitized and validated data
   */
  static sanitizeBillData(data) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    return {
      id: DataValidator.sanitizeString(data.id),
      billNumber: DataValidator.sanitizeString(data.billNumber),
      shortTitle: DataValidator.sanitizeString(data.shortTitle),
      fullTitle: DataValidator.sanitizeString(data.fullTitle),
      status: DataValidator.sanitizeString(data.status),
      sponsors: Array.isArray(data.sponsors) ? data.sponsors.map(sponsor => ({
        name: DataValidator.sanitizeString(sponsor.name),
        photoUrl: DataValidator.sanitizeString(sponsor.photoUrl || ''),
        district: DataValidator.sanitizeString(sponsor.district || '')
      })) : [],
      officialUrl: DataValidator.sanitizeString(data.officialUrl || ''),
      billText: DataValidator.sanitizeString(data.billText || ''),
      abstract: DataValidator.sanitizeString(data.abstract || ''),
      committee: DataValidator.sanitizeString(data.committee || ''),
      coSponsors: Array.isArray(data.coSponsors) ? 
        data.coSponsors.map(name => DataValidator.sanitizeString(name)) : [],
      filedDate: data.filedDate instanceof Date ? data.filedDate : null,
      lastUpdated: data.lastUpdated instanceof Date ? data.lastUpdated : new Date(),
      topics: Array.isArray(data.topics) ? 
        data.topics.map(topic => DataValidator.sanitizeString(topic)) : []
    };
  }
}

module.exports = {
  DataValidator
};