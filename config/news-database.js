// Specialized database operations for News cache collection
const { crudOperations } = require('./crud-operations');

class NewsDatabase {
  constructor() {
    this.collection = 'news';
  }

  // Save news articles for a bill
  async saveNews(billId, articles) {
    try {
      if (!billId) {
        throw new Error('Bill ID is required');
      }

      this.validateNewsData(articles);

      const newsData = {
        billId,
        articles,
        lastFetched: new Date()
      };

      const existingNews = await crudOperations.read(this.collection, billId);
      
      if (existingNews) {
        return await crudOperations.update(this.collection, billId, newsData);
      } else {
        return await crudOperations.create(this.collection, billId, newsData);
      }
    } catch (error) {
      console.error(`❌ Failed to save news for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get cached news for a specific bill
  async getNews(billId) {
    try {
      return await crudOperations.read(this.collection, billId);
    } catch (error) {
      console.error(`❌ Failed to get news for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get news articles array for a bill
  async getNewsArticles(billId) {
    try {
      const newsData = await this.getNews(billId);
      return newsData ? newsData.articles : [];
    } catch (error) {
      console.error(`❌ Failed to get news articles for bill ${billId}:`, error.message);
      return [];
    }
  }

  // Check if news cache is recent (within specified hours)
  async isNewsCached(billId, maxAgeHours = 6) {
    try {
      const newsData = await this.getNews(billId);
      
      if (!newsData || !newsData.lastFetched) {
        return false;
      }

      const now = new Date();
      const lastFetched = newsData.lastFetched.toDate ? newsData.lastFetched.toDate() : new Date(newsData.lastFetched);
      const ageHours = (now - lastFetched) / (1000 * 60 * 60);

      return ageHours < maxAgeHours;
    } catch (error) {
      console.error(`❌ Failed to check news cache status for bill ${billId}:`, error.message);
      return false;
    }
  }

  // Add new articles to existing cache
  async addNewsArticles(billId, newArticles) {
    try {
      const existingNews = await this.getNews(billId);
      
      if (!existingNews) {
        return await this.saveNews(billId, newArticles);
      }

      // Merge articles, avoiding duplicates based on URL
      const existingUrls = new Set(existingNews.articles.map(article => article.url));
      const uniqueNewArticles = newArticles.filter(article => !existingUrls.has(article.url));
      
      const mergedArticles = [...existingNews.articles, ...uniqueNewArticles];
      
      return await crudOperations.update(this.collection, billId, {
        articles: mergedArticles,
        lastFetched: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to add news articles for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Get all cached news (for maintenance/debugging)
  async getAllNews(limit = 100) {
    try {
      return await crudOperations.findAll(this.collection, limit);
    } catch (error) {
      console.error('❌ Failed to get all news cache:', error.message);
      throw error;
    }
  }

  // Delete news cache for a bill
  async deleteNews(billId) {
    try {
      return await crudOperations.delete(this.collection, billId);
    } catch (error) {
      console.error(`❌ Failed to delete news cache for bill ${billId}:`, error.message);
      throw error;
    }
  }

  // Clean up old news cache entries
  async cleanupOldNews(maxAgeHours = 168) { // 1 week default
    try {
      const allNews = await this.getAllNews(1000);
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (maxAgeHours * 60 * 60 * 1000));

      const deleteOperations = [];

      for (const newsItem of allNews) {
        const lastFetched = newsItem.lastFetched.toDate ? newsItem.lastFetched.toDate() : new Date(newsItem.lastFetched);
        
        if (lastFetched < cutoffTime) {
          deleteOperations.push({
            type: 'delete',
            collection: this.collection,
            docId: newsItem.id
          });
        }
      }

      if (deleteOperations.length > 0) {
        await crudOperations.batchWrite(deleteOperations);
        console.log(`✅ Cleaned up ${deleteOperations.length} old news cache entries`);
      }

      return deleteOperations.length;
    } catch (error) {
      console.error('❌ Failed to cleanup old news cache:', error.message);
      throw error;
    }
  }

  // Validate news articles data structure
  validateNewsData(articles) {
    if (!Array.isArray(articles)) {
      throw new Error('Articles must be an array');
    }

    const requiredFields = ['headline', 'source', 'url'];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      for (const field of requiredFields) {
        if (!article[field]) {
          throw new Error(`Article ${i} missing required field: ${field}`);
        }
      }

      // Validate URL format
      try {
        new URL(article.url);
      } catch (error) {
        throw new Error(`Article ${i} has invalid URL: ${article.url}`);
      }

      // Validate publishedAt if provided
      if (article.publishedAt && !(article.publishedAt instanceof Date) && isNaN(Date.parse(article.publishedAt))) {
        throw new Error(`Article ${i} has invalid publishedAt date`);
      }
    }
  }
}

// Create singleton instance
const newsDatabase = new NewsDatabase();

module.exports = { NewsDatabase, newsDatabase };