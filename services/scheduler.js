const cron = require('node-cron');
const TexasLegislatureScraper = require('./scraper');
const { billDatabase } = require('../config/bill-database');
const { databaseService } = require('../config/database');

/**
 * Automated scraping scheduler service
 * Handles periodic data updates with error handling and retry logic
 */
class ScrapingScheduler {
  constructor() {
    this.scraper = new TexasLegislatureScraper();
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.baseRetryDelay = 5000; // 5 seconds
    this.cronJob = null;
    this.logger = new ScrapingLogger();
  }

  /**
   * Initialize the scheduler with database connection
   */
  async initialize() {
    try {
      // Ensure database is connected
      if (!databaseService.isConnected) {
        await databaseService.connect();
        await databaseService.initializeCollections();
      }
      
      this.logger.info('Scraping scheduler initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize scraping scheduler', error);
      throw error;
    }
  }

  /**
   * Start the automated scraping scheduler
   * Runs daily at 6:00 AM Central Time
   */
  start() {
    try {
      // Schedule for 6:00 AM Central Time daily
      // Using cron expression: '0 6 * * *' (minute hour day month dayOfWeek)
      this.cronJob = cron.schedule('0 6 * * *', async () => {
        await this.runScrapingJob();
      }, {
        scheduled: false,
        timezone: 'America/Chicago' // Central Time
      });

      this.cronJob.start();
      this.nextRun = this.getNextRunTime();
      
      this.logger.info(`Scraping scheduler started. Next run: ${this.nextRun}`);
      console.log(`📅 Scraping scheduler started. Next run: ${this.nextRun}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start scraping scheduler', error);
      throw error;
    }
  }

  /**
   * Stop the automated scraping scheduler
   */
  stop() {
    try {
      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }
      
      this.logger.info('Scraping scheduler stopped');
      console.log('📅 Scraping scheduler stopped');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop scraping scheduler', error);
      throw error;
    }
  }

  /**
   * Manually trigger a scraping job
   */
  async runManualScrape() {
    this.logger.info('Manual scraping job triggered');
    return await this.runScrapingJob();
  }

  /**
   * Main scraping job execution with error handling and retry logic
   */
  async runScrapingJob() {
    if (this.isRunning) {
      this.logger.warn('Scraping job already running, skipping this execution');
      return { success: false, message: 'Job already running' };
    }

    this.isRunning = true;
    this.lastRun = new Date();
    this.retryAttempts = 0;

    try {
      this.logger.info('Starting scraping job execution');
      console.log('🔄 Starting automated bill scraping...');

      const result = await this.executeScrapingWithRetry();
      
      this.isRunning = false;
      this.nextRun = this.getNextRunTime();
      
      return result;
    } catch (error) {
      this.isRunning = false;
      this.logger.error('Scraping job failed after all retries', error);
      console.error('❌ Scraping job failed after all retries:', error.message);
      
      return {
        success: false,
        message: 'Scraping failed after all retries',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Execute scraping with exponential backoff retry logic
   */
  async executeScrapingWithRetry() {
    while (this.retryAttempts < this.maxRetries) {
      try {
        this.retryAttempts++;
        
        this.logger.info(`Scraping attempt ${this.retryAttempts}/${this.maxRetries}`);
        console.log(`🔄 Scraping attempt ${this.retryAttempts}/${this.maxRetries}`);

        // Scrape bills with details
        const bills = await this.scraper.scrapeBillsWithDetails();
        
        if (!bills || bills.length === 0) {
          throw new Error('No bills scraped - possible website structure change');
        }

        // Save bills to database
        const saveResult = await this.saveBillsToDatabase(bills);
        
        this.logger.info(`Scraping completed successfully. Processed ${bills.length} bills`);
        console.log(`✅ Scraping completed successfully. Processed ${bills.length} bills`);

        return {
          success: true,
          billsProcessed: bills.length,
          billsSaved: saveResult.saved,
          billsUpdated: saveResult.updated,
          timestamp: new Date(),
          attempt: this.retryAttempts
        };

      } catch (error) {
        this.logger.error(`Scraping attempt ${this.retryAttempts} failed`, error);
        console.error(`❌ Scraping attempt ${this.retryAttempts} failed:`, error.message);

        if (this.retryAttempts >= this.maxRetries) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(this.retryAttempts);
        
        this.logger.info(`Retrying in ${delay}ms...`);
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        
        await this.delay(delay);
      }
    }
  }

  /**
   * Save scraped bills to Firebase database
   */
  async saveBillsToDatabase(bills) {
    try {
      let saved = 0;
      let updated = 0;
      const errors = [];

      this.logger.info(`Saving ${bills.length} bills to database`);

      for (const bill of bills) {
        try {
          // Check if bill already exists
          const existingBill = await billDatabase.getBill(bill.billNumber);
          
          if (existingBill) {
            // Update existing bill
            await billDatabase.saveBill({
              ...bill,
              lastUpdated: new Date()
            });
            updated++;
            this.logger.debug(`Updated bill: ${bill.billNumber}`);
          } else {
            // Create new bill
            await billDatabase.saveBill({
              ...bill,
              lastUpdated: new Date()
            });
            saved++;
            this.logger.debug(`Saved new bill: ${bill.billNumber}`);
          }
        } catch (error) {
          errors.push({
            billNumber: bill.billNumber,
            error: error.message
          });
          this.logger.error(`Failed to save bill ${bill.billNumber}`, error);
        }
      }

      if (errors.length > 0) {
        this.logger.warn(`${errors.length} bills failed to save`, { errors });
      }

      this.logger.info(`Database save completed. Saved: ${saved}, Updated: ${updated}, Errors: ${errors.length}`);

      return {
        saved,
        updated,
        errors: errors.length,
        errorDetails: errors
      };

    } catch (error) {
      this.logger.error('Failed to save bills to database', error);
      throw new Error(`Database save failed: ${error.message}`);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateRetryDelay(attempt) {
    // Exponential backoff: baseDelay * (2 ^ (attempt - 1))
    // With jitter to avoid thundering herd
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    if (!this.cronJob) return null;
    
    // Calculate next 6:00 AM Central Time
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    
    return tomorrow;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob !== null,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Logging service for scraping operations
 */
class ScrapingLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Log error messages
   */
  error(message, error = null) {
    if (this.shouldLog('error')) {
      const timestamp = new Date().toISOString();
      const errorDetails = error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null;
      
      const logEntry = {
        level: 'ERROR',
        timestamp,
        message,
        error: errorDetails
      };
      
      console.error(`[${timestamp}] ERROR: ${message}`, errorDetails || '');
      
      // In production, you might want to send this to a logging service
      this.writeToLogFile(logEntry);
    }
  }

  /**
   * Log warning messages
   */
  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        level: 'WARN',
        timestamp,
        message,
        data
      };
      
      console.warn(`[${timestamp}] WARN: ${message}`, data || '');
      this.writeToLogFile(logEntry);
    }
  }

  /**
   * Log info messages
   */
  info(message, data = null) {
    if (this.shouldLog('info')) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        level: 'INFO',
        timestamp,
        message,
        data
      };
      
      console.log(`[${timestamp}] INFO: ${message}`, data || '');
      this.writeToLogFile(logEntry);
    }
  }

  /**
   * Log debug messages
   */
  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        level: 'DEBUG',
        timestamp,
        message,
        data
      };
      
      console.log(`[${timestamp}] DEBUG: ${message}`, data || '');
      this.writeToLogFile(logEntry);
    }
  }

  /**
   * Check if message should be logged based on log level
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  /**
   * Write log entry to file (placeholder for file logging)
   */
  writeToLogFile(logEntry) {
    // In a production environment, you would write to a log file
    // For now, we'll just store in memory or could integrate with a logging service
    // Example: fs.appendFileSync('logs/scraper.log', JSON.stringify(logEntry) + '\n');
  }
}

// Create singleton instance
const scrapingScheduler = new ScrapingScheduler();

module.exports = { ScrapingScheduler, ScrapingLogger, scrapingScheduler };