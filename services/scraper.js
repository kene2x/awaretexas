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
    // Use the Senate filed bills report - much more efficient!
    this.senateReportUrl = 'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=senatefiled';
    this.axiosConfig = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
  }

  /**
   * Scrape all current Senate bills from TLO Senate Filed Bills report
   * Much more efficient than individual bill searches!
   * @returns {Promise<Array>} Array of bill objects
   */
  async scrapeBills() {
    const operationKey = 'scrape-bills';
    
    try {
      return await circuitBreakers.scraper.execute(async () => {
        return await retryManager.executeWithRetry(async () => {
          console.log('Starting to scrape Texas Senate bills from reports...');
          
          if (!cheerio) {
            throw new AppError('Cheerio not available in test environment', 'SCRAPING_ERROR');
          }
          
          // Get the Senate filed bills report page
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for large report
          
          try {
            const response = await axios.get(this.senateReportUrl, {
              ...this.axiosConfig,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.data || response.data.length < 1000) {
              throw new AppError('Invalid or empty response from Senate reports page', 'SCRAPING_ERROR');
            }
            
            const $ = cheerio.load(response.data);
            const bills = [];
            
            console.log('Parsing Senate bills from report...');
            
            // Each bill has its own table structure
            // Look for tables that contain bill numbers (SB pattern)
            $('table').each((tableIndex, table) => {
              try {
                const $table = $(table);
                const tableText = $table.text();
                
                // Check if this table contains a Senate bill
                const billMatch = tableText.match(/SB\s*(\d+)/i);
                if (billMatch) {
                  const billNumber = `SB ${billMatch[1]}`;
                  
                  // Extract bill information from the table structure
                  const billData = this.parseBillTable($table, billNumber);
                  
                  if (billData && this.validateBillData(billData)) {
                    bills.push(billData);
                    
                    if (bills.length % 100 === 0) {
                      console.log(`Processed ${bills.length} bills...`);
                    }
                  }
                }
              } catch (tableError) {
                console.warn(`Error processing table ${tableIndex}:`, tableError.message);
                // Continue processing other tables
              }
            });
            
            if (bills.length === 0) {
              throw new AppError('No Senate bills found in the report', 'SCRAPING_ERROR');
            }
            
            console.log(`Successfully scraped ${bills.length} Senate bills from report`);
            
            // Store successful result as fallback
            fallbackManager.setFallback('bills-list', bills);
            
            return bills;
            
          } catch (axiosError) {
            clearTimeout(timeoutId);
            
            if (axiosError.name === 'AbortError') {
              throw new AppError('Request timeout while scraping Senate report', 'TIMEOUT');
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
   * Parse bill information from a table element
   * @param {Object} $table - Cheerio table element
   * @param {string} billNumber - Bill number (e.g., "SB 1")
   * @returns {Object|null} Bill data object or null if parsing fails
   */
  parseBillTable($table, billNumber) {
    try {
      const tableText = $table.text();
      
      // Extract author information from the header row
      const headerRow = $table.find('tr').first();
      const headerText = headerRow.text();
      
      // Authors are typically after "Author:" in the header
      const authorMatch = headerText.match(/Author:\s*([^|]+)/i);
      const authors = authorMatch ? authorMatch[1].trim().split(/\s+/) : [];
      
      // Extract sponsor information
      const sponsorMatch = tableText.match(/Sponsor:\s*([^|]+)/i);
      const sponsors = sponsorMatch ? sponsorMatch[1].trim().split(/\s+/) : [];
      
      // Extract last action/status
      const actionMatch = tableText.match(/Last Action:\s*([^|]+)/i);
      const lastAction = actionMatch ? actionMatch[1].trim() : '';
      
      // Extract caption (bill title)
      const captionMatch = tableText.match(/Caption:\s*(.+?)(?:\n|$)/i);
      const caption = captionMatch ? captionMatch[1].trim() : '';
      
      // Extract status from last action
      const status = this.extractStatusFromAction(lastAction);
      
      // Build sponsors array
      const sponsorsList = [];
      if (authors.length > 0) {
        sponsorsList.push({ name: authors[0], photoUrl: '', district: '' });
      }
      
      return {
        billNumber: billNumber.replace(/\s+/g, ' '), // Normalize spacing
        shortTitle: this.extractShortTitle(caption),
        fullTitle: caption || `${billNumber} - Title not available`,
        status: status,
        sponsors: sponsorsList,
        officialUrl: '', // We'll need to construct this separately if needed
        billText: '',
        abstract: caption || '',
        committee: '',
        coSponsors: sponsors.slice(0, 5).map(name => name.trim()).filter(name => name.length > 0),
        filedDate: this.extractDateFromAction(lastAction),
        lastUpdated: new Date(),
        topics: this.extractTopicsFromTitle(caption)
      };
      
    } catch (error) {
      console.warn(`Error parsing bill table for ${billNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Extract status from last action text
   * @param {string} actionText - Last action text
   * @returns {string} Normalized status
   */
  extractStatusFromAction(actionText) {
    if (!actionText) return 'Filed';
    
    const actionLower = actionText.toLowerCase();
    
    if (actionLower.includes('effective') || actionLower.includes('enacted')) {
      return 'Passed';
    } else if (actionLower.includes('signed')) {
      return 'Signed';
    } else if (actionLower.includes('vetoed')) {
      return 'Vetoed';
    } else if (actionLower.includes('committee') || actionLower.includes('referred')) {
      return 'In Committee';
    } else if (actionLower.includes('passed') || actionLower.includes('engrossed')) {
      return 'Passed';
    } else if (actionLower.includes('filed') || actionLower.includes('introduced')) {
      return 'Filed';
    }
    
    return 'Filed'; // Default status
  }

  /**
   * Extract date from action text
   * @param {string} actionText - Action text containing date
   * @returns {Date|null} Extracted date or null
   */
  extractDateFromAction(actionText) {
    if (!actionText) return null;
    
    // Look for date patterns like MM/DD/YYYY
    const dateMatch = actionText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      return new Date(dateMatch[1]);
    }
    
    return null;
  }

  /**
   * Extract topics from bill title
   * @param {string} title - Bill title
   * @returns {Array} Array of topic strings
   */
  extractTopicsFromTitle(title) {
    if (!title) return [];
    
    const topics = [];
    const titleLower = title.toLowerCase();
    
    // Common topic keywords
    const topicKeywords = {
      'Education': ['education', 'school', 'student', 'teacher', 'university', 'college'],
      'Healthcare': ['health', 'medical', 'hospital', 'medicare', 'medicaid', 'insurance'],
      'Transportation': ['transportation', 'highway', 'road', 'traffic', 'vehicle', 'motor'],
      'Environment': ['environment', 'water', 'air', 'pollution', 'conservation', 'energy'],
      'Criminal Justice': ['criminal', 'crime', 'police', 'court', 'prison', 'justice'],
      'Business': ['business', 'commerce', 'economic', 'tax', 'finance', 'employment'],
      'Government': ['government', 'public', 'administration', 'agency', 'department']
    };
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        topics.push(topic);
      }
    }
    
    return topics.length > 0 ? topics : ['General'];
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