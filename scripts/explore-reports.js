// Explore the Texas Legislature reports page for bill listings
const axios = require('axios');
const cheerio = require('cheerio');

async function exploreReports() {
  try {
    console.log('🔍 Exploring Texas Legislature reports page...');
    
    const response = await axios.get('https://capitol.texas.gov/reports/general.aspx', {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log('✅ Reports page accessible');
    
    const $ = cheerio.load(response.data);
    
    // Look for bill-related links and reports
    console.log('\n📋 Looking for bill-related reports...');
    
    // Find all links that might contain bill listings
    const billLinks = $('a[href*="bill"], a[href*="Bill"], a:contains("Bill"), a:contains("Senate"), a:contains("House")');
    
    console.log(`Found ${billLinks.length} potentially relevant links:`);
    
    const relevantLinks = [];
    
    billLinks.each((i, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const text = $link.text().trim();
      
      if (href && text && text.length > 0) {
        relevantLinks.push({ text, href });
        console.log(`  - ${text}: ${href}`);
      }
    });
    
    // Look for any forms or dropdowns that might lead to bill reports
    console.log('\n📝 Looking for report generation forms...');
    
    const forms = $('form');
    console.log(`Found ${forms.length} forms`);
    
    forms.each((i, form) => {
      const $form = $(form);
      const action = $form.attr('action');
      console.log(`\nForm ${i + 1}: ${action}`);
      
      $form.find('select').each((j, select) => {
        const $select = $(select);
        const name = $select.attr('name');
        console.log(`  Select: ${name}`);
        
        $select.find('option').each((k, option) => {
          const $option = $(option);
          const value = $option.attr('value');
          const text = $option.text().trim();
          if (text && text.toLowerCase().includes('bill')) {
            console.log(`    - ${value}: ${text}`);
          }
        });
      });
    });
    
    // Test some promising links
    console.log('\n🧪 Testing promising bill report links...');
    
    const testUrls = [
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=billsbychamber',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=billsbyauthor',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=billsbycommittee',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=billsbystatus',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=allbills'
    ];
    
    for (const url of testUrls) {
      try {
        console.log(`\n🌐 Testing: ${url}`);
        const testResponse = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (testResponse.status === 200) {
          const test$ = cheerio.load(testResponse.data);
          
          // Look for Senate bills
          const sbRefs = test$('body').text().match(/SB\s*\d+/gi);
          const tables = test$('table').length;
          const rows = test$('tr').length;
          
          console.log(`  ✅ Status: ${testResponse.status}`);
          console.log(`  📊 Tables: ${tables}, Rows: ${rows}`);
          console.log(`  🏛️ SB references: ${sbRefs ? sbRefs.length : 0}`);
          
          if (sbRefs && sbRefs.length > 0) {
            console.log(`  📋 Sample bills: ${sbRefs.slice(0, 5).join(', ')}`);
            
            // This looks promising - let's examine the structure
            if (sbRefs.length > 10) {
              console.log(`  🎯 This URL looks very promising for scraping!`);
              
              // Look at table structure
              const firstTable = test$('table').first();
              if (firstTable.length > 0) {
                console.log(`  📋 First table structure:`);
                firstTable.find('tr').slice(0, 3).each((i, row) => {
                  const $row = test$(row);
                  const cells = $row.find('td, th').map((j, cell) => test$(cell).text().trim()).get();
                  console.log(`    Row ${i}: [${cells.join(' | ')}]`);
                });
              }
            }
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('❌ Error exploring reports:', error.message);
  }
}

exploreReports();