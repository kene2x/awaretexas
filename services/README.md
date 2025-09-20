# Automated Scraping Scheduler

This service provides automated scraping of Texas Senate bills with retry logic, error handling, and comprehensive logging.

## Features

- **Daily Scheduling**: Automatically scrapes bills at 6:00 AM Central Time
- **Retry Logic**: Exponential backoff with up to 3 retry attempts
- **Error Handling**: Graceful handling of scraping failures with fallback mechanisms
- **Logging**: Comprehensive logging system with configurable log levels
- **Database Integration**: Automatic saving of scraped bills to Firebase
- **API Management**: RESTful endpoints for scheduler control and monitoring

## Usage

### Basic Setup

```javascript
const { scrapingScheduler } = require('./services/scheduler');

// Initialize the scheduler
await scrapingScheduler.initialize();

// Start automatic scheduling
scrapingScheduler.start();
```

### API Endpoints

The scheduler integrates with the Express server and provides these endpoints:

- `GET /api/scheduler/status` - Get current scheduler status
- `POST /api/scheduler/start` - Start the automated scheduler
- `POST /api/scheduler/stop` - Stop the automated scheduler  
- `POST /api/scheduler/run` - Trigger manual scraping

### Manual Control

```javascript
// Manual scraping
const result = await scrapingScheduler.runManualScrape();
console.log('Scraping result:', result);

// Get status
const status = scrapingScheduler.getStatus();
console.log('Scheduler status:', status);

// Stop scheduler
scrapingScheduler.stop();
```

## Configuration

### Environment Variables

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Firebase configuration (required)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### Scheduler Settings

The scheduler can be configured by modifying the constructor parameters:

```javascript
class ScrapingScheduler {
  constructor() {
    this.maxRetries = 3;           // Maximum retry attempts
    this.baseRetryDelay = 5000;    // Base delay in milliseconds
    // ... other settings
  }
}
```

## Retry Logic

The scheduler implements exponential backoff for failed scraping attempts:

- **Attempt 1**: ~5 seconds delay
- **Attempt 2**: ~10 seconds delay  
- **Attempt 3**: ~20 seconds delay
- **Maximum delay**: Capped at 60 seconds

Each delay includes random jitter to prevent thundering herd problems.

## Logging

The logging system supports multiple levels:

- **ERROR**: Critical failures and exceptions
- **WARN**: Non-critical issues and warnings
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information

### Log Format

```
[2024-01-01T12:00:00.000Z] INFO: Scraping completed successfully. Processed 25 bills
[2024-01-01T12:00:01.000Z] ERROR: Failed to save bill SB123 { message: "Validation failed" }
```

## Error Handling

The scheduler handles various error scenarios:

### Scraping Errors
- Network timeouts and connection failures
- Website structure changes
- Invalid or missing bill data

### Database Errors
- Connection failures
- Validation errors
- Individual bill save failures

### Recovery Mechanisms
- Automatic retry with exponential backoff
- Graceful degradation (continue with partial data)
- Comprehensive error logging for debugging

## Monitoring

### Status Information

```javascript
const status = scrapingScheduler.getStatus();
// Returns:
{
  isRunning: false,
  isScheduled: true,
  lastRun: "2024-01-01T06:00:00.000Z",
  nextRun: "2024-01-02T06:00:00.000Z", 
  retryAttempts: 0,
  maxRetries: 3
}
```

### Health Checks

The scheduler integrates with the application health check system:

```bash
curl http://localhost:3000/api/scheduler/status
```

## Testing

### Unit Tests

```bash
npm test -- tests/services/scheduler.simple.test.js
```

### Integration Testing

```bash
node scripts/test-scheduler-simple.js
```

### Manual Testing

```bash
# Test basic functionality
node scripts/test-scheduler-simple.js

# Test with mocked dependencies  
npm test -- tests/services/scheduler.simple.test.js
```

## Production Deployment

### 1. Environment Setup

Ensure all required environment variables are configured:

```bash
# .env file
LOG_LEVEL=info
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

### 2. Server Integration

The scheduler automatically starts when the server starts:

```javascript
// In backend/server.js
const { scrapingScheduler } = require('../services/scheduler');

// Initialize on server startup
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await scrapingScheduler.initialize();
  scrapingScheduler.start();
});
```

### 3. Monitoring Setup

Monitor the scheduler through:
- Application logs
- API status endpoints
- Database metrics
- Error tracking services

## Troubleshooting

### Common Issues

**Scheduler won't start**
- Check Firebase credentials
- Verify database connectivity
- Review application logs

**Scraping failures**
- Check Texas Legislature website availability
- Verify network connectivity
- Review scraper error logs

**Database errors**
- Confirm Firebase configuration
- Check database permissions
- Monitor connection limits

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cron Job      │───▶│  Scraper Service │───▶│   Database      │
│  (6:00 AM CT)   │    │  (with retries)  │    │   (Firebase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Scheduler     │    │   Error Handler  │    │   Logger        │
│   Controller    │    │   (Exponential   │    │   (Multi-level) │
│                 │    │    Backoff)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Requirements Fulfilled

This implementation satisfies all task requirements:

✅ **Node-cron job for periodic data updates (daily schedule)**
- Configured for 6:00 AM Central Time daily execution
- Automatic startup with server initialization

✅ **Scraper error handling with retry logic and exponential backoff**  
- Maximum 3 retry attempts with exponential delays
- Jitter added to prevent thundering herd issues
- Graceful handling of various error types

✅ **Data storage functionality to save scraped bills to Firebase**
- Integration with existing bill database service
- Batch processing with individual error handling
- Update existing bills and create new ones

✅ **Logging system for scraper operations and failures**
- Multi-level logging (ERROR, WARN, INFO, DEBUG)
- Structured log format with timestamps
- Comprehensive error details and stack traces