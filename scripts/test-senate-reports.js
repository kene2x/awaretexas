// Test specific Senate bill reports
const axios = require('axios');
const cheerio = require('cheerio');

async function testSenateReports() {
  try {
    console.log('🔍 Testing specific Senate bill reports...');
    
    // Test the most promising URLs from the reports page
    const testUrls = [
      // Current session (892 = 89th Legislature, 2nd Special Session)
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=892&ID=senatefiled',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=senatefiled',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=891&ID=senatefiled',
      
      // Try the Bills By reports page
      'https://capitol.texas.gov/Reports/BillsBy.aspx',
      
      // Try today's filed bills
      'https://capitol.texas.gov/Reports/Report.aspx?ID=todayfiled',
      
      // Try passed bills
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=892&ID=passed',
      'https://capitol.texas.gov/Reports/Report.aspx?LegSess=89R&ID=passed'
    ];
    
    for (const url of testUrls) {
      try {
        console.log(`\n🌐 Testing: ${url}`);
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.status === 200) {
          const $ = cheerio.load(response.data);
          
          // Look for Senate bills
          const pageText = $('body').text();
          const sbRefs = pageText.match(/SB\s*\d+/gi);
          const tables = $('table').length;
          const rows = $('tr').length;
          
          console.log(`  ✅ Status: ${response.status}`);
          console.log(`  📊 Tables: ${tables}, Rows: ${rows}`);
          console.log(`  🏛️ SB references: ${sbRefs ? sbRefs.length : 0}`);
          
          if (sbRefs && sbRefs.length > 0) {
            console.log(`  📋 Sample bills: ${sbRefs.slice(0, 10).join(', ')}`);
            
            // This looks promising - examine the table structure
            console.log(`  🎯 Found Senate bills! Examining structure...`);
            
            // Look for the main data table
            const dataTables = $('table').filter((i, table) => {
              const $table = $(table);
              const tableText = $table.text();
              return tableText.includes('SB') && $table.find('tr').length > 2;
            });
            
            if (dataTables.length > 0) {
              console.log(`  📋 Found ${dataTables.length} data table(s) with bills`);
              
              const firstTable = dataTables.first();
              console.log(`  📊 First data table structure:`);
              
              // Examine headers
              const headerRow = firstTable.find('tr').first();
              const headers = headerRow.find('th, td').map((i, cell) => $(cell).text().trim()).get();
              console.log(`    Headers: [${headers.join(' | ')}]`);
              
              // Examine first few data rows
              firstTable.find('tr').slice(1, 4).each((i, row) => {
                const $row = $(row);
                const cells = $row.find('td').map((j, cell) => {
                  const $cell = $(cell);
                  const text = $cell.text().trim();
                  const link = $cell.find('a').attr('href');
                  return link ? `${text} (${link})` : text;
                }).get();
                
                if (cells.length > 0) {
                  console.log(`    Row ${i + 1}: [${cells.join(' | ')}]`);
                }
              });
              
              // Count total bill rows
              const billRows = firstTable.find('tr').filter((i, row) => {
                return $(row).text().includes('SB');
              });
              console.log(`  📊 Total bill rows: ${billRows.length}`);
            }
          } else {
            // Check if there's a message about no bills or different structure
            const noDataMsg = $('td:contains("No"), span:contains("No"), div:contains("No")').text();
            if (noDataMsg) {
              console.log(`  ℹ️ Message: ${noDataMsg.substring(0, 100)}`);
            }
            
            // Check for any forms or dropdowns that might need to be filled
            const selects = $('select');
            if (selects.length > 0) {
              console.log(`  📝 Found ${selects.length} select dropdown(s):`);
              selects.each((i, select) => {
                const $select = $(select);
                const name = $select.attr('name');
                const options = $select.find('option').length;
                console.log(`    - ${name}: ${options} options`);
              });
            }
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
  } catch (error) {
    console.error('❌ Error testing Senate reports:', error.message);
  }
}

testSenateReports();