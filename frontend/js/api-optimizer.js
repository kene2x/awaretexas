// API optimization layer to prevent redundant requests and improve performance
class ApiOptimizer {
    constructor() {
        this.pendingRequests = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.maxConcurrentRequests = 3;
        this.activeRequests = 0;
        this.requestDelay = 100; // Minimum delay between requests
        this.lastRequestTime = 0;
        
        // Request deduplication
        this.requestCache = new Map();
        this.dedupeTTL = 1000; // 1 second deduplication window
        
        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            cachedRequests: 0,
            deduplicatedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            responseTimes: []
        };
    }

    /**
     * Generate request signature for deduplication
     */
    generateRequestSignature(url, options = {}) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `${method}:${url}:${body}`;
    }

    /**
     * Optimized fetch with caching, deduplication, and queuing
     */
    async optimizedFetch(url, options = {}, cacheOptions = {}) {
        const startTime = Date.now();
        const signature = this.generateRequestSignature(url, options);
        
        // Check for pending identical request (deduplication)
        if (this.pendingRequests.has(signature)) {
            this.metrics.deduplicatedRequests++;
            console.log(`Request deduplicated: ${url}`);
            return this.pendingRequests.get(signature);
        }
        
        // Check cache first
        const {
            cacheType = 'default',
            cacheParams = {},
            bypassCache = false,
            cacheTTL = null
        } = cacheOptions;
        
        if (!bypassCache && window.cacheManager) {
            const cached = window.cacheManager.cachedFetch(url, options, cacheType, cacheParams);
            if (cached && cached !== null) {
                this.metrics.cachedRequests++;
                return cached;
            }
        }
        
        // Create request promise
        const requestPromise = this.executeRequest(url, options, startTime);
        
        // Store pending request for deduplication
        this.pendingRequests.set(signature, requestPromise);
        
        // Clean up after request completes
        requestPromise.finally(() => {
            this.pendingRequests.delete(signature);
            setTimeout(() => {
                this.requestCache.delete(signature);
            }, this.dedupeTTL);
        });
        
        return requestPromise;
    }

    /**
     * Execute the actual request with rate limiting and queuing
     */
    async executeRequest(url, options, startTime) {
        return new Promise((resolve, reject) => {
            const requestItem = {
                url,
                options,
                startTime,
                resolve,
                reject
            };
            
            this.requestQueue.push(requestItem);
            this.processQueue();
        });
    }

    /**
     * Process request queue with rate limiting
     */
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const requestItem = this.requestQueue.shift();
            this.processRequest(requestItem);
        }
        
        this.isProcessingQueue = false;
    }

    /**
     * Process individual request with rate limiting
     */
    async processRequest(requestItem) {
        const { url, options, startTime, resolve, reject } = requestItem;
        
        // Rate limiting - ensure minimum delay between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.requestDelay) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
        }
        
        this.activeRequests++;
        this.lastRequestTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const requestOptions = {
                ...options,
                signal: controller.signal
            };
            
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime);
            
            // Cache the response if cacheManager is available
            if (window.cacheManager && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
                const cacheKey = window.cacheManager.generateKey('api', { url });
                window.cacheManager.set(cacheKey, data);
            }
            
            resolve(data);
            
        } catch (error) {
            this.metrics.failedRequests++;
            console.error(`Request failed for ${url}:`, error);
            
            // Provide more specific error information
            if (error.name === 'AbortError') {
                reject(new Error('Request timeout - please check your connection'));
            } else if (error.message.includes('Failed to fetch')) {
                reject(new Error('Network error - please check your internet connection'));
            } else {
                reject(error);
            }
        } finally {
            this.activeRequests--;
            
            // Continue processing queue
            setTimeout(() => this.processQueue(), this.requestDelay);
        }
    }

    /**
     * Update performance metrics
     */
    updateMetrics(responseTime) {
        this.metrics.responseTimes.push(responseTime);
        
        // Keep only last 100 response times for average calculation
        if (this.metrics.responseTimes.length > 100) {
            this.metrics.responseTimes.shift();
        }
        
        // Calculate average response time
        this.metrics.averageResponseTime = this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length;
    }

    /**
     * Batch multiple requests efficiently
     */
    async batchRequests(requests, options = {}) {
        const {
            maxConcurrent = 3,
            delayBetweenBatches = 200,
            failFast = false
        } = options;
        
        const results = [];
        const errors = [];
        
        // Process requests in batches
        for (let i = 0; i < requests.length; i += maxConcurrent) {
            const batch = requests.slice(i, i + maxConcurrent);
            
            const batchPromises = batch.map(async (request, index) => {
                try {
                    const result = await this.optimizedFetch(request.url, request.options, request.cacheOptions);
                    return { index: i + index, result, error: null };
                } catch (error) {
                    const errorResult = { index: i + index, result: null, error };
                    if (failFast) {
                        throw error;
                    }
                    return errorResult;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            
            // Collect results and errors
            batchResults.forEach(({ index, result, error }) => {
                if (error) {
                    errors.push({ index, error });
                } else {
                    results[index] = result;
                }
            });
            
            // Delay between batches to avoid overwhelming the server
            if (i + maxConcurrent < requests.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        
        return {
            results,
            errors,
            successCount: results.filter(r => r !== undefined).length,
            errorCount: errors.length
        };
    }

    /**
     * Prefetch data for better user experience
     */
    async prefetchData(urls, priority = 'low') {
        const prefetchOptions = {
            priority: priority,
            cache: 'force-cache'
        };
        
        // Use requestIdleCallback if available for low priority prefetching
        if (priority === 'low' && window.requestIdleCallback) {
            return new Promise(resolve => {
                window.requestIdleCallback(async () => {
                    const results = await this.batchRequests(
                        urls.map(url => ({ url, options: prefetchOptions })),
                        { maxConcurrent: 2, failFast: false }
                    );
                    resolve(results);
                });
            });
        }
        
        // High priority prefetching
        return this.batchRequests(
            urls.map(url => ({ url, options: prefetchOptions })),
            { maxConcurrent: priority === 'high' ? 5 : 2, failFast: false }
        );
    }

    /**
     * Smart retry mechanism with exponential backoff
     */
    async retryRequest(url, options = {}, retryOptions = {}) {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2,
            retryCondition = (error) => error.message.includes('network') || error.message.includes('timeout')
        } = retryOptions;
        
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.optimizedFetch(url, options);
            } catch (error) {
                lastError = error;
                
                // Don't retry if condition not met or on last attempt
                if (!retryCondition(error) || attempt === maxRetries) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff
                const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
                
                console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    /**
     * Cancel all pending requests
     */
    cancelAllRequests() {
        this.requestQueue.length = 0;
        this.pendingRequests.clear();
        console.log('All pending requests cancelled');
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const hitRate = this.metrics.totalRequests > 0 ? 
            ((this.metrics.cachedRequests + this.metrics.deduplicatedRequests) / this.metrics.totalRequests * 100).toFixed(2) : 0;
        
        return {
            ...this.metrics,
            hitRate: `${hitRate}%`,
            activeRequests: this.activeRequests,
            queueLength: this.requestQueue.length,
            pendingRequests: this.pendingRequests.size
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            cachedRequests: 0,
            deduplicatedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            responseTimes: []
        };
    }

    /**
     * Configure optimizer settings
     */
    configure(settings = {}) {
        if (settings.maxConcurrentRequests !== undefined) {
            this.maxConcurrentRequests = settings.maxConcurrentRequests;
        }
        if (settings.requestDelay !== undefined) {
            this.requestDelay = settings.requestDelay;
        }
        if (settings.dedupeTTL !== undefined) {
            this.dedupeTTL = settings.dedupeTTL;
        }
        
        console.log('API Optimizer configured:', settings);
    }
}

// Create global API optimizer instance
window.apiOptimizer = new ApiOptimizer();