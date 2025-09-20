const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock cheerio with a simple implementation
jest.mock('cheerio', () => ({
  load: jest.fn((html) => {
    // Simple mock that can parse basic HTML structure
    return (selector) => {
      if (selector === 'table tr') {
        return {
          each: (callback) => {
            // Mock table rows based on the HTML content
            if (html.includes('SB1')) {
              const mockRow = {
                find: (sel) => {
                  if (sel === 'td:first-child a') {
                    return { 
                      text: () => html.includes('SB1') ? 'SB1' : '',
                      attr: () => '/BillLookup/History.aspx?LegSess=88R&Bill=SB1'
                    };
                  } else if (sel === 'td:nth-child(2)') {
                    return { text: () => 'Relating to public education funding' };
                  } else if (sel === 'td:nth-child(3)') {
                    return { text: () => 'Smith, John' };
                  } else if (sel === 'td:nth-child(4)') {
                    return { text: () => 'Filed' };
                  }
                  return { text: () => '', attr: () => '' };
                }
              };
              callback(0, mockRow);
            }
            
            if (html.includes('SB2')) {
              const mockRow2 = {
                find: (sel) => {
                  if (sel === 'td:first-child a') {
                    return { 
                      text: () => 'SB2',
                      attr: () => '/BillLookup/History.aspx?LegSess=88R&Bill=SB2'
                    };
                  } else if (sel === 'td:nth-child(2)') {
                    return { text: () => 'Relating to healthcare reform' };
                  } else if (sel === 'td:nth-child(3)') {
                    return { text: () => 'Johnson, Mary' };
                  } else if (sel === 'td:nth-child(4)') {
                    return { text: () => 'In Committee' };
                  }
                  return { text: () => '', attr: () => '' };
                }
              };
              callback(1, mockRow2);
            }
          }
        };
      }
      
      // Mock for bill details selectors
      if (selector === '.BillText' || selector === '#BillText') {
        return { text: () => 'This is the full text of the bill relating to education funding.' };
      }
      if (selector === '.BillSummary' || selector === '#BillSummary') {
        return { text: () => 'This bill provides additional funding for public schools.' };
      }
      if (selector === '.Committee' || selector === '#Committee') {
        return { text: () => 'Education Committee' };
      }
      if (selector === '.CoSponsors' || selector === '#CoSponsors') {
        return { text: () => 'Co-sponsors: Johnson, Mary; Brown, Bob' };
      }
      if (selector === '.FiledDate' || selector === '#FiledDate') {
        return { text: () => 'Filed: 01/15/2024' };
      }
      
      return { text: () => '', attr: () => '' };
    };
  })
}));

const TexasLegislatureScraper = require('../../services/scraper');

describe('TexasLegislatureScraper - Mocked Integration Tests', () => {
  let scraper;

  beforeEach(() => {
    scraper = new TexasLegislatureScraper();
    jest.clearAllMocks();
  });

  describe('scrapeBills with mocked HTML', () => {
    it('should scrape Senate bills successfully', async () => {
      const mockHtml = `
        <table>
          <tr>
            <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB1">SB1</a></td>
            <td>Relating to public education funding</td>
            <td>Smith, John</td>
            <td>Filed</td>
          </tr>
          <tr>
            <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB2">SB2</a></td>
            <td>Relating to healthcare reform</td>
            <td>Johnson, Mary</td>
            <td>In Committee</td>
          </tr>
        </table>
      `;

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

    it('should handle empty results gracefully', async () => {
      const mockHtml = '<table></table>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const bills = await scraper.scrapeBills();
      expect(bills).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(scraper.scrapeBills()).rejects.toThrow('Failed to scrape bills: Network error');
    });
  });

  describe('getBillDetails with mocked HTML', () => {
    it('should extract bill details successfully', async () => {
      const mockDetailHtml = `
        <div class="BillText">This is the full text of the bill relating to education funding.</div>
        <div class="BillSummary">This bill provides additional funding for public schools.</div>
        <div class="Committee">Education Committee</div>
        <div class="CoSponsors">Co-sponsors: Johnson, Mary; Brown, Bob</div>
        <div class="FiledDate">Filed: 01/15/2024</div>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockDetailHtml });

      const details = await scraper.getBillDetails('https://example.com/bill/SB1');

      expect(details).toMatchObject({
        billText: 'This is the full text of the bill relating to education funding.',
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

  describe('scrapeBillsWithDetails', () => {
    it('should complete full workflow', async () => {
      const mockListHtml = `
        <table>
          <tr>
            <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB1">SB1</a></td>
            <td>Education Bill</td>
            <td>Smith, John</td>
            <td>Filed</td>
          </tr>
        </table>
      `;

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

      // Verify axios was called correctly
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const mockListHtml = `
        <table>
          <tr>
            <td><a href="/BillLookup/History.aspx?LegSess=88R&Bill=SB1">SB1</a></td>
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
});