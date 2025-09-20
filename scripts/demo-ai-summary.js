#!/usr/bin/env node

/**
 * Demo script for AI Summary Service
 * Shows how to use the SummaryService in practice
 */

require('dotenv').config();
const { summaryService } = require('../services/ai-summary');

async function demoAISummaryService() {
  console.log('🎯 AI Summary Service Demo\n');

  // Sample bill text for demonstration
  const sampleBill = {
    id: 'SB_DEMO_001',
    text: `
A BILL TO BE ENTITLED
AN ACT relating to renewable energy development; providing tax incentives for solar and wind energy projects; establishing clean energy standards for utilities; creating jobs in the renewable energy sector; and providing an effective date.

BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF TEXAS:

SECTION 1. SHORT TITLE. This Act may be cited as the "Texas Clean Energy Development Act".

SECTION 2. FINDINGS AND PURPOSE. The Legislature finds that:
(1) renewable energy development creates economic opportunities and jobs;
(2) clean energy reduces environmental impact and promotes sustainability;
(3) energy independence strengthens Texas's economic position;
(4) tax incentives can accelerate renewable energy adoption.

SECTION 3. TAX INCENTIVES. A person who constructs or operates a renewable energy facility is entitled to:
(1) a property tax exemption for renewable energy equipment;
(2) a sales tax exemption for renewable energy components;
(3) accelerated depreciation for renewable energy investments.

SECTION 4. CLEAN ENERGY STANDARDS. Each electric utility shall:
(1) generate at least 30% of electricity from renewable sources by 2030;
(2) file annual compliance reports with the Public Utility Commission;
(3) pay penalties for non-compliance as determined by the Commission.

SECTION 5. EFFECTIVE DATE. This Act takes effect September 1, 2024.
    `.trim()
  };

  try {
    console.log('📄 Sample Bill: Texas Clean Energy Development Act');
    console.log('🆔 Bill ID:', sampleBill.id);
    console.log('📏 Bill Length:', sampleBill.text.length, 'characters\n');

    // Demo 1: Check service status
    console.log('1️⃣ Service Status:');
    const status = summaryService.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log();

    // Demo 2: Get reading levels
    console.log('2️⃣ Available Reading Levels:');
    const levels = summaryService.getReadingLevels();
    Object.entries(levels).forEach(([key, config]) => {
      console.log(`   ${key}: ${config.name} (max ${config.maxLength} chars)`);
    });
    console.log();

    // Demo 3: Generate high-level summary
    console.log('3️⃣ Generating High-Level Summary...');
    const highLevelSummary = await summaryService.generateSummary(
      sampleBill.id, 
      sampleBill.text, 
      'high-level'
    );
    console.log('📝 High-Level Summary:');
    console.log(`   "${highLevelSummary}"`);
    console.log(`   (${highLevelSummary.length} characters)\n`);

    // Demo 4: Generate detailed summary
    console.log('4️⃣ Generating Detailed Summary...');
    const detailedSummary = await summaryService.generateSummary(
      sampleBill.id, 
      sampleBill.text, 
      'detailed'
    );
    console.log('📝 Detailed Summary:');
    console.log(`   "${detailedSummary}"`);
    console.log(`   (${detailedSummary.length} characters)\n`);

    // Demo 5: Test caching (second call should be faster)
    console.log('5️⃣ Testing Cache (requesting high-level summary again)...');
    const cachedSummary = await summaryService.generateSummary(
      sampleBill.id, 
      sampleBill.text, 
      'high-level'
    );
    console.log('📋 Cached Summary:');
    console.log(`   "${cachedSummary}"`);
    console.log('   (Should be identical to first high-level summary)\n');

    // Demo 6: Topic classification
    console.log('6️⃣ Classifying Bill Topics...');
    const topics = await summaryService.classifyTopics(sampleBill.text);
    console.log('🏷️ Classified Topics:', topics.join(', '));
    console.log();

    // Demo 7: Cache management
    console.log('7️⃣ Cache Management:');
    console.log('   Current cache size:', summaryService.getStatus().cacheSize);
    summaryService.clearCache(sampleBill.id);
    console.log('   After clearing bill cache:', summaryService.getStatus().cacheSize);
    console.log();

    console.log('🎉 Demo completed successfully!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('   ✅ Multiple reading levels (high-level, detailed)');
    console.log('   ✅ Automatic caching for performance');
    console.log('   ✅ Fallback summaries when AI unavailable');
    console.log('   ✅ Topic classification');
    console.log('   ✅ Cache management');
    console.log('   ✅ Error handling and graceful degradation');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  demoAISummaryService()
    .then(() => {
      console.log('\n✨ Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo failed:', error.message);
      process.exit(1);
    });
}

module.exports = { demoAISummaryService };