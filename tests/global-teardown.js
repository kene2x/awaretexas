// Global test teardown
module.exports = async () => {
  // Restore console methods
  if (global.originalConsole) {
    console.log = global.originalConsole.log;
    console.warn = global.originalConsole.warn;
    console.error = global.originalConsole.error;
    console.info = global.originalConsole.info;
  }
  
  // Clean up environment variables
  delete process.env.GEMINI_API_KEY;
  delete process.env.NEWS_API_KEY;
  delete process.env.FIREBASE_PROJECT_ID;
  
  console.log('🧹 Test environment cleaned up');
};