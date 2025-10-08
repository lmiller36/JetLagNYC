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
    let moreFiltersBtn;
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
        moreFiltersBtn = document.getElementById('more-filters');
        applyFiltersBtn = document.getElementById('apply-filters');
        filterChips = document.querySelectorAll('.filter-chip');

        // Set up event listeners
        setupEventListeners();

        // Load challenges data
        loadChallengesData();
    }

    function setupEventListeners() {
        // Filter chips
        if (filterChips && filterChips.length > 0) {
            console.log('Setting up filter chip listeners for', filterChips.length, 'chips');
            filterChips.forEach(chip => {
                chip.addEventListener('click', function() {
                    const category = this.getAttribute('data-category');
                    console.log('Filter chip clicked:', category);
                    setActiveChip(category);
                    currentCategory = category;
                    filterChallenges();
                });
            });
        } else {
            console.warn('No filter chips found!');
        }

        // Bottom sheet setup
        const searchSheet = document.getElementById('search-sheet');
        const searchOverlay = document.getElementById('search-overlay');
        const searchSheetClose = document.getElementById('search-sheet-close');
        const filtersSheet = document.getElementById('filters-sheet');
        const filtersOverlay = document.getElementById('filters-overlay');
        const filtersSheetClose = document.getElementById('filters-sheet-close');

        // Search toggle - opens bottom sheet
        if (searchToggle) {
            searchToggle.addEventListener('click', function() {
                searchSheet.classList.add('active');
                searchOverlay.classList.add('active');
                // Small delay to ensure the sheet is visible before focusing
                setTimeout(() => {
                    if (searchInput) searchInput.focus();
                }, 300);
            });
        }

        // Close search sheet
        function closeSearchSheet() {
            searchSheet.classList.remove('active');
            searchOverlay.classList.remove('active');
        }

        if (searchSheetClose) {
            searchSheetClose.addEventListener('click', closeSearchSheet);
        }

        if (searchOverlay) {
            searchOverlay.addEventListener('click', closeSearchSheet);
        }

        // More filters toggle - opens bottom sheet
        if (moreFiltersBtn) {
            moreFiltersBtn.addEventListener('click', function() {
                filtersSheet.classList.add('active');
                filtersOverlay.classList.add('active');
            });
        }

        // Close filters sheet
        function closeFiltersSheet() {
            filtersSheet.classList.remove('active');
            filtersOverlay.classList.remove('active');
        }

        if (filtersSheetClose) {
            filtersSheetClose.addEventListener('click', closeFiltersSheet);
        }

        if (filtersOverlay) {
            filtersOverlay.addEventListener('click', closeFiltersSheet);
        }

        // Apply filters button - close sheet and apply
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', function() {
                closeFiltersSheet();
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

        // Display all challenges
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
                        ${isCompleted ? '✏️ Edit' : 'Complete & Upload'}
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
            window.toast.error('Challenge not found');
            return;
        }

        // Check if user is signed in and has a team
        // Check both in-memory and localStorage
        const teamName = window.Team?.getCurrentTeam() || localStorage.getItem('scavenger_team');
        if (!teamName) {
            window.toast.warning('Please join or create a team first on the Team page');
            return;
        }

        // Check if authenticated
        if (typeof gapi === 'undefined' || !gapi.client?.getToken()) {
            window.toast.error('Please sign in with Google first');
            return;
        }

        // Check if challenge is already completed
        const status = getChallengeStatus(challengeId);
        const existingData = status === 'completed' ? getChallengeFromCache(challengeId) : null;

        // Show completion modal
        showCompletionModal(challenge, teamName, existingData);
    }

    function getChallengeFromCache(challengeId) {
        if (!teamChallengesCache) return null;
        return teamChallengesCache.find(c => c.challengeId === challengeId);
    }

    async function showCompletionModal(challenge, teamName, existingData = null) {
        // Initialize location manager
        const locationManager = new window.LocationManager();

        const isEditing = existingData !== null;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${isEditing ? 'Edit Challenge' : 'Complete Challenge'}</h2>
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
                        <input type="number" id="neighborhood-bonus" value="${existingData?.neighborhoodBonus || 0}" min="0">
                    </div>

                    <div class="form-group">
                        <label for="other-bonus">Other Bonus Points:</label>
                        <input type="number" id="other-bonus" value="${existingData?.otherBonus || 0}" min="0">
                    </div>
                    
                    <div class="form-group">
                        <label for="photo-upload">Challenge Photos:</label>
                        <input type="file" id="photo-upload" accept="image/*" multiple style="display: none;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('photo-upload').click()">
                            📷 Select Photos
                        </button>
                        <div id="photo-preview" class="photo-preview-grid"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" placeholder="Any additional notes about this challenge">${existingData?.notes || ''}</textarea>
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
        let existingPhotoLinks = [];

        // Parse existing photos if editing
        if (isEditing && existingData?.photoLinks) {
            existingPhotoLinks = existingData.photoLinks.split('\n').filter(link => link.trim());
        }

        async function renderPhotoPreview() {
            photoPreview.innerHTML = '';

            // Show existing photos from Drive - fetch in parallel for speed
            const photoPromises = existingPhotoLinks.map(async (link, i) => {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-preview-item';

                // Extract file ID from Drive link
                const fileIdMatch = link.match(/\/d\/([^\/]+)/);

                if (fileIdMatch) {
                    const fileId = fileIdMatch[1];

                    // Create placeholder first
                    photoItem.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0;">
                            <span>...</span>
                        </div>
                        <button type="button" class="remove-photo">×</button>
                    `;
                    photoPreview.appendChild(photoItem);

                    // Fetch thumbnail using Drive API with auth and convert to data URL
                    try {
                        const token = gapi.client.getToken();

                        // Fetch the file content directly (will download full size, so we downscale aggressively)
                        const response = await fetch(
                            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${token.access_token}`
                                }
                            }
                        );

                        if (response.ok) {
                            const blob = await response.blob();

                            // Create a thumbnail by loading into canvas and downscaling
                            const dataUrl = await new Promise((resolve, reject) => {
                                const img = new Image();
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');

                                    // Downscale to max 200px for faster loading
                                    const maxSize = 200;
                                    let width = img.width;
                                    let height = img.height;

                                    if (width > height && width > maxSize) {
                                        height = (height / width) * maxSize;
                                        width = maxSize;
                                    } else if (height > maxSize) {
                                        width = (width / height) * maxSize;
                                        height = maxSize;
                                    }

                                    canvas.width = width;
                                    canvas.height = height;
                                    ctx.drawImage(img, 0, 0, width, height);
                                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                                };
                                img.onerror = reject;
                                img.src = URL.createObjectURL(blob);
                            });

                            photoItem.innerHTML = `
                                <img src="${dataUrl}"
                                     alt="Photo ${i + 1}"
                                     style="cursor: pointer;"
                                     onclick="window.open('${link}', '_blank')">
                                <button type="button" class="remove-photo">×</button>
                            `;
                        } else {
                            // Fallback to broken image
                            photoItem.innerHTML = `
                                <img src="" alt="Photo ${i + 1}" style="cursor: pointer;" onclick="window.open('${link}', '_blank')">
                                <button type="button" class="remove-photo">×</button>
                            `;
                        }
                    } catch (error) {
                        console.error('Error fetching thumbnail:', error);
                        photoItem.innerHTML = `
                            <img src="" alt="Photo ${i + 1}" style="cursor: pointer;" onclick="window.open('${link}', '_blank')">
                            <button type="button" class="remove-photo">×</button>
                        `;
                    }

                    // Attach remove handler (capture index in closure)
                    const removeBtn = photoItem.querySelector('.remove-photo');
                    const currentIndex = i;
                    removeBtn.addEventListener('click', () => {
                        existingPhotoLinks.splice(currentIndex, 1);
                        renderPhotoPreview();
                    });
                }
            });

            // Wait for all photos to load
            await Promise.all(photoPromises);

            // Show newly selected photos
            selectedPhotos.forEach((photo, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'photo-preview-item';
                    photoItem.innerHTML = `
                        <img src="${e.target.result}" alt="New photo ${index + 1}">
                        <button type="button" class="remove-photo" data-new-index="${index}">×</button>
                    `;
                    photoPreview.appendChild(photoItem);

                    // Add remove handler for new photo
                    photoItem.querySelector('.remove-photo').addEventListener('click', () => {
                        selectedPhotos.splice(index, 1);
                        renderPhotoPreview();
                    });
                };
                reader.readAsDataURL(photo);
            });
        }

        // Render existing photos if editing
        if (isEditing) {
            renderPhotoPreview();
        }

        photoInput.addEventListener('change', (e) => {
            // Add to existing photos, don't replace
            selectedPhotos.push(...Array.from(e.target.files));
            renderPhotoPreview();
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
                let newPhotoLinks = [];

                // Upload NEW photos to Google Drive if any selected
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

                    // Create links array from uploaded photos
                    newPhotoLinks = uploadedPhotos
                        .map(photo => `https://drive.google.com/file/d/${photo.id}/view`);
                }

                // Merge existing photos with new ones
                const allPhotoLinks = [...existingPhotoLinks, ...newPhotoLinks];
                const photoLinks = allPhotoLinks.join('\n');

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
                    window.toast.success(isEditing ? 'Challenge updated successfully!' : 'Challenge completed and uploaded!');
                } else {
                    window.toast.error('Error uploading to Google Sheets. Please try again.');
                }
            } catch (error) {
                console.error('Error completing challenge:', error);
                window.toast.error('Error uploading to Google Sheets: ' + error.message);
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