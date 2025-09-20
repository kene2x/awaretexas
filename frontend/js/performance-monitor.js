// Performance monitoring and optimization utilities
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            apiResponseTimes: [],
            renderTimes: [],
            cacheHitRate: 0,
            memoryUsage: 0,
            networkRequests: 0,
            errors: []
        };
        
        this.observers = [];
        this.startTime = performance.now();
        
        // Initialize performance monitoring
        this.initializeMonitoring();
    }

    /**
     * Initialize performance monitoring
     */
    initializeMonitoring() {
        // Monitor page load performance
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.recordPageLoadTime();
            });
        } else {
            this.recordPageLoadTime();
        }

        // Monitor network requests
        this.monitorNetworkRequests();
        
        // Monitor memory usage
        this.monitorMemoryUsage();
        
        // Monitor render performance
        this.monitorRenderPerformance();
        
        // Monitor errors
        this.monitorErrors();
    }

    /**
     * Record page load time
     */
    recordPageLoadTime() {
        if (performance.timing) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            this.metrics.pageLoadTime = loadTime;
            console.log(`Page load time: ${loadTime}ms`);
        }
    }

    /**
     * Monitor network requests
     */
    monitorNetworkRequests() {
        // Override fetch to monitor API calls
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const startTime = performance.now();
            this.metrics.networkRequests++;
            
            try {
                const response = await originalFetch(...args);
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                this.metrics.apiResponseTimes.push({
                    url: args[0],
                    responseTime,
                    status: response.status,
                    timestamp: Date.now()
                });
                
                // Keep only last 50 response times
                if (this.metrics.apiResponseTimes.length > 50) {
                    this.metrics.apiResponseTimes.shift();
                }
                
                return response;
            } catch (error) {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                this.metrics.errors.push({
                    type: 'network',
                    url: args[0],
                    error: error.message,
                    responseTime,
                    timestamp: Date.now()
                });
                
                throw error;
            }
        };
    }

    /**
     * Monitor memory usage
     */
    monitorMemoryUsage() {
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                    percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2)
                };
            }, 5000); // Check every 5 seconds
        }
    }

    /**
     * Monitor render performance
     */
    monitorRenderPerformance() {
        // Use Performance Observer if available
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'measure') {
                            this.metrics.renderTimes.push({
                                name: entry.name,
                                duration: entry.duration,
                                timestamp: Date.now()
                            });
                            
                            // Keep only last 20 render times
                            if (this.metrics.renderTimes.length > 20) {
                                this.metrics.renderTimes.shift();
                            }
                        }
                    }
                });
                
                observer.observe({ entryTypes: ['measure'] });
                this.observers.push(observer);
            } catch (error) {
                console.warn('Performance Observer not supported:', error);
            }
        }
    }

    /**
     * Monitor JavaScript errors
     */
    monitorErrors() {
        window.addEventListener('error', (event) => {
            this.metrics.errors.push({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                timestamp: Date.now()
            });
            
            // Keep only last 10 errors
            if (this.metrics.errors.length > 10) {
                this.metrics.errors.shift();
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.metrics.errors.push({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                timestamp: Date.now()
            });
        });
    }

    /**
     * Measure render time for specific operations
     */
    measureRender(name, fn) {
        const measureName = `render-${name}`;
        performance.mark(`${measureName}-start`);
        
        const result = fn();
        
        if (result && typeof result.then === 'function') {
            // Handle async functions
            return result.then((value) => {
                performance.mark(`${measureName}-end`);
                performance.measure(measureName, `${measureName}-start`, `${measureName}-end`);
                return value;
            });
        } else {
            // Handle sync functions
            performance.mark(`${measureName}-end`);
            performance.measure(measureName, `${measureName}-start`, `${measureName}-end`);
            return result;
        }
    }

    /**
     * Get cache statistics from cache manager
     */
    updateCacheStats() {
        if (window.cacheManager) {
            const stats = window.cacheManager.getStats();
            this.metrics.cacheHitRate = parseFloat(stats.hitRate) || 0;
        }
        
        if (window.apiOptimizer) {
            const optimizerStats = window.apiOptimizer.getMetrics();
            this.metrics.apiOptimizer = optimizerStats;
        }
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        this.updateCacheStats();
        
        const avgResponseTime = this.metrics.apiResponseTimes.length > 0 ?
            this.metrics.apiResponseTimes.reduce((sum, req) => sum + req.responseTime, 0) / this.metrics.apiResponseTimes.length :
            0;
        
        const avgRenderTime = this.metrics.renderTimes.length > 0 ?
            this.metrics.renderTimes.reduce((sum, render) => sum + render.duration, 0) / this.metrics.renderTimes.length :
            0;
        
        return {
            ...this.metrics,
            averageResponseTime: Math.round(avgResponseTime),
            averageRenderTime: Math.round(avgRenderTime),
            uptime: Math.round(performance.now() - this.startTime),
            timestamp: Date.now()
        };
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const metrics = this.getMetrics();
        
        const report = {
            summary: {
                pageLoadTime: `${metrics.pageLoadTime}ms`,
                averageResponseTime: `${metrics.averageResponseTime}ms`,
                averageRenderTime: `${metrics.averageRenderTime}ms`,
                cacheHitRate: `${metrics.cacheHitRate}%`,
                networkRequests: metrics.networkRequests,
                errors: metrics.errors.length,
                uptime: `${Math.round(metrics.uptime / 1000)}s`
            },
            details: metrics,
            recommendations: this.generateRecommendations(metrics)
        };
        
        return report;
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(metrics) {
        const recommendations = [];
        
        if (metrics.pageLoadTime > 3000) {
            recommendations.push('Page load time is slow (>3s). Consider optimizing images and reducing bundle size.');
        }
        
        if (metrics.averageResponseTime > 1000) {
            recommendations.push('API response times are slow (>1s). Check server performance and network conditions.');
        }
        
        if (metrics.cacheHitRate < 50) {
            recommendations.push('Cache hit rate is low (<50%). Consider increasing cache TTL or improving cache strategy.');
        }
        
        if (metrics.memoryUsage && metrics.memoryUsage.percentage > 80) {
            recommendations.push('Memory usage is high (>80%). Check for memory leaks and optimize data structures.');
        }
        
        if (metrics.errors.length > 5) {
            recommendations.push('High error rate detected. Review error logs and fix critical issues.');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Performance looks good! No major issues detected.');
        }
        
        return recommendations;
    }

    /**
     * Log performance report to console
     */
    logReport() {
        const report = this.generateReport();
        
        console.group('🚀 Performance Report');
        console.table(report.summary);
        
        if (report.recommendations.length > 0) {
            console.group('💡 Recommendations');
            report.recommendations.forEach(rec => console.log(`• ${rec}`));
            console.groupEnd();
        }
        
        console.groupEnd();
        
        return report;
    }

    /**
     * Start continuous monitoring
     */
    startContinuousMonitoring(interval = 30000) {
        setInterval(() => {
            this.logReport();
        }, interval);
    }

    /**
     * Clean up observers
     */
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// Create global performance monitor instance
window.performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.performanceMonitor.startContinuousMonitoring(60000); // Every minute in dev
}