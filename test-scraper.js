// Simple test scraper to validate ID standardization
require('dotenv').config();
const { billDatabase } = require('./config/bill-database');
const { databaseService } = require('./config/database');
const { idStandardizer } = require('./config/id-standardizer');

async function createTestBills() {
    try {
        console.log('🧪 Creating test bills with standardized IDs...');
        
        // Connect to database
        await databaseService.connect();
        
        // Create a few test bills with different ID formats to test standardization
        const testBills = [
            {
                rawBillNumber: 'SB 1',
                shortTitle: 'General Appropriations Bill',
                fullTitle: 'An Act making appropriations for the support of state government for the fiscal year ending August 31, 2024.',
                status: 'Passed',
                sponsors: [{ name: 'Huffman', photoUrl: '', district: '17' }],
                abstract: 'The general appropriations bill for fiscal year 2024.',
                billText: 'SECTION 1. GENERAL APPROPRIATIONS. The following sums of money are appropriated out of the General Revenue Fund of the State Treasury for the fiscal year beginning September 1, 2023, and ending August 31, 2024, for the support of state government: (a) For the Legislature: $150,000,000. (b) For the Judiciary: $800,000,000. (c) For Executive Departments: $45,000,000,000. SECTION 2. EFFECTIVE DATE. This Act takes effect September 1, 2023.',
                committee: 'Finance',
                topics: ['Budget', 'Appropriations'],
                lastAction: 'Signed by Governor - 06/15/2023',
                lastActionDate: new Date('2023-06-15'),
                filedDate: new Date('2023-01-10')
            },
            {
                rawBillNumber: 'SB 2',
                shortTitle: 'Education Savings Account Program',
                fullTitle: 'An Act relating to the establishment of an education savings account program.',
                status: 'Filed',
                sponsors: [{ name: 'Creighton', photoUrl: '', district: '4' }],
                abstract: 'Establishes an education savings account program for Texas students.',
                billText: 'SECTION 1. EDUCATION SAVINGS ACCOUNTS. (a) The Texas Education Agency shall establish an education savings account program to provide financial assistance to eligible students. (b) Eligible students include those from families with household income not exceeding 300% of the federal poverty level. (c) Each account may receive up to $8,000 annually for approved educational expenses including tuition, fees, textbooks, and educational materials. SECTION 2. FUNDING. The program shall be funded through state appropriations and may not exceed $500,000,000 annually.',
                committee: 'Education',
                topics: ['Education', 'School Choice'],
                lastAction: 'Filed - 01/15/2023',
                lastActionDate: new Date('2023-01-15'),
                filedDate: new Date('2023-01-15')
            },
            {
                rawBillNumber: 'HB 1',
                shortTitle: 'Public School Finance Reform',
                fullTitle: 'An Act relating to public school finance and taxation.',
                status: 'In Committee',
                sponsors: [{ name: 'Bonnen', photoUrl: '', district: '25' }],
                abstract: 'Reforms the public school finance system in Texas.',
                billText: 'SECTION 1. SCHOOL FINANCE REFORM. Chapter 42, Education Code, is amended to provide: (a) The basic allotment per student in average daily attendance is increased to $7,000. (b) The guaranteed yield per weighted student per cent of tax effort is increased to $6,500. (c) Additional funding is provided for students with disabilities, English language learners, and economically disadvantaged students. SECTION 2. PROPERTY TAX RELIEF. Local school district tax rates are compressed by 10 cents per $100 valuation, with the state providing replacement funding.',
                committee: 'Public Education',
                topics: ['Education', 'Finance', 'Taxation'],
                lastAction: 'Referred to Committee on Public Education - 02/01/2023',
                lastActionDate: new Date('2023-02-01'),
                filedDate: new Date('2023-01-20')
            },
            {
                rawBillNumber: 'SB 123',
                shortTitle: 'Healthcare Access Improvement',
                fullTitle: 'An Act relating to improving healthcare access in rural areas.',
                status: 'Filed',
                sponsors: [{ name: 'Nichols', photoUrl: '', district: '3' }],
                abstract: 'Improves healthcare access in underserved rural communities.',
                committee: 'Health & Human Services',
                topics: ['Healthcare', 'Rural Development']
            },
            {
                rawBillNumber: 'HB 42',
                shortTitle: 'Transportation Infrastructure',
                fullTitle: 'An Act relating to transportation infrastructure improvements.',
                status: 'In Committee',
                sponsors: [{ name: 'Canales', photoUrl: '', district: '40' }],
                abstract: 'Provides funding for critical transportation infrastructure projects.',
                committee: 'Transportation',
                topics: ['Transportation', 'Infrastructure']
            }
        ];
        
        console.log('📝 Processing and standardizing bill IDs...');
        
        const processedBills = testBills.map(bill => {
            // Standardize the ID
            const standardId = idStandardizer.standardize(bill.rawBillNumber);
            const displayId = idStandardizer.toDisplayFormat(standardId);
            
            console.log(`  ${bill.rawBillNumber} -> Standard: ${standardId}, Display: ${displayId}`);
            
            return {
                id: standardId,  // Use as document ID (e.g., "SB1")
                billNumber: displayId,  // Use for display (e.g., "SB 1")
                shortTitle: bill.shortTitle,
                fullTitle: bill.fullTitle,
                status: bill.status,
                sponsors: bill.sponsors,
                officialUrl: `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=${standardId}`,
                billText: '',
                abstract: bill.abstract,
                committee: bill.committee,
                coSponsors: [],
                filedDate: new Date('2023-01-10'),
                lastUpdated: new Date(),
                topics: bill.topics
            };
        });
        
        console.log('💾 Saving bills to database...');
        
        // Save each bill
        for (const bill of processedBills) {
            await billDatabase.saveBill(bill);
            console.log(`  ✅ Saved: ${bill.billNumber} (ID: ${bill.id})`);
        }
        
        console.log(`🎉 Successfully created ${processedBills.length} test bills!`);
        
        // Test retrieval
        console.log('\n🔍 Testing bill retrieval...');
        for (const bill of processedBills) {
            const retrieved = await billDatabase.getBill(bill.id);
            if (retrieved) {
                console.log(`  ✅ Retrieved: ${retrieved.billNumber} using ID: ${bill.id}`);
            } else {
                console.log(`  ❌ Failed to retrieve bill with ID: ${bill.id}`);
            }
        }
        
        // Test lookup variants
        console.log('\n🔍 Testing lookup variants...');
        const testLookups = ['SB 1', 'SB1', 'sb 1', 'HB 1', 'HB1', 'SB 123'];
        for (const lookup of testLookups) {
            const variants = idStandardizer.generateLookupVariants(lookup);
            console.log(`  ${lookup} -> variants: ${variants.join(', ')}`);
            
            let found = false;
            for (const variant of variants) {
                const bill = await billDatabase.getBill(variant);
                if (bill) {
                    console.log(`    ✅ Found using variant: ${variant} -> ${bill.billNumber}`);
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.log(`    ❌ Not found with any variant`);
            }
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error creating test bills:', error.message);
        process.exit(1);
    }
}

createTestBills();