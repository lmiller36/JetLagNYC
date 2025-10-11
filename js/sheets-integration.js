/**
 * Google Sheets Integration for NYC Scavenger Hunt
 * Handles reading and writing game tracking data to Google Sheets
 */

// Your Google Sheet ID (extracted from the URL)
const SHEET_ID = '1RYK0ZPu1ac9xMiwMz-8DCX_loFWleObcN5O0HQzk7iM';

// Google Sheets API configuration
const CLIENT_ID = '176356314161-475e7q7todmkgrnq2ihks8c9sc9jmk4s.apps.googleusercontent.com'; // Replace with your OAuth 2.0 Client ID
// Using drive.file scope for security - only access files created by this app
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize the Google API client
 */
function initializeGoogleAPI() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Initialize GAPI client (without API key)
 */
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log('Google API client initialized (Sheets + Drive)');

        // Notify that GAPI is ready
        window.dispatchEvent(new CustomEvent('gapiInitComplete'));
    } catch (err) {
        console.error('Error initializing GAPI client:', err);
    }
}

/**
 * Initialize Google Identity Services
 */
function initializeGIS() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    console.log('Google Identity Services initialized');
}

/**
 * Handle authorization
 */
function handleAuthClick(callback) {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Authorization error:', resp);
            if (callback) callback(resp, true);
            throw (resp);
        }
        console.log('Authorization successful');

        // Notify that auth is complete
        window.dispatchEvent(new CustomEvent('sheetsAuthComplete'));

        if (callback) callback(resp, false);
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Sign out the user
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        console.log('User signed out');
    }
}

/**
 * Read data from a specific range in the sheet
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A1:D10')
 * @returns {Promise<Array>} The values from the sheet
 */
async function readSheetData(range) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: range,
        });
        return response.result.values || [];
    } catch (err) {
        console.error('Error reading sheet data:', err);
        throw err;
    }
}

/**
 * Write data to a specific range in the sheet
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A1')
 * @param {Array} values - 2D array of values to write
 * @returns {Promise<Object>} The API response
 */
async function writeSheetData(range, values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values
            }
        });
        return response.result;
    } catch (err) {
        console.error('Error writing sheet data:', err);
        throw err;
    }
}

/**
 * Append data to the sheet
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A:D')
 * @param {Array} values - 2D array of values to append
 * @returns {Promise<Object>} The API response
 */
async function appendSheetData(range, values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values
            }
        });
        return response.result;
    } catch (err) {
        console.error('Error appending sheet data:', err);
        throw err;
    }
}

/**
 * Get all challenges for a team
 * @param {string} teamName - Name of the team (sheet name)
 * @returns {Promise<Array>} Array of challenge objects
 */
async function getTeamChallenges(teamName) {
    const data = await readSheetData(`${teamName}!A2:G`);
    return data.map(row => ({
        challengeId: row[0] || '',
        challengeName: row[1] || '',
        basePoints: parseInt(row[2]) || 0,
        location: row[3] || '', // Comma-separated neighborhoods
        otherBonus: parseInt(row[4]) || 0,
        photoLinks: row[5] || '',
        notes: row[6] || ''
    }));
}

/**
 * Update a challenge for a team
 * @param {string} teamName - Name of the team (sheet name)
 * @param {number} rowNumber - Row number (2 = first data row)
 * @param {Object} challengeData - Challenge data to update
 */
async function updateTeamChallenge(teamName, rowNumber, challengeData) {
    const row = [
        challengeData.challengeId || '',
        challengeData.challengeName || '',
        challengeData.basePoints || 0,
        challengeData.location || '',
        challengeData.otherBonus || 0,
        challengeData.photoLinks || '',
        challengeData.notes || ''
    ];

    await writeSheetData(`${teamName}!A${rowNumber}:G${rowNumber}`, [row]);
}

/**
 * Find and update a specific challenge by name
 * @param {string} teamName - Name of the team (sheet name)
 * @param {string} challengeName - Name of the challenge to find
 * @param {Object} updateData - Data to update (location, bonuses, photos, notes)
 * @returns {Promise<boolean>} True if found and updated, false otherwise
 */
/**
 * Convert photo links to clickable format for Google Sheets
 * Just keep raw URLs - they become clickable automatically in Sheets
 */
function formatPhotoLinksForSheets(photoLinks) {
    return photoLinks || '';
}

async function updateChallengeByName(teamName, challengeName, updateData) {
    const challenges = await readSheetData(`${teamName}!A2:G`);

    for (let i = 0; i < challenges.length; i++) {
        if (challenges[i][1] === challengeName) { // challengeName is in column B (index 1)
            const rowNumber = i + 2; // +2 for header row and 0-indexing
            const row = [
                challenges[i][0] || '', // challengeId
                challengeName,
                challenges[i][2] || 0, // basePoints
                updateData.location !== undefined ? updateData.location : (challenges[i][3] || ''),
                updateData.otherBonus !== undefined ? updateData.otherBonus : (challenges[i][4] || 0),
                formatPhotoLinksForSheets(updateData.photoLinks) || challenges[i][5] || '',
                updateData.notes || challenges[i][6] || ''
            ];

            await writeSheetData(`${teamName}!A${rowNumber}:G${rowNumber}`, [row]);
            return true;
        }
    }
    return false;
}

/**
 * Add a new challenge to the team sheet
 * @param {string} teamName - Name of the team (sheet name)
 * @param {Object} challengeData - Challenge data including id, title, basePoints
 * @returns {Promise<boolean>} True if added successfully
 */
async function addChallengeToTeam(teamName, challengeData) {
    try {
        const row = [
            challengeData.id || '',
            challengeData.title || challengeData.name || '',
            challengeData.basePoints || 0,
            challengeData.location || '',
            challengeData.otherBonus || 0,
            challengeData.photoLinks || '',
            challengeData.notes || ''
        ];

        await appendSheetData(`${teamName}!A:G`, [row]);
        return true;
    } catch (err) {
        console.error('Error adding challenge to team:', err);
        return false;
    }
}

/**
 * Update or add a challenge by name
 * @param {string} teamName - Name of the team (sheet name)
 * @param {string} challengeName - Name of the challenge to find
 * @param {Object} updateData - Data to update (location, bonuses, photos, notes)
 * @param {Object} challengeFullData - Full challenge data (id, title, basePoints) for adding if not found
 * @returns {Promise<boolean>} True if found/added and updated, false otherwise
 */
async function updateOrAddChallengeByName(teamName, challengeName, updateData, challengeFullData = null) {
    // Try to update existing challenge
    const updated = await updateChallengeByName(teamName, challengeName, updateData);

    if (!updated && challengeFullData) {
        // Challenge not found, add it
        const added = await addChallengeToTeam(teamName, {
            ...challengeFullData,
            ...updateData
        });
        return added;
    }

    return updated;
}

/**
 * Add photo links to a challenge
 * @param {string} teamName - Name of the team (sheet name)
 * @param {string} challengeName - Name of the challenge
 * @param {string} photoLink - Google Drive link to add (comma-separated if multiple)
 */
async function addPhotoToChallenge(teamName, challengeName, photoLink) {
    const challenges = await readSheetData(`${teamName}!A2:H`);

    for (let i = 0; i < challenges.length; i++) {
        if (challenges[i][1] === challengeName) { // challengeName is now in column B (index 1)
            const rowNumber = i + 2;
            const existingPhotos = challenges[i][6] || ''; // photoLinks is now in column G (index 6)
            const newPhotos = existingPhotos ? `${existingPhotos}, ${photoLink}` : photoLink;

            await writeSheetData(`${teamName}!G${rowNumber}`, [[newPhotos]]);
            return true;
        }
    }
    return false;
}

/**
 * Calculate total score for a team (with on-the-fly neighborhood bonus calculation)
 * @param {string} teamName - Name of the team (sheet name)
 * @returns {Promise<Object>} Score breakdown
 */
async function calculateTeamScore(teamName) {
    const challenges = await readSheetData(`${teamName}!A2:G`);

    // Get neighborhood points mapping
    const neighborhoodsData = await readSheetData('Neighborhoods!A2:C');
    const neighborhoodsMap = neighborhoodsData.reduce((acc, row) => {
        acc[row[0]] = parseInt(row[2]) || 0;
        return acc;
    }, {});

    let totalBasePoints = 0;
    let totalNeighborhoodBonus = 0;
    let totalOtherBonus = 0;
    let completedChallenges = 0;

    // Track visited neighborhoods as we iterate (in order)
    const visitedNeighborhoods = new Set();

    challenges.forEach(row => {
        const challengeId = row[0] || '';
        const basePoints = parseInt(row[2]) || 0;
        const location = row[3] || '';
        const otherBonus = parseInt(row[4]) || 0;

        // Challenge is completed if it exists in the sheet (has a challengeId)
        if (challengeId) {
            completedChallenges++;
            totalBasePoints += basePoints;
            totalOtherBonus += otherBonus;

            // Calculate neighborhood bonus on-the-fly
            if (location) {
                const neighborhoods = location.split(',').map(n => n.trim()).filter(n => n);
                neighborhoods.forEach(name => {
                    if (!visitedNeighborhoods.has(name) && neighborhoodsMap[name]) {
                        totalNeighborhoodBonus += neighborhoodsMap[name];
                        visitedNeighborhoods.add(name);
                    }
                });
            }
        }
    });

    return {
        teamName,
        completedChallenges,
        totalBasePoints,
        totalNeighborhoodBonus,
        totalOtherBonus,
        totalScore: totalBasePoints + totalNeighborhoodBonus + totalOtherBonus,
        totalChallenges: challenges.length
    };
}

/**
 * Create a new sheet tab
 * @param {string} sheetName - Name of the sheet to create
 */
async function createSheet(sheetName) {
    try {
        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetName
                        }
                    }
                }]
            }
        });
        return response.result;
    } catch (err) {
        console.error('Error creating sheet:', err);
        throw err;
    }
}

/**
 * Check if a sheet exists
 * @param {string} sheetName - Name of the sheet to check
 * @returns {Promise<boolean>} True if sheet exists
 */
async function sheetExists(sheetName) {
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID
        });
        const sheets = response.result.sheets || [];
        return sheets.some(sheet => sheet.properties.title === sheetName);
    } catch (err) {
        console.error('Error checking sheet existence:', err);
        return false;
    }
}

/**
 * Initialize a team sheet with all challenges
 * @param {string} teamName - Name of the team (sheet name)
 * @param {Array} challengeList - Array of challenge objects with id, title, and basePoints
 */
async function initializeTeamSheet(teamName, challengeList = []) {
    // Check if sheet exists, create if not
    const exists = await sheetExists(teamName);
    if (!exists) {
        await createSheet(teamName);
    }

    const header = [['Challenge ID', 'Challenge Name', 'Base Points', 'Location', 'Other Bonus', 'Photo Links', 'Notes']];

    // Write header
    await writeSheetData(`${teamName}!A1:G1`, header);

    // Only write challenges if provided
    if (challengeList && challengeList.length > 0) {
        const rows = challengeList.map(challenge => [
            challenge.id || '',
            challenge.title || challenge.name || challenge,
            challenge.basePoints || 0,
            '', // location
            0,  // other bonus
            '', // photo links
            ''  // notes
        ]);
        await writeSheetData(`${teamName}!A2:G${rows.length + 1}`, rows);
    }
}

/**
 * Get all team sheets and their scores
 * @returns {Promise<Array>} Array of team score objects
 */
async function getAllTeamScores() {
    try {
        // Get all sheets in the spreadsheet
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID
        });
        
        const sheets = response.result.sheets || [];
        const teamScores = [];
        
        // Filter out system sheets (Neighborhoods, etc.) and calculate scores for team sheets
        for (const sheet of sheets) {
            const sheetName = sheet.properties.title;
            
            // Skip system sheets
            if (sheetName === 'Neighborhoods' || sheetName === 'Challenges' || sheetName === 'Master' || sheetName.startsWith('_')) {
                continue;
            }
            
            try {
                const score = await calculateTeamScore(sheetName);
                teamScores.push(score);
            } catch (err) {
                console.warn(`Could not calculate score for team ${sheetName}:`, err);
                // Add team with zero score if calculation fails
                teamScores.push({
                    teamName: sheetName,
                    completedChallenges: 0,
                    totalBasePoints: 0,
                    totalNeighborhoodBonus: 0,
                    totalOtherBonus: 0,
                    totalScore: 0,
                    totalChallenges: 0
                });
            }
        }
        
        // Sort by total score descending
        teamScores.sort((a, b) => b.totalScore - a.totalScore);
        
        return teamScores;
    } catch (err) {
        console.error('Error getting all team scores:', err);
        throw err;
    }
}

/**
 * Get detailed team data including all completed challenges
 * @param {string} teamName - Name of the team
 * @returns {Promise<Object>} Team details with challenges and score
 */
async function getTeamDetails(teamName) {
    try {
        const [challenges, score] = await Promise.all([
            getTeamChallenges(teamName),
            calculateTeamScore(teamName)
        ]);
        
        // Filter only completed challenges (those with challengeId)
        const completedChallenges = challenges.filter(challenge => challenge.challengeId);
        
        return {
            ...score,
            challenges: completedChallenges
        };
    } catch (err) {
        console.error(`Error getting team details for ${teamName}:`, err);
        throw err;
    }
}


// Export functions for use in other scripts (export immediately, not in load event)
window.SheetsAPI = {
    handleAuthClick,
    handleSignoutClick,
    readSheetData,
    writeSheetData,
    appendSheetData,
    createSheet,
    sheetExists,
    getTeamChallenges,
    updateTeamChallenge,
    updateChallengeByName,
    updateOrAddChallengeByName,
    addChallengeToTeam,
    addPhotoToChallenge,
    calculateTeamScore,
    initializeTeamSheet,
    getAllTeamScores,
    getTeamDetails
};

// Initialize when the page loads
window.addEventListener('load', () => {
    initializeGoogleAPI();
    initializeGIS();
});
