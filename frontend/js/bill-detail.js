// Texas Senate Bill Tracker - Bill Detail Page
class BillDetailApp {
    constructor() {
        this.billId = null;
        this.bill = null;
        this.summary = null;
        
        this.initializeElements();
        this.extractBillId();
        this.loadBillDetails();
    }

    initializeElements() {
        this.loadingElement = document.getElementById('loading');
        this.billDetailContent = document.getElementById('bill-detail-content');
        this.errorState = document.getElementById('error-state');
        this.errorMessage = document.getElementById('error-message');
        
        // Component containers
        this.billHeaderElement = document.getElementById('bill-header');
        this.sponsorInfoElement = document.getElementById('sponsor-info');
        this.summarySectionElement = document.getElementById('summary-section');
        this.newsSectionElement = document.getElementById('news-section');
        this.officialLinkElement = document.getElementById('official-link');
    }

    extractBillId() {
        // Extract bill ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.billId = urlParams.get('id');
        
        if (!this.billId) {
            this.showError('No bill ID provided in URL');
            return;
        }
    }

    async loadBillDetails() {
        if (!this.billId) {
            return;
        }

        const wrappedLoadDetails = window.errorBoundary.wrapAsync(async () => {
            // Show skeleton loading for better UX
            if (window.loadingManager) {
                window.loadingManager.showBillDetailSkeleton(this.billDetailContent);
            } else {
                this.showLoading();
            }
            
            // Use enhanced fetch with retry logic, fallback to regular fetch
            const response = window.enhancedFetch ? 
                await window.enhancedFetch.fetch(`/api/bills/${this.billId}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }, {
                    maxRetries: 3,
                    retryCondition: (error, response) => {
                        return !response || 
                               response.status >= 500 || 
                               response.status === 429 ||
                               error?.name === 'TypeError' ||
                               error?.message?.includes('network');
                    }
                }) :
                await fetch(`/api/bills/${this.billId}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Bill not found. It may have been removed or the ID is incorrect.');
                } else if (response.status >= 500) {
                    throw new Error('Server error occurred. Please try again later.');
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a moment and try again.');
                } else {
                    throw new Error(`Failed to load bill details (${response.status}). Please try again.`);
                }
            }
            
            const data = await response.json();
            
            // Handle both new API format and legacy format
            this.bill = data.data || data.bill || data;
            
            if (!this.bill) {
                throw new Error('Invalid bill data received from server.');
            }
            
            // Update page title
            document.title = `${this.bill.billNumber} - Texas Senate Bill Tracker`;
            
            // Render all components
            this.renderBillHeader();
            this.renderSponsorInfo();
            this.renderSummarySection();
            this.renderNewsSection();
            this.renderOfficialLink();
            
            this.hideLoading();
        }, this);

        try {
            await wrappedLoadDetails();
        } catch (error) {
            console.error('Error loading bill details:', error);
            
            // Enhanced error handling with specific error types
            let errorMessage = 'An unexpected error occurred while loading bill details.';
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'The request timed out. The server may be experiencing high traffic. Please try again.';
            } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
        }
    }

    // Fallback fetch for when optimizer is not available
    async fallbackFetch(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
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
                    throw new Error('Bill not found. It may have been removed or the ID is incorrect.');
                } else if (response.status >= 500) {
                    throw new Error('Server error occurred. Please try again later.');
                } else {
                    throw new Error(`Failed to load bill details (${response.status}). Please try again.`);
                }
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    renderBillHeader() {
        // Enhanced status color mapping with Texas flag theme
        const statusColors = {
            'Filed': 'bg-yellow-50 text-yellow-700 border-yellow-400',
            'In Committee': 'bg-texas-blue bg-opacity-10 text-texas-blue border-texas-blue border-opacity-30',
            'Passed': 'bg-green-50 text-green-700 border-green-400'
        };
        
        const statusColor = statusColors[this.bill.status] || 'bg-gray-50 text-gray-700 border-gray-300';
        
        // Format dates if available
        const formatDate = (dateString) => {
            if (!dateString) return null;
            try {
                return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch {
                return null;
            }
        };

        const filedDate = formatDate(this.bill.filedDate);
        const lastUpdated = formatDate(this.bill.lastUpdated);

        this.billHeaderElement.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-6">
                <div class="flex-1">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                        <h1 class="heading-primary">${this.bill.billNumber}</h1>
                        <span class="status-badge ${statusColor} text-sm px-3 py-1">
                            ${this.bill.status === 'Filed' ? '📄' : this.bill.status === 'In Committee' ? '🏛️' : this.bill.status === 'Passed' ? '✅' : '📋'} ${this.bill.status}
                        </span>
                    </div>
                    
                    <h2 class="text-responsive-base text-gray-700 mb-4 leading-relaxed">
                        ${this.bill.fullTitle || this.bill.shortTitle}
                    </h2>
                    
                    ${this.bill.committee ? `
                        <div class="flex items-center text-sm text-gray-600 mb-2">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                            Committee: ${this.bill.committee}
                        </div>
                    ` : ''}
                    
                    <div class="flex flex-wrap gap-4 text-sm text-gray-600">
                        ${filedDate ? `
                            <div class="flex items-center">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                Filed: ${filedDate}
                            </div>
                        ` : ''}
                        
                        ${lastUpdated ? `
                            <div class="flex items-center">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                                Updated: ${lastUpdated}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${this.bill.topics && this.bill.topics.length > 0 ? `
                <div class="border-t border-gray-200 pt-4">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Topics:</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        ${this.bill.topics.map(topic => `
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-texas-blue bg-opacity-10 text-texas-blue border border-texas-blue border-opacity-20">
                                ${topic}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderSponsorInfo() {
        const sponsors = this.bill.sponsors || [];
        const primarySponsor = sponsors[0];
        const coSponsors = sponsors.slice(1);
        
        if (!primarySponsor) {
            this.sponsorInfoElement.innerHTML = `
                <div class="text-center py-8">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">No Sponsor Information</h3>
                    <p class="mt-1 text-sm text-gray-500">Sponsor details are not available for this bill.</p>
                </div>
            `;
            return;
        }

        // Handle both object and string sponsor formats
        const getSponsorName = (sponsor) => {
            return typeof sponsor === 'object' ? sponsor.name : sponsor;
        };

        const getSponsorPhoto = (sponsor) => {
            return typeof sponsor === 'object' ? sponsor.photoUrl : null;
        };

        const getSponsorDistrict = (sponsor) => {
            return typeof sponsor === 'object' ? sponsor.district : null;
        };

        const primarySponsorName = getSponsorName(primarySponsor);
        const primarySponsorPhoto = getSponsorPhoto(primarySponsor);
        const primarySponsorDistrict = getSponsorDistrict(primarySponsor);

        this.sponsorInfoElement.innerHTML = `
            <div class="text-center">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Sponsor Information</h3>
                
                <!-- Primary Sponsor -->
                <div class="mb-6">
                    <div class="flex flex-col items-center">
                        ${primarySponsorPhoto ? `
                            <img 
                                src="${primarySponsorPhoto}" 
                                alt="${primarySponsorName}"
                                class="w-20 h-20 rounded-full object-cover border-2 border-gray-200 mb-3"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            >
                            <div class="w-20 h-20 rounded-full bg-texas-blue bg-opacity-10 border-2 border-texas-blue border-opacity-20 flex items-center justify-center mb-3" style="display: none;">
                                <svg class="w-8 h-8 text-texas-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        ` : `
                            <div class="w-20 h-20 rounded-full bg-texas-blue bg-opacity-10 border-2 border-texas-blue border-opacity-20 flex items-center justify-center mb-3">
                                <svg class="w-8 h-8 text-texas-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        `}
                        
                        <h4 class="text-lg font-semibold text-gray-900">${primarySponsorName}</h4>
                        <p class="text-sm text-gray-600 mb-1">Primary Sponsor</p>
                        
                        ${primarySponsorDistrict ? `
                            <p class="text-sm text-gray-500">District ${primarySponsorDistrict}</p>
                        ` : ''}
                    </div>
                </div>
                
                ${coSponsors.length > 0 ? `
                    <div class="border-t border-gray-200 pt-4">
                        <h5 class="text-sm font-medium text-gray-700 mb-3">Co-Sponsors</h5>
                        <div class="space-y-2">
                            ${coSponsors.map(sponsor => {
                                const name = getSponsorName(sponsor);
                                const district = getSponsorDistrict(sponsor);
                                return `
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="text-gray-900">${name}</span>
                                        ${district ? `<span class="text-gray-500">District ${district}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderSummarySection() {
        this.summarySectionElement.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">AI-Generated Summary</h3>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs text-gray-500">Reading Level:</span>
                        <select id="reading-level-toggle" class="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-texas-blue focus:border-transparent">
                            <option value="high-level">High Level</option>
                            <option value="detailed">Detailed</option>
                        </select>
                    </div>
                </div>
                
                <!-- Summary Content -->
                <div id="summary-content">
                    <div id="summary-loading" class="flex items-center justify-center py-8">
                        <div class="flex items-center text-sm text-gray-600">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-texas-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading summary...
                        </div>
                    </div>
                    
                    <div id="summary-text" class="hidden">
                        <!-- Summary text will be populated here -->
                    </div>
                    
                    <div id="summary-error" class="hidden">
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div class="flex">
                                <svg class="w-5 h-5 text-yellow-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                                <div>
                                    <h4 class="text-sm font-medium text-yellow-800">Summary Unavailable</h4>
                                    <p class="text-sm text-yellow-700 mt-1">Unable to generate AI summary at this time. Please try again later.</p>
                                    <button onclick="window.billDetailApp.loadSummary()" class="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900">
                                        Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${this.bill.abstract ? `
                    <div class="mt-6 pt-6 border-t border-gray-200">
                        <h4 class="text-sm font-medium text-gray-700 mb-2">Official Abstract</h4>
                        <p class="text-sm text-gray-600 leading-relaxed">${this.bill.abstract}</p>
                    </div>
                ` : ''}
            </div>
        `;

        // Bind reading level toggle event
        setTimeout(() => {
            const readingLevelToggle = document.getElementById('reading-level-toggle');
            if (readingLevelToggle) {
                readingLevelToggle.addEventListener('change', () => {
                    this.loadSummary(readingLevelToggle.value);
                });
            } else {
                console.warn('Reading level toggle element not found');
            }
        }, 100);

        // Load initial summary
        this.loadSummary('high-level');
    }

    async loadSummary(readingLevel = 'high-level') {
        const summaryLoading = document.getElementById('summary-loading');
        const summaryText = document.getElementById('summary-text');
        const summaryError = document.getElementById('summary-error');

        // Show loading state
        summaryLoading.classList.remove('hidden');
        summaryText.classList.add('hidden');
        summaryError.classList.add('hidden');

        try {
            // Use optimized fetch with caching for summaries
            const data = await (window.apiOptimizer ? 
                window.apiOptimizer.optimizedFetch(`/api/bills/summary/${this.billId}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ readingLevel })
                }, {
                    cacheType: 'summary',
                    cacheParams: { billId: this.billId, readingLevel }
                }) :
                this.fallbackSummaryFetch(readingLevel)
            );

            // Handle both new API format and legacy format
            this.summary = data.data?.summary || data.summary || data;

            // Display summary
            summaryText.innerHTML = `
                <div class="prose prose-sm max-w-none">
                    <p class="text-gray-700 leading-relaxed">${this.summary}</p>
                </div>
                
                <div class="mt-4 flex items-center text-xs text-gray-500">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    Generated by AI • Reading Level: ${readingLevel.charAt(0).toUpperCase() + readingLevel.slice(1).replace('-', ' ')}
                </div>
            `;

            summaryLoading.classList.add('hidden');
            summaryText.classList.remove('hidden');

        } catch (error) {
            console.error('Error loading summary:', error);
            
            // Update error message based on error type
            const summaryErrorElement = document.querySelector('#summary-error p');
            if (summaryErrorElement) {
                if (error.message.includes('429')) {
                    summaryErrorElement.textContent = 'AI service is temporarily unavailable due to high demand. Please try again in a few minutes.';
                } else if (error.message.includes('500')) {
                    summaryErrorElement.textContent = 'AI service is currently experiencing issues. Please try again later.';
                } else if (error.message.includes('timeout')) {
                    summaryErrorElement.textContent = 'AI summary generation timed out. Please try again.';
                } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
                    summaryErrorElement.textContent = 'Network error. Please check your internet connection and try again.';
                } else {
                    summaryErrorElement.textContent = 'Unable to generate AI summary at this time. Please try again later.';
                }
            }
            
            summaryLoading.classList.add('hidden');
            summaryError.classList.remove('hidden');
        }
    }

    // Fallback summary fetch for when optimizer is not available
    async fallbackSummaryFetch(readingLevel) {
        const response = await fetch(`/api/bills/summary/${this.billId}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ readingLevel })
        });

        if (!response.ok) {
            throw new Error(`Failed to load summary (${response.status})`);
        }

        return await response.json();
    }

    renderNewsSection() {
        this.newsSectionElement.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Related News</h3>
                    <button onclick="window.billDetailApp.loadNews()" class="text-sm text-texas-blue hover:text-texas-blue-700 transition-colors">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
                
                <!-- News Content -->
                <div id="news-content">
                    <div id="news-loading" class="flex items-center justify-center py-8">
                        <div class="flex items-center text-sm text-gray-600">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-texas-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading related news...
                        </div>
                    </div>
                    
                    <div id="news-articles" class="hidden">
                        <!-- News articles will be populated here -->
                    </div>
                    
                    <div id="news-error" class="hidden">
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div class="flex">
                                <svg class="w-5 h-5 text-yellow-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                                <div>
                                    <h4 class="text-sm font-medium text-yellow-800">News Unavailable</h4>
                                    <p id="news-error-message" class="text-sm text-yellow-700 mt-1">Unable to load related news articles at this time.</p>
                                    <button onclick="window.billDetailApp.loadNews()" class="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900">
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="news-empty" class="hidden">
                        <div class="text-center py-8">
                            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            <h4 class="text-lg font-medium text-gray-900 mb-2">No Related News Found</h4>
                            <p class="text-sm text-gray-500">There are currently no news articles related to this bill.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load news articles
        this.loadNews();
    }

    async loadNews() {
        const newsLoading = document.getElementById('news-loading');
        const newsArticles = document.getElementById('news-articles');
        const newsError = document.getElementById('news-error');
        const newsEmpty = document.getElementById('news-empty');
        const newsErrorMessage = document.getElementById('news-error-message');

        // Show loading state
        newsLoading.classList.remove('hidden');
        newsArticles.classList.add('hidden');
        newsError.classList.add('hidden');
        newsEmpty.classList.add('hidden');

        try {
            // Use optimized fetch with caching for news
            const data = await (window.apiOptimizer ? 
                window.apiOptimizer.optimizedFetch(`/api/bills/news/${this.billId}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }, {
                    cacheType: 'news',
                    cacheParams: { billId: this.billId }
                }) :
                this.fallbackNewsFetch()
            );

            // Handle both new API format and legacy format
            const articles = data.data?.articles || data.articles || data || [];

            if (!Array.isArray(articles) || articles.length === 0) {
                newsLoading.classList.add('hidden');
                newsEmpty.classList.remove('hidden');
                return;
            }

            // Display news articles
            newsArticles.innerHTML = `
                <div class="space-y-4">
                    ${articles.map(article => {
                        const publishedDate = article.publishedAt ? 
                            new Date(article.publishedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            }) : null;

                        return `
                            <article class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div class="flex flex-col space-y-2">
                                    <h4 class="font-semibold text-gray-900 leading-tight">
                                        <a 
                                            href="${article.url}" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            class="hover:text-texas-blue transition-colors"
                                        >
                                            ${article.headline || article.title}
                                        </a>
                                    </h4>
                                    
                                    <div class="flex items-center justify-between text-sm text-gray-600">
                                        <div class="flex items-center space-x-2">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
                                            </svg>
                                            <span class="font-medium">${article.source || 'Unknown Source'}</span>
                                        </div>
                                        
                                        ${publishedDate ? `
                                            <div class="flex items-center space-x-1">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                </svg>
                                                <span>${publishedDate}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    
                                    ${article.description ? `
                                        <p class="text-sm text-gray-700 leading-relaxed">${article.description}</p>
                                    ` : ''}
                                    
                                    <div class="flex items-center justify-between pt-2">
                                        <a 
                                            href="${article.url}" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center text-sm text-texas-blue hover:text-texas-blue-700 transition-colors"
                                        >
                                            Read Full Article
                                            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
                
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <p class="text-xs text-gray-500 text-center">
                        News articles are automatically sourced and may not directly reference this specific bill.
                    </p>
                </div>
            `;

            newsLoading.classList.add('hidden');
            newsArticles.classList.remove('hidden');

        } catch (error) {
            console.error('Error loading news:', error);
            
            newsErrorMessage.textContent = error.message;
            newsLoading.classList.add('hidden');
            newsError.classList.remove('hidden');
        }
    }

    // Fallback news fetch for when optimizer is not available
    async fallbackNewsFetch() {
        const response = await fetch(`/api/bills/news/${this.billId}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('No news articles found for this bill.');
            } else if (response.status === 429) {
                throw new Error('News service is temporarily unavailable due to rate limits. Please try again later.');
            } else if (response.status >= 500) {
                throw new Error('News service is currently unavailable. Please try again later.');
            } else {
                throw new Error(`Failed to load news articles (${response.status}). Please try again.`);
            }
        }

        return await response.json();
    }

    renderOfficialLink() {
        // Generate fallback URL if official URL is not available
        const fallbackUrl = this.bill.billNumber ? 
            `https://capitol.texas.gov/Search/BillSearchResults.aspx?NSP=1&SPL=False&SPC=False&SPA=True&SPV=False&SPS=False&SPD=False&SPM=False&SPT=False&SPN=False&SPH=False&SPE=False&SPR=False&SBO=False&Bill=${encodeURIComponent(this.bill.billNumber)}` : 
            null;

        const linkUrl = this.bill.officialUrl || fallbackUrl;
        const hasOfficialLink = Boolean(linkUrl);

        this.officialLinkElement.innerHTML = `
            <div class="text-center">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Official Information</h3>
                
                ${hasOfficialLink ? `
                    <a 
                        href="${linkUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="inline-flex items-center px-4 py-3 bg-texas-blue text-white rounded-lg hover:bg-texas-blue-700 transition-colors font-medium w-full justify-center mb-3"
                        onclick="this.classList.add('opacity-75'); setTimeout(() => this.classList.remove('opacity-75'), 1000);"
                    >
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        ${this.bill.officialUrl ? 'View Official Bill Page' : 'Search on Texas Legislature'}
                    </a>
                    
                    <p class="text-xs text-gray-500 mb-4">
                        ${this.bill.officialUrl ? 
                            'View the official bill page on the Texas Legislature Online website' : 
                            'Search for this bill on the Texas Legislature Online website'
                        }
                    </p>
                ` : `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                        </svg>
                        <p class="text-sm text-gray-600 mb-2">Official link not available</p>
                        <p class="text-xs text-gray-500">Unable to generate link for this bill</p>
                    </div>
                `}
                
                <!-- Quick Actions -->
                <div class="mb-6">
                    <h4 class="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
                    <div class="grid grid-cols-1 gap-2">
                        <button 
                            onclick="window.billDetailApp.copyBillInfo()"
                            class="flex items-center justify-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                            Copy Bill Info
                        </button>
                        
                        <button 
                            onclick="window.billDetailApp.shareBill()"
                            class="flex items-center justify-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                            </svg>
                            Share Bill
                        </button>
                    </div>
                </div>
                
                <div class="pt-4 border-t border-gray-200">
                    <h4 class="text-sm font-medium text-gray-700 mb-3">Additional Resources</h4>
                    <div class="space-y-2">
                        <a 
                            href="https://capitol.texas.gov/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="flex items-center text-sm text-texas-blue hover:text-texas-blue-700 transition-colors"
                        >
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                            Texas Legislature Online
                        </a>
                        
                        <a 
                            href="https://www.senate.texas.gov/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="flex items-center text-sm text-texas-blue hover:text-texas-blue-700 transition-colors"
                        >
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                            Texas Senate
                        </a>
                        
                        <a 
                            href="https://www.legis.state.tx.us/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="flex items-center text-sm text-texas-blue hover:text-texas-blue-700 transition-colors"
                        >
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Legislative Reference Library
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper method to copy bill information to clipboard
    async copyBillInfo() {
        try {
            const billInfo = `${this.bill.billNumber}: ${this.bill.shortTitle || this.bill.fullTitle}
Status: ${this.bill.status}
${this.bill.officialUrl ? `Official URL: ${this.bill.officialUrl}` : ''}
View Details: ${window.location.href}`;

            await navigator.clipboard.writeText(billInfo);
            
            // Show temporary success message
            this.showTemporaryMessage('Bill information copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy bill info:', error);
            this.showTemporaryMessage('Failed to copy bill information', 'error');
        }
    }

    // Helper method to share bill
    async shareBill() {
        const shareData = {
            title: `${this.bill.billNumber} - Texas Senate Bill Tracker`,
            text: `${this.bill.billNumber}: ${this.bill.shortTitle || this.bill.fullTitle}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copy URL to clipboard
                await navigator.clipboard.writeText(window.location.href);
                this.showTemporaryMessage('Bill URL copied to clipboard!', 'success');
            }
        } catch (error) {
            console.error('Failed to share bill:', error);
            this.showTemporaryMessage('Failed to share bill', 'error');
        }
    }

    // Helper method to show temporary messages
    showTemporaryMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
            type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
        }`;
        messageElement.textContent = message;

        document.body.appendChild(messageElement);

        // Animate in
        setTimeout(() => {
            messageElement.style.transform = 'translateX(0)';
            messageElement.style.opacity = '1';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            messageElement.style.transform = 'translateX(100%)';
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 3000);
    }

    showLoading() {
        this.loadingElement.classList.remove('hidden');
        this.billDetailContent.classList.add('hidden');
        this.errorState.classList.add('hidden');
    }

    hideLoading() {
        this.loadingElement.classList.add('hidden');
        this.billDetailContent.classList.remove('hidden');
    }

    showError(message) {
        this.loadingElement.classList.add('hidden');
        this.billDetailContent.classList.add('hidden');
        this.errorState.classList.remove('hidden');
        this.errorMessage.textContent = message;
    }
}

// Initialize the application when the DOM is loaded and dependencies are ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for all dependencies to be ready
    const initializeApp = () => {
        if (window.enhancedFetch && window.errorBoundary) {
            // Initialize with performance monitoring
            if (window.performanceMonitor) {
                window.performanceMonitor.measureRender('bill-detail-init', () => {
                    window.billDetailApp = new BillDetailApp();
                });
            } else {
                window.billDetailApp = new BillDetailApp();
            }
        } else {
            // Dependencies not ready, wait a bit and try again
            setTimeout(initializeApp, 100);
        }
    };
    
    initializeApp();
});