/**
 * Challenges page functionality
 * Handles loading, filtering, and displaying challenge data
 */

(function () {
    'use strict';

    let challengesData = [];
    let filteredChallenges = [];

    // DOM elements
    let searchInput;
    let categoryFilter;
    let pointsSort;
    let completionFilter;
    let clearFiltersBtn;
    let challengesContainer;
    let resultsCount;
    let noResults;

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function () {
        initializeChallenges();
    });

    function initializeChallenges() {
        // Get DOM elements
        searchInput = document.getElementById('challenge-search');
        categoryFilter = document.getElementById('category-filter');
        pointsSort = document.getElementById('points-sort');
        completionFilter = document.getElementById('completion-filter');
        clearFiltersBtn = document.getElementById('clear-filters');
        challengesContainer = document.getElementById('challenges-container');
        resultsCount = document.getElementById('results-count');
        noResults = document.getElementById('no-results');

        // Set up event listeners
        setupEventListeners();

        // Load challenges data
        loadChallengesData();
    }

    function setupEventListeners() {
        if (searchInput) {
            // Debounced search input
            let searchTimeout;
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(filterChallenges, 300);
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', filterChallenges);
        }

        if (pointsSort) {
            pointsSort.addEventListener('change', filterChallenges);
        }

        if (completionFilter) {
            completionFilter.addEventListener('change', filterChallenges);
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        }
    }

    async function loadChallengesData() {
        try {
            showLoading();

            // Try to fetch from server first, fallback to embedded data
            try {
                // Load all four challenge files
                const [easyRes, mediumRes, hardRes, locationRes] = await Promise.all([
                    fetch('../data/challenges-easy.json'),
                    fetch('../data/challenges-medium.json'),
                    fetch('../data/challenges-hard.json'),
                    fetch('../data/challenges-location.json')
                ]);

                if (easyRes.ok && mediumRes.ok && hardRes.ok && locationRes.ok) {
                    const [easyData, mediumData, hardData, locationData] = await Promise.all([
                        easyRes.json(),
                        mediumRes.json(),
                        hardRes.json(),
                        locationRes.json()
                    ]);

                    // Combine all challenges
                    challengesData = [
                        ...(easyData.challenges || []),
                        ...(mediumData.challenges || []),
                        ...(hardData.challenges || []),
                        ...(locationData.challenges || [])
                    ];

                    filteredChallenges = [...challengesData];
                    displayChallenges();
                    updateResultsCount();
                    return;
                }
            } catch (fetchError) {
                console.log('Fetch failed, using embedded data:', fetchError.message);
            }

            // Fallback to embedded data for file:// protocol
            loadEmbeddedChallengesData();

        } catch (error) {
            console.error('Error loading challenges data:', error);
            showError('Failed to load challenges. Please try refreshing the page.');
        }
    }

    function loadEmbeddedChallengesData() {
        // Embedded challenges data loaded from separate JS files
        // These files are included via script tags in challenges.html
        const easyData = window.CHALLENGES_EASY || { challenges: [] };
        const mediumData = window.CHALLENGES_MEDIUM || { challenges: [] };
        const hardData = window.CHALLENGES_HARD || { challenges: [] };
        const locationData = window.CHALLENGES_LOCATION || { challenges: [] };

        challengesData = [...easyData.challenges, ...mediumData.challenges, ...hardData.challenges, ...locationData.challenges];
        filteredChallenges = [...challengesData];
        displayChallenges();
        updateResultsCount();
    }

    function filterChallenges() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
        const sortOrder = pointsSort ? pointsSort.value : 'default';
        const completionStatus = completionFilter ? completionFilter.value : 'all';

        // Start with all challenges
        filteredChallenges = [...challengesData];

        // Apply search filter
        if (searchTerm) {
            filteredChallenges = filteredChallenges.filter(challenge =>
                challenge.title.toLowerCase().includes(searchTerm) ||
                challenge.description.toLowerCase().includes(searchTerm) ||
                (challenge.locationRestriction &&
                    challenge.locationRestriction.value.toLowerCase().includes(searchTerm))
            );
        }

        // Apply category filter
        if (selectedCategory !== 'all') {
            filteredChallenges = filteredChallenges.filter(challenge =>
                challenge.category === selectedCategory
            );
        }

        // Apply completion status filter
        if (completionStatus !== 'all') {
            filteredChallenges = filteredChallenges.filter(challenge => {
                const status = getChallengeStatus(challenge.id);
                if (completionStatus === 'completed') {
                    return status === 'completed';
                } else if (completionStatus === 'not-completed') {
                    return status !== 'completed';
                }
                return true;
            });
        }

        // Apply sorting
        if (sortOrder === 'points-asc') {
            filteredChallenges.sort((a, b) => a.basePoints - b.basePoints);
        } else if (sortOrder === 'points-desc') {
            filteredChallenges.sort((a, b) => b.basePoints - a.basePoints);
        }
        // 'default' maintains original order

        displayChallenges();
        updateResultsCount();
    }

    function displayChallenges() {
        if (!challengesContainer) return;

        if (filteredChallenges.length === 0) {
            showNoResults();
            return;
        }

        hideNoResults();

        const challengesHTML = filteredChallenges.map(challenge =>
            createChallengeCard(challenge)
        ).join('');

        challengesContainer.innerHTML = challengesHTML;
    }

    function createChallengeCard(challenge) {
        const status = getChallengeStatus(challenge.id);
        const isInProgress = status === 'in-progress';
        const isCompleted = status === 'completed';

        let bonusPointsHTML = '';
        if (challenge.bonuses && challenge.bonuses.length > 0) {
            bonusPointsHTML = `
                <div class="bonus-points">
                    <h4>Bonuses:</h4>
                    ${challenge.bonuses.map(bonus => `
                        <div class="bonus-item">
                            <strong>+${bonus.points} points:</strong> ${bonus.criteria}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (challenge.bonusPoints) {
            // Legacy support for old single bonusPoints format
            bonusPointsHTML = `
                <div class="bonus-points">
                    <h4>Bonus: +${challenge.bonusPoints.points} points</h4>
                    <p>${challenge.bonusPoints.criteria}</p>
                </div>
            `;
        }

        const locationRestrictionHTML = challenge.locationRestriction ? `
            <div class="location-restriction">
                <h4>Location Required</h4>
                <p>Must be completed in: ${formatLocationRestriction(challenge.locationRestriction)}</p>
            </div>
        ` : '';

        const requirementsHTML = challenge.requirements && challenge.requirements.length > 0 ? `
            <div class="challenge-requirements">
                <h4>Requirements:</h4>
                <ul>
                    ${challenge.requirements.map(req => `<li>${req}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        const actionsHTML = `
            <div class="challenge-actions">
                ${!isCompleted ? `
                    <button class="btn btn-primary ${isInProgress ? 'btn-success' : ''}" 
                            onclick="window.Challenges.toggleInProgress('${challenge.id}')"
                            data-challenge-id="${challenge.id}">
                        ${isInProgress ? '✓ In Progress' : 'Start Challenge'}
                    </button>
                ` : ''}
                ${isInProgress || isCompleted ? `
                    <button class="btn btn-secondary" 
                            onclick="window.Challenges.completeChallenge('${challenge.id}')"
                            data-challenge-id="${challenge.id}">
                        ${isCompleted ? '✓ Completed' : 'Complete & Upload'}
                    </button>
                ` : ''}
            </div>
        `;

        return `
            <div class="challenge-card ${isInProgress ? 'in-progress' : ''} ${isCompleted ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                <div class="challenge-header">
                    <h3 class="challenge-title">${challenge.title}</h3>
                    <div class="challenge-points">${challenge.basePoints} pts</div>
                </div>
                
                <div class="challenge-category category-${challenge.category}">
                    ${formatCategoryName(challenge.category)}
                </div>
                
                <p class="challenge-description">${challenge.description}</p>
                
                <div class="challenge-details">
                    ${locationRestrictionHTML}
                    ${bonusPointsHTML}
                    ${requirementsHTML}
                </div>
                
                ${actionsHTML}
            </div>
        `;
    }

    function formatCategoryName(category) {
        const categoryNames = {
            'easy': 'Easy',
            'medium': 'Medium',
            'hard': 'Hard',
            'location-specific': 'Location-Specific'
        };
        return categoryNames[category] || category;
    }

    function formatLocationRestriction(restriction) {
        const formattedValue = restriction.value
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        if (restriction.type === 'borough') {
            return `${formattedValue} Borough`;
        } else if (restriction.type === 'neighborhood') {
            return `${formattedValue} neighborhood`;
        } else {
            return formattedValue;
        }
    }

    function updateResultsCount() {
        if (!resultsCount) return;

        const total = challengesData.length;
        const showing = filteredChallenges.length;

        if (showing === total) {
            resultsCount.textContent = `Showing all ${total} challenges`;
        } else {
            resultsCount.textContent = `Showing ${showing} of ${total} challenges`;
        }
    }

    function clearAllFilters() {
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = 'all';
        if (pointsSort) pointsSort.value = 'default';
        if (completionFilter) completionFilter.value = 'all';

        filterChallenges();
    }

    function showLoading() {
        if (challengesContainer) {
            challengesContainer.innerHTML = `
                <div class="loading">
                    <p>Loading challenges...</p>
                </div>
            `;
        }
        if (resultsCount) {
            resultsCount.textContent = 'Loading challenges...';
        }
    }

    function showError(message) {
        if (challengesContainer) {
            challengesContainer.innerHTML = `
                <div class="no-results">
                    <h3>Error Loading Challenges</h3>
                    <p>${message}</p>
                </div>
            `;
        }
        if (resultsCount) {
            resultsCount.textContent = 'Error loading challenges';
        }
    }

    function showNoResults() {
        if (challengesContainer) {
            challengesContainer.innerHTML = '';
        }
        if (noResults) {
            noResults.style.display = 'block';
        }
    }

    function hideNoResults() {
        if (noResults) {
            noResults.style.display = 'none';
        }
    }

    // Challenge status management
    function getChallengeStatus(challengeId) {
        const inProgress = JSON.parse(localStorage.getItem('challenges_in_progress') || '[]');
        const completed = JSON.parse(localStorage.getItem('challenges_completed') || '[]');

        if (completed.includes(challengeId)) return 'completed';
        if (inProgress.includes(challengeId)) return 'in-progress';
        return 'not-started';
    }

    function toggleInProgress(challengeId) {
        const inProgress = JSON.parse(localStorage.getItem('challenges_in_progress') || '[]');
        const index = inProgress.indexOf(challengeId);

        if (index > -1) {
            inProgress.splice(index, 1);
        } else {
            inProgress.push(challengeId);
        }

        localStorage.setItem('challenges_in_progress', JSON.stringify(inProgress));
        displayChallenges(); // Refresh display
    }

    async function completeChallenge(challengeId) {
        const challenge = challengesData.find(c => c.id === challengeId);
        if (!challenge) {
            alert('Challenge not found');
            return;
        }

        // Check if user is signed in and has a team
        // Check both in-memory and localStorage
        const teamName = window.Team?.getCurrentTeam() || localStorage.getItem('scavenger_team');
        if (!teamName) {
            alert('Please join or create a team first on the Team page');
            return;
        }

        // Check if authenticated
        if (typeof gapi === 'undefined' || !gapi.client?.getToken()) {
            alert('Please sign in with Google first');
            return;
        }

        // Show completion modal
        showCompletionModal(challenge, teamName);
    }

    async function showCompletionModal(challenge, teamName) {
        // Initialize location manager
        const locationManager = new window.LocationManager();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Complete Challenge</h2>
                <h3>${challenge.title}</h3>
                
                <form id="completion-form">
                    <div class="form-group">
                        <label>Location Coordinates:</label>
                        <div id="location-info" class="location-info">
                            <span class="location-status">Getting location...</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="neighborhood-bonus">Neighborhood Bonus Points:</label>
                        <input type="number" id="neighborhood-bonus" value="0" min="0">
                    </div>
                    
                    <div class="form-group">
                        <label for="other-bonus">Other Bonus Points:</label>
                        <input type="number" id="other-bonus" value="0" min="0">
                    </div>
                    
                    <div class="form-group">
                        <label for="photo-links">Photo Links (Google Drive):</label>
                        <textarea id="photo-links" placeholder="Paste Google Drive photo links here"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" placeholder="Any additional notes about this challenge"></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary" id="submit-btn" disabled>Submit to Google Sheets</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const locationInfo = modal.querySelector('#location-info');
        const submitBtn = modal.querySelector('#submit-btn');
        let capturedLocation = null;

        // Get user location
        try {
            const position = await locationManager.getCurrentLocation();
            capturedLocation = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
            locationInfo.innerHTML = `
                <span class="location-coords">${capturedLocation}</span>
                <button type="button" class="btn-refresh" onclick="window.Challenges.refreshLocation(this)">🔄 Refresh</button>
            `;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Location error:', error);
            locationInfo.innerHTML = `
                <span class="location-error">${error.message}</span>
                <button type="button" class="btn-retry" onclick="window.Challenges.retryLocation(this)">Try Again</button>
            `;
        }

        const form = modal.querySelector('#completion-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!capturedLocation) {
                alert('Please allow location access to complete the challenge.');
                return;
            }

            const neighborhoodBonus = parseInt(document.getElementById('neighborhood-bonus').value) || 0;
            const otherBonus = parseInt(document.getElementById('other-bonus').value) || 0;
            const photoLinks = document.getElementById('photo-links').value;
            const notes = document.getElementById('notes').value;

            try {
                // Update or add challenge in Google Sheets
                const success = await window.SheetsAPI.updateOrAddChallengeByName(
                    teamName, 
                    challenge.title, 
                    {
                        location: capturedLocation,
                        neighborhoodBonus,
                        otherBonus,
                        photoLinks,
                        notes
                    },
                    {
                        id: challenge.id,
                        title: challenge.title,
                        basePoints: challenge.basePoints
                    }
                );

                if (success) {
                    // Mark as completed locally
                    const completed = JSON.parse(localStorage.getItem('challenges_completed') || '[]');
                    if (!completed.includes(challenge.id)) {
                        completed.push(challenge.id);
                        localStorage.setItem('challenges_completed', JSON.stringify(completed));
                    }

                    // Remove from in-progress
                    const inProgress = JSON.parse(localStorage.getItem('challenges_in_progress') || '[]');
                    const index = inProgress.indexOf(challenge.id);
                    if (index > -1) {
                        inProgress.splice(index, 1);
                        localStorage.setItem('challenges_in_progress', JSON.stringify(inProgress));
                    }

                    modal.remove();
                    displayChallenges(); // Refresh display
                    alert('Challenge completed and uploaded to Google Sheets!');
                } else {
                    alert('Error uploading to Google Sheets. Please try again.');
                }
            } catch (error) {
                console.error('Error completing challenge:', error);
                alert('Error uploading to Google Sheets: ' + error.message);
            }
        });

        // Store modal reference for location refresh
        modal._locationManager = locationManager;
        modal._capturedLocationRef = () => capturedLocation;
        modal._setCapturedLocation = (loc) => { capturedLocation = loc; };
    }

    // Helper functions for location refresh/retry
    async function refreshLocation(button) {
        const modal = button.closest('.modal-overlay');
        const locationInfo = modal.querySelector('#location-info');
        const submitBtn = modal.querySelector('#submit-btn');
        const locationManager = modal._locationManager;

        locationInfo.innerHTML = '<span class="location-status">Getting location...</span>';
        submitBtn.disabled = true;

        try {
            const position = await locationManager.getCurrentLocation();
            const capturedLocation = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
            modal._setCapturedLocation(capturedLocation);
            locationInfo.innerHTML = `
                <span class="location-coords">${capturedLocation}</span>
                <button type="button" class="btn-refresh" onclick="window.Challenges.refreshLocation(this)">🔄 Refresh</button>
            `;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Location error:', error);
            locationInfo.innerHTML = `
                <span class="location-error">${error.message}</span>
                <button type="button" class="btn-retry" onclick="window.Challenges.retryLocation(this)">Try Again</button>
            `;
        }
    }

    async function retryLocation(button) {
        await refreshLocation(button);
    }

    // Expose functions for potential external use
    window.Challenges = {
        filterChallenges: filterChallenges,
        clearAllFilters: clearAllFilters,
        loadChallengesData: loadChallengesData,
        toggleInProgress: toggleInProgress,
        completeChallenge: completeChallenge,
        getChallengeStatus: getChallengeStatus,
        refreshLocation: refreshLocation,
        retryLocation: retryLocation
    };
})();