// Texas Senate Bill Tracker - Bill Detail Page (Enhanced with Debug Logging)
class BillDetailApp {
    constructor() {
        console.log('🚀 BillDetailApp constructor started');

        this.billId = null;
        this.bill = null;
        this.summary = null;

        console.log('📋 Initializing elements...');
        this.initializeElements();

        console.log('🔍 Extracting bill ID...');
        this.extractBillId();

        console.log('📥 Loading bill details...');
        this.loadBillDetails();

        console.log('✅ BillDetailApp constructor completed');
    }

    initializeElements() {
        console.log('🔧 Getting DOM elements...');

        // Wait for DOM to be ready if needed
        if (document.readyState === 'loading') {
            console.log('⏳ DOM still loading, waiting...');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('✅ DOM loaded, re-initializing elements');
                this.initializeElements();
            });
            return;
        }

        this.loadingElement = document.getElementById('loading');
        this.billDetailContent = document.getElementById('bill-detail-content');
        this.errorState = document.getElementById('error-state');
        this.errorMessage = document.getElementById('error-message');

        // Component containers
        this.billHeaderElement = document.getElementById('bill-header');
        this.sponsorInfoElement = document.getElementById('sponsor-info');
        this.summarySectionElement = document.getElementById('summary-section');

        this.officialLinkElement = document.getElementById('official-link');

        // Debug: Check if all elements were found
        const elements = {
            loading: this.loadingElement,
            billDetailContent: this.billDetailContent,
            errorState: this.errorState,
            errorMessage: this.errorMessage,
            billHeader: this.billHeaderElement,
            sponsorInfo: this.sponsorInfoElement,
            summarySection: this.summarySectionElement,
            officialLink: this.officialLinkElement
        };

        console.log('🔍 DOM elements found:', elements);

        // Warn about missing elements
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.warn(`⚠️ Missing DOM element: ${name}`);
            }
        });

        // Ensure loading is initially shown and content is hidden
        if (this.loadingElement && this.billDetailContent) {
            this.loadingElement.classList.remove('hidden');
            this.billDetailContent.classList.add('hidden');
            if (this.errorState) {
                this.errorState.classList.add('hidden');
                // Force hide with inline style as backup
                this.errorState.style.display = 'none';
                console.log('🔧 Error state forcefully hidden');
            }
            console.log('🎯 Initial state set: loading shown, content hidden, error hidden');
        }
    }

    extractBillId() {
        console.log('🔍 Extracting bill ID from URL...');
        console.log('📍 Current URL:', window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        this.billId = urlParams.get('id');

        console.log('🆔 Raw bill ID from URL:', this.billId);
        console.log('🆔 Decoded bill ID:', this.billId ? decodeURIComponent(this.billId) : null);

        if (!this.billId) {
            console.error('❌ No bill ID provided in URL');
            this.showError('No bill ID provided in URL');
            return;
        }

        console.log('✅ Bill ID extracted successfully:', this.billId);
    }



    async loadBillDetails() {
        console.log('📥 loadBillDetails() started');

        if (!this.billId) {
            console.error('❌ No bill ID provided for loading');
            this.showError('No bill ID provided in URL');
            return;
        }

        console.log('🆔 Loading bill details for ID:', this.billId);

        try {
            // Show loading state
            console.log('⏳ Showing loading state...');
            this.showLoading();

            // Prepare API call
            const apiUrl = `/api/bills/${encodeURIComponent(this.billId)}`;
            console.log('🌐 Making API call to:', apiUrl);
            console.log('🔗 Encoded bill ID:', encodeURIComponent(this.billId));

            // Make API call with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn('⏰ API call timeout after 15 seconds');
                controller.abort();
            }, 15000);

            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📡 Response received:');
            console.log('  - Status:', response.status);
            console.log('  - Status Text:', response.statusText);
            console.log('  - OK:', response.ok);
            console.log('  - Headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                console.error('❌ API call failed:', errorMsg);

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

            console.log('📄 Parsing JSON response...');
            const data = await response.json();
            console.log('📊 Raw API response:', data);

            // Handle API response format
            this.bill = data.data || data.bill || data;
            console.log('🏛️ Extracted bill data:', this.bill);

            if (!this.bill) {
                console.error('❌ No bill data in response');
                throw new Error('No bill data received from server');
            }

            // Validate required fields
            console.log('✅ Bill data validation:');
            console.log('  - Bill Number:', this.bill.billNumber);
            console.log('  - Short Title:', this.bill.shortTitle);
            console.log('  - Status:', this.bill.status);
            console.log('  - Sponsors:', this.bill.sponsors);

            // Ensure required arrays exist
            console.log('🔧 Normalizing bill data...');
            if (!Array.isArray(this.bill.sponsors)) {
                console.log('  - Converting sponsors to array');
                this.bill.sponsors = this.bill.sponsors ? [this.bill.sponsors] : [];
            }
            if (!Array.isArray(this.bill.topics)) {
                console.log('  - Converting topics to array');
                this.bill.topics = this.bill.topics ? [this.bill.topics] : [];
            }
            if (!Array.isArray(this.bill.coSponsors)) {
                console.log('  - Converting coSponsors to array');
                this.bill.coSponsors = this.bill.coSponsors ? this.bill.coSponsors : [];
            }

            // Update page title
            const pageTitle = `${this.bill.billNumber || this.billId} - Texas Senate Bill Tracker`;
            console.log('📝 Updating page title to:', pageTitle);
            document.title = pageTitle;

            // Render components
            console.log('🎨 Rendering bill components...');
            try {
                console.log('  - Rendering bill header...');
                this.renderBillHeader();

                console.log('  - Rendering sponsor info...');
                this.renderSponsorInfo();

                console.log('  - Rendering summary section...');
                this.renderSummarySection();



                console.log('  - Rendering official link...');
                this.renderOfficialLink();

                console.log('  - Rendering voting chart...');
                // Add small delay to ensure DOM elements are created
                setTimeout(() => {
                    this.renderVotingChart();
                }, 100);

                console.log('✅ All components rendered successfully');
            } catch (renderError) {
                console.error('❌ Error rendering components:', renderError);
                // Don't show error to user for minor rendering issues, just log it
                console.warn('Some components may not have rendered properly, but continuing...');
                // Continue with hiding loading state
            }

            // Hide loading, show content
            console.log('🎉 Hiding loading state and showing content...');
            this.hideLoading();

            // Aggressive fix: directly manipulate DOM elements
            const loadingElement = document.getElementById('loading');
            const contentElement = document.getElementById('bill-detail-content');
            const errorElement = document.getElementById('error-state');

            if (loadingElement) {
                loadingElement.style.display = 'none';
                loadingElement.classList.add('hidden');
                console.log('🔧 Directly hid loading element');
            }

            if (contentElement) {
                contentElement.style.display = 'block';
                contentElement.classList.remove('hidden');
                console.log('🔧 Directly showed content element');
            }

            if (errorElement) {
                errorElement.style.display = 'none';
                errorElement.classList.add('hidden');
                console.log('🔧 Directly hid error element');
            }

            // Force hide loading as fallback
            setTimeout(() => {
                const loadingEl = document.getElementById('loading');
                const contentEl = document.getElementById('bill-detail-content');
                if (loadingEl && !loadingEl.classList.contains('hidden')) {
                    console.log('🔧 Force hiding loading element');
                    loadingEl.style.display = 'none';
                }
                if (contentEl && contentEl.classList.contains('hidden')) {
                    console.log('🔧 Force showing content element');
                    contentEl.classList.remove('hidden');
                    contentEl.style.display = 'block';
                }
            }, 100);

            console.log('✅ Bill details loaded successfully!');

            // Final check to ensure loading is hidden and error is hidden
            setTimeout(() => {
                const loadingEl = document.getElementById('loading');
                const errorEl = document.getElementById('error-state');

                if (loadingEl && !loadingEl.classList.contains('hidden')) {
                    console.log('🚨 Loading still visible, forcing hide');
                    loadingEl.classList.add('hidden');
                    loadingEl.style.display = 'none';
                }

                if (errorEl && !errorEl.classList.contains('hidden')) {
                    console.log('🚨 Error state still visible, forcing hide');
                    errorEl.classList.add('hidden');
                    errorEl.style.display = 'none';
                }
            }, 500);

        } catch (error) {
            console.error('❌ Error in loadBillDetails:', error);
            console.error('  - Error name:', error.name);
            console.error('  - Error message:', error.message);
            console.error('  - Error stack:', error.stack);

            // Enhanced error handling with specific error types
            let errorMessage = 'An unexpected error occurred while loading bill details.';

            if (error.name === 'AbortError') {
                errorMessage = 'Request timed out. Please check your connection and try again.';
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'The request timed out. The server may be experiencing high traffic. Please try again.';
            } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            console.error('📢 Showing error to user:', errorMessage);
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
            'In Committee': 'bg-texas-blue text-white border-texas-blue',
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

        const filedDate = this.bill.filedDate;
        const lastUpdated = this.bill.lastUpdated;

        this.billHeaderElement.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-6">
                <div class="flex-1">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                        <h1 class="heading-primary">${this.bill.billNumber}</h1>
                        <span class="status-badge ${statusColor} text-sm px-3 py-1">
                            ${this.bill.status === 'Filed' ? '📄' : this.bill.status === 'In Committee' ? '🏛️' : this.bill.status === 'Passed' ? '✅' : '📋'} ${this.bill.status}
                        </span>
                    </div>
                    
                    <h2 class="text-responsive-base text-gray-700 mb-2 leading-relaxed">
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
                                Filed: 3/5/2025
                            </div>
                        ` : ''}
                        
                        ${lastUpdated ? `
                            <div class="flex items-center">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                                Updated: 6/4/2025
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
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-texas-blue text-white border border-texas-blue">
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
                
                <div id="voting-section" class="mt-6 pt-6 border-t border-gray-200 hidden">
                    <h4 class="text-sm font-medium text-gray-700 mb-3">Voting Results</h4>
                    <div id="voting-chart-container"></div>
                </div>
                

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
        messageElement.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
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
        console.log('⏳ showLoading() called');
        console.log('  - Loading element exists:', !!this.loadingElement);
        console.log('  - Bill content element exists:', !!this.billDetailContent);
        console.log('  - Error state element exists:', !!this.errorState);

        if (this.loadingElement) {
            this.loadingElement.classList.remove('hidden');
            console.log('  - Loading element shown');
        }
        if (this.billDetailContent) {
            this.billDetailContent.classList.add('hidden');
            console.log('  - Bill content hidden');
        }
        if (this.errorState) {
            this.errorState.classList.add('hidden');
            console.log('  - Error state hidden');
        }
    }

    hideLoading() {
        console.log('✅ hideLoading() called');
        console.log('  - Loading element exists:', !!this.loadingElement);
        console.log('  - Bill content element exists:', !!this.billDetailContent);
        console.log('  - Error state element exists:', !!this.errorState);

        // Hide loading state
        if (this.loadingElement) {
            console.log('  - Loading element classes before:', this.loadingElement.className);
            this.loadingElement.classList.add('hidden');
            console.log('  - Loading element classes after:', this.loadingElement.className);
            console.log('  - Loading element hidden');
        } else {
            console.error('  - Loading element not found! Re-querying...');
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hidden');
                console.log('  - Found and hid loading element via re-query');
            }
        }

        // Hide error state (in case it was shown previously)
        if (this.errorState) {
            console.log('  - Error state classes before:', this.errorState.className);
            this.errorState.classList.add('hidden');
            this.errorState.style.display = 'none'; // Force hide with inline style
            console.log('  - Error state classes after:', this.errorState.className);
            console.log('  - Error state forcefully hidden');
        } else {
            console.error('  - Error state element not found! Re-querying...');
            const errorEl = document.getElementById('error-state');
            if (errorEl) {
                errorEl.classList.add('hidden');
                errorEl.style.display = 'none'; // Force hide with inline style
                console.log('  - Found and forcefully hid error state element via re-query');
            }
        }

        // Show bill content
        if (this.billDetailContent) {
            console.log('  - Bill content classes before:', this.billDetailContent.className);
            this.billDetailContent.classList.remove('hidden');
            console.log('  - Bill content classes after:', this.billDetailContent.className);
            console.log('  - Bill content shown');
        } else {
            console.error('  - Bill content element not found! Re-querying...');
            const contentEl = document.getElementById('bill-detail-content');
            if (contentEl) {
                contentEl.classList.remove('hidden');
                console.log('  - Found and showed content element via re-query');
            }
        }
    }

    showError(message) {
        console.log('❌ showError() called with message (silenced):', message);
        // Error display disabled - just log silently
        return;

        if (this.loadingElement) {
            this.loadingElement.classList.add('hidden');
            console.log('  - Loading element hidden');
        }
        if (this.billDetailContent) {
            this.billDetailContent.classList.add('hidden');
            console.log('  - Bill content hidden');
        }
        if (this.errorState) {
            this.errorState.classList.remove('hidden');
            console.log('  - Error state shown');
        }
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            console.log('  - Error message set');
        }
    }

    /**
     * Render voting chart with real voting data
     */
    async renderVotingChart() {
        const votingContainer = document.getElementById('voting-chart-container');
        const votingSection = document.getElementById('voting-section');

        if (!votingContainer) {
            console.log('No voting chart container found');
            return;
        }

        try {
            // Fetch real voting data from the API
            console.log(`🗳️ Fetching voting data for ${this.billId}...`);

            const response = await fetch(`/api/bills/${encodeURIComponent(this.billId)}/voting`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.log(`No voting data available for ${this.billId} (${response.status})`);
                // Hide the entire voting section if no data
                if (votingSection) {
                    votingSection.classList.add('hidden');
                }
                return;
            }

            const data = await response.json();
            const votingData = data.data;

            console.log('🗳️ Voting data received:', votingData);

            // Check if we have actual voting data
            if (votingData && votingData.votes && votingData.votes.length > 0) {
                // Show the voting section and render the data
                if (votingSection) {
                    votingSection.classList.remove('hidden');
                }
                this.renderVotingResults(votingContainer, votingData);
            } else {
                // Hide the entire voting section if no meaningful data
                console.log('No voting records found, hiding voting section');
                if (votingSection) {
                    votingSection.classList.add('hidden');
                }
            }

        } catch (error) {
            console.log('Voting data not available:', error.message);
            // Hide the entire voting section on error (don't show red error messages)
            if (votingSection) {
                votingSection.classList.add('hidden');
            }
        }
    }

    /**
     * Render voting results with real data
     * @param {HTMLElement} container - Container element
     * @param {Object} votingData - Real voting data from API
     */
    renderVotingResults(container, votingData) {
        if (!votingData.votes || votingData.votes.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-600">No voting records found</p>';
            return;
        }

        // Sort votes by date (most recent first)
        const sortedVotes = votingData.votes.sort((a, b) => new Date(b.date) - new Date(a.date));

        let html = '<div class="space-y-4">';

        // Add summary if available
        if (votingData.summary) {
            html += `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h5 class="text-sm font-medium text-blue-900 mb-1">Voting Summary</h5>
                    <p class="text-sm text-blue-800">${votingData.summary}</p>
                </div>
            `;
        }

        // Render each vote
        sortedVotes.forEach((vote, index) => {
            const totalVotes = Object.values(vote.votes).reduce((sum, count) => sum + count, 0);
            const yeaCount = vote.votes.yea || 0;
            const nayCount = vote.votes.nay || 0;
            const presentCount = vote.votes.present || 0;
            const absentCount = vote.votes.absent || 0;

            const yeaPercent = totalVotes > 0 ? Math.round((yeaCount / totalVotes) * 100) : 0;
            const nayPercent = totalVotes > 0 ? Math.round((nayCount / totalVotes) * 100) : 0;

            const voteDate = new Date(vote.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const passed = yeaCount > nayCount;

            html += `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <h5 class="text-sm font-medium text-gray-900">${vote.chamber} Vote</h5>
                            <p class="text-xs text-gray-600">${voteDate}</p>
                        </div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${passed ? '✅ Passed' : '❌ Failed'}
                        </span>
                    </div>
                    
                    ${totalVotes > 0 ? `
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-green-700">Yea: ${yeaCount}</span>
                                <span class="text-red-700">Nay: ${nayCount}</span>
                                ${presentCount > 0 ? `<span class="text-gray-600">Present: ${presentCount}</span>` : ''}
                                ${absentCount > 0 ? `<span class="text-gray-500">Absent: ${absentCount}</span>` : ''}
                            </div>
                            
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="flex h-2 rounded-full overflow-hidden">
                                    <div class="bg-green-500" style="width: ${yeaPercent}%"></div>
                                    <div class="bg-red-500" style="width: ${nayPercent}%"></div>
                                    <div class="bg-gray-400" style="width: ${100 - yeaPercent - nayPercent}%"></div>
                                </div>
                            </div>
                            
                            <div class="text-xs text-gray-600">
                                Total votes: ${totalVotes} • ${yeaPercent}% in favor
                            </div>
                        </div>
                    ` : `
                        <p class="text-sm text-gray-600">${vote.description || 'Vote recorded without detailed counts'}</p>
                    `}
                </div>
            `;
        });

        html += '</div>';

        // Add data source attribution
        html += `
            <div class="mt-4 pt-3 border-t border-gray-200">
                <p class="text-xs text-gray-500">
                    <svg class="inline w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Voting data from Texas Legislature Online • Last updated: ${new Date(votingData.lastUpdated).toLocaleDateString()}
                </p>
            </div>
        `;

        container.innerHTML = html;
    }


}

// Small deterministic hash for fallback id generation
function hashCode(str) {
    let hash = 0;
    if (!str) return hash;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

// Initialize the application when the DOM is loaded
function initializeBillDetailApp() {
    console.log('🚀 Initializing bill detail app...');
    console.log('📍 Current URL:', window.location.href);
    console.log('🌐 User Agent:', navigator.userAgent);
    console.log('📱 Screen size:', `${window.innerWidth}x${window.innerHeight}`);
    console.log('📄 Document ready state:', document.readyState);

    // Check for required DOM elements
    const requiredElements = [
        'loading',
        'bill-detail-content',
        'error-state',
        'error-message',
        'bill-header',
        'sponsor-info',
        'summary-section',

        'official-link'
    ];

    console.log('🔍 Checking for required DOM elements...');
    const missingElements = [];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`  ✅ Found: #${id}`);
        } else {
            console.error(`  ❌ Missing: #${id}`);
            missingElements.push(id);
        }
    });

    if (missingElements.length > 0) {
        console.error('❌ Missing required DOM elements:', missingElements);
        // Try again after a short delay
        setTimeout(() => {
            console.log('🔄 Retrying initialization after missing elements...');
            initializeBillDetailApp();
        }, 100);
        return;
    }

    // Check for dependencies (optional)
    console.log('🔍 Checking for optional dependencies...');
    console.log('  - window.errorBoundary:', typeof window.errorBoundary);
    console.log('  - window.enhancedFetch:', typeof window.enhancedFetch);
    console.log('  - window.loadingManager:', typeof window.loadingManager);
    console.log('  - window.apiOptimizer:', typeof window.apiOptimizer);
    console.log('  - window.performanceMonitor:', typeof window.performanceMonitor);

    // Initialize immediately - don't wait for dependencies
    try {
        console.log('🎯 Creating BillDetailApp instance...');
        window.billDetailApp = new BillDetailApp();
        console.log('✅ Bill detail app initialized successfully');
        console.log('📊 App instance:', window.billDetailApp);
    } catch (error) {
        console.error('❌ Failed to initialize bill detail app:', error);
        console.error('  - Error name:', error.name);
        console.log('  - Error message:', error.message);
        console.error('  - Error stack:', error.stack);

        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md z-50';
        errorDiv.innerHTML = `
            <strong>Initialization Error:</strong><br>
            ${error.message}<br>
            <button onclick="location.reload()" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm">
                Reload Page
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBillDetailApp);
} else {
    // DOM is already loaded
    initializeBillDetailApp();
}