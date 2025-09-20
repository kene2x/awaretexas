// Test script to check bill detail page functionality
const axios = require('axios');

async function testBillDetail() {
  try {
    console.log('🔍 Testing bill detail functionality...');
    
    // Test 1: Check if the bill detail API works
    console.log('\n1. Testing API endpoint...');
    const billId = 'SB 1';
    const apiResponse = await axios.get(`http://localhost:3000/api/bills/${encodeURIComponent(billId)}`);
    
    if (apiResponse.status === 200 && apiResponse.data.success) {
      console.log('✅ API endpoint working');
      console.log(`📊 Bill data: ${apiResponse.data.data.billNumber} - ${apiResponse.data.data.shortTitle}`);
    } else {
      console.log('❌ API endpoint failed');
      return;
    }
    
    // Test 2: Check if the HTML page is accessible
    console.log('\n2. Testing HTML page...');
    const htmlResponse = await axios.get('http://localhost:3000/bill-detail.html');
    
    if (htmlResponse.status === 200) {
      console.log('✅ HTML page accessible');
      
      // Check if required scripts are referenced
      const htmlContent = htmlResponse.data;
      const requiredScripts = [
        'error-boundary.js',
        'api-optimizer.js', 
        'bill-detail.js'
      ];
      
      console.log('\n3. Checking required scripts...');
      requiredScripts.forEach(script => {
        if (htmlContent.includes(script)) {
          console.log(`✅ ${script} referenced`);
        } else {
          console.log(`❌ ${script} missing`);
        }
      });
      
    } else {
      console.log('❌ HTML page not accessible');
    }
    
    // Test 3: Check if JavaScript files exist
    console.log('\n4. Testing JavaScript file accessibility...');
    const jsFiles = [
      'js/error-boundary.js',
      'js/api-optimizer.js',
      'js/bill-detail.js'
    ];
    
    for (const jsFile of jsFiles) {
      try {
        const jsResponse = await axios.get(`http://localhost:3000/${jsFile}`);
        if (jsResponse.status === 200) {
          console.log(`✅ ${jsFile} accessible`);
        } else {
          console.log(`❌ ${jsFile} returned status ${jsResponse.status}`);
        }
      } catch (error) {
        console.log(`❌ ${jsFile} not accessible: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Test complete. If all items show ✅, the issue might be in browser JavaScript execution.');
    console.log('💡 Try opening: http://localhost:3000/bill-detail.html?id=SB%201');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBillDetail();