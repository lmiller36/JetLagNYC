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
    if (refreshScoreBtn) refreshScoreBtn.addEventListener('click', loadTeamScore);

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
    updateTeamUI();
    
    // Retry after a delay to catch late API initialization
    setTimeout(() => {
        updateTeamUI();
    }, 1000);
    
    // Final retry
    setTimeout(() => {
        updateTeamUI();
    }, 2000);
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
            loadTeamScore();
            loadTeamChallenges();
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
        alert('Please enter a team name');
        return;
    }

    try {
        // Check if team exists
        const exists = await window.SheetsAPI.sheetExists(teamName);
        if (!exists) {
            alert(`Team "${teamName}" does not exist. Please check the spelling or create a new team.`);
            return;
        }

        currentTeam = teamName;
        localStorage.setItem('scavenger_team', teamName);
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));
        
        // Ensure Drive folder exists for joined team
        ensureTeamFolderExists();
        
        alert(`Successfully joined team "${teamName}"!`);
    } catch (err) {
        alert('Error joining team: ' + err.message);
        console.error(err);
    }
}

/**
 * Create new team
 */
async function createTeam() {
    const teamName = document.getElementById('createTeamName').value.trim();
    if (!teamName) {
        alert('Please enter a team name');
        return;
    }

    // Check if authenticated
    const token = gapi.client.getToken();
    if (!token) {
        alert('Please sign in with Google first before creating a team.');
        return;
    }

    try {
        console.log('Checking if team exists:', teamName);
        
        // Check if team already exists
        const exists = await window.SheetsAPI.sheetExists(teamName);
        console.log('Team exists?', exists);
        
        if (exists) {
            const confirmJoin = confirm(`Team "${teamName}" already exists. Would you like to join it instead?`);
            if (confirmJoin) {
                currentTeam = teamName;
                localStorage.setItem('scavenger_team', teamName);
                updateTeamUI();
                window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));
                alert(`Successfully joined team "${teamName}"!`);
            }
            return;
        }

        console.log('Creating new team sheet...');
        // Load all challenges and create the team sheet
        const allChallenges = loadAllChallenges();
        console.log('Loaded challenges:', allChallenges.length);
        await window.SheetsAPI.initializeTeamSheet(teamName, allChallenges);
        
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
            alert(`Team created successfully, but there was an issue creating the Google Drive folder: ${driveError.message}`);
        }
        
        currentTeam = teamName;
        localStorage.setItem('scavenger_team', teamName);
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName } }));
        alert(`Successfully created team "${teamName}"!`);
    } catch (err) {
        alert('Error creating team: ' + err.message);
        console.error('Full error:', err);
    }
}

/**
 * Leave current team
 */
function leaveTeam() {
    if (confirm('Are you sure you want to leave this team?')) {
        currentTeam = null;
        localStorage.removeItem('scavenger_team');
        updateTeamUI();
        window.dispatchEvent(new CustomEvent('teamChanged', { detail: { teamName: null } }));
    }
}

/**
 * Load and display team score
 */
async function loadTeamScore() {
    if (!currentTeam) return;

    const scoreDisplay = document.getElementById('scoreDisplay');
    scoreDisplay.innerHTML = '<div class="score-loading">Loading score...</div>';

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
    } catch (err) {
        scoreDisplay.innerHTML = '<div class="score-loading">Error loading score</div>';
        console.error('Error loading score:', err);
    }
}

/**
 * Load and display team challenges
 */
async function loadTeamChallenges() {
    if (!currentTeam) return;

    const progressDiv = document.getElementById('challengeProgress');
    progressDiv.innerHTML = '<div class="score-loading">Loading challenges...</div>';

    try {
        const challenges = await window.SheetsAPI.getTeamChallenges(currentTeam);
        
        progressDiv.innerHTML = challenges.map(challenge => {
            const isCompleted = challenge.location !== '';
            const totalPoints = challenge.basePoints + challenge.neighborhoodBonus + challenge.otherBonus;
            
            return `
                <div class="challenge-item ${isCompleted ? 'completed' : ''}">
                    <span class="challenge-name">${challenge.challengeName}</span>
                    <div class="challenge-status">
                        ${isCompleted ? `<span>${totalPoints} pts</span>` : `<span>${challenge.basePoints} base pts</span>`}
                        <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
                            ${isCompleted ? 'Completed' : 'Pending'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        progressDiv.innerHTML = '<div class="score-loading">Error loading challenges</div>';
        console.error('Error loading challenges:', err);
    }
}

/**
 * Get current team name
 */
function getCurrentTeam() {
    return currentTeam;
}

// Initialize on page load
window.addEventListener('load', initTeamPage);

// Export functions
window.Team = {
    getCurrentTeam,
    loadTeamScore,
    loadTeamChallenges
};
