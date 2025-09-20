// Update test bills with real bill text from Texas Legislature
require('dotenv').config();
const TexasLegislatureScraper = require('./services/scraper');
const { billDatabase } = require('./config/bill-database');
const { databaseService } = require('./config/database');

async function updateBillsWithRealText() {
  try {
    console.log('🔄 Updating bills with real text from Texas Legislature...');
    
    // Connect to database
    await databaseService.connect();
    
    const scraper = new TexasLegislatureScraper();
    
    // Test bills to update
    const testBills = ['SB1', 'SB2', 'HB1'];
    
    for (const billNumber of testBills) {
      console.log(`\n📄 Updating ${billNumber}...`);
      
      try {
        // Fetch real bill text and summary
        const result = await scraper.fetchBillText(billNumber);
        
        if (result.billText || result.summary) {
          // Get existing bill data
          const existingBill = await billDatabase.getBill(billNumber);
          
          if (existingBill) {
            // Update with real text
            const updatedBill = {
              ...existingBill,
              billText: result.billText || existingBill.billText || '',
              abstract: result.summary || existingBill.abstract || '',
              lastUpdated: new Date()
            };
            
            // Save updated bill
            await billDatabase.saveBill(updatedBill);
            
            console.log(`✅ Updated ${billNumber}:`);
            console.log(`  - Bill text: ${updatedBill.billText.length} characters`);
            console.log(`  - Summary: ${updatedBill.abstract.length} characters`);
          } else {
            console.log(`❌ Bill ${billNumber} not found in database`);
          }
        } else {
          console.log(`❌ No content found for ${billNumber}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${billNumber}:`, error.message);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎉 Bill update completed!');
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

updateBillsWithRealText();