// Test bill text scraping from Texas Legislature website
require('dotenv').config();
const TexasLegislatureScraper = require('./services/scraper');

async function testBillTextScraping() {
  try {
    console.log('🧪 Testing bill text scraping...');
    
    const scraper = new TexasLegislatureScraper();
    
    // Test with a few real bill numbers
    const testBills = ['SB1', 'SB2', 'HB1'];
    
    for (const billNumber of testBills) {
      console.log(`\n📄 Testing bill text extraction for ${billNumber}:`);
      
      try {
        const result = await scraper.fetchBillText(billNumber);
        
        if (result.billText && result.billText.length > 0) {
          console.log(`✅ Successfully extracted bill text for ${billNumber}`);
          console.log(`📊 Text length: ${result.billText.length} characters`);
          console.log(`📝 First 200 characters: ${result.billText.substring(0, 200)}...`);
        } else {
          console.log(`❌ No bill text found for ${billNumber}`);
        }
        
        if (result.summary && result.summary.length > 0) {
          console.log(`📋 Summary found: ${result.summary.length} characters`);
          console.log(`📝 Summary: ${result.summary.substring(0, 150)}...`);
        }
      } catch (error) {
        console.error(`❌ Error extracting text for ${billNumber}:`, error.message);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBillTextScraping();