// Shared navigation component
// This script dynamically loads the navigation header on all pages

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
                    <div id="userInfo" class="user-info"></div>
                    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
                        <span class="hamburger"></span>
                    </button>
                    <ul class="nav-menu">
                        <li><a href="${pathPrefix}index.html" class="nav-link" data-page="home">Home</a></li>
                        <li><a href="${pathPrefix}pages/challenges.html" class="nav-link" data-page="challenges">Challenges</a></li>
                        <li><a href="${pathPrefix}pages/neighborhoods.html" class="nav-link" data-page="neighborhoods">Neighborhoods</a></li>
                        <li><a href="${pathPrefix}pages/team.html" class="nav-link" data-page="team">Team</a></li>
                        <li><a href="${pathPrefix}pages/submission.html" class="nav-link" data-page="submission">Submit Photos</a></li>
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

// Load navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedNavigation);
} else {
    loadSharedNavigation();
}
