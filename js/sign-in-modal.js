/**
 * Reusable Sign-In Modal Component
 * Creates a consistent, styled sign-in prompt across the application
 */

function createSignInModal(message = 'Please sign in to view this content.') {
    return `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 400px; padding: 20px;">
            <div class="sign-in-modal" style="
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                padding: 40px 30px;
                max-width: 450px;
                text-align: center;
                border: 2px solid var(--primary-color);
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 40px;
                ">🔒</div>
                <h3 style="margin-bottom: 16px; color: var(--primary-color); font-size: 24px;">Sign In Required</h3>
                <p style="margin-bottom: 24px; color: var(--dark-color); line-height: 1.6;">${message}</p>
                <button
                    onclick="if(window.Auth && window.Auth.signIn) { window.Auth.signIn(); } else { window.toast?.error('Please wait for the page to finish loading.'); }"
                    class="btn btn-primary"
                    style="
                        padding: 12px 32px;
                        font-size: 16px;
                        font-weight: 600;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">
                    Sign In with Google
                </button>
            </div>
        </div>
    `;
}

// Export for use in other modules
window.createSignInModal = createSignInModal;
