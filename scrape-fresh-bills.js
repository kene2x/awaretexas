#!/usr/bin/env node

// Fresh bill scraping script - clears database and scrapes new bills
require('dotenv').config();
const { TexasLegislatureScraper } = require('./services/scraper');
const { databaseService } = require('./config/database');
const { billDatabase } = require('./config/bill-database');

async function scrapeFreshBills() {
    console.log('🚀 Starting fresh bill scraping process...');
    
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
            const batchSize = 10;
            let deletedCount = 0;
            
            for (let i = 0; i < existingBills.length; i += batchSize) {
                const batch = existingBills.slice(i, i + batchSize);
                const deleteOperations = batch.map(bill => ({
                    type: 'delete',
                    collection: 'bills',
                    docId: bill.id
                }));
                
                await crudOperations.batchWrite(deleteOperations);
                deletedCount += batch.length;
                console.log(`Deleted ${deletedCount}/${existingBills.length} bills...`);
            }
            
            console.log('✅ Successfully cleared existing bills');
        } catch (clearError) {
            console.warn('⚠️ Could not clear existing bills:', clearError.message);
            console.log('Continuing with scraping...');
        }
        
        // Initialize scraper
        console.log('🕷️ Initializing Texas Legislature scraper...');
        const scraper = new TexasLegislatureScraper();
        
        // Scrape fresh bills
        console.log('📥 Scraping bills from Texas Legislature Online...');
        const bills = await scraper.scrapeBills();
        
        if (!bills || bills.length === 0) {
            throw new Error('No bills were scraped from the website');
        }
        
        console.log(`✅ Successfully scraped ${bills.length} bills`);
        
        // Sort bills by most recent first
        console.log('📅 Sorting bills by most recent...');
        const sortedBills = bills.sort((a, b) => {
            // Sort by lastActionDate first, then filedDate, then lastUpdated
            const dateA = new Date(a.lastActionDate || a.filedDate || a.lastUpdated || 0);
            const dateB = new Date(b.lastActionDate || b.filedDate || b.lastUpdated || 0);
            return dateB - dateA; // Most recent first
        });
        
        console.log('✅ Bills sorted by most recent first');
        
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
        
        console.log('\n🎉 Fresh bill scraping completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during fresh bill scraping:', error.message);
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

// Run the script
if (require.main === module) {
    scrapeFreshBills().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = { scrapeFreshBills };