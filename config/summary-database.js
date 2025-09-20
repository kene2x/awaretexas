// Specialized database operations for Summaries collection
const { crudOperations } = require('./crud-operations');

class SummaryDatabase {
  constructor() {
    this.collection = 'summaries';
  }

  // Save AI-generated summary for a bill
  async saveSummary(billId, summaries, cached = true) {
    try {
      if (!billId) {
        throw new Error('Bill ID is required');
      }

      this.validateSummaryData(summaries);

      const summaryData = {
        billId,
        summaries,
        generatedAt: new Date(),
        cached
      };

      const existingSummary = await crudOperations.read(this.collection, billId);
      
      if (existingSummary) {
        return await crudOperations.update(this.collection, billId, summaryData);
      } else {
        return await crudOperations.create(this.collection, billId, summaryData);
      }
    } catch (error) {
      console.error(`❌ Failed to save summary for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get summary for a specific bill
  async getSummary(billId) {
    try {
      return await crudOperations.read(this.collection, billId);
    } catch (error) {
      console.error(`❌ Failed to get summary for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get summary by reading level
  async getSummaryByLevel(billId, level = 'high-level') {
    try {
      const summary = await this.getSummary(billId);
      if (!summary || !summary.summaries) {
        return null;
      }

      return {
        billId: summary.billId,
        summary: summary.summaries[level] || summary.summaries['high-level'],
        level,
        generatedAt: summary.generatedAt,
        cached: summary.cached
      };
    } catch (error) {
      console.error(`❌ Failed to get ${level} summary for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Update specific reading level summary
  async updateSummaryLevel(billId, level, summaryText) {
    try {
      const existingSummary = await this.getSummary(billId);
      
      if (!existingSummary) {
        // Create new summary with this level
        const summaries = { [level]: summaryText };
        return await this.saveSummary(billId, summaries);
      }

      // Update existing summary
      const updatedSummaries = {
        ...existingSummary.summaries,
        [level]: summaryText
      };

      return await crudOperations.update(this.collection, billId, {
        summaries: updatedSummaries,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to update ${level} summary for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Check if summary exists and is recent (within 24 hours)
  async isSummaryCached(billId, maxAgeHours = 24) {
    try {
      const summary = await this.getSummary(billId);
      
      if (!summary || !summary.cached) {
        return false;
      }

      const now = new Date();
      const generatedAt = summary.generatedAt.toDate ? summary.generatedAt.toDate() : new Date(summary.generatedAt);
      const ageHours = (now - generatedAt) / (1000 * 60 * 60);

      return ageHours < maxAgeHours;
    } catch (error) {
      console.error(`❌ Failed to check cache status for bill ${billId}:`, error.message);
      return false;
    }
  }

  // Get all summaries (for maintenance/debugging)
  async getAllSummaries(limit = 100) {
    try {
      return await crudOperations.findAll(this.collection, limit);
    } catch (error) {
      console.error('❌ Failed to get all summaries:', error.message);
      throw error;
    }
  }

  // Delete summary for a bill
  async deleteSummary(billId) {
    try {
      return await crudOperations.delete(this.collection, billId);
    } catch (error) {
      console.error(`❌ Failed to delete summary for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Validate summary data structure
  validateSummaryData(summaries) {
    if (!summaries || typeof summaries !== 'object') {
      throw new Error('Summaries must be an object');
    }

    const validLevels = ['high-level', 'detailed'];
    const providedLevels = Object.keys(summaries);

    if (providedLevels.length === 0) {
      throw new Error('At least one summary level must be provided');
    }

    for (const level of providedLevels) {
      if (!validLevels.includes(level)) {
        throw new Error(`Invalid summary level: ${level}. Must be one of: ${validLevels.join(', ')}`);
      }

      if (!summaries[level] || typeof summaries[level] !== 'string') {
        throw new Error(`Summary for level ${level} must be a non-empty string`);
      }
    }
  }
}

// Create singleton instance
const summaryDatabase = new SummaryDatabase();

module.exports = { SummaryDatabase, summaryDatabase };