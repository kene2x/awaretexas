// Research script to find the correct way to access Texas Senate bills
const axios = require('axios');
const cheerio = require('cheerio');

async function researchTLO() {
  try {
    console.log('🔍 Researching Texas Legislature Online structure...');
    
    // The Texas Legislature meets in odd-numbered years
    // 2025 would be the 89th Legislature (if it exists)
    // Let's check what sessions are available
    
    const currentYear = new Date().getFullYear();
    console.log(`📅 Current year: ${currentYear}`);
    
    // Try to access the bill lookup with different approaches
    console.log('\n🔍 Testing different bill lookup approaches...');
    
    // Approach 1: Try to get the main bill lookup page and understand its structure
    try {
      const response = await axios.get('https://capitol.texas.gov/BillLookup/BillNumber.aspx', {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      console.log('✅ Bill lookup page accessible');
      
      const $ = cheerio.load(response.data);
      
      // Look for session dropdown to understand current sessions
      const sessionSelect = $('select[name="cboLegSess"], select[id*="LegSess"]');
      if (sessionSelect.length > 0) {
        console.log('\n📋 Available legislative sessions:');
        sessionSelect.find('option').each((i, option) => {
          const $option = $(option);
          const value = $option.attr('value');
          const text = $option.text().trim();
          if (value && text) {
            console.log(`  - ${value}: ${text}`);
          }
        });
      }
      
      // Try to understand how to search for all Senate bills
      console.log('\n🔍 Analyzing search form structure...');
      
      const forms = $('form');
      forms.each((i, form) => {
        const $form = $(form);
        const action = $form.attr('action');
        const method = $form.attr('method') || 'GET';
        console.log(`\n📝 Form ${i + 1}: ${method} ${action}`);
        
        $form.find('input, select').each((j, input) => {
          const $input = $(input);
          const name = $input.attr('name');
          const type = $input.attr('type') || 'select';
          const value = $input.attr('value') || '';
          if (name) {
            console.log(`  - ${name} (${type}): ${value}`);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error accessing bill lookup:', error.message);
    }
    
    // Approach 2: Try to find if there's a reports or advanced search page
    console.log('\n🔍 Looking for alternative bill listing methods...');
    
    const alternativeUrls = [
      'https://capitol.texas.gov/Reports/',
      'https://capitol.texas.gov/BillLookup/',
      'https://capitol.texas.gov/Search/',
      'https://capitol.texas.gov/tlodocs/'
    ];
    
    for (const url of alternativeUrls) {
      try {
        console.log(`\n🌐 Testing: ${url}`);
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.status === 200) {
          const $ = cheerio.load(response.data);
          const title = $('title').text();
          console.log(`  ✅ Accessible: ${title}`);
          
          // Look for any bill-related links
          const billLinks = $('a[href*="Bill"], a[href*="bill"]');
          if (billLinks.length > 0) {
            console.log(`  📋 Found ${billLinks.length} bill-related links`);
            billLinks.slice(0, 3).each((i, link) => {
              const $link = $(link);
              const href = $link.attr('href');
              const text = $link.text().trim();
              console.log(`    - ${text}: ${href}`);
            });
          }
        }
      } catch (error) {
        console.log(`  ❌ Not accessible: ${error.message}`);
      }
    }
    
    // Approach 3: Research the current legislative session
    console.log('\n📅 Current Texas Legislature Information:');
    console.log('The Texas Legislature meets in regular session every odd-numbered year.');
    console.log('2025 would be the 89th Legislature if it exists.');
    console.log('The most recent completed session was likely the 88th Legislature (2023).');
    console.log('\nTo properly scrape bills, we need to:');
    console.log('1. Identify the current or most recent legislative session');
    console.log('2. Use the correct session ID in our requests');
    console.log('3. Possibly use a different approach like searching for bill ranges');
    
  } catch (error) {
    console.error('❌ Research error:', error.message);
  }
}

researchTLO();