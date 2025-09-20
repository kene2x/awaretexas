// Add realistic test bills directly to database for testing
require('dotenv').config();
const { databaseService } = require('../config/database');
const { billDatabase } = require('../config/bill-database');

async function addTestBills() {
  try {
    console.log('🔄 Adding test bills to database...');
    
    // Initialize database connection
    await databaseService.connect();
    await databaseService.initializeCollections();
    
    const testBills = [
      {
        id: 'sb1',
        billNumber: 'SB1',
        shortTitle: 'Education Funding Reform Act',
        fullTitle: 'An Act relating to public education funding, teacher salaries, and school infrastructure improvements',
        status: 'Filed',
        sponsors: [
          {
            name: 'Senator Jane Smith',
            district: '15',
            photoUrl: ''
          }
        ],
        topics: ['Education', 'Finance'],
        abstract: 'This comprehensive education bill provides $2.5 billion in additional funding for public schools, increases teacher salaries by 15%, and allocates resources for infrastructure improvements across Texas school districts.',
        billText: 'SECTION 1. This Act may be cited as the "Education Funding Reform Act". SECTION 2. The legislature finds that adequate funding for public education is essential for the economic development and general welfare of the state. SECTION 3. The following provisions shall take effect: (a) Increase base per-pupil funding by $1,000 annually; (b) Establish teacher salary minimum of $60,000; (c) Allocate $500 million for infrastructure improvements.',
        committee: 'Education Committee',
        coSponsors: ['Senator Bob Johnson', 'Senator Mary Williams'],
        filedDate: '2024-01-15T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1'
      },
      {
        id: 'sb2',
        billNumber: 'SB2',
        shortTitle: 'Healthcare Access Expansion',
        fullTitle: 'An Act relating to healthcare access, insurance reform, and rural healthcare initiatives',
        status: 'In Committee',
        sponsors: [
          {
            name: 'Senator Robert Johnson',
            district: '8',
            photoUrl: ''
          }
        ],
        topics: ['Healthcare', 'Insurance'],
        abstract: 'This bill expands healthcare access in rural areas, reforms insurance regulations, and establishes new community health centers to serve underserved populations.',
        billText: 'SECTION 1. This Act may be cited as the "Healthcare Access Expansion Act". SECTION 2. The legislature finds that healthcare access is a fundamental right of all Texas citizens. SECTION 3. The state shall establish: (a) Five new community health centers in rural counties; (b) Telemedicine programs for remote consultations; (c) Insurance reform measures to reduce costs.',
        committee: 'Health and Human Services Committee',
        coSponsors: ['Senator Lisa Davis'],
        filedDate: '2024-01-10T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB2'
      },
      {
        id: 'sb3',
        billNumber: 'SB3',
        shortTitle: 'Transportation Infrastructure Investment',
        fullTitle: 'An Act relating to highway construction, public transportation, and infrastructure maintenance',
        status: 'Passed',
        sponsors: [
          {
            name: 'Senator Maria Williams',
            district: '22',
            photoUrl: ''
          }
        ],
        topics: ['Transportation', 'Infrastructure'],
        abstract: 'This bill allocates $5 billion for highway construction and maintenance, expands public transportation options, and improves infrastructure across Texas.',
        billText: 'SECTION 1. This Act may be cited as the "Transportation Infrastructure Investment Act". SECTION 2. The legislature finds that modern infrastructure is vital to economic growth. SECTION 3. Funding allocation: (a) $3 billion for highway construction; (b) $1.5 billion for public transit; (c) $500 million for rural road improvements.',
        committee: 'Transportation Committee',
        coSponsors: ['Senator David Brown', 'Senator Sarah Wilson'],
        filedDate: '2024-01-05T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        officialUrl: 'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB3'
      }
    ];
    
    // Save test bills to database
    let savedCount = 0;
    for (const bill of testBills) {
      try {
        await billDatabase.saveBill(bill);
        savedCount++;
        console.log(`✅ Added: ${bill.billNumber} - ${bill.shortTitle}`);
      } catch (error) {
        console.error(`❌ Failed to add ${bill.billNumber}:`, error.message);
      }
    }
    
    console.log(`🎉 Successfully added ${savedCount} test bills to your database!`);
    console.log('🌐 Visit http://localhost:3000 to see them on your website!');
    console.log('🤖 You can now test AI summaries and news features!');
    
  } catch (error) {
    console.error('❌ Failed to add test bills:', error.message);
    
    if (error.message.includes('Firebase')) {
      console.log('💡 Check your Firebase credentials in the .env file');
    } else if (error.message.includes('permission')) {
      console.log('💡 Check your Firestore security rules');
    }
  }
  
  process.exit(0);
}

addTestBills();