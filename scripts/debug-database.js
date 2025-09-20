// Debug script to check what's in the database
require('dotenv').config();
const { databaseService } = require('../config/database');
const { billDatabase } = require('../config/bill-database');

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database connection...');
    
    // Initialize database connection
    await databaseService.connect();
    console.log('✅ Database connected');
    
    // Check if collections exist
    const db = databaseService.getDb();
    const billsCollection = db.collection('bills');
    
    // Get all documents in bills collection
    const snapshot = await billsCollection.get();
    console.log(`📊 Found ${snapshot.size} documents in bills collection`);
    
    if (snapshot.empty) {
      console.log('❌ Bills collection is empty!');
    } else {
      console.log('📋 Bills in database:');
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.billNumber}: ${data.shortTitle} (${data.status})`);
      });
    }
    
    // Test the billDatabase class
    console.log('\n🧪 Testing billDatabase.getAllBills()...');
    const bills = await billDatabase.getAllBills();
    console.log(`📊 billDatabase.getAllBills() returned ${bills.length} bills`);
    
    bills.forEach(bill => {
      console.log(`  - ${bill.billNumber}: ${bill.shortTitle} (${bill.status})`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

debugDatabase();