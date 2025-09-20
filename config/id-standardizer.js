// ID Standardization for Texas Senate Bill Tracker
// This ensures consistent ID formatting across the entire application

class IdStandardizer {
    constructor() {
        // Define the canonical format: "SB1", "HB123", "SCR45", etc.
        // Rules:
        // 1. Always uppercase
        // 2. No spaces between prefix and number
        // 3. Remove any extra characters
        // 4. Preserve leading zeros if they exist in the original
        
        this.billPrefixes = ['SB', 'HB', 'SCR', 'HCR', 'SR', 'HR', 'SJR', 'HJR'];
    }

    /**
     * Convert any bill ID format to canonical format
     * Examples:
     * "SB 1" -> "SB1"
     * "sb 123" -> "SB123" 
     * "S.B. 45" -> "SB45"
     * "Senate Bill 1" -> "SB1"
     * "HB  007" -> "HB007"
     */
    standardize(rawId) {
        if (!rawId) return null;
        
        try {
            let id = String(rawId).trim();
            
            // Handle full names like "Senate Bill 1" -> "SB1"
            id = this.convertFullNames(id);
            
            // Remove dots and extra spaces
            id = id.replace(/\./g, '').replace(/\s+/g, '');
            
            // Make uppercase
            id = id.toUpperCase();
            
            // Validate format
            if (!this.isValidBillId(id)) {
                console.warn(`Invalid bill ID format: ${rawId} -> ${id}`);
                return null;
            }
            
            return id;
        } catch (error) {
            console.error(`Error standardizing ID "${rawId}":`, error.message);
            return null;
        }
    }

    /**
     * Convert full bill names to abbreviated format
     */
    convertFullNames(id) {
        const conversions = {
            'SENATE BILL': 'SB',
            'HOUSE BILL': 'HB',
            'SENATE CONCURRENT RESOLUTION': 'SCR',
            'HOUSE CONCURRENT RESOLUTION': 'HCR',
            'SENATE RESOLUTION': 'SR',
            'HOUSE RESOLUTION': 'HR',
            'SENATE JOINT RESOLUTION': 'SJR',
            'HOUSE JOINT RESOLUTION': 'HJR'
        };
        
        let result = id.toUpperCase();
        
        for (const [fullName, abbrev] of Object.entries(conversions)) {
            if (result.startsWith(fullName)) {
                result = result.replace(fullName, abbrev);
                break;
            }
        }
        
        return result;
    }

    /**
     * Validate that an ID matches expected bill format
     */
    isValidBillId(id) {
        if (!id || typeof id !== 'string') return false;
        
        // Check if it starts with a valid prefix
        const hasValidPrefix = this.billPrefixes.some(prefix => id.startsWith(prefix));
        if (!hasValidPrefix) return false;
        
        // Check if it has a number after the prefix
        const match = id.match(/^([A-Z]+)(\d+)$/);
        return match !== null;
    }

    /**
     * Extract the prefix and number from a standardized ID
     */
    parse(standardId) {
        const match = standardId.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;
        
        return {
            prefix: match[1],
            number: match[2],
            fullId: standardId
        };
    }

    /**
     * Generate display format (with space for UI)
     * "SB1" -> "SB 1"
     */
    toDisplayFormat(standardId) {
        const parsed = this.parse(standardId);
        if (!parsed) return standardId;
        
        return `${parsed.prefix} ${parsed.number}`;
    }

    /**
     * Generate URL-safe format
     */
    toUrlFormat(standardId) {
        // For URLs, we'll use the display format but encoded
        return encodeURIComponent(this.toDisplayFormat(standardId));
    }

    /**
     * Parse URL format back to standard format
     */
    fromUrlFormat(urlId) {
        const decoded = decodeURIComponent(urlId);
        return this.standardize(decoded);
    }

    /**
     * Generate multiple lookup variants for database queries
     * This helps with backward compatibility during transition
     */
    generateLookupVariants(rawId) {
        const standardId = this.standardize(rawId);
        if (!standardId) return [];
        
        const variants = new Set();
        
        // Add the standard format
        variants.add(standardId);
        
        // Add display format
        variants.add(this.toDisplayFormat(standardId));
        
        // Add lowercase versions
        variants.add(standardId.toLowerCase());
        variants.add(this.toDisplayFormat(standardId).toLowerCase());
        
        // Add original format if different
        if (rawId && String(rawId).trim() !== standardId) {
            variants.add(String(rawId).trim());
        }
        
        return Array.from(variants);
    }
}

// Create singleton instance
const idStandardizer = new IdStandardizer();

module.exports = { IdStandardizer, idStandardizer };