/**
 * LocationManager class
 * Handles user geolocation tracking and coordinate retrieval
 */

class LocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.isTracking = false;
    }

    /**
     * Get current user location
     * @returns {Promise<{latitude: number, longitude: number}>}
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    reject(this.handleGeolocationError(error));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Start watching user location
     * @param {Function} callback - Called when position updates
     */
    startTracking(callback) {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported');
            return;
        }

        if (this.isTracking) {
            console.warn('Already tracking location');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                if (callback) callback(this.currentPosition);
            },
            (error) => {
                console.error('Location tracking error:', this.handleGeolocationError(error));
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );

        this.isTracking = true;
    }

    /**
     * Stop watching user location
     */
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
        }
    }

    /**
     * Get formatted coordinates string
     * @returns {string} Formatted as "lat, lng"
     */
    getFormattedCoordinates() {
        if (!this.currentPosition) {
            return 'Location not available';
        }
        return `${this.currentPosition.latitude.toFixed(6)}, ${this.currentPosition.longitude.toFixed(6)}`;
    }

    /**
     * Get coordinates object
     * @returns {Object|null} {latitude, longitude} or null
     */
    getCoordinates() {
        if (!this.currentPosition) {
            return null;
        }
        return {
            latitude: this.currentPosition.latitude,
            longitude: this.currentPosition.longitude
        };
    }

    /**
     * Handle geolocation errors
     * @param {GeolocationPositionError} error
     * @returns {Error}
     */
    handleGeolocationError(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return new Error('Location permission denied. Please enable location access in your browser settings.');
            case error.POSITION_UNAVAILABLE:
                return new Error('Location information is unavailable.');
            case error.TIMEOUT:
                return new Error('Location request timed out. Please try again.');
            default:
                return new Error('An unknown error occurred while getting location.');
        }
    }

    /**
     * Check if geolocation is supported
     * @returns {boolean}
     */
    static isSupported() {
        return 'geolocation' in navigator;
    }
}

// Export for use in other modules
window.LocationManager = LocationManager;
