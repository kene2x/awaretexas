const Bill = require('../../models/Bill');
const { DataValidator } = require('../../models/types');

describe('Bill Model', () => {
  const validBillData = {
    id: 'sb123-2024',
    billNumber: 'SB 123',
    shortTitle: 'Education Reform Act',
    fullTitle: 'An Act relating to education reform in Texas public schools',
    status: 'Filed',
    sponsors: [
      {
        name: 'Senator John Doe',
        photoUrl: 'https://example.com/photo.jpg',
        district: 'District 15'
      }
    ],
    officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB123',
    billText: 'Full text of the bill...',
    abstract: 'This bill reforms education standards in Texas.',
    committee: 'Education Committee',
    coSponsors: ['Senator Jane Smith'],
    filedDate: new Date('2024-01-15'),
    lastUpdated: new Date('2024-01-20'),
    topics: ['education', 'reform']
  };

  describe('Constructor', () => {
    test('should create a Bill instance with valid data', () => {
      const bill = new Bill(validBillData);
      
      expect(bill.id).toBe(validBillData.id);
      expect(bill.billNumber).toBe(validBillData.billNumber);
      expect(bill.shortTitle).toBe(validBillData.shortTitle);
      expect(bill.fullTitle).toBe(validBillData.fullTitle);
      expect(bill.status).toBe(validBillData.status);
      expect(bill.sponsors).toEqual(validBillData.sponsors);
      expect(bill.officialUrl).toBe(validBillData.officialUrl);
      expect(bill.billText).toBe(validBillData.billText);
      expect(bill.abstract).toBe(validBillData.abstract);
      expect(bill.committee).toBe(validBillData.committee);
      expect(bill.coSponsors).toEqual(validBillData.coSponsors);
      expect(bill.filedDate).toBe(validBillData.filedDate);
      expect(bill.lastUpdated).toBe(validBillData.lastUpdated);
      expect(bill.topics).toEqual(validBillData.topics);
    });

    test('should set default values for optional fields', () => {
      const minimalData = {
        id: 'sb456-2024',
        billNumber: 'SB 456',
        shortTitle: 'Test Bill',
        fullTitle: 'A test bill',
        status: 'In Committee'
      };

      const bill = new Bill(minimalData);
      
      expect(bill.sponsors).toEqual([]);
      expect(bill.officialUrl).toBe('');
      expect(bill.billText).toBe('');
      expect(bill.abstract).toBe('');
      expect(bill.committee).toBe('');
      expect(bill.coSponsors).toEqual([]);
      expect(bill.filedDate).toBeNull();
      expect(bill.lastUpdated).toBeInstanceOf(Date);
      expect(bill.topics).toEqual([]);
    });

    test('should throw error for missing required fields', () => {
      const invalidData = {
        id: 'sb789-2024',
        billNumber: 'SB 789',
        // Missing shortTitle, fullTitle, status
      };

      expect(() => new Bill(invalidData)).toThrow('Required field \'shortTitle\' is missing or invalid');
    });

    test('should throw error for invalid status', () => {
      const invalidData = {
        ...validBillData,
        status: 'Invalid Status'
      };

      expect(() => new Bill(invalidData)).toThrow('Invalid status \'Invalid Status\'. Must be one of: Filed, In Committee, Passed');
    });

    test('should throw error for invalid bill number format', () => {
      const invalidData = {
        ...validBillData,
        billNumber: 'HB 123' // Should be SB for Senate Bill
      };

      expect(() => new Bill(invalidData)).toThrow('Invalid bill number format \'HB 123\'. Expected format: SB ###');
    });
  });

  describe('getStatusColor', () => {
    test('should return correct colors for each status', () => {
      const filedBill = new Bill({ ...validBillData, status: 'Filed' });
      const committeeBill = new Bill({ ...validBillData, status: 'In Committee' });
      const passedBill = new Bill({ ...validBillData, status: 'Passed' });

      expect(filedBill.getStatusColor()).toBe('yellow');
      expect(committeeBill.getStatusColor()).toBe('blue');
      expect(passedBill.getStatusColor()).toBe('green');
    });

    test('should return gray for unknown status', () => {
      const bill = new Bill(validBillData);
      bill.status = 'Unknown'; // Manually set invalid status after creation
      
      expect(bill.getStatusColor()).toBe('gray');
    });
  });

  describe('getPreviewSummary', () => {
    test('should return truncated abstract if longer than 150 characters', () => {
      const longAbstract = 'A'.repeat(200);
      const bill = new Bill({ ...validBillData, abstract: longAbstract });
      
      const preview = bill.getPreviewSummary();
      expect(preview).toBe('A'.repeat(150) + '...');
      expect(preview.length).toBe(153);
    });

    test('should return full abstract if 150 characters or less', () => {
      const shortAbstract = 'Short abstract';
      const bill = new Bill({ ...validBillData, abstract: shortAbstract });
      
      expect(bill.getPreviewSummary()).toBe(shortAbstract);
    });

    test('should return default message if no abstract', () => {
      const bill = new Bill({ ...validBillData, abstract: '' });
      
      expect(bill.getPreviewSummary()).toBe('Summary not available');
    });
  });

  describe('validateSponsor', () => {
    test('should validate correct sponsor data', () => {
      const validSponsor = {
        name: 'Senator John Doe',
        photoUrl: 'https://example.com/photo.jpg',
        district: 'District 15'
      };

      expect(Bill.validateSponsor(validSponsor)).toBe(true);
    });

    test('should validate sponsor with only name', () => {
      const minimalSponsor = { name: 'Senator Jane Smith' };
      
      expect(Bill.validateSponsor(minimalSponsor)).toBe(true);
    });

    test('should reject sponsor without name', () => {
      const invalidSponsor = { photoUrl: 'https://example.com/photo.jpg' };
      
      expect(Bill.validateSponsor(invalidSponsor)).toBe(false);
    });

    test('should reject non-object sponsor', () => {
      expect(Bill.validateSponsor('not an object')).toBe(false);
      expect(Bill.validateSponsor(null)).toBe(false);
      expect(Bill.validateSponsor(undefined)).toBe(false);
    });

    test('should reject sponsor with invalid field types', () => {
      const invalidSponsor = {
        name: 'Senator John Doe',
        photoUrl: 123, // Should be string
        district: true // Should be string
      };
      
      expect(Bill.validateSponsor(invalidSponsor)).toBe(false);
    });
  });

  describe('validateBillData', () => {
    test('should validate correct bill data', () => {
      const result = Bill.validateBillData(validBillData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for missing required fields', () => {
      const invalidData = {
        id: 'sb123-2024',
        // Missing other required fields
      };

      const result = Bill.validateBillData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Required field');
    });

    test('should validate sponsors array', () => {
      const dataWithInvalidSponsors = {
        ...validBillData,
        sponsors: [
          { name: 'Valid Sponsor' },
          { photoUrl: 'no name' } // Invalid - missing name
        ]
      };

      const result = Bill.validateBillData(dataWithInvalidSponsors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid sponsor data at index 1');
    });

    test('should validate array fields', () => {
      const dataWithInvalidArrays = {
        ...validBillData,
        coSponsors: 'not an array',
        topics: 'not an array'
      };

      const result = Bill.validateBillData(dataWithInvalidArrays);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Co-sponsors must be an array');
      expect(result.errors).toContain('Topics must be an array');
    });

    test('should validate date fields', () => {
      const dataWithInvalidDates = {
        ...validBillData,
        filedDate: 'invalid date',
        lastUpdated: 'invalid date'
      };

      const result = Bill.validateBillData(dataWithInvalidDates);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filed date must be a valid date');
      expect(result.errors).toContain('Last updated must be a valid date');
    });
  });

  describe('toJSON', () => {
    test('should return plain object representation', () => {
      const bill = new Bill(validBillData);
      const json = bill.toJSON();
      
      expect(json).toEqual(validBillData);
      expect(json.constructor).toBe(Object);
    });
  });
});

describe('DataValidator', () => {
  describe('validateSummaryData', () => {
    const validSummaryData = {
      billId: 'sb123-2024',
      summaries: {
        'high-level': 'This bill reforms education.',
        'detailed': 'This comprehensive bill introduces significant reforms to the Texas education system.'
      },
      generatedAt: new Date(),
      cached: true
    };

    test('should validate correct summary data', () => {
      const result = DataValidator.validateSummaryData(validSummaryData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject missing required fields', () => {
      const invalidData = {
        billId: 'sb123-2024'
        // Missing summaries
      };

      const result = DataValidator.validateSummaryData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Summaries object is required');
    });

    test('should reject missing summary levels', () => {
      const invalidData = {
        billId: 'sb123-2024',
        summaries: {
          'high-level': 'Only high level summary'
          // Missing detailed summary
        }
      };

      const result = DataValidator.validateSummaryData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Summary for \'detailed\' is required and must be a string');
    });
  });

  describe('validateNewsArticle', () => {
    const validArticle = {
      headline: 'Senate Passes Education Bill',
      source: 'Texas Tribune',
      url: 'https://texastribune.org/article',
      publishedAt: new Date()
    };

    test('should validate correct article data', () => {
      const result = DataValidator.validateNewsArticle(validArticle);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject missing required fields', () => {
      const invalidArticle = {
        headline: 'Test Headline'
        // Missing source and url
      };

      const result = DataValidator.validateNewsArticle(invalidArticle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('source is required and must be a string');
      expect(result.errors).toContain('url is required and must be a string');
    });

    test('should reject invalid URL format', () => {
      const invalidArticle = {
        ...validArticle,
        url: 'not-a-valid-url'
      };

      const result = DataValidator.validateNewsArticle(invalidArticle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL must be a valid URL format');
    });
  });

  describe('sanitizeString', () => {
    test('should remove HTML tags', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = DataValidator.sanitizeString(input);
      
      expect(result).toBe('Hello alert("xss") World');
    });

    test('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = DataValidator.sanitizeString(input);
      
      expect(result).toBe('Hello World');
    });

    test('should limit length', () => {
      const input = 'A'.repeat(1500);
      const result = DataValidator.sanitizeString(input);
      
      expect(result.length).toBe(1000);
    });

    test('should handle non-string input', () => {
      expect(DataValidator.sanitizeString(123)).toBe('');
      expect(DataValidator.sanitizeString(null)).toBe('');
      expect(DataValidator.sanitizeString(undefined)).toBe('');
    });
  });
});