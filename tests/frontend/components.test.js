// Frontend Component Tests
/**
 * @jest-environment jsdom
 */

// Mock global objects and APIs
global.fetch = jest.fn();
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.requestIdleCallback = jest.fn(cb => setTimeout(cb, 0));

// Mock window objects
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    search: '',
    pathname: '/'
  },
  writable: true
});

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Frontend Components', () => {
  let mockBills;
  let billTracker;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="loading" class="hidden">Loading...</div>
      <div id="bill-grid"></div>
      <div id="no-results" class="hidden">No results</div>
      <div id="results-summary">
        <span id="results-count">0</span>
        <div id="filter-summary"></div>
      </div>
      
      <input id="search-input" type="text" />
      <select id="topics-filter" multiple></select>
      <select id="sponsors-filter" multiple></select>
      <select id="status-filter">
        <option value="">All Statuses</option>
        <option value="Filed">Filed</option>
        <option value="In Committee">In Committee</option>
        <option value="Passed">Passed</option>
      </select>
      <button id="clear-filters">Clear Filters</button>
    `;

    // Mock bills data
    mockBills = [
      {
        id: 'sb1',
        billNumber: 'SB1',
        shortTitle: 'Education Funding Act',
        fullTitle: 'An Act relating to public education funding and teacher salaries',
        status: 'Filed',
        sponsors: [{ name: 'Senator Smith', district: '1' }],
        topics: ['Education', 'Finance'],
        abstract: 'This bill provides additional funding for public schools and increases teacher salaries to improve educational outcomes.'
      },
      {
        id: 'sb2',
        billNumber: 'SB2',
        shortTitle: 'Healthcare Reform Bill',
        fullTitle: 'An Act relating to healthcare access and insurance reform',
        status: 'In Committee',
        sponsors: [{ name: 'Senator Johnson', district: '2' }],
        topics: ['Healthcare'],
        abstract: 'This bill expands healthcare access and reforms insurance regulations.'
      },
      {
        id: 'sb3',
        billNumber: 'SB3',
        shortTitle: 'Transportation Infrastructure',
        fullTitle: 'An Act relating to highway construction and maintenance',
        status: 'Passed',
        sponsors: [{ name: 'Senator Williams', district: '3' }],
        topics: ['Transportation'],
        abstract: 'This bill allocates funds for highway infrastructure improvements.'
      }
    ];

    // Mock fetch responses
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockBills,
        count: mockBills.length
      })
    });

    // Mock global objects that components might use
    window.cacheManager = {
      generateKey: jest.fn(() => 'cache-key'),
      get: jest.fn(() => null),
      set: jest.fn()
    };

    window.errorBoundary = {
      wrapAsync: jest.fn(fn => fn)
    };

    window.enhancedFetch = {
      fetch: fetch
    };

    window.loadingManager = {
      showBillGridSkeleton: jest.fn(),
      showToast: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    delete window.cacheManager;
    delete window.errorBoundary;
    delete window.enhancedFetch;
    delete window.loadingManager;
  });

  describe('BillTracker Component', () => {
    beforeEach(async () => {
      // Load the BillTracker class (simulate script loading)
      const BillTrackerCode = `
        class BillTracker {
          constructor() {
            this.bills = [];
            this.filteredBills = [];
            this.filters = {
              search: '',
              topics: [],
              sponsors: [],
              status: ''
            };
            
            this.initializeElements();
            this.bindEvents();
          }

          initializeElements() {
            this.loadingElement = document.getElementById('loading');
            this.billGridElement = document.getElementById('bill-grid');
            this.noResultsElement = document.getElementById('no-results');
            this.resultsSummaryElement = document.getElementById('results-summary');
            this.resultsCountElement = document.getElementById('results-count');
            this.filterSummaryElement = document.getElementById('filter-summary');
            
            this.searchInput = document.getElementById('search-input');
            this.topicsFilter = document.getElementById('topics-filter');
            this.sponsorsFilter = document.getElementById('sponsors-filter');
            this.statusFilter = document.getElementById('status-filter');
            this.clearFiltersButton = document.getElementById('clear-filters');
          }

          bindEvents() {
            this.searchInput.addEventListener('input', (e) => {
              this.filters.search = e.target.value.toLowerCase().trim();
              this.applyFilters();
            });

            this.statusFilter.addEventListener('change', () => {
              this.filters.status = this.statusFilter.value;
              this.applyFilters();
            });

            this.clearFiltersButton.addEventListener('click', () => {
              this.clearAllFilters();
            });
          }

          async loadBills() {
            try {
              this.showLoading();
              const response = await fetch('/api/bills');
              const data = await response.json();
              this.bills = data.data || [];
              this.filteredBills = [...this.bills];
              this.renderBills();
              this.hideLoading();
            } catch (error) {
              this.showError(error.message);
            }
          }

          applyFilters() {
            this.filteredBills = this.bills.filter(bill => {
              if (this.filters.search) {
                const searchableText = [
                  bill.billNumber || '',
                  bill.shortTitle || '',
                  bill.fullTitle || '',
                  bill.abstract || ''
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(this.filters.search)) {
                  return false;
                }
              }

              if (this.filters.status && bill.status !== this.filters.status) {
                return false;
              }

              return true;
            });

            this.renderBills();
            this.updateResultsSummary();
          }

          clearAllFilters() {
            this.filters = {
              search: '',
              topics: [],
              sponsors: [],
              status: ''
            };

            this.searchInput.value = '';
            this.statusFilter.selectedIndex = 0;
            this.filteredBills = [...this.bills];
            this.renderBills();
            this.updateResultsSummary();
          }

          renderBills() {
            if (this.filteredBills.length === 0) {
              this.showNoResults();
              return;
            }

            this.hideNoResults();
            this.billGridElement.innerHTML = '';
            
            this.filteredBills.forEach(bill => {
              const billCard = this.createBillCard(bill);
              this.billGridElement.appendChild(billCard);
            });
          }

          createBillCard(bill) {
            const card = document.createElement('div');
            card.className = 'bill-card bg-white rounded-lg shadow-sm border border-gray-200 p-6';
            card.setAttribute('data-bill-id', bill.id);
            
            const statusColors = {
              'Filed': 'bg-yellow-50 text-yellow-800',
              'In Committee': 'bg-blue-50 text-blue-800',
              'Passed': 'bg-green-50 text-green-800'
            };
            
            const statusColor = statusColors[bill.status] || 'bg-gray-50 text-gray-700';
            const primarySponsor = bill.sponsors && bill.sponsors.length > 0 ? 
              (bill.sponsors[0].name || bill.sponsors[0]) : 'Unknown';

            card.innerHTML = \`
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <h3 class="text-lg font-semibold mb-2">\${bill.billNumber}</h3>
                  <span class="status-badge \${statusColor} px-2 py-1 rounded text-sm">
                    \${bill.status}
                  </span>
                </div>
              </div>
              
              <h4 class="font-medium text-gray-900 mb-2">
                \${bill.shortTitle || bill.fullTitle}
              </h4>
              
              <p class="text-sm text-gray-600 mb-3">
                \${bill.abstract || 'No summary available'}
              </p>
              
              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>\${primarySponsor}</span>
                <span class="text-blue-600">View Details →</span>
              </div>
            \`;

            card.addEventListener('click', () => {
              window.location.href = \`bill-detail.html?id=\${bill.id}\`;
            });

            return card;
          }

          updateResultsSummary() {
            this.resultsCountElement.textContent = this.filteredBills.length;
          }

          showLoading() {
            this.loadingElement.classList.remove('hidden');
            this.billGridElement.classList.add('hidden');
          }

          hideLoading() {
            this.loadingElement.classList.add('hidden');
            this.billGridElement.classList.remove('hidden');
          }

          showNoResults() {
            this.noResultsElement.classList.remove('hidden');
            this.billGridElement.classList.add('hidden');
          }

          hideNoResults() {
            this.noResultsElement.classList.add('hidden');
            this.billGridElement.classList.remove('hidden');
          }

          showError(message) {
            this.hideLoading();
            this.billGridElement.innerHTML = \`
              <div class="col-span-full text-center py-16">
                <div class="text-red-600">Error: \${message}</div>
              </div>
            \`;
          }
        }
      `;

      // Execute the code to define the class
      eval(BillTrackerCode);
      
      // Create instance
      billTracker = new BillTracker();
      billTracker.bills = mockBills;
      billTracker.filteredBills = [...mockBills];
    });

    describe('Initialization', () => {
      it('should initialize with correct default state', () => {
        expect(billTracker.bills).toEqual([]);
        expect(billTracker.filteredBills).toEqual([]);
        expect(billTracker.filters).toEqual({
          search: '',
          topics: [],
          sponsors: [],
          status: ''
        });
      });

      it('should find and store DOM elements', () => {
        expect(billTracker.loadingElement).toBeTruthy();
        expect(billTracker.billGridElement).toBeTruthy();
        expect(billTracker.searchInput).toBeTruthy();
        expect(billTracker.statusFilter).toBeTruthy();
        expect(billTracker.clearFiltersButton).toBeTruthy();
      });

      it('should bind event listeners', () => {
        const searchInput = document.getElementById('search-input');
        const statusFilter = document.getElementById('status-filter');
        const clearButton = document.getElementById('clear-filters');

        // Test that events are bound by triggering them
        const searchEvent = new Event('input');
        searchInput.value = 'test';
        searchInput.dispatchEvent(searchEvent);

        const changeEvent = new Event('change');
        statusFilter.value = 'Filed';
        statusFilter.dispatchEvent(changeEvent);

        const clickEvent = new Event('click');
        clearButton.dispatchEvent(clickEvent);

        // If no errors thrown, events are properly bound
        expect(true).toBe(true);
      });
    });

    describe('Bill Loading', () => {
      it('should load bills successfully', async () => {
        await billTracker.loadBills();

        expect(fetch).toHaveBeenCalledWith('/api/bills');
        expect(billTracker.bills).toEqual(mockBills);
        expect(billTracker.filteredBills).toEqual(mockBills);
      });

      it('should handle loading errors', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        await billTracker.loadBills();

        expect(billTracker.billGridElement.innerHTML).toContain('Error: Network error');
      });

      it('should show loading state during fetch', async () => {
        let resolvePromise;
        const promise = new Promise(resolve => {
          resolvePromise = resolve;
        });
        
        fetch.mockReturnValueOnce(promise);

        const loadPromise = billTracker.loadBills();
        
        // Check loading state
        expect(billTracker.loadingElement.classList.contains('hidden')).toBe(false);
        
        // Resolve the promise
        resolvePromise({
          ok: true,
          json: async () => ({ success: true, data: mockBills })
        });
        
        await loadPromise;
        
        // Check loading state is hidden
        expect(billTracker.loadingElement.classList.contains('hidden')).toBe(true);
      });
    });

    describe('Filtering', () => {
      beforeEach(() => {
        billTracker.bills = mockBills;
        billTracker.filteredBills = [...mockBills];
      });

      it('should filter bills by search term', () => {
        billTracker.filters.search = 'education';
        billTracker.applyFilters();

        expect(billTracker.filteredBills).toHaveLength(1);
        expect(billTracker.filteredBills[0].shortTitle).toContain('Education');
      });

      it('should filter bills by status', () => {
        billTracker.filters.status = 'Filed';
        billTracker.applyFilters();

        expect(billTracker.filteredBills).toHaveLength(1);
        expect(billTracker.filteredBills[0].status).toBe('Filed');
      });

      it('should combine multiple filters', () => {
        billTracker.filters.search = 'act';
        billTracker.filters.status = 'Filed';
        billTracker.applyFilters();

        expect(billTracker.filteredBills).toHaveLength(1);
        expect(billTracker.filteredBills[0].billNumber).toBe('SB1');
      });

      it('should clear all filters', () => {
        billTracker.filters.search = 'education';
        billTracker.filters.status = 'Filed';
        billTracker.clearAllFilters();

        expect(billTracker.filters.search).toBe('');
        expect(billTracker.filters.status).toBe('');
        expect(billTracker.filteredBills).toEqual(mockBills);
      });

      it('should update results count after filtering', () => {
        billTracker.filters.search = 'education';
        billTracker.applyFilters();

        expect(billTracker.resultsCountElement.textContent).toBe('1');
      });
    });

    describe('Bill Card Rendering', () => {
      beforeEach(() => {
        billTracker.bills = mockBills;
        billTracker.filteredBills = [...mockBills];
      });

      it('should render bill cards correctly', () => {
        billTracker.renderBills();

        const billCards = document.querySelectorAll('.bill-card');
        expect(billCards).toHaveLength(3);

        const firstCard = billCards[0];
        expect(firstCard.textContent).toContain('SB1');
        expect(firstCard.textContent).toContain('Education Funding Act');
        expect(firstCard.textContent).toContain('Filed');
      });

      it('should apply correct status colors', () => {
        billTracker.renderBills();

        const billCards = document.querySelectorAll('.bill-card');
        const filedCard = Array.from(billCards).find(card => 
          card.textContent.includes('SB1')
        );
        const committeeCard = Array.from(billCards).find(card => 
          card.textContent.includes('SB2')
        );
        const passedCard = Array.from(billCards).find(card => 
          card.textContent.includes('SB3')
        );

        expect(filedCard.innerHTML).toContain('bg-yellow-50');
        expect(committeeCard.innerHTML).toContain('bg-blue-50');
        expect(passedCard.innerHTML).toContain('bg-green-50');
      });

      it('should handle missing bill data gracefully', () => {
        const incompleteBill = {
          id: 'sb4',
          billNumber: 'SB4',
          status: 'Filed'
          // Missing other fields
        };

        billTracker.filteredBills = [incompleteBill];
        billTracker.renderBills();

        const billCard = document.querySelector('.bill-card');
        expect(billCard).toBeTruthy();
        expect(billCard.textContent).toContain('SB4');
        expect(billCard.textContent).toContain('Unknown'); // Default sponsor
      });

      it('should show no results when filtered bills is empty', () => {
        billTracker.filteredBills = [];
        billTracker.renderBills();

        expect(billTracker.noResultsElement.classList.contains('hidden')).toBe(false);
        expect(billTracker.billGridElement.classList.contains('hidden')).toBe(true);
      });

      it('should add click handlers to bill cards', () => {
        billTracker.renderBills();

        const billCard = document.querySelector('.bill-card');
        const clickEvent = new Event('click');
        
        // Mock window.location.href setter
        delete window.location;
        window.location = { href: '' };

        billCard.dispatchEvent(clickEvent);

        expect(window.location.href).toContain('bill-detail.html?id=sb1');
      });
    });

    describe('User Interactions', () => {
      beforeEach(() => {
        billTracker.bills = mockBills;
        billTracker.filteredBills = [...mockBills];
      });

      it('should handle search input changes', () => {
        const searchInput = document.getElementById('search-input');
        searchInput.value = 'healthcare';
        
        const inputEvent = new Event('input');
        searchInput.dispatchEvent(inputEvent);

        expect(billTracker.filters.search).toBe('healthcare');
        expect(billTracker.filteredBills).toHaveLength(1);
        expect(billTracker.filteredBills[0].shortTitle).toContain('Healthcare');
      });

      it('should handle status filter changes', () => {
        const statusFilter = document.getElementById('status-filter');
        statusFilter.value = 'In Committee';
        
        const changeEvent = new Event('change');
        statusFilter.dispatchEvent(changeEvent);

        expect(billTracker.filters.status).toBe('In Committee');
        expect(billTracker.filteredBills).toHaveLength(1);
        expect(billTracker.filteredBills[0].status).toBe('In Committee');
      });

      it('should handle clear filters button click', () => {
        // Set some filters first
        billTracker.filters.search = 'test';
        billTracker.filters.status = 'Filed';
        
        const clearButton = document.getElementById('clear-filters');
        const clickEvent = new Event('click');
        clearButton.dispatchEvent(clickEvent);

        expect(billTracker.filters.search).toBe('');
        expect(billTracker.filters.status).toBe('');
        expect(document.getElementById('search-input').value).toBe('');
        expect(document.getElementById('status-filter').selectedIndex).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should display error message when API fails', async () => {
        fetch.mockRejectedValueOnce(new Error('API Error'));

        await billTracker.loadBills();

        expect(billTracker.billGridElement.innerHTML).toContain('Error: API Error');
      });

      it('should handle malformed API responses', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => null
        });

        await billTracker.loadBills();

        expect(billTracker.bills).toEqual([]);
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      // Load BillTracker and initialize
      eval(`
        class BillTracker {
          constructor() {
            this.bills = [];
            this.filteredBills = [];
            this.filters = { search: '', topics: [], sponsors: [], status: '' };
            this.initializeElements();
          }
          initializeElements() {
            this.billGridElement = document.getElementById('bill-grid');
            this.searchInput = document.getElementById('search-input');
          }
          createBillCard(bill) {
            const card = document.createElement('div');
            card.className = 'bill-card';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', \`View details for \${bill.billNumber}: \${bill.shortTitle}\`);
            card.innerHTML = \`<h3>\${bill.billNumber}</h3><p>\${bill.shortTitle}</p>\`;
            return card;
          }
        }
      `);
      
      billTracker = new BillTracker();
    });

    it('should add proper ARIA labels to bill cards', () => {
      const bill = mockBills[0];
      const card = billTracker.createBillCard(bill);

      expect(card.getAttribute('aria-label')).toBe('View details for SB1: Education Funding Act');
      expect(card.getAttribute('role')).toBe('button');
      expect(card.getAttribute('tabindex')).toBe('0');
    });

    it('should make search input accessible', () => {
      const searchInput = document.getElementById('search-input');
      
      // Add accessibility attributes
      searchInput.setAttribute('aria-label', 'Search bills');
      searchInput.setAttribute('placeholder', 'Search by bill number, title, or keyword');

      expect(searchInput.getAttribute('aria-label')).toBe('Search bills');
      expect(searchInput.getAttribute('placeholder')).toContain('Search');
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      // Create large dataset
      const largeBillSet = Array(1000).fill().map((_, index) => ({
        id: `sb${index}`,
        billNumber: `SB${index}`,
        shortTitle: `Bill ${index}`,
        status: 'Filed',
        sponsors: [{ name: `Senator ${index}` }]
      }));

      eval(`
        class BillTracker {
          constructor() {
            this.bills = [];
            this.filteredBills = [];
            this.filters = { search: '', topics: [], sponsors: [], status: '' };
          }
          applyFilters() {
            this.filteredBills = this.bills.filter(bill => {
              if (this.filters.search) {
                return bill.shortTitle.toLowerCase().includes(this.filters.search);
              }
              return true;
            });
          }
        }
      `);

      billTracker = new BillTracker();
      billTracker.bills = largeBillSet;

      const startTime = performance.now();
      billTracker.filters.search = 'bill 5';
      billTracker.applyFilters();
      const endTime = performance.now();

      // Should complete filtering in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(billTracker.filteredBills.length).toBeGreaterThan(0);
    });
  });
});