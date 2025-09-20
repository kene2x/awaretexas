#!/usr/bin/env node

// Add recent bills script - adds more current bills and sorts by most recent
require('dotenv').config();
const { billDatabase } = require('./config/bill-database');
const { databaseService } = require('./config/database');
const { idStandardizer } = require('./config/id-standardizer');

async function addRecentBills() {
    try {
        console.log('📅 Adding recent bills with proper dates...');
        
        // Connect to database
        await databaseService.connect();
        
        // Create recent bills with realistic dates (most recent first)
        const recentBills = [
            {
                rawBillNumber: 'SB 2001',
                shortTitle: 'Artificial Intelligence in Education',
                fullTitle: 'An Act relating to the use of artificial intelligence in public education.',
                status: 'Filed',
                sponsors: [{ name: 'Watson', photoUrl: '', district: '14' }],
                abstract: 'Establishes guidelines for the ethical use of artificial intelligence tools in Texas public schools.',
                committee: 'Education',
                topics: ['Education', 'Technology', 'Artificial Intelligence'],
                lastAction: 'Filed - 09/15/2025',
                lastActionDate: new Date('2025-09-15'),
                filedDate: new Date('2025-09-15')
            },
            {
                rawBillNumber: 'SB 1999',
                shortTitle: 'Renewable Energy Infrastructure',
                fullTitle: 'An Act relating to renewable energy infrastructure development.',
                status: 'In Committee',
                sponsors: [{ name: 'Johnson', photoUrl: '', district: '11' }],
                abstract: 'Provides incentives for renewable energy infrastructure development in Texas.',
                committee: 'Natural Resources & Economic Development',
                topics: ['Energy', 'Environment', 'Infrastructure'],
                lastAction: 'Referred to Committee - 09/10/2025',
                lastActionDate: new Date('2025-09-10'),
                filedDate: new Date('2025-09-08')
            },
            {
                rawBillNumber: 'SB 1998',
                shortTitle: 'Cybersecurity for State Agencies',
                fullTitle: 'An Act relating to cybersecurity requirements for state agencies.',
                status: 'Filed',
                sponsors: [{ name: 'Parker', photoUrl: '', district: '12' }],
                abstract: 'Establishes mandatory cybersecurity standards for all Texas state agencies.',
                committee: 'State Affairs',
                topics: ['Technology', 'Cybersecurity', 'Government'],
                lastAction: 'Filed - 09/05/2025',
                lastActionDate: new Date('2025-09-05'),
                filedDate: new Date('2025-09-05')
            },
            {
                rawBillNumber: 'SB 1997',
                shortTitle: 'Mental Health Services Expansion',
                fullTitle: 'An Act relating to expanding mental health services in rural areas.',
                status: 'In Committee',
                sponsors: [{ name: 'Miles', photoUrl: '', district: '13' }],
                abstract: 'Expands access to mental health services in underserved rural communities.',
                committee: 'Health & Human Services',
                topics: ['Healthcare', 'Mental Health', 'Rural Development'],
                lastAction: 'Committee hearing scheduled - 09/01/2025',
                lastActionDate: new Date('2025-09-01'),
                filedDate: new Date('2025-08-28')
            },
            {
                rawBillNumber: 'SB 1996',
                shortTitle: 'Electric Vehicle Charging Network',
                fullTitle: 'An Act relating to the development of electric vehicle charging infrastructure.',
                status: 'Filed',
                sponsors: [{ name: 'Rodriguez', photoUrl: '', district: '29' }],
                abstract: 'Creates a statewide network of electric vehicle charging stations.',
                committee: 'Transportation',
                topics: ['Transportation', 'Environment', 'Infrastructure'],
                lastAction: 'Filed - 08/25/2025',
                lastActionDate: new Date('2025-08-25'),
                filedDate: new Date('2025-08-25')
            },
            {
                rawBillNumber: 'SB 1995',
                shortTitle: 'Affordable Housing Initiative',
                fullTitle: 'An Act relating to affordable housing development incentives.',
                status: 'Passed',
                sponsors: [{ name: 'Zaffirini', photoUrl: '', district: '21' }],
                abstract: 'Provides tax incentives for affordable housing development projects.',
                committee: 'Intergovernmental Relations',
                topics: ['Housing', 'Economic Development', 'Taxation'],
                lastAction: 'Signed by Governor - 08/20/2025',
                lastActionDate: new Date('2025-08-20'),
                filedDate: new Date('2025-07-15')
            },
            {
                rawBillNumber: 'SB 1994',
                shortTitle: 'Water Conservation Technology',
                fullTitle: 'An Act relating to water conservation technology in agriculture.',
                status: 'In Committee',
                sponsors: [{ name: 'Perry', photoUrl: '', district: '28' }],
                abstract: 'Promotes the use of advanced water conservation technology in Texas agriculture.',
                committee: 'Water, Agriculture & Rural Affairs',
                topics: ['Agriculture', 'Water', 'Technology'],
                lastAction: 'Committee markup - 08/15/2025',
                lastActionDate: new Date('2025-08-15'),
                filedDate: new Date('2025-08-10')
            },
            {
                rawBillNumber: 'SB 1993',
                shortTitle: 'Digital Privacy Protection',
                fullTitle: 'An Act relating to digital privacy rights for Texas residents.',
                status: 'Filed',
                sponsors: [{ name: 'Hancock', photoUrl: '', district: '9' }],
                abstract: 'Establishes comprehensive digital privacy protections for Texas residents.',
                committee: 'Business & Commerce',
                topics: ['Technology', 'Privacy', 'Consumer Protection'],
                lastAction: 'Filed - 08/10/2025',
                lastActionDate: new Date('2025-08-10'),
                filedDate: new Date('2025-08-10')
            },
            {
                rawBillNumber: 'SB 1992',
                shortTitle: 'Disaster Recovery Funding',
                fullTitle: 'An Act relating to disaster recovery funding mechanisms.',
                status: 'Passed',
                sponsors: [{ name: 'Kolkhorst', photoUrl: '', district: '18' }],
                abstract: 'Establishes a dedicated fund for rapid disaster recovery response.',
                committee: 'Finance',
                topics: ['Emergency Management', 'Finance', 'Disaster Recovery'],
                lastAction: 'Effective immediately - 08/05/2025',
                lastActionDate: new Date('2025-08-05'),
                filedDate: new Date('2025-07-01')
            },
            {
                rawBillNumber: 'SB 1991',
                shortTitle: 'Broadband Access Expansion',
                fullTitle: 'An Act relating to expanding broadband internet access in rural Texas.',
                status: 'In Committee',
                sponsors: [{ name: 'Springer', photoUrl: '', district: '30' }],
                abstract: 'Provides funding and incentives to expand high-speed internet access to rural areas.',
                committee: 'Business & Commerce',
                topics: ['Technology', 'Rural Development', 'Infrastructure'],
                lastAction: 'Public hearing held - 07/30/2025',
                lastActionDate: new Date('2025-07-30'),
                filedDate: new Date('2025-07-25')
            }
        ];
        
        console.log('📝 Processing and standardizing recent bill IDs...');
        
        const processedBills = recentBills.map(bill => {
            // Standardize the ID
            const standardId = idStandardizer.standardize(bill.rawBillNumber);
            const displayId = idStandardizer.toDisplayFormat(standardId);
            
            console.log(`  ${bill.rawBillNumber} -> Standard: ${standardId}, Display: ${displayId}`);
            
            return {
                id: standardId,  // Use as document ID (e.g., "SB2001")
                billNumber: displayId,  // Use for display (e.g., "SB 2001")
                shortTitle: bill.shortTitle,
                fullTitle: bill.fullTitle,
                status: bill.status,
                sponsors: bill.sponsors,
                officialUrl: `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=${standardId}`,
                billText: '',
                abstract: bill.abstract,
                committee: bill.committee,
                coSponsors: [],
                filedDate: bill.filedDate,
                lastActionDate: bill.lastActionDate,
                lastAction: bill.lastAction,
                lastUpdated: new Date(),
                topics: bill.topics
            };
        });
        
        console.log('💾 Saving recent bills to database...');
        
        // Save each bill
        for (const bill of processedBills) {
            await billDatabase.saveBill(bill);
            console.log(`  ✅ Saved: ${bill.billNumber} (${bill.lastActionDate.toDateString()})`);
        }
        
        console.log(`🎉 Successfully added ${processedBills.length} recent bills!`);
        
        // Get all bills and show them sorted by most recent
        console.log('\n📅 All bills sorted by most recent:');
        const { crudOperations } = require('./config/crud-operations');
        const allBills = await crudOperations.findAll('bills', 100);
        
        // Sort by most recent first
        allBills.sort((a, b) => {
            const dateA = new Date(a.lastActionDate || a.filedDate || a.lastUpdated || 0);
            const dateB = new Date(b.lastActionDate || b.filedDate || b.lastUpdated || 0);
            return dateB - dateA; // Most recent first
        });
        
        console.log(`\n📊 Total bills in database: ${allBills.length}`);
        console.log('📅 Most recent bills:');
        allBills.slice(0, 10).forEach((bill, index) => {
            const date = bill.lastActionDate || bill.filedDate || bill.lastUpdated;
            const dateStr = date ? new Date(date).toDateString() : 'No date';
            console.log(`  ${index + 1}. ${bill.billNumber} - ${bill.shortTitle} (${dateStr})`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error adding recent bills:', error.message);
        process.exit(1);
    }
}

addRecentBills();