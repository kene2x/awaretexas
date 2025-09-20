// Database utilities and initialization for Firebase Firestore
const { initializeFirebase } = require('./firebase');

class DatabaseService {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  // Initialize database connection
  async connect() {
    try {
      this.db = initializeFirebase();
      this.isConnected = true;
      console.log('✅ Firebase Firestore connected successfully');
      return this.db;
    } catch (error) {
      this.isConnected = false;
      console.error('❌ Firebase connection failed:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  // Get database instance with connection check
  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  // Initialize collections with proper structure
  async initializeCollections() {
    try {
      const db = this.getDb();
      
      // Initialize bills collection with sample document structure
      const billsRef = db.collection('bills');
      const billsSnapshot = await billsRef.limit(1).get();
      
      if (billsSnapshot.empty) {
        console.log('📝 Initializing bills collection...');
        // Create a sample document to establish collection structure
        await billsRef.doc('_structure').set({
          _isStructureDoc: true,
          schema: {
            id: 'string',
            billNumber: 'string',
            shortTitle: 'string',
            fullTitle: 'string',
            status: 'string', // Filed, In Committee, Passed
            sponsors: 'array',
            officialUrl: 'string',
            billText: 'string',
            abstract: 'string',
            committee: 'string',
            coSponsors: 'array',
            filedDate: 'timestamp',
            lastUpdated: 'timestamp',
            topics: 'array'
          }
        });
      }

      // Initialize summaries collection
      const summariesRef = db.collection('summaries');
      const summariesSnapshot = await summariesRef.limit(1).get();
      
      if (summariesSnapshot.empty) {
        console.log('📝 Initializing summaries collection...');
        await summariesRef.doc('_structure').set({
          _isStructureDoc: true,
          schema: {
            billId: 'string',
            summaries: {
              'high-level': 'string',
              'detailed': 'string'
            },
            generatedAt: 'timestamp',
            cached: 'boolean'
          }
        });
      }

      // Initialize news cache collection
      const newsRef = db.collection('news');
      const newsSnapshot = await newsRef.limit(1).get();
      
      if (newsSnapshot.empty) {
        console.log('📝 Initializing news collection...');
        await newsRef.doc('_structure').set({
          _isStructureDoc: true,
          schema: {
            billId: 'string',
            articles: 'array',
            lastFetched: 'timestamp'
          }
        });
      }

      console.log('✅ All collections initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Collection initialization failed:', error.message);
      throw new Error(`Collection initialization failed: ${error.message}`);
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = { DatabaseService, databaseService };