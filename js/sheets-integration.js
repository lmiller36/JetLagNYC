/**
 * Google Sheets Integration for NYC Scavenger Hunt
 * Handles reading and writing game tracking data to Google Sheets
 */

// Your Google Sheet ID (extracted from the URL)
const SHEET_ID = '1RYK0ZPu1ac9xMiwMz-8DCX_loFWleObcN5O0HQzk7iM';

// Google Sheets API configuration
const CLIENT_ID = '176356314161-475e7q7todmkgrnq2ihks8c9sc9jmk4s.apps.googleusercontent.com'; // Replace with your OAuth 2.0 Client ID
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

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
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        console.log('Google API client initialized');
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
    const data = await readSheetData(`${teamName}!A2:F`);
    return data.map(row => ({
        challengeName: row[0] || '',
        location: row[1] || '',
        neighborhoodBonus: parseInt(row[2]) || 0,
        otherBonus: parseInt(row[3]) || 0,
        photoLinks: row[4] || '',
        notes: row[5] || ''
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
        challengeData.challengeName || '',
        challengeData.location || '',
        challengeData.neighborhoodBonus || 0,
        challengeData.otherBonus || 0,
        challengeData.photoLinks || '',
        challengeData.notes || ''
    ];

    await writeSheetData(`${teamName}!A${rowNumber}:F${rowNumber}`, [row]);
}

/**
 * Find and update a specific challenge by name
 * @param {string} teamName - Name of the team (sheet name)
 * @param {string} challengeName - Name of the challenge to find
 * @param {Object} updateData - Data to update (location, bonuses, photos, notes)
 * @returns {Promise<boolean>} True if found and updated, false otherwise
 */
async function updateChallengeByName(teamName, challengeName, updateData) {
    const challenges = await readSheetData(`${teamName}!A2:F`);

    for (let i = 0; i < challenges.length; i++) {
        if (challenges[i][0] === challengeName) {
            const rowNumber = i + 2; // +2 for header row and 0-indexing
            const row = [
                challengeName,
                updateData.location || challenges[i][1] || '',
                updateData.neighborhoodBonus !== undefined ? updateData.neighborhoodBonus : (challenges[i][2] || 0),
                updateData.otherBonus !== undefined ? updateData.otherBonus : (challenges[i][3] || 0),
                updateData.photoLinks || challenges[i][4] || '',
                updateData.notes || challenges[i][5] || ''
            ];

            await writeSheetData(`${teamName}!A${rowNumber}:F${rowNumber}`, [row]);
            return true;
        }
    }
    return false;
}

/**
 * Add photo links to a challenge
 * @param {string} teamName - Name of the team (sheet name)
 * @param {string} challengeName - Name of the challenge
 * @param {string} photoLink - Google Drive link to add (comma-separated if multiple)
 */
async function addPhotoToChallenge(teamName, challengeName, photoLink) {
    const challenges = await readSheetData(`${teamName}!A2:F`);

    for (let i = 0; i < challenges.length; i++) {
        if (challenges[i][0] === challengeName) {
            const rowNumber = i + 2;
            const existingPhotos = challenges[i][4] || '';
            const newPhotos = existingPhotos ? `${existingPhotos}, ${photoLink}` : photoLink;

            await writeSheetData(`${teamName}!E${rowNumber}`, [[newPhotos]]);
            return true;
        }
    }
    return false;
}

/**
 * Calculate total score for a team
 * @param {string} teamName - Name of the team (sheet name)
 * @returns {Promise<Object>} Score breakdown
 */
async function calculateTeamScore(teamName) {
    const challenges = await readSheetData(`${teamName}!A2:F`);

    let totalNeighborhoodBonus = 0;
    let totalOtherBonus = 0;
    let completedChallenges = 0;

    challenges.forEach(row => {
        const location = row[1] || '';
        const neighborhoodBonus = parseInt(row[2]) || 0;
        const otherBonus = parseInt(row[3]) || 0;

        if (location) { // Challenge is completed if location is filled
            completedChallenges++;
            totalNeighborhoodBonus += neighborhoodBonus;
            totalOtherBonus += otherBonus;
        }
    });

    return {
        teamName,
        completedChallenges,
        totalNeighborhoodBonus,
        totalOtherBonus,
        totalScore: totalNeighborhoodBonus + totalOtherBonus,
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
 * @param {Array} challengeList - Array of challenge names
 */
async function initializeTeamSheet(teamName, challengeList = []) {
    // Check if sheet exists, create if not
    const exists = await sheetExists(teamName);
    if (!exists) {
        await createSheet(teamName);
    }

    const header = [['Challenge Name', 'Location', 'Neighborhood Bonus', 'Other Bonus', 'Photo Links', 'Notes']];

    // Write header
    await writeSheetData(`${teamName}!A1:F1`, header);

    // Only write challenges if provided
    if (challengeList && challengeList.length > 0) {
        const rows = challengeList.map(challenge => [challenge, '', 0, 0, '', '']);
        await writeSheetData(`${teamName}!A2:F${rows.length + 1}`, rows);
    }
}

// Initialize when the page loads
window.addEventListener('load', () => {
    initializeGoogleAPI();
    initializeGIS();
});

// Export functions for use in other scripts
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
    addPhotoToChallenge,
    calculateTeamScore,
    initializeTeamSheet
};
