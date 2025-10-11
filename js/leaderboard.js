/**
 * Leaderboard page functionality
 * Handles loading and displaying team scores and details
 */

(function () {
    'use strict';

    let teamScores = [];
    let lastUpdateTime = null;

    // DOM elements
    let loadingState;
    let authPrompt;
    let leaderboardContent;
    let leaderboardTableBody;
    let noTeams;
    let lastUpdated;
    let teamModalOverlay;
    let teamModalTitle;
    let teamSummary;
    let teamChallengesList;

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
     * Initialize leaderboard page
     */
    function initializeLeaderboard() {
        // Get DOM elements
        loadingState = document.getElementById('loadingState');
        authPrompt = document.getElementById('authPrompt');
        leaderboardContent = document.getElementById('leaderboardContent');
        leaderboardTableBody = document.getElementById('leaderboardTableBody');
        noTeams = document.getElementById('noTeams');
        lastUpdated = document.getElementById('lastUpdated');
        teamModalOverlay = document.getElementById('teamModalOverlay');
        teamModalTitle = document.getElementById('teamModalTitle');
        teamSummary = document.getElementById('teamSummary');
        teamChallengesList = document.getElementById('teamChallengesList');

        // Check authentication state
        checkAuthAndLoadData();

        // Listen for auth events
        window.addEventListener('userSignedIn', () => {
            console.log('User signed in, loading leaderboard...');
            checkAuthAndLoadData();
        });

        window.addEventListener('userSignedOut', () => {
            console.log('User signed out, showing auth prompt...');
            showAuthPrompt();
        });

        // Listen for GAPI initialization
        window.addEventListener('gapiInitComplete', () => {
            console.log('GAPI init complete, checking auth...');
            checkAuthAndLoadData();
        });
    }

    /**
     * Check authentication and load data if authenticated
     */
    function checkAuthAndLoadData() {
        if (window.Auth && window.Auth.isSignedIn()) {
            loadLeaderboardData();
        } else {
            showAuthPrompt();
        }
    }

    /**
     * Show authentication prompt
     */
    function showAuthPrompt() {
        loadingState.style.display = 'none';
        authPrompt.style.display = 'block';
        leaderboardContent.style.display = 'none';
    }

    /**
     * Show loading indicator
     */
    function showLoading() {
        loadingState.style.display = 'block';
        authPrompt.style.display = 'none';
        leaderboardContent.style.display = 'none';
    }

    /**
     * Show leaderboard content
     */
    function showLeaderboard() {
        loadingState.style.display = 'none';
        authPrompt.style.display = 'none';
        leaderboardContent.style.display = 'block';
    }

    /**
     * Load leaderboard data from Google Sheets
     */
    async function loadLeaderboardData() {
        if (!window.SheetsAPI || !window.SheetsAPI.getAllTeamScores) {
            console.error('SheetsAPI not available');
            return;
        }

        showLoading();

        try {
            teamScores = await window.SheetsAPI.getAllTeamScores();
            lastUpdateTime = new Date();
            
            console.log('Loaded team scores:', teamScores);
            
            displayLeaderboard();
            showLeaderboard();
        } catch (error) {
            console.error('Error loading leaderboard data:', error);
            
            // Show error message to user
            showError('Failed to load leaderboard data. Please try refreshing the page.');
        }
    }

    /**
     * Display the leaderboard table
     */
    function displayLeaderboard() {
        if (!teamScores || teamScores.length === 0) {
            noTeams.style.display = 'block';
            leaderboardTableBody.innerHTML = '';
            return;
        }

        noTeams.style.display = 'none';
        
        // Generate table rows
        const tableHTML = teamScores.map((team, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'rank-first' : rank === 2 ? 'rank-second' : rank === 3 ? 'rank-third' : '';
            
            return `
                <tr class="team-row ${rankClass}">
                    <td class="rank-cell">
                        <span class="rank-number">${rank}</span>
                        ${rank <= 3 ? getRankEmoji(rank) : ''}
                    </td>
                    <td class="team-name">
                        <strong>${escapeHTML(team.teamName)}</strong>
                    </td>
                    <td class="total-score">
                        <strong>${team.totalScore}</strong>
                    </td>
                    <td class="challenges-count">
                        ${team.completedChallenges}
                        ${team.totalChallenges > 0 ? `<span class="total-challenges">/ ${team.totalChallenges}</span>` : ''}
                    </td>
                    <td class="base-points">${team.totalBasePoints}</td>
                    <td class="neighborhood-bonus">${team.totalNeighborhoodBonus}</td>
                    <td class="other-bonus">${team.totalOtherBonus}</td>
                    <td class="actions">
                        <button onclick="viewTeamDetails('${escapeHTML(team.teamName)}')" class="btn btn-sm btn-primary">
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        leaderboardTableBody.innerHTML = tableHTML;

        // Update last updated time
        if (lastUpdateTime) {
            lastUpdated.textContent = `Last updated: ${lastUpdateTime.toLocaleString()}`;
        }
    }

    /**
     * Get emoji for rank
     */
    function getRankEmoji(rank) {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        // Create error message element if it doesn't exist
        let errorElement = document.getElementById('errorMessage');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'errorMessage';
            errorElement.className = 'error-message';
            errorElement.style.margin = 'var(--spacing-lg) 0';
            document.querySelector('.leaderboard-section .container').appendChild(errorElement);
        }

        errorElement.innerHTML = `
            <div class="error-content">
                <p>${escapeHTML(message)}</p>
                <button onclick="document.getElementById('errorMessage').style.display = 'none'" class="btn btn-sm">
                    Dismiss
                </button>
            </div>
        `;
        errorElement.style.display = 'block';

        // Show auth prompt as fallback
        showAuthPrompt();
    }

    /**
     * View team details
     */
    async function viewTeamDetails(teamName) {
        if (!window.SheetsAPI || !window.SheetsAPI.getTeamDetails) {
            console.error('SheetsAPI not available');
            return;
        }

        try {
            // Show loading in modal
            teamModalTitle.textContent = `Loading ${teamName}...`;
            teamSummary.innerHTML = '<div class="loading-spinner"></div>';
            teamChallengesList.innerHTML = '';
            teamModalOverlay.style.display = 'flex';

            const teamDetails = await window.SheetsAPI.getTeamDetails(teamName);
            console.log('Team details:', teamDetails);

            // Update modal content
            teamModalTitle.textContent = teamName;
            
            // Team summary
            teamSummary.innerHTML = `
                <div class="team-stats">
                    <div class="stat">
                        <span class="stat-label">Total Score:</span>
                        <span class="stat-value">${teamDetails.totalScore}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Completed Challenges:</span>
                        <span class="stat-value">${teamDetails.completedChallenges}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Base Points:</span>
                        <span class="stat-value">${teamDetails.totalBasePoints}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Neighborhood Bonus:</span>
                        <span class="stat-value">${teamDetails.totalNeighborhoodBonus}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Other Bonus:</span>
                        <span class="stat-value">${teamDetails.totalOtherBonus}</span>
                    </div>
                </div>
            `;

            // Challenges list
            if (teamDetails.challenges && teamDetails.challenges.length > 0) {
                const challengesHTML = teamDetails.challenges.map(challenge => `
                    <div class="challenge-item">
                        <div class="challenge-header">
                            <h5>${escapeHTML(challenge.challengeName)}</h5>
                            <span class="challenge-points">${challenge.basePoints} pts</span>
                        </div>
                        <div class="challenge-details">
                            ${challenge.location ? `<div class="challenge-location">📍 ${escapeHTML(challenge.location)}</div>` : ''}
                            ${challenge.otherBonus > 0 ? `<div class="challenge-bonus">✨ Bonus: ${challenge.otherBonus} pts</div>` : ''}
                            ${challenge.photoLinks ? `<div class="challenge-photos">📸 <a href="${challenge.photoLinks}" target="_blank">View Photos</a></div>` : ''}
                            ${challenge.notes ? `<div class="challenge-notes">📝 ${escapeHTML(challenge.notes)}</div>` : ''}
                        </div>
                    </div>
                `).join('');

                teamChallengesList.innerHTML = challengesHTML;
            } else {
                teamChallengesList.innerHTML = '<p class="no-challenges">No completed challenges yet.</p>';
            }

        } catch (error) {
            console.error('Error loading team details:', error);
            teamSummary.innerHTML = '<p class="error">Failed to load team details. Please try again.</p>';
            teamChallengesList.innerHTML = '';
        }
    }

    /**
     * Close team modal
     */
    function closeTeamModal() {
        teamModalOverlay.style.display = 'none';
    }

    /**
     * Refresh leaderboard data
     */
    function refreshLeaderboard() {
        loadLeaderboardData();
    }

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', initializeLeaderboard);

    // Export functions for global access
    window.viewTeamDetails = viewTeamDetails;
    window.closeTeamModal = closeTeamModal;
    window.refreshLeaderboard = refreshLeaderboard;

})();