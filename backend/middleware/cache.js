// Response caching middleware for better performance
const NodeCache = require('node-cache');

class CacheMiddleware {
    constructor() {
        // Create cache instances with different TTLs
        this.responseCache = new NodeCache({ 
            stdTTL: 300, // 5 minutes default
            checkperiod: 60, // Check for expired keys every minute
            useClones: false // Better performance, but be careful with object mutations
        });
        
        this.summaryCache = new NodeCache({ 
            stdTTL: 1800, // 30 minutes for AI summaries
            checkperiod: 120
        });
        
        this.newsCache = new NodeCache({ 
            stdTTL: 1200, // 20 minutes for news
            checkperiod: 120
        });
        
        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        // Bind methods
        this.middleware = this.middleware.bind(this);
        this.summaryMiddleware = this.summaryMiddleware.bind(this);
        this.newsMiddleware = this.newsMiddleware.bind(this);
    }

    /**
     * Generate cache key from request
     */
    generateCacheKey(req) {
        const { method, path, query } = req;
        
        // Sort query parameters for consistent keys
        const sortedQuery = Object.keys(query)
            .sort()
            .reduce((result, key) => {
                result[key] = query[key];
                return result;
            }, {});
        
        return `${method}:${path}:${JSON.stringify(sortedQuery)}`;
    }

    /**
     * General response caching middleware
     */
    middleware(ttl = 300) {
        return (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }
            
            const cacheKey = this.generateCacheKey(req);
            const cached = this.responseCache.get(cacheKey);
            
            if (cached) {
                this.stats.hits++;
                
                // Set cache headers
                res.set({
                    'X-Cache': 'HIT',
                    'X-Cache-Key': cacheKey,
                    'Cache-Control': `public, max-age=${ttl}`
                });
                
                return res.json(cached);
            }
            
            this.stats.misses++;
            
            // Override res.json to cache the response
            const originalJson = res.json;
            res.json = (data) => {
                // Only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.responseCache.set(cacheKey, data, ttl);
                    this.stats.sets++;
                    
                    res.set({
                        'X-Cache': 'MISS',
                        'X-Cache-Key': cacheKey,
                        'Cache-Control': `public, max-age=${ttl}`
                    });
                }
                
                return originalJson.call(res, data);
            };
            
            next();
        };
    }

    /**
     * Summary-specific caching middleware
     */
    summaryMiddleware() {
        return (req, res, next) => {
            const { billId } = req.params;
            const { readingLevel = 'high-level' } = req.body;
            
            const cacheKey = `summary:${billId}:${readingLevel}`;
            const cached = this.summaryCache.get(cacheKey);
            
            if (cached) {
                this.stats.hits++;
                
                res.set({
                    'X-Cache': 'HIT',
                    'X-Cache-Type': 'summary',
                    'Cache-Control': 'public, max-age=1800'
                });
                
                return res.json({
                    success: true,
                    data: {
                        billId,
                        summary: cached,
                        readingLevel,
                        cached: true,
                        generatedAt: new Date().toISOString()
                    },
                    timestamp: new Date().toISOString()
                });
            }
            
            this.stats.misses++;
            
            // Store original res.json
            const originalJson = res.json;
            res.json = (data) => {
                // Cache successful summary responses
                if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data?.summary) {
                    this.summaryCache.set(cacheKey, data.data.summary);
                    this.stats.sets++;
                    
                    res.set({
                        'X-Cache': 'MISS',
                        'X-Cache-Type': 'summary',
                        'Cache-Control': 'public, max-age=1800'
                    });
                }
                
                return originalJson.call(res, data);
            };
            
            next();
        };
    }

    /**
     * News-specific caching middleware
     */
    newsMiddleware() {
        return (req, res, next) => {
            const { billId } = req.params;
            const cacheKey = `news:${billId}`;
            
            const cached = this.newsCache.get(cacheKey);
            
            if (cached) {
                this.stats.hits++;
                
                res.set({
                    'X-Cache': 'HIT',
                    'X-Cache-Type': 'news',
                    'Cache-Control': 'public, max-age=1200'
                });
                
                return res.json({
                    success: true,
                    data: {
                        billId,
                        articles: cached,
                        count: cached.length
                    },
                    timestamp: new Date().toISOString()
                });
            }
            
            this.stats.misses++;
            
            // Store original res.json
            const originalJson = res.json;
            res.json = (data) => {
                // Cache successful news responses
                if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data?.articles) {
                    this.newsCache.set(cacheKey, data.data.articles);
                    this.stats.sets++;
                    
                    res.set({
                        'X-Cache': 'MISS',
                        'X-Cache-Type': 'news',
                        'Cache-Control': 'public, max-age=1200'
                    });
                }
                
                return originalJson.call(res, data);
            };
            
            next();
        };
    }

    /**
     * Clear cache by pattern
     */
    clearCache(pattern = null) {
        if (!pattern) {
            // Clear all caches
            this.responseCache.flushAll();
            this.summaryCache.flushAll();
            this.newsCache.flushAll();
            console.log('All caches cleared');
            return;
        }
        
        // Clear specific cache type
        if (pattern.startsWith('summary:')) {
            const keys = this.summaryCache.keys().filter(key => key.includes(pattern));
            keys.forEach(key => this.summaryCache.del(key));
            console.log(`Cleared ${keys.length} summary cache entries`);
        } else if (pattern.startsWith('news:')) {
            const keys = this.newsCache.keys().filter(key => key.includes(pattern));
            keys.forEach(key => this.newsCache.del(key));
            console.log(`Cleared ${keys.length} news cache entries`);
        } else {
            const keys = this.responseCache.keys().filter(key => key.includes(pattern));
            keys.forEach(key => this.responseCache.del(key));
            console.log(`Cleared ${keys.length} response cache entries`);
        }
        
        this.stats.deletes++;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            hitRate: this.stats.hits + this.stats.misses > 0 ? 
                ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%' : '0%',
            responseCache: {
                keys: this.responseCache.keys().length,
                stats: this.responseCache.getStats()
            },
            summaryCache: {
                keys: this.summaryCache.keys().length,
                stats: this.summaryCache.getStats()
            },
            newsCache: {
                keys: this.newsCache.keys().length,
                stats: this.newsCache.getStats()
            }
        };
    }

    /**
     * Warm up cache with common requests
     */
    async warmupCache(billDatabase) {
        try {
            console.log('Starting cache warmup...');
            
            // Pre-cache all bills
            const bills = await billDatabase.getAllBills(100);
            const billsKey = 'GET:/api/bills:{}';
            this.responseCache.set(billsKey, {
                success: true,
                data: bills,
                count: bills.length,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Cache warmed up with ${bills.length} bills`);
        } catch (error) {
            console.error('Cache warmup failed:', error);
        }
    }

    /**
     * Middleware for cache control headers
     */
    cacheControlMiddleware() {
        return (req, res, next) => {
            // Set default cache control headers
            if (req.method === 'GET') {
                res.set('Cache-Control', 'public, max-age=300'); // 5 minutes default
            } else {
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
            
            next();
        };
    }

    /**
     * Compression middleware for better performance
     */
    compressionMiddleware() {
        const compression = require('compression');
        
        return compression({
            filter: (req, res) => {
                // Don't compress if client doesn't support it
                if (req.headers['x-no-compression']) {
                    return false;
                }
                
                // Compress all responses by default
                return compression.filter(req, res);
            },
            level: 6, // Good balance between compression and speed
            threshold: 1024 // Only compress responses larger than 1KB
        });
    }
}

module.exports = new CacheMiddleware();