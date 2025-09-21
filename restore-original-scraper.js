#!/usr/bin/env node

// Restore original working scraper functionality
require('dotenv').config();
const { TexasLegislatureScraper } = require('./services/scraper');
const { databaseService } = require('./config/database');
const { billDatabase } = require('./config/bill-database');

async function restoreOriginalScraper() {
    console.log('🚀 Restoring original scraper functionality...');
    
    try {
        // Initialize database connection
        console.log('📡 Connecting to database...');
        await databaseService.connect();
        await databaseService.initializeCollections();
        console.log('✅ Database connected successfully');
        
        // Clear existing bills
        console.log('🗑️ Clearing existing bills...');
        try {
            const { crudOperations } = require('./config/crud-operations');
            
            // Get all bills first
            const existingBills = await crudOperations.findAll('bills', 1000);
            console.log(`Found ${existingBills.length} existing bills to clear`);
            
            // Delete in batches
            for (const bill of existingBills) {
                await crudOperations.delete('bills', bill.id);
            }
            
            console.log('✅ Successfully cleared existing bills');
        } catch (clearError) {
            console.warn('⚠️ Could not clear existing bills:', clearError.message);
            console.log('Continuing with scraping...');
        }
        
        // Initialize scraper with original functionality
        console.log('🕷️ Initializing Texas Legislature scraper...');
        const scraper = new TexasLegislatureScraper();
        
        // Use the original scraping method but limit to 50 bills
        console.log('📥 Scraping bills from Texas Legislature Online...');
        
        // Override the scraper to use a simpler approach that was working
        const bills = await scrapeDirectFromBillNumbers(scraper);
        
        if (!bills || bills.length === 0) {
            throw new Error('No bills were scraped from the website');
        }
        
        console.log(`✅ Successfully scraped ${bills.length} bills`);
        
        // Sort bills by most recent first and limit to 50
        console.log('📅 Sorting bills by most recent...');
        const sortedBills = bills.sort((a, b) => {
            const dateA = new Date(a.lastActionDate || a.filedDate || a.lastUpdated || 0);
            const dateB = new Date(b.lastActionDate || b.filedDate || b.lastUpdated || 0);
            return dateB - dateA; // Most recent first
        }).slice(0, 50);
        
        console.log(`✅ Limited to ${sortedBills.length} most recent bills`);
        
        // Save bills to database
        console.log('💾 Saving bills to database...');
        let savedCount = 0;
        let errorCount = 0;
        
        for (const bill of sortedBills) {
            try {
                await billDatabase.saveBill(bill);
                savedCount++;
                
                if (savedCount % 10 === 0) {
                    console.log(`Saved ${savedCount}/${sortedBills.length} bills...`);
                }
            } catch (saveError) {
                console.error(`Error saving bill ${bill.billNumber}:`, saveError.message);
                errorCount++;
            }
        }
        
        console.log(`✅ Successfully saved ${savedCount} bills to database`);
        if (errorCount > 0) {
            console.log(`⚠️ ${errorCount} bills failed to save`);
        }
        
        // Display summary
        console.log('\n📊 SCRAPING SUMMARY:');
        console.log(`Total bills scraped: ${bills.length}`);
        console.log(`Bills saved to database: ${savedCount}`);
        console.log(`Bills with errors: ${errorCount}`);
        
        if (sortedBills.length > 0) {
            const mostRecent = sortedBills[0];
            const oldestRecent = sortedBills[sortedBills.length - 1];
            
            console.log('\n📅 DATE RANGE:');
            console.log(`Most recent bill: ${mostRecent.billNumber} (${mostRecent.lastActionDate || mostRecent.filedDate || 'No date'})`);
            console.log(`Oldest bill: ${oldestRecent.billNumber} (${oldestRecent.lastActionDate || oldestRecent.filedDate || 'No date'})`);
        }
        
        console.log('\n🎉 Original scraper functionality restored successfully!');
        
    } catch (error) {
        console.error('❌ Error during scraping:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        try {
            await databaseService.disconnect();
            console.log('📡 Database connection closed');
        } catch (disconnectError) {
            console.warn('Warning: Could not close database connection:', disconnectError.message);
        }
        
        process.exit(0);
    }
}

// Direct scraping from bill numbers (original working approach)
async function scrapeDirectFromBillNumbers(scraper) {
    const axios = require('axios');
    const cheerio = require('cheerio');
    const { idStandardizer } = require('./config/id-standardizer');
    
    console.log('📋 Using direct bill number approach (original method)...');
    
    const bills = [];
    
    // Try to scrape bills SB1 through SB100 and take the first 50 that work
    for (let i = 1; i <= 100 && bills.length < 50; i++) {
        try {
            const billNumber = `SB${i}`;
            console.log(`🔍 Checking ${billNumber}...`);
            
            // Try to get bill details from the History page
            const historyUrl = `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=${billNumber}`;
            
            const response = await axios.get(historyUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (response.status === 200 && response.data) {
                const $ = cheerio.load(response.data);
                
                // Extract basic bill information
                const pageText = $('body').text();
                
                // Check if this is a valid bill page (not a "bill not found" page)
                if (pageText.includes('Bill not found') || pageText.includes('No bill found') || pageText.length < 500) {
                    continue;
                }
                
                // Extract bill title/caption
                let title = '';
                let abstract = '';
                
                // Look for Caption Text
                $('table tr').each((i, row) => {
                    const $row = $(row);
                    const rowText = $row.text();
                    if (rowText.toLowerCase().includes('caption')) {
                        const cells = $row.find('td');
                        if (cells.length >= 2) {
                            const captionText = cells.eq(1).text().trim();
                            if (captionText.length > 20) {
                                title = captionText;
                                abstract = captionText;
                            }
                        }
                    }
                });
                
                // Extract author/sponsor from the Author field
                let sponsor = '';
                
                // Look for the Author field in table rows
                $('table tr').each((i, row) => {
                    const $row = $(row);
                    const cells = $row.find('td');
                    if (cells.length >= 2) {
                        const labelText = cells.eq(0).text().trim();
                        if (labelText.toLowerCase() === 'author:') {
                            const authorText = cells.eq(1).text().trim();
                            // Skip if it's just "Co-author" or similar generic text
                            if (authorText && !authorText.toLowerCase().includes('co-author') && authorText.length > 2) {
                                // Take only the first author name (before any | or comma)
                                const primaryAuthor = authorText.split(/[|,]/)[0].trim();
                                if (primaryAuthor.length > 0) {
                                    sponsor = primaryAuthor;
                                }
                                return false; // Break out of loop
                            }
                        }
                    }
                });
                
                // Alternative approach: look for text patterns
                if (!sponsor) {
                    const pageText = $('body').text();
                    const authorMatch = pageText.match(/Author:\s*([A-Za-z]+)/);
                    if (authorMatch && authorMatch[1] && !authorMatch[1].toLowerCase().includes('co')) {
                        sponsor = authorMatch[1].trim();
                    }
                }
                
                // Extract last action
                let lastAction = 'Filed';
                let status = 'Filed';
                $('table tr').each((i, row) => {
                    const $row = $(row);
                    const rowText = $row.text();
                    if (rowText.toLowerCase().includes('last action')) {
                        const cells = $row.find('td');
                        if (cells.length >= 2) {
                            lastAction = cells.eq(1).text().trim();
                            // Determine status from last action
                            if (lastAction.toLowerCase().includes('passed')) {
                                status = 'Passed';
                            } else if (lastAction.toLowerCase().includes('committee')) {
                                status = 'In Committee';
                            } else if (lastAction.toLowerCase().includes('signed')) {
                                status = 'Signed';
                            }
                        }
                    }
                });
                
                if (title && title.length > 10) {
                    const standardizedBillNumber = idStandardizer.standardize(billNumber);
                    const displayBillNumber = idStandardizer.toDisplayFormat(standardizedBillNumber);
                    
                    const bill = {
                        id: standardizedBillNumber,
                        billNumber: displayBillNumber,
                        shortTitle: title.length > 100 ? title.substring(0, 100) + '...' : title,
                        fullTitle: title,
                        status: status,
                        sponsors: sponsor ? [{ name: sponsor, photoUrl: '', district: '' }] : [],
                        officialUrl: historyUrl,
                        billText: '', // Will be populated later if needed
                        abstract: abstract,
                        committee: '',
                        coSponsors: [],
                        filedDate: new Date(),
                        lastActionDate: new Date(),
                        lastAction: lastAction,
                        lastUpdated: new Date(),
                        topics: extractTopicsFromTitle(title)
                    };
                    
                    bills.push(bill);
                    console.log(`✅ Found ${displayBillNumber}: ${title.substring(0, 60)}...`);
                }
            }
        } catch (error) {
            // Skip bills that can't be fetched
            console.log(`⚠️ Could not fetch SB${i}: ${error.message}`);
        }
        
        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return bills;
}

function extractTopicsFromTitle(title) {
    if (!title) return ['General'];
    
    const topics = [];
    const titleLower = title.toLowerCase();
    
    const topicKeywords = {
        'Education': ['education', 'school', 'student', 'teacher', 'university', 'college'],
        'Healthcare': ['health', 'medical', 'hospital', 'medicare', 'medicaid', 'insurance'],
        'Transportation': ['transportation', 'highway', 'road', 'traffic', 'vehicle', 'motor'],
        'Environment': ['environment', 'water', 'air', 'pollution', 'conservation', 'energy'],
        'Criminal Justice': ['criminal', 'crime', 'police', 'court', 'prison', 'justice'],
        'Business': ['business', 'commerce', 'economic', 'tax', 'finance', 'employment'],
        'Government': ['government', 'public', 'administration', 'agency', 'department']
    };
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => titleLower.includes(keyword))) {
            topics.push(topic);
        }
    }
    
    return topics.length > 0 ? topics : ['General'];
}

// Run the script
if (require.main === module) {
    restoreOriginalScraper().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = { restoreOriginalScraper };