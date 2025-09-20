// Global test setup
module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.NEWS_API_KEY = 'test-news-key';
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  
  // Suppress console output during tests
  global.originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };
  
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
  
  console.log('🧪 Test environment initialized');
};