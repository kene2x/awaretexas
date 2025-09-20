// Main database configuration and utilities export
const { initializeFirebase, admin } = require('./firebase');
const { DatabaseService, databaseService } = require('./database');
const { CrudOperations, crudOperations } = require('./crud-operations');
const { BillDatabase, billDatabase } = require('./bill-database');
const { SummaryDatabase, summaryDatabase } = require('./summary-database');
const { NewsDatabase, newsDatabase } = require('./news-database');

// Initialize database and collections
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database connection...');
    
    // Connect to Firebase
    await databaseService.connect();
    
    // Initialize collections
    await databaseService.initializeCollections();
    
    console.log('✅ Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

// Health check function
async function checkDatabaseHealth() {
  try {
    const db = databaseService.getDb();
    
    // Test basic connectivity by reading a small document
    const testRef = db.collection('bills').limit(1);
    await testRef.get();
    
    return {
      status: 'healthy',
      connected: databaseService.isConnected,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Graceful shutdown
async function closeDatabaseConnection() {
  try {
    if (databaseService.isConnected) {
      // Firebase Admin SDK doesn't require explicit connection closing
      // but we can mark as disconnected
      databaseService.isConnected = false;
      console.log('✅ Database connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
  }
}

module.exports = {
  // Firebase core
  initializeFirebase,
  admin,
  
  // Database service
  DatabaseService,
  databaseService,
  
  // CRUD operations
  CrudOperations,
  crudOperations,
  
  // Specialized databases
  BillDatabase,
  billDatabase,
  SummaryDatabase,
  summaryDatabase,
  NewsDatabase,
  newsDatabase,
  
  // Utility functions
  initializeDatabase,
  checkDatabaseHealth,
  closeDatabaseConnection
};