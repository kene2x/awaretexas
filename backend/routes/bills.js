// Bills API routes
const express = require('express');
const router = express.Router();
const { billDatabase } = require('../../config/bill-database');
const { databaseService } = require('../../config/database');
const { summaryService } = require('../../services/ai-summary');
const { newsService } = require('../../services/news');
const Bill = require('../../models/Bill');
const cacheMiddleware = require('../middleware/cache');
const { AppError, asyncHandler } = require('../middleware/error-handler');



/**
 * GET /api/bills
 * Retrieve all bills with optional filtering and search capabilities
 * Query parameters:
 * - search: keyword search in title and summary
 * - status: filter by bill status (Filed, In Committee, Passed)
 * - sponsor: filter by sponsor name
 * - topic: filter by topic
 * - limit: maximum number of results (default: 100)
 */
router.get('/', cacheMiddleware.middleware(600), asyncHandler(async (req, res) => { // Cache for 10 minutes
    const { search, status, sponsor, topic, limit = 100 } = req.query;
    
    // Get bills from database
    const bills = await billDatabase.getAllBills(parseInt(limit));
    
    // Apply filters
    if (status) {
      bills = bills.filter(bill => bill.status === status);
    }
    
    if (sponsor) {
      bills = bills.filter(bill => 
        bill.sponsors.some(s => s.name.toLowerCase().includes(sponsor.toLowerCase()))
      );
    }
    
    if (topic) {
      bills = bills.filter(bill => 
        bill.topics && bill.topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))
      );
    }
    
    // Apply search filter (search in title and abstract)
    if (search) {
      const searchLower = search.toLowerCase();
      bills = bills.filter(bill => 
        bill.shortTitle.toLowerCase().includes(searchLower) ||
        bill.fullTitle.toLowerCase().includes(searchLower) ||
        (bill.abstract && bill.abstract.toLowerCase().includes(searchLower))
      );
    }
    
    // Convert to Bill instances and get preview summaries
    const { idStandardizer } = require('../../config/id-standardizer');
    
    const billInstances = bills.map(billData => {
      try {
        const bill = new Bill(billData);
        
        // Use standardized ID for consistent navigation
        const rawId = billData.billNumber || billData.id;
        const standardId = idStandardizer.standardize(rawId);
        const displayId = idStandardizer.toDisplayFormat(standardId);
        
        return {
          ...bill.toJSON(),
          id: displayId,  // Use display format for frontend (e.g., "SB 1")
          standardId: standardId,  // Include standard format for reference (e.g., "SB1")
          statusColor: bill.getStatusColor(),
          previewSummary: bill.getPreviewSummary()
        };
      } catch (error) {
        console.error(`Error creating Bill instance for ${billData.id}:`, error.message);
        
        // For raw data, also ensure we use standardized IDs
        const rawId = billData.billNumber || billData.id;
        const standardId = idStandardizer.standardize(rawId);
        const displayId = idStandardizer.toDisplayFormat(standardId);
        
        return {
          ...billData,
          id: displayId,
          standardId: standardId
        };
      }
    });
    
    res.json({
      success: true,
      data: billInstances,
      count: billInstances.length,
      filters: {
        search: search || null,
        status: status || null,
        sponsor: sponsor || null,
        topic: topic || null,
        limit: parseInt(limit)
      },
      timestamp: new Date().toISOString()
    });
    
}));

/**
 * GET /api/bills/:id
 * Get specific bill details by ID
 */
router.get('/:id', cacheMiddleware.middleware(900), asyncHandler(async (req, res) => { // Cache for 15 minutes
  const { id } = req.params;

  if (!id) {
    throw new AppError('Bill ID is required', 'VALIDATION_ERROR');
  }

  // If database is not connected, treat this as a server/database error
  if (!databaseService.isConnected) {
    throw new AppError('Database not connected', 'DATABASE_ERROR', 500);
  }

  // Use the ID standardizer to handle different formats
  const { idStandardizer } = require('../../config/id-standardizer');
  
  let billData = null;
  try {
    // Generate all possible lookup variants using the standardizer
    const lookupVariants = idStandardizer.generateLookupVariants(id);
    console.log(`Looking up bill with variants: ${lookupVariants.join(', ')}`);
    
    // Try each variant until we find the bill
    for (const variant of lookupVariants) {
      try {
        billData = await billDatabase.getBill(variant);
        if (billData) {
          console.log(`Found bill using variant: ${variant}`);
          break;
        }
      } catch (e) {
        // Continue to next variant
      }
    }

    // Fallback: try querying by the billNumber field using CRUD helper
    if (!billData) {
      const { crudOperations } = require('../../config/crud-operations');
      for (const variant of lookupVariants) {
        try {
          const results = await crudOperations.findWhere('bills', 'billNumber', '==', variant, 1);
          if (results && results.length > 0) {
            billData = results[0];
            console.log(`Found bill by billNumber field using variant: ${variant}`);
            break;
          }
        } catch (e) {
          // Continue to next variant
        }
      }
    }
  } catch (error) {
    console.error(`Error looking up bill ${id}:`, error.message);
    // Allow downstream handling to return a consistent error
  }

  if (!billData) {
    throw new AppError('Bill not found', 'NOT_FOUND', 404, { billId: id });
  }

  // Create Bill instance for additional methods
  try {
    const bill = new Bill(billData);
    const response = {
      ...bill.toJSON(),
      statusColor: bill.getStatusColor(),
      previewSummary: bill.getPreviewSummary()
    };

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error creating Bill instance for ${id}:`, error.message);
    // Return raw data if Bill creation fails
    res.json({
      success: true,
      data: billData,
      warning: 'Bill data validation failed, returning raw data',
      timestamp: new Date().toISOString()
    });
  }
}));

// Debug endpoint (development): show candidates attempted for lookup
router.get('/debug/lookup/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'id required' });

  const candidates = [];
  const decoded = decodeURIComponent(id);
  candidates.push(id, decoded, id.toUpperCase(), id.toLowerCase(), id.replace(/\s+/g, ''), id.replace(/\s+/g, '').toUpperCase());
  candidates.push(id.replace(/([A-Za-z]+)(\d+)/, '$1 $2'), id.replace(/([A-Za-z]+)\s*(\d+)/, '$1$2'));

  const { crudOperations } = require('../../config/crud-operations');
  const results = [];
  for (const c of Array.from(new Set(candidates))) {
    try {
      const doc = await crudOperations.read('bills', c).catch(() => null);
      if (doc) results.push({ candidate: c, found: true, docId: doc.id });
      else results.push({ candidate: c, found: false });
    } catch (e) {
      results.push({ candidate: c, found: false, error: e.message });
    }
  }

  const matched = results.find(r => r.found) || null;
  res.json({ success: true, id, candidates: results, matched });
}));

/**
 * POST /api/summary/:billId
 * Generate or retrieve AI summary for a specific bill
 * Body parameters:
 * - readingLevel: 'high-level' or 'detailed' (optional, defaults to 'high-level')
 * - forceRegenerate: boolean to bypass cache (optional, defaults to false)
 */
router.post('/summary/:billId', cacheMiddleware.summaryMiddleware(), asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const { readingLevel = 'high-level', forceRegenerate = false } = req.body;
  
  if (!billId) {
    throw new AppError('Bill ID is required', 'VALIDATION_ERROR');
  }
  
  // Validate reading level
  const validLevels = ['high-level', 'detailed'];
  if (!validLevels.includes(readingLevel)) {
    throw new AppError(`Invalid reading level. Must be one of: ${validLevels.join(', ')}`, 'VALIDATION_ERROR');
  }
  
  // Get bill data
  const billData = await billDatabase.getBill(billId);
  if (!billData) {
    throw new AppError('Bill not found', 'NOT_FOUND', 404, { billId });
  }
  
  // Check if bill has text to summarize - prioritize bill text over abstract
  if (!billData.billText && !billData.abstract) {
    throw new AppError('Bill has no text available for summarization', 'VALIDATION_ERROR', 400, { billId });
  }
  
  // Clear cache if force regenerate is requested
  if (forceRegenerate) {
    await summaryService.clearCache(billId);
    console.log(`🗑️ Force regenerate: cleared cache for bill ${billId}`);
  }
  
  // Generate or retrieve summary - use full bill text if available, fallback to abstract
  let textToSummarize = billData.billText;
  
  // If no bill text, use abstract but note this in the response
  if (!textToSummarize && billData.abstract) {
    textToSummarize = billData.abstract;
    console.log(`⚠️ Using abstract for summarization of bill ${billId} - full text not available`);
  }
  
  const summary = await summaryService.generateSummary(billId, textToSummarize, readingLevel);
  
  res.json({
    success: true,
    data: {
      billId,
      summary,
      readingLevel,
      cached: !forceRegenerate,
      generatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * PUT /api/bills/:billId
 * Update a specific bill (including voting data)
 */
router.put('/:billId', asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const updateData = req.body;
  
  if (!billId) {
    throw new AppError('Bill ID is required', 'VALIDATION_ERROR');
  }
  
  // Get existing bill
  const existingBill = await billDatabase.getBill(billId);
  if (!existingBill) {
    throw new AppError('Bill not found', 'NOT_FOUND', 404, { billId });
  }
  
  // Merge update data with existing bill
  const updatedBill = {
    ...existingBill,
    ...updateData,
    lastUpdated: new Date()
  };
  
  // Save updated bill
  await billDatabase.saveBill(updatedBill);
  
  res.json({
    success: true,
    data: updatedBill,
    message: 'Bill updated successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/news/:billId
 * Get related news articles for a specific bill
 */
router.get('/news/:billId', cacheMiddleware.newsMiddleware(), asyncHandler(async (req, res) => {
  const { billId } = req.params;
  
  if (!billId) {
    throw new AppError('Bill ID is required', 'VALIDATION_ERROR');
  }
  
  // Get bill data first
  const billData = await billDatabase.getBill(billId);
  if (!billData) {
    throw new AppError('Bill not found', 'NOT_FOUND', 404, { billId });
  }
  
  // Fetch news articles
  console.log('🔍 Fetching news for bill:', billId);
  console.log('📊 Bill data:', { billNumber: billData.billNumber, shortTitle: billData.shortTitle });
  console.log('📰 News service initialized:', newsService.isInitialized);
  
  const articles = await newsService.getNewsForBill(billId, billData);
  console.log('📰 Articles found:', articles.length);
  
  // Filter out error articles for the response
  const validArticles = articles.filter(article => !article.isError);
  const errorArticles = articles.filter(article => article.isError);
  
  const response = {
    success: true,
    data: {
      billId,
      articles: validArticles,
      count: validArticles.length
    },
    timestamp: new Date().toISOString()
  };
  
  // Include error information if there were issues
  if (errorArticles.length > 0) {
    response.warnings = errorArticles.map(article => article.description);
  }
  
  res.json(response);
}));

/**
 * PUT /api/summary/:billId/level
 * Update reading level for an existing bill summary
 * Body parameters:
 * - readingLevel: 'high-level' or 'detailed' (required)
 * - forceRegenerate: boolean to bypass cache (optional, defaults to false)
 */
router.put('/summary/:billId/level', async (req, res) => {
  try {
    const { billId } = req.params;
    const { readingLevel, forceRegenerate = false } = req.body;
    
    if (!billId) {
      return res.status(400).json({
        success: false,
        error: 'Bill ID is required',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!readingLevel) {
      return res.status(400).json({
        success: false,
        error: 'Reading level is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate reading level
    const validLevels = ['high-level', 'detailed'];
    if (!validLevels.includes(readingLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid reading level. Must be one of: ${validLevels.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get bill data
    const billData = await billDatabase.getBill(billId);
    if (!billData) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found',
        billId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if bill has text to summarize
    if (!billData.billText && !billData.abstract) {
      return res.status(400).json({
        success: false,
        error: 'Bill has no text available for summarization',
        billId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Clear cache if force regenerate is requested
    if (forceRegenerate) {
      summaryService.clearCache(billId);
    }
    
    // Generate or retrieve summary with new reading level
    const textToSummarize = billData.billText || billData.abstract;
    const summary = await summaryService.generateSummary(billId, textToSummarize, readingLevel);
    
    res.json({
      success: true,
      data: {
        billId,
        summary,
        readingLevel,
        updated: true,
        forceRegenerated: forceRegenerate,
        updatedAt: new Date().toISOString()
      },
      message: `Summary reading level updated to ${readingLevel}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Error updating summary level for bill ${req.params.billId}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update summary reading level',
      message: error.message,
      billId: req.params.billId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;