const axios = require('axios');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../backend/middleware/error-handler');

// Conditional cheerio import for testing compatibility
let cheerio;
try {
  cheerio = require('cheerio');
} catch (error) {
  // Fallback for test environment
  cheerio = null;
}

/**
 * Texas Legislature Online scraper service
 * Scrapes bill data from the Texas Legislature Online (TLO) website
 */
class TexasLegislatureScraper {
  constructor() {
    this.baseUrl = 'https://capitol.texas.gov';
    this.billsListUrl = 'https://capitol.texas.gov/BillLookup/BillNumber.aspx';
    this.axiosConfig = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
  }

  /**
   * Scrape all current Senate bills from TLO with comprehensive error handling
   * @returns {Promise<Array>} Array of bill objects
   */
  async scrapeBills() {
    const operationKey = 'scrape-bills';
    
    try {
      return await circuitBreakers.scraper.execute(async () => {
        return await retryManager.executeWithRetry(async () => {
          console.log('Starting to scrape Texas Senate bills...');
          
          if (!cheerio) {
            throw new AppError('Cheerio not available in test environment', 'SCRAPING_ERROR');
          }
          
          // Get the current session bills list page with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          try {
            const response = await axios.get(this.billsListUrl, {
              ...this.axiosConfig,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.data || response.data.length < 100) {
              throw new AppError('Invalid or empty response from Texas Legislature website', 'SCRAPING_ERROR');
            }
            
            const $ = cheerio.load(response.data);
            const bills = [];
            
            // Look for Senate bills (SB prefix) in the bills table
            $('table tr').each((index, element) => {
              try {
                const $row = $(element);
                const billNumber = $row.find('td:first-child a').text().trim();
                
                // Only process Senate bills (SB prefix)
                if (billNumber.startsWith('SB')) {
                  const billUrl = $row.find('td:first-child a').attr('href');
                  const title = $row.find('td:nth-child(2)').text().trim();
                  const author = $row.find('td:nth-child(3)').text().trim();
                  const status = $row.find('td:nth-child(4)').text().trim();
                  
                  if (billNumber && title) {
                    bills.push({
                      billNumber,
                      shortTitle: this.extractShortTitle(title),
                      fullTitle: title,
                      status: this.normalizeStatus(status),
                      sponsors: author ? [{ name: author, photoUrl: '', district: '' }] : [],
                      officialUrl: billUrl ? `${this.baseUrl}${billUrl}` : '',
                      billText: '',
                      abstract: '',
                      committee: '',
                      coSponsors: [],
                      filedDate: null,
                      lastUpdated: new Date(),
                      topics: []
                    });
                  }
                }
              } catch (rowError) {
                console.warn(`Error processing bill row ${index}:`, rowError.message);
                // Continue processing other rows
              }
            });
            
            if (bills.length === 0) {
              throw new AppError('No Senate bills found on the page', 'SCRAPING_ERROR');
            }
            
            console.log(`Successfully scraped ${bills.length} Senate bills`);
            
            // Store successful result as fallback
            fallbackManager.setFallback('bills-list', bills);
            
            return bills;
            
          } catch (axiosError) {
            clearTimeout(timeoutId);
            
            if (axiosError.name === 'AbortError') {
              throw new AppError('Request timeout while scraping bills', 'TIMEOUT');
            } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
              throw new AppError('Cannot connect to Texas Legislature website', 'NETWORK_ERROR');
            } else {
              throw new AppError(`Network error: ${axiosError.message}`, 'NETWORK_ERROR');
            }
          }
        }, operationKey, {
          maxRetries: 3,
          baseDelay: 2000,
          retryCondition: (error) => {
            return error.type === 'NETWORK_ERROR' || 
                   error.type === 'TIMEOUT' || 
                   error.message.includes('ECONNRESET');
          }
        });
      });
    } catch (error) {
      console.error('Scraping failed after all retries:', error.message);
      
      // Try to return fallback data
      const fallbackBills = fallbackManager.getFallback('bills-list');
      if (fallbackBills) {
        console.log('Returning cached fallback bills data');
        return fallbackBills.map(bill => ({
          ...bill,
          lastUpdated: new Date(),
          isStale: true,
          fallbackMessage: 'This data may be outdated due to scraping service issues'
        }));
      }
      
      // Generate minimal fallback data if no cache available
      console.log('Generating minimal fallback bills data');
      return fallbackManager.generateFallbackBills();
    }
  }

  /**
   * Get detailed information for a specific bill
   * @param {string} billUrl - URL to the bill detail page
   * @returns {Promise<Object>} Detailed bill information
   */
  async getBillDetails(billUrl) {
    try {
      if (!billUrl) {
        throw new Error('Bill URL is required');
      }
      
      console.log(`Scraping bill details from: ${billUrl}`);
      
      const response = await axios.get(billUrl, this.axiosConfig);
      
      if (!cheerio) {
        throw new Error('Cheerio not available in test environment');
      }
      
      const $ = cheerio.load(response.data);
      
      // Extract bill text and abstract
      const billText = this.extractBillText($);
      const abstract = this.extractAbstract($);
      const committee = this.extractCommittee($);
      const coSponsors = this.extractCoSponsors($);
      const filedDate = this.extractFiledDate($);
      
      return {
        billText,
        abstract,
        committee,
        coSponsors,
        filedDate
      };
      
    } catch (error) {
      console.error(`Error scraping bill details from ${billUrl}:`, error.message);
      return {
        billText: '',
        abstract: 'Unable to retrieve bill details',
        committee: '',
        coSponsors: [],
        filedDate: null
      };
    }
  }

  /**
   * Extract bill text from the bill detail page
   * @param {Object} $ - Cheerio instance
   * @returns {string} Bill text
   */
  extractBillText($) {
    // Look for bill text in common selectors
    const textSelectors = [
      '.BillText',
      '#BillText',
      '.bill-text',
      'div[id*="text"]',
      'div[class*="text"]'
    ];
    
    for (const selector of textSelectors) {
      const text = $(selector).text().trim();
      if (text && text.length > 50) {
        return text;
      }
    }
    
    // Fallback: look for any large text block
    const allText = $('body').text().trim();
    if (allText.length > 200) {
      return allText.substring(0, 1000) + '...';
    }
    
    return '';
  }

  /**
   * Extract bill abstract/summary
   * @param {Object} $ - Cheerio instance
   * @returns {string} Bill abstract
   */
  extractAbstract($) {
    const abstractSelectors = [
      '.BillSummary',
      '#BillSummary',
      '.bill-summary',
      '.abstract',
      'div[id*="summary"]',
      'div[class*="summary"]'
    ];
    
    for (const selector of abstractSelectors) {
      const abstract = $(selector).text().trim();
      if (abstract && abstract.length > 20) {
        return abstract;
      }
    }
    
    return '';
  }

  /**
   * Extract committee information
   * @param {Object} $ - Cheerio instance
   * @returns {string} Committee name
   */
  extractCommittee($) {
    const committeeSelectors = [
      '.Committee',
      '#Committee',
      'td:contains("Committee")',
      'span:contains("Committee")'
    ];
    
    for (const selector of committeeSelectors) {
      const committee = $(selector).text().trim();
      if (committee && !committee.toLowerCase().includes('committee:')) {
        return committee.replace(/Committee:?\s*/i, '');
      }
    }
    
    return '';
  }

  /**
   * Extract co-sponsors
   * @param {Object} $ - Cheerio instance
   * @returns {Array} Array of co-sponsor names
   */
  extractCoSponsors($) {
    const coSponsors = [];
    const sponsorSelectors = [
      '.CoSponsors',
      '#CoSponsors',
      'td:contains("Co-sponsor")',
      'span:contains("Co-sponsor")'
    ];
    
    for (const selector of sponsorSelectors) {
      const sponsorText = $(selector).text().trim();
      if (sponsorText) {
        // Split by common delimiters and clean up
        const sponsors = sponsorText
          .replace(/Co-sponsors?:?\s*/i, '')
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        coSponsors.push(...sponsors);
      }
    }
    
    return coSponsors;
  }

  /**
   * Extract filed date
   * @param {Object} $ - Cheerio instance
   * @returns {Date|null} Filed date
   */
  extractFiledDate($) {
    const dateSelectors = [
      '.FiledDate',
      '#FiledDate',
      'td:contains("Filed")',
      'span:contains("Filed")'
    ];
    
    for (const selector of dateSelectors) {
      const dateText = $(selector).text().trim();
      const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        return new Date(dateMatch[1]);
      }
    }
    
    return null;
  }

  /**
   * Extract short title from full title
   * @param {string} fullTitle - Full bill title
   * @returns {string} Short title
   */
  extractShortTitle(fullTitle) {
    if (!fullTitle) return '';
    
    // Take first sentence or first 100 characters
    const firstSentence = fullTitle.split('.')[0];
    if (firstSentence.length <= 100) {
      return firstSentence.trim();
    }
    
    return fullTitle.substring(0, 97).trim() + '...';
  }

  /**
   * Normalize status text to standard values
   * @param {string} status - Raw status text
   * @returns {string} Normalized status
   */
  normalizeStatus(status) {
    if (!status) return 'Filed';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('filed') || statusLower.includes('introduced')) {
      return 'Filed';
    } else if (statusLower.includes('committee') || statusLower.includes('referred')) {
      return 'In Committee';
    } else if (statusLower.includes('passed') || statusLower.includes('enacted')) {
      return 'Passed';
    }
    
    return 'Filed'; // Default status
  }

  /**
   * Validate scraped bill data
   * @param {Object} billData - Bill data to validate
   * @returns {boolean} True if valid
   */
  validateBillData(billData) {
    const required = ['billNumber', 'fullTitle', 'status'];
    
    for (const field of required) {
      if (!billData[field] || billData[field].trim() === '') {
        console.warn(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate bill number format (SB followed by number)
    if (!/^SB\s*\d+$/i.test(billData.billNumber)) {
      console.warn(`Invalid bill number format: ${billData.billNumber}`);
      return false;
    }
    
    return true;
  }

  /**
   * Scrape bills with enhanced details
   * @param {number} limit - Maximum number of bills to process (for testing)
   * @returns {Promise<Array>} Array of detailed bill objects
   */
  async scrapeBillsWithDetails(limit = null) {
    try {
      const bills = await this.scrapeBills();
      const detailedBills = [];
      
      const billsToProcess = limit ? bills.slice(0, limit) : bills;
      
      for (const bill of billsToProcess) {
        if (bill.officialUrl) {
          try {
            const details = await this.getBillDetails(bill.officialUrl);
            const enhancedBill = { ...bill, ...details };
            
            if (this.validateBillData(enhancedBill)) {
              detailedBills.push(enhancedBill);
            }
          } catch (error) {
            console.warn(`Failed to get details for ${bill.billNumber}:`, error.message);
            // Include bill without details if validation passes
            if (this.validateBillData(bill)) {
              detailedBills.push(bill);
            }
          }
          
          // Add delay to avoid overwhelming the server
          await this.delay(1000);
        } else {
          // Include bill without URL if validation passes
          if (this.validateBillData(bill)) {
            detailedBills.push(bill);
          }
        }
      }
      
      console.log(`Successfully processed ${detailedBills.length} bills with details`);
      return detailedBills;
      
    } catch (error) {
      console.error('Error scraping bills with details:', error.message);
      throw error;
    }
  }

  /**
   * Add delay between requests
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TexasLegislatureScraper;