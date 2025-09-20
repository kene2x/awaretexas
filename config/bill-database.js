// Specialized database operations for Bills collection
const { crudOperations } = require('./crud-operations');
const { idStandardizer } = require('./id-standardizer');

class BillDatabase {
  constructor() {
    this.collection = 'bills';
  }

  // Normalize a billNumber or id to canonical document id using the standardizer
  normalizeDocId(rawId) {
    return idStandardizer.standardize(rawId);
  }

  // Create or update a bill
  async saveBill(billData) {
    try {
      const rawId = billData.billNumber || billData.id;
      const billId = this.normalizeDocId(rawId);
      if (!billId) {
        throw new Error('Bill must have billNumber or id');
      }

      // Validate required fields
      this.validateBillData(billData);

  const existingBill = await crudOperations.read(this.collection, billId);
      
      if (existingBill) {
        return await crudOperations.update(this.collection, billId, billData);
      } else {
        return await crudOperations.create(this.collection, billId, billData);
      }
    } catch (error) {
      console.error('❌ Failed to save bill:', error.message);
      throw error;
    }
  }

  // Get a specific bill
  async getBill(billId) {
    try {
      const id = this.normalizeDocId(billId);
      return await crudOperations.read(this.collection, id);
    } catch (error) {
      console.error(`❌ Failed to get bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get all bills
  async getAllBills(limit = 100) {
    try {
      return await crudOperations.findAll(this.collection, limit);
    } catch (error) {
      console.error('❌ Failed to get all bills:', error.message);
      throw error;
    }
  }

  // Search bills by status
  async getBillsByStatus(status, limit = 100) {
    try {
      return await crudOperations.findWhere(this.collection, 'status', '==', status, limit);
    } catch (error) {
      console.error(`❌ Failed to get bills by status ${status}:`, error.message);
      throw error;
    }
  }

  // Search bills by sponsor
  async getBillsBySponsor(sponsorName, limit = 100) {
    try {
      return await crudOperations.findWhere(this.collection, 'sponsors', 'array-contains-any', [sponsorName], limit);
    } catch (error) {
      console.error(`❌ Failed to get bills by sponsor ${sponsorName}:`, error.message);
      throw error;
    }
  }

  // Batch save multiple bills
  async saveBills(billsArray) {
    try {
      const operations = billsArray.map(bill => {
        const rawId = bill.billNumber || bill.id;
        const docId = this.normalizeDocId(rawId);
        return {
          type: 'set',
          collection: this.collection,
          docId,
          data: bill
        };
      });

      return await crudOperations.batchWrite(operations);
    } catch (error) {
      console.error('❌ Failed to batch save bills:', error.message);
      throw error;
    }
  }

  // Delete a bill
  async deleteBill(billId) {
    try {
      return await crudOperations.delete(this.collection, billId);
    } catch (error) {
      console.error(`❌ Failed to delete bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Validate bill data structure
  validateBillData(billData) {
    const requiredFields = ['billNumber', 'shortTitle', 'status'];
    const validStatuses = ['Filed', 'In Committee', 'Passed', 'Signed', 'Vetoed', 'Effective'];

    for (const field of requiredFields) {
      if (!billData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!validStatuses.includes(billData.status)) {
      throw new Error(`Invalid status: ${billData.status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Ensure sponsors is an array
    if (billData.sponsors && !Array.isArray(billData.sponsors)) {
      throw new Error('Sponsors must be an array');
    }

    // Ensure topics is an array
    if (billData.topics && !Array.isArray(billData.topics)) {
      throw new Error('Topics must be an array');
    }
  }
}

// Create singleton instance
const billDatabase = new BillDatabase();

module.exports = { BillDatabase, billDatabase };