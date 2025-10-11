/**
 * Neighborhoods page functionality
 * Handles loading and displaying neighborhood data with borough filtering and Apple MapKit integration
 */

(function() {
    'use strict';
    
    let neighborhoodsData = [];
    let filteredNeighborhoods = [];
    let currentBoroughFilter = 'all';
    let map = null;
    let mapOverlays = [];
    
    // DOM elements
    let neighborhoodsContainer;
    let filterButtons;
    let mapContainer;
    
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeNeighborhoods();
    });

    // Listen for GAPI initialization
    window.addEventListener('gapiInitComplete', function() {
        console.log('GAPI init complete, populating neighborhoods table');
        populateNeighborhoodsTable();
    });

    // Listen for auth completion to reload data
    window.addEventListener('sheetsAuthComplete', function() {
        console.log('Auth complete, reloading neighborhoods from sheets...');
        populateNeighborhoodsTable();
    });
    
    function initializeNeighborhoods() {
        // Get DOM elements
        neighborhoodsContainer = document.getElementById('neighborhoods-container');
        filterButtons = document.querySelectorAll('.filter-btn');
        mapContainer = document.getElementById('map-container');

        // Set up event listeners
        setupEventListeners();

        // Initialize Apple MapKit with a delay to ensure scripts are loaded
        setTimeout(() => {
            if (typeof mapkit !== 'undefined') {
                initializeMap();
            } else {
                console.log('Apple MapKit not available, waiting...');
                // Try again after a longer delay
                setTimeout(() => {
                    if (typeof mapkit !== 'undefined') {
                        initializeMap();
                    } else {
                        console.error('Apple MapKit failed to load');
                        showMapError('Apple MapKit failed to load. Please check your internet connection.');
                    }
                }, 2000);
            }
        }, 500);
    }

    /**
     * Attach export button event listener
     */
    function attachExportButtonListener() {
        const exportCsvBtn = document.getElementById('export-neighborhoods-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                exportNeighborhoodsCSV();
            });
        }
    }

    async function populateNeighborhoodsTable() {
        const tableContainer = document.querySelector('.neighborhoods-table');
        if (!tableContainer) {
            console.log('Table container not found');
            return;
        }

        console.log('Populating neighborhoods table...');

        // Check if GAPI is loaded
        if (typeof gapi === 'undefined' || !gapi.client) {
            console.log('GAPI not loaded yet, showing sign-in prompt');
            tableContainer.innerHTML = window.createSignInModal
                ? window.createSignInModal('Sign in to view neighborhood bonus points.')
                : '<h4>Neighborhood Bonus Points</h4><p>Please sign in to view neighborhood data</p>';
            return;
        }

        // Check if user is authenticated
        const token = gapi.client.getToken();
        if (!window.readSheetData || token === null) {
            console.log('User not authenticated, showing sign-in prompt');
            tableContainer.innerHTML = window.createSignInModal
                ? window.createSignInModal('Sign in to view neighborhood bonus points.')
                : '<h4>Neighborhood Bonus Points</h4><p>Please sign in to view neighborhood data</p>';
            return;
        }

        // Show loading state
        tableContainer.innerHTML = `
            <h4>Neighborhood Bonus Points</h4>
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <p>Loading neighborhoods...</p>
            </div>
        `;

        try {
            console.log('Loading...');
            const sheetData = await readSheetData('Neighborhoods!A2:C');
            console.log('Loaded sheet data:', sheetData);

            const data = sheetData.map(row => ({
                name: row[0] || '',
                borough: (row[1] || '').toLowerCase(),
                points: parseInt(row[2]) || 0
            }));

            // Group by borough (lowercase keys)
            const boroughGroups = data.reduce((acc, neighborhood) => {
                const borough = neighborhood.borough;
                if (!acc[borough]) acc[borough] = [];
                acc[borough].push(neighborhood);
                return acc;
            }, {});

            console.log('Borough groups:', boroughGroups);

            // Generate HTML for dropdowns
            const boroughOrder = [
                { key: 'manhattan', name: 'Manhattan' },
                { key: 'queens', name: 'Queens' },
                { key: 'brooklyn', name: 'Brooklyn' },
                { key: 'bronx', name: 'Bronx' },
                { key: 'staten island', name: 'Staten Island' }
            ];

            // Check if we should show export button (localhost only)
            const isLocalhost = window.location.hostname === 'localhost' ||
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname === '';

            let html = '<h4>Neighborhood Bonus Points</h4>';
            if (isLocalhost) {
                html += '<button id="export-neighborhoods-csv-btn" class="btn-refresh-status" style="margin-bottom: 20px;" title="Export neighborhoods to CSV">📥 Export CSV</button>';
            }

            boroughOrder.forEach(borough => {
                if (boroughGroups[borough.key] && boroughGroups[borough.key].length > 0) {
                    html += `
                        <div class="borough-dropdown">
                            <details>
                                <summary>${borough.name}</summary>
                                <ul class="neighborhood-list">
                                    ${boroughGroups[borough.key].map(n => `
                                        <li>
                                            <span class="neighborhood-name">${n.name}</span>
                                            <span class="points">${n.points === 0 ? 'No bonus' : n.points + ' pts'}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </details>
                        </div>
                    `;
                }
            });

            tableContainer.innerHTML = html;
            console.log('Neighborhoods table populated successfully');

            // Attach export CSV button event listener (if button exists)
            if (isLocalhost) {
                attachExportButtonListener();
            }
        } catch (error) {
            console.error('Error loading neighborhoods table:', error);
            tableContainer.innerHTML = `
                <h4>Neighborhood Bonus Points</h4>
                <div class="error">
                    <p>Error loading neighborhood data. Please try refreshing the page.</p>
                </div>
            `;
        }
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

    /**
     * Export neighborhoods data to CSV
     */
    async function exportNeighborhoodsCSV() {
        try {
            // Check if data is available
            if (!window.readSheetData) {
                alert('Please sign in first to export neighborhoods data');
                return;
            }

            // Fetch fresh data from sheets
            const sheetData = await readSheetData('Neighborhoods!A2:C');

            if (!sheetData || sheetData.length === 0) {
                alert('No neighborhoods data available to export');
                return;
            }

            // CSV header
            const headers = ['name', 'borough', 'points'];
            const csvRows = [headers.join(',')];

            // Add data rows
            sheetData.forEach(row => {
                const rowData = [
                    escapeCSV(row[0] || ''),
                    escapeCSV(row[1] || ''),
                    row[2] || 0
                ];
                csvRows.push(rowData.join(','));
            });

            const csvContent = csvRows.join('\n');

            // Download the CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'neighborhoods.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('Exported neighborhoods CSV');
        } catch (error) {
            console.error('Error exporting neighborhoods CSV:', error);
            alert('Error exporting neighborhoods data: ' + error.message);
        }
    }

    /**
     * Escape CSV field
     */
    function escapeCSV(field) {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * Initialize Apple MapKit map
     */
    function initializeMap() {
        console.log('Attempting to initialize map...');
        console.log('mapContainer:', mapContainer);
        console.log('mapkit available:', typeof mapkit !== 'undefined');

        if (!mapContainer) {
            console.error('Map container not found - looking for #map-container');
            showMapError('Map container not found');
            return;
        }

        // Check if MapKit is available
        if (typeof mapkit === 'undefined') {
            console.error('Apple MapKit not loaded');
            showMapError('Apple MapKit not available');
            return;
        }

        try {
            console.log('Initializing MapKit...');
            
            // Check if MapKit is already initialized
            if (!mapkit.isInitialized) {
                // Initialize MapKit with a JWT token
                mapkit.init({
                    authorizationCallback: function(done) {
                        console.log('MapKit authorization callback called');
                        // Using the updated token from the system reminder
                        const token = 'eyJraWQiOiJHMlNKSDlNM1hHIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJHQ0I1U1pKNDI1IiwiaWF0IjoxNzYwMTQ4MTU3LCJleHAiOjE3NjA3NzA3OTl9.82CHigYnTe9H533fQlPWQvFlcKCfNgMMyiBjoPCOunK6yd1UQVLIchCqQbHqenyuzMU0sVUGdXabsfXk7F5w9A';
                        console.log('Providing token to MapKit');
                        done(token);
                    },
                    language: 'en'
                });
            } else {
                console.log('MapKit already initialized');
            }

            console.log('MapKit initialized, creating map...');

            // Clear the placeholder content
            mapContainer.innerHTML = '';

            // Create map with a region that focuses on NYC area
            const nycRegion = new mapkit.CoordinateRegion(
                new mapkit.Coordinate(40.7589, -73.9851), // NYC center
                new mapkit.CoordinateSpan(0.3, 0.3) // Much smaller span for NYC focus
            );

            map = new mapkit.Map(mapContainer, {
                region: nycRegion,
                mapType: mapkit.Map.MapTypes.Standard,
                showsMapTypeControl: true,
                showsZoomControl: true,
                showsUserLocationControl: true,
                showsCompass: mapkit.FeatureVisibility.Adaptive,
                isZoomEnabled: true,
                isScrollEnabled: true,
                isPitchEnabled: false,
                isRotationEnabled: false
            });

            console.log('Apple Map created successfully');
            
            // Ensure map container has relative positioning for absolute children
            if (mapContainer.style.position !== 'relative') {
                mapContainer.style.position = 'relative';
                }
            
            // Add event listeners
            map.addEventListener('error', function(event) {
                console.error('Map error:', event);
                showMapError('Map failed to load');
            });
            
            // Add select event listener to the map for overlay selection
            
            map.addEventListener('select', function(event) {
                if (event.overlay && event.overlay._neighborhood) {
                    showNeighborhoodPopup(event.overlay._neighborhood, event.overlay);
                }
            });
            
            // Load GeoJSON overlays after a short delay
            loadGeoJSONOverlays();
            
            // Points legend will be added after overlays are loaded
            
        } catch (error) {
            console.error('Error initializing Apple Map:', error);
            showMapError('Failed to initialize map: ' + error.message);
        }
    }

    /**
     * Load all GeoJSON files and add them as overlays using neighborhood data
     */
    async function loadGeoJSONOverlays() {
        if (!window.NEIGHBORHOOD_DATA || !window.NEIGHBORHOOD_DATA.neighborhoods) {
            console.error('Neighborhood data not loaded');
            return;
        }

        const neighborhoods = window.NEIGHBORHOOD_DATA.neighborhoods;
        const pointColors = window.NEIGHBORHOOD_DATA.pointColors;

        const loadPromises = neighborhoods.map((neighborhood) => {
            const color = pointColors[neighborhood.pointValue.toString()] || '#CCCCCC';
            return loadGeoJSONFile(neighborhood, color).catch(error => {
                console.warn(`Failed to load ${neighborhood.fileName}:`, error);
            });
        });

        await Promise.all(loadPromises);
        
        // Add points legend after all overlays are loaded
        setTimeout(() => {
            addPointsLegend();
        }, 500);
    }

    /**
     * Load a single GeoJSON file and add it to the map
     */
    async function loadGeoJSONFile(neighborhood, color) {
        try {
            const response = await fetch(`../Final_Shapes/${neighborhood.fileName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geoJSONData = await response.json();
            
            // Convert GeoJSON to MapKit overlay
            if (geoJSONData.features && geoJSONData.features.length > 0) {
                geoJSONData.features.forEach(feature => {
                    if (feature.geometry && feature.geometry.type === 'Polygon') {
                        addPolygonOverlay(feature, color, neighborhood);
                    } else if (feature.geometry && feature.geometry.type === 'MultiPolygon') {
                        addMultiPolygonOverlay(feature, color, neighborhood);
                    }
                });
            }
            
            
        } catch (error) {
            console.error(`Error loading ${neighborhood.fileName}:`, error);
        }
    }

    /**
     * Add a polygon overlay to the map
     */
    function addPolygonOverlay(feature, color, neighborhood) {
        try {
            const coordinates = feature.geometry.coordinates[0]; // First ring of polygon
            const points = coordinates.map(coord => 
                new mapkit.Coordinate(coord[1], coord[0]) // lat, lng
            );
            
            const polygon = new mapkit.PolygonOverlay(points, {
                style: new mapkit.Style({
                    fillColor: color,
                    fillOpacity: 0.4,
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    lineWidth: 2
                })
            });
            
            // Add neighborhood metadata
            polygon._neighborhood = neighborhood;
            polygon._geoProperties = feature.properties;
            
            map.addOverlay(polygon);
            mapOverlays.push(polygon);
            
        } catch (error) {
            console.error(`Error adding polygon overlay for ${neighborhood.fileName}:`, error);
        }
    }

    /**
     * Add a multi-polygon overlay to the map
     */
    function addMultiPolygonOverlay(feature, color, neighborhood) {
        try {
            feature.geometry.coordinates.forEach(polygonCoords => {
                const coordinates = polygonCoords[0]; // First ring of each polygon
                const points = coordinates.map(coord => 
                    new mapkit.Coordinate(coord[1], coord[0]) // lat, lng
                );
                
                const polygon = new mapkit.PolygonOverlay(points, {
                    style: new mapkit.Style({
                        fillColor: color,
                        fillOpacity: 0.4,
                        strokeColor: color,
                        strokeOpacity: 0.9,
                        lineWidth: 2
                    })
                });
                
                // Add neighborhood metadata
                polygon._neighborhood = neighborhood;
                polygon._geoProperties = feature.properties;
                
                map.addOverlay(polygon);
                mapOverlays.push(polygon);
            });
            
        } catch (error) {
            console.error(`Error adding multi-polygon overlay for ${neighborhood.fileName}:`, error);
        }
    }

    /**
     * Calculate the centroid (center point) of a polygon using the shoelace formula
     * This gives a much better center than simple point averaging
     */
    function calculatePolygonCentroid(points) {
        if (!points || points.length < 3) {
            return null;
        }
        
        let area = 0;
        let centroidLat = 0;
        let centroidLng = 0;
        
        // Use the shoelace formula to calculate area and centroid
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            
            const xi = points[i].longitude;
            const yi = points[i].latitude;
            const xj = points[j].longitude;
            const yj = points[j].latitude;
            
            // Check for valid coordinates
            if (typeof xi !== 'number' || typeof yi !== 'number' || 
                typeof xj !== 'number' || typeof yj !== 'number' ||
                isNaN(xi) || isNaN(yi) || isNaN(xj) || isNaN(yj)) {
                continue;
            }
            
            const crossProduct = xi * yj - xj * yi;
            area += crossProduct;
            centroidLat += (yi + yj) * crossProduct;
            centroidLng += (xi + xj) * crossProduct;
        }
        
        area = area / 2;
        
        if (Math.abs(area) < 1e-10) {
            // Area is too small or zero, fall back to simple averaging
            console.log('Polygon area too small, using simple point averaging');
            let totalLat = 0, totalLng = 0, validPoints = 0;
            
            for (const point of points) {
                if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number' &&
                    !isNaN(point.latitude) && !isNaN(point.longitude)) {
                    totalLat += point.latitude;
                    totalLng += point.longitude;
                    validPoints++;
                }
            }
            
            if (validPoints > 0) {
                return {
                    latitude: totalLat / validPoints,
                    longitude: totalLng / validPoints
                };
            }
            return null;
        }
        
        centroidLat = centroidLat / (6 * area);
        centroidLng = centroidLng / (6 * area);
        
        // Validate the result
        if (isNaN(centroidLat) || isNaN(centroidLng)) {
            console.log('Centroid calculation resulted in NaN, falling back to point averaging');
            let totalLat = 0, totalLng = 0, validPoints = 0;
            
            for (const point of points) {
                if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number' &&
                    !isNaN(point.latitude) && !isNaN(point.longitude)) {
                    totalLat += point.latitude;
                    totalLng += point.longitude;
                    validPoints++;
                }
            }
            
            if (validPoints > 0) {
                return {
                    latitude: totalLat / validPoints,
                    longitude: totalLng / validPoints
                };
            }
            return null;
        }
        
        return {
            latitude: centroidLat,
            longitude: centroidLng
        };
    }

    /**
     * Show neighborhood popup card when clicked
     */
    function showNeighborhoodPopup(neighborhood, polygon) {
        // Note: cleanup is handled in createCardModal()
        
        // Get the color for this point value
        const pointColors = window.NEIGHBORHOOD_DATA.pointColors;
        const color = pointColors[neighborhood.pointValue.toString()] || '#CCCCCC';
        
        // Calculate centroid of polygon for popup positioning
        let centerLat = 40.7589; // Default to NYC center
        let centerLng = -73.9851;
        
        
        if (polygon.points[0] && polygon.points[0].length >= 3) {
            const centroid = calculatePolygonCentroid(polygon.points[0]);
            if (centroid) {
                centerLat = centroid.latitude;
                centerLng = centroid.longitude;
            }
        }
        
        // Create the popup content
        const popupContent = `
            <div class="neighborhood-popup-card" style="
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 16px;
                max-width: 280px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                ">
                    <div style="
                        width: 20px;
                        height: 20px;
                        background-color: ${color};
                        border-radius: 50%;
                        margin-right: 8px;
                        border: 2px solid white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    "></div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                    ">${neighborhood.displayName}</h3>
                </div>
                
                <div style="margin-bottom: 8px;">
                    <span style="
                        display: inline-block;
                        background-color: ${color};
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                        margin-right: 8px;
                    ">${neighborhood.pointValue} Points</span>
                    <span style="
                        color: #666;
                        font-size: 14px;
                    ">${neighborhood.borough}</span>
                </div>
                
                <p style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.4;
                    color: #555;
                ">${neighborhood.description}</p>
                
                <button onclick="removeNeighborhoodPopup()" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    color: #999;
                    cursor: pointer;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                " onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
            </div>
        `;
        
        // Validate coordinates before creating annotation
        if (typeof centerLat !== 'number' || typeof centerLng !== 'number' || 
            isNaN(centerLat) || isNaN(centerLng)) {
            centerLat = 40.7589; // NYC center fallback
            centerLng = -73.9851;
        }
        
        // Create a card modal on the right side of the map
        createCardModal(neighborhood, color);
        
    }
    
    /**
     * Create a card modal popup on the right side of the map
     */
    function createCardModal(neighborhood, color) {
        // Completely clean slate - remove everything modal-related
        cleanupAllModals();
        
        // Check if mobile
        const isMobile = window.innerWidth <= 768;
        
        // Get map container bounds to position relative to map
        const mapRect = mapContainer.getBoundingClientRect();
        
        // Create modal element
        const modal = document.createElement('div');
        modal.id = 'neighborhood-modal';
        if (isMobile) {
            // Mobile: Bottom sheet style
            modal.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                max-height: 50vh;
                background: white;
                border-radius: 16px 16px 0 0;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
                z-index: 1500;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                transform: translateY(100%);
                transition: transform 0.3s ease-in-out;
                border: none;
                pointer-events: auto;
            `;
        } else {
            // Desktop: Side modal
            modal.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                width: 320px;
                max-height: calc(100% - 40px);
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                z-index: 1500;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                transform: translateX(340px);
                transition: transform 0.3s ease-in-out;
                border: 1px solid #e0e0e0;
                pointer-events: auto;
            `;
        }
        
        const headerPadding = isMobile ? '16px' : '20px';
        const contentPadding = isMobile ? '16px' : '20px';
        const titleFontSize = isMobile ? '16px' : '18px';
        const closeButtonSize = isMobile ? '32px' : '28px';
        
        modal.innerHTML = `
            <div style="
                position: relative;
                background: linear-gradient(135deg, ${color}22, ${color}11);
                padding: ${headerPadding};
                border-bottom: 1px solid #e0e0e0;
            ">
                <button onclick="closeCurrentModal()" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(255,255,255,0.9);
                    border: none;
                    width: ${closeButtonSize};
                    height: ${closeButtonSize};
                    border-radius: 50%;
                    font-size: 18px;
                    color: #666;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    backdrop-filter: blur(4px);
                " onmouseover="this.style.backgroundColor='rgba(255,255,255,1)'; this.style.color='#333'" onmouseout="this.style.backgroundColor='rgba(255,255,255,0.9)'; this.style.color='#666'">×</button>
                
                <div style="
                    display: flex;
                    align-items: center;
                    margin-bottom: ${isMobile ? '8px' : '12px'};
                ">
                    <div style="
                        width: ${isMobile ? '16px' : '20px'};
                        height: ${isMobile ? '16px' : '20px'};
                        background-color: ${color};
                        border-radius: 50%;
                        margin-right: ${isMobile ? '8px' : '10px'};
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    "></div>
                    <h3 style="
                        margin: 0;
                        font-size: ${titleFontSize};
                        font-weight: 600;
                        color: #333;
                        line-height: 1.2;
                    ">${neighborhood.displayName}</h3>
                </div>
                
                <div style="
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                ">
                    <span style="
                        display: inline-block;
                        background-color: ${color};
                        color: white;
                        padding: ${isMobile ? '4px 8px' : '6px 12px'};
                        border-radius: 12px;
                        font-size: ${isMobile ? '11px' : '12px'};
                        font-weight: 600;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">${neighborhood.pointValue} ${isMobile ? 'pts' : 'Points'}</span>
                    <span style="
                        display: inline-block;
                        background-color: rgba(255,255,255,0.9);
                        color: #495057;
                        padding: ${isMobile ? '4px 8px' : '6px 12px'};
                        border-radius: 12px;
                        font-size: ${isMobile ? '11px' : '12px'};
                        font-weight: 500;
                        border: 1px solid #dee2e6;
                    ">${neighborhood.borough}</span>
                </div>
            </div>
            
            <div style="
                padding: ${contentPadding};
                overflow-y: auto;
                max-height: ${isMobile ? '200px' : '400px'};
            ">
                ${!isMobile ? `<h4 style="
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">About This Neighborhood</h4>` : ''}
                
                <p style="
                    margin: 0 0 ${isMobile ? '12px' : '20px'} 0;
                    font-size: ${isMobile ? '13px' : '14px'};
                    line-height: 1.5;
                    color: #555;
                ">${neighborhood.description}</p>
                
                <div style="
                    padding: ${isMobile ? '12px' : '16px'};
                    background: ${color}08;
                    border-radius: 6px;
                    border: 1px solid ${color}20;
                ">
                    <div style="
                        display: flex;
                        align-items: center;
                        margin-bottom: 6px;
                    ">
                        <div style="
                            width: 3px;
                            height: 12px;
                            background: ${color};
                            border-radius: 2px;
                            margin-right: 6px;
                        "></div>
                        <h5 style="
                            margin: 0;
                            font-size: ${isMobile ? '11px' : '13px'};
                            font-weight: 600;
                            color: #333;
                        ">${isMobile ? 'Scoring' : 'Scoring Challenge'}</h5>
                    </div>
                    <p style="
                        margin: 0;
                        font-size: ${isMobile ? '10px' : '12px'};
                        color: #666;
                        line-height: 1.4;
                    ">${isMobile ? `Complete a challenge here for ${neighborhood.pointValue} bonus points!` : `Complete at least one challenge in this neighborhood to earn <strong>${neighborhood.pointValue} bonus points</strong> for your team!`}</p>
                </div>
            </div>
        `;
        
        // Map container position should already be set to relative
        
        // Add to appropriate container
        if (isMobile) {
            // Mobile: Add to body for full screen overlay
            document.body.appendChild(modal);
        } else {
            // Desktop: Add to map container
            mapContainer.appendChild(modal);
        }
        
        // Trigger slide-in animation
        setTimeout(() => {
            if (isMobile) {
                modal.style.transform = 'translateY(0)';
            } else {
                modal.style.transform = 'translateX(0)';
            }
        }, 10);
        
        // Store reference for removal
        map._currentModal = modal;
    }
    
    /**
     * Update popup position when map moves
     */
    function updatePopupPosition() {
        const popup = map._currentDOMPopup;
        if (popup && popup._coordinate) {
            const point = map.convertCoordinateToPointOnPage(popup._coordinate);
            popup.style.left = `${point.x - 140}px`;
            popup.style.top = `${point.y - 120}px`;
        }
    }
    
    /**
     * Clean up all modals immediately (for replacement)
     */
    function cleanupAllModals() {
        // Remove by ID
        const existingModal = document.getElementById('neighborhood-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Clear reference
        if (map && map._currentModal) {
            map._currentModal = null;
        }
        
        // Clear any global references
        delete window._preventModalRemoval;
    }

    /**
     * Remove current neighborhood popup/modal
     */
    function removeNeighborhoodPopup(immediate = false) {
        
        if (immediate) {
            // Use the cleanup function for immediate removal
            cleanupAllModals();
        } else {
            // Remove with slide-out animation (for close button)
            const existingModal = document.getElementById('neighborhood-modal');
            if (existingModal) {
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    existingModal.style.transform = 'translateY(100%)';
                } else {
                    existingModal.style.transform = 'translateX(340px)';
                }
                setTimeout(() => {
                    cleanupAllModals();
                }, 300);
            } else {
                cleanupAllModals();
            }
        }
        
        // Remove legacy sidebar
        if (map && map._currentSidebar) {
            map._currentSidebar.style.right = '-400px';
            setTimeout(() => {
                if (map._currentSidebar) {
                    map._currentSidebar.remove();
                    map._currentSidebar = null;
                }
            }, 300);
        }
        
        // Remove any existing sidebar by ID (fallback)
        const existingSidebar = document.getElementById('neighborhood-sidebar');
        if (existingSidebar) {
            existingSidebar.style.right = '-400px';
            setTimeout(() => {
                existingSidebar.remove();
            }, 300);
        }
        
        // Remove legacy DOM popup
        if (map && map._currentDOMPopup) {
            map._currentDOMPopup.remove();
            map._currentDOMPopup = null;
        }
        
        // Remove old annotation popup (legacy)
        if (map && map._currentPopupAnnotation) {
            map.removeAnnotation(map._currentPopupAnnotation);
            map._currentPopupAnnotation = null;
        }
        
        // Remove existing popup by ID (fallback)
        const existingPopup = document.getElementById('neighborhood-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
    }

    /**
     * Show error message when map fails to load
     */
    function showMapError(message = 'Unable to load the interactive map. Please try refreshing the page.') {
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="map-error">
                    <h3>Interactive Map Unavailable</h3>
                    <img src="../NYC Scavenger Hunt Points Values.png" alt="NYC Scavenger Hunt Points Values" />
                    <button onclick="window.NeighborhoodsMap.retryInitialization()" class="btn btn-secondary" style="margin-top: 1rem;">Try Again</button>
                </div>
            `;
        }
    }

    /**
     * Add a points legend to the bottom left of the map
     */
    function addPointsLegend() {
        // Remove any existing legend
        const existingLegend = document.getElementById('points-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Get point colors from neighborhood data
        const pointColors = window.NEIGHBORHOOD_DATA?.pointColors;
        if (!pointColors) {
            console.warn('No point colors data available for legend');
            return;
        }
        
        // Create legend container
        const legend = document.createElement('div');
        legend.id = 'points-legend';
        // Check if mobile
        const isMobile = window.innerWidth <= 768;
        
        legend.style.cssText = `
            position: absolute;
            bottom: ${isMobile ? '10px' : '20px'};
            left: ${isMobile ? '10px' : '20px'};
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
            border-radius: ${isMobile ? '6px' : '8px'};
            padding: ${isMobile ? '8px' : '12px'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: ${isMobile ? '10px' : '12px'};
            border: 1px solid rgba(0,0,0,0.1);
            z-index: 9999;
            max-width: ${isMobile ? '140px' : '200px'};
            pointer-events: auto;
        `;
        
        // Create legend title (skip on mobile to save space)
        if (!isMobile) {
            const title = document.createElement('div');
            title.style.cssText = `
                font-weight: 600;
                color: #333;
                margin-bottom: 8px;
                font-size: 13px;
            `;
            title.textContent = 'Points';
            legend.appendChild(title);
        }
        
        // Get unique point values and sort them
        const uniquePoints = Object.keys(pointColors)
            .map(p => parseInt(p))
            .filter(p => !isNaN(p))
            .sort((a, b) => {
                // Put -1 at the end
                if (a === -1) return 1;
                if (b === -1) return -1;
                return a - b;
            });
        
        // Create legend items
        uniquePoints.forEach(points => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: ${isMobile ? '2px' : '4px'};
                gap: ${isMobile ? '6px' : '8px'};
            `;
            
            const color = pointColors[points.toString()];
            
            // Create color dot
            const dot = document.createElement('div');
            const dotSize = isMobile ? '10px' : '14px';
            dot.style.cssText = `
                width: ${dotSize};
                height: ${dotSize};
                border-radius: 50%;
                background-color: ${color || '#CCCCCC'};
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                flex-shrink: 0;
            `;
            
            // Create label
            const label = document.createElement('span');
            label.style.cssText = `
                color: #555;
                font-size: ${isMobile ? '9px' : '11px'};
                line-height: 1;
            `;
            
            if (points === -1) {
                label.textContent = isMobile ? 'Out of bounds' : 'Out of bounds';
                // Use the actual color from neighborhood data, or fallback if empty
                const outOfBoundsColor = color || '#CCCCCC';
                if (color === '' || !color) {
                    // If no color specified, make it a subtle gray with striped pattern
                    dot.style.background = `repeating-linear-gradient(45deg, #CCCCCC, #CCCCCC 2px, #ffffff 2px, #ffffff 4px)`;
                    dot.style.border = '2px solid #CCCCCC';
                } else {
                    // Use the specified color
                    dot.style.backgroundColor = outOfBoundsColor;
                    dot.style.border = '2px solid white';
                }
            } else if (points === 0) {
                label.textContent = isMobile ? '0 pts' : 'No bonus';
            } else {
                label.textContent = isMobile ? `${points}pts` : `${points} points`;
            }
            
            item.appendChild(dot);
            item.appendChild(label);
            legend.appendChild(item);
        });
        
        // Add legend to map container
        mapContainer.appendChild(legend);
    }

    /**
     * Clear all overlays from the map
     */
    function clearMapOverlays() {
        if (map && mapOverlays.length > 0) {
            mapOverlays.forEach(overlay => {
                map.removeOverlay(overlay);
            });
            mapOverlays = [];
        }
    }

    /**
     * Filter map overlays by borough (optional enhancement)
     */
    function filterMapOverlays(borough) {
        if (!map) return;
        
        // For now, show all overlays regardless of filter
        // This could be enhanced to filter by borough if the GeoJSON properties include borough data
        clearMapOverlays();
        loadGeoJSONOverlays();
    }

    /**
     * Retry map initialization
     */
    function retryInitialization() {
        if (mapContainer) {
            mapContainer.innerHTML = '<div class="map-placeholder"><p>Loading interactive map...</p></div>';
        }
        setTimeout(() => {
            initializeMap();
        }, 500);
    }

    // Make functions globally accessible for inline onclick handlers
    window.removeNeighborhoodPopup = removeNeighborhoodPopup;
    window.closeCurrentModal = function() {
        removeNeighborhoodPopup(false);
    };
    
    // Export functions for potential external use
    window.NeighborhoodsMap = {
        initializeMap,
        loadGeoJSONOverlays,
        clearMapOverlays,
        fitMapToOverlays,
        retryInitialization,
        closePopup: removeNeighborhoodPopup
    };

})();