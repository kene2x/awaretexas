// Test script to manually run the scraper and populate database
require('dotenv').config();
const TexasLegislatureScraper = require('../services/scraper');
const { databaseService } = require('../config/database');
const { billDatabase } = require('../config/bill-database');

async function testScraper() {
  try {
    console.log('🔄 Starting scraper test...');
    
    // Initialize database connection
    await databaseService.connect();
    await databaseService.initializeCollections();
    
    // Create scraper instance
    const scraper = new TexasLegislatureScraper();
    
    // Scrape a limited number of bills for testing (first 5)
    console.log('🕷️ Scraping bills from Texas Legislature website...');
    const bills = await scraper.scrapeBillsWithDetails(5);
    
    console.log(`📊 Found ${bills.length} bills`);
    
    // Save bills to database
    let savedCount = 0;
    for (const bill of bills) {
      try {
        await billDatabase.saveBill(bill);
        savedCount++;
        console.log(`✅ Saved: ${bill.billNumber} - ${bill.shortTitle}`);
      } catch (error) {
        console.error(`❌ Failed to save ${bill.billNumber}:`, error.message);
      }
    }
    
    console.log(`🎉 Scraper test complete! Saved ${savedCount} bills to database.`);
    console.log('🌐 You can now visit http://localhost:3000 to see the bills!');
    
  } catch (error) {
    console.error('❌ Scraper test failed:', error.message);
    
    if (error.message.includes('cheerio')) {
      console.log('💡 This might be a scraping issue. The Texas Legislature website might be down or changed.');
    } else if (error.message.includes('Database')) {
      console.log('💡 Database connection issue. Check your Firebase credentials.');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log('💡 Network issue. Check your internet connection.');
    }
  }
  
  process.exit(0);
}

testScraper();