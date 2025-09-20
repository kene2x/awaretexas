// Loading states and skeleton screens manager
class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
        this.loadingStates = new Map();
    }

    /**
     * Create skeleton screen for bill cards with Texas theme
     */
    createBillCardSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'bill-card-skeleton bg-white rounded-lg shadow-sm border border-gray-200 p-6 skeleton-texas';
        
        skeleton.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <div class="h-5 skeleton-texas rounded w-24 mb-2"></div>
                    <div class="h-6 skeleton-texas rounded w-32"></div>
                </div>
            </div>
            
            <div class="space-y-2 mb-4">
                <div class="h-4 skeleton-texas rounded w-full"></div>
                <div class="h-4 skeleton-texas rounded w-3/4"></div>
            </div>
            
            <div class="space-y-2 mb-4">
                <div class="h-3 skeleton-texas rounded w-full"></div>
                <div class="h-3 skeleton-texas rounded w-5/6"></div>
                <div class="h-3 skeleton-texas rounded w-4/5"></div>
            </div>
            
            <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                <div class="h-3 skeleton-texas rounded w-20"></div>
                <div class="h-3 skeleton-texas rounded w-16"></div>
            </div>
        `;
        
        return skeleton;
    }

    /**
     * Create skeleton screen for bill detail page with Texas theme
     */
    createBillDetailSkeleton() {
        return `
            <div class="section-animate-in">
                <!-- Header Skeleton -->
                <div class="mb-8">
                    <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-6">
                        <div class="flex-1">
                            <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                                <div class="h-8 skeleton-texas rounded w-32"></div>
                                <div class="h-6 skeleton-texas rounded w-24"></div>
                            </div>
                            <div class="space-y-2 mb-4">
                                <div class="h-5 skeleton-texas rounded w-full"></div>
                                <div class="h-5 skeleton-texas rounded w-3/4"></div>
                            </div>
                            <div class="flex flex-wrap gap-4">
                                <div class="h-4 skeleton-texas rounded w-24"></div>
                                <div class="h-4 skeleton-texas rounded w-28"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Content Grid Skeleton -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Sponsor Info Skeleton -->
                    <div class="lg:col-span-1">
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div class="text-center">
                                <div class="h-5 skeleton-texas rounded w-32 mx-auto mb-4"></div>
                                <div class="w-20 h-20 skeleton-texas rounded-full mx-auto mb-3"></div>
                                <div class="h-5 skeleton-texas rounded w-24 mx-auto mb-1"></div>
                                <div class="h-4 skeleton-texas rounded w-20 mx-auto mb-1"></div>
                                <div class="h-4 skeleton-texas rounded w-16 mx-auto"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Summary and News Skeleton -->
                    <div class="lg:col-span-2 space-y-8">
                        <!-- Summary Skeleton -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div class="h-5 skeleton-texas rounded w-32"></div>
                                <div class="h-6 skeleton-texas rounded w-24"></div>
                            </div>
                            <div class="space-y-3">
                                <div class="h-4 skeleton-texas rounded w-full"></div>
                                <div class="h-4 skeleton-texas rounded w-5/6"></div>
                                <div class="h-4 skeleton-texas rounded w-4/5"></div>
                            </div>
                        </div>

                        <!-- News Skeleton -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div class="h-5 skeleton-texas rounded w-24"></div>
                                <div class="h-4 skeleton-texas rounded w-16"></div>
                            </div>
                            <div class="space-y-4">
                                ${Array(3).fill(0).map(() => `
                                    <div class="border border-gray-200 rounded-lg p-4">
                                        <div class="h-4 skeleton-texas rounded w-3/4 mb-2"></div>
                                        <div class="flex items-center justify-between">
                                            <div class="h-3 skeleton-texas rounded w-20"></div>
                                            <div class="h-3 skeleton-texas rounded w-16"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show skeleton loading for bill grid with staggered animation
     */
    showBillGridSkeleton(container, count = 12) {
        container.innerHTML = '';
        container.classList.remove('hidden');
        container.classList.add('section-animate-in');
        
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < count; i++) {
            const skeleton = this.createBillCardSkeleton();
            // Stagger the animation for smooth entrance
            skeleton.style.animationDelay = `${i * 75}ms`;
            skeleton.classList.add('bill-card-animate-in');
            fragment.appendChild(skeleton);
        }
        
        container.appendChild(fragment);
    }

    /**
     * Show skeleton loading for bill detail
     */
    showBillDetailSkeleton(container) {
        container.innerHTML = this.createBillDetailSkeleton();
        container.classList.remove('hidden');
    }

    /**
     * Create inline loading spinner with Texas theme
     */
    createSpinner(size = 'medium', color = 'texas-blue') {
        const sizeClasses = {
            small: 'loading-spinner-small',
            medium: 'loading-spinner-texas',
            large: 'w-8 h-8 loading-spinner-texas'
        };
        
        const spinner = document.createElement('div');
        spinner.className = `inline-block ${sizeClasses[size]}`;
        
        // Use the new Texas-themed spinner animation
        if (size === 'small' || size === 'medium' || size === 'large') {
            return spinner;
        }
        
        // Fallback to SVG spinner for custom colors
        spinner.className = `inline-block animate-spin`;
        spinner.innerHTML = `
            <svg class="w-full h-full text-${color}" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
        
        return spinner;
    }

    /**
     * Show loading state for specific element
     */
    showLoading(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const {
            type = 'spinner',
            message = 'Loading...',
            size = 'medium',
            overlay = false
        } = options;
        
        // Store original content
        if (!this.loadingStates.has(elementId)) {
            this.loadingStates.set(elementId, {
                originalContent: element.innerHTML,
                originalClasses: element.className
            });
        }
        
        let loadingContent;
        
        if (type === 'skeleton') {
            if (elementId.includes('bill-grid')) {
                this.showBillGridSkeleton(element);
                return;
            } else if (elementId.includes('bill-detail')) {
                this.showBillDetailSkeleton(element);
                return;
            }
        }
        
        // Default spinner loading
        const spinner = this.createSpinner(size);
        
        if (overlay) {
            loadingContent = `
                <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div class="flex items-center space-x-2">
                        ${spinner.outerHTML}
                        <span class="text-sm text-gray-600">${message}</span>
                    </div>
                </div>
            `;
            element.style.position = 'relative';
        } else {
            loadingContent = `
                <div class="flex items-center justify-center py-8">
                    <div class="flex items-center space-x-2">
                        ${spinner.outerHTML}
                        <span class="text-sm text-gray-600">${message}</span>
                    </div>
                </div>
            `;
        }
        
        element.innerHTML = loadingContent;
        this.activeLoaders.add(elementId);
    }

    /**
     * Hide loading state and restore original content
     */
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const state = this.loadingStates.get(elementId);
        if (state) {
            element.innerHTML = state.originalContent;
            element.className = state.originalClasses;
            element.style.position = '';
            this.loadingStates.delete(elementId);
        }
        
        this.activeLoaders.delete(elementId);
    }

    /**
     * Show loading button state
     */
    showButtonLoading(button, loadingText = 'Loading...') {
        if (!button) return;
        
        const originalText = button.textContent;
        const originalDisabled = button.disabled;
        
        // Store original state
        button.dataset.originalText = originalText;
        button.dataset.originalDisabled = originalDisabled;
        
        // Set loading state
        button.disabled = true;
        button.innerHTML = `
            <div class="flex items-center justify-center">
                ${this.createSpinner('small').outerHTML}
                <span class="ml-2">${loadingText}</span>
            </div>
        `;
    }

    /**
     * Hide loading button state
     */
    hideButtonLoading(button) {
        if (!button) return;
        
        const originalText = button.dataset.originalText;
        const originalDisabled = button.dataset.originalDisabled === 'true';
        
        if (originalText) {
            button.textContent = originalText;
            button.disabled = originalDisabled;
            
            delete button.dataset.originalText;
            delete button.dataset.originalDisabled;
        }
    }

    /**
     * Create progress bar
     */
    createProgressBar(progress = 0) {
        const progressBar = document.createElement('div');
        progressBar.className = 'w-full bg-gray-200 rounded-full h-2';
        
        progressBar.innerHTML = `
            <div class="bg-texas-blue h-2 rounded-full transition-all duration-300 ease-out" 
                 style="width: ${Math.min(100, Math.max(0, progress))}%"></div>
        `;
        
        return progressBar;
    }

    /**
     * Update progress bar
     */
    updateProgress(progressBar, progress) {
        const bar = progressBar.querySelector('div');
        if (bar) {
            bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        
        const typeClasses = {
            info: 'bg-blue-100 border-blue-400 text-blue-700',
            success: 'bg-green-100 border-green-400 text-green-700',
            warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
            error: 'bg-red-100 border-red-400 text-red-700'
        };
        
        const icons = {
            info: '🔵',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        toast.className = `fixed top-4 right-4 ${typeClasses[type]} border px-4 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
        
        toast.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${icons[type]}</span>
                <span class="text-sm font-medium">${message}</span>
                <button class="ml-4 text-lg leading-none" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    }

    /**
     * Clear all active loaders
     */
    clearAllLoaders() {
        this.activeLoaders.forEach(elementId => {
            this.hideLoading(elementId);
        });
    }

    /**
     * Get loading statistics
     */
    getStats() {
        return {
            activeLoaders: Array.from(this.activeLoaders),
            loadingStatesCount: this.loadingStates.size
        };
    }
}

// Create global loading manager instance
window.loadingManager = new LoadingManager();