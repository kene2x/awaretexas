# Database Configuration and Utilities

This directory contains Firebase Firestore database configuration and utility functions for the Texas Senate Bill Tracker application.

## Files Overview

### Core Configuration
- `firebase.js` - Firebase Admin SDK initialization and configuration
- `database.js` - Main database service with connection management
- `index.js` - Main export file with initialization functions

### CRUD Operations
- `crud-operations.js` - Generic CRUD operations for all collections
- `bill-database.js` - Specialized operations for Bills collection
- `summary-database.js` - Specialized operations for AI Summaries collection  
- `news-database.js` - Specialized operations for News cache collection

## Quick Start

### 1. Environment Setup
Copy `.env.example` to `.env` and configure your Firebase credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Your service account private key
- `FIREBASE_CLIENT_EMAIL` - Your service account email
- `FIREBASE_CLIENT_ID` - Your service account client ID

### 2. Initialize Database

```javascript
const { initializeDatabase } = require('./config');

async function setup() {
  try {
    await initializeDatabase();
    console.log('Database ready!');
  } catch (error) {
    console.error('Setup failed:', error.message);
  }
}
```

### 3. Basic Usage

```javascript
const { billDatabase, summaryDatabase, newsDatabase } = require('./config');

// Save a bill
const bill = {
  billNumber: 'SB123',
  shortTitle: 'Education Reform Bill',
  status: 'Filed',
  sponsors: [{ name: 'John Doe', district: '15' }]
};
await billDatabase.saveBill(bill);

// Get all bills
const bills = await billDatabase.getAllBills();

// Save AI summary
await summaryDatabase.saveSummary('SB123', {
  'high-level': 'This bill reforms education funding.',
  'detailed': 'This comprehensive bill addresses...'
});

// Cache news articles
await newsDatabase.saveNews('SB123', [
  {
    headline: 'New Education Bill Filed',
    source: 'Texas Tribune',
    url: 'https://example.com/news'
  }
]);
```

## Database Schema

### Bills Collection
```javascript
{
  id: string,              // Document ID (same as billNumber)
  billNumber: string,      // e.g., "SB123"
  shortTitle: string,      // Brief title
  fullTitle: string,       // Complete official title
  status: string,          // "Filed" | "In Committee" | "Passed"
  sponsors: Array,         // Array of sponsor objects
  officialUrl: string,     // Link to TLO page
  billText: string,        // Full bill text
  abstract: string,        // Bill abstract/summary
  committee: string,       // Committee name (optional)
  coSponsors: Array,       // Co-sponsor names (optional)
  filedDate: Date,         // When bill was filed (optional)
  topics: Array,           // AI-classified topics
  createdAt: Date,         // Auto-generated
  lastUpdated: Date        // Auto-generated
}
```

### Summaries Collection
```javascript
{
  id: string,              // Document ID (same as billId)
  billId: string,          // Reference to bill
  summaries: {
    "high-level": string,  // Simple summary
    "detailed": string     // Comprehensive summary
  },
  generatedAt: Date,       // When AI generated
  cached: boolean,         // Cache status
  createdAt: Date,         // Auto-generated
  lastUpdated: Date        // Auto-generated
}
```

### News Collection
```javascript
{
  id: string,              // Document ID (same as billId)
  billId: string,          // Reference to bill
  articles: [{
    headline: string,      // Article title
    source: string,        // News source name
    url: string,           // Article URL
    publishedAt: Date      // Publication date (optional)
  }],
  lastFetched: Date,       // When news was fetched
  createdAt: Date,         // Auto-generated
  lastUpdated: Date        // Auto-generated
}
```

## Error Handling

All database operations include comprehensive error handling:

- **Connection Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Clear messages for invalid data
- **Not Found**: Returns `null` instead of throwing errors
- **Batch Operations**: Atomic transactions with rollback on failure

## Testing

### Unit Tests
```bash
npm test -- tests/database.test.js
```

### Integration Tests
```bash
node scripts/test-database.js
```

The integration test requires valid Firebase credentials in your `.env` file.

## Performance Considerations

### Caching Strategy
- **Summaries**: Cached for 24 hours by default
- **News**: Cached for 6 hours by default
- **Bills**: Updated on each scraping run

### Query Optimization
- Use `limit()` for large result sets
- Filter by indexed fields (status, sponsors)
- Batch operations for multiple writes

### Connection Management
- Singleton pattern for database connections
- Automatic connection pooling via Firebase SDK
- Graceful shutdown handling

## Security

### Access Control
- Firebase security rules should restrict access
- Service account credentials in environment variables only
- No client-side database access

### Data Validation
- All inputs validated before database operations
- Required fields enforced
- Data type checking for all fields

## Monitoring

### Health Checks
```javascript
const { checkDatabaseHealth } = require('./config');

const health = await checkDatabaseHealth();
console.log(health.status); // 'healthy' or 'unhealthy'
```

### Logging
- All operations logged with timestamps
- Error details captured for debugging
- Success/failure indicators for monitoring

## Maintenance

### Cleanup Operations
```javascript
// Clean up old news cache (older than 1 week)
await newsDatabase.cleanupOldNews(168);
```

### Backup Considerations
- Firebase automatically handles backups
- Export data using Firebase Admin SDK if needed
- Consider implementing periodic data exports

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check Firebase credentials in `.env`
   - Verify project ID and service account permissions
   - Ensure network connectivity

2. **Validation Errors**
   - Check required fields are present
   - Verify data types match schema
   - Ensure arrays are properly formatted

3. **Permission Denied**
   - Check Firebase security rules
   - Verify service account has proper roles
   - Ensure project ID is correct

### Debug Mode
Set `NODE_ENV=development` for verbose logging and error details.