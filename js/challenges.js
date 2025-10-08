/**
 * Challenges page functionality
 * Handles loading, filtering, and displaying challenge data
 */

(function () {
    'use strict';

    let challengesData = [];
    let filteredChallenges = [];
    let teamChallengesCache = null; // In-memory cache

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

    // DOM elements
    let searchInput;
    let categoryFilter;
    let pointsSort;
    let completionFilter;
    let clearFiltersBtn;
    let challengesContainer;
    let resultsCount;
    let noResults;
    let filterChips;
    let searchToggle;
    let searchBox;
    let searchClose;
    let moreFiltersBtn;
    let moreFiltersPanel;
    let applyFiltersBtn;

    // Current filter state
    let currentCategory = 'all';

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

        // New chip-based UI elements
        searchToggle = document.getElementById('search-toggle');
        searchBox = document.getElementById('search-box');
        searchClose = document.getElementById('search-close');
        moreFiltersBtn = document.getElementById('more-filters');
        moreFiltersPanel = document.getElementById('more-filters-panel');
        applyFiltersBtn = document.getElementById('apply-filters');
        filterChips = document.querySelectorAll('.filter-chip');

        // Set up event listeners
        setupEventListeners();

        // Load challenges data
        loadChallengesData();
    }

    function setupEventListeners() {
        // Filter chips
        if (filterChips) {
            filterChips.forEach(chip => {
                chip.addEventListener('click', function() {
                    const category = this.getAttribute('data-category');
                    setActiveChip(category);
                    currentCategory = category;
                    filterChallenges();
                });
            });
        }

        // Search toggle
        if (searchToggle && searchBox) {
            searchToggle.addEventListener('click', function() {
                searchBox.style.display = searchBox.style.display === 'none' ? 'flex' : 'none';
                if (searchBox.style.display === 'flex') {
                    searchInput.focus();
                }
            });
        }

        // Search close
        if (searchClose) {
            searchClose.addEventListener('click', function() {
                searchBox.style.display = 'none';
                searchInput.value = '';
                filterChallenges();
            });
        }

        // More filters toggle
        if (moreFiltersBtn && moreFiltersPanel) {
            moreFiltersBtn.addEventListener('click', function() {
                const isVisible = moreFiltersPanel.style.display !== 'none';
                moreFiltersPanel.style.display = isVisible ? 'none' : 'block';
            });
        }

        // Apply filters button
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', function() {
                moreFiltersPanel.style.display = 'none';
                filterChallenges();
            });
        }

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

        // Refresh status button
        const refreshStatusBtn = document.getElementById('refresh-status-btn');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', async function() {
                this.disabled = true;
                this.textContent = '🔄 Refreshing...';

                await loadTeamChallengesCache(true); // Force refresh from Sheets

                this.disabled = false;
                this.textContent = '🔄 Refresh Status';
            });
        }

        // Listen for team changes to clear cache
        window.addEventListener('teamChanged', function() {
            clearTeamChallengesCache();
            loadTeamChallengesCache(); // Load new team's cache
        });

        // Listen for sign out to clear cache
        window.addEventListener('userSignedOut', function() {
            clearTeamChallengesCache();
        });
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
                    updateChipCounts();

                    // Load team challenges cache for completion status
                    await loadTeamChallengesCache();

                    displayChallenges();
                    updateResultsCount();
                    return;
                }
            } catch (fetchError) {
                console.log('Fetch failed, using embedded data:', fetchError.message);
            }

            // Fallback to embedded data for file:// protocol
            await loadEmbeddedChallengesData();

        } catch (error) {
            console.error('Error loading challenges data:', error);
            showError('Failed to load challenges. Please try refreshing the page.');
        }
    }

    async function loadEmbeddedChallengesData() {
        // Embedded challenges data loaded from separate JS files
        // These files are included via script tags in challenges.html
        const easyData = window.CHALLENGES_EASY || { challenges: [] };
        const mediumData = window.CHALLENGES_MEDIUM || { challenges: [] };
        const hardData = window.CHALLENGES_HARD || { challenges: [] };
        const locationData = window.CHALLENGES_LOCATION || { challenges: [] };

        challengesData = [...easyData.challenges, ...mediumData.challenges, ...hardData.challenges, ...locationData.challenges];
        filteredChallenges = [...challengesData];
        updateChipCounts();

        // Load team challenges cache for completion status BEFORE displaying
        await loadTeamChallengesCache();

        displayChallenges();
        updateResultsCount();
    }

    function filterChallenges() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCategory = currentCategory || 'all';
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

        // Get category icon
        const categoryIcons = {
            'easy': '⚡',
            'medium': '🔥',
            'hard': '💪',
            'location-specific': '📍'
        };
        const categoryIcon = categoryIcons[challenge.category] || '📋';

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

        // Create collapsed card with preview
        return `
            <div class="challenge-card collapsed ${isInProgress ? 'in-progress' : ''} ${isCompleted ? 'completed' : ''}"
                 data-challenge-id="${escapeHTML(challenge.id)}"
                 onclick="window.Challenges.toggleCard(this)">
                <div class="card-preview">
                    <div class="preview-left">
                        <span class="category-icon ${challenge.category}">${categoryIcon}</span>
                        <div class="preview-content">
                            <h3>${escapeHTML(challenge.title)}</h3>
                            <p class="preview-snippet">${escapeHTML(challenge.description)}</p>
                        </div>
                    </div>
                    <div class="preview-right">
                        <span class="points-badge">${challenge.basePoints} pts</span>
                        <span class="expand-icon">▼</span>
                    </div>
                </div>

                <div class="card-expanded">
                    <div class="challenge-category category-${challenge.category}">
                        ${formatCategoryName(challenge.category)}
                    </div>

                    <p class="challenge-description">${escapeHTML(challenge.description)}</p>

                    <div class="challenge-details">
                        ${locationRestrictionHTML}
                        ${bonusPointsHTML}
                        ${requirementsHTML}
                    </div>

                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    // Toggle card expanded/collapsed state
    function toggleCard(cardElement) {
        // Prevent toggle if clicking on buttons
        if (event.target.closest('button')) {
            event.stopPropagation();
            return;
        }

        cardElement.classList.toggle('collapsed');
        cardElement.classList.toggle('expanded');
    }

    // Set active filter chip
    function setActiveChip(category) {
        filterChips.forEach(chip => {
            if (chip.getAttribute('data-category') === category) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Update chip counts
    function updateChipCounts() {
        if (!challengesData || challengesData.length === 0) return;

        const counts = {
            all: challengesData.length,
            easy: challengesData.filter(c => c.category === 'easy').length,
            medium: challengesData.filter(c => c.category === 'medium').length,
            hard: challengesData.filter(c => c.category === 'hard').length,
            'location-specific': challengesData.filter(c => c.category === 'location-specific').length
        };

        document.getElementById('count-all').textContent = `(${counts.all})`;
        document.getElementById('count-easy').textContent = `(${counts.easy})`;
        document.getElementById('count-medium').textContent = `(${counts.medium})`;
        document.getElementById('count-hard').textContent = `(${counts.hard})`;
        document.getElementById('count-location').textContent = `(${counts['location-specific']})`;
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
    /**
     * Load team challenges cache from localStorage or Sheets
     */
    async function loadTeamChallengesCache(forceRefresh = false) {
        const teamName = localStorage.getItem('scavenger_team');

        if (!teamName) {
            teamChallengesCache = null;
            return;
        }

        // Try to load from localStorage first
        if (!forceRefresh) {
            const cached = localStorage.getItem('team_challenges_cache');
            if (cached) {
                try {
                    const cacheData = JSON.parse(cached);
                    // Check if cache is for the current team
                    if (cacheData.teamName === teamName) {
                        teamChallengesCache = cacheData.challenges;
                        console.log('Loaded team challenges from cache:', teamChallengesCache.length);
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing cache:', e);
                }
            }
        }

        // Fetch from Sheets if no cache or forced refresh
        try {
            if (!window.SheetsAPI || !window.SheetsAPI.getTeamChallenges) {
                console.log('Sheets API not ready yet');
                return;
            }

            const token = typeof gapi !== 'undefined' && gapi.client ? gapi.client.getToken() : null;
            if (!token) {
                console.log('User not authenticated, skipping cache load');
                return;
            }

            console.log('Fetching team challenges from Sheets...');
            const challenges = await window.SheetsAPI.getTeamChallenges(teamName);
            teamChallengesCache = challenges;

            // Save to localStorage
            const cacheData = {
                teamName: teamName,
                challenges: challenges,
                timestamp: Date.now()
            };
            localStorage.setItem('team_challenges_cache', JSON.stringify(cacheData));
            console.log('Cached team challenges:', challenges.length);

            // Refresh display to update completion status
            displayChallenges();
        } catch (error) {
            console.error('Error loading team challenges:', error);
            teamChallengesCache = null;
        }
    }

    /**
     * Update cache after submission
     */
    function updateChallengeInCache(challengeData) {
        const teamName = localStorage.getItem('scavenger_team');
        if (!teamName) return;

        if (!teamChallengesCache) {
            teamChallengesCache = [];
        }

        // Find existing challenge in cache
        const existingIndex = teamChallengesCache.findIndex(c => c.challengeId === challengeData.challengeId);

        if (existingIndex >= 0) {
            // Update existing
            teamChallengesCache[existingIndex] = challengeData;
        } else {
            // Add new
            teamChallengesCache.push(challengeData);
        }

        // Save to localStorage
        const cacheData = {
            teamName: teamName,
            challenges: teamChallengesCache,
            timestamp: Date.now()
        };
        localStorage.setItem('team_challenges_cache', JSON.stringify(cacheData));
        console.log('Updated cache for challenge:', challengeData.challengeId);
    }

    /**
     * Clear cache (when switching teams or signing out)
     */
    function clearTeamChallengesCache() {
        teamChallengesCache = null;
        localStorage.removeItem('team_challenges_cache');
        console.log('Cleared team challenges cache');
    }

    /**
     * Get challenge status from cache
     */
    function getChallengeStatus(challengeId) {
        // Check in-progress from localStorage (still useful for pre-submission state)
        const inProgress = JSON.parse(localStorage.getItem('challenges_in_progress') || '[]');

        // Check if challenge exists in team challenges cache
        if (teamChallengesCache) {
            const challenge = teamChallengesCache.find(c => c.challengeId === challengeId);
            if (challenge) {
                return 'completed';
            }
        }

        if (inProgress.includes(challengeId)) return 'in-progress';
        return 'not-started';
    }

    /**
     * Get challenge data from cache
     */
    function getChallengeFromCache(challengeId) {
        if (!teamChallengesCache) return null;
        return teamChallengesCache.find(c => c.challengeId === challengeId) || null;
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
                <h3>${escapeHTML(challenge.title)}</h3>

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
                        <label for="photo-upload">Challenge Photos:</label>
                        <input type="file" id="photo-upload" accept="image/*" multiple style="display: none;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('photo-upload').click()">
                            📷 Select Photos
                        </button>
                        <div id="photo-preview" class="photo-preview"></div>
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

        // Get user location (optional)
        try {
            const position = await locationManager.getCurrentLocation();
            capturedLocation = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
            locationInfo.innerHTML = `
                <span class="location-coords">${capturedLocation}</span>
                <button type="button" class="btn-refresh" onclick="window.Challenges.refreshLocation(this)">🔄 Refresh</button>
            `;
        } catch (error) {
            console.error('Location error:', error);
            locationInfo.innerHTML = `
                <span class="location-warning">⚠️ Location unavailable (optional)</span>
                <button type="button" class="btn-retry" onclick="window.Challenges.retryLocation(this)">Try Again</button>
            `;
        }

        // Enable submit button regardless of location
        submitBtn.disabled = false;

        // Handle photo selection
        const photoInput = modal.querySelector('#photo-upload');
        const photoPreview = modal.querySelector('#photo-preview');
        let selectedPhotos = [];

        photoInput.addEventListener('change', (e) => {
            selectedPhotos = Array.from(e.target.files);
            if (selectedPhotos.length > 0) {
                photoPreview.innerHTML = `
                    <div class="photo-count">
                        ✓ ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''} selected
                    </div>
                `;
            } else {
                photoPreview.innerHTML = '';
            }
        });

        const form = modal.querySelector('#completion-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const neighborhoodBonus = parseInt(document.getElementById('neighborhood-bonus').value) || 0;
            const otherBonus = parseInt(document.getElementById('other-bonus').value) || 0;
            const notes = document.getElementById('notes').value;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';

            try {
                let photoLinks = '';

                // Upload photos to Google Drive if any selected
                if (selectedPhotos.length > 0) {
                    // Ensure team folder exists (creates if needed)
                    const teamFolderId = await window.driveManager.ensureTeamFolder(teamName);

                    // Upload photos
                    const uploadedPhotos = await window.driveManager.uploadChallengePhotos(
                        teamName,
                        challenge.id,
                        selectedPhotos,
                        teamFolderId
                    );

                    // Create links string
                    photoLinks = uploadedPhotos
                        .map(photo => `https://drive.google.com/file/d/${photo.id}/view`)
                        .join('\n');
                }

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
                    // Update cache with new challenge data (write-through)
                    updateChallengeInCache({
                        challengeId: challenge.id,
                        challengeName: challenge.title,
                        basePoints: challenge.basePoints,
                        location: capturedLocation || '',
                        neighborhoodBonus: neighborhoodBonus,
                        otherBonus: otherBonus,
                        photoLinks: photoLinks,
                        notes: notes
                    });

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
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit to Google Sheets';
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
        } catch (error) {
            console.error('Location error:', error);
            locationInfo.innerHTML = `
                <span class="location-warning">⚠️ Location unavailable (optional)</span>
                <button type="button" class="btn-retry" onclick="window.Challenges.retryLocation(this)">Try Again</button>
            `;
        }

        // Enable submit button regardless of location
        submitBtn.disabled = false;
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
        retryLocation: retryLocation,
        toggleCard: toggleCard,
        loadTeamChallengesCache: loadTeamChallengesCache,
        clearTeamChallengesCache: clearTeamChallengesCache,
        getChallengeFromCache: getChallengeFromCache
    };
})();