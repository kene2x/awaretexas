// Debug script to check bill document structure
require('dotenv').config();
const { databaseService } = require('../config/database');

async function debugBillStructure() {
  try {
    console.log('🔍 Debugging bill document structure...');
    
    // Initialize database connection
    await databaseService.connect();
    console.log('✅ Database connected');
    
    // Check if collections exist
    const db = databaseService.getDb();
    const billsCollection = db.collection('bills');
    
    // Get all documents in bills collection
    const snapshot = await billsCollection.get();
    console.log(`📊 Found ${snapshot.size} documents in bills collection`);
    
    if (!snapshot.empty) {
      console.log('📋 First few bill documents structure:');
      let count = 0;
      snapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log(`\n📄 Document ID: ${doc.id}`);
          console.log(`📋 Fields:`, Object.keys(data));
          console.log(`🔍 _isStructureDoc:`, data._isStructureDoc);
          console.log(`📊 Sample data:`, {
            billNumber: data.billNumber,
            shortTitle: data.shortTitle,
            status: data.status
          });
          count++;
        }
      });
      
      // Test the query that's failing
      console.log('\n🧪 Testing the problematic query...');
      const testSnapshot = await billsCollection
        .where('_isStructureDoc', '!=', true)
        .limit(10)
        .get();
      
      console.log(`📊 Query with _isStructureDoc != true returned ${testSnapshot.size} documents`);
      
      // Test without the filter
      console.log('\n🧪 Testing query without _isStructureDoc filter...');
      const noFilterSnapshot = await billsCollection
        .limit(10)
        .get();
      
      console.log(`📊 Query without filter returned ${noFilterSnapshot.size} documents`);
      
      noFilterSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.billNumber}: ${data.shortTitle}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

debugBillStructure();