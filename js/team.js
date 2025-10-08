/**
 * Team management functionality
 */

// Sample challenge list - should match your actual challenges
const ALL_CHALLENGES = [
    'Find a hot dog cart',
    'Take a photo with a street performer',
    'Visit the Brooklyn Bridge',
    'Find a bodega cat',
    'Ride the subway',
    'Visit Central Park',
    'Find a yellow taxi',
    'Visit Times Square',
    'Find street art',
    'Visit the Statue of Liberty'
];

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

    // Check initial state
    updateTeamUI();
}

/**
 * Handle user sign in
 */
function handleSignIn() {
    updateTeamUI();
    loadSavedTeam();
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
    const hasToken = gapi?.client?.getToken() !== null;
    const isSignedIn = window.Auth.isSignedIn() && hasToken;

    if (!isSignedIn) {
        notLoggedIn.style.display = 'block';
        teamManagement.style.display = 'none';
        
        // Update message if user info exists but token is missing
        if (window.Auth.isSignedIn() && !hasToken) {
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
            document.getElementById('currentTeamName').textContent = currentTeam;
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
    if (savedTeam) {
        currentTeam = savedTeam;
        updateTeamUI();
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
                alert(`Successfully joined team "${teamName}"!`);
            }
            return;
        }

        console.log('Creating new team sheet...');
        // Create the team sheet with just the header (no challenges pre-populated)
        await window.SheetsAPI.initializeTeamSheet(teamName);
        
        currentTeam = teamName;
        localStorage.setItem('scavenger_team', teamName);
        updateTeamUI();
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
            const totalPoints = challenge.neighborhoodBonus + challenge.otherBonus;
            
            return `
                <div class="challenge-item ${isCompleted ? 'completed' : ''}">
                    <span class="challenge-name">${challenge.challengeName}</span>
                    <div class="challenge-status">
                        ${isCompleted ? `<span>${totalPoints} pts</span>` : ''}
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
