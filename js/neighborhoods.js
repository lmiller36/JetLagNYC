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

        // Set up event listeners
        setupEventListeners();
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

})();