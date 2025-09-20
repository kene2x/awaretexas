// Debug script to check the Texas Legislature website structure
const axios = require('axios');
const cheerio = require('cheerio');

async function debugWebsite() {
  try {
    console.log('🔍 Fetching Texas Legislature website...');
    
    const response = await axios.get('https://capitol.texas.gov/BillLookup/BillNumber.aspx', {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log('✅ Website responded with status:', response.status);
    console.log('📄 Content length:', response.data.length);
    
    const $ = cheerio.load(response.data);
    
    // Check for tables
    const tables = $('table');
    console.log(`📊 Found ${tables.length} tables on the page`);
    
    // Check for any bill-related content
    const billLinks = $('a[href*="Bill"]');
    console.log(`🔗 Found ${billLinks.length} bill-related links`);
    
    // Look for Senate bill patterns
    const sbPattern = /SB\s*\d+/gi;
    const pageText = $('body').text();
    const sbMatches = pageText.match(sbPattern);
    console.log(`🏛️ Found ${sbMatches ? sbMatches.length : 0} SB references in page text`);
    
    if (sbMatches && sbMatches.length > 0) {
      console.log('First few SB matches:', sbMatches.slice(0, 5));
    }
    
    // Check for forms or search functionality
    const forms = $('form');
    console.log(`📝 Found ${forms.length} forms on the page`);
    
    // Look for input fields that might be for bill search
    const inputs = $('input[type="text"], select');
    console.log(`🔍 Found ${inputs.length} input/select fields`);
    
    inputs.each((i, el) => {
      const $el = $(el);
      const name = $el.attr('name') || $el.attr('id') || 'unnamed';
      console.log(`  - Input: ${name} (${$el.attr('type') || 'select'})`);
    });
    
    // Save a sample of the HTML for inspection
    const htmlSample = response.data.substring(0, 2000);
    console.log('\n📄 HTML Sample (first 2000 chars):');
    console.log(htmlSample);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugWebsite();