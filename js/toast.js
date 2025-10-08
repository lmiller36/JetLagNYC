/**
 * Toast Notification System
 * Mobile-friendly, non-blocking notifications
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.querySelector('.toast-container')) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms (0 = no auto-dismiss)
     */
    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this.escapeHTML(message)}</span>
            <button class="toast-close" aria-label="Close">×</button>
        `;

        this.container.appendChild(toast);

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.dismiss(toast);
        });

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * Dismiss a toast
     */
    dismiss(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300); // Match animation duration
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Convenience methods
     */
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 6000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    /**
     * Show a confirmation dialog
     * @param {string} message - Message to display
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                danger = false
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-message">${this.escapeHTML(message)}</div>
                    <div class="confirm-actions">
                        <button class="btn-cancel">${this.escapeHTML(cancelText)}</button>
                        <button class="${danger ? 'btn-danger' : 'btn-confirm'}">${this.escapeHTML(confirmText)}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const dialog = overlay.querySelector('.confirm-dialog');
            const cancelBtn = overlay.querySelector('.btn-cancel');
            const confirmBtn = overlay.querySelector(danger ? '.btn-danger' : '.btn-confirm');

            // Handle cancel
            const handleCancel = () => {
                overlay.remove();
                resolve(false);
            };

            // Handle confirm
            const handleConfirm = () => {
                overlay.remove();
                resolve(true);
            };

            // Click outside to cancel
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handleCancel();
                }
            });

            // Button handlers
            cancelBtn.addEventListener('click', handleCancel);
            confirmBtn.addEventListener('click', handleConfirm);

            // Escape key to cancel
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }
}

// Create global instance
window.toast = new ToastManager();
