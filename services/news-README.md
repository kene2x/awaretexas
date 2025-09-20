# News API Integration Service

This service provides news article fetching functionality for the Texas Senate Bill Tracker using the News API.

## Features

- **Intelligent Keyword Search**: Extracts relevant keywords from bill data for targeted news searches
- **Article Caching**: Caches news articles in Firebase to avoid repeated API calls and improve performance
- **Rate Limiting**: Implements proper rate limiting to respect News API limits
- **Error Handling**: Graceful handling of API failures, rate limits, and network issues
- **Article Filtering**: Filters articles for relevance and removes irrelevant content (sports, entertainment, etc.)
- **Texas-Focused Sources**: Prioritizes Texas news sources for more relevant results

## Usage

### Basic Setup

```javascript
const { newsService } = require('./services/news');

// Initialize the service
await newsService.initialize();

// Fetch news for a bill
const articles = await newsService.getNewsForBill(billId, billData);
```

### Bill Data Format

```javascript
const billData = {
  billNumber: 'SB123',
  shortTitle: 'Education Funding Reform Act',
  fullTitle: 'An Act relating to public school finance reform',
  topics: ['Education', 'Finance'],
  status: 'In Committee'
};
```

### Article Response Format

```javascript
[
  {
    headline: 'Texas Senate Passes Education Funding Bill',
    source: 'Texas Tribune',
    url: 'https://texastribune.org/article',
    publishedAt: Date,
    description: 'Article description...',
    urlToImage: 'https://image-url.jpg'
  }
]
```

## Configuration

### Environment Variables

```bash
# Required
NEWS_API_KEY=your-news-api-key

# Optional (with defaults)
LOG_LEVEL=info
```

### Service Settings

The service can be configured by modifying the constructor parameters:

```javascript
class NewsService {
  constructor() {
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.rateLimitDelay = 1000;              // 1 second between requests
    this.maxArticles = 5;                    // Maximum articles per bill
  }
}
```

## API Methods

### Core Methods

#### `initialize()`
Initializes the News API service with the provided API key.

```javascript
await newsService.initialize();
```

#### `getNewsForBill(billId, billData)`
Fetches relevant news articles for a specific bill.

```javascript
const articles = await newsService.getNewsForBill('bill123', {
  billNumber: 'SB123',
  shortTitle: 'Education Reform',
  topics: ['Education']
});
```

#### `testConnection()`
Tests the News API connection.

```javascript
const isConnected = await newsService.testConnection();
```

### Utility Methods

#### `extractKeywords(billData)`
Extracts search keywords from bill data.

```javascript
const keywords = newsService.extractKeywords(billData);
// Returns: ['SB123', 'education', 'reform', 'Texas']
```

#### `clearCache(billId?)`
Clears cached news articles.

```javascript
// Clear specific bill cache
newsService.clearCache('bill123');

// Clear all cache
newsService.clearCache();
```

#### `getStatus()`
Returns service status and configuration.

```javascript
const status = newsService.getStatus();
// Returns: { isInitialized, cacheSize, maxArticles, ... }
```

## Caching Strategy

### Two-Level Caching

1. **Memory Cache**: Fast in-memory cache for frequently accessed articles
2. **Firebase Cache**: Persistent cache in Firebase Firestore

### Cache Expiry

- Articles are cached for 24 hours by default
- Cache is automatically invalidated after expiry
- Manual cache clearing is available

### Cache Keys

- Memory cache: `${billId}_timestamp`
- Firebase cache: Document ID = `billId` in `news_cache` collection

## Error Handling

### API Errors

- **Rate Limiting**: Automatic retry with exponential backoff
- **Authentication**: Clear error messages for invalid API keys
- **Network Issues**: Graceful fallback with cached data when available

### Fallback Behavior

When news fetching fails, the service returns a fallback article:

```javascript
[{
  headline: 'News articles temporarily unavailable',
  source: 'System',
  url: '#',
  publishedAt: new Date(),
  description: 'Unable to fetch news articles: [error message]',
  isError: true
}]
```

## Rate Limiting

### Implementation

- Minimum 1-second delay between API requests
- Automatic enforcement in `_enforceRateLimit()` method
- Prevents API quota exhaustion

### News API Limits

- Free tier: 1,000 requests per month
- Developer tier: 500 requests per day
- Business tier: Higher limits available

## Article Filtering

### Relevance Filtering

Articles are filtered based on:

1. **Bill Number Matching**: Direct mentions of the bill number
2. **Topic Relevance**: Matches with bill topics
3. **Content Quality**: Articles must have title and URL
4. **Irrelevant Content**: Filters out sports, entertainment, etc.

### Texas News Sources

Prioritized sources include:
- Texas Tribune (`texastribune.org`)
- Austin American-Statesman (`statesman.com`)
- Dallas Morning News (`dallasnews.com`)
- Houston Chronicle (`houstonchronicle.com`)
- San Antonio Express-News (`expressnews.com`)
- Fort Worth Star-Telegram (`star-telegram.com`)

## Testing

### Unit Tests

```bash
npm test -- tests/services/news.test.js
```

### Integration Testing

```bash
node scripts/test-news-service.js
```

### Manual Testing

```javascript
const { newsService } = require('./services/news');

// Test with sample bill
const articles = await newsService.getNewsForBill('test', {
  billNumber: 'SB123',
  shortTitle: 'Education Reform',
  topics: ['Education']
});

console.log('Found articles:', articles.length);
```

## Production Deployment

### 1. Environment Setup

```bash
# .env file
NEWS_API_KEY=your-production-api-key
LOG_LEVEL=info
```

### 2. Firebase Configuration

Ensure Firebase is configured for the `news_cache` collection:

```javascript
// Firebase security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /news_cache/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Monitoring

Monitor the service through:
- Application logs for API errors
- Firebase console for cache usage
- News API dashboard for quota usage

## Troubleshooting

### Common Issues

**Service won't initialize**
- Check `NEWS_API_KEY` environment variable
- Verify API key is valid and active
- Check network connectivity

**No articles returned**
- Verify bill data contains meaningful keywords
- Check if articles exist for the topic
- Review keyword extraction logic

**Rate limit errors**
- Monitor API usage in News API dashboard
- Consider upgrading API plan
- Implement longer caching periods

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

## Architecture Integration

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bill Detail   │───▶│   News Service   │───▶│   News API      │
│   Page          │    │   (with cache)   │    │   (External)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Firebase       │    │   Texas News    │
│   Display       │    │   Cache          │    │   Sources       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Requirements Fulfilled

This implementation satisfies all task requirements:

✅ **Implement news fetching service using News API**
- Complete NewsService class with News API integration
- Proper initialization and configuration management
- Error handling for API failures

✅ **Create methods to search for relevant articles by bill keywords**
- Intelligent keyword extraction from bill data
- Targeted search with Texas news sources
- Article relevance filtering and processing

✅ **Add news caching functionality to avoid repeated API calls**
- Two-level caching (memory + Firebase)
- 24-hour cache expiry with automatic invalidation
- Cache management and clearing functionality

✅ **Implement error handling for News API failures and rate limits**
- Comprehensive error handling for all failure scenarios
- Rate limiting with automatic enforcement
- Graceful fallback responses when APIs fail
- Specific handling for authentication and quota errors