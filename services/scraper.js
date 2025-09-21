const axios = require('axios');
const { AppError, retryManager, fallbackManager, circuitBreakers } = require('../backend/middleware/error-handler');
const { idStandardizer } = require('../config/id-standardizer');

// Conditional cheerio import for testing compatibility
let cheerio;
try {
  cheerio = require('cheerio');
} catch (error) {
  // Fallback for test environment
  cheerio = null;
}

// Add PDF parsing capability
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse not available, PDF text extraction will be disabled');
  pdfParse = null;
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
            const tables = $('table').toArray();
            
            for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
              try {
                const $table = $(tables[tableIndex]);
                const tableText = $table.text();
                
                // Check if this table contains a Senate bill
                const billMatch = tableText.match(/SB\s*(\d+)/i);
                if (billMatch) {
                  const billNumber = `SB ${billMatch[1]}`;
                  
                  // Extract bill information from the table structure
                  const billData = await this.parseBillTable($table, billNumber, $);
                  
                  if (billData && this.validateBillData(billData)) {
                    bills.push(billData);
                    
                    if (bills.length % 10 === 0) {
                      console.log(`Processed ${bills.length} bills...`);
                    }
                  }
                }
              } catch (tableError) {
                console.warn(`Error processing table ${tableIndex}:`, tableError.message);
                // Continue processing other tables
              }
            }
            
            if (bills.length === 0) {
              throw new AppError('No Senate bills found in the report', 'SCRAPING_ERROR');
            }
            
            console.log(`Successfully scraped ${bills.length} Senate bills from report`);
            
            // Sort bills by most recent first and limit to 50
            const sortedBills = bills.sort((a, b) => {
              // Sort by lastActionDate first, then filedDate, then lastUpdated
              const dateA = new Date(a.lastActionDate || a.filedDate || a.lastUpdated || 0);
              const dateB = new Date(b.lastActionDate || b.filedDate || b.lastUpdated || 0);
              return dateB - dateA; // Most recent first
            });
            
            // Limit to 50 most recent bills
            const recentBills = sortedBills.slice(0, 50);
            console.log(`Limited to ${recentBills.length} most recent bills`);
            
            // Store successful result as fallback
            fallbackManager.setFallback('bills-list', recentBills);
            
            return recentBills;
            
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
   * @param {Object} $ - Cheerio instance
   * @returns {Object|null} Bill data object or null if parsing fails
   */
  async parseBillTable($table, billNumber, $) {
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
      
      // Standardize the bill number for consistent storage and lookup
      const standardizedBillNumber = idStandardizer.standardize(billNumber);
      const displayBillNumber = idStandardizer.toDisplayFormat(standardizedBillNumber);
      
      // Extract dates
      const lastActionDate = this.extractDateFromAction(lastAction);
      const filedDate = this.extractFiledDate(tableText) || lastActionDate;
      
      const billData = {
        id: standardizedBillNumber, // Use standardized format as document ID (e.g., "SB1")
        billNumber: displayBillNumber, // Use display format for UI (e.g., "SB 1")
        shortTitle: this.extractShortTitle(caption),
        fullTitle: caption || `${displayBillNumber} - Title not available`,
        status: status,
        sponsors: sponsorsList,
        officialUrl: `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=${standardizedBillNumber}`,
        billText: '',
        abstract: '', // Will be populated from Caption Text field
        committee: this.extractCommittee(tableText),
        coSponsors: sponsors.slice(0, 5).map(name => name.trim()).filter(name => name.length > 0),
        filedDate: filedDate,
        lastActionDate: lastActionDate,
        lastAction: lastAction,
        lastUpdated: new Date(),
        topics: this.extractTopicsFromTitle(caption)
      };
      
      // Try to fetch bill text and summary from the website
      try {
        console.log(`📄 Attempting to fetch bill text for ${displayBillNumber}...`);
        const textResult = await this.fetchBillText(standardizedBillNumber);
        
        if (textResult.billText && textResult.billText.length > 100) {
          billData.billText = textResult.billText;
          console.log(`✅ Successfully fetched bill text for ${displayBillNumber} (${textResult.billText.length} characters)`);
        }
        
        if (textResult.summary && textResult.summary.length > 20) {
          // Use the Caption Text as the abstract
          billData.abstract = textResult.summary;
          console.log(`✅ Successfully fetched Caption Text for ${displayBillNumber} (${textResult.summary.length} characters)`);
        } else if (caption && caption.length > 20) {
          // Fallback to caption from table if Caption Text not found
          billData.abstract = caption;
          console.log(`⚠️ Using table caption as fallback for ${displayBillNumber}`);
        }
        
        if (!textResult.billText && !textResult.summary) {
          console.log(`⚠️ No substantial content found for ${displayBillNumber}`);
        }
      } catch (error) {
        console.warn(`❌ Failed to fetch bill content for ${displayBillNumber}:`, error.message);
      }
      
      return billData;
      
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
    
    try {
      // Look for various date patterns
      const patterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})/,           // MM/DD/YYYY
        /(\d{1,2}-\d{1,2}-\d{4})/,             // MM-DD-YYYY
        /(\d{4}-\d{1,2}-\d{1,2})/,             // YYYY-MM-DD
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i, // Month DD, YYYY
        /(\d{1,2}\/\d{1,2}\/\d{2})/            // MM/DD/YY
      ];
      
      for (const pattern of patterns) {
        const match = actionText.match(pattern);
        if (match) {
          const dateStr = match[1] || match[0];
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing date from action:', actionText, error.message);
    }
    
    return null;
  }

  /**
   * Extract filed date from bill text (different from last action date)
   */
  extractFiledDate(tableText) {
    if (!tableText) return null;
    
    try {
      // Look for "Filed:" followed by a date
      const filedMatch = tableText.match(/Filed:\s*([^|\n]+)/i);
      if (filedMatch) {
        return this.extractDateFromAction(filedMatch[1]);
      }
      
      // Look for "Introduced:" followed by a date
      const introducedMatch = tableText.match(/Introduced:\s*([^|\n]+)/i);
      if (introducedMatch) {
        return this.extractDateFromAction(introducedMatch[1]);
      }
    } catch (error) {
      console.warn('Error extracting filed date:', error.message);
    }
    
    return null;
  }

  /**
   * Extract committee information from bill text
   */
  extractCommittee(tableText) {
    if (!tableText) return '';
    
    try {
      // Look for "Committee:" followed by committee name
      const committeeMatch = tableText.match(/Committee:\s*([^|\n]+)/i);
      if (committeeMatch) {
        return committeeMatch[1].trim();
      }
      
      // Look for "Referred to:" followed by committee name
      const referredMatch = tableText.match(/Referred to:\s*([^|\n]+)/i);
      if (referredMatch) {
        return referredMatch[1].trim();
      }
    } catch (error) {
      console.warn('Error extracting committee:', error.message);
    }
    
    return '';
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
   * Fetch bill text from Texas Legislature website
   * @param {string} billNumber - Standardized bill number (e.g., "SB1")
   * @returns {Promise<Object>} Object with billText and summary
   */
  async fetchBillText(billNumber) {
    if (!billNumber) return { billText: '', summary: '' };
    
    try {
      // Try the Text.aspx page first (most reliable)
      const textPageResult = await this.fetchBillTextFromTextPage(billNumber);
      if (textPageResult.billText || textPageResult.summary) {
        return textPageResult;
      }
      
      // Fallback to direct document URLs
      const directText = await this.fetchBillTextFromDirectUrls(billNumber);
      return { billText: directText, summary: '' };
      
    } catch (error) {
      console.error(`Error fetching bill text for ${billNumber}:`, error.message);
      return { billText: '', summary: '' };
    }
  }

  /**
   * Fetch bill text and summary using the correct Texas Legislature URLs
   * @param {string} billNumber - Standardized bill number
   * @returns {Promise<Object>} Object with billText and summary
   */
  async fetchBillTextFromTextPage(billNumber) {
    try {
      // Try different session numbers
      const sessions = ['89R', '88R', '87R', '86R'];
      
      for (const session of sessions) {
        const result = { billText: '', summary: '' };
        
        // First, try to get Caption Text from History.aspx page
        try {
          const historyUrl = `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=${session}&Bill=${billNumber}`;
          console.log(`🔗 Trying History URL for Caption Text: ${historyUrl}`);
          
          const historyResponse = await axios.get(historyUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TexasBillTracker/1.0)'
            }
          });
          
          if (historyResponse.status === 200 && historyResponse.data) {
            const $ = cheerio.load(historyResponse.data);
            
            // Look for Caption Text field specifically
            const captionTextSelectors = [
              'span[id*="Caption"]',
              'td:contains("Caption Text") + td',
              'td:contains("Caption:") + td',
              'label:contains("Caption") + span',
              'label:contains("Caption Text") + span',
              '.caption-text',
              '#CaptionText'
            ];
            
            for (const selector of captionTextSelectors) {
              const element = $(selector);
              if (element.length > 0) {
                let captionText = element.text().trim();
                
                // Clean up caption text
                if (captionText.length > 20 && 
                    !captionText.includes('Help | FAQ') &&
                    !captionText.includes('Site Map') &&
                    captionText.length > result.summary.length) {
                  
                  captionText = captionText
                    .replace(/^Caption:?\s*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  result.summary = captionText;
                  console.log(`✅ Found Caption Text for ${billNumber}: ${captionText.substring(0, 100)}...`);
                  break;
                }
              }
            }
            
            // If no specific Caption Text found, look for it in table structure
            if (!result.summary) {
              $('table tr').each((i, row) => {
                const $row = $(row);
                const rowText = $row.text();
                if (rowText.toLowerCase().includes('caption')) {
                  const cells = $row.find('td');
                  if (cells.length >= 2) {
                    const captionText = cells.eq(1).text().trim();
                    if (captionText.length > 20) {
                      result.summary = captionText;
                      console.log(`✅ Found Caption Text in table for ${billNumber}: ${captionText.substring(0, 100)}...`);
                      return false; // Break out of each loop
                    }
                  }
                }
              });
            }
          }
        } catch (historyError) {
          console.log(`Caption Text not found for ${billNumber} in session ${session}`);
        }
        
        // Fetch summary from BillSummary.aspx as fallback
        if (!result.summary) {
          try {
            const summaryUrl = `https://capitol.texas.gov/BillLookup/BillSummary.aspx?LegSess=${session}&Bill=${billNumber}`;
            console.log(`🔗 Trying Summary URL: ${summaryUrl}`);
            
            const summaryResponse = await axios.get(summaryUrl, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TexasBillTracker/1.0)'
              }
            });
            
            if (summaryResponse.status === 200 && summaryResponse.data) {
              const $ = cheerio.load(summaryResponse.data);
              
              // Remove navigation elements
              $('nav, header, footer, .navigation, .header, .footer, script, style').remove();
              
              // Look for summary content
              const summarySelectors = [
                '#BillSummary',
                '.summary',
                'div[id*="summary"]',
                'div[class*="summary"]',
                'table td', // Summary is often in table cells
                '.content',
                'main'
              ];
              
              for (const selector of summarySelectors) {
                const element = $(selector);
                if (element.length > 0) {
                  let text = element.text().trim();
                  
                  // Filter out navigation text
                  if (text.length > 50 && 
                      !text.includes('Help | FAQ') &&
                      !text.includes('Site Map') &&
                      !text.includes('Login') &&
                      text.length > result.summary.length) {
                    
                    // Clean up summary text
                    text = text
                      .replace(/^SUMMARY:?\s*/i, '')
                      .replace(/\s+/g, ' ')
                      .replace(/\n\s*\n/g, '\n')
                      .trim();
                    
                    result.summary = text;
                  }
                }
              }
            }
          } catch (summaryError) {
            console.log(`Summary not found for ${billNumber} in session ${session}`);
          }
        }
        
        // Fetch bill text from direct HTML document
        try {
          // Format bill number for document URL (e.g., SB1 -> SB00001)
          const formattedBillNum = this.formatBillNumberForDocument(billNumber);
          const versions = ['F', 'I', 'E', 'S']; // Different bill versions
          
          for (const version of versions) {
            try {
              const textUrl = `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${formattedBillNum}${version}.htm`;
              console.log(`🔗 Trying Bill Text URL: ${textUrl}`);
              
              const textResponse = await axios.get(textUrl, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; TexasBillTracker/1.0)'
                }
              });
              
              if (textResponse.status === 200 && textResponse.data) {
                const $ = cheerio.load(textResponse.data);
                
                // Remove navigation and script elements
                $('nav, header, footer, script, style, .navigation').remove();
                
                // Extract bill text from body
                let billText = $('body').text().trim();
                
                // Clean up the text
                billText = billText
                  .replace(/\s+/g, ' ')
                  .replace(/\n\s*\n/g, '\n')
                  .trim();
                
                if (billText.length > 200) {
                  result.billText = billText;
                  console.log(`✅ Found bill text for ${billNumber} version ${version} in session ${session}`);
                  break; // Found text, stop trying versions
                }
              }
            } catch (textError) {
              // Continue to next version
            }
          }
        } catch (textError) {
          console.log(`Bill text not found for ${billNumber} in session ${session}`);
        }
        
        // If we found either summary or bill text, return the result
        if (result.billText.length > 100 || result.summary.length > 50) {
          console.log(`✅ Found content for ${billNumber} in session ${session}`);
          console.log(`  - Bill text: ${result.billText.length} characters`);
          console.log(`  - Summary: ${result.summary.length} characters`);
          return result;
        }
      }
      
      return { billText: '', summary: '' };
    } catch (error) {
      console.warn(`Error fetching bill content for ${billNumber}:`, error.message);
      return { billText: '', summary: '' };
    }
  }

  /**
   * Format bill number for document URL (e.g., SB1 -> SB00001)
   * @param {string} billNumber - Bill number like "SB1"
   * @returns {string} Formatted bill number like "SB00001"
   */
  formatBillNumberForDocument(billNumber) {
    const match = billNumber.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const number = match[2].padStart(5, '0');
      return prefix + number;
    }
    return billNumber;
  }

  /**
   * Fetch bill text from direct document URLs (fallback method)
   * @param {string} billNumber - Standardized bill number
   * @returns {Promise<string>} Bill text content
   */
  async fetchBillTextFromDirectUrls(billNumber) {
    // Try HTML first, then PDF
    const htmlText = await this.fetchBillTextFromHTML(billNumber);
    if (htmlText && htmlText.length > 100) {
      return htmlText;
    }
    
    const pdfText = await this.fetchBillTextFromPDF(billNumber);
    return pdfText || '';
  }

  /**
   * Fetch bill text from HTML version (direct document URLs)
   * @param {string} billNumber - Standardized bill number
   * @returns {Promise<string>} Bill text content
   */
  async fetchBillTextFromHTML(billNumber) {
    try {
      // Try different session formats and URL patterns
      const sessions = ['89R', '88R', '87R']; // Current and recent sessions
      const urlPatterns = [
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${bill}00001I.HTM`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${bill}00001F.HTM`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${bill}00001E.HTM`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${bill}.HTM`
      ];
      
      for (const session of sessions) {
        for (const pattern of urlPatterns) {
          try {
            const textUrl = pattern(session, billNumber);
            console.log(`🔗 Trying HTML text URL: ${textUrl}`);
            
            const response = await axios.get(textUrl, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TexasBillTracker/1.0)'
              }
            });
            
            if (response.status === 200 && response.data) {
              const $ = cheerio.load(response.data);
              
              // Remove script and style elements
              $('script, style, nav, header, footer').remove();
              
              // Extract text content
              let text = $('body').text() || '';
              
              // Clean up the text
              text = text
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .trim();
              
              if (text.length > 100) {
                console.log(`✅ Found HTML text for ${billNumber} in session ${session}`);
                return text;
              }
            }
          } catch (urlError) {
            if (urlError.response?.status !== 404) {
              console.warn(`Error with URL pattern:`, urlError.message);
            }
          }
        }
      }
      
      return '';
    } catch (error) {
      console.warn(`Error fetching HTML text for ${billNumber}:`, error.message);
      return '';
    }
  }

  /**
   * Fetch bill text from PDF version
   * @param {string} billNumber - Standardized bill number
   * @returns {Promise<string>} Bill text content
   */
  async fetchBillTextFromPDF(billNumber) {
    if (!pdfParse) {
      console.log('📄 PDF parsing not available, skipping PDF text extraction');
      return '';
    }
    
    try {
      // Try different sessions and PDF formats
      const sessions = ['89R', '88R', '87R'];
      const pdfPatterns = [
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/pdf/${bill}00001I.pdf`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/pdf/${bill}00001F.pdf`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/pdf/${bill}00001E.pdf`,
        (session, bill) => `https://capitol.texas.gov/tlodocs/${session}/billtext/pdf/${bill}.pdf`
      ];
      
      for (const session of sessions) {
        for (const pattern of pdfPatterns) {
          try {
            const pdfUrl = pattern(session, billNumber);
            console.log(`🔗 Trying PDF URL: ${pdfUrl}`);
            
            const response = await axios.get(pdfUrl, {
              timeout: 15000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TexasBillTracker/1.0)'
              }
            });
            
            if (response.status === 200 && response.data) {
              console.log(`📄 Parsing PDF content for ${billNumber}...`);
              const pdfData = await pdfParse(response.data);
              
              if (pdfData.text && pdfData.text.length > 100) {
                // Clean up PDF text
                let text = pdfData.text
                  .replace(/\f/g, '\n') // Replace form feeds with newlines
                  .replace(/\s+/g, ' ')
                  .replace(/\n\s*\n/g, '\n')
                  .trim();
                
                console.log(`✅ Successfully extracted ${text.length} characters from PDF in session ${session}`);
                return text;
              }
            }
          } catch (pdfError) {
            if (pdfError.response?.status !== 404) {
              console.warn(`Error with PDF pattern:`, pdfError.message);
            }
          }
        }
      }
      
      return '';
    } catch (error) {
      console.error(`Error fetching PDF text for ${billNumber}:`, error.message);
      return '';
    }
  }

  /**
   * Get bill text URL for a given bill number
   * @param {string} billNumber - Standardized bill number
   * @returns {string} URL to bill text
   */
  getBillTextUrl(billNumber) {
    return `https://capitol.texas.gov/BillLookup/Text.aspx?LegSess=88R&Bill=${billNumber}`;
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
   * Scrape voting data for a specific bill
   * @param {string} billNumber - Standardized bill number (e.g., "SB1")
   * @returns {Promise<Object>} Voting data object
   */
  async scrapeVotingData(billNumber) {
    try {
      console.log(`🗳️ Scraping voting data for ${billNumber}...`);
      
      if (!cheerio) {
        throw new AppError('Cheerio not available in test environment', 'SCRAPING_ERROR');
      }
      
      // Try different session numbers for voting records
      const sessions = ['89R', '88R', '87R'];
      
      for (const session of sessions) {
        try {
          // Try the Actions page which often contains voting information
          const actionsUrl = `https://capitol.texas.gov/BillLookup/Actions.aspx?LegSess=${session}&Bill=${billNumber}`;
          console.log(`🔗 Trying Actions URL: ${actionsUrl}`);
          
          const response = await axios.get(actionsUrl, {
            ...this.axiosConfig,
            timeout: 15000
          });
          
          if (response.status === 200 && response.data) {
            const $ = cheerio.load(response.data);
            
            // Look for voting tables or vote records
            const votingData = this.parseVotingFromActions($, billNumber);
            
            if (votingData && (votingData.votes.length > 0 || votingData.summary)) {
              console.log(`✅ Found voting data for ${billNumber} in session ${session}`);
              return votingData;
            }
          }
        } catch (sessionError) {
          console.log(`No voting data found for ${billNumber} in session ${session}`);
        }
        
        // Also try the History page which might have vote records
        try {
          const historyUrl = `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=${session}&Bill=${billNumber}`;
          console.log(`🔗 Trying History URL: ${historyUrl}`);
          
          const response = await axios.get(historyUrl, {
            ...this.axiosConfig,
            timeout: 15000
          });
          
          if (response.status === 200 && response.data) {
            const $ = cheerio.load(response.data);
            
            // Look for voting information in history
            const votingData = this.parseVotingFromHistory($, billNumber);
            
            if (votingData && (votingData.votes.length > 0 || votingData.summary)) {
              console.log(`✅ Found voting data in history for ${billNumber} in session ${session}`);
              return votingData;
            }
          }
        } catch (historyError) {
          console.log(`No voting data in history for ${billNumber} in session ${session}`);
        }
      }
      
      // Return empty voting data if nothing found
      return {
        billNumber: billNumber,
        votes: [],
        summary: null,
        lastUpdated: new Date(),
        source: 'texas_legislature'
      };
      
    } catch (error) {
      console.error(`Error scraping voting data for ${billNumber}:`, error.message);
      return {
        billNumber: billNumber,
        votes: [],
        summary: null,
        error: error.message,
        lastUpdated: new Date(),
        source: 'texas_legislature'
      };
    }
  }

  /**
   * Parse voting data from Actions page
   * @param {Object} $ - Cheerio instance
   * @param {string} billNumber - Bill number
   * @returns {Object|null} Voting data or null
   */
  parseVotingFromActions($, billNumber) {
    try {
      const votes = [];
      let summary = null;
      
      // Look for vote records in tables
      $('table').each((index, table) => {
        const $table = $(table);
        const tableText = $table.text().toLowerCase();
        
        // Check if this table contains voting information
        if (tableText.includes('vote') || tableText.includes('yea') || tableText.includes('nay')) {
          
          // Extract vote information from table rows
          $table.find('tr').each((rowIndex, row) => {
            const $row = $(row);
            const rowText = $row.text().trim();
            
            // Look for vote patterns
            const voteMatch = rowText.match(/(yea|aye|yes|nay|no|present|absent):\s*(\d+)/gi);
            if (voteMatch) {
              const voteDate = this.extractDateFromAction(rowText);
              const chamber = this.extractChamberFromText(rowText);
              
              const voteRecord = {
                date: voteDate || new Date(),
                chamber: chamber || 'Senate',
                votes: {},
                description: rowText.substring(0, 100) + '...'
              };
              
              // Parse individual vote counts
              voteMatch.forEach(match => {
                const [, type, count] = match.match(/(yea|aye|yes|nay|no|present|absent):\s*(\d+)/i) || [];
                if (type && count) {
                  const normalizedType = this.normalizeVoteType(type);
                  voteRecord.votes[normalizedType] = parseInt(count);
                }
              });
              
              // Only add if we have meaningful vote data
              if (Object.keys(voteRecord.votes).length > 0) {
                votes.push(voteRecord);
              }
            }
          });
        }
      });
      
      // Look for summary vote information
      const bodyText = $('body').text();
      const summaryMatch = bodyText.match(/final\s+vote[:\s]*([^.]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
      
      return votes.length > 0 || summary ? {
        billNumber: billNumber,
        votes: votes,
        summary: summary,
        lastUpdated: new Date(),
        source: 'texas_legislature_actions'
      } : null;
      
    } catch (error) {
      console.warn(`Error parsing voting data from actions for ${billNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Parse voting data from History page
   * @param {Object} $ - Cheerio instance
   * @param {string} billNumber - Bill number
   * @returns {Object|null} Voting data or null
   */
  parseVotingFromHistory($, billNumber) {
    try {
      const votes = [];
      let summary = null;
      
      // Look for action items that mention voting
      $('.action-item, .history-item, tr').each((index, element) => {
        const $element = $(element);
        const text = $element.text().toLowerCase();
        
        if (text.includes('vote') || text.includes('passed') || text.includes('failed')) {
          const fullText = $element.text().trim();
          
          // Extract vote counts if present
          const votePattern = /(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/;
          const voteMatch = fullText.match(votePattern);
          
          if (voteMatch) {
            const [, yeas, nays, present] = voteMatch;
            const voteDate = this.extractDateFromAction(fullText);
            const chamber = this.extractChamberFromText(fullText);
            
            const voteRecord = {
              date: voteDate || new Date(),
              chamber: chamber || 'Senate',
              votes: {
                yea: parseInt(yeas) || 0,
                nay: parseInt(nays) || 0,
                present: parseInt(present) || 0
              },
              description: fullText.substring(0, 100) + '...'
            };
            
            votes.push(voteRecord);
          }
        }
      });
      
      return votes.length > 0 ? {
        billNumber: billNumber,
        votes: votes,
        summary: summary,
        lastUpdated: new Date(),
        source: 'texas_legislature_history'
      } : null;
      
    } catch (error) {
      console.warn(`Error parsing voting data from history for ${billNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Extract chamber (Senate/House) from text
   * @param {string} text - Text to analyze
   * @returns {string} Chamber name
   */
  extractChamberFromText(text) {
    const textLower = text.toLowerCase();
    if (textLower.includes('senate')) return 'Senate';
    if (textLower.includes('house')) return 'House';
    return 'Senate'; // Default for Senate bills
  }

  /**
   * Normalize vote type names
   * @param {string} voteType - Raw vote type
   * @returns {string} Normalized vote type
   */
  normalizeVoteType(voteType) {
    const type = voteType.toLowerCase();
    if (type === 'yea' || type === 'aye' || type === 'yes') return 'yea';
    if (type === 'nay' || type === 'no') return 'nay';
    if (type === 'present') return 'present';
    if (type === 'absent') return 'absent';
    return type;
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

module.exports = { TexasLegislatureScraper };