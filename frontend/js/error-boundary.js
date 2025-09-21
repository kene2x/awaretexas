// Frontend Error Boundary and Error Handling for Texas Senate Bill Tracker
class ErrorBoundary {
    constructor() {
        this.errorCount = 0;
        this.maxErrors = 5;
        this.errorResetTime = 5 * 60 * 1000; // 5 minutes
        this.lastErrorTime = null;
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers for unhandled errors
     */
    setupGlobalErrorHandlers() {
        // Handle JavaScript errors (but ignore navigation-related errors)
        window.addEventListener('error', (event) => {
            // Ignore common navigation and script loading errors
            if (event.message && (
                event.message.includes('Script error') ||
                event.message.includes('Non-Error promise rejection') ||
                event.filename && event.filename.includes('extension')
            )) {
                return;
            }
            
            this.handleError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                type: 'javascript'
            });
        });

        // Handle unhandled promise rejections (but ignore navigation-related ones)
        window.addEventListener('unhandledrejection', (event) => {
            // Ignore navigation and common promise rejections
            const message = event.reason?.message || 'Unhandled promise rejection';
            if (message.includes('Navigation') || 
                message.includes('AbortError') ||
                message.includes('The user aborted a request')) {
                return;
            }
            
            this.handleError({
                message: message,
                error: event.reason,
                type: 'promise'
            });
        });

        // Handle network errors
        window.addEventListener('offline', () => {
            this.showNetworkError('offline');
        });

        window.addEventListener('online', () => {
            this.hideNetworkError();
        });
    }

    /**
     * Handle errors with user-friendly messages and recovery options
     */
    handleError(errorInfo) {
        console.error('Error caught by boundary:', errorInfo);

        this.errorCount++;
        this.lastErrorTime = Date.now();

        // Reset error count after timeout
        setTimeout(() => {
            if (Date.now() - this.lastErrorTime >= this.errorResetTime) {
                this.errorCount = 0;
            }
        }, this.errorResetTime);

        // Show error to user if not too many errors
        if (this.errorCount <= this.maxErrors) {
            this.showUserError(errorInfo);
        } else {
            this.showCriticalError();
        }
    }

    /**
     * Show user-friendly error message
     */
    showUserError(errorInfo) {
        // Error pop-ups disabled - just log silently
        console.log('Error boundary triggered (silenced):', errorInfo);
        
        const errorId = `error-${Date.now()}`;
        
        // Store for retry functionality but don't show UI
        }, 10000);
    }

    /**
     * Show critical error when too many errors occur
     */
    showCriticalError() {
        const existingCritical = document.getElementById('critical-error');
        if (existingCritical) return;

        const criticalElement = document.createElement('div');
        criticalElement.id = 'critical-error';
        criticalElement.className = 'fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-50';
        
        criticalElement.innerHTML = `
            <div class="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
                <svg class="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Application Error</h2>
                <p class="text-gray-600 mb-6">The application has encountered multiple errors and needs to be refreshed.</p>
                <div class="space-y-3">
                    <button onclick="window.location.reload()" 
                            class="w-full bg-texas-blue text-white px-4 py-2 rounded-md hover:bg-texas-blue-700 transition-colors">
                        Refresh Page
                    </button>
                    <button onclick="window.errorBoundary.resetErrors()" 
                            class="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors">
                        Try to Continue
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(criticalElement);
    }

    /**
     * Show network error overlay
     */
    showNetworkError(type) {
        const existingNetwork = document.getElementById('network-error');
        if (existingNetwork) return;

        const message = type === 'offline' ? 
            'You are currently offline. Some features may not work properly.' :
            'Network connection issues detected. Please check your internet connection.';

        const networkElement = document.createElement('div');
        networkElement.id = 'network-error';
        networkElement.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white p-3 text-center z-50';
        
        networkElement.innerHTML = `
            <div class="flex items-center justify-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;

        document.body.appendChild(networkElement);
    }

    /**
     * Hide network error overlay
     */
    hideNetworkError() {
        const networkError = document.getElementById('network-error');
        if (networkError) {
            networkError.remove();
        }
    }

    /**
     * Get user-friendly error message based on error type
     */
    getUserFriendlyMessage(errorInfo) {
        const message = errorInfo.message?.toLowerCase() || '';
        
        if (message.includes('network') || message.includes('fetch')) {
            return 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (message.includes('timeout')) {
            return 'The request is taking longer than expected. Please try again.';
        } else if (message.includes('not found') || message.includes('404')) {
            return 'The requested information could not be found.';
        } else if (message.includes('rate limit') || message.includes('429')) {
            return 'Too many requests. Please wait a moment and try again.';
        } else if (message.includes('server') || message.includes('500')) {
            return 'The server is experiencing issues. Please try again later.';
        } else if (message.includes('unauthorized') || message.includes('401')) {
            return 'Authentication error. Please refresh the page and try again.';
        } else if (errorInfo.type === 'javascript') {
            return 'A technical error occurred. The page may need to be refreshed.';
        } else {
            return 'An unexpected error occurred. Please try again or refresh the page.';
        }
    }

    /**
     * Dismiss specific error
     */
    dismissError(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.opacity = '0';
            errorElement.style.transform = 'translateX(100%)';
            setTimeout(() => errorElement.remove(), 300);
        }
    }

    /**
     * Reset error count and remove critical error overlay
     */
    resetErrors() {
        this.errorCount = 0;
        this.lastErrorTime = null;
        
        const criticalError = document.getElementById('critical-error');
        if (criticalError) {
            criticalError.remove();
        }
    }

    /**
     * Retry last action (placeholder - can be enhanced per component)
     */
    retryLastAction(errorId) {
        this.dismissError(errorId);
        
        // Try to reload current page data
        if (window.billTracker && typeof window.billTracker.loadBills === 'function') {
            window.billTracker.loadBills();
        } else if (window.billDetailApp && typeof window.billDetailApp.loadBillDetails === 'function') {
            window.billDetailApp.loadBillDetails();
        } else {
            // Fallback: reload page
            window.location.reload();
        }
    }

    /**
     * Wrap async functions with error handling
     */
    wrapAsync(fn, context = null) {
        return async (...args) => {
            try {
                return await fn.apply(context, args);
            } catch (error) {
                this.handleError({
                    message: error.message,
                    error: error,
                    type: 'async'
                });
                throw error; // Re-throw for component-level handling
            }
        };
    }

    /**
     * Show loading error state for components
     */
    showComponentError(container, message, retryCallback = null) {
        // Error display disabled - just log silently
        console.log('Component error (silenced):', message);
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Unable to Load Content</h3>
                <p class="text-sm text-gray-600 mb-4">${message}</p>
                ${retryCallback ? `
                    <button onclick="${retryCallback}" 
                            class="bg-texas-blue text-white px-4 py-2 rounded-md hover:bg-texas-blue-700 transition-colors">
                        Try Again
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show network status indicator
     */
    showNetworkStatus() {
        const statusElement = document.createElement('div');
        statusElement.id = 'network-status';
        statusElement.className = 'fixed bottom-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm z-40';
        
        const updateStatus = () => {
            const isOnline = navigator.onLine;
            statusElement.innerHTML = `
                <div class="flex items-center">
                    <div class="w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-red-400'}"></div>
                    ${isOnline ? 'Online' : 'Offline'}
                </div>
            `;
            statusElement.className = `fixed bottom-4 left-4 px-3 py-2 rounded-lg text-sm z-40 ${
                isOnline ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`;
        };

        updateStatus();
        document.body.appendChild(statusElement);

        // Update status on network changes
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Auto-hide after 3 seconds if online
        if (navigator.onLine) {
            setTimeout(() => {
                if (statusElement && navigator.onLine) {
                    statusElement.remove();
                }
            }, 3000);
        }
    }
}

// Enhanced fetch wrapper with error handling and retries
class EnhancedFetch {
    constructor() {
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.baseDelay = 1000;
    }

    async fetch(url, options = {}, retryOptions = {}) {
        const {
            maxRetries = this.maxRetries,
            baseDelay = this.baseDelay,
            retryCondition = (error, response) => {
                return !response || 
                       response.status >= 500 || 
                       response.status === 429 ||
                       error?.name === 'TypeError';
            }
        } = retryOptions;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok && retryCondition(null, response) && attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`Request failed (${response.status}), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                return response;
            } catch (error) {
                lastError = error;
                
                if (retryCondition(error, null) && attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`Request failed (${error.message}), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    }
}

// Create global instances
window.errorBoundary = new ErrorBoundary();
window.enhancedFetch = new EnhancedFetch();

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-in {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .animate-slide-in {
        animation: slide-in 0.3s ease-out;
    }
`;
document.head.appendChild(style);

// Show network status on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.onLine) {
        window.errorBoundary.showNetworkStatus();
    }
});