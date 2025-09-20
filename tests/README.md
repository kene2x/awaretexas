# Texas Senate Bill Tracker - Test Suite

This directory contains a comprehensive test suite for the Texas Senate Bill Tracker application, covering all aspects of the system from unit tests to end-to-end workflows.

## Test Structure

```
tests/
├── services/           # Unit tests for service classes
├── models/            # Unit tests for data models
├── integration/       # API integration tests
├── e2e/              # End-to-end user workflow tests
├── frontend/         # Frontend component tests
├── performance/      # Performance and load tests
├── fixtures/         # Test data and mock HTML files
├── utils/           # Test utilities and helpers
├── setup.js         # Test environment setup
├── global-setup.js  # Global test initialization
└── global-teardown.js # Global test cleanup
```

## Test Categories

### 1. Unit Tests (`tests/services/`, `tests/models/`)

**Purpose**: Test individual components in isolation
**Coverage**: 
- AI Summary Service (`ai-summary.test.js`)
- News Service (`news.test.js`)
- Scraper Service (`scraper.test.js`)
- Scheduler Service (`scheduler.test.js`)
- Bill Model (`models/Bill.test.js`)

**Key Features**:
- Mock external dependencies (APIs, databases)
- Test error handling and edge cases
- Validate data transformation and business logic
- Test caching mechanisms and performance optimizations

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test API endpoints with mocked external services
**Coverage**:
- Bills API endpoints (`/api/bills`, `/api/bills/:id`)
- Summary API endpoints (`/api/bills/summary/:id`)
- News API endpoints (`/api/bills/news/:id`)
- Error handling and validation
- CORS and security headers

**Key Features**:
- Test complete request/response cycles
- Validate API response formats
- Test filtering, pagination, and search
- Test concurrent request handling

### 3. End-to-End Tests (`tests/e2e/`)

**Purpose**: Test complete user workflows from start to finish
**Coverage**:
- Homepage browsing to bill details
- Search and filtering workflows
- Reading level switching
- Error recovery scenarios
- Data consistency across requests

**Key Features**:
- Simulate real user interactions
- Test multiple API calls in sequence
- Validate data flow between components
- Test system behavior under various conditions

### 4. Frontend Tests (`tests/frontend/`)

**Purpose**: Test frontend components and user interactions
**Coverage**:
- BillTracker component functionality
- Search and filtering logic
- Bill card rendering and interactions
- Error handling and loading states
- Accessibility features

**Key Features**:
- DOM manipulation testing
- Event handling validation
- User interaction simulation
- Accessibility compliance testing

### 5. Performance Tests (`tests/performance/`)

**Purpose**: Test system performance under load
**Coverage**:
- API response times
- Concurrent request handling
- Memory usage optimization
- Database query performance
- Service integration performance

**Key Features**:
- Load testing with large datasets
- Concurrent user simulation
- Memory leak detection
- Performance regression testing

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:frontend     # Frontend tests only
npm run test:performance  # Performance tests only
```

### Coverage Reports
```bash
npm run test:coverage     # Generate coverage report
npm run test:ci          # CI/CD optimized test run
```

### Watch Mode
```bash
npm run test:watch       # Run tests in watch mode
```

## Test Utilities

### MockDataGenerator
Generates consistent test data for bills, news articles, and summaries.

```javascript
const { MockDataGenerator } = require('./utils/test-helpers');

const testBill = MockDataGenerator.generateBill({
  billNumber: 'SB123',
  status: 'Filed'
});
```

### DatabaseMockHelper
Provides utilities for mocking database operations.

```javascript
const { DatabaseMockHelper } = require('./utils/test-helpers');

const mockDb = DatabaseMockHelper.createMockDb();
DatabaseMockHelper.mockSingleBill(mockDb, testBill);
```

### ApiResponseValidator
Validates API response formats and structures.

```javascript
const { ApiResponseValidator } = require('./utils/test-helpers');

ApiResponseValidator.validateBillsResponse(response);
```

### PerformanceTestHelper
Measures response times, memory usage, and concurrent performance.

```javascript
const { PerformanceTestHelper } = require('./utils/test-helpers');

const { result, responseTime } = await PerformanceTestHelper.measureResponseTime(
  () => request(app).get('/api/bills')
);
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Separate test environments for different test types
- Coverage thresholds and reporting
- Timeout configurations for performance tests
- Module name mapping for clean imports

### Environment Setup
- Automatic mock setup for external services
- Test database configuration
- Environment variable management
- Console output suppression during tests

## Coverage Requirements

The test suite maintains the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 75%
- **Statements**: 75%

## Best Practices

### 1. Test Isolation
- Each test should be independent and not rely on other tests
- Use `beforeEach` and `afterEach` for setup and cleanup
- Mock external dependencies consistently

### 2. Descriptive Test Names
- Use clear, descriptive test names that explain what is being tested
- Follow the pattern: "should [expected behavior] when [condition]"

### 3. Comprehensive Error Testing
- Test both success and failure scenarios
- Validate error messages and status codes
- Test edge cases and boundary conditions

### 4. Performance Considerations
- Set appropriate timeouts for different test types
- Use `--runInBand` for tests that might conflict
- Monitor memory usage in performance tests

### 5. Mock Management
- Keep mocks simple and focused
- Reset mocks between tests
- Use realistic mock data that reflects production scenarios

## Continuous Integration

The test suite is designed to run in CI/CD environments with:
- Deterministic test execution
- Proper cleanup and resource management
- Comprehensive coverage reporting
- Performance regression detection

## Debugging Tests

### Running Individual Tests
```bash
npx jest tests/services/ai-summary.test.js
```

### Debug Mode
```bash
npx jest --detectOpenHandles --forceExit tests/specific-test.js
```

### Verbose Output
```bash
npx jest --verbose tests/
```

## Contributing

When adding new features:
1. Write tests before implementing functionality (TDD)
2. Ensure all test categories are covered
3. Update test documentation
4. Maintain coverage thresholds
5. Add performance tests for new endpoints

## Requirements Validation

This test suite validates all requirements from the specification:

### Requirement 1 (Homepage Grid Layout)
- ✅ Responsive grid rendering tests
- ✅ Bill card component tests
- ✅ Hover preview functionality tests
- ✅ Texas flag color theme validation

### Requirement 2 (Search and Filtering)
- ✅ Live search functionality tests
- ✅ Multi-select filter tests
- ✅ Clear filters functionality tests
- ✅ Filter combination tests

### Requirement 3 (Bill Detail Page)
- ✅ Bill detail rendering tests
- ✅ Sponsor information display tests
- ✅ Official link functionality tests
- ✅ Navigation tests

### Requirement 4 (AI Summaries)
- ✅ Summary generation tests
- ✅ Reading level switching tests
- ✅ Caching mechanism tests
- ✅ Error handling tests

### Requirement 5 (Automated Scraping)
- ✅ Scraper functionality tests
- ✅ Data validation tests
- ✅ Error handling tests
- ✅ Scheduler tests

### Requirement 6 (Performance and UX)
- ✅ Loading state tests
- ✅ Error handling tests
- ✅ Caching performance tests
- ✅ Responsive design tests

### Requirement 7 (News Integration)
- ✅ News fetching tests
- ✅ Article display tests
- ✅ Error handling tests
- ✅ Loading indicator tests

All requirements are comprehensively tested with both positive and negative test cases, ensuring robust validation of the complete system functionality.