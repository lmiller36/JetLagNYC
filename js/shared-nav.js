// Shared navigation component
// This script dynamically loads the navigation header on all pages

// Score cache
let scoreCache = {
    teamName: null,
    score: null,
    timestamp: null
};

const CACHE_DURATION = 20000; // 20 seconds in milliseconds

function loadSharedNavigation() {
    const isSubPage = window.location.pathname.includes('/pages/');
    const pathPrefix = isSubPage ? '../' : '';
    
    const navHTML = `
        <header>
            <nav class="main-nav">
                <div class="nav-container">
                    <h1 class="logo">
                        <a href="${pathPrefix}index.html" style="color: inherit; text-decoration: none;">NYC Scavenger Hunt</a>
                    </h1>
                    <div id="teamInfo" class="team-info"></div>
                    <div id="userInfo" class="user-info"></div>
                    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
                        <span class="hamburger"></span>
                    </button>
                    <ul class="nav-menu">
                        <li><a href="${pathPrefix}index.html" class="nav-link" data-page="home">Home</a></li>
                        <li><a href="${pathPrefix}pages/challenges.html" class="nav-link" data-page="challenges">Challenges</a></li>
                        <li><a href="${pathPrefix}pages/neighborhoods.html" class="nav-link" data-page="neighborhoods">Neighborhoods</a></li>
                        <li><a href="${pathPrefix}pages/team.html" class="nav-link" data-page="team">Team</a></li>
                        <li><a href="${pathPrefix}pages/rules.html" class="nav-link" data-page="rules">Rules</a></li>
                    </ul>
                </div>
            </nav>
        </header>
    `;
    
    // Insert navigation at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    
    // Set active page
    setActivePage();
    
    // Initialize team info display
    initializeTeamInfo();
    
    // Listen for team changes
    window.addEventListener('teamChanged', (event) => {
        // Clear cache when team changes
        scoreCache = {
            teamName: null,
            score: null,
            timestamp: null
        };
        updateTeamInfo();
    });
    window.addEventListener('userSignedIn', updateTeamInfo);
    window.addEventListener('userSignedOut', () => {
        // Clear cache on sign out
        scoreCache = {
            teamName: null,
            score: null,
            timestamp: null
        };
        updateTeamInfo();
    });
}

/**
 * Initialize team info with retry logic
 */
function initializeTeamInfo() {
    // Try to update immediately
    updateTeamInfo();
    
    // Also retry after a delay to catch late API initialization
    setTimeout(() => {
        updateTeamInfo();
    }, 1500);
    
    // And one more time after longer delay
    setTimeout(() => {
        updateTeamInfo();
    }, 3000);
}

/**
 * Update team info in navigation
 */
async function updateTeamInfo() {
    const teamInfoElement = document.getElementById('teamInfo');
    if (!teamInfoElement) return;
    
    const savedTeam = localStorage.getItem('scavenger_team');
    
    if (!savedTeam) {
        teamInfoElement.innerHTML = '';
        return;
    }
    
    // Check if user is authenticated (check both gapi token and saved user)
    const savedUser = localStorage.getItem('scavenger_user');
    const hasToken = typeof gapi !== 'undefined' && gapi?.client?.getToken() !== null;
    
    if (!savedUser) {
        teamInfoElement.innerHTML = '';
        return;
    }
    
    // Show team name immediately (even if token isn't ready yet)
    teamInfoElement.innerHTML = `
        <div class="team-display">
            <span class="team-label">Team:</span>
            <span class="team-name">${savedTeam}</span>
            <span class="team-score">Loading...</span>
        </div>
    `;
    
    // Wait for API to be ready before loading score
    if (!hasToken) {
        // Wait a bit for gapi to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check if we have a cached score that's still fresh
    const now = Date.now();
    const isCacheFresh = scoreCache.teamName === savedTeam && 
                         scoreCache.timestamp && 
                         (now - scoreCache.timestamp) < CACHE_DURATION;
    
    if (isCacheFresh && scoreCache.score !== null) {
        // Use cached score
        const teamScoreElement = teamInfoElement.querySelector('.team-score');
        if (teamScoreElement) {
            teamScoreElement.textContent = `${scoreCache.score} pts`;
        }
        console.log('Using cached score:', scoreCache.score);
        return;
    }
    
    // Load score asynchronously
    try {
        if (window.SheetsAPI && window.SheetsAPI.calculateTeamScore) {
            const score = await window.SheetsAPI.calculateTeamScore(savedTeam);
            const teamScoreElement = teamInfoElement.querySelector('.team-score');
            if (teamScoreElement) {
                teamScoreElement.textContent = `${score.totalScore} pts`;
            }
            
            // Update cache
            scoreCache = {
                teamName: savedTeam,
                score: score.totalScore,
                timestamp: Date.now()
            };
            console.log('Score loaded and cached:', score.totalScore);
        } else {
            // API not ready yet, hide loading text
            const teamScoreElement = teamInfoElement.querySelector('.team-score');
            if (teamScoreElement) {
                teamScoreElement.textContent = '';
            }
        }
    } catch (err) {
        console.error('Error loading team score:', err);
        const teamScoreElement = teamInfoElement.querySelector('.team-score');
        if (teamScoreElement) {
            teamScoreElement.textContent = '';
        }
    }
}

function setActivePage() {
    const currentPath = window.location.pathname;
    const fileName = currentPath.split('/').pop() || 'index.html';
    
    // Map filenames to page identifiers
    const pageMap = {
        'index.html': 'home',
        'challenges.html': 'challenges',
        'neighborhoods.html': 'neighborhoods',
        'team.html': 'team',
        'submission.html': 'submission',
        'rules.html': 'rules'
    };
    
    const currentPage = pageMap[fileName] || 'home';
    
    // Add active class to current page link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.page === currentPage) {
            link.classList.add('active');
        }
    });
}

/**
 * Force refresh the team score (clears cache)
 */
function refreshTeamScore() {
    scoreCache = {
        teamName: null,
        score: null,
        timestamp: null
    };
    updateTeamInfo();
}

// Load navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedNavigation);
} else {
    loadSharedNavigation();
}

// Export functions for external use
window.SharedNav = {
    refreshTeamScore
};
