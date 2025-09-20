const { ScrapingScheduler, ScrapingLogger } = require('../../services/scheduler');
const { TexasLegislatureScraper } = require('../../services/scraper');
const { billDatabase } = require('../../config/bill-database');
const { databaseService } = require('../../config/database');

// Mock dependencies
jest.mock('../../services/scraper');
jest.mock('../../config/bill-database');
jest.mock('../../config/database');
jest.mock('node-cron');

const cron = require('node-cron');

describe('ScrapingScheduler', () => {
  let scheduler;
  let mockCronJob;

  beforeEach(() => {
    scheduler = new ScrapingScheduler();
    
    // Mock cron job
    mockCronJob = {
      start: jest.fn(),
      stop: jest.fn()
    };
    cron.schedule.mockReturnValue(mockCronJob);
    
    // Mock database service
    databaseService.isConnected = true;
    databaseService.connect = jest.fn().mockResolvedValue(true);
    databaseService.initializeCollections = jest.fn().mockResolvedValue(true);
    
    // Mock bill database
    billDatabase.getBill = jest.fn();
    billDatabase.saveBill = jest.fn().mockResolvedValue(true);
    
    // Mock scraper
    TexasLegislatureScraper.prototype.scrapeBillsWithDetails = jest.fn();
    
    // Mock the delay function to avoid actual delays in tests
    scheduler.delay = jest.fn().mockResolvedValue();
    
    // Reset scheduler state
    scheduler.isRunning = false;
    scheduler.retryAttempts = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when database is connected', async () => {
      const result = await scheduler.initialize();
      
      expect(result).toBe(true);
      // Database is already connected, so connect shouldn't be called
      expect(databaseService.initializeCollections).toHaveBeenCalled();
    });

    it('should connect database if not already connected', async () => {
      databaseService.isConnected = false;
      
      await scheduler.initialize();
      
      expect(databaseService.connect).toHaveBeenCalled();
      expect(databaseService.initializeCollections).toHaveBeenCalled();
    });

    it('should throw error if database connection fails', async () => {
      databaseService.isConnected = false;
      databaseService.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(scheduler.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('start', () => {
    it('should start the cron job successfully', () => {
      const result = scheduler.start();
      
      expect(result).toBe(true);
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 6 * * *',
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'America/Chicago'
        }
      );
      expect(mockCronJob.start).toHaveBeenCalled();
      expect(scheduler.nextRun).toBeDefined();
    });

    it('should handle errors when starting scheduler', () => {
      cron.schedule.mockImplementation(() => {
        throw new Error('Cron error');
      });
      
      expect(() => scheduler.start()).toThrow('Cron error');
    });
  });

  describe('stop', () => {
    it('should stop the cron job successfully', () => {
      scheduler.cronJob = mockCronJob;
      
      const result = scheduler.stop();
      
      expect(result).toBe(true);
      expect(mockCronJob.stop).toHaveBeenCalled();
      expect(scheduler.cronJob).toBeNull();
    });

    it('should handle case when no cron job exists', () => {
      scheduler.cronJob = null;
      
      const result = scheduler.stop();
      
      expect(result).toBe(true);
    });
  });

  describe('runScrapingJob', () => {
    it('should skip execution if already running', async () => {
      scheduler.isRunning = true;
      
      const result = await scheduler.runScrapingJob();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Job already running');
    });

    it('should execute scraping job successfully', async () => {
      const mockBills = [
        { billNumber: 'SB1', shortTitle: 'Test Bill 1', status: 'Filed' },
        { billNumber: 'SB2', shortTitle: 'Test Bill 2', status: 'In Committee' }
      ];
      
      TexasLegislatureScraper.prototype.scrapeBillsWithDetails.mockResolvedValue(mockBills);
      billDatabase.getBill.mockResolvedValue(null); // New bills
      
      const result = await scheduler.runScrapingJob();
      
      expect(result.success).toBe(true);
      expect(result.billsProcessed).toBe(2);
      expect(scheduler.isRunning).toBe(false);
    }, 10000);

    it('should handle scraping errors with retry logic', async () => {
      TexasLegislatureScraper.prototype.scrapeBillsWithDetails
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue([{ billNumber: 'SB1', shortTitle: 'Test', status: 'Filed' }]);
      
      billDatabase.getBill.mockResolvedValue(null);
      
      const result = await scheduler.runScrapingJob();
      
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
    }, 15000);

    it('should fail after max retries', async () => {
      TexasLegislatureScraper.prototype.scrapeBillsWithDetails.mockRejectedValue(new Error('Persistent error'));
      
      const result = await scheduler.runScrapingJob();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Scraping failed after all retries');
    }, 15000);
  });

  describe('saveBillsToDatabase', () => {
    it('should save new bills successfully', async () => {
      const bills = [
        { billNumber: 'SB1', shortTitle: 'Test Bill 1', status: 'Filed' },
        { billNumber: 'SB2', shortTitle: 'Test Bill 2', status: 'In Committee' }
      ];
      
      billDatabase.getBill.mockResolvedValue(null); // No existing bills
      
      const result = await scheduler.saveBillsToDatabase(bills);
      
      expect(result.saved).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
      expect(billDatabase.saveBill).toHaveBeenCalledTimes(2);
    });

    it('should update existing bills', async () => {
      const bills = [
        { billNumber: 'SB1', shortTitle: 'Updated Bill', status: 'Passed' }
      ];
      
      billDatabase.getBill.mockResolvedValue({ billNumber: 'SB1', shortTitle: 'Old Title' });
      
      const result = await scheduler.saveBillsToDatabase(bills);
      
      expect(result.saved).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should handle individual bill save errors', async () => {
      const bills = [
        { billNumber: 'SB1', shortTitle: 'Good Bill', status: 'Filed' },
        { billNumber: 'SB2', shortTitle: 'Bad Bill', status: 'Filed' }
      ];
      
      billDatabase.getBill.mockResolvedValue(null);
      billDatabase.saveBill
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Save failed'));
      
      const result = await scheduler.saveBillsToDatabase(bills);
      
      expect(result.saved).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.errorDetails).toHaveLength(1);
      expect(result.errorDetails[0].billNumber).toBe('SB2');
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const delay1 = scheduler.calculateRetryDelay(1);
      const delay2 = scheduler.calculateRetryDelay(2);
      const delay3 = scheduler.calculateRetryDelay(3);
      
      expect(delay1).toBeGreaterThanOrEqual(5000); // Base delay + jitter
      expect(delay1).toBeLessThan(7000);
      
      expect(delay2).toBeGreaterThanOrEqual(10000); // 2x base delay + jitter
      expect(delay2).toBeLessThan(12000);
      
      expect(delay3).toBeGreaterThanOrEqual(20000); // 4x base delay + jitter
      expect(delay3).toBeLessThan(22000);
    });

    it('should cap delay at 60 seconds', () => {
      const delay = scheduler.calculateRetryDelay(10); // Very high attempt
      
      expect(delay).toBeLessThanOrEqual(60000);
    });
  });

  describe('getStatus', () => {
    it('should return correct status information', () => {
      scheduler.isRunning = true;
      scheduler.cronJob = mockCronJob;
      scheduler.lastRun = new Date('2024-01-01');
      scheduler.retryAttempts = 2;
      
      const status = scheduler.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.isScheduled).toBe(true);
      expect(status.lastRun).toEqual(new Date('2024-01-01'));
      expect(status.retryAttempts).toBe(2);
      expect(status.maxRetries).toBe(3);
    });
  });
});

describe('ScrapingLogger', () => {
  let logger;
  let consoleSpy;

  beforeEach(() => {
    logger = new ScrapingLogger();
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('logging levels', () => {
    it('should log error messages', () => {
      logger.error('Test error', new Error('Test'));
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Test error'),
        expect.any(Object)
      );
    });

    it('should log warning messages', () => {
      logger.warn('Test warning');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Test warning'),
        ''
      );
    });

    it('should log info messages', () => {
      logger.info('Test info');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test info'),
        ''
      );
    });

    it('should log debug messages when log level allows', () => {
      logger.logLevel = 'debug';
      logger.debug('Test debug');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Test debug'),
        ''
      );
    });

    it('should not log debug messages when log level is info', () => {
      logger.logLevel = 'info';
      logger.debug('Test debug');
      
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('shouldLog', () => {
    it('should respect log level hierarchy', () => {
      logger.logLevel = 'warn';
      
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });
  });
});