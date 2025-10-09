/**
 * ONE-TIME SCRIPT: Initialize Master Sheets with data
 *
 * To run this script:
 * 1. Open index.html in your browser
 * 2. Sign in with Google
 * 3. Open browser console (F12)
 * 4. Run: initializeMasterSheets()
 * 5. Wait for success messages
 *
 * After running successfully, remove this script from index.html!
 */

console.log('🔄 Loading init-master-sheets.js...');

async function initializeNeighborhoodsSheet() {
    console.log('📍 Starting neighborhoods sheet initialization...');

    // Neighborhood data with calculated points
    const neighborhoodsData = [
        { name: "Manhattan Below Central Park", points: 4 },
        { name: "Upper West Side", points: 8 },
        { name: "Upper East Side", points: 8 },
        { name: "Astoria", points: 12 },
        { name: "Flushing", points: 24 },
        { name: "DUMBO", points: 8 },
        { name: "Williamsburg", points: 8 },
        { name: "Coney Island", points: 20 },
        { name: "The Bronx", points: 32 },
        { name: "Staten Island", points: 40 }
    ];

    try {
        // Prepare the data rows
        const rows = neighborhoodsData.map(n => [n.name, n.points]);

        console.log('  Writing', rows.length, 'neighborhoods to sheet...');

        // Write to Neighborhoods sheet (assuming header already exists in A1:B1)
        await window.SheetsAPI.writeSheetData(`Neighborhoods!A2:B${rows.length + 1}`, rows);

        console.log('  ✅ Neighborhoods sheet initialized successfully!');
        console.log('  Data written to rows 2-' + (rows.length + 1));

        // Verify by reading back
        const verification = await window.SheetsAPI.readSheetData('Neighborhoods!A2:B');
        console.table(verification.map(row => ({ Location: row[0], Points: row[1] })));

        return true;

    } catch (err) {
        console.error('  ❌ Error initializing neighborhoods sheet:', err);
        throw err;
    }
}

async function initializeChallengesSheet() {
    console.log('🎯 Starting challenges sheet initialization...');

    try {
        // Collect all challenges from embedded data
        const allChallenges = [];

        // Add easy challenges
        if (window.CHALLENGES_EASY?.challenges) {
            allChallenges.push(...window.CHALLENGES_EASY.challenges);
        }

        // Add medium challenges
        if (window.CHALLENGES_MEDIUM?.challenges) {
            allChallenges.push(...window.CHALLENGES_MEDIUM.challenges);
        }

        // Add hard challenges
        if (window.CHALLENGES_HARD?.challenges) {
            allChallenges.push(...window.CHALLENGES_HARD.challenges);
        }

        // Add location-specific challenges
        if (window.CHALLENGES_LOCATION?.challenges) {
            allChallenges.push(...window.CHALLENGES_LOCATION.challenges);
        }

        console.log('  Found', allChallenges.length, 'total challenges');

        // Prepare rows: ID | Title | Description | Category | Base Points | Location Restriction
        const rows = allChallenges.map(c => [
            c.id || '',
            c.title || '',
            c.description || '',
            c.category || '',
            c.basePoints || 0,
            c.locationRestriction ? c.locationRestriction.value : ''
        ]);

        console.log('  Writing challenges to sheet...');

        // Write to Challenges sheet (assuming header already exists in A1:F1)
        await window.SheetsAPI.writeSheetData(`Challenges!A2:F${rows.length + 1}`, rows);

        console.log('  ✅ Challenges sheet initialized successfully!');
        console.log('  Data written to rows 2-' + (rows.length + 1));

        // Show summary by category
        const summary = allChallenges.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
        }, {});
        console.table(summary);

        return true;

    } catch (err) {
        console.error('  ❌ Error initializing challenges sheet:', err);
        throw err;
    }
}

async function initializeMasterSheets() {
    console.log('🚀 MASTER SHEETS INITIALIZATION');
    console.log('================================\n');

    // Check if user is authenticated
    if (!gapi?.client?.getToken()) {
        console.error('❌ NOT AUTHENTICATED!');
        console.error('Please sign in first, then run this command again.');
        return;
    }

    console.log('✅ Authenticated');

    try {
        // Initialize Neighborhoods
        await initializeNeighborhoodsSheet();
        console.log('');

        // Wait a bit between writes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Initialize Challenges
        await initializeChallengesSheet();
        console.log('');

        console.log('================================');
        console.log('🎉 ALL MASTER SHEETS INITIALIZED!');
        console.log('================================');
        console.log('\nNext steps:');
        console.log('1. Remove the init-master-sheets.js script tag from index.html');
        console.log('2. Verify data in your Google Sheet');
        console.log('3. Continue with app development!');

    } catch (err) {
        console.error('\n================================');
        console.error('❌ INITIALIZATION FAILED');
        console.error('================================');
        console.error('Error:', err);
        console.error('\nMake sure:');
        console.error('1. You are signed in');
        console.error('2. The "Neighborhoods" and "Challenges" sheet tabs exist');
        console.error('3. Row 1 has the correct headers in each sheet');
        console.error('   Neighborhoods: Location | Points');
        console.error('   Challenges: ID | Title | Description | Category | Base Points | Location Restriction');
    }
}

// Export to global scope immediately
if (typeof window !== 'undefined') {
    window.initializeMasterSheets = initializeMasterSheets;
    window.initializeNeighborhoodsSheet = initializeNeighborhoodsSheet;
    window.initializeChallengesSheet = initializeChallengesSheet;

    console.log('%c✅ Master sheets initialization script loaded!', 'color: green; font-weight: bold;');
    console.log('%cTo run: initializeMasterSheets()', 'color: blue; font-weight: bold;');
    console.log('Make sure you are signed in first!');
}
