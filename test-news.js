// Test news service
require('dotenv').config();
const { newsService } = require('./services/news');

async function testNews() {
  try {
    console.log('🧪 Testing news service...');
    console.log('📰 API Key configured:', !!process.env.NEWS_API_KEY);
    console.log('🔑 API Key (first 10 chars):', process.env.NEWS_API_KEY ? process.env.NEWS_API_KEY.substring(0, 10) + '...' : 'Not set');
    
    console.log('🚀 Initializing service...');
    await newsService.initialize();
    console.log('✅ Service initialized:', newsService.isInitialized);
    
    console.log('🔗 Testing connection...');
    const testConnection = await newsService.testConnection();
    console.log('📡 Connection test result:', testConnection);
    
    // Test with a simple bill
    const testBill = {
      billNumber: 'SB 1',
      shortTitle: 'General Appropriations Bill',
      topics: ['Budget', 'Appropriations']
    };
    
    console.log('🔍 Testing news fetch for SB 1...');
    const articles = await newsService.getNewsForBill('SB1', testBill);
    console.log('📊 Articles found:', articles.length);
    
    if (articles.length > 0) {
      console.log('📰 Sample articles:');
      articles.slice(0, 2).forEach((article, i) => {
        console.log(`  ${i + 1}. ${article.headline}`);
        console.log(`     Source: ${article.source}`);
        console.log(`     URL: ${article.url}`);
      });
    } else {
      console.log('❌ No articles found');
    }
    
  } catch (error) {
    console.error('❌ News test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testNews();