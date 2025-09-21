// Texas Senate Bill Tracker - Frontend Application
class BillTracker {
    constructor() {
        this.bills = [];
        this.filteredBills = [];
        this.displayedBills = [];
        this.billsPerPage = 10;
        this.currentPage = 1;
        this.filters = {
            search: '',
            topics: [],
            sponsors: [],
            status: ''
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadBills();
    }

    initializeElements() {
        this.loadingElement = document.getElementById('loading');
        this.billGridElement = document.getElementById('bill-grid');
        this.noResultsElement = document.getElementById('no-results');
        this.resultsSummaryElement = document.getElementById('results-summary');
        this.resultsCountElement = document.getElementById('results-count');
        this.filterSummaryElement = document.getElementById('filter-summary');
        this.showMoreButton = document.getElementById('show-more-button');
        
        this.searchInput = document.getElementById('search-input');
        this.topicsFilter = document.getElementById('topics-filter');
        this.sponsorsFilter = document.getElementById('sponsors-filter');
        this.statusFilter = document.getElementById('status-filter');
        this.clearFiltersButton = document.getElementById('clear-filters');
    }

    bindEvents() {
        // Enhanced search input with live keyword filtering and caching
        let searchTimeout;
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            
            // Show live search indicator
            this.showLiveSearchIndicator();
            
            // Update ARIA attributes for screen readers
            this.searchInput.setAttribute('aria-expanded', 'true');
            
            searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase().trim();
                
                // Cache search results for better performance
                if (window.cacheManager) {
                    const cacheKey = window.cacheManager.generateKey('search', { 
                        term: searchTerm,
                        filters: JSON.stringify(this.filters)
                    });
                    
                    const cachedResults = window.cacheManager.get(cacheKey);
                    if (cachedResults) {
                        this.filteredBills = cachedResults;
                        this.renderBills();
                        this.updateResultsSummary();
                        this.hideLiveSearchIndicator();
                        this.announceSearchResults();
                        return;
                    }
                }
                
                this.filters.search = searchTerm;
                this.applyFiltersWithAnimation();
                this.hideLiveSearchIndicator();
                this.announceSearchResults();
            }, 300); // Slightly longer delay for better performance
        });

        // Enhanced filter dropdowns with immediate updates
        this.topicsFilter.addEventListener('change', () => {
            this.filters.topics = Array.from(this.topicsFilter.selectedOptions)
                .map(option => option.value)
                .filter(v => v);
            this.applyFiltersWithAnimation();
        });

        this.sponsorsFilter.addEventListener('change', () => {
            this.filters.sponsors = Array.from(this.sponsorsFilter.selectedOptions)
                .map(option => option.value)
                .filter(v => v);
            this.applyFiltersWithAnimation();
        });

        this.statusFilter.addEventListener('change', () => {
            this.filters.status = this.statusFilter.value;
            this.applyFiltersWithAnimation();
        });

        // Enhanced clear filters button with visual feedback
        this.clearFiltersButton.addEventListener('click', () => {
            this.clearAllFiltersWithAnimation();
        });
        
        // Show More button
        if (this.showMoreButton) {
            this.showMoreButton.addEventListener('click', () => {
                this.showMoreBills();
            });
        }
        
        // Update clear button visibility based on active filters
        this.updateClearButtonState();

        // Enhanced keyboard shortcuts for better accessibility
        document.addEventListener('keydown', (e) => {
            // Escape key clears search
            if (e.key === 'Escape' && document.activeElement === this.searchInput) {
                this.searchInput.value = '';
                this.filters.search = '';
                this.applyFiltersWithAnimation();
                this.announceToScreenReader('Search cleared');
            }
            
            // Ctrl/Cmd + K focuses search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.searchInput.focus();
                this.announceToScreenReader('Search input focused');
            }
            
            // Arrow key navigation for bill cards
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const billCards = document.querySelectorAll('.bill-card-component');
                const currentFocus = document.activeElement;
                const currentIndex = Array.from(billCards).indexOf(currentFocus);
                
                if (currentIndex !== -1) {
                    e.preventDefault();
                    let nextIndex;
                    
                    if (e.key === 'ArrowDown') {
                        nextIndex = (currentIndex + 1) % billCards.length;
                    } else {
                        nextIndex = (currentIndex - 1 + billCards.length) % billCards.length;
                    }
                    
                    billCards[nextIndex].focus();
                }
            }
        });

        // Initialize section animations and intersection observer
        this.initializeSectionAnimations();
        
        // Initialize responsive behavior
        this.initializeResponsiveBehavior();
    }

    async loadBills() {
        try {
            // Show loading state
            this.showLoading();
            
            // Simple fetch without complex error boundary logic
            const response = await fetch('/api/bills', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load bills (${response.status})`);
            }
            
            const data = await response.json();
            
            // Handle both new API format and legacy format
            this.bills = data.data || data.bills || data || [];
            this.filteredBills = [...this.bills];
            
            if (this.bills.length === 0) {
                this.showEmptyState();
                return;
            }
            
            this.populateFilterOptions();
            this.renderBills();
            this.hideLoading();
            
            console.log(`Loaded ${this.bills.length} bills successfully`);
            
        } catch (error) {
            console.error('Error loading bills:', error);
            // Just log the error, don't show error UI to avoid navigation issues
            this.hideLoading();
            this.showEmptyState();
        }
    }

    // Fallback fetch for when optimizer is not available
    async fallbackFetch(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Bills service not found. Please check if the server is running.');
                } else if (response.status >= 500) {
                    throw new Error('Server error occurred. Please try again later.');
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a moment and try again.');
                } else {
                    throw new Error(`Failed to load bills (${response.status}). Please try again.`);
                }
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Prefetch bill details for better performance
    async prefetchBillDetails() {
        if (!window.apiOptimizer || this.bills.length === 0) return;
        
        // Prefetch first 5 bills for instant loading
        const billsToPreload = this.bills.slice(0, 5);
        const urls = billsToPreload.map(bill => `/api/bills/${bill.id || bill.billNumber}`);
        
        try {
            await window.apiOptimizer.prefetchData(urls, 'low');
            console.log(`Prefetched ${urls.length} bill details`);
        } catch (error) {
            console.warn('Prefetch failed:', error);
        }
    }

    showEmptyState() {
        this.hideLoading();
        this.billGridElement.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="max-w-md mx-auto">
                    <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 class="mt-4 text-lg font-medium text-gray-900">No Bills Available</h3>
                    <p class="mt-2 text-sm text-gray-500">There are currently no bills to display. This could be due to the legislative session being out of session or a data update in progress.</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-texas-blue text-white rounded-md hover:bg-texas-blue-700 transition-colors">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
        this.billGridElement.classList.remove('hidden');
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
        successDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            successDiv.style.opacity = '0';
            successDiv.style.transform = 'translateX(100%)';
            setTimeout(() => successDiv.remove(), 300);
        }, 3000);
    }

    initializeSectionAnimations() {
        // Initialize intersection observer for section animations
        if ('IntersectionObserver' in window) {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('section-animate-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            // Observe sections that should animate in
            const sectionsToObserve = document.querySelectorAll('main, .search-section');
            sectionsToObserve.forEach(section => {
                if (!section.classList.contains('section-animate-in')) {
                    observer.observe(section);
                }
            });
        }

        // Add smooth scroll behavior for better transitions
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    initializeResponsiveBehavior() {
        // Handle responsive layout adjustments
        const handleResponsiveLayout = () => {
            const isMobile = window.innerWidth <= 768;
            const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
            
            // Add responsive classes to body for CSS targeting
            document.body.classList.toggle('mobile-layout', isMobile);
            document.body.classList.toggle('tablet-layout', isTablet);
            document.body.classList.toggle('desktop-layout', !isMobile && !isTablet);
            
            // Adjust search results display for different screen sizes and constrained height
            if (isMobile) {
                this.billsPerPage = 6; // Fewer bills per page on mobile for better scrolling
            } else if (isTablet) {
                this.billsPerPage = 8; // Medium amount for tablets
            } else {
                this.billsPerPage = 10; // Optimized for desktop constrained height
            }
            
            // Re-render if bills are already loaded
            if (this.bills.length > 0) {
                this.renderBills();
            }
        };
        
        // Initial call
        handleResponsiveLayout();
        
        // Listen for resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResponsiveLayout, 250);
        });
        
        // Handle mobile browser UI changes
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                // Update viewport height for mobile browser UI changes
                const vh = window.visualViewport.height * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                // Recalculate optimal bills per page based on available height
                this.optimizeBillsPerPage();
            });
        }
    }

    optimizeBillsPerPage() {
        // Calculate optimal number of bills per page based on available height
        const searchResultsContainer = document.querySelector('.search-results-container');
        if (!searchResultsContainer) return;
        
        const containerHeight = searchResultsContainer.clientHeight;
        const estimatedCardHeight = window.innerWidth <= 768 ? 120 : 150; // Estimated height per bill card
        const optimalCount = Math.max(3, Math.floor(containerHeight / estimatedCardHeight));
        
        // Adjust based on screen size
        if (window.innerWidth <= 480) {
            this.billsPerPage = Math.min(optimalCount, 6);
        } else if (window.innerWidth <= 768) {
            this.billsPerPage = Math.min(optimalCount, 8);
        } else {
            this.billsPerPage = Math.min(optimalCount, 12);
        }
        
        // Re-render if bills are loaded
        if (this.bills.length > 0) {
            this.renderBills();
        }
    }

    populateFilterOptions() {
        // Populate topics dropdown from actual bill data
        const topics = [...new Set(this.bills.flatMap(bill => 
            bill.topics && Array.isArray(bill.topics) ? bill.topics : []
        ))].sort();
        
        this.topicsFilter.innerHTML = '<option value="">All Topics</option>';
        topics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            this.topicsFilter.appendChild(option);
        });
        
        // Populate sponsors dropdown
        const sponsors = [...new Set(this.bills.flatMap(bill => 
            bill.sponsors ? bill.sponsors.map(sponsor => sponsor.name || sponsor) : []
        ))].sort();
        
        this.sponsorsFilter.innerHTML = '<option value="">All Sponsors</option>';
        sponsors.forEach(sponsor => {
            const option = document.createElement('option');
            option.value = sponsor;
            option.textContent = sponsor;
            this.sponsorsFilter.appendChild(option);
        });
    }

    applyFilters() {
        // Generate cache key for this filter combination
        const filterKey = window.cacheManager ? 
            window.cacheManager.generateKey('search', { 
                search: this.filters.search,
                topics: this.filters.topics.sort(),
                sponsors: this.filters.sponsors.sort(),
                status: this.filters.status
            }) : null;
        
        // Check cache first
        if (filterKey && window.cacheManager) {
            const cachedResults = window.cacheManager.get(filterKey);
            if (cachedResults) {
                this.filteredBills = cachedResults;
                this.renderBills();
                this.updateResultsSummary();
                return;
            }
        }
        
        // Apply filters
        this.filteredBills = this.bills.filter(bill => {
            // Enhanced search filter with multiple field matching
            if (this.filters.search) {
                const searchTerm = this.filters.search;
                const searchableText = [
                    bill.billNumber || '',
                    bill.shortTitle || '',
                    bill.fullTitle || '',
                    bill.abstract || '',
                    this.generateMeaningfulName(bill), // Include meaningful name in search
                    // Include sponsor names in search
                    ...(bill.sponsors ? bill.sponsors.map(s => s.name || s) : [])
                ].join(' ').toLowerCase();
                
                // Support multiple search terms (AND logic)
                const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);
                if (!searchTerms.every(term => searchableText.includes(term))) {
                    return false;
                }
            }

            // Topics filter
            if (this.filters.topics.length > 0) {
                const billTopics = bill.topics || [];
                if (!this.filters.topics.some(topic => billTopics.includes(topic))) {
                    return false;
                }
            }

            // Sponsors filter
            if (this.filters.sponsors.length > 0) {
                const billSponsors = bill.sponsors ? bill.sponsors.map(s => s.name || s) : [];
                if (!this.filters.sponsors.some(sponsor => billSponsors.includes(sponsor))) {
                    return false;
                }
            }

            // Status filter
            if (this.filters.status && bill.status !== this.filters.status) {
                return false;
            }

            return true;
        });

        // Cache the results
        if (filterKey && window.cacheManager) {
            window.cacheManager.set(filterKey, this.filteredBills);
        }

        this.resetPagination();
        this.renderBills();
        this.updateResultsSummary();
    }

    applyFiltersWithAnimation() {
        // Add subtle loading state during filtering
        this.billGridElement.style.opacity = '0.7';
        this.billGridElement.style.transition = 'opacity 0.15s ease-out';
        
        // Apply filters
        this.applyFilters();
        
        // Restore opacity with animation
        setTimeout(() => {
            this.billGridElement.style.opacity = '1';
        }, 50);
        
        // Update clear button state
        this.updateClearButtonState();
    }

    clearAllFilters() {
        this.filters = {
            search: '',
            topics: [],
            sponsors: [],
            status: ''
        };

        this.searchInput.value = '';
        
        // Clear multi-select dropdowns properly
        Array.from(this.topicsFilter.options).forEach(option => option.selected = false);
        Array.from(this.sponsorsFilter.options).forEach(option => option.selected = false);
        this.statusFilter.selectedIndex = 0;

        this.filteredBills = [...this.bills];
        this.resetPagination();
        this.renderBills();
        this.updateResultsSummary();
        this.updateClearButtonState();
    }

    clearAllFiltersWithAnimation() {
        // Add visual feedback for clear action
        this.clearFiltersButton.style.transform = 'scale(0.95)';
        this.clearFiltersButton.style.transition = 'transform 0.1s ease-out';
        
        setTimeout(() => {
            this.clearFiltersButton.style.transform = 'scale(1)';
        }, 100);
        
        // Show brief loading state
        this.showFilteringState();
        
        setTimeout(() => {
            this.clearAllFilters();
            this.hideFilteringState();
        }, 150);
    }

    showLiveSearchIndicator() {
        // Show live search indicator
        const indicator = document.getElementById('search-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
        this.searchInput.style.borderColor = '#3B82F6'; // blue border
        this.searchInput.style.boxShadow = '0 0 0 1px #3B82F6';
    }

    hideLiveSearchIndicator() {
        // Hide live search indicator
        const indicator = document.getElementById('search-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
        this.searchInput.style.borderColor = '';
        this.searchInput.style.boxShadow = '';
        this.searchInput.setAttribute('aria-expanded', 'false');
    }

    // Announce search results to screen readers
    announceSearchResults() {
        const count = this.filteredBills.length;
        const hasFilters = this.filters.search || this.filters.topics.length > 0 || 
                          this.filters.sponsors.length > 0 || this.filters.status;
        
        let message = `${count} bill${count !== 1 ? 's' : ''} found`;
        if (hasFilters) {
            message += ' matching your search criteria';
        }
        
        this.announceToScreenReader(message);
    }

    // Announce messages to screen readers
    announceToScreenReader(message) {
        // Create or update live region for announcements
        let liveRegion = document.getElementById('sr-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'sr-announcements';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
        
        // Clear and set new message
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
    }

    showFilteringState() {
        // Show subtle loading state during filtering
        const existingLoader = document.querySelector('.filter-loading');
        if (!existingLoader) {
            const loader = document.createElement('div');
            loader.className = 'filter-loading absolute top-2 right-2 w-4 h-4';
            loader.innerHTML = `
                <svg class="animate-spin w-4 h-4 text-texas-blue" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            `;
            document.querySelector('.filter-panel').style.position = 'relative';
            document.querySelector('.filter-panel').appendChild(loader);
        }
    }

    hideFilteringState() {
        const loader = document.querySelector('.filter-loading');
        if (loader) {
            loader.remove();
        }
        
        // Reset search input styling
        this.searchInput.style.borderColor = '';
        this.searchInput.style.boxShadow = '';
    }

    renderBills() {
        if (this.filteredBills.length === 0) {
            this.showNoResults();
            this.hideShowMoreButton();
            return;
        }

        this.hideNoResults();
        
        // Calculate bills to display based on current page
        const startIndex = 0;
        const endIndex = this.currentPage * this.billsPerPage;
        this.displayedBills = this.filteredBills.slice(startIndex, endIndex);
        
        // Clear existing rows with fade out animation
        const existingRows = this.billGridElement.querySelectorAll('.bill-row');
        if (existingRows.length > 0) {
            existingRows.forEach((row, index) => {
                setTimeout(() => {
                    row.style.opacity = '0';
                    row.style.transform = 'translateY(-10px)';
                }, index * 20);
            });
            
            setTimeout(() => {
                this.billGridElement.innerHTML = '';
                this.renderBillsWithAnimation();
            }, existingRows.length * 20 + 100);
        } else {
            this.billGridElement.innerHTML = '';
            this.renderBillsWithAnimation();
        }
        
        // Update show more button
        this.updateShowMoreButton();
    }

    renderBillsWithAnimation() {
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Optimize rendering for constrained height
        const isConstrainedHeight = this.isInConstrainedHeight();
        
        this.displayedBills.forEach((bill, index) => {
            const billRow = this.createBillRow(bill);
            
            // Add enhanced staggered animation with Texas theme
            billRow.classList.add('bill-row-animate-in');
            
            // Reduce animation delay for constrained height for faster rendering
            const animationDelay = isConstrainedHeight ? index * 25 : index * 50;
            billRow.style.animationDelay = `${animationDelay}ms`;
            billRow.style.opacity = '0';
            
            // Add intersection observer for lazy loading in constrained height
            if (isConstrainedHeight && 'IntersectionObserver' in window) {
                this.observeBillCard(billRow);
            }
            
            fragment.appendChild(billRow);
            
            // Trigger animation after DOM insertion
            setTimeout(() => {
                billRow.style.opacity = '1';
            }, 25);
        });
        
        this.billGridElement.appendChild(fragment);
        
        // Add section transition animation to the grid container
        this.billGridElement.classList.add('section-animate-in');
    }

    isInConstrainedHeight() {
        // Check if we're in the fullscreen search section with constrained height
        const searchSection = document.querySelector('.search-section');
        return searchSection && searchSection.classList.contains('snap-section');
    }

    observeBillCard(billCard) {
        // Lazy loading optimization for constrained height
        if (!this.billCardObserver) {
            this.billCardObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('bill-card-visible');
                        this.billCardObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        }
        
        this.billCardObserver.observe(billCard);
    }

    /**
     * Generate a meaningful name from bill title
     * @param {Object} bill - Bill object
     * @returns {string} Meaningful name
     */
    generateMeaningfulName(bill) {
        const title = bill.shortTitle || bill.fullTitle || '';
        
        // If no title, fall back to bill number
        if (!title) {
            return bill.billNumber || 'Unknown Bill';
        }
        
        // Remove common legislative prefixes and suffixes
        let cleanTitle = title
            .replace(/^An Act /i, '')
            .replace(/^relating to /i, '')
            .replace(/^concerning /i, '')
            .replace(/^regarding /i, '')
            .replace(/^amending /i, '')
            .replace(/^creating /i, '')
            .replace(/^establishing /i, '')
            .replace(/^providing for /i, '')
            .replace(/; and providing penalties\.?$/i, '')
            .replace(/; providing penalties\.?$/i, '')
            .replace(/\.$/i, '')
            .trim();
        
        // Extract key meaningful words and create a short name
        const meaningfulWords = cleanTitle
            .split(/\s+/)
            .filter(word => {
                // Filter out common words but keep important ones
                const commonWords = ['the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'a', 'an'];
                const importantWords = ['safety', 'education', 'health', 'tax', 'budget', 'emergency', 'disaster', 'flood', 'camp', 'school', 'medical', 'insurance', 'transportation', 'environment', 'energy', 'water', 'housing', 'business', 'agriculture', 'technology', 'criminal', 'justice', 'voting', 'election', 'government', 'public', 'state', 'local', 'county', 'city', 'municipal', 'appropriations', 'funding', 'grant', 'license', 'permit', 'regulation', 'law', 'code', 'act', 'bill'];
                
                const lowerWord = word.toLowerCase();
                return word.length > 2 && 
                       !commonWords.includes(lowerWord) && 
                       (importantWords.includes(lowerWord) || word.length > 4);
            })
            .slice(0, 3); // Take first 3 meaningful words
        
        if (meaningfulWords.length === 0) {
            // If no meaningful words found, use first few words of title
            const firstWords = cleanTitle.split(/\s+/).slice(0, 3).join(' ');
            return firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords;
        }
        
        // Create meaningful name
        let meaningfulName = meaningfulWords.join(' ');
        
        // Capitalize first letter of each word
        meaningfulName = meaningfulName.replace(/\b\w/g, l => l.toUpperCase());
        
        // Add "Act" or "Bill" suffix if it makes sense
        if (!meaningfulName.toLowerCase().includes('act') && 
            !meaningfulName.toLowerCase().includes('bill') &&
            !meaningfulName.toLowerCase().includes('program') &&
            !meaningfulName.toLowerCase().includes('system')) {
            
            // Determine appropriate suffix based on content
            if (meaningfulName.toLowerCase().includes('safety') || 
                meaningfulName.toLowerCase().includes('emergency') ||
                meaningfulName.toLowerCase().includes('disaster')) {
                meaningfulName += ' Safety Act';
            } else if (meaningfulName.toLowerCase().includes('education') ||
                      meaningfulName.toLowerCase().includes('school')) {
                meaningfulName += ' Education Act';
            } else if (meaningfulName.toLowerCase().includes('tax') ||
                      meaningfulName.toLowerCase().includes('budget') ||
                      meaningfulName.toLowerCase().includes('appropriations')) {
                meaningfulName += ' Budget Bill';
            } else if (meaningfulName.toLowerCase().includes('health') ||
                      meaningfulName.toLowerCase().includes('medical')) {
                meaningfulName += ' Health Act';
            } else {
                meaningfulName += ' Act';
            }
        }
        
        // Ensure it's not too long
        if (meaningfulName.length > 40) {
            meaningfulName = meaningfulName.substring(0, 37) + '...';
        }
        
        return meaningfulName;
    }

    createBillRow(bill) {
        const row = document.createElement('article');
        row.className = 'bill-row bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-texas-blue/30 transition-all duration-200 cursor-pointer animate-fade-in';
        
        // Add accessibility attributes
        row.setAttribute('tabindex', '0');
        row.setAttribute('role', 'button');
        
        const billTitle = bill.shortTitle || bill.fullTitle || 'Untitled Bill';
        const meaningfulName = this.generateMeaningfulName(bill);
        
        row.setAttribute('aria-label', `${bill.billNumber}: ${billTitle}. Status: ${bill.status}. Click to view details.`);
        
        // Add keyboard navigation support
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                row.click();
                this.announceToScreenReader(`Opening details for ${bill.billNumber}`);
            }
        });
        
        // Enhanced status mapping using Texas flag color system
        const statusColors = {
            'Filed': 'bg-blue-50 text-blue-700 border-blue-200',
            'In Committee': 'bg-yellow-50 text-yellow-700 border-yellow-200', 
            'Passed': 'bg-green-50 text-green-700 border-green-200',
            'Vetoed': 'bg-red-50 text-red-700 border-red-200',
            'Signed': 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
        
        const statusColor = statusColors[bill.status] || 'bg-gray-50 text-gray-700 border-gray-200';
        
        // Get primary sponsor and truncate if too long
        let primarySponsor = bill.sponsors && bill.sponsors.length > 0 ? 
            (bill.sponsors[0].name || bill.sponsors[0]) : 'Unknown';
        
        // Truncate long sponsor names to prevent layout issues
        if (primarySponsor.length > 20) {
            primarySponsor = primarySponsor.substring(0, 17) + '...';
        }

        row.innerHTML = `
            <div class="flex items-start justify-between gap-4">
                <!-- Left section: Bill info -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-sm font-bold text-texas-blue bg-texas-blue/10 px-3 py-1 rounded-lg border border-texas-blue/20">
                            ${bill.billNumber}
                        </span>
                        <span class="status-badge text-xs font-medium px-2 py-1 rounded-full border ${statusColor}">
                            ${bill.status}
                        </span>
                    </div>
                    
                    <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
                        ${meaningfulName}
                    </h3>
                    
                    ${bill.abstract ? `
                    <p class="text-sm text-gray-600 mb-2 line-clamp-2 leading-relaxed">
                        ${bill.abstract.length > 120 ? bill.abstract.substring(0, 120) + '...' : bill.abstract}
                    </p>
                    ` : ''}
                    
                    <div class="flex items-center gap-4 text-xs text-gray-500">
                        <span>Sponsor: <span class="font-medium text-gray-700">${primarySponsor}</span></span>
                    </div>
                </div>
                
                <!-- Right section: Action button -->
                <div class="flex-shrink-0">
                    <button class="flex items-center gap-2 text-texas-blue hover:text-texas-red font-medium text-sm transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-texas-blue/5">
                        View Details
                        <svg class="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Click handler for navigation to detail page
        row.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Row clicked, navigating to detail page for:', bill.billNumber);
            // Navigate to bill detail page
            const billId = bill.id || bill.billNumber;
            window.location.href = `bill-detail.html?id=${encodeURIComponent(billId)}`;
        });

        return row;
    }

    resetPagination() {
        this.currentPage = 1;
        this.displayedBills = [];
    }

    showMoreBills() {
        this.currentPage++;
        this.renderBills();
        
        // Smooth scroll to the new content
        setTimeout(() => {
            const newRows = this.billGridElement.querySelectorAll('.bill-row');
            const firstNewRow = newRows[Math.max(0, (this.currentPage - 1) * this.billsPerPage)];
            if (firstNewRow) {
                firstNewRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 300);
    }

    updateShowMoreButton() {
        if (!this.showMoreButton) return;
        
        const hasMoreBills = this.displayedBills.length < this.filteredBills.length;
        
        if (hasMoreBills) {
            this.showMoreButton.style.display = 'block';
            const remainingCount = this.filteredBills.length - this.displayedBills.length;
            const nextBatchSize = Math.min(this.billsPerPage, remainingCount);
            this.showMoreButton.textContent = `Show ${nextBatchSize} More Bills (${remainingCount} remaining)`;
        } else {
            this.showMoreButton.style.display = 'none';
        }
    }

    hideShowMoreButton() {
        if (this.showMoreButton) {
            this.showMoreButton.style.display = 'none';
        }
    }

    navigateToBillDetail(bill, event) {
        console.log('Navigating to bill detail page:', bill);
        
        // Prevent any default navigation
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        // Navigate to bill detail page
        const billId = bill.id || bill.billNumber;
        window.location.href = `bill-detail.html?id=${encodeURIComponent(billId)}`;
    }

    showBillModal(bill) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
        modal.style.animation = 'fadeIn 0.2s ease-out';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto';
        
        const primarySponsor = bill.sponsors && bill.sponsors.length > 0 ? 
            (bill.sponsors[0].name || bill.sponsors[0]) : 'Unknown';
            
        const lastActionDate = bill.lastActionDate ? 
            new Date(bill.lastActionDate).toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long', 
                day: 'numeric' 
            }) : 'No date available';

        modalContent.innerHTML = `
            <div class="p-6">
                <!-- Header -->
                <div class="flex items-start justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-2">${bill.billNumber}</h2>
                        <span class="inline-block px-3 py-1 text-sm font-medium rounded-full ${this.getStatusColorClass(bill.status)}">
                            ${bill.status}
                        </span>
                    </div>
                    <button class="close-modal text-gray-400 hover:text-gray-600 text-2xl font-bold" aria-label="Close modal">
                        ×
                    </button>
                </div>
                
                <!-- Bill Title -->
                <h3 class="text-xl font-semibold text-gray-900 mb-4">
                    ${bill.shortTitle || bill.fullTitle || 'No title available'}
                </h3>
                
                <!-- Bill Info Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-2">Primary Sponsor</h4>
                        <p class="text-gray-600">${primarySponsor}</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-2">Last Action Date</h4>
                        <p class="text-gray-600">${lastActionDate}</p>
                    </div>
                    ${bill.committee ? `
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-2">Committee</h4>
                        <p class="text-gray-600">${bill.committee}</p>
                    </div>
                    ` : ''}
                    ${bill.topics && bill.topics.length > 0 ? `
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-2">Topics</h4>
                        <div class="flex flex-wrap gap-2">
                            ${bill.topics.map(topic => `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">${topic}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Bill Abstract/Summary -->
                ${bill.abstract ? `
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-700 mb-2">Summary</h4>
                    <p class="text-gray-600 leading-relaxed">${bill.abstract}</p>
                </div>
                ` : ''}
                
                <!-- Last Action -->
                ${bill.lastAction ? `
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-700 mb-2">Last Action</h4>
                    <p class="text-gray-600">${bill.lastAction}</p>
                </div>
                ` : ''}
                
                <!-- Bill Text Preview -->
                ${bill.billText ? `
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-700 mb-2">Bill Text Preview</h4>
                    <div class="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                        <p class="text-sm text-gray-700 font-mono leading-relaxed">
                            ${bill.billText.substring(0, 500)}${bill.billText.length > 500 ? '...' : ''}
                        </p>
                    </div>
                </div>
                ` : ''}
                
                <!-- Actions -->
                <div class="flex gap-3 pt-4 border-t">
                    <a href="${bill.officialUrl || '#'}" target="_blank" class="btn-texas-primary">
                        View on Texas Legislature Website
                    </a>
                    <button class="close-modal btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add close functionality
        const closeButtons = modal.querySelectorAll('.close-modal');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 200);
            });
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 200);
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 200);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    getStatusColorClass(status) {
        const statusColors = {
            'Filed': 'bg-blue-100 text-blue-800',
            'In Committee': 'bg-yellow-100 text-yellow-800', 
            'Passed': 'bg-green-100 text-green-800',
            'Vetoed': 'bg-red-100 text-red-800',
            'Signed': 'bg-emerald-100 text-emerald-800'
        };
        return statusColors[status] || 'bg-gray-100 text-gray-800';
    }

    // Enhanced hover preview functionality (keeping for compatibility)
    setupHoverPreview(element) {
        let hoverTimeout;
        let isHovering = false;
        
        element.addEventListener('mouseenter', () => {
            isHovering = true;
            // Shorter delay for better responsiveness
            hoverTimeout = setTimeout(() => {
                if (isHovering) { // Only show if still hovering
                    this.showHoverPreview(card, bill, preview);
                }
            }, 400);
        });

        card.addEventListener('mouseleave', () => {
            isHovering = false;
            clearTimeout(hoverTimeout);
            this.hideHoverPreview();
        });

        // Add keyboard accessibility
        card.addEventListener('focus', () => {
            this.showHoverPreview(card, bill, preview);
        });

        card.addEventListener('blur', () => {
            this.hideHoverPreview();
        });

        // Enhanced keyboard and focus accessibility
        card.addEventListener('focus', () => {
            this.showHoverPreview(card, bill, preview);
            this.announceToScreenReader(`Focused on ${bill.billNumber}: ${billTitle}`);
        });

        card.addEventListener('blur', () => {
            this.hideHoverPreview();
        });

        // Click handler is now handled in createBillRow function

        return card;
    }

    showHoverPreview(card, bill, preview) {
        // Remove any existing preview
        this.hideHoverPreview();
        
        // Create enhanced tooltip with Texas design system
        const tooltip = document.createElement('div');
        tooltip.className = 'bill-preview-tooltip absolute z-50 bg-gray-900 text-white p-4 rounded-xl shadow-xl max-w-sm border border-gray-700';
        tooltip.style.borderRadius = 'var(--radius-xl)';
        tooltip.style.boxShadow = 'var(--shadow-xl), 0 0 0 1px rgba(255, 255, 255, 0.1)';
        tooltip.style.backdropFilter = 'blur(12px)';
        tooltip.style.background = 'linear-gradient(135deg, var(--gray-900) 0%, var(--gray-800) 100%)';
        
        // Create 1-2 sentence summary as required
        const summary = this.generatePreviewSummary(bill);
        
        // Get sponsor info for preview
        const sponsorInfo = bill.sponsors && bill.sponsors.length > 0 ? 
            (bill.sponsors[0].name || bill.sponsors[0]) : 'Unknown';
        
        tooltip.innerHTML = `
            <div class="text-sm font-bold mb-2 text-white" style="color: var(--texas-white); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);">${bill.billNumber}</div>
            <div class="text-xs text-gray-200 leading-relaxed mb-3" style="line-height: 1.6;">${summary}</div>
            <div class="text-xs text-gray-300 space-y-2">
                <div class="flex justify-between items-center">
                    <span>Status:</span> 
                    <span class="font-semibold px-2 py-1 rounded-full text-xs" style="background-color: var(--texas-blue-light); color: var(--texas-white);">${bill.status}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span>Sponsor:</span> 
                    <span class="font-medium text-white truncate ml-2" style="color: var(--texas-white);">${sponsorInfo}</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Enhanced positioning logic
        const rect = card.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Default position: right of card
        let left = rect.right + 10;
        let top = rect.top;
        
        // Adjust horizontal position if tooltip goes off screen
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = rect.left - tooltipRect.width - 10;
        }
        
        // Adjust vertical position if tooltip goes off screen
        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = window.innerHeight - tooltipRect.height - 10;
        }
        
        // Ensure tooltip doesn't go above viewport
        if (top < 10) {
            top = 10;
        }
        
        tooltip.style.left = `${Math.max(10, left)}px`;
        tooltip.style.top = `${top}px`;
        
        // Add fade-in animation
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(-5px)';
        tooltip.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
        
        // Trigger animation
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        });
    }

    generatePreviewSummary(bill) {
        // Generate 1-2 sentence summary as required by task
        let summary = '';
        
        if (bill.abstract && bill.abstract.length > 0) {
            // Use abstract if available, limit to 2 sentences
            const sentences = bill.abstract.split(/[.!?]+/).filter(s => s.trim().length > 0);
            summary = sentences.slice(0, 2).join('. ').trim();
            if (summary && !summary.endsWith('.')) {
                summary += '.';
            }
        } else if (bill.shortTitle) {
            // Fallback to short title with descriptive text
            summary = `This bill addresses ${bill.shortTitle.toLowerCase()}.`;
        } else if (bill.fullTitle) {
            // Fallback to truncated full title
            const truncated = bill.fullTitle.length > 120 ? 
                bill.fullTitle.substring(0, 120) + '...' : 
                bill.fullTitle;
            summary = truncated;
        } else {
            summary = 'Summary not available for this bill.';
        }
        
        // Ensure summary is not too long (max ~200 characters for 1-2 sentences)
        if (summary.length > 200) {
            summary = summary.substring(0, 197) + '...';
        }
        
        return summary;
    }

    hideHoverPreview() {
        const existingTooltip = document.querySelector('.bill-preview-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }

    updateResultsSummary() {
        const totalBills = this.bills.length;
        const filteredCount = this.filteredBills.length;
        const displayedCount = this.displayedBills.length;
        
        // Update results count to show pagination info
        if (displayedCount < filteredCount) {
            this.resultsCountElement.textContent = `${displayedCount} of ${filteredCount}`;
        } else {
            this.resultsCountElement.textContent = filteredCount;
        }
        
        const hasActiveFilters = this.filters.search || 
                                this.filters.topics.length > 0 || 
                                this.filters.sponsors.length > 0 || 
                                this.filters.status;
        
        if (hasActiveFilters) {
            this.filterSummaryElement.classList.remove('hidden');
            
            // Update filter summary text with more detail
            let filterText = ' matching your filters';
            if (filteredCount !== totalBills) {
                filterText = ` of ${totalBills} total bills matching your filters`;
            }
            this.filterSummaryElement.textContent = filterText;
        } else {
            this.filterSummaryElement.classList.add('hidden');
        }
        
        // Add visual feedback for filter results
        if (hasActiveFilters && filteredCount === 0) {
            this.resultsCountElement.className = 'font-semibold text-red-600';
        } else if (hasActiveFilters) {
            this.resultsCountElement.className = 'font-semibold text-texas-blue';
        } else {
            this.resultsCountElement.className = 'font-semibold text-gray-900';
        }
        
        this.resultsSummaryElement.classList.remove('hidden');
        
        // Update ARIA label for results summary for screen readers
        const resultsText = document.getElementById('results-text');
        if (resultsText) {
            const summaryText = `${filteredCount} bill${filteredCount !== 1 ? 's' : ''} ${hasActiveFilters ? 'found matching your search criteria' : 'available'}`;
            resultsText.setAttribute('aria-label', summaryText);
        }
        
        // Update clear button state
        this.updateClearButtonState();
    }

    updateClearButtonState() {
        const hasActiveFilters = this.filters.search || 
                                this.filters.topics.length > 0 || 
                                this.filters.sponsors.length > 0 || 
                                this.filters.status;
        
        if (hasActiveFilters) {
            this.clearFiltersButton.classList.remove('bg-gray-100', 'text-gray-600', 'border-gray-300');
            this.clearFiltersButton.classList.add('bg-texas-blue', 'text-white', 'border-texas-blue');
            this.clearFiltersButton.textContent = 'Clear Filters';
        } else {
            this.clearFiltersButton.classList.remove('bg-texas-blue', 'text-white', 'border-texas-blue');
            this.clearFiltersButton.classList.add('bg-gray-100', 'text-gray-600', 'border-gray-300');
            this.clearFiltersButton.textContent = 'Clear Filters';
        }
    }

    showLoading() {
        this.loadingElement.classList.remove('hidden');
        this.billGridElement.classList.add('hidden');
        this.noResultsElement.classList.add('hidden');
        this.resultsSummaryElement.classList.add('hidden');
    }

    hideLoading() {
        this.loadingElement.classList.add('hidden');
        this.billGridElement.classList.remove('hidden');
    }

    showNoResults() {
        this.billGridElement.classList.add('hidden');
        this.noResultsElement.classList.remove('hidden');
        
        // Update no results message based on active filters
        const hasActiveFilters = this.filters.search || 
                                this.filters.topics.length > 0 || 
                                this.filters.sponsors.length > 0 || 
                                this.filters.status;
        
        if (hasActiveFilters) {
            const noResultsContent = this.noResultsElement.querySelector('h3');
            const noResultsDesc = this.noResultsElement.querySelector('p');
            if (noResultsContent) noResultsContent.textContent = 'No matching bills found';
            if (noResultsDesc) noResultsDesc.textContent = 'Try adjusting your search terms or filter criteria to find more bills.';
        }
    }

    hideNoResults() {
        this.noResultsElement.classList.add('hidden');
        this.billGridElement.classList.remove('hidden');
    }

    showError(message) {
        // Disabled error pop-ups - just log silently
        console.log('Bills loading error (silenced):', message);
        this.hideLoading();
        this.showEmptyState();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Texas Senate Bill Tracker loaded');
    
    // Create global reference for error handling with performance monitoring
    if (window.performanceMonitor) {
        window.performanceMonitor.measureRender('app-init', () => {
            window.billTracker = new BillTracker();
        });
    } else {
        window.billTracker = new BillTracker();
    }
    
    // Add global error handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.log('Unhandled promise rejection (silenced):', event.reason);
        
        // Error pop-ups disabled - just log silently
        // const errorDiv = document.createElement('div');
        // errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
        // Error pop-up code disabled
        
        // Prevent the default browser error handling
        event.preventDefault();
    });
});
// Mobile Navigation Handler for AWARE TEXAS Header
class MobileNavigation {
    constructor() {
        this.mobileNavToggle = document.getElementById('mobile-nav-toggle');
        this.mobileNavMenu = document.getElementById('mobile-nav-menu');
        this.isOpen = false;
        
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.mobileNavToggle && this.mobileNavMenu) {
            this.mobileNavToggle.addEventListener('click', () => {
                this.toggleMenu();
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (this.isOpen && 
                    !this.mobileNavMenu.contains(e.target) && 
                    !this.mobileNavToggle.contains(e.target)) {
                    this.closeMenu();
                }
            });
            
            // Close menu on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeMenu();
                }
            });
            
            // Close menu when window is resized to desktop size
            window.addEventListener('resize', () => {
                if (window.innerWidth >= 640 && this.isOpen) { // sm breakpoint
                    this.closeMenu();
                }
            });
        }
    }
    
    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        this.isOpen = true;
        this.mobileNavMenu.classList.remove('hidden');
        this.mobileNavMenu.classList.add('visible');
        
        // Update button icon to X
        this.mobileNavToggle.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
        
        // Update ARIA attributes
        this.mobileNavToggle.setAttribute('aria-expanded', 'true');
        this.mobileNavMenu.setAttribute('aria-hidden', 'false');
    }
    
    closeMenu() {
        this.isOpen = false;
        this.mobileNavMenu.classList.remove('visible');
        this.mobileNavMenu.classList.add('hidden');
        
        // Update button icon to hamburger
        this.mobileNavToggle.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
        `;
        
        // Update ARIA attributes
        this.mobileNavToggle.setAttribute('aria-expanded', 'false');
        this.mobileNavMenu.setAttribute('aria-hidden', 'true');
    }
}

// Initialize mobile navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MobileNavigation();
});