const { TexasLegislatureScraper } = require('../../services/scraper');

describe('TexasLegislatureScraper - Core Functionality', () => {
  let scraper;

  beforeEach(() => {
    scraper = new TexasLegislatureScraper();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(scraper.baseUrl).toBe('https://capitol.texas.gov');
      expect(scraper.billsListUrl).toBe('https://capitol.texas.gov/BillLookup/BillNumber.aspx');
      expect(scraper.axiosConfig.timeout).toBe(30000);
      expect(scraper.axiosConfig.headers['User-Agent']).toContain('Mozilla');
    });
  });

  describe('extractShortTitle', () => {
    it('should extract short title from full title', () => {
      const fullTitle = 'Relating to public education funding and teacher salaries. This is a longer description.';
      const shortTitle = scraper.extractShortTitle(fullTitle);
      expect(shortTitle).toBe('Relating to public education funding and teacher salaries');
    });

    it('should truncate long titles without periods', () => {
      const longTitle = 'A' + 'very '.repeat(20) + 'long title without periods that exceeds the character limit';
      const shortTitle = scraper.extractShortTitle(longTitle);
      expect(shortTitle.length).toBeLessThanOrEqual(100);
      expect(shortTitle).toMatch(/\.\.\.$/);
    });

    it('should handle empty titles', () => {
      expect(scraper.extractShortTitle('')).toBe('');
      expect(scraper.extractShortTitle(null)).toBe('');
      expect(scraper.extractShortTitle(undefined)).toBe('');
    });

    it('should handle short titles', () => {
      const shortTitle = 'Short title';
      expect(scraper.extractShortTitle(shortTitle)).toBe(shortTitle);
    });
  });

  describe('normalizeStatus', () => {
    it('should normalize Filed status variations', () => {
      expect(scraper.normalizeStatus('Filed')).toBe('Filed');
      expect(scraper.normalizeStatus('Introduced')).toBe('Filed');
      expect(scraper.normalizeStatus('filed')).toBe('Filed');
      expect(scraper.normalizeStatus('INTRODUCED')).toBe('Filed');
    });

    it('should normalize Committee status variations', () => {
      expect(scraper.normalizeStatus('Referred to Committee')).toBe('In Committee');
      expect(scraper.normalizeStatus('In Committee - Education')).toBe('In Committee');
      expect(scraper.normalizeStatus('committee review')).toBe('In Committee');
      expect(scraper.normalizeStatus('REFERRED TO COMMITTEE')).toBe('In Committee');
    });

    it('should normalize Passed status variations', () => {
      expect(scraper.normalizeStatus('Passed')).toBe('Passed');
      expect(scraper.normalizeStatus('Enacted')).toBe('Passed');
      expect(scraper.normalizeStatus('passed')).toBe('Passed');
      expect(scraper.normalizeStatus('ENACTED')).toBe('Passed');
    });

    it('should default to Filed for unknown statuses', () => {
      expect(scraper.normalizeStatus('Unknown Status')).toBe('Filed');
      expect(scraper.normalizeStatus('')).toBe('Filed');
      expect(scraper.normalizeStatus(null)).toBe('Filed');
      expect(scraper.normalizeStatus(undefined)).toBe('Filed');
    });
  });

  describe('validateBillData', () => {
    it('should validate complete bill data', () => {
      const validBill = {
        billNumber: 'SB1',
        fullTitle: 'Relating to education',
        status: 'Filed',
        sponsors: []
      };
      expect(scraper.validateBillData(validBill)).toBe(true);
    });

    it('should reject bill data missing required fields', () => {
      const invalidBill = {
        billNumber: '',
        fullTitle: 'Relating to education',
        status: 'Filed'
      };
      expect(scraper.validateBillData(invalidBill)).toBe(false);
    });

    it('should reject bill data with missing title', () => {
      const invalidBill = {
        billNumber: 'SB1',
        fullTitle: '',
        status: 'Filed'
      };
      expect(scraper.validateBillData(invalidBill)).toBe(false);
    });

    it('should reject bill data with missing status', () => {
      const invalidBill = {
        billNumber: 'SB1',
        fullTitle: 'Valid title',
        status: ''
      };
      expect(scraper.validateBillData(invalidBill)).toBe(false);
    });

    it('should reject invalid bill number formats', () => {
      const invalidFormats = ['INVALID123', 'HB1', 'AB123', '123', 'SB', ''];
      invalidFormats.forEach(billNumber => {
        const bill = {
          billNumber,
          fullTitle: 'Test title',
          status: 'Filed'
        };
        expect(scraper.validateBillData(bill)).toBe(false);
      });
    });

    it('should accept various valid bill number formats', () => {
      const validFormats = ['SB1', 'SB 1', 'sb1', 'SB123', 'sb 456'];
      validFormats.forEach(billNumber => {
        const bill = {
          billNumber,
          fullTitle: 'Test title',
          status: 'Filed'
        };
        expect(scraper.validateBillData(bill)).toBe(true);
      });
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await scraper.delay(50);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await scraper.delay(0);
      const end = Date.now();
      expect(end - start).toBeLessThan(10); // Should be very fast
    });
  });

  describe('URL construction', () => {
    it('should have correct base URLs', () => {
      expect(scraper.baseUrl).toBe('https://capitol.texas.gov');
      expect(scraper.billsListUrl).toBe('https://capitol.texas.gov/BillLookup/BillNumber.aspx');
    });

    it('should construct full URLs correctly', () => {
      const relativePath = '/BillLookup/History.aspx?LegSess=88R&Bill=SB1';
      const fullUrl = `${scraper.baseUrl}${relativePath}`;
      expect(fullUrl).toBe('https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1');
    });
  });

  describe('axios configuration', () => {
    it('should have proper timeout configuration', () => {
      expect(scraper.axiosConfig.timeout).toBe(30000);
    });

    it('should have proper user agent', () => {
      expect(scraper.axiosConfig.headers['User-Agent']).toContain('Mozilla');
      expect(scraper.axiosConfig.headers['User-Agent']).toContain('Chrome');
    });
  });
});