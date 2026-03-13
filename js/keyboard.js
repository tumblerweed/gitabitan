/**
 * Bengali Keyboard Input — Phonetic + Fixed (Probhat) layout.
 *
 * Phonetic mode: accumulates Roman buffer, emits buffer changes for async candidate fetching.
 * Fixed mode: each QWERTY key maps to a Bengali character (Probhat layout).
 * Off: raw input (paste Bengali directly).
 */

const BengaliKeyboard = (() => {

    // --- Phonetic Transliteration (local fallback) ---

    // Vowels: independent forms
    const VOWELS = {
        'o': 'অ', 'a': 'আ', 'aa': 'আ', 'i': 'ই', 'ii': 'ঈ', 'ee': 'ঈ',
        'u': 'উ', 'uu': 'ঊ', 'oo': 'ঊ', 'e': 'এ', 'oi': 'ঐ', 'ai': 'ঐ',
        'O': 'ও', 'ou': 'ঔ', 'au': 'ঔ', 'ri': 'ঋ'
    };

    // Vowel signs (matras) — used after consonants
    const MATRAS = {
        'a': 'া', 'aa': 'া', 'i': 'ি', 'ii': 'ী', 'ee': 'ী',
        'u': 'ু', 'uu': 'ূ', 'oo': 'ূ', 'e': 'ে', 'oi': 'ৈ', 'ai': 'ৈ',
        'O': 'ো', 'ou': 'ৌ', 'au': 'ৌ', 'ri': 'ৃ'
    };

    // Consonants
    const CONSONANTS = {
        'k': 'ক', 'kh': 'খ', 'g': 'গ', 'gh': 'ঘ', 'Ng': 'ঙ',
        'c': 'চ', 'ch': 'ছ', 'j': 'জ', 'jh': 'ঝ',
        'T': 'ট', 'Th': 'ঠ', 'D': 'ড', 'Dh': 'ঢ', 'N': 'ণ',
        't': 'ত', 'th': 'থ', 'd': 'দ', 'dh': 'ধ', 'n': 'ন',
        'p': 'প', 'ph': 'ফ', 'f': 'ফ', 'b': 'ব', 'bh': 'ভ', 'v': 'ভ',
        'm': 'ম',
        'z': 'য', 'r': 'র', 'l': 'ল',
        'sh': 'শ', 'Sh': 'ষ', 's': 'স', 'h': 'হ',
        'R': 'ড়', 'Rh': 'ঢ়', 'y': 'য়',
        'w': 'ৱ', 'ng': 'ং', 'nk': 'ঙ্ক', 'nc': 'ঞ্চ',
    };

    // Special characters
    const SPECIAL = {
        '.': '।', '..': '।।',
        '^': 'ঁ',   // chandrabindu
        ':': 'ঃ',   // visarga
        '~': '্',   // hasanta
    };

    // Bengali digits
    const DIGITS = {
        '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
        '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };

    const HASANTA = '্';

    /**
     * Transliterate a Roman string to Bengali (phonetic).
     * Simple greedy left-to-right approach — used as offline fallback.
     */
    function transliterate(input) {
        let result = '';
        let i = 0;
        let lastWasConsonant = false;

        while (i < input.length) {
            const ch = input[i];

            // Digits
            if (DIGITS[ch]) {
                result += DIGITS[ch];
                lastWasConsonant = false;
                i++;
                continue;
            }

            // Space, punctuation pass through
            if (ch === ' ' || ch === '\n' || ch === '\t') {
                result += ch;
                lastWasConsonant = false;
                i++;
                continue;
            }

            // Try special characters
            if (ch === '.' && i + 1 < input.length && input[i + 1] === '.') {
                result += '।।';
                lastWasConsonant = false;
                i += 2;
                continue;
            }
            if (SPECIAL[ch] && ch !== '~') {
                result += SPECIAL[ch];
                lastWasConsonant = false;
                i++;
                continue;
            }
            if (ch === '~') {
                result += HASANTA;
                lastWasConsonant = false;
                i++;
                continue;
            }

            // Try longest consonant match (up to 3 chars)
            let matched = false;
            for (let len = 3; len >= 1; len--) {
                const substr = input.substring(i, i + len);
                if (CONSONANTS[substr]) {
                    if (lastWasConsonant) {
                        result += HASANTA;
                    }
                    result += CONSONANTS[substr];
                    lastWasConsonant = true;
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            // Try vowel match (up to 2 chars)
            for (let len = 2; len >= 1; len--) {
                const substr = input.substring(i, i + len);
                if (lastWasConsonant && MATRAS[substr]) {
                    // Add matra after consonant
                    if (substr === 'o') {
                        // 'o' after consonant = inherent vowel, no matra needed
                    } else {
                        result += MATRAS[substr];
                    }
                    lastWasConsonant = false;
                    i += len;
                    matched = true;
                    break;
                } else if (!lastWasConsonant && VOWELS[substr]) {
                    result += VOWELS[substr];
                    lastWasConsonant = false;
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            // Pass through unrecognized characters
            result += ch;
            lastWasConsonant = false;
            i++;
        }

        return result;
    }

    // --- Fixed Layout (Probhat) ---
    const PROBHAT_MAP = {
        // Row 1: number row
        '`': '', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫',
        '6': '৬', '7': '৭', '8': '৮', '9': '৯', '0': '০',
        '-': '-', '=': '=',
        // Shifted number row
        '~': '', '!': '!', '@': '@', '#': '#', '$': '৳', '%': '%',
        '^': '‍', '&': '&', '*': '*', '(': '(', ')': ')',
        '_': '_', '+': '+',

        // Row 2: QWERTY
        'q': 'দ', 'w': 'ূ', 'e': 'ী', 'r': 'র', 't': 'ট',
        'y': 'ক', 'u': 'হ', 'i': 'ি', 'o': 'ে', 'p': 'প',
        '[': 'এ', ']': '়',
        // Shifted
        'Q': 'ঢ', 'W': 'ঊ', 'E': 'ঈ', 'R': 'ড়', 'T': 'ঠ',
        'Y': 'খ', 'U': 'উ', 'I': 'ই', 'O': 'ও', 'P': 'ফ',
        '{': 'ঐ', '}': 'ঔ',

        // Row 3: ASDF
        'a': 'া', 's': 'স', 'd': 'ড', 'f': 'ত', 'g': 'গ',
        'h': 'ব', 'j': 'জ', 'k': '্', 'l': 'ল',
        ';': ';', "'": '\'',
        // Shifted
        'A': 'আ', 'S': 'ষ', 'D': 'ঢ', 'F': 'থ', 'G': 'ঘ',
        'H': 'ভ', 'J': 'ঝ', 'K': 'ঃ', 'L': 'ং',
        ':': ':', '"': '"',

        // Row 4: ZXCV
        'z': 'য', 'x': 'শ', 'c': 'চ', 'v': 'অ', 'b': 'ন',
        'n': 'ু', 'm': 'ম',
        ',': ',', '.': '।', '/': 'য়',
        // Shifted
        'Z': 'ঞ', 'X': 'ণ', 'C': 'ছ', 'V': 'আ', 'B': 'ধ',
        'N': 'ঙ', 'M': 'ঁ',
        '<': 'ৃ', '>': '॥', '?': '?',
    };

    function probhatMap(key) {
        return PROBHAT_MAP[key] || null;
    }

    // --- Mode Management ---
    // Active modes: online (Google API) and offline (local phonetic).
    // Probhat (fixed) code is kept above but not exposed in the cycle.
    const MODES = ['online', 'offline'];
    // Simplified Google Translate icon (from logo SVG) — blue "G" + translate symbol
    const GOOGLE_ICON = `<svg class="kb-icon" viewBox="0 0 998 998" width="14" height="14"><path fill="#4285F4" d="M66.4 0C29.9 0 0 29.9 0 66.5v677c0 36.5 29.9 66.4 66.4 66.4h648.1L454.4 0h-388z"/><path fill="#EEE" d="M371.4 430.6c-2.5 30.3-28.4 75.2-91.1 75.2-54.3 0-98.3-44.9-98.3-100.2s44-100.2 98.3-100.2c30.9 0 51.5 13.4 63.3 24.3l41.2-39.6c-27.1-25-62.4-40.6-104.5-40.6-86.1 0-156 69.9-156 156s69.9 156 156 156c90.2 0 149.8-63.3 149.8-152.6 0-12.8-1.6-22.2-3.7-31.8h-146v53.4l91 .1z"/><path fill="#DBDBDB" d="M931.7 998.3c36.5 0 66.4-29.4 66.4-65.4V265.8c0-36-29.9-65.4-66.4-65.4H283.6l260.1 797.9h388z"/><path fill="#4352B8" d="M482.3 809.8l61.4 188.5 170.7-188.5z"/><path fill="#607988" d="M936.1 476.1V437H747.6v-63.2h-61.2V437H566.1v39.1h239.4c-12.8 45.1-41.1 87.7-68.7 120.8-48.9-57.9-49.1-76.7-49.1-76.7h-50.8s2.1 28.2 70.7 108.6c-22.3 22.8-39.2 36.3-39.2 36.3l15.6 48.8s23.6-20.3 53.1-51.6c29.6 32.1 67.8 70.7 117.2 116.7l32.1-32.1c-52.9-48-91.7-86.1-120.2-116.7 38.2-45.2 77-102.1 85.2-154.2H936v.1z"/></svg>`;

    const MODE_LABELS = {
        online:  GOOGLE_ICON + ' বাংলা',
        offline: '⌨ অফলাইন বাংলা',
    };
    const MODE_LABELS_SHORT = {
        online:  GOOGLE_ICON,
        offline: '⌨ অফলাইন',
    };
    const MODE_TOOLTIPS = {
        online:  'Uses Google Transliteration API — better accuracy with suggestions',
        offline: 'Local phonetic rules — works without internet',
    };
    // Sync initial mode with Transliterator's persisted mode
    let currentMode = (typeof Transliterator !== 'undefined' && Transliterator.getMode() === 'offline')
        ? 'offline' : 'online';

    function getMode() { return currentMode; }
    function getModeLabel(short) { return short ? MODE_LABELS_SHORT[currentMode] : MODE_LABELS[currentMode]; }
    function getModeTooltip() { return MODE_TOOLTIPS[currentMode]; }

    function cycleMode() {
        const idx = MODES.indexOf(currentMode);
        currentMode = MODES[(idx + 1) % MODES.length];
        // Sync with Transliterator
        if (typeof Transliterator !== 'undefined') {
            Transliterator.setMode(currentMode);
        }
        return currentMode;
    }

    function setMode(mode) {
        if (MODES.includes(mode)) {
            currentMode = mode;
            if (typeof Transliterator !== 'undefined') {
                Transliterator.setMode(mode);
            }
        }
    }

    // --- Shared State for Attached Input ---
    let _romanBuffer = '';
    let _prevBengali = '';
    let _attachedInput = null;

    function getRomanBuffer() { return _romanBuffer; }

    function clearBuffer() {
        _romanBuffer = '';
        _prevBengali = '';
    }

    /**
     * Accept a candidate: replace the current word in the input with the given text,
     * then clear the buffer.
     */
    function acceptCandidate(inputEl, text) {
        if (!inputEl) return;
        const pos = inputEl.selectionStart;
        const val = inputEl.value;
        const base = val.substring(0, pos - _prevBengali.length);
        const after = val.substring(pos);
        inputEl.value = base + text + after;
        inputEl.selectionStart = inputEl.selectionEnd = base.length + text.length;
        _prevBengali = '';
        _romanBuffer = '';
    }

    /**
     * Attach keyboard handler to an input element.
     *
     * Options:
     *   onChange(value) — called when the input value changes (fixed mode, space in phonetic, etc.)
     *   onBufferChange(buffer) — called when the Roman buffer changes in phonetic mode.
     *       The caller should use this to fetch async candidates and render a dropdown.
     */
    function attach(inputEl, { onChange, onBufferChange } = {}) {
        _attachedInput = inputEl;

        inputEl.addEventListener('keydown', (e) => {
            // Both online and offline use phonetic input
            if (!MODES.includes(currentMode)) return;

            // Allow control keys
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (['Escape', 'Tab', 'ArrowLeft', 'ArrowRight',
                 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                return;
            }

            // Enter: flush buffer, let caller handle
            if (e.key === 'Enter') {
                _romanBuffer = '';
                return;
            }

            // Phonetic input handling (both online and offline)
            {
                if (e.key === 'Backspace') {
                    // If text is selected, let browser handle delete-selection natively
                    if (inputEl.selectionStart !== inputEl.selectionEnd) {
                        _romanBuffer = '';
                        _prevBengali = '';
                        if (onBufferChange) onBufferChange('');
                        return; // let default handle
                    }
                    if (_romanBuffer.length > 0) {
                        e.preventDefault();
                        _romanBuffer = _romanBuffer.slice(0, -1);
                        _rebuildFromBuffer(inputEl, onChange);
                        if (onBufferChange) onBufferChange(_romanBuffer);
                    }
                    return;
                }

                // Only intercept printable characters
                if (e.key.length === 1) {
                    e.preventDefault();

                    // Space flushes and resets
                    if (e.key === ' ') {
                        _romanBuffer = '';
                        _prevBengali = '';
                        const start = inputEl.selectionStart;
                        const val = inputEl.value;
                        inputEl.value = val.substring(0, start) + ' ' + val.substring(inputEl.selectionEnd);
                        inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                        if (onChange) onChange(inputEl.value);
                        if (onBufferChange) onBufferChange('');
                        return;
                    }

                    _romanBuffer += e.key;
                    _rebuildFromBuffer(inputEl, onChange);
                    if (onBufferChange) onBufferChange(_romanBuffer);
                }
            }
        });

        // Reset buffer on focus/blur
        inputEl.addEventListener('focus', () => { clearBuffer(); });
        inputEl.addEventListener('blur', () => {
            // Delay clearing so click on candidate dropdown can fire first
            setTimeout(() => { clearBuffer(); }, 200);
        });
    }

    /**
     * Rebuild the input value from the Roman buffer using local transliteration.
     * This provides an immediate preview; the async candidate dropdown may override it.
     */
    function _rebuildFromBuffer(el, onChange) {
        const pos = el.selectionStart;
        const val = el.value;
        const bengali = transliterate(_romanBuffer);

        const base = val.substring(0, pos - _prevBengali.length);
        const after = val.substring(pos);

        el.value = base + bengali + after;
        el.selectionStart = el.selectionEnd = base.length + bengali.length;
        _prevBengali = bengali;

        if (onChange) onChange(el.value);
    }

    return {
        transliterate, probhatMap, PROBHAT_MAP,
        getMode, getModeLabel, getModeTooltip, cycleMode, setMode,
        attach, MODES, MODE_LABELS, MODE_LABELS_SHORT,
        getRomanBuffer, clearBuffer, acceptCandidate,
    };
})();
