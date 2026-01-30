/**
 * Event Logger - Minimal MVP for logging events to Google Sheets via Google Apps Script
 * 
 * This script handles:
 * - Generating and storing a stable pseudo user ID
 * - Saving and loading the Google Apps Script Web App URL
 * - Sending events as CORS-simple requests (no preflight)
 * - Displaying status messages
 */

(function() {
    'use strict';

    // DOM elements
    const gasUrlInput = document.getElementById('gasUrl');
    const saveUrlButton = document.getElementById('saveUrl');
    const ctaAButton = document.getElementById('ctaA');
    const ctaBButton = document.getElementById('ctaB');
    const heartbeatButton = document.getElementById('heartbeat');
    const statusElement = document.getElementById('status');

    // Configuration
    const STORAGE_KEYS = {
        GAS_URL: 'gas_url',
        USER_ID: 'uid'
    };

    /**
     * Generates or retrieves a stable pseudo user ID.
     * Creates a v4-like UUID and stores it in localStorage if not present.
     * 
     * @returns {string} A stable user ID
     */
    function getOrCreateUserId() {
        let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
        if (!userId) {
            // Simple pseudo-UUID generation (not cryptographic, but stable and unique enough for logging)
            userId = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
        }
        return userId;
    }

    /**
     * Updates the status display with a message.
     * 
     * @param {string} message - The status message to display
     * @param {boolean} isError - If true, displays as error; otherwise as success
     */
    function updateStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'error' : 'success';
        
        // Clear status after 3 seconds for non-error messages
        if (!isError) {
            setTimeout(() => {
                if (statusElement.textContent === message) {
                    statusElement.textContent = '';
                    statusElement.className = '';
                }
            }, 3000);
        }
    }

    /**
     * Sends a log event to the Google Apps Script Web App using a CORS-simple request.
     * Uses application/x-www-form-urlencoded without custom headers to avoid preflight.
     * 
     * @param {Object} payload - The event payload
     * @param {string} payload.event - Event type (e.g., 'cta_click', 'heartbeat')
     * @param {string} [payload.variant] - Optional variant identifier
     * @param {Object} [payload.meta] - Optional metadata object
     * @returns {Promise<void>} Resolves when the request completes
     */
    async function sendLogSimple(payload) {
        const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
        
        // Validate GAS URL
        if (!gasUrl) {
            updateStatus('Missing Web App URL. Please save a valid URL first.', true);
            return;
        }
        
        if (!gasUrl.endsWith('/exec')) {
            updateStatus('URL must end with /exec', true);
            return;
        }

        try {
            // Build URL-encoded body (CORS-simple request format)
            const params = new URLSearchParams();
            params.append('event', payload.event);
            if (payload.variant) params.append('variant', payload.variant);
            params.append('userId', getOrCreateUserId());
            params.append('ts', Date.now().toString());
            
            // Include metadata about the page and user agent
            const meta = {
                page: window.location.pathname,
                ua: navigator.userAgent,
                ...payload.meta
            };
            params.append('meta', JSON.stringify(meta));

            // Send request without custom headers to avoid preflight
            const response = await fetch(gasUrl, {
                method: 'POST',
                body: params
                // No headers set - let browser set Content-Type to application/x-www-form-urlencoded
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            if (result.ok) {
                updateStatus('Logged');
            } else {
                updateStatus('Server error', true);
            }
        } catch (error) {
            console.error('Logging failed:', error);
            updateStatus(`Failed: ${error.message}`, true);
        }
    }

    /**
     * Initializes the application:
     * - Loads saved GAS URL
     * - Sets up event listeners
     * - Ensures user ID exists
     */
    function init() {
        // Load saved GAS URL
        const savedUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
        if (savedUrl) {
            gasUrlInput.value = savedUrl;
        }

        // Ensure user ID exists
        getOrCreateUserId();

        // Event listeners
        saveUrlButton.addEventListener('click', () => {
            const url = gasUrlInput.value.trim();
            if (!url) {
                updateStatus('Please enter a URL', true);
                return;
            }
            
            if (!url.startsWith('https://') || !url.includes('google.com')) {
                updateStatus('Warning: URL may not be valid', true);
            }
            
            localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
            updateStatus('URL saved');
        });

        ctaAButton.addEventListener('click', () => {
            sendLogSimple({
                event: 'cta_click',
                variant: 'A'
            });
        });

        ctaBButton.addEventListener('click', () => {
            sendLogSimple({
                event: 'cta_click',
                variant: 'B'
            });
        });

        heartbeatButton.addEventListener('click', () => {
            sendLogSimple({
                event: 'heartbeat'
            });
        });

        // Allow saving with Enter key in the URL input
        gasUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveUrlButton.click();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();