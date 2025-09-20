#!/usr/bin/env node

/**
 * Test script for News API integration service
 * 
 * This script demonstrates the news service functionality:
 * - Service initialization
 * - News fetching for sample bills
 * - Caching behavior
 * - Error handling
 */

require('dotenv').config();
const { newsService } = require('../services/news');

// Sample bill data for testing
const sampleBills = [
  {
    id: 'sb123',
    billNumber: 'SB123',
    shortTitle: 'Education Funding Reform Act',
    fullTitle: 'An Act relating to public school finance reform and education funding',
    topics: ['Education', 'Finance'],
    status: 'In Committee'
  },
  {
    id: 'sb456',
    billNumber: 'SB456',
    shortTitle: 'Healthcare Access Improvement',
    fullTitle: 'An Act relating to healthcare access and medical insurance reform',
    topics: ['Healthcare', 'Insurance'],
    status: 'Filed'
  },
  {
    id: 'sb789',
    billNumber: 'SB789',
    shortTitle: 'Transportation Infrastructure',
    fullTitle: 'An Act relating to highway construction and transportation funding',
    topics: ['Transportation', 'Infrastructure'],
    status: 'Passed'
  }
];

async function testNewsService() {
  console.log('🧪 Testing News API Integration Service\n');
  
  try {
    // Test 1: Service Status (before initialization)
    console.log('📊 Service Status (before init):');
    console.log(JSON.stringify(newsService.getStatus(), null, 2));
    console.log();
    
    // Test 2: Initialize service
    console.log('🚀 Initializing News API service...');
    await newsService.initialize();
    console.log();
    
    // Test 3: Service Status (after initialization)
    console.log('📊 Service Status (after init):');
    console.log(JSON.stringify(newsService.getStatus(), null, 2));
    console.log();
    
    // Test 4: Connection test
    console.log('🔗 Testing API connection...');
    const connectionOk = await newsService.testConnection();
    console.log(`Connection status: ${connectionOk ? '✅ Success' : '❌ Failed'}`);
    console.log();
    
    // Test 5: Fetch news for sample bills
    console.log('📰 Fetching news for sample bills...\n');
    
    for (const bill of sampleBills) {
      console.log(`--- Testing Bill: ${bill.billNumber} ---`);
      console.log(`Title: ${bill.shortTitle}`);
      console.log(`Topics: ${bill.topics.join(', ')}`);
      
      try {
        const startTime = Date.now();
        const articles = await newsService.getNewsForBill(bill.id, bill);
        const endTime = Date.now();
        
        console.log(`⏱️  Fetch time: ${endTime - startTime}ms`);
        console.log(`📄 Found ${articles.length} articles:`);
        
        articles.forEach((article, index) => {
          console.log(`  ${index + 1}. ${article.headline}`);
          console.log(`     Source: ${article.source}`);
          console.log(`     URL: ${article.url}`);
          console.log(`     Published: ${article.publishedAt.toLocaleDateString()}`);
          if (article.isError) {
            console.log(`     ⚠️  Error article: ${article.description}`);
          }
          console.log();
        });
        
      } catch (error) {
        console.error(`❌ Error fetching news for ${bill.billNumber}:`, error.message);
      }
      
      console.log('---\n');
    }
    
    // Test 6: Test caching behavior
    console.log('💾 Testing cache behavior...');
    console.log('Fetching news for first bill again (should use cache):');
    
    const startTime = Date.now();
    const cachedArticles = await newsService.getNewsForBill(sampleBills[0].id, sampleBills[0]);
    const endTime = Date.now();
    
    console.log(`⏱️  Cached fetch time: ${endTime - startTime}ms`);
    console.log(`📄 Cached articles: ${cachedArticles.length}`);
    console.log();
    
    // Test 7: Cache management
    console.log('🗑️  Testing cache management...');
    console.log(`Cache size before clear: ${newsService.getStatus().cacheSize}`);
    
    newsService.clearCache(sampleBills[0].id);
    console.log(`Cache size after clearing one bill: ${newsService.getStatus().cacheSize}`);
    
    newsService.clearCache();
    console.log(`Cache size after clearing all: ${newsService.getStatus().cacheSize}`);
    console.log();
    
    // Test 8: Error handling
    console.log('⚠️  Testing error handling...');
    try {
      await newsService.getNewsForBill(null, sampleBills[0]);
    } catch (error) {
      console.log(`✅ Correctly caught validation error: ${error.message}`);
    }
    
    try {
      await newsService.getNewsForBill('test', null);
    } catch (error) {
      console.log(`✅ Correctly caught validation error: ${error.message}`);
    }
    console.log();
    
    // Test 9: Keyword extraction
    console.log('🔍 Testing keyword extraction...');
    sampleBills.forEach(bill => {
      const keywords = newsService.extractKeywords(bill);
      console.log(`${bill.billNumber}: [${keywords.join(', ')}]`);
    });
    console.log();
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
if (require.main === module) {
  testNewsService().catch(error => {
    console.error('❌ Test script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testNewsService };