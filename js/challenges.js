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

        // New unified filter UI elements
        filterChips = document.querySelectorAll('.filter-chip');

        // Set up event listeners
        setupEventListeners();

        // Load challenges data
        loadChallengesData();
    }

    function setupEventListeners() {
        // ===== UNIFIED FILTER SYSTEM =====

        // Mobile: FAB and Bottom Sheet
        const mobileFAB = document.getElementById('mobile-search-fab');
        const mobileSheet = document.getElementById('mobile-filters-sheet');
        const mobileOverlay = document.getElementById('mobile-filters-overlay');
        const mobileClose = document.getElementById('mobile-filters-close');
        const mobileSearch = document.getElementById('mobile-search');
        const mobileCompletionFilter = document.getElementById('mobile-completion-filter');
        const mobilePointsSort = document.getElementById('mobile-points-sort');
        const mobileClearBtn = document.getElementById('mobile-clear-filters');
        const mobileApplyBtn = document.getElementById('mobile-apply-filters');
        const mobileFilterChips = document.querySelectorAll('#mobile-filters-sheet .filter-chip');

        // Desktop: Always-visible filters
        const desktopSearch = document.getElementById('desktop-search');
        const desktopCompletionFilter = document.getElementById('desktop-completion-filter');
        const desktopPointsSort = document.getElementById('desktop-points-sort');
        const desktopFilterChips = document.querySelectorAll('.filter-chips-desktop .filter-chip');

        // Mobile FAB - open bottom sheet
        if (mobileFAB) {
            mobileFAB.addEventListener('click', function() {
                mobileSheet.classList.add('active');
                mobileOverlay.classList.add('active');
                setTimeout(() => {
                    if (mobileSearch) mobileSearch.focus();
                }, 300);
            });
        }

        // Close mobile sheet
        function closeMobileSheet() {
            mobileSheet.classList.remove('active');
            mobileOverlay.classList.remove('active');
        }

        if (mobileClose) {
            mobileClose.addEventListener('click', closeMobileSheet);
        }

        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMobileSheet);
        }

        // Mobile: Filter chips
        if (mobileFilterChips && mobileFilterChips.length > 0) {
            mobileFilterChips.forEach(chip => {
                chip.addEventListener('click', function() {
                    const category = this.getAttribute('data-category');

                    // Toggle logic
                    if (currentCategory === category && category !== 'all') {
                        setActiveChip('all', mobileFilterChips);
                        currentCategory = 'all';
                    } else {
                        setActiveChip(category, mobileFilterChips);
                        currentCategory = category;
                    }

                    // Sync desktop chips
                    setActiveChip(currentCategory, desktopFilterChips);
                });
            });
        }

        // Desktop: Filter chips
        if (desktopFilterChips && desktopFilterChips.length > 0) {
            desktopFilterChips.forEach(chip => {
                chip.addEventListener('click', function() {
                    const category = this.getAttribute('data-category');

                    // Toggle logic
                    if (currentCategory === category && category !== 'all') {
                        setActiveChip('all', desktopFilterChips);
                        currentCategory = 'all';
                    } else {
                        setActiveChip(category, desktopFilterChips);
                        currentCategory = category;
                    }

                    // Sync mobile chips and apply immediately
                    setActiveChip(currentCategory, mobileFilterChips);
                    filterChallenges();
                });
            });
        }

        // Mobile: Search input
        if (mobileSearch) {
            let searchTimeout;
            mobileSearch.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (desktopSearch) {
                        desktopSearch.value = mobileSearch.value;
                    }
                }, 300);
            });
        }

        // Desktop: Search input (apply immediately)
        if (desktopSearch) {
            let searchTimeout;
            desktopSearch.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (mobileSearch) {
                        mobileSearch.value = desktopSearch.value;
                    }
                    filterChallenges();
                }, 300);
            });
        }

        // Mobile: Completion filter
        if (mobileCompletionFilter) {
            mobileCompletionFilter.addEventListener('change', function() {
                if (desktopCompletionFilter) {
                    desktopCompletionFilter.value = this.value;
                }
            });
        }

        // Desktop: Completion filter (apply immediately)
        if (desktopCompletionFilter) {
            desktopCompletionFilter.addEventListener('change', function() {
                if (mobileCompletionFilter) {
                    mobileCompletionFilter.value = this.value;
                }
                filterChallenges();
            });
        }

        // Mobile: Points sort
        if (mobilePointsSort) {
            mobilePointsSort.addEventListener('change', function() {
                if (desktopPointsSort) {
                    desktopPointsSort.value = this.value;
                }
            });
        }

        // Desktop: Points sort (apply immediately)
        if (desktopPointsSort) {
            desktopPointsSort.addEventListener('change', function() {
                if (mobilePointsSort) {
                    mobilePointsSort.value = this.value;
                }
                filterChallenges();
            });
        }

        // Mobile: Clear all filters
        if (mobileClearBtn) {
            mobileClearBtn.addEventListener('click', function() {
                clearAllFilters();
                // Sync to desktop
                if (desktopSearch) desktopSearch.value = '';
                if (desktopCompletionFilter) desktopCompletionFilter.value = 'all';
                if (desktopPointsSort) desktopPointsSort.value = 'default';
            });
        }

        // Mobile: Apply filters and close
        if (mobileApplyBtn) {
            mobileApplyBtn.addEventListener('click', function() {
                filterChallenges();
                closeMobileSheet();
            });
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
        // Get values from both mobile and desktop (prefer desktop if present, as it's being actively used)
        const desktopSearch = document.getElementById('desktop-search');
        const mobileSearch = document.getElementById('mobile-search');
        const desktopCompletion = document.getElementById('desktop-completion-filter');
        const mobileCompletion = document.getElementById('mobile-completion-filter');
        const desktopPoints = document.getElementById('desktop-points-sort');
        const mobilePoints = document.getElementById('mobile-points-sort');

        const searchTerm = (desktopSearch?.value || mobileSearch?.value || '').toLowerCase().trim();
        const selectedCategory = currentCategory || 'all';
        const sortOrder = desktopPoints?.value || mobilePoints?.value || 'default';
        const completionStatus = desktopCompletion?.value || mobileCompletion?.value || 'all';

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
    function setActiveChip(category, chipList = null) {
        // If no chipList provided, update all chips (both mobile and desktop)
        const chipsToUpdate = chipList || document.querySelectorAll('.filter-chip');

        chipsToUpdate.forEach(chip => {
            if (chip.getAttribute('data-category') === category) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Update chip counts (both mobile and desktop)
    function updateChipCounts() {
        if (!challengesData || challengesData.length === 0) return;

        const counts = {
            all: challengesData.length,
            easy: challengesData.filter(c => c.category === 'easy').length,
            medium: challengesData.filter(c => c.category === 'medium').length,
            hard: challengesData.filter(c => c.category === 'hard').length,
            'location-specific': challengesData.filter(c => c.category === 'location-specific').length
        };

        // Update desktop counts
        const desktopCountAll = document.getElementById('desktop-count-all');
        const desktopCountEasy = document.getElementById('desktop-count-easy');
        const desktopCountMedium = document.getElementById('desktop-count-medium');
        const desktopCountHard = document.getElementById('desktop-count-hard');
        const desktopCountLocation = document.getElementById('desktop-count-location');

        if (desktopCountAll) desktopCountAll.textContent = `(${counts.all})`;
        if (desktopCountEasy) desktopCountEasy.textContent = `(${counts.easy})`;
        if (desktopCountMedium) desktopCountMedium.textContent = `(${counts.medium})`;
        if (desktopCountHard) desktopCountHard.textContent = `(${counts.hard})`;
        if (desktopCountLocation) desktopCountLocation.textContent = `(${counts['location-specific']})`;

        // Update mobile counts
        const mobileCountAll = document.getElementById('mobile-count-all');
        const mobileCountEasy = document.getElementById('mobile-count-easy');
        const mobileCountMedium = document.getElementById('mobile-count-medium');
        const mobileCountHard = document.getElementById('mobile-count-hard');
        const mobileCountLocation = document.getElementById('mobile-count-location');

        if (mobileCountAll) mobileCountAll.textContent = `(${counts.all})`;
        if (mobileCountEasy) mobileCountEasy.textContent = `(${counts.easy})`;
        if (mobileCountMedium) mobileCountMedium.textContent = `(${counts.medium})`;
        if (mobileCountHard) mobileCountHard.textContent = `(${counts.hard})`;
        if (mobileCountLocation) mobileCountLocation.textContent = `(${counts['location-specific']})`;
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
        // Clear both mobile and desktop
        const desktopSearch = document.getElementById('desktop-search');
        const mobileSearch = document.getElementById('mobile-search');
        const desktopCompletion = document.getElementById('desktop-completion-filter');
        const mobileCompletion = document.getElementById('mobile-completion-filter');
        const desktopPoints = document.getElementById('desktop-points-sort');
        const mobilePoints = document.getElementById('mobile-points-sort');

        if (desktopSearch) desktopSearch.value = '';
        if (mobileSearch) mobileSearch.value = '';
        if (desktopCompletion) desktopCompletion.value = 'all';
        if (mobileCompletion) mobileCompletion.value = 'all';
        if (desktopPoints) desktopPoints.value = 'default';
        if (mobilePoints) mobilePoints.value = 'default';

        // Reset category to 'all'
        currentCategory = 'all';
        setActiveChip('all');

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
                        <label for="neighborhood-select">Neighborhoods Visited (max 8):</label>
                        <select id="neighborhood-select" size="6" style="width: 100%; padding: 4px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px;">
                        </select>
                        <div id="selected-neighborhoods" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;"></div>
                        <small style="display: block; margin-top: 8px; color: #666; font-size: 13px;">Tap a neighborhood to add it. Bonus points calculated on submission based on first-time visits.</small>
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

        // Multi-neighborhood selection with always-visible scrollable list
        const neighborhoodSelect = modal.querySelector('#neighborhood-select');
        const selectedNeighborhoodsContainer = modal.querySelector('#selected-neighborhoods');
        let neighborhoodsData = [];
        let selectedNeighborhoods = []; // Simple array of neighborhood names
        const MAX_NEIGHBORHOODS = 8;

        async function loadNeighborhoods() {
            try {
                const data = await window.SheetsAPI.readSheetData('Neighborhoods!A2:C');
                neighborhoodsData = data.map(row => ({
                    name: row[0] || '',
                    borough: row[1] || '',
                    points: parseInt(row[2]) || 0
                }));

                // Group by borough for better UX
                const byBorough = neighborhoodsData.reduce((acc, n) => {
                    if (!acc[n.borough]) acc[n.borough] = [];
                    acc[n.borough].push(n);
                    return acc;
                }, {});

                // Clear and populate select (no placeholder option)
                neighborhoodSelect.innerHTML = '';

                Object.keys(byBorough).sort().forEach(borough => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = borough.charAt(0).toUpperCase() + borough.slice(1);

                    byBorough[borough].forEach(n => {
                        const option = document.createElement('option');
                        option.value = n.name;
                        option.textContent = n.name;
                        optgroup.appendChild(option);
                    });

                    neighborhoodSelect.appendChild(optgroup);
                });

                // Load existing neighborhoods if editing
                if (isEditing && existingData?.location) {
                    const existingLocations = existingData.location.split(',').map(l => l.trim()).filter(l => l);
                    existingLocations.forEach(loc => {
                        if (loc && neighborhoodsData.find(n => n.name === loc)) {
                            addNeighborhood(loc);
                        }
                    });
                }
            } catch (err) {
                console.error('Error loading neighborhoods:', err);
                neighborhoodSelect.innerHTML = '<option value="">Error loading neighborhoods</option>';
            }
        }

        function addNeighborhood(name) {
            // Check if already added
            if (selectedNeighborhoods.includes(name)) {
                window.toast?.info('Neighborhood already added!');
                return;
            }

            // Check max limit
            if (selectedNeighborhoods.length >= MAX_NEIGHBORHOODS) {
                window.toast?.warning(`Maximum ${MAX_NEIGHBORHOODS} neighborhoods allowed`);
                return;
            }

            selectedNeighborhoods.push(name);
            renderNeighborhoodChips();
        }

        function removeNeighborhood(name) {
            selectedNeighborhoods = selectedNeighborhoods.filter(n => n !== name);
            renderNeighborhoodChips();
        }

        function renderNeighborhoodChips() {
            selectedNeighborhoodsContainer.innerHTML = '';

            selectedNeighborhoods.forEach(name => {
                const chip = document.createElement('div');
                chip.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    min-height: 44px;
                    border-radius: 22px;
                    font-size: 14px;
                    font-weight: 600;
                    background-color: var(--secondary-color);
                    color: var(--dark-color);
                    border: 2px solid var(--secondary-dark);
                `;

                const label = document.createElement('span');
                label.textContent = name;
                chip.appendChild(label);

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.textContent = '×';
                removeBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 24px;
                    font-weight: bold;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                `;
                removeBtn.addEventListener('click', () => removeNeighborhood(name));
                chip.appendChild(removeBtn);

                selectedNeighborhoodsContainer.appendChild(chip);
            });
        }

        // Handle neighborhood selection
        neighborhoodSelect.addEventListener('change', function() {
            const selectedOption = this.selectedOptions[0];
            if (!selectedOption || !selectedOption.value) return;

            if (selectedNeighborhoods.length >= MAX_NEIGHBORHOODS) {
                window.toast?.warning(`Maximum ${MAX_NEIGHBORHOODS} neighborhoods allowed`);
                this.selectedIndex = -1; // Deselect
                return;
            }

            addNeighborhood(selectedOption.value);

            // Deselect after adding
            this.selectedIndex = -1;
        });

        // Load neighborhoods
        loadNeighborhoods();

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

            // Get comma-separated neighborhood names
            const neighborhoodNames = selectedNeighborhoods.join(', ');
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
                // Store comma-separated neighborhoods (bonus calculated on-the-fly when displaying)
                const success = await window.SheetsAPI.updateOrAddChallengeByName(
                    teamName,
                    challenge.title,
                    {
                        location: neighborhoodNames, // Comma-separated neighborhood names
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
                        location: neighborhoodNames || '',
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