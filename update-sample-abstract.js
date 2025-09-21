// Quick script to update a sample bill's abstract to demonstrate the Caption Text feature
require('dotenv').config();
const { databaseService } = require('./config/database');
const { billDatabase } = require('./config/bill-database');

async function updateSampleAbstract() {
    try {
        console.log('🔗 Connecting to database...');
        await databaseService.connect();
        await databaseService.initializeCollections();
        
        // Update SB22 with the correct Caption Text we extracted earlier
        const sampleBill = {
            id: 'SB22',
            billNumber: 'SB 22',
            abstract: 'Relating to the Texas moving image industry incentive program and the establishment and funding of the Texas moving image industry incentive fund.',
            fullTitle: 'Relating to the Texas moving image industry incentive program and the establishment and funding of the Texas moving image industry incentive fund.',
            shortTitle: 'Texas Moving Image Industry Incentive Program',
            status: 'Filed',
            sponsors: [{ name: 'Huffman', photoUrl: '', district: '' }],
            officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB22',
            billText: '',
            committee: '',
            coSponsors: [],
            filedDate: new Date('2025-01-15'),
            lastActionDate: new Date('2025-01-15'),
            lastAction: 'Filed',
            lastUpdated: new Date(),
            topics: ['Business']
        };
        
        console.log('💾 Updating SB22 with proper Caption Text...');
        await billDatabase.saveBill(sampleBill);
        
        console.log('✅ Successfully updated SB22 with Caption Text');
        console.log(`📋 Abstract: ${sampleBill.abstract}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        try {
            await databaseService.disconnect();
        } catch (e) {
            // Ignore disconnect errors
        }
        process.exit(0);
    }
}

updateSampleAbstract();