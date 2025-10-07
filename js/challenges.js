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

        return `
            <div class="challenge-card">
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

    // Expose functions for potential external use
    window.Challenges = {
        filterChallenges: filterChallenges,
        clearAllFilters: clearAllFilters,
        loadChallengesData: loadChallengesData
    };
})();