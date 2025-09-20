#!/usr/bin/env node
// Integration test script for database utilities
// Run with: node scripts/test-database.js

require('dotenv').config();
const { 
  initializeDatabase, 
  checkDatabaseHealth,
  billDatabase,
  summaryDatabase,
  newsDatabase
} = require('../config/index');

async function testDatabaseIntegration() {
  console.log('🧪 Starting database integration tests...\n');

  try {
    // Test 1: Initialize database
    console.log('1️⃣ Testing database initialization...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully\n');

    // Test 2: Health check
    console.log('2️⃣ Testing database health check...');
    const health = await checkDatabaseHealth();
    console.log('Health status:', health);
    console.log('✅ Health check completed\n');

    // Test 3: Bill validation
    console.log('3️⃣ Testing bill validation...');
    const testBill = {
      billNumber: 'SB999',
      shortTitle: 'Test Integration Bill',
      fullTitle: 'A Bill to Test Database Integration',
      status: 'Filed',
      sponsors: [{ name: 'Test Sponsor', district: '1' }],
      topics: ['Testing'],
      officialUrl: 'https://example.com/bill/sb999',
      billText: 'This is a test bill for integration testing.',
      abstract: 'Test bill abstract for database integration.'
    };

    billDatabase.validateBillData(testBill);
    console.log('✅ Bill validation passed\n');

    // Test 4: Summary validation
    console.log('4️⃣ Testing summary validation...');
    const testSummaries = {
      'high-level': 'This is a high-level summary for testing.',
      'detailed': 'This is a detailed summary for comprehensive testing of the database utilities.'
    };

    summaryDatabase.validateSummaryData(testSummaries);
    console.log('✅ Summary validation passed\n');

    // Test 5: News validation
    console.log('5️⃣ Testing news validation...');
    const testNews = [
      {
        headline: 'Test News Article About Bill',
        source: 'Test News Source',
        url: 'https://example.com/news/test-article',
        publishedAt: new Date()
      }
    ];

    newsDatabase.validateNewsData(testNews);
    console.log('✅ News validation passed\n');

    console.log('🎉 All database integration tests passed!');
    console.log('\n📝 Note: This test only validates data structures and basic connectivity.');
    console.log('   For full CRUD testing, ensure Firebase credentials are properly configured.');

  } catch (error) {
    console.error('❌ Database integration test failed:', error.message);
    
    if (error.message.includes('Database connection failed')) {
      console.log('\n💡 Tip: Make sure your .env file has valid Firebase credentials:');
      console.log('   - FIREBASE_PROJECT_ID');
      console.log('   - FIREBASE_PRIVATE_KEY');
      console.log('   - FIREBASE_CLIENT_EMAIL');
      console.log('   - etc.');
    }
    
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabaseIntegration();
}

module.exports = { testDatabaseIntegration };