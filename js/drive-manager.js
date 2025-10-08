/**
 * Google Drive Manager
 * Handles Google Drive API interactions for photo uploads and folder management
 */

class DriveManager {
    constructor() {
        this.parentFolderId = '1bzjVzXUJoeVgtkXS2hq_laJ5hJOB-qPH';
        this.accessToken = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Google Drive API
     * Must be called before any Drive operations
     */
    async initialize() {
        if (this.isInitialized) return true;

        try {
            // Check if Google API is loaded
            if (!window.gapi || !window.gapi.client) {
                throw new Error('Google API client not loaded');
            }

            // Get token from gapi client (same as sheets integration)
            const token = window.gapi.client.getToken();
            if (!token || !token.access_token) {
                throw new Error('User not signed in to Google');
            }

            this.accessToken = token.access_token;
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Drive Manager:', error);
            throw error;
        }
    }

    /**
     * Create a folder in Google Drive for a team
     * @param {string} teamName - Name of the team
     * @returns {Promise<string>} - Folder ID
     */
    async createTeamFolder(teamName) {
        await this.initialize();

        const metadata = {
            name: teamName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [this.parentFolderId]
        };

        try {
            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to create folder: ${error.error.message}`);
            }

            const folder = await response.json();
            console.log(`Created team folder: ${teamName} (${folder.id})`);
            return folder.id;
        } catch (error) {
            console.error('Error creating team folder:', error);
            throw error;
        }
    }

    /**
     * Upload photos to team folder
     * @param {string} teamName - Name of the team
     * @param {string} challengeId - Challenge identifier
     * @param {FileList|File[]} photos - Photos to upload
     * @param {string} teamFolderId - Team's folder ID in Drive
     * @returns {Promise<Array>} - Array of uploaded file info
     */
    async uploadChallengePhotos(teamName, challengeId, photos, teamFolderId) {
        await this.initialize();

        if (!photos || photos.length === 0) {
            throw new Error('No photos provided');
        }

        const uploadPromises = Array.from(photos).map((photo, index) =>
            this.uploadPhoto(teamName, challengeId, photo, index, teamFolderId)
        );

        try {
            const results = await Promise.all(uploadPromises);
            console.log(`Uploaded ${results.length} photos for ${teamName} - ${challengeId}`);
            return results;
        } catch (error) {
            console.error('Error uploading photos:', error);
            throw error;
        }
    }

    /**
     * Upload a single photo
     * @private
     */
    async uploadPhoto(teamName, challengeId, photo, index, teamFolderId) {
        const fileExtension = photo.name.split('.').pop();
        const fileName = `${teamName}-${challengeId}-${index}.${fileExtension}`;

        // Create metadata
        const metadata = {
            name: fileName,
            parents: [teamFolderId]
        };

        // Create multipart form data
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const closeDelimiter = "\r\n--" + boundary + "--";

        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const photoBlob = new Blob([photo], { type: photo.type });

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            await metadataBlob.text() +
            delimiter +
            `Content-Type: ${photo.type}\r\n\r\n`;

        const multipartBlob = new Blob([
            multipartRequestBody,
            photoBlob,
            closeDelimiter
        ]);

        try {
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBlob
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to upload ${fileName}: ${error.error.message}`);
            }

            const result = await response.json();
            console.log(`Uploaded: ${fileName} (${result.id})`);
            return {
                id: result.id,
                name: fileName,
                webViewLink: result.webViewLink
            };
        } catch (error) {
            console.error(`Error uploading ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * Get folder ID for a team (searches by name)
     * @param {string} teamName - Name of the team
     * @returns {Promise<string|null>} - Folder ID or null if not found
     */
    async getTeamFolderId(teamName) {
        await this.initialize();

        // Check localStorage first for cached folder ID
        const cachedFolderId = localStorage.getItem(`team_folder_${teamName}`);
        if (cachedFolderId) {
            console.log('Using cached folder ID for team:', teamName);
            return cachedFolderId;
        }

        // Search Drive if not cached
        const query = `name='${teamName}' and '${this.parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to search for team folder');
            }

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                const folderId = data.files[0].id;
                // Cache the folder ID for future use
                localStorage.setItem(`team_folder_${teamName}`, folderId);
                return folderId;
            }

            return null;
        } catch (error) {
            console.error('Error getting team folder ID:', error);
            throw error;
        }
    }

    /**
     * Ensure team folder exists, create if it doesn't
     * @param {string} teamName - Name of the team
     * @returns {Promise<string>} - Folder ID
     */
    async ensureTeamFolder(teamName) {
        try {
            // Try to get existing folder
            let folderId = await this.getTeamFolderId(teamName);

            if (!folderId) {
                console.log(`Team folder not found for ${teamName}, creating...`);
                folderId = await this.createTeamFolder(teamName);
                localStorage.setItem(`team_folder_${teamName}`, folderId);
            }

            return folderId;
        } catch (error) {
            console.error('Error ensuring team folder:', error);
            throw error;
        }
    }

    /**
     * Check if user has Drive access
     * @returns {boolean}
     */
    hasAccess() {
        return this.isInitialized && this.accessToken !== null;
    }
}

// Export singleton instance
window.driveManager = new DriveManager();
