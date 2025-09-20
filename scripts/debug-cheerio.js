// Debug script to test cheerio import
console.log('Testing cheerio import...');

try {
  const cheerio = require('cheerio');
  console.log('✅ Cheerio imported successfully');
  console.log('Cheerio version:', cheerio.version || 'version not available');
  
  // Test basic functionality
  const $ = cheerio.load('<div>Hello World</div>');
  const text = $('div').text();
  console.log('✅ Cheerio basic test passed:', text);
  
} catch (error) {
  console.error('❌ Cheerio import failed:', error.message);
  console.error('Stack:', error.stack);
}