// CRUD operations for Firebase Firestore collections
const { databaseService } = require('./database');

class CrudOperations {
  constructor() {
    this.db = null;
  }

  // Initialize CRUD operations with database connection
  async initialize() {
    if (!databaseService.isConnected) {
      await databaseService.connect();
    }
    this.db = databaseService.getDb();
  }

  // Generic CRUD operations
  async create(collection, docId, data) {
    try {
      await this.initialize();
      const docRef = this.db.collection(collection).doc(docId);
      const timestamp = new Date();
      
      const docData = {
        ...data,
        createdAt: timestamp,
        lastUpdated: timestamp
      };
      
      await docRef.set(docData);
      console.log(`✅ Document created in ${collection}: ${docId}`);
      return { id: docId, ...docData };
    } catch (error) {
      console.error(`❌ Create operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async read(collection, docId) {
    try {
      await this.initialize();
      const docRef = this.db.collection(collection).doc(docId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`❌ Read operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to read document: ${error.message}`);
    }
  }

  async update(collection, docId, data) {
    try {
      await this.initialize();
      const docRef = this.db.collection(collection).doc(docId);
      
      const updateData = {
        ...data,
        lastUpdated: new Date()
      };
      
      await docRef.update(updateData);
      console.log(`✅ Document updated in ${collection}: ${docId}`);
      return await this.read(collection, docId);
    } catch (error) {
      console.error(`❌ Update operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  async delete(collection, docId) {
    try {
      await this.initialize();
      const docRef = this.db.collection(collection).doc(docId);
      await docRef.delete();
      console.log(`✅ Document deleted from ${collection}: ${docId}`);
      return true;
    } catch (error) {
      console.error(`❌ Delete operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  // Query operations
  async findAll(collection, limit = 100) {
    try {
      await this.initialize();
      const snapshot = await this.db.collection(collection)
        .where('_isStructureDoc', '!=', true)
        .limit(limit)
        .get();
      
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return documents;
    } catch (error) {
      console.error(`❌ FindAll operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
  }

  async findWhere(collection, field, operator, value, limit = 100) {
    try {
      await this.initialize();
      const snapshot = await this.db.collection(collection)
        .where(field, operator, value)
        .limit(limit)
        .get();
      
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return documents;
    } catch (error) {
      console.error(`❌ FindWhere operation failed in ${collection}:`, error.message);
      throw new Error(`Failed to query documents: ${error.message}`);
    }
  }

  // Batch operations
  async batchWrite(operations) {
    try {
      await this.initialize();
      const batch = this.db.batch();
      
      operations.forEach(op => {
        const docRef = this.db.collection(op.collection).doc(op.docId);
        
        switch (op.type) {
          case 'set':
            batch.set(docRef, { ...op.data, lastUpdated: new Date() });
            break;
          case 'update':
            batch.update(docRef, { ...op.data, lastUpdated: new Date() });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });
      
      await batch.commit();
      console.log(`✅ Batch operation completed with ${operations.length} operations`);
      return true;
    } catch (error) {
      console.error('❌ Batch operation failed:', error.message);
      throw new Error(`Batch operation failed: ${error.message}`);
    }
  }
}

// Create singleton instance
const crudOperations = new CrudOperations();

module.exports = { CrudOperations, crudOperations };