#!/usr/bin/env node

/**
 * Generate Challenges Markdown
 * Creates a markdown file with all challenges and location bonus points from CSV files
 *
 * Usage: node scripts/generate-challenges-md.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHALLENGES_CSV = path.join(__dirname, '../data/challenges.csv');
const NEIGHBORHOODS_CSV = path.join(__dirname, '../data/neighborhoods.csv');
const OUTPUT_PATH = path.join(__dirname, '../CHALLENGES.md');

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) return [];

    // Parse header
    const headers = parseCSVLine(lines[0]);

    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        rows.push(row);
    }

    return rows;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

/**
 * Generate the markdown content
 */
function generateMarkdown() {
    console.log('Reading challenges from CSV...');
    const challengesData = parseCSV(CHALLENGES_CSV);

    console.log('Reading neighborhoods from CSV...');
    const neighborhoodsData = parseCSV(NEIGHBORHOODS_CSV);

    // Transform challenges data
    const challenges = challengesData.map(row => ({
        id: row.id || '',
        title: row.title || '',
        description: row.description || '',
        bonusDescription: row.bonusDescription || '',
        bonusPoints: row.bonusPoints || '',
        category: (row.category || 'easy').toLowerCase(),
        points: parseInt(row.points) || 0,
        locationRestriction: row.locationRestriction || ''
    }));

    // Separate location-based and non-location-based challenges
    const locationChallenges = challenges.filter(c => c.locationRestriction);
    const nonLocationChallenges = challenges.filter(c => !c.locationRestriction);

    // Sort by difficulty then points
    const sortChallenges = (a, b) => {
        const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3 };
        const diffA = difficultyOrder[a.category] || 4;
        const diffB = difficultyOrder[b.category] || 4;
        if (diffA !== diffB) return diffA - diffB;
        return a.points - b.points;
    };

    locationChallenges.sort(sortChallenges);
    nonLocationChallenges.sort(sortChallenges);

    // Transform neighborhoods data
    const neighborhoods = neighborhoodsData.map(row => ({
        name: row.name || '',
        borough: (row.borough || '').charAt(0).toUpperCase() + (row.borough || '').slice(1).toLowerCase(), // Capitalize first letter
        points: parseInt(row.points) || 0
    }));

    // Group neighborhoods by borough
    const boroughOrder = ['Manhattan', 'Queens', 'Brooklyn', 'Bronx', 'Staten Island'];
    const neighborhoodsByBorough = neighborhoods.reduce((acc, n) => {
        if (!acc[n.borough]) acc[n.borough] = [];
        acc[n.borough].push(n);
        return acc;
    }, {});

    // Generate markdown
    let markdown = `# NYC Scavenger Hunt - Challenges & Bonus Points

**Full rules and submission:** [https://lmiller36.github.io/JetLagNYC](https://lmiller36.github.io/JetLagNYC)

---

## Challenges

### General Challenges
These challenges can be completed anywhere in NYC (unless otherwise specified).

| Challenge | Description | Difficulty | Points | Bonus |
|-----------|-------------|------------|--------|-------|
`;

    // Add non-location challenges
    nonLocationChallenges.forEach(c => {
        const difficulty = c.category.charAt(0).toUpperCase() + c.category.slice(1);
        let bonus = 'None';
        if (c.bonusDescription) {
            const descriptions = c.bonusDescription.split(',').map(b => b.trim());
            const points = c.bonusPoints ? c.bonusPoints.split(',').map(p => p.trim()) : [];
            bonus = descriptions.map((desc, i) => {
                const pts = points[i] ? ` (+${points[i]} pts)` : '';
                return `${desc}${pts}`;
            }).join(', ');
        }
        markdown += `| ${c.title} | ${c.description} | ${difficulty} | ${c.points} | ${bonus} |\n`;
    });

    markdown += `\n### Location-Specific Challenges
These challenges must be completed in specific neighborhoods.

| Challenge | Description | Difficulty | Points | Location | Bonus |
|-----------|-------------|------------|--------|----------|-------|
`;

    // Add location challenges
    locationChallenges.forEach(c => {
        const difficulty = c.category.charAt(0).toUpperCase() + c.category.slice(1);
        const location = c.locationRestriction || 'Any';
        let bonus = 'None';
        if (c.bonusDescription) {
            const descriptions = c.bonusDescription.split(',').map(b => b.trim());
            const points = c.bonusPoints ? c.bonusPoints.split(',').map(p => p.trim()) : [];
            bonus = descriptions.map((desc, i) => {
                const pts = points[i] ? ` (+${points[i]} pts)` : '';
                return `${desc}${pts}`;
            }).join(', ');
        }
        markdown += `| ${c.title} | ${c.description} | ${difficulty} | ${c.points} | ${location} | ${bonus} |\n`;
    });

    markdown += `\n---

## Neighborhood Bonus Points

Visit neighborhoods to earn bonus points! You earn these points the **first time** you complete any challenge in that neighborhood.

`;

    // Add neighborhood tables by borough
    boroughOrder.forEach(borough => {
        if (neighborhoodsByBorough[borough] && neighborhoodsByBorough[borough].length > 0) {
            markdown += `\n### ${borough}\n\n`;
            markdown += `| Neighborhood | Bonus Points |\n`;
            markdown += `|--------------|-------------|\n`;

            neighborhoodsByBorough[borough].forEach(n => {
                markdown += `| ${n.name} | ${n.points === 0 ? 'No bonus' : n.points + ' pts'} |\n`;
            });
        }
    });

    markdown += `\n---

*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*
`;

    return markdown;
}

/**
 * Main function
 */
function main() {
    try {
        // Check if CSV files exist
        if (!fs.existsSync(CHALLENGES_CSV)) {
            console.error(`Error: challenges.csv not found at ${CHALLENGES_CSV}`);
            console.log('\nPlease export challenges.csv from the website first:');
            console.log('1. Go to the Challenges page');
            console.log('2. Click "Export CSV"');
            console.log('3. Save the file to data/challenges.csv');
            process.exit(1);
        }

        if (!fs.existsSync(NEIGHBORHOODS_CSV)) {
            console.error(`Error: neighborhoods.csv not found at ${NEIGHBORHOODS_CSV}`);
            console.log('\nPlease export neighborhoods.csv from the website first:');
            console.log('1. Go to the Neighborhoods page');
            console.log('2. Click "Export CSV"');
            console.log('3. Save the file to data/neighborhoods.csv');
            process.exit(1);
        }

        console.log('Generating markdown from CSV files...');
        const markdown = generateMarkdown();

        console.log('Writing to file...');
        fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8');

        console.log(`\n✅ Successfully generated ${OUTPUT_PATH}`);
        console.log(`Total file size: ${(markdown.length / 1024).toFixed(2)} KB`);
    } catch (error) {
        console.error('Error generating markdown:', error);
        process.exit(1);
    }
}

// Run the script
main();
