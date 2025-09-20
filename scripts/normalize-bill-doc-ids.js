// Migration helper: normalize existing bill document IDs to canonical form
// WARNING: This script will copy documents to new normalized IDs. It will NOT delete originals.
// Run locally with: node scripts/normalize-bill-doc-ids.js

require('dotenv').config();
const { databaseService } = require('../config/database');
const yargs = require('yargs');

function normalizeId(rawId) {
  if (!rawId) return null;
  return String(rawId).replace(/\s+/g, '').toUpperCase();
}

const argv = yargs(process.argv.slice(2))
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    default: true,
    description: 'Do not write any documents; just show what would be copied'
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Limit number of documents to process'
  })
  .help()
  .argv;

async function migrate() {
  try {
    console.log('🔎 Connecting to database...');
    await databaseService.connect();
    const db = databaseService.getDb();

    console.log('📦 Fetching bills...');
    const snapshot = await db.collection('bills').get();
    console.log(`Found ${snapshot.size} documents`);

    let copied = 0;
    const errors = [];
    const plan = [];

    const docs = snapshot.docs.slice(0, argv.limit || snapshot.docs.length);

    for (const doc of docs) {
      const data = doc.data();
      const currentId = doc.id;
      const canonical = normalizeId(currentId || data.billNumber || data.id);

      if (!canonical) {
        console.warn(`Skipping ${currentId} - cannot determine canonical id`);
        continue;
      }

      if (canonical === currentId) {
        // already normalized
        continue;
      }

      plan.push({ from: currentId, to: canonical });

      if (argv['dry-run']) {
        console.log(`[DRY-RUN] Would copy ${currentId} -> ${canonical}`);
        continue;
      }

      try {
        // Write to canonical id without deleting original
        await db.collection('bills').doc(canonical).set({
          id: canonical,
          ...data,
          migratedAt: new Date()
        });
        copied++;
        console.log(`✅ Copied ${currentId} -> ${canonical}`);
      } catch (err) {
        errors.push({ from: currentId, to: canonical, error: err.message });
        console.error(`❌ Failed to copy ${currentId} -> ${canonical}:`, err.message);
      }
    }

    console.log(`\nMigration plan items: ${plan.length}`);
    if (plan.length > 0) console.table(plan.slice(0, 50));

    if (!argv['dry-run']) {
      console.log(`Migration complete. Copied: ${copied}. Errors: ${errors.length}`);
      if (errors.length > 0) console.log('Errors:', errors);
    } else {
      console.log('\nDry-run complete. No documents were written.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
