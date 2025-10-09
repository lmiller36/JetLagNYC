/**
 * Authentication and user management
 */

let currentUser = null;
let tokenExpirationTimer = null;

/**
 * Initialize authentication on page load
 */
function initAuth() {
    console.log('Initializing auth...');

    // Listen for sheetsAuthComplete event from sign-in modals
    window.addEventListener('sheetsAuthComplete', async () => {
        console.log('sheetsAuthComplete event received, saving token...');
        await handleAuthComplete();
    });

    // Try to restore token from localStorage
    const savedToken = localStorage.getItem('scavenger_token');
    const savedUser = localStorage.getItem('scavenger_user');

    if (savedToken && savedUser) {
        const tokenData = JSON.parse(savedToken);
        const now = Date.now();

        // Check if token is still valid
        if (tokenData.expires_at && tokenData.expires_at > now) {
            console.log('Restoring valid token from localStorage');
            currentUser = JSON.parse(savedUser);

            // Wait for gapi to be ready, then set the token
            const restoreToken = () => {
                if (gapi?.client?.setToken) {
                    gapi.client.setToken({
                        access_token: tokenData.access_token,
                        expires_in: Math.floor((tokenData.expires_at - now) / 1000)
                    });
                    console.log('Token restored successfully');
                    updateUserUI();

                    // Set up auto-refresh before expiration
                    scheduleTokenRefresh(tokenData.expires_at);
                } else {
                    setTimeout(restoreToken, 100);
                }
            };
            restoreToken();
        } else {
            console.log('Saved token expired, clearing...');
            localStorage.removeItem('scavenger_token');
            currentUser = JSON.parse(savedUser);
            updateUserUI();
            showReauthMessage();
        }
    } else if (savedUser) {
        console.log('Found saved user but no token');
        currentUser = JSON.parse(savedUser);
        updateUserUI();

        // Check if there's an active token (user might have just signed in)
        setTimeout(() => {
            const token = gapi?.client?.getToken();
            if (token) {
                console.log('Found active token');
                saveToken(token);
            } else {
                showReauthMessage();
            }
        }, 1000);
    } else {
        console.log('No saved user found');
    }
}

/**
 * Save token to localStorage with expiration
 */
function saveToken(token) {
    const expiresIn = token.expires_in || 3600; // Default 1 hour
    const expiresAt = Date.now() + (expiresIn * 1000);

    const tokenData = {
        access_token: token.access_token,
        expires_at: expiresAt
    };

    localStorage.setItem('scavenger_token', JSON.stringify(tokenData));
    console.log('Token saved, expires at:', new Date(expiresAt));

    // Schedule refresh before expiration
    scheduleTokenRefresh(expiresAt);
}

/**
 * Schedule automatic token refresh
 */
function scheduleTokenRefresh(expiresAt) {
    // Clear existing timer
    if (tokenExpirationTimer) {
        clearTimeout(tokenExpirationTimer);
    }

    // Refresh 5 minutes before expiration
    const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000);

    if (refreshTime > 0) {
        console.log('Scheduling token refresh in', Math.floor(refreshTime / 1000), 'seconds');
        tokenExpirationTimer = setTimeout(() => {
            console.log('Token expiring soon, requesting refresh...');
            refreshToken();
        }, refreshTime);
    }
}

/**
 * Refresh the token
 */
function refreshToken() {
    console.log('Refreshing token...');
    // Request a new token silently (no prompt)
    if (gapi?.client?.getToken()) {
        window.SheetsAPI.handleAuthClick((resp, isError) => {
            if (!isError) {
                console.log('Token refreshed successfully');
            }
        });
    } else {
        console.log('No active token to refresh');
        showReauthMessage();
    }
}

/**
 * Show message that user needs to re-authenticate
 */
function showReauthMessage() {
    const userInfoElements = document.querySelectorAll('#userInfo, .user-info');
    userInfoElements.forEach(element => {
        if (currentUser) {
            element.innerHTML = `
                <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar" style="opacity: 0.5;">
                <span class="user-name" style="opacity: 0.5;">${currentUser.name}</span>
                <button onclick="window.Auth.signIn()" class="btn-reauth">Re-authenticate</button>
            `;
        }
    });
}

/**
 * Handle sign in
 */
async function signIn() {
    console.log('Sign in called');

    // Trigger the sheets auth with a callback
    window.SheetsAPI.handleAuthClick(async (resp, isError) => {
        if (isError) {
            console.error('Auth failed');
            return;
        }

        console.log('Auth callback triggered, fetching user info...');
        await handleAuthComplete();
    });
}

/**
 * Handle auth completion
 */
async function handleAuthComplete() {
    console.log('Auth complete, fetching user info...');

    try {
        // Wait a bit for token to be set
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get user info from Google
        const token = gapi.client.getToken();
        if (!token) {
            console.error('No token found');
            return;
        }

        // Save the token with expiration
        saveToken(token);

        console.log('Token found, fetching user info...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        const userInfo = await userInfoResponse.json();
        currentUser = {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
        };

        localStorage.setItem('scavenger_user', JSON.stringify(currentUser));
        console.log('User info saved:', currentUser);
        updateUserUI();

        // Trigger custom event for other scripts
        window.dispatchEvent(new CustomEvent('userSignedIn', { detail: currentUser }));
    } catch (err) {
        console.error('Error getting user info:', err);
    }
}

/**
 * Handle sign out
 */
function signOut() {
    window.SheetsAPI.handleSignoutClick();
    currentUser = null;
    
    // Clear all localStorage
    localStorage.clear();

    // Clear token refresh timer
    if (tokenExpirationTimer) {
        clearTimeout(tokenExpirationTimer);
        tokenExpirationTimer = null;
    }

    updateUserUI();

    // Trigger custom event
    window.dispatchEvent(new CustomEvent('userSignedOut'));
}

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
 * Update UI based on auth state
 */
function updateUserUI() {
    console.log('Updating user UI, currentUser:', currentUser);
    const userInfoElements = document.querySelectorAll('#userInfo, .user-info');
    const userInfoMobile = document.getElementById('userInfoMobile');
    console.log('Found user info elements:', userInfoElements.length);

    const userInfoHTML = currentUser ? `
        <img src="${escapeHTML(currentUser.picture)}" alt="${escapeHTML(currentUser.name)}" class="user-avatar">
        <span class="user-name">${escapeHTML(currentUser.name)}</span>
        <button onclick="window.Auth.signOut()" class="sign-out-btn">Sign Out</button>
    ` : '';

    // Update desktop user info
    userInfoElements.forEach(element => {
        element.innerHTML = userInfoHTML;
    });

    // Update mobile user info in dropdown
    if (userInfoMobile) {
        userInfoMobile.innerHTML = userInfoHTML;
    }
}

/**
 * Get current user
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is signed in
 */
function isSignedIn() {
    return currentUser !== null;
}

// Initialize on page load
window.addEventListener('load', initAuth);

// Export functions
window.Auth = {
    signIn,
    signOut,
    getCurrentUser,
    isSignedIn,
    updateUserUI
};
