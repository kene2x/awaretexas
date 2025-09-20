const TexasLegislatureScraper = require('../../services/scraper');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('TexasLegislatureScraper Integration Tests', () => {
  let scraper;
  let mockBillsListHtml;
  let mockBillDetailHtml;

  beforeAll(() => {
    // Load mock HTML fixtures
    mockBillsListHtml = fs.readFileSync(
      path.join(__dirname, '../fixtures/mock-bills-list.html'),
      'utf8'
    );
    mockBillDetailHtml = fs.readFileSync(
      path.join(__dirname, '../fixtures/mock-bill-detail.html'),
      'utf8'
    );
  });

  beforeEach(() => {
    scraper = new TexasLegislatureScraper();
    jest.clearAllMocks();
  });

  describe('Full scraping workflow with realistic HTML', () => {
    it('should scrape bills list with realistic HTML structure', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockBillsListHtml });

      const bills = await scraper.scrapeBills();

      expect(bills).toHaveLength(4); // 4 Senate bills in fixture
      
      // Test first bill
      expect(bills[0]).toMatchObject({
        billNumber: 'SB1',
        shortTitle: 'Relating to public school finance and public education',
        fullTitle: 'Relating to public school finance and public education',
        status: 'Filed',
        sponsors: [{ name: 'Creighton', photoUrl: '', district: '' }],
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1'
      });

      // Test second bill with committee status
      expect(bills[1]).toMatchObject({
        billNumber: 'SB2',
        status: 'In Committee',
        sponsors: [{ name: 'Birdwell', photoUrl: '', district: '' }]
      });

      // Test third bill with passed status
      expect(bills[2]).toMatchObject({
        billNumber: 'SB3',
        status: 'Passed',
        sponsors: [{ name: 'Nichols', photoUrl: '', district: '' }]
      });

      // Test fourth bill with spaced bill number
      expect(bills[3]).toMatchObject({
        billNumber: 'SB 4',
        status: 'In Committee'
      });
    });

    it('should extract detailed bill information from realistic HTML', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockBillDetailHtml });

      const details = await scraper.getBillDetails('https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1');

      expect(details).toMatchObject({
        billText: expect.stringContaining('AN ACT relating to public school finance'),
        abstract: expect.stringContaining('This bill relates to public school finance'),
        committee: 'Education Committee',
        coSponsors: ['Bettencourt, John', 'Hughes, Bryan', 'West, Royce'],
        filedDate: new Date('01/10/2024')
      });

      expect(details.billText).toContain('SECTION 1');
      expect(details.billText).toContain('funding formula');
      expect(details.abstract).toContain('equitable funding');
    });

    it('should complete full workflow with bills and details', async () => {
      // Mock the bills list call
      mockedAxios.get.mockResolvedValueOnce({ data: mockBillsListHtml });
      
      // Mock detail calls for each bill
      mockedAxios.get.mockResolvedValue({ data: mockBillDetailHtml });

      const detailedBills = await scraper.scrapeBillsWithDetails(2); // Limit to 2 for testing

      expect(detailedBills).toHaveLength(2);
      
      // First bill should have enhanced details
      expect(detailedBills[0]).toMatchObject({
        billNumber: 'SB1',
        fullTitle: 'Relating to public school finance and public education',
        billText: expect.stringContaining('AN ACT relating to public school finance'),
        abstract: expect.stringContaining('This bill relates to public school finance'),
        committee: 'Education Committee',
        coSponsors: expect.arrayContaining(['Bettencourt, John', 'Hughes, Bryan', 'West, Royce'])
      });

      // Verify axios was called correctly
      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // 1 for list + 2 for details
    });

    it('should handle mixed success/failure scenarios', async () => {
      // Mock successful bills list
      mockedAxios.get.mockResolvedValueOnce({ data: mockBillsListHtml });
      
      // Mock first detail call success, second failure
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockBillDetailHtml })
        .mockRejectedValueOnce(new Error('Network timeout'));

      const detailedBills = await scraper.scrapeBillsWithDetails(2);

      expect(detailedBills).toHaveLength(2);
      
      // First bill should have full details
      expect(detailedBills[0].billText).toContain('AN ACT relating');
      
      // Second bill should have basic info only (no enhanced details due to error)
      expect(detailedBills[1].billNumber).toBe('SB2');
      expect(detailedBills[1].billText).toBe(''); // Empty due to failed detail fetch
    });
  });

  describe('Error handling with realistic scenarios', () => {
    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><p>Not a bills table</p></body></html>';
      mockedAxios.get.mockResolvedValue({ data: malformedHtml });

      const bills = await scraper.scrapeBills();
      expect(bills).toHaveLength(0);
    });

    it('should handle partial data in HTML', async () => {
      const partialHtml = `
        <table>
          <tr>
            <td><a href="/bill/SB1">SB1</a></td>
            <td></td> <!-- Empty title -->
            <td>Author</td>
            <td>Filed</td>
          </tr>
          <tr>
            <td><a>SB2</a></td> <!-- No href -->
            <td>Valid Title</td>
            <td>Author</td>
            <td>Filed</td>
          </tr>
        </table>
      `;
      
      mockedAxios.get.mockResolvedValue({ data: partialHtml });

      const bills = await scraper.scrapeBills();
      
      // Should filter out bills with missing required data
      expect(bills.length).toBeLessThan(2);
      
      // Bills that do get through should have valid data
      bills.forEach(bill => {
        expect(bill.billNumber).toBeTruthy();
        expect(bill.fullTitle).toBeTruthy();
      });
    });

    it('should validate all scraped bills', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockBillsListHtml });

      const bills = await scraper.scrapeBills();
      
      // All returned bills should pass validation
      bills.forEach(bill => {
        expect(scraper.validateBillData(bill)).toBe(true);
      });
    });
  });

  describe('Performance and rate limiting', () => {
    it('should add delays between detail requests', async () => {
      const startTime = Date.now();
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockBillsListHtml });
      mockedAxios.get.mockResolvedValue({ data: mockBillDetailHtml });

      await scraper.scrapeBillsWithDetails(2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 1 second due to delay between requests
      expect(duration).toBeGreaterThan(1000);
    });

    it('should handle timeout errors appropriately', async () => {
      mockedAxios.get.mockRejectedValue({ 
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      });

      await expect(scraper.scrapeBills()).rejects.toThrow('Failed to scrape bills');
    });
  });
});