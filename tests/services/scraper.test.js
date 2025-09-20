const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock cheerio to avoid import issues in test environment
const mockCheerio = {
  load: jest.fn()
};

jest.mock('cheerio', () => mockCheerio);

const TexasLegislatureScraper = require('../../services/scraper');

describe('TexasLegislatureScraper', () => {
  let scraper;

  beforeEach(() => {
    scraper = new TexasLegislatureScraper();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct base URLs and config', () => {
      expect(scraper.baseUrl).toBe('https://capitol.texas.gov');
      expect(scraper.billsListUrl).toBe('https://capitol.texas.gov/BillLookup/BillNumber.aspx');
      expect(scraper.axiosConfig.timeout).toBe(30000);
      expect(scraper.axiosConfig.headers['User-Agent']).toContain('Mozilla');
    });
  });

  describe('scrapeBills', () => {
    it('should scrape Senate bills from TLO successfully', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr>
                <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB1">SB1</a></td>
                <td>Relating to public education funding</td>
                <td>Smith, John</td>
                <td>Filed</td>
              </tr>
              <tr>
                <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB2">SB2</a></td>
                <td>Relating to healthcare reform and patient rights</td>
                <td>Johnson, Mary</td>
                <td>In Committee</td>
              </tr>
              <tr>
                <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=HB1">HB1</a></td>
                <td>House bill - should be ignored</td>
                <td>Brown, Bob</td>
                <td>Filed</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      // Mock cheerio's behavior
      const mockElement = {
        find: jest.fn().mockReturnThis(),
        text: jest.fn(),
        attr: jest.fn()
      };

      const mockRow1 = {
        find: jest.fn((selector) => {
          if (selector === 'td:first-child a') {
            return { text: () => 'SB1', attr: () => '/BillLookup/History.aspx?LegSess=88R&Bill=SB1' };
          } else if (selector === 'td:nth-child(2)') {
            return { text: () => 'Relating to public education funding' };
          } else if (selector === 'td:nth-child(3)') {
            return { text: () => 'Smith, John' };
          } else if (selector === 'td:nth-child(4)') {
            return { text: () => 'Filed' };
          }
          return { text: () => '', attr: () => '' };
        })
      };

      const mockRow2 = {
        find: jest.fn((selector) => {
          if (selector === 'td:first-child a') {
            return { text: () => 'SB2', attr: () => '/BillLookup/History.aspx?LegSess=88R&Bill=SB2' };
          } else if (selector === 'td:nth-child(2)') {
            return { text: () => 'Relating to healthcare reform and patient rights' };
          } else if (selector === 'td:nth-child(3)') {
            return { text: () => 'Johnson, Mary' };
          } else if (selector === 'td:nth-child(4)') {
            return { text: () => 'In Committee' };
          }
          return { text: () => '', attr: () => '' };
        })
      };

      const mockRow3 = {
        find: jest.fn((selector) => {
          if (selector === 'td:first-child a') {
            return { text: () => 'HB1', attr: () => '/BillLookup/History.aspx?LegSess=88R&Bill=HB1' };
          } else if (selector === 'td:nth-child(2)') {
            return { text: () => 'House bill - should be ignored' };
          } else if (selector === 'td:nth-child(3)') {
            return { text: () => 'Brown, Bob' };
          } else if (selector === 'td:nth-child(4)') {
            return { text: () => 'Filed' };
          }
          return { text: () => '', attr: () => '' };
        })
      };

      const mockCheerioInstance = jest.fn((selector) => {
        if (selector === 'table tr') {
          return {
            each: jest.fn((callback) => {
              callback(0, mockRow1);
              callback(1, mockRow2);
              callback(2, mockRow3);
            })
          };
        }
        return mockElement;
      });

      mockCheerio.load.mockReturnValue(mockCheerioInstance);
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const bills = await scraper.scrapeBills();

      expect(bills).toHaveLength(2);
      expect(bills[0]).toMatchObject({
        billNumber: 'SB1',
        shortTitle: 'Relating to public education funding',
        fullTitle: 'Relating to public education funding',
        status: 'Filed',
        sponsors: [{ name: 'Smith, John', photoUrl: '', district: '' }],
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1'
      });
      expect(bills[1]).toMatchObject({
        billNumber: 'SB2',
        status: 'In Committee',
        sponsors: [{ name: 'Johnson, Mary', photoUrl: '', district: '' }]
      });
    });

    it('should handle scraping errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(scraper.scrapeBills()).rejects.toThrow('Failed to scrape bills: Network error');
    });

    it('should filter out non-Senate bills', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr>
                <td><a href="/bill/HB1">HB1</a></td>
                <td>House Bill</td>
                <td>Author</td>
                <td>Filed</td>
              </tr>
              <tr>
                <td><a href="/bill/SJR1">SJR1</a></td>
                <td>Senate Joint Resolution</td>
                <td>Author</td>
                <td>Filed</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const bills = await scraper.scrapeBills();
      expect(bills).toHaveLength(0);
    });
  });

  describe('getBillDetails', () => {
    it('should extract bill details successfully', async () => {
      const mockDetailHtml = `
        <html>
          <body>
            <div class="BillText">
              This is the full text of the bill relating to education funding.
              It contains multiple sections and detailed provisions.
            </div>
            <div class="BillSummary">
              This bill provides additional funding for public schools.
            </div>
            <div class="Committee">Education Committee</div>
            <div class="CoSponsors">Co-sponsors: Johnson, Mary; Brown, Bob</div>
            <div class="FiledDate">Filed: 01/15/2024</div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockDetailHtml });

      const details = await scraper.getBillDetails('https://example.com/bill/SB1');

      expect(details).toMatchObject({
        billText: expect.stringContaining('This is the full text of the bill'),
        abstract: 'This bill provides additional funding for public schools.',
        committee: 'Education Committee',
        coSponsors: ['Johnson, Mary', 'Brown, Bob'],
        filedDate: new Date('01/15/2024')
      });
    });

    it('should handle missing bill URL', async () => {
      await expect(scraper.getBillDetails('')).rejects.toThrow('Bill URL is required');
    });

    it('should return default values when scraping fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const details = await scraper.getBillDetails('https://example.com/bill/SB1');

      expect(details).toMatchObject({
        billText: '',
        abstract: 'Unable to retrieve bill details',
        committee: '',
        coSponsors: [],
        filedDate: null
      });
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
      expect(shortTitle).toHaveLength(100);
      expect(shortTitle).toEndWith('...');
    });

    it('should handle empty titles', () => {
      expect(scraper.extractShortTitle('')).toBe('');
      expect(scraper.extractShortTitle(null)).toBe('');
    });
  });

  describe('normalizeStatus', () => {
    it('should normalize various status formats', () => {
      expect(scraper.normalizeStatus('Filed')).toBe('Filed');
      expect(scraper.normalizeStatus('Introduced')).toBe('Filed');
      expect(scraper.normalizeStatus('Referred to Committee')).toBe('In Committee');
      expect(scraper.normalizeStatus('In Committee - Education')).toBe('In Committee');
      expect(scraper.normalizeStatus('Passed')).toBe('Passed');
      expect(scraper.normalizeStatus('Enacted')).toBe('Passed');
      expect(scraper.normalizeStatus('Unknown Status')).toBe('Filed');
      expect(scraper.normalizeStatus('')).toBe('Filed');
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

    it('should reject invalid bill number format', () => {
      const invalidBill = {
        billNumber: 'INVALID123',
        fullTitle: 'Relating to education',
        status: 'Filed'
      };
      expect(scraper.validateBillData(invalidBill)).toBe(false);
    });

    it('should accept various valid bill number formats', () => {
      const validFormats = ['SB1', 'SB 1', 'sb1', 'SB123'];
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

  describe('extractBillText', () => {
    it('should extract bill text from various selectors', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('This is a long bill text that contains more than fifty characters for testing purposes.')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const text = scraper.extractBillText($);
      expect(text).toBe('This is a long bill text that contains more than fifty characters for testing purposes.');
    });

    it('should return empty string when no text found', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const text = scraper.extractBillText($);
      expect(text).toBe('');
    });
  });

  describe('extractAbstract', () => {
    it('should extract abstract from bill summary', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('This bill provides funding for education.')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const abstract = scraper.extractAbstract($);
      expect(abstract).toBe('This bill provides funding for education.');
    });
  });

  describe('extractCommittee', () => {
    it('should extract committee name', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('Committee: Education Committee')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const committee = scraper.extractCommittee($);
      expect(committee).toBe('Education Committee');
    });
  });

  describe('extractCoSponsors', () => {
    it('should extract and parse co-sponsors', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('Co-sponsors: Johnson, Mary; Brown, Bob')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const coSponsors = scraper.extractCoSponsors($);
      expect(coSponsors).toEqual(['Johnson, Mary', 'Brown, Bob']);
    });
  });

  describe('extractFiledDate', () => {
    it('should extract and parse filed date', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('Filed: 01/15/2024')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const filedDate = scraper.extractFiledDate($);
      expect(filedDate).toEqual(new Date('01/15/2024'));
    });

    it('should return null when no date found', () => {
      const mockCheerio = {
        text: jest.fn().mockReturnValue('No date here')
      };
      const $ = jest.fn().mockReturnValue(mockCheerio);

      const filedDate = scraper.extractFiledDate($);
      expect(filedDate).toBeNull();
    });
  });

  describe('scrapeBillsWithDetails', () => {
    it('should scrape bills with enhanced details', async () => {
      // Mock the main bills list
      const mockListHtml = `
        <table>
          <tr>
            <td><a href="/bill/SB1">SB1</a></td>
            <td>Education Bill</td>
            <td>Smith, John</td>
            <td>Filed</td>
          </tr>
        </table>
      `;

      // Mock the bill detail page
      const mockDetailHtml = `
        <div class="BillText">Full bill text here with sufficient length for extraction.</div>
        <div class="BillSummary">Bill summary here.</div>
      `;

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockListHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const bills = await scraper.scrapeBillsWithDetails(1);

      expect(bills).toHaveLength(1);
      expect(bills[0]).toMatchObject({
        billNumber: 'SB1',
        fullTitle: 'Education Bill',
        billText: 'Full bill text here with sufficient length for extraction.',
        abstract: 'Bill summary here.'
      });
    });

    it('should handle errors in detail scraping gracefully', async () => {
      const mockListHtml = `
        <table>
          <tr>
            <td><a href="/bill/SB1">SB1</a></td>
            <td>Education Bill</td>
            <td>Smith, John</td>
            <td>Filed</td>
          </tr>
        </table>
      `;

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockListHtml })
        .mockRejectedValueOnce(new Error('Detail page error'));

      const bills = await scraper.scrapeBillsWithDetails(1);

      expect(bills).toHaveLength(1);
      expect(bills[0].billNumber).toBe('SB1');
      // Should include bill even without details if it passes validation
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await scraper.delay(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});