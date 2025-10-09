/**
 * Team management functionality
 */

/**
 * Load all challenges from embedded data files
 */
function loadAllChallenges() {
    const allChallenges = [];
    
    // Load from embedded challenge data
    if (window.CHALLENGES_EASY?.challenges) {
        allChallenges.push(...window.CHALLENGES_EASY.challenges);
    }
    if (window.CHALLENGES_MEDIUM?.challenges) {
        allChallenges.push(...window.CHALLENGES_MEDIUM.challenges);
    }
    if (window.CHALLENGES_HARD?.challenges) {
        allChallenges.push(...window.CHALLENGES_HARD.challenges);
    }
    if (window.CHALLENGES_LOCATION?.challenges) {
        allChallenges.push(...window.CHALLENGES_LOCATION.challenges);
    }
    
    return allChallenges;
}

let currentTeam = null;
let scoreLoaded = false;
let challengesLoaded = false;

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped HTML string
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Initialize team page
 */
function initTeamPage() {
    console.log('Initializing team page...');
    
    const signInBtn = document.getElementById('signInBtn');
    const joinTeamBtn = document.getElementById('joinTeamBtn');
    const createTeamBtn = document.getElementById('createTeamBtn');
    const leaveTeamBtn = document.getElementById('leaveTeamBtn');
    const refreshScoreBtn = document.getElementById('refreshScoreBtn');

    console.log('Sign in button found:', !!signInBtn);
    
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            console.log('Sign in button clicked');
            window.Auth.signIn();
        });
    }
    if (joinTeamBtn) joinTeamBtn.addEventListener('click', joinTeam);
    if (createTeamBtn) createTeamBtn.addEventListener('click', createTeam);
    if (leaveTeamBtn) leaveTeamBtn.addEventListener('click', leaveTeam);
    if (refreshScoreBtn) refreshScoreBtn.addEventListener('click', () => {
        // Reset loaded flag to force reload
        scoreLoaded = false;
        challengesLoaded = false;
        loadTeamScore();
        loadTeamChallenges();
        window.toast?.success('Refreshing data from sheets...');
    });

    // Listen for auth events
    window.addEventListener('userSignedIn', handleSignIn);
    window.addEventListener('userSignedOut', handleSignOut);

    // Load saved team from localStorage on page load
    loadSavedTeam();
    
    // Check initial state and update UI
    checkInitialState();
}

/**
 * Check initial state with retry logic for API initialization
 */
function checkInitialState() {
    // Initial update - just update UI, don't load data yet
    updateTeamUI();

    // Wait a bit for API to initialize, then load data once
    setTimeout(() => {
        // Only update UI state, loadTeamScore/loadTeamChallenges have their own retry logic
        const hasToken = typeof gapi !== 'undefined' && gapi?.client?.getToken() !== null;
        const hasUser = window.Auth && window.Auth.isSignedIn();

        // Update UI one more time after API loads
        if (hasToken || hasUser) {
            updateTeamUI();
        }
    }, 1000);
}

/**
 * Handle user sign in
 */
function handleSignIn() {
    updateTeamUI();
    loadSavedTeam();
    ensureTeamFolderExists();
}

/**
 * Handle user sign out
 */
function handleSignOut() {
    currentTeam = null;
    scoreLoaded = false;
    challengesLoaded = false;
    updateTeamUI();
}

/**
 * Update UI based on auth and team state
 */
function updateTeamUI() {
    const notLoggedIn = document.getElementById('notLoggedIn');
    const teamManagement = document.getElementById('teamManagement');
    const noTeam = document.getElementById('noTeam');
    const hasTeam = document.getElementById('hasTeam');

    // Check if we have both user info AND a valid token
    const hasToken = typeof gapi !== 'undefined' && gapi?.client?.getToken() !== null;
    const hasUser = window.Auth && window.Auth.isSignedIn();
    const isSignedIn = hasUser && hasToken;

    console.log('updateTeamUI - hasUser:', hasUser, 'hasToken:', hasToken, 'currentTeam:', currentTeam);

    if (!isSignedIn) {
        notLoggedIn.style.display = 'block';
        teamManagement.style.display = 'none';
        
        // Update message if user info exists but token is missing
        if (hasUser && !hasToken) {
            const authPrompt = notLoggedIn.querySelector('h3');
            if (authPrompt) {
                authPrompt.textContent = 'Your session expired. Please sign in again.';
            }
        }
    } else {
        notLoggedIn.style.display = 'none';
        teamManagement.style.display = 'block';

        if (currentTeam) {
            noTeam.style.display = 'none';
            hasTeam.style.display = 'block';
            const teamNameElement = document.getElementById('currentTeamName');
            if (teamNameElement) {
                teamNameElement.textContent = currentTeam;
            }

            // Only load score/challenges if we have a token and haven't loaded yet
            if (hasToken) {
                if (!scoreLoaded) {
                    loadTeamScore();
                }
                if (!challengesLoaded) {
                    loadTeamChallenges();
                }
            }
        } else {
            noTeam.style.display = 'block';
            hasTeam.style.display = 'none';
        }
    }
}

/**
 * Load saved team from localStorage
 */
function loadSavedTeam() {
    const savedTeam = localStorage.getItem('scavenger_team');
    console.log('Loading saved team from localStorage:', savedTeam);
    if (savedTeam) {
        currentTeam = savedTeam;
        console.log('Set currentTeam to:', currentTeam);
        // Don't call updateTeamUI here - let checkInitialState handle it
        // This prevents double-loading
        
        // Notify other components that team is loaded (for navigation bar)
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName: savedTeam } }));
        
        // Ensure Drive folder exists for this team
        ensureTeamFolderExists();
    }
}

/**
 * Ensure Google Drive folder exists for current team
 * @param {number} retryCount - Number of retries attempted
 */
async function ensureTeamFolderExists(retryCount = 0) {
    const maxRetries = 5;
    
    if (!currentTeam) return;
    
    // Check if driveManager is available
    if (!window.driveManager) {
        console.log('DriveManager not available yet');
        return;
    }
    
    // Check if Google API is loaded
    if (typeof gapi === 'undefined' || !gapi.client) {
        if (retryCount < maxRetries) {
            console.log(`Google API not loaded yet, retry ${retryCount + 1}/${maxRetries}...`);
            setTimeout(() => ensureTeamFolderExists(retryCount + 1), 1000 * (retryCount + 1));
        }
        return;
    }
    
    // Check if user has a token (same check as sheets integration)
    const token = gapi.client.getToken();
    if (!token) {
        console.log('User not signed in, skipping folder check');
        return;
    }
    
    try {
        console.log(`Ensuring Drive folder exists for team: ${currentTeam}`);
        const folderId = await window.driveManager.ensureTeamFolder(currentTeam);
        console.log(`Team folder ready: ${folderId}`);
    } catch (error) {
        console.error('Error ensuring team folder exists:', error);
        // If it's an auth error and we haven't retried too many times, try again
        if (error.message.includes('not loaded') && retryCount < maxRetries) {
            console.log(`Retrying due to API error, attempt ${retryCount + 1}/${maxRetries}...`);
            setTimeout(() => ensureTeamFolderExists(retryCount + 1), 1000 * (retryCount + 1));
        }
        // Don't show alert, just log - this is a background operation
    }
}

/**
 * Join existing team
 */
async function joinTeam() {
    const teamName = document.getElementById('joinTeamName').value.trim();
    if (!teamName) {
        window.toast.warning('Please enter a team name');
        return;
    }

    try {
        // Check if team exists
        const exists = await window.SheetsAPI.sheetExists(teamName);
        if (!exists) {
            window.toast.error(`Team "${teamName}" does not exist. Please check the spelling or create a new team.`);
            return;
        }

        currentTeam = teamName;
        scoreLoaded = false;
        challengesLoaded = false;
        localStorage.setItem('scavenger_team', teamName);
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));

        // Ensure Drive folder exists for joined team
        ensureTeamFolderExists();

        window.toast.success(`Successfully joined team "${teamName}"!`);
    } catch (err) {
        window.toast.error('Error joining team: ' + err.message);
        console.error(err);
    }
}

/**
 * Create new team
 */
async function createTeam() {
    const teamName = document.getElementById('createTeamName').value.trim();
    if (!teamName) {
        window.toast.warning('Please enter a team name');
        return;
    }

    // Check if authenticated
    const token = gapi.client.getToken();
    if (!token) {
        window.toast.error('Please sign in with Google first before creating a team.');
        return;
    }

    try {
        console.log('Checking if team exists:', teamName);

        // Check if team already exists
        const exists = await window.SheetsAPI.sheetExists(teamName);
        console.log('Team exists?', exists);

        if (exists) {
            const confirmJoin = await window.toast.confirm(
                `Team "${teamName}" already exists. Would you like to join it instead?`,
                { confirmText: 'Join Team', cancelText: 'Cancel' }
            );
            if (confirmJoin) {
                currentTeam = teamName;
                localStorage.setItem('scavenger_team', teamName);
                updateTeamUI();
                window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));
                window.toast.success(`Successfully joined team "${teamName}"!`);
            }
            return;
        }

        console.log('Creating new team sheet...');
        // Create an empty team sheet (challenges will be added as they're completed)
        await window.SheetsAPI.initializeTeamSheet(teamName, []);

        // Create Google Drive folder for team
        console.log('Creating Google Drive folder for team...');
        try {
            const folderId = await window.driveManager.createTeamFolder(teamName);
            console.log('Team folder created:', folderId);
            // Store folder ID in localStorage for future reference
            localStorage.setItem(`team_folder_${teamName}`, folderId);
        } catch (driveError) {
            console.error('Error creating Drive folder:', driveError);
            // Don't fail team creation if Drive folder fails
            window.toast.warning(`Team created successfully, but there was an issue creating the Google Drive folder: ${driveError.message}`, 7000);
        }

        currentTeam = teamName;
        scoreLoaded = false;
        challengesLoaded = false;
        localStorage.setItem('scavenger_team', teamName);
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));
        window.toast.success(`Successfully created team "${teamName}"!`);
    } catch (err) {
        window.toast.error('Error creating team: ' + err.message);
        console.error('Full error:', err);
    }
}

/**
 * Leave current team
 */
async function leaveTeam() {
    const confirmed = await window.toast.confirm(
        'Are you sure you want to leave this team?',
        { confirmText: 'Leave Team', cancelText: 'Cancel', danger: true }
    );

    if (confirmed) {
        currentTeam = null;
        scoreLoaded = false;
        challengesLoaded = false;
        localStorage.removeItem('scavenger_team');
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName: null } }));
        window.toast.info('You have left the team');
    }
}

/**
 * Load and display team score
 */
async function loadTeamScore(retryCount = 0) {
    if (!currentTeam) return;

    const scoreDisplay = document.getElementById('scoreDisplay');

    // Show loading state
    if (retryCount === 0) {
        scoreDisplay.innerHTML = `
            <div class="score-loading">
                <div class="loading-spinner"></div>
                <p>Loading score...</p>
            </div>
        `;
    }

    // Check if API is ready
    if (!window.SheetsAPI || !window.SheetsAPI.calculateTeamScore) {
        if (retryCount < 5) {
            // Retry after delay (max 5 attempts)
            setTimeout(() => loadTeamScore(retryCount + 1), 1000);
        } else {
            scoreDisplay.innerHTML = `
                <div class="score-error">
                    <p>⚠️ API not ready</p>
                    <button onclick="window.Team.loadTeamScore()" class="btn btn-secondary">Try Again</button>
                </div>
            `;
        }
        return;
    }

    // Check if user is authenticated
    const token = typeof gapi !== 'undefined' && gapi.client ? gapi.client.getToken() : null;
    if (!token) {
        if (retryCount < 5) {
            // Retry after delay in case token is still loading
            setTimeout(() => loadTeamScore(retryCount + 1), 1000);
        } else {
            scoreDisplay.innerHTML = `
                <div class="score-loading">
                    <p>Please sign in to view your score</p>
                </div>
            `;
        }
        return;
    }

    try {
        const score = await window.SheetsAPI.calculateTeamScore(currentTeam);

        scoreDisplay.innerHTML = `
            <div class="score-item">
                <span class="score-label">Completed Challenges:</span>
                <span class="score-value">${score.completedChallenges} / ${score.totalChallenges}</span>
            </div>
            <div class="score-item">
                <span class="score-label">Base Points:</span>
                <span class="score-value">${score.totalBasePoints} pts</span>
            </div>
            <div class="score-item">
                <span class="score-label">Neighborhood Bonus:</span>
                <span class="score-value">${score.totalNeighborhoodBonus} pts</span>
            </div>
            <div class="score-item">
                <span class="score-label">Other Bonus:</span>
                <span class="score-value">${score.totalOtherBonus} pts</span>
            </div>
            <div class="total-score">${score.totalScore} Total Points</div>
        `;

        // Mark as loaded
        scoreLoaded = true;
    } catch (err) {
        console.error('Error loading score:', err);
        scoreDisplay.innerHTML = `
            <div class="score-error">
                <p>⚠️ Could not load score</p>
                <p class="error-detail">${err.message}</p>
                <button onclick="window.Team.loadTeamScore()" class="btn btn-secondary">Try Again</button>
            </div>
        `;
    }
}

/**
 * Load neighborhoods data from master sheet
 */
async function loadNeighborhoodsData() {
    try {
        const data = await window.SheetsAPI.readSheetData('Neighborhoods!A2:C');
        return data.map(row => ({
            name: row[0] || '',
            borough: row[1] || '',
            points: parseInt(row[2]) || 0
        }));
    } catch (err) {
        console.error('Error loading neighborhoods data:', err);
        return [];
    }
}

/**
 * Calculate which neighborhoods contributed bonus for a specific challenge
 * Based on the order of challenges in the sheet (first occurrence gets bonus)
 * @param {Array} allChallenges - All challenges from sheet in order
 * @param {number} currentIndex - Index of current challenge
 * @param {Array} neighborhoods - Array of neighborhood names for this challenge
 * @param {Object} neighborhoodsMap - Map of neighborhood name to points
 * @returns {Array} Array of {name, points} for neighborhoods that contributed bonus
 */
function calculateNeighborhoodBonusBreakdown(allChallenges, currentIndex, neighborhoods, neighborhoodsMap) {
    if (!neighborhoods || neighborhoods.length === 0) return [];

    // Track which neighborhoods appeared in challenges BEFORE this one
    const visitedBefore = new Set();
    for (let i = 0; i < currentIndex; i++) {
        const challenge = allChallenges[i];
        if (challenge.location) {
            const prevNeighborhoods = challenge.location.split(',').map(n => n.trim()).filter(n => n);
            prevNeighborhoods.forEach(n => visitedBefore.add(n));
        }
    }

    // Return only neighborhoods that were NOT visited before (first-time visits)
    return neighborhoods
        .filter(name => !visitedBefore.has(name) && neighborhoodsMap[name])
        .map(name => ({
            name: name,
            points: neighborhoodsMap[name]
        }));
}

/**
 * Load and display team challenges
 */
async function loadTeamChallenges(retryCount = 0) {
    if (!currentTeam) return;

    const progressDiv = document.getElementById('challengeProgress');

    // Show loading state
    if (retryCount === 0) {
        progressDiv.innerHTML = `
            <div class="score-loading">
                <div class="loading-spinner"></div>
                <p>Loading challenges...</p>
            </div>
        `;
    }

    // Check if API is ready
    if (!window.SheetsAPI || !window.SheetsAPI.getTeamChallenges) {
        if (retryCount < 5) {
            setTimeout(() => loadTeamChallenges(retryCount + 1), 1000);
        } else {
            progressDiv.innerHTML = `
                <div class="score-error">
                    <p>⚠️ API not ready</p>
                </div>
            `;
        }
        return;
    }

    // Check if user is authenticated
    const token = typeof gapi !== 'undefined' && gapi.client ? gapi.client.getToken() : null;
    if (!token) {
        if (retryCount < 5) {
            setTimeout(() => loadTeamChallenges(retryCount + 1), 1000);
        } else {
            progressDiv.innerHTML = `
                <div class="score-loading">
                    <p>Please sign in to view challenges</p>
                </div>
            `;
        }
        return;
    }

    try {
        // Load neighborhoods data and challenges in parallel
        const [neighborhoodsData, challenges] = await Promise.all([
            loadNeighborhoodsData(),
            window.SheetsAPI.getTeamChallenges(currentTeam)
        ]);

        if (challenges.length === 0) {
            progressDiv.innerHTML = '<div class="score-loading"><p>No challenges yet. Complete some challenges to see them here!</p></div>';
            return;
        }

        // Create neighborhoods map for quick lookup
        const neighborhoodsMap = neighborhoodsData.reduce((acc, n) => {
            acc[n.name] = n.points;
            return acc;
        }, {});

        // Process all challenges and calculate bonuses synchronously (based on order)
        const challengeHTMLArray = challenges.map((challenge, index) => {
            const isCompleted = challenge.challengeId !== '';

            // Parse neighborhoods if present
            const neighborhoods = challenge.location ? challenge.location.split(',').map(n => n.trim()).filter(n => n) : [];

            // Calculate neighborhood bonus breakdown based on challenges that came before
            const neighborhoodBonusBreakdown = calculateNeighborhoodBonusBreakdown(
                challenges,
                index,
                neighborhoods,
                neighborhoodsMap
            );

            // Calculate total neighborhood bonus
            const neighborhoodBonus = neighborhoodBonusBreakdown.reduce((sum, n) => sum + n.points, 0);
            const hasNeighborhoodBonus = neighborhoodBonus > 0 && neighborhoods.length > 0;

            // Calculate total points
            const totalPoints = challenge.basePoints + neighborhoodBonus + challenge.otherBonus;

            // Build expandable details HTML
            let detailsHTML = '';
            if (isCompleted && (hasNeighborhoodBonus || challenge.otherBonus > 0)) {
                detailsHTML = `
                    <div class="challenge-details" id="details-${index}" style="display: none;">
                        <div class="challenge-breakdown">
                            <div class="breakdown-item">
                                <span class="breakdown-label">Base Points:</span>
                                <span class="breakdown-value">${challenge.basePoints} pts</span>
                            </div>
                            ${hasNeighborhoodBonus && neighborhoodBonusBreakdown.length > 0 ? `
                                <div class="breakdown-item highlight">
                                    <span class="breakdown-label">Neighborhood Bonus:</span>
                                    <span class="breakdown-value">+${neighborhoodBonus} pts</span>
                                </div>
                                <div class="neighborhoods-list">
                                    ${neighborhoodBonusBreakdown.map(n => `
                                        <div class="neighborhood-chip">📍 ${escapeHTML(n.name)} <span style="font-weight: 600; margin-left: 4px;">+${n.points}</span></div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${challenge.otherBonus > 0 ? `
                                <div class="breakdown-item">
                                    <span class="breakdown-label">Other Bonus:</span>
                                    <span class="breakdown-value">+${challenge.otherBonus} pts</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            const expandIcon = (isCompleted && (hasNeighborhoodBonus || challenge.otherBonus > 0))
                ? `<span class="expand-icon" style="margin-left: 8px; opacity: 0.6;">▼</span>`
                : '';

            return `
                <div class="challenge-card ${isCompleted ? 'completed' : ''}"
                     ${detailsHTML ? `onclick="window.Team.toggleChallengeDetails(${index})"` : ''}
                     style="cursor: ${detailsHTML ? 'pointer' : 'default'};">
                    <div class="challenge-main">
                        <div class="challenge-info">
                            <span class="challenge-name">${escapeHTML(challenge.challengeName)}${expandIcon}</span>
                        </div>
                        <div class="challenge-score">
                            ${isCompleted ? `
                                <span class="points-total">${totalPoints} pts</span>
                                <span class="status-badge completed">✓</span>
                            ` : `
                                <span class="points-base">${challenge.basePoints} pts</span>
                                <span class="status-badge pending">—</span>
                            `}
                        </div>
                    </div>
                    ${detailsHTML}
                </div>
            `;
        });

        progressDiv.innerHTML = challengeHTMLArray.join('');

        // Mark as loaded
        challengesLoaded = true;
    } catch (err) {
        console.error('Error loading challenges:', err);
        progressDiv.innerHTML = `
            <div class="score-error">
                <p>⚠️ Could not load challenges</p>
                <p class="error-detail">${err.message}</p>
            </div>
        `;
    }
}

/**
 * Get current team name
 */
function getCurrentTeam() {
    return currentTeam;
}

/**
 * Toggle challenge details visibility
 * @param {number} index - Index of the challenge card
 */
function toggleChallengeDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (!details) return;

    const card = details.closest('.challenge-card');
    const icon = card?.querySelector('.expand-icon');

    if (details.style.display === 'none' || details.style.display === '') {
        details.style.display = 'block';
        if (icon) icon.textContent = '▲';
    } else {
        details.style.display = 'none';
        if (icon) icon.textContent = '▼';
    }
}

// Initialize on page load
window.addEventListener('load', initTeamPage);

// Export functions
window.Team = {
    getCurrentTeam,
    loadTeamScore,
    loadTeamChallenges,
    toggleChallengeDetails
};
