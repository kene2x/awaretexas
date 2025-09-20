// Client-side cache manager for bill data and search results
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
        this.maxCacheSize = 100; // Maximum number of cached items
        
        // Different TTL for different data types
        this.ttlConfig = {
            bills: 10 * 60 * 1000,      // 10 minutes for bill list
            billDetail: 15 * 60 * 1000,  // 15 minutes for bill details
            summary: 30 * 60 * 1000,     // 30 minutes for AI summaries
            news: 20 * 60 * 1000,        // 20 minutes for news articles
            search: 5 * 60 * 1000        // 5 minutes for search results
        };
        
        // Initialize from localStorage if available
        this.loadFromStorage();
        
        // Clean up expired entries periodically
        this.startCleanupInterval();
    }

    /**
     * Generate cache key from request parameters
     */
    generateKey(type, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key];
                return result;
            }, {});
        
        return `${type}:${JSON.stringify(sortedParams)}`;
    }

    /**
     * Set cache entry with TTL
     */
    set(key, data, ttl = null) {
        // Determine TTL based on data type
        const dataType = key.split(':')[0];
        const actualTTL = ttl || this.ttlConfig[dataType] || this.defaultTTL;
        
        // Enforce cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldest();
        }
        
        const expiryTime = Date.now() + actualTTL;
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: actualTTL
        });
        
        this.cacheExpiry.set(key, expiryTime);
        
        // Persist to localStorage for important data
        if (dataType === 'bills' || dataType === 'billDetail') {
            this.saveToStorage();
        }
        
        console.log(`Cache SET: ${key} (TTL: ${actualTTL}ms)`);
    }

    /**
     * Get cache entry if not expired
     */
    get(key) {
        const expiryTime = this.cacheExpiry.get(key);
        
        if (!expiryTime || Date.now() > expiryTime) {
            // Entry expired or doesn't exist
            this.delete(key);
            return null;
        }
        
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        
        console.log(`Cache HIT: ${key}`);
        return entry.data;
    }

    /**
     * Check if cache has valid entry
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete cache entry
     */
    delete(key) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
        console.log(`Cache DELETE: ${key}`);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.cacheExpiry.clear();
        localStorage.removeItem('billTracker_cache');
        console.log('Cache CLEARED');
    }

    /**
     * Clear cache entries by type
     */
    clearByType(type) {
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${type}:`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.delete(key));
        console.log(`Cache CLEARED for type: ${type}`);
    }

    /**
     * Evict oldest cache entry
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, expiryTime] of this.cacheExpiry.entries()) {
            if (now > expiryTime) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this.delete(key));
        
        if (expiredKeys.length > 0) {
            console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
        }
    }

    /**
     * Start periodic cleanup
     */
    startCleanupInterval() {
        // Clean up every 2 minutes
        setInterval(() => {
            this.cleanup();
        }, 2 * 60 * 1000);
    }

    /**
     * Save cache to localStorage
     */
    saveToStorage() {
        try {
            const cacheData = {
                cache: Array.from(this.cache.entries()),
                expiry: Array.from(this.cacheExpiry.entries()),
                timestamp: Date.now()
            };
            
            localStorage.setItem('billTracker_cache', JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Failed to save cache to localStorage:', error);
        }
    }

    /**
     * Load cache from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('billTracker_cache');
            if (!stored) return;
            
            const cacheData = JSON.parse(stored);
            const now = Date.now();
            
            // Only load if stored within last hour
            if (now - cacheData.timestamp > 60 * 60 * 1000) {
                localStorage.removeItem('billTracker_cache');
                return;
            }
            
            // Restore cache entries
            cacheData.cache.forEach(([key, entry]) => {
                this.cache.set(key, entry);
            });
            
            // Restore expiry times
            cacheData.expiry.forEach(([key, expiryTime]) => {
                if (now < expiryTime) {
                    this.cacheExpiry.set(key, expiryTime);
                }
            });
            
            console.log(`Cache loaded from storage: ${this.cache.size} entries`);
        } catch (error) {
            console.warn('Failed to load cache from localStorage:', error);
            localStorage.removeItem('billTracker_cache');
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        
        for (const [key, expiryTime] of this.cacheExpiry.entries()) {
            if (now < expiryTime) {
                validEntries++;
            } else {
                expiredEntries++;
            }
        }
        
        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            maxSize: this.maxCacheSize,
            hitRate: this.hitRate || 0
        };
    }

    /**
     * Cache wrapper for fetch requests
     */
    async cachedFetch(url, options = {}, cacheType = 'default', cacheParams = {}) {
        const cacheKey = this.generateKey(cacheType, { url, ...cacheParams });
        
        // Try to get from cache first
        const cached = this.get(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        
        // Fetch from network
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache the response
            this.set(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error(`Fetch failed for ${url}:`, error);
            throw error;
        }
    }
}

// Create global cache manager instance
window.cacheManager = new CacheManager();