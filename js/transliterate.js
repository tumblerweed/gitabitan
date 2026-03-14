/**
 * Transliteration Service — online (Google Input Tools) / offline (local rules).
 *
 * Online: Google Input Tools API via JSONP (works on any host, no CORS issues).
 * Offline: BengaliKeyboard.transliterate() → single candidate.
 *
 * Also tracks API reachability and dispatches status events.
 */

const Transliterator = (() => {
    const MODE_KEY = 'gitabitan-translit-mode';
    const CACHE_KEY = 'gitabitan-translit-cache';
    const MAX_CACHE = 500;
    const GOOGLE_API = 'https://inputtools.google.com/request';
    let mode = localStorage.getItem(MODE_KEY) || 'online';
    let _apiAvailable = null; // null = unknown, true/false after check
    let _jsonpId = 0;

    function loadCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
        catch { return {}; }
    }
    let cache = loadCache();

    // --- JSONP transport (for direct Google API calls, bypasses CORS) ---

    function googleJsonp(text, num) {
        return new Promise((resolve, reject) => {
            const cbName = '_gtCb' + (++_jsonpId) + '_' + Date.now();
            const timeout = setTimeout(() => {
                delete window[cbName];
                if (script.parentNode) script.remove();
                reject(new Error('timeout'));
            }, 3000);

            window[cbName] = (data) => {
                clearTimeout(timeout);
                delete window[cbName];
                if (script.parentNode) script.remove();
                resolve(data);
            };

            const script = document.createElement('script');
            script.src = `${GOOGLE_API}?text=${encodeURIComponent(text)}&itc=bn-t-i0-und&num=${num}&cb=${cbName}`;
            script.onerror = () => {
                clearTimeout(timeout);
                delete window[cbName];
                if (script.parentNode) script.remove();
                reject(new Error('network'));
            };
            document.head.appendChild(script);
        });
    }

    /** Parse Google Input Tools response → candidates array. */
    function parseGoogleResponse(data) {
        if (data[0] === 'SUCCESS' && data[1] && data[1][0]) {
            return data[1][0][1] || [];
        }
        return [];
    }

    // --- Fetch candidates via JSONP ---

    async function fetchCandidates(text, num) {
        const data = await googleJsonp(text, num);
        return parseGoogleResponse(data);
    }

    // --- Public API ---

    /** Lightweight API health check (timeout 3s). */
    async function checkApiHealth() {
        try {
            const candidates = await fetchCandidates('a', 1);
            const wasAvailable = _apiAvailable;
            _apiAvailable = candidates.length > 0;
            if (wasAvailable !== _apiAvailable) {
                document.dispatchEvent(new CustomEvent('translit-api-status', {
                    detail: { available: _apiAvailable }
                }));
            }
        } catch {
            const wasAvailable = _apiAvailable;
            _apiAvailable = false;
            if (wasAvailable !== _apiAvailable) {
                document.dispatchEvent(new CustomEvent('translit-api-status', {
                    detail: { available: false }
                }));
            }
        }
        return _apiAvailable;
    }

    function isApiAvailable() { return _apiAvailable; }

    /**
     * Get transliteration candidates for Roman text.
     * Online: up to 5 ranked candidates from Google API (cached).
     * Offline: single candidate from local rules.
     */
    async function getCandidates(romanText) {
        if (!romanText) return [];

        if (mode === 'offline') {
            return [BengaliKeyboard.transliterate(romanText)];
        }

        // Online: check cache first
        if (cache[romanText]) return cache[romanText];

        try {
            const candidates = await fetchCandidates(romanText, 5);
            if (candidates.length > 0) {
                cache[romanText] = candidates;
                saveCache();
                // Mark API as available
                if (_apiAvailable !== true) {
                    _apiAvailable = true;
                    document.dispatchEvent(new CustomEvent('translit-api-status', {
                        detail: { available: true }
                    }));
                }
                return candidates;
            }
        } catch {
            // API unreachable — update status and fall through to local
            if (_apiAvailable !== false) {
                _apiAvailable = false;
                document.dispatchEvent(new CustomEvent('translit-api-status', {
                    detail: { available: false }
                }));
            }
        }

        // Fallback to local transliteration
        return [BengaliKeyboard.transliterate(romanText)];
    }

    function saveCache() {
        try {
            const keys = Object.keys(cache);
            if (keys.length > MAX_CACHE) {
                keys.slice(0, keys.length - MAX_CACHE).forEach(k => delete cache[k]);
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* localStorage full — ignore */ }
    }

    function setMode(m) {
        if (m === 'online' || m === 'offline') {
            mode = m;
            localStorage.setItem(MODE_KEY, m);
        }
    }

    function getMode() { return mode; }

    return { getCandidates, setMode, getMode, checkApiHealth, isApiAvailable };
})();
