// Debug script to understand the Texas Legislature session structure
const axios = require('axios');
const cheerio = require('cheerio');

async function debugSession() {
  try {
    console.log('🔍 Investigating Texas Legislature session structure...');
    
    // Try the main bills page
    const mainResponse = await axios.get('https://capitol.texas.gov/BillLookup/', {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log('✅ Main bills page responded with status:', mainResponse.status);
    
    const $ = cheerio.load(mainResponse.data);
    
    // Look for session information
    const sessionSelects = $('select[name*="sess"], select[id*="sess"]');
    console.log(`📅 Found ${sessionSelects.length} session selectors`);
    
    sessionSelects.each((i, el) => {
      const $select = $(el);
      const name = $select.attr('name') || $select.attr('id');
      console.log(`\n📋 Session selector: ${name}`);
      
      $select.find('option').each((j, option) => {
        const $option = $(option);
        const value = $option.attr('value');
        const text = $option.text().trim();
        if (text) {
          console.log(`  - ${value}: ${text}`);
        }
      });
    });
    
    // Try to find a direct link to current session bills
    const currentSessionLinks = $('a[href*="Bills"], a[href*="bills"]');
    console.log(`\n🔗 Found ${currentSessionLinks.length} bill-related links:`);
    
    currentSessionLinks.each((i, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const text = $link.text().trim();
      console.log(`  - ${text}: ${href}`);
    });
    
    // Check if there's a way to get all Senate bills for current session
    console.log('\n🔍 Trying to find Senate bills listing...');
    
    // Try common patterns for bill listings
    const possibleUrls = [
      'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB1',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=billsbychamber',
      'https://capitol.texas.gov/BillLookup/BillsByAuthor.aspx',
      'https://capitol.texas.gov/BillLookup/BillsByCommittee.aspx'
    ];
    
    for (const url of possibleUrls) {
      try {
        console.log(`\n🌐 Testing: ${url}`);
        const testResponse = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (testResponse.status === 200) {
          const test$ = cheerio.load(testResponse.data);
          const sbRefs = test$('body').text().match(/SB\s*\d+/gi);
          console.log(`  ✅ Status: ${testResponse.status}, SB references: ${sbRefs ? sbRefs.length : 0}`);
          
          if (sbRefs && sbRefs.length > 0) {
            console.log(`  📋 Sample SB bills: ${sbRefs.slice(0, 3).join(', ')}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugSession();