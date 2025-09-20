// Simple Bill Detail Page - No complex dependencies
class SimpleBillDetailApp {
    constructor() {
        console.log('Initializing simple bill detail app...');
        
        this.billId = null;
        this.bill = null;
        
        // Get DOM elements
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
        
        // Extract bill ID and load
        this.extractBillId();
        this.loadBillDetails();
    }

    extractBillId() {
        const urlParams = new URLSearchParams(window.location.search);
        this.billId = urlParams.get('id');
        
        console.log('Extracted bill ID:', this.billId);
        
        if (!this.billId) {
            console.error('No bill ID provided in URL');
            this.showError('No bill ID provided in URL');
            return;
        }
    }

    async loadBillDetails() {
        if (!this.billId) {
            return;
        }

        console.log('Loading bill details for ID:', this.billId);

        try {
            // Show loading
            this.showLoading();

            // Make API call
            const apiUrl = `/api/bills/${encodeURIComponent(this.billId)}`;
            console.log('Making API call to:', apiUrl);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Extract bill data
            this.bill = data.data || data.bill || data;

            if (!this.bill) {
                throw new Error('No bill data received');
            }

            console.log('Bill data:', this.bill);

            // Ensure arrays exist
            this.bill.sponsors = this.bill.sponsors || [];
            this.bill.topics = this.bill.topics || [];
            this.bill.coSponsors = this.bill.coSponsors || [];

            // Update page title
            document.title = `${this.bill.billNumber || this.billId} - Texas Senate Bill Tracker`;

            // Render components
            this.renderBillHeader();
            this.renderSponsorInfo();
            this.renderSummarySection();
            this.renderNewsSection();
            this.renderOfficialLink();

            // Hide loading, show content
            this.hideLoading();
            
            console.log('✅ Bill details loaded successfully');

        } catch (error) {
            console.error('❌ Error loading bill:', error);
            this.showError(`Failed to load bill: ${error.message}`);
        }
    }

    renderBillHeader() {
        console.log('Rendering bill header...');
        
        const statusColors = {
            'Filed': 'bg-yellow-50 text-yellow-700 border-yellow-400',
            'In Committee': 'bg-blue-50 text-blue-700 border-blue-400',
            'Passed': 'bg-green-50 text-green-700 border-green-400'
        };
        
        const statusColor = statusColors[this.bill.status] || 'bg-gray-50 text-gray-700 border-gray-300';
        
        this.billHeaderElement.innerHTML = `
            <div class="mb-6">
                <div class="flex items-center gap-4 mb-4">
                    <h1 class="text-2xl font-bold text-gray-900">${this.bill.billNumber}</h1>
                    <span class="px-3 py-1 rounded-full text-sm font-medium border ${statusColor}">
                        ${this.bill.status}
                    </span>
                </div>
                
                <h2 class="text-lg text-gray-700 mb-4">
                    ${this.bill.shortTitle || this.bill.fullTitle}
                </h2>
                
                ${this.bill.topics && this.bill.topics.length > 0 ? `
                    <div class="flex flex-wrap gap-2">
                        ${this.bill.topics.map(topic => `
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                ${topic}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderSponsorInfo() {
        console.log('Rendering sponsor info...');
        
        const sponsors = this.bill.sponsors || [];
        const primarySponsor = sponsors[0];
        
        if (!primarySponsor) {
            this.sponsorInfoElement.innerHTML = `
                <div class="text-center py-8">
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Sponsor Information</h3>
                    <p class="text-gray-500">No sponsor information available</p>
                </div>
            `;
            return;
        }

        const sponsorName = typeof primarySponsor === 'object' ? primarySponsor.name : primarySponsor;
        const sponsorDistrict = typeof primarySponsor === 'object' ? primarySponsor.district : null;

        this.sponsorInfoElement.innerHTML = `
            <div class="text-center">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Sponsor Information</h3>
                
                <div class="mb-4">
                    <h4 class="text-lg font-semibold text-gray-900">${sponsorName}</h4>
                    <p class="text-sm text-gray-600">Primary Sponsor</p>
                    ${sponsorDistrict ? `<p class="text-sm text-gray-500">District ${sponsorDistrict}</p>` : ''}
                </div>
                
                ${sponsors.length > 1 ? `
                    <div class="border-t pt-4">
                        <h5 class="text-sm font-medium text-gray-700 mb-2">Co-Sponsors</h5>
                        <div class="text-sm text-gray-600">
                            ${sponsors.slice(1).map(sponsor => 
                                typeof sponsor === 'object' ? sponsor.name : sponsor
                            ).join(', ')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderSummarySection() {
        console.log('Rendering summary section...');
        
        this.summarySectionElement.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Bill Summary</h3>
                
                ${this.bill.abstract ? `
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-700 mb-2">Abstract</h4>
                        <p class="text-sm text-gray-600 leading-relaxed">${this.bill.abstract}</p>
                    </div>
                ` : ''}
                
                ${this.bill.fullTitle ? `
                    <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-2">Full Title</h4>
                        <p class="text-sm text-gray-600 leading-relaxed">${this.bill.fullTitle}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderNewsSection() {
        console.log('Rendering news section...');
        
        this.newsSectionElement.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Related News</h3>
                <div class="text-center py-8 text-gray-500">
                    <p>News articles will be loaded here</p>
                    <p class="text-sm mt-2">(Feature coming soon)</p>
                </div>
            </div>
        `;
    }

    renderOfficialLink() {
        console.log('Rendering official link...');
        
        const officialUrl = this.bill.officialUrl || 
            `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=${this.bill.billNumber?.replace(/\s+/g, '')}`;
        
        this.officialLinkElement.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Official Information</h3>
                <a href="${officialUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    View on Texas Legislature Website
                    <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </a>
            </div>
        `;
    }

    showLoading() {
        console.log('Showing loading state');
        this.loadingElement?.classList.remove('hidden');
        this.billDetailContent?.classList.add('hidden');
        this.errorState?.classList.add('hidden');
    }

    hideLoading() {
        console.log('Hiding loading state');
        this.loadingElement?.classList.add('hidden');
        this.billDetailContent?.classList.remove('hidden');
        this.errorState?.classList.add('hidden');
    }

    showError(message) {
        console.log('Showing error:', message);
        this.loadingElement?.classList.add('hidden');
        this.billDetailContent?.classList.add('hidden');
        this.errorState?.classList.remove('hidden');
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
        }
    }
}

// Initialize immediately when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing simple bill detail app...');
    window.simpleBillDetailApp = new SimpleBillDetailApp();
});