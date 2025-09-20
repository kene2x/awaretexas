/**
 * @typedef {Object} SponsorInfo
 * @property {string} name - Sponsor's name
 * @property {string} [photoUrl] - URL to sponsor's photo
 * @property {string} [district] - Sponsor's district
 */

/**
 * @typedef {Object} BillData
 * @property {string} id - Unique bill identifier
 * @property {string} billNumber - Official bill number (e.g., "SB 123")
 * @property {string} shortTitle - Short title of the bill
 * @property {string} fullTitle - Full title of the bill
 * @property {'Filed'|'In Committee'|'Passed'} status - Current status of the bill
 * @property {SponsorInfo[]} [sponsors] - Array of sponsor information
 * @property {string} [officialUrl] - URL to official Texas Legislature page
 * @property {string} [billText] - Full text of the bill
 * @property {string} [abstract] - Bill abstract/summary
 * @property {string} [committee] - Committee handling the bill
 * @property {string[]} [coSponsors] - Array of co-sponsor names
 * @property {Date} [filedDate] - Date the bill was filed
 * @property {Date} [lastUpdated] - Last update timestamp
 * @property {string[]} [topics] - Array of topic tags
 */

/**
 * Bill model class with validation methods and status color mapping
 */
class Bill {
  /**
   * Create a Bill instance
   * @param {BillData} data - Bill data object
   */
  constructor(data) {
    this.validateRequiredFields(data);
    
    this.id = data.id;
    this.billNumber = data.billNumber;
    this.shortTitle = data.shortTitle;
    this.fullTitle = data.fullTitle;
    this.status = data.status;
    this.sponsors = data.sponsors || [];
    this.officialUrl = data.officialUrl || '';
    this.billText = data.billText || '';
    this.abstract = data.abstract || '';
    this.committee = data.committee || '';
    this.coSponsors = data.coSponsors || [];
    this.filedDate = data.filedDate || null;
    this.lastUpdated = data.lastUpdated || new Date();
    this.topics = data.topics || [];
  }

  /**
   * Validate required fields for bill data
   * @param {BillData} data - Bill data to validate
   * @throws {Error} If required fields are missing or invalid
   */
  validateRequiredFields(data) {
    const requiredFields = ['id', 'billNumber', 'shortTitle', 'fullTitle', 'status'];
    const validStatuses = ['Filed', 'In Committee', 'Passed', 'Signed', 'Vetoed', 'Effective'];

    for (const field of requiredFields) {
      if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
        throw new Error(`Required field '${field}' is missing or invalid`);
      }
    }

    if (!validStatuses.includes(data.status)) {
      throw new Error(`Invalid status '${data.status}'. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate bill number format (should start with SB for Senate Bill)
    if (!data.billNumber.match(/^SB\s*\d+$/i)) {
      throw new Error(`Invalid bill number format '${data.billNumber}'. Expected format: SB ###`);
    }
  }

  /**
   * Get color code for bill status
   * @returns {string} Color name for the status
   */
  getStatusColor() {
    const colors = {
      'Filed': 'yellow',
      'In Committee': 'blue',
      'Passed': 'green'
    };
    return colors[this.status] || 'gray';
  }

  /**
   * Get preview summary for bill card hover
   * @returns {string} Short preview text
   */
  getPreviewSummary() {
    if (this.abstract && this.abstract.trim()) {
      return this.abstract.length > 150 
        ? this.abstract.substring(0, 150) + '...' 
        : this.abstract;
    }
    return 'Summary not available';
  }

  /**
   * Validate sponsor information
   * @param {SponsorInfo} sponsor - Sponsor data to validate
   * @returns {boolean} True if valid
   */
  static validateSponsor(sponsor) {
    if (!sponsor || typeof sponsor !== 'object') {
      return false;
    }
    
    if (!sponsor.name || typeof sponsor.name !== 'string' || sponsor.name.trim() === '') {
      return false;
    }

    // photoUrl and district are optional but should be strings if provided
    if (sponsor.photoUrl && typeof sponsor.photoUrl !== 'string') {
      return false;
    }
    
    if (sponsor.district && typeof sponsor.district !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Validate complete bill data structure
   * @param {BillData} data - Bill data to validate
   * @returns {Object} Validation result with isValid boolean and errors array
   */
  static validateBillData(data) {
    const errors = [];

    try {
      // Check required fields using instance method
      const tempBill = { validateRequiredFields: Bill.prototype.validateRequiredFields };
      tempBill.validateRequiredFields(data);
    } catch (error) {
      errors.push(error.message);
    }

    // Validate sponsors array if provided
    if (data.sponsors && Array.isArray(data.sponsors)) {
      data.sponsors.forEach((sponsor, index) => {
        if (!Bill.validateSponsor(sponsor)) {
          errors.push(`Invalid sponsor data at index ${index}`);
        }
      });
    } else if (data.sponsors && !Array.isArray(data.sponsors)) {
      errors.push('Sponsors must be an array');
    }

    // Validate coSponsors array if provided
    if (data.coSponsors && !Array.isArray(data.coSponsors)) {
      errors.push('Co-sponsors must be an array');
    }

    // Validate topics array if provided
    if (data.topics && !Array.isArray(data.topics)) {
      errors.push('Topics must be an array');
    }

    // Validate dates if provided
    if (data.filedDate && !(data.filedDate instanceof Date) && isNaN(Date.parse(data.filedDate))) {
      errors.push('Filed date must be a valid date');
    }

    if (data.lastUpdated && !(data.lastUpdated instanceof Date) && isNaN(Date.parse(data.lastUpdated))) {
      errors.push('Last updated must be a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert bill to JSON-serializable object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      billNumber: this.billNumber,
      shortTitle: this.shortTitle,
      fullTitle: this.fullTitle,
      status: this.status,
      sponsors: this.sponsors,
      officialUrl: this.officialUrl,
      billText: this.billText,
      abstract: this.abstract,
      committee: this.committee,
      coSponsors: this.coSponsors,
      filedDate: this.filedDate,
      lastUpdated: this.lastUpdated,
      topics: this.topics
    };
  }
}

module.exports = Bill;