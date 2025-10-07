/**
 * Neighborhoods page functionality
 * Handles loading and displaying neighborhood data with borough filtering
 */

(function() {
    'use strict';
    
    let neighborhoodsData = [];
    let filteredNeighborhoods = [];
    let currentBoroughFilter = 'all';
    
    // DOM elements
    let neighborhoodsContainer;
    let filterButtons;
    
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeNeighborhoods();
    });
    
    function initializeNeighborhoods() {
        // Get DOM elements
        neighborhoodsContainer = document.getElementById('neighborhoods-container');
        filterButtons = document.querySelectorAll('.filter-btn');
        
        // Set up event listeners
        setupEventListeners();
        
        // Load neighborhoods data
        loadNeighborhoodsData();
    }
    
    function setupEventListeners() {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const borough = this.getAttribute('data-borough');
                filterByBorough(borough);
                updateActiveFilter(this);
            });
        });
    }
    
    async function loadNeighborhoodsData() {
        try {
            showLoading();
            
            // Try to fetch from server first, fallback to embedded data
            try {
                const response = await fetch('../data/neighborhoods.json');
                if (response.ok) {
                    const data = await response.json();
                    neighborhoodsData = data.neighborhoods || [];
                    filteredNeighborhoods = [...neighborhoodsData];
                    displayNeighborhoods();
                    return;
                }
            } catch (fetchError) {
                console.log('Fetch failed, using embedded data:', fetchError.message);
            }
            
            // Fallback to embedded data for file:// protocol
            loadEmbeddedNeighborhoodsData();
            
        } catch (error) {
            console.error('Error loading neighborhoods data:', error);
            showError('Failed to load neighborhoods. Please try refreshing the page.');
        }
    }
    
    function loadEmbeddedNeighborhoodsData() {
        // Embedded neighborhoods data for file:// protocol compatibility
        const embeddedData = {
            "neighborhoods": [
                {
                    "id": "manhattan-below-central-park",
                    "name": "Manhattan Below Central Park",
                    "borough": "manhattan",
                    "basePoints": 1,
                    "calculatedPoints": 4,
                    "distanceFromMidtown": "close",
                    "areas": [
                        "Financial District-Battery Park City",
                        "Tribeca-Civic Center",
                        "SoHo-Little Italy-Hudson Square",
                        "Greenwich Village",
                        "West Village",
                        "Chinatown-Two Bridges",
                        "Lower East Side",
                        "East Village"
                    ]
                },
                {
                    "id": "upper-west-side",
                    "name": "Upper West Side",
                    "borough": "manhattan",
                    "basePoints": 2,
                    "calculatedPoints": 8,
                    "distanceFromMidtown": "close",
                    "areas": ["Upper West Side"]
                },
                {
                    "id": "upper-east-side",
                    "name": "Upper East Side",
                    "borough": "manhattan",
                    "basePoints": 2,
                    "calculatedPoints": 8,
                    "distanceFromMidtown": "close",
                    "areas": ["Upper East Side"]
                },
                {
                    "id": "astoria",
                    "name": "Astoria",
                    "borough": "queens",
                    "basePoints": 3,
                    "calculatedPoints": 12,
                    "distanceFromMidtown": "medium",
                    "areas": [
                        "Astoria (North)-Ditmars-Steinway",
                        "Old Astoria-Hallets Point",
                        "Astoria (Central)",
                        "Astoria (East)-Woodside (North)",
                        "Astoria Park"
                    ]
                },
                {
                    "id": "flushing",
                    "name": "Flushing",
                    "borough": "queens",
                    "basePoints": 6,
                    "calculatedPoints": 24,
                    "distanceFromMidtown": "far",
                    "areas": [
                        "Murray Hill-Broadway Flushing",
                        "East Flushing",
                        "Flushing-Willets Point",
                        "Flushing Meadows-Corona Park"
                    ]
                },
                {
                    "id": "dumbo",
                    "name": "DUMBO",
                    "borough": "brooklyn",
                    "basePoints": 2,
                    "calculatedPoints": 8,
                    "distanceFromMidtown": "close",
                    "areas": ["Downtown Brooklyn-DUMBO-Boerum Hill"]
                },
                {
                    "id": "williamsburg",
                    "name": "Williamsburg",
                    "borough": "brooklyn",
                    "basePoints": 2,
                    "calculatedPoints": 8,
                    "distanceFromMidtown": "close",
                    "areas": [
                        "Williamsburg",
                        "South Williamsburg",
                        "East Williamsburg"
                    ]
                },
                {
                    "id": "coney-island",
                    "name": "Coney Island",
                    "borough": "brooklyn",
                    "basePoints": 5,
                    "calculatedPoints": 20,
                    "distanceFromMidtown": "far",
                    "areas": ["Coney Island-Sea Gate"]
                },
                {
                    "id": "bronx",
                    "name": "The Bronx",
                    "borough": "bronx",
                    "basePoints": 8,
                    "calculatedPoints": 32,
                    "distanceFromMidtown": "far",
                    "areas": [
                        "Mott Haven-Port Morris",
                        "Melrose",
                        "Hunts Point",
                        "Yankee Stadium-Macombs Dam Park",
                        "University Heights (North)-Fordham",
                        "Riverdale-Spuyten Duyvil",
                        "Pelham Bay-Country Club-City Island",
                        "Co-op City"
                    ]
                },
                {
                    "id": "staten-island",
                    "name": "Staten Island",
                    "borough": "staten-island",
                    "basePoints": 10,
                    "calculatedPoints": 40,
                    "distanceFromMidtown": "far",
                    "areas": [
                        "St. George-New Brighton",
                        "Tompkinsville-Stapleton-Clifton-Fox Hills",
                        "Port Richmond",
                        "Snug Harbor",
                        "Great Kills-Eltingville",
                        "Tottenville-Charleston"
                    ]
                }
            ]
        };
        
        neighborhoodsData = embeddedData.neighborhoods || [];
        filteredNeighborhoods = [...neighborhoodsData];
        displayNeighborhoods();
    }
    
    function filterByBorough(borough) {
        currentBoroughFilter = borough;
        
        if (borough === 'all') {
            filteredNeighborhoods = [...neighborhoodsData];
        } else {
            filteredNeighborhoods = neighborhoodsData.filter(neighborhood => 
                neighborhood.borough === borough
            );
        }
        
        displayNeighborhoods();
    }
    
    function updateActiveFilter(activeButton) {
        filterButtons.forEach(button => {
            button.classList.remove('active');
        });
        activeButton.classList.add('active');
    }
    
    function displayNeighborhoods() {
        if (!neighborhoodsContainer) return;
        
        if (filteredNeighborhoods.length === 0) {
            showNoResults();
            return;
        }
        
        // Commented out borough sections - may come back to this later
        /*
        // Group neighborhoods by borough
        const neighborhoodsByBorough = groupNeighborhoodsByBorough(filteredNeighborhoods);
        
        // Create HTML for each borough
        const boroughsHTML = Object.keys(neighborhoodsByBorough)
            .sort(sortBoroughs)
            .map(borough => createBoroughSection(borough, neighborhoodsByBorough[borough]))
            .join('');
        
        neighborhoodsContainer.innerHTML = boroughsHTML;
        */
        
        neighborhoodsContainer.innerHTML = '';
    }
    
    function groupNeighborhoodsByBorough(neighborhoods) {
        return neighborhoods.reduce((groups, neighborhood) => {
            const borough = neighborhood.borough;
            if (!groups[borough]) {
                groups[borough] = [];
            }
            groups[borough].push(neighborhood);
            return groups;
        }, {});
    }
    
    function sortBoroughs(a, b) {
        const boroughOrder = ['manhattan', 'queens', 'brooklyn', 'bronx', 'staten-island'];
        return boroughOrder.indexOf(a) - boroughOrder.indexOf(b);
    }
    
    function createBoroughSection(borough, neighborhoods) {
        const boroughName = formatBoroughName(borough);
        const totalNeighborhoods = neighborhoods.length;
        const avgPoints = Math.round(
            neighborhoods.reduce((sum, n) => sum + n.calculatedPoints, 0) / totalNeighborhoods
        );
        
        // Sort neighborhoods by calculated points (ascending)
        const sortedNeighborhoods = [...neighborhoods].sort((a, b) => 
            a.calculatedPoints - b.calculatedPoints
        );
        
        const neighborhoodsHTML = sortedNeighborhoods
            .map(neighborhood => createNeighborhoodCard(neighborhood))
            .join('');
        
        return `
            <div class="borough-section borough-${borough}">
                <div class="borough-header">
                    <h3 class="borough-title">${boroughName}</h3>
                    <p class="borough-stats">${totalNeighborhoods} neighborhoods • Average ${avgPoints} points</p>
                </div>
                <div class="neighborhoods-grid">
                    ${neighborhoodsHTML}
                </div>
            </div>
        `;
    }
    
    function createNeighborhoodCard(neighborhood) {
        const areasHTML = neighborhood.areas && neighborhood.areas.length > 0 ? `
            <div class="neighborhood-areas">
                <h4>Areas included:</h4>
                <div class="areas-list">
                    ${neighborhood.areas.map(area => `<span class="area-tag">${area}</span>`).join('')}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="neighborhood-card distance-${neighborhood.distanceFromMidtown}">
                <div class="neighborhood-header">
                    <h4 class="neighborhood-name">${neighborhood.name}</h4>
                    <div class="neighborhood-points">
                        <div class="final-points-display">${neighborhood.calculatedPoints} pts</div>
                        <div class="base-points-display">(${neighborhood.basePoints} × 4)</div>
                    </div>
                </div>
                
                <div class="distance-indicator">
                    ${formatDistanceFromMidtown(neighborhood.distanceFromMidtown)}
                </div>
                
                ${areasHTML}
            </div>
        `;
    }
    
    function formatBoroughName(borough) {
        const boroughNames = {
            'manhattan': 'Manhattan',
            'queens': 'Queens',
            'brooklyn': 'Brooklyn',
            'bronx': 'The Bronx',
            'staten-island': 'Staten Island'
        };
        return boroughNames[borough] || borough;
    }
    
    function formatDistanceFromMidtown(distance) {
        const distanceLabels = {
            'close': 'Close to Midtown',
            'medium': 'Medium Distance',
            'far': 'Far from Midtown'
        };
        return distanceLabels[distance] || distance;
    }
    
    function showLoading() {
        if (neighborhoodsContainer) {
            neighborhoodsContainer.innerHTML = `
                <div class="loading">
                    <p>Loading neighborhoods...</p>
                </div>
            `;
        }
    }
    
    function showError(message) {
        if (neighborhoodsContainer) {
            neighborhoodsContainer.innerHTML = `
                <div class="error">
                    <h3>Error Loading Neighborhoods</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }
    
    function showNoResults() {
        if (neighborhoodsContainer) {
            neighborhoodsContainer.innerHTML = `
                <div class="loading">
                    <h3>No neighborhoods found</h3>
                    <p>Try selecting a different borough filter.</p>
                </div>
            `;
        }
    }
    
    // Expose functions for potential external use
    window.Neighborhoods = {
        filterByBorough: filterByBorough,
        loadNeighborhoodsData: loadNeighborhoodsData
    };
})();