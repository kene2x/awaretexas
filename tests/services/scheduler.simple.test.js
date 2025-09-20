const { ScrapingScheduler, ScrapingLogger } = require('../../services/scheduler');

// Simple integration test to verify the scheduler works
describe('ScrapingScheduler Integration', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new ScrapingScheduler();
  });

  test('should create scheduler instance', () => {
    expect(scheduler).toBeDefined();
    expect(scheduler.isRunning).toBe(false);
    expect(scheduler.maxRetries).toBe(3);
  });

  test('should calculate retry delay correctly', () => {
    const delay1 = scheduler.calculateRetryDelay(1);
    const delay2 = scheduler.calculateRetryDelay(2);
    
    expect(delay1).toBeGreaterThanOrEqual(5000);
    expect(delay2).toBeGreaterThan(delay1);
    expect(scheduler.calculateRetryDelay(10)).toBeLessThanOrEqual(60000);
  });

  test('should get status information', () => {
    const status = scheduler.getStatus();
    
    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('isScheduled');
    expect(status).toHaveProperty('maxRetries');
    expect(status.maxRetries).toBe(3);
  });
});

describe('ScrapingLogger', () => {
  let logger;

  beforeEach(() => {
    logger = new ScrapingLogger();
  });

  test('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.logLevel).toBe('info');
  });

  test('should respect log level hierarchy', () => {
    logger.logLevel = 'warn';
    
    expect(logger.shouldLog('error')).toBe(true);
    expect(logger.shouldLog('warn')).toBe(true);
    expect(logger.shouldLog('info')).toBe(false);
    expect(logger.shouldLog('debug')).toBe(false);
  });
});