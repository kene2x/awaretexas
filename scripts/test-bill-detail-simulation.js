// Simulate bill detail page loading to test for JavaScript errors
const axios = require('axios');

async function simulateBillDetailPage() {
  try {
    console.log('🔍 Simulating bill detail page loading...');
    
    // Test the specific bill detail URL that would be used
    const billId = 'SB 1';
    const encodedBillId = encodeURIComponent(billId);
    
    console.log(`\n1. Testing bill detail page URL: /bill-detail.html?id=${encodedBillId}`);
    
    // Test if the HTML page loads
    const htmlResponse = await axios.get(`http://localhost:3000/bill-detail.html?id=${encodedBillId}`);
    
    if (htmlResponse.status === 200) {
      console.log('✅ Bill detail HTML page loads successfully');
      
      // Check if the HTML contains the expected structure
      const htmlContent = htmlResponse.data;
      const expectedElements = [
        'id="loading"',
        'id="bill-detail-content"', 
        'id="error-state"',
        'id="bill-header"',
        'id="sponsor-info"'
      ];
      
      console.log('\n2. Checking HTML structure...');
      expectedElements.forEach(element => {
        if (htmlContent.includes(element)) {
          console.log(`✅ ${element} found`);
        } else {
          console.log(`❌ ${element} missing`);
        }
      });
      
    } else {
      console.log(`❌ HTML page returned status ${htmlResponse.status}`);
    }
    
    // Test the API endpoint that the JavaScript would call
    console.log('\n3. Testing API endpoint that JavaScript would call...');
    const apiResponse = await axios.get(`http://localhost:3000/api/bills/${encodedBillId}`);
    
    if (apiResponse.status === 200 && apiResponse.data.success) {
      console.log('✅ API endpoint returns valid data');
      console.log(`📊 Bill: ${apiResponse.data.data.billNumber} - ${apiResponse.data.data.shortTitle}`);
      console.log(`📊 Status: ${apiResponse.data.data.status}`);
      console.log(`📊 Sponsors: ${apiResponse.data.data.sponsors?.length || 0}`);
    } else {
      console.log('❌ API endpoint failed or returned invalid data');
    }
    
    console.log('\n🎯 Simulation complete!');
    console.log('💡 If all tests pass, the bill detail page should work in the browser.');
    console.log(`🌐 Try: http://localhost:3000/bill-detail.html?id=${encodedBillId}`);
    
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${error.response.data}`);
    }
  }
}

simulateBillDetailPage();