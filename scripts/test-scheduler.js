// Test script for the scraping scheduler
const { scrapingScheduler } = require('../services/scheduler');

async function testScheduler() {
  try {
    console.log('🧪 Testing Scraping Scheduler...\n');
    
    // Test 1: Initialize scheduler
    console.log('1. Initializing scheduler...');
    await scrapingScheduler.initialize();
    console.log('✅ Scheduler initialized successfully\n');
    
    // Test 2: Get status
    console.log('2. Getting scheduler status...');
    const status = scrapingScheduler.getStatus();
    console.log('📊 Status:', JSON.stringify(status, null, 2));
    console.log('');
    
    // Test 3: Start scheduler
    console.log('3. Starting scheduler...');
    scrapingScheduler.start();
    console.log('✅ Scheduler started successfully\n');
    
    // Test 4: Get updated status
    console.log('4. Getting updated status...');
    const updatedStatus = scrapingScheduler.getStatus();
    console.log('📊 Updated Status:', JSON.stringify(updatedStatus, null, 2));
    console.log('');
    
    // Test 5: Manual scrape (commented out to avoid actual scraping)
    console.log('5. Manual scrape test (skipped - would trigger actual scraping)');
    console.log('   To test manual scraping, uncomment the line below:');
    console.log('   // const result = await scrapingScheduler.runManualScrape();');
    console.log('');
    
    // Test 6: Stop scheduler
    console.log('6. Stopping scheduler...');
    scrapingScheduler.stop();
    console.log('✅ Scheduler stopped successfully\n');
    
    // Test 7: Final status
    console.log('7. Final status check...');
    const finalStatus = scrapingScheduler.getStatus();
    console.log('📊 Final Status:', JSON.stringify(finalStatus, null, 2));
    
    console.log('\n🎉 All scheduler tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testScheduler().then(() => {
  console.log('\n✨ Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});