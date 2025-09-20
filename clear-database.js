// Script to clear the bills collection and trigger fresh scraping
const { databaseService } = require('./config/database');
const { crudOperations } = require('./config/crud-operations');

async function clearBillsCollection() {
    try {
        console.log('🗑️  Clearing bills collection...');
        
        // Connect to database
        await databaseService.connect();
        
        // Get all bills
        const bills = await crudOperations.findAll('bills', 1000);
        console.log(`Found ${bills.length} bills to delete`);
        
        // Delete all bills in batches
        const batchSize = 10;
        for (let i = 0; i < bills.length; i += batchSize) {
            const batch = bills.slice(i, i + batchSize);
            const deleteOperations = batch.map(bill => ({
                type: 'delete',
                collection: 'bills',
                docId: bill.id
            }));
            
            await crudOperations.batchWrite(deleteOperations);
            console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(bills.length/batchSize)}`);
        }
        
        console.log('✅ Bills collection cleared successfully');
        
        // Also clear summaries and news cache
        console.log('🗑️  Clearing summaries collection...');
        const summaries = await crudOperations.findAll('summaries', 1000);
        if (summaries.length > 0) {
            const summaryDeleteOps = summaries.map(summary => ({
                type: 'delete',
                collection: 'summaries',
                docId: summary.id
            }));
            await crudOperations.batchWrite(summaryDeleteOps);
            console.log(`✅ Deleted ${summaries.length} summaries`);
        }
        
        console.log('🗑️  Clearing news cache...');
        const newsCache = await crudOperations.findAll('news', 1000);
        if (newsCache.length > 0) {
            const newsDeleteOps = newsCache.map(news => ({
                type: 'delete',
                collection: 'news',
                docId: news.id
            }));
            await crudOperations.batchWrite(newsDeleteOps);
            console.log(`✅ Deleted ${newsCache.length} news cache entries`);
        }
        
        console.log('🎉 Database cleared successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error clearing database:', error.message);
        process.exit(1);
    }
}

clearBillsCollection();