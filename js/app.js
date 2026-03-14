/**
 * Gitabitan App — Main application logic.
 *
 * Hash-based routing, song rendering, genre browsing.
 */

const App = (() => {
    const esc = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Genre slug → CSS color variable mapping
    const GENRE_COLORS = {
        'puja': 'var(--genre-puja)',
        'prem': 'var(--genre-prem)',
        'prakriti': 'var(--genre-prakriti)',
        'bichitra': 'var(--genre-bichitra)',
        'natya-giti': 'var(--genre-natya)',
        'prem-o-prakriti': 'var(--genre-prem-prakriti)',
        'puja-o-prarthana': 'var(--genre-puja-prarthana)',
        'swadesh': 'var(--genre-swadesh)',
        'anushtthanik': 'var(--genre-anushtthanik)',
        'bhanusimha': 'var(--genre-bhanusimha)',
        'anushtthanik-sangit': 'var(--genre-anushtthanik-sangit)',
        'jatiya-sangit': 'var(--genre-jatiya)',
        'pathantar-prem-o-prakriti': 'var(--genre-pathantar-pp)',
        'pathantar-bichitra': 'var(--genre-pathantar-b)',
    };

    let genres = [];
    let searchTimeout = null;
    let activeGenreFilter = null;
    let downloadsAvailable = null; // null = unknown, true/false after check

    function headerBar() {
        const dlLink = downloadsAvailable === true ? '<a href="#/downloads">ডাউনলোড</a>' : '';
        return `<header class="header-bar">
            <a class="logo" href="#/">রবীন্দ্রনাথ ঠাকুরের গীতবিতান</a>
            <nav>
                <a href="#/browse">রচনা</a>
                <a href="#/dramas">নৃত্যনাট্য</a>
                ${dlLink}
            </nav>
        </header>`;
    }

    // Candidate dropdown state
    let candidateTimeout = null;
    let activeCandidateIdx = 0;
    let currentCandidates = [];

    // --- Initialization ---

    async function init() {
        try {
            await SearchEngine.init();
            genres = SearchEngine.getGenres();

            // Check if downloads manifest exists, then show nav link
            fetch('downloads/manifest.json', { method: 'HEAD' })
                .then(r => {
                    downloadsAvailable = r.ok;
                    // Update nav bar if downloads became available
                    const nav = document.querySelector('.header-bar nav');
                    if (nav && downloadsAvailable) {
                        nav.insertAdjacentHTML('beforeend', '<a href="#/downloads">ডাউনলোড</a>');
                    }
                })
                .catch(() => { downloadsAvailable = false; });

            route();
            window.addEventListener('hashchange', route);
        } catch (err) {
            document.getElementById('app').innerHTML =
                `<div class="loading" style="color: #c00;">Error loading database: ${esc(err.message)}</div>`;
        }
    }

    // --- Router ---

    function route() {
        const hash = location.hash || '#/';
        const parts = hash.substring(2).split('/');

        if (parts[0] === 'song' && parts[1]) {
            renderSongView(parts[1]);
        } else if (parts[0] === 'genre' && parts[1] && parts[2]) {
            renderBrowseSubGenre(parts[1], parts[2]);
        } else if (parts[0] === 'genre' && parts[1]) {
            renderBrowseGenre(parts[1]);
        } else if (parts[0] === 'browse') {
            renderBrowseAll();
        } else if (parts[0] === 'downloads') {
            renderDownloads();
        } else if (parts[0] === 'dramas') {
            renderDramasView();
        } else if (parts[0] === 'drama' && parts[1]) {
            renderDramaView(parts[1]);
        } else {
            renderHome();
        }
    }

    // --- Home / Search View ---

    function renderHome() {
        activeGenreFilter = null;

        const app = document.getElementById('app');
        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="home-view" id="home-view">
                    <h1 class="home-title">রবীন্দ্রনাথ ঠাকুরের গীতবিতান</h1>
                    <p class="home-subtitle">গান সংকলন — ১,৯০৫ গান</p>
                    <div class="search-container" id="search-container">
                        <input type="text" class="search-bar" id="search-input"
                               placeholder="গান খুঁজুন..." autocomplete="off"
                               autocorrect="off" autocapitalize="none" spellcheck="false">
                        <button class="keyboard-toggle active" id="kb-toggle"
                                title="${BengaliKeyboard.getModeTooltip()}">${BengaliKeyboard.getModeLabel()}</button>
                    </div>
                    <div id="api-notification" class="api-notification"></div>
                    <div class="genre-chips" id="genre-chips"></div>
                    <div class="results-container" id="results"></div>
                </div>
            </div>`;

        renderGenreChips();
        setupSearch();

        // Check API health and show notification
        Transliterator.checkApiHealth().then(() => updateApiNotification());
    }

    function renderGenreChips(hitCounts) {
        const container = document.getElementById('genre-chips');
        if (!container) return;

        // Show main genres (skip pathantar variants)
        const mainGenres = genres.filter(g =>
            !g.slug.startsWith('pathantar') &&
            g.slug !== 'anushtthanik-sangit'
        );

        const hasSearch = hitCounts != null;
        const dramaCount = hasSearch
            ? (hitCounts['_dramas'] || 0)
            : SearchEngine.getDramaItemCount();

        let html = mainGenres.map(g => {
            const count = hasSearch ? (hitCounts[g.slug] || 0) : g.count;
            const dimmed = hasSearch && count === 0;
            const activeCls = activeGenreFilter === g.slug ? ' active' : '';
            const dimCls = dimmed ? ' dimmed' : '';
            return `
                <span class="genre-chip${activeCls}${dimCls}" data-genre="${g.slug}"
                      style="border-color: ${GENRE_COLORS[g.slug] || 'var(--border)'}">
                    ${esc(g.name_bn)} <span class="count">${count}</span>
                </span>
            `;
        }).join('');

        // Drama chip
        const dramaDimmed = hasSearch && dramaCount === 0;
        const dramaActiveCls = activeGenreFilter === '_dramas' ? ' active' : '';
        const dramaDimCls = dramaDimmed ? ' dimmed' : '';
        html += `
            <span class="genre-chip${dramaActiveCls}${dramaDimCls}" data-genre="_dramas"
                  style="border-color: ${GENRE_COLORS['natya-giti'] || 'var(--border)'}">
                নৃত্যনাট্য <span class="count">${dramaCount}</span>
            </span>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.genre-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (chip.classList.contains('dimmed')) return;
                const slug = chip.dataset.genre;
                if (activeGenreFilter === slug) {
                    activeGenreFilter = null;
                    chip.classList.remove('active');
                } else {
                    container.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
                    activeGenreFilter = slug;
                    chip.classList.add('active');
                }
                doSearch();
            });
        });
    }

    function setupSearch() {
        const input = document.getElementById('search-input');
        const kbToggle = document.getElementById('kb-toggle');
        if (!input) return;

        // Attach Bengali keyboard with buffer change callback
        BengaliKeyboard.attach(input, {
            onChange: (val) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(doSearch, 300);
            },
            onBufferChange: (buffer) => {
                if (buffer) {
                    // Debounce candidate fetching (works for both online and offline)
                    clearTimeout(candidateTimeout);
                    candidateTimeout = setTimeout(async () => {
                        const candidates = await Transliterator.getCandidates(buffer);
                        currentCandidates = candidates;
                        activeCandidateIdx = 0;
                        renderCandidateDropdown(candidates, buffer);
                    }, BengaliKeyboard.getMode() === 'online' ? 150 : 50);
                } else {
                    hideCandidateDropdown();
                    currentCandidates = [];
                }
            }
        });

        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(doSearch, 300);
        });

        // Keyboard shortcuts for candidate dropdown
        input.addEventListener('keydown', (e) => {
            if (currentCandidates.length === 0) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doSearch();
                }
                return;
            }

            // Candidate dropdown is open
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeCandidateIdx = Math.min(activeCandidateIdx + 1, currentCandidates.length - 1);
                highlightCandidate(activeCandidateIdx);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeCandidateIdx = Math.max(activeCandidateIdx - 1, 0);
                highlightCandidate(activeCandidateIdx);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                acceptCandidateAt(activeCandidateIdx);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideCandidateDropdown();
                currentCandidates = [];
                BengaliKeyboard.clearBuffer();
            } else if (e.key >= '1' && e.key <= '5') {
                const idx = parseInt(e.key) - 1;
                if (idx < currentCandidates.length) {
                    e.preventDefault();
                    acceptCandidateAt(idx);
                }
            }
        });

        // Keyboard mode toggle (online ↔ offline)
        kbToggle.addEventListener('click', () => {
            const mode = BengaliKeyboard.cycleMode();
            kbToggle.innerHTML = BengaliKeyboard.getModeLabel();
            kbToggle.title = BengaliKeyboard.getModeTooltip();

            // Clear candidates on mode switch
            hideCandidateDropdown();
            currentCandidates = [];

            updateApiNotification();
            input.focus();
        });

        // Listen for API status changes
        document.addEventListener('translit-api-status', () => {
            updateApiNotification();
        });

        input.focus();
    }

    /** Show/hide API availability notification below search bar. */
    function updateApiNotification() {
        const container = document.getElementById('api-notification');
        if (!container) return;

        const mode = BengaliKeyboard.getMode();
        const apiUp = Transliterator.isApiAvailable();

        if (mode === 'online' && apiUp === false) {
            container.className = 'api-notification warning';
            container.innerHTML = `
                Google API unavailable
                <button id="api-switch-btn">Switch to Offline</button>
            `;
            container.querySelector('#api-switch-btn').addEventListener('click', () => {
                BengaliKeyboard.setMode('offline');
                const kb = document.getElementById('kb-toggle');
                if (kb) {
                    kb.innerHTML = BengaliKeyboard.getModeLabel();
                    kb.title = BengaliKeyboard.getModeTooltip();
                }
                updateApiNotification();
            });
        } else if (mode === 'offline' && apiUp === true) {
            container.className = 'api-notification hint';
            container.innerHTML = `
                Google keyboard available — better accuracy
                <button id="api-switch-btn">Switch to Online</button>
            `;
            container.querySelector('#api-switch-btn').addEventListener('click', () => {
                BengaliKeyboard.setMode('online');
                const kb = document.getElementById('kb-toggle');
                if (kb) {
                    kb.innerHTML = BengaliKeyboard.getModeLabel();
                    kb.title = BengaliKeyboard.getModeTooltip();
                }
                updateApiNotification();
            });
        } else {
            container.className = 'api-notification';
            container.innerHTML = '';
        }
    }

    // --- Candidate Dropdown ---

    function renderCandidateDropdown(candidates, buffer) {
        const container = document.getElementById('search-container');
        if (!container || candidates.length === 0) {
            hideCandidateDropdown();
            return;
        }

        hideCandidateDropdown();
        const dropdown = document.createElement('div');
        dropdown.className = 'candidate-dropdown';
        dropdown.id = 'candidate-dropdown';

        const items = candidates.map((c, i) => {
            const num = toBengaliDigits(i + 1);
            return `<div class="candidate${i === activeCandidateIdx ? ' active' : ''}" data-idx="${i}">
                <span class="candidate-num">${num}</span> ${esc(c)}
            </div>`;
        }).join('');

        dropdown.innerHTML = `
            ${items}
            <div class="candidate-buffer">typing: ${esc(buffer)}</div>
        `;

        container.appendChild(dropdown);

        // Click handlers on candidates
        dropdown.querySelectorAll('.candidate[data-idx]').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent blur
                const idx = parseInt(el.dataset.idx);
                acceptCandidateAt(idx);
            });
        });
    }

    function highlightCandidate(idx) {
        const dropdown = document.getElementById('candidate-dropdown');
        if (!dropdown) return;
        dropdown.querySelectorAll('.candidate[data-idx]').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.idx) === idx);
        });
    }

    function hideCandidateDropdown() {
        const existing = document.getElementById('candidate-dropdown');
        if (existing) existing.remove();
    }

    function acceptCandidateAt(idx) {
        if (idx < 0 || idx >= currentCandidates.length) return;
        const text = currentCandidates[idx];
        const input = document.getElementById('search-input');
        BengaliKeyboard.acceptCandidate(input, text);
        hideCandidateDropdown();
        currentCandidates = [];
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(doSearch, 100);
    }

    // --- Search ---

    function doSearch() {
        const input = document.getElementById('search-input');
        const query = input ? input.value.trim() : '';
        const homeView = document.getElementById('home-view');

        if (!query && !activeGenreFilter) {
            if (homeView) homeView.classList.remove('has-results');
            const results = document.getElementById('results');
            if (results) results.innerHTML = '';
            renderGenreChips();
            return;
        }

        // Drama chip with no query → navigate to dramas page
        if (!query && activeGenreFilter === '_dramas') {
            activeGenreFilter = null;
            location.hash = '#/dramas';
            return;
        }

        if (homeView) homeView.classList.add('has-results');

        const hitCounts = SearchEngine.searchGenreCounts(query);
        renderGenreChips(hitCounts);

        const isDramaFilter = activeGenreFilter === '_dramas';
        const songGenre = (!activeGenreFilter || isDramaFilter) ? null : activeGenreFilter;

        const songResults = isDramaFilter ? [] : SearchEngine.search(query, { genre: songGenre });
        const dramaResults = (activeGenreFilter && !isDramaFilter) ? []
            : (query ? SearchEngine.searchDramas(query) : []);

        renderResults(songResults, dramaResults, query);
    }

    function renderResults(songResults, dramaResults, query) {
        const container = document.getElementById('results');
        if (!container) return;

        const total = songResults.length + dramaResults.length;
        if (total === 0) {
            container.innerHTML = `<div class="results-meta">কোনো ফল পাওয়া যায়নি</div>`;
            return;
        }

        let html = '';

        // Song results
        if (songResults.length > 0) {
            const countText = songResults.length >= 50 ? '৫০+' : toBengaliDigits(songResults.length);
            html += `<div class="results-meta">${countText} গান</div>`;
            html += songResults.map(s => renderResultCard(s)).join('');
        }

        // Drama results
        if (dramaResults.length > 0) {
            html += `<div class="results-meta results-drama-header">নৃত্যনাট্য — ${toBengaliDigits(dramaResults.length)} ফল</div>`;
            html += dramaResults.map(d => renderDramaResultCard(d)).join('');
        }

        container.innerHTML = html;

        container.querySelectorAll('.result-card[data-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                location.hash = `#/song/${card.dataset.id}`;
            });
        });

        container.querySelectorAll('.result-card[data-drama]').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                location.hash = card.dataset.href;
            });
        });
    }

    function renderResultCard(song) {
        const genreColor = GENRE_COLORS[song.genre_slug] || 'var(--accent-light)';
        const preview = song.preview
            ? song.preview.replace(/→/g, '<mark>').replace(/←/g, '</mark>')
            : '';

        return `
            <a class="result-card" data-id="${esc(song.id)}" href="#/song/${esc(song.id)}">
                <div class="result-title">${esc(song.title_bn)}</div>
                <div class="result-meta">
                    <span class="result-genre-tag" style="background: ${genreColor}; color: var(--text);">
                        ${esc(song.genre_bn)}${song.sub_genre_bn ? ' / ' + esc(song.sub_genre_bn) : ''}
                    </span>
                    <span>#${song.number}</span>
                    ${song.play_name_bn ? `<span>${esc(song.play_name_bn)}</span>` : ''}
                </div>
                ${preview ? `<div class="result-preview">${preview}</div>` : ''}
            </a>
        `;
    }

    function renderDramaResultCard(item) {
        const href = `#/drama/${item.drama_id}`;
        const preview = item.preview
            ? item.preview.replace(/→/g, '<mark>').replace(/←/g, '</mark>')
            : '';
        const label = item.type === 'scene'
            ? `দৃশ্য ${toBengaliDigits(item.number)}`
            : `#${item.number}`;

        return `
            <a class="result-card result-card-drama" data-drama="${esc(item.drama_id)}"
               data-href="${esc(href)}" href="${esc(href)}">
                <div class="result-title">${esc(item.title_bn || '')}</div>
                <div class="result-meta">
                    <span class="result-genre-tag result-drama-tag">
                        ${esc(item.drama_name_bn)}
                    </span>
                    <span>${label}</span>
                </div>
                ${preview ? `<div class="result-preview">${preview}</div>` : ''}
            </a>
        `;
    }

    // --- Song View ---

    function renderSongView(songId) {
        const app = document.getElementById('app');
        const song = SearchEngine.getSong(songId);

        if (!song) {
            app.innerHTML = `
                ${headerBar()}
                <div class="main-content">
                    <div class="song-view">
                        <a class="back-link" href="#/">← ফিরে যান</a>
                        <p>গান পাওয়া যায়নি।</p>
                    </div>
                </div>`;
            return;
        }

        const adj = SearchEngine.getAdjacentSongs(songId);
        const body = renderSongBody(song.body_structured);
        const notes = renderNotes(song.notes);

        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="song-view">
                    <a class="back-link" href="#/">← ফিরে যান</a>
                    <div class="song-header-section">
                        <div class="song-number">#${song.number}</div>
                        <h1 class="song-title">${esc(song.title_bn)}</h1>
                        <div class="song-genre-info">
                            <a class="song-genre-tag" href="#/genre/${song.genre_slug}">
                                ${esc(song.genre_bn)}
                            </a>
                            ${song.sub_genre_bn ? `
                                <a class="song-genre-tag" href="#/genre/${song.genre_slug}/${song.sub_genre_slug}">
                                    ${esc(song.sub_genre_bn)}
                                </a>
                            ` : ''}
                        </div>
                        ${song.play_name_bn ? `<div class="annotation-play-name">নাটক: ${esc(song.play_name_bn)}</div>` : ''}
                        ${song.date_bengali || song.date_western ? `
                            <div class="song-date">
                                ${song.date_bengali ? esc(song.date_bengali) : ''}
                                ${song.date_western ? `(${esc(song.date_western)})` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${body}
                    ${notes}
                    <div class="song-nav">
                        ${adj.prev ? `<a href="#/song/${adj.prev.id}">← ${esc(adj.prev.title_bn)}</a>` : '<span></span>'}
                        <a href="#/genre/${song.genre_slug}${song.sub_genre_slug ? '/' + song.sub_genre_slug : ''}">সূচী</a>
                        ${adj.next ? `<a href="#/song/${adj.next.id}">${esc(adj.next.title_bn)} →</a>` : '<span></span>'}
                    </div>
                </div>
            </div>`;
    }

    // --- Song Body Renderer (ported from lib/render.py) ---

    function renderSongBody(body, isDrama) {
        if (!body || body.length === 0) return '';

        // Find baseline indent
        const verseLines = body.filter(l => (l.type || 'verse') === 'verse');
        let baseline = 14;
        if (verseLines.length > 0) {
            const counts = {};
            verseLines.forEach(l => {
                const ic = l.indent_col || 14;
                counts[ic] = (counts[ic] || 0) + 1;
            });
            baseline = parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
        }

        // Detect refrains
        const refrainIndices = detectRefrains(body, baseline);

        // Use two-column layout if explicitly flagged or if speaker lines detected
        if (isDrama === undefined) {
            isDrama = body.some(l => l.type === 'speaker');
        }

        let html = '<div class="song-body">\n';

        body.forEach((line, i) => {
            const type = line.type || 'verse';

            if (type === 'stage_direction') {
                if (isDrama) {
                    html += `<div class="dialogue-row no-speaker">
                        <div class="speaker-col"></div>
                        <div class="lyrics-col"><div class="stage-direction">${esc(line.text_bn || '')}</div></div>
                    </div>\n`;
                } else {
                    html += `<div class="stage-direction">${esc(line.text_bn || '')}</div>\n`;
                }
            } else if (type === 'speaker') {
                const speaker = esc(line.speaker_bn || line.speaker || '');
                const text = line.text_bn || '';
                if (text && text.trim()) {
                    html += `<div class="dialogue-row">
                        <div class="speaker-col">${speaker}।</div>
                        <div class="lyrics-col"><div class="verse-line">${renderVerseContent(line)}</div></div>
                    </div>\n`;
                } else {
                    html += `<div class="dialogue-row speaker-only">
                        <div class="speaker-col">${speaker}।</div>
                        <div class="lyrics-col"></div>
                    </div>\n`;
                }
            } else if (type === 'annotation') {
                const aType = line.annotation_type || '';
                if (isDrama) {
                    html += `<div class="dialogue-row no-speaker">
                        <div class="speaker-col"></div>
                        <div class="lyrics-col"><div class="annotation annotation-${esc(aType)}">${esc(line.text_bn || '')}</div></div>
                    </div>\n`;
                } else {
                    html += `<div class="annotation annotation-${esc(aType)}">${esc(line.text_bn || '')}</div>\n`;
                }
            } else {
                // verse
                const isRefrain = refrainIndices.has(i);
                const indentCls = computeIndentClass(line.indent_col || baseline, baseline);
                const refrainCls = isRefrain ? ' refrain' : '';
                if (isDrama) {
                    html += `<div class="dialogue-row no-speaker">
                        <div class="speaker-col"></div>
                        <div class="lyrics-col"><div class="verse-line${indentCls}${refrainCls}">${renderVerseContent(line)}</div></div>
                    </div>\n`;
                } else {
                    html += `<div class="verse-line${indentCls}${refrainCls}">${renderVerseContent(line)}</div>\n`;
                }
            }
        });

        html += '</div>\n';
        return html;
    }

    function renderVerseContent(line) {
        const margin = line.margin_word_bn || '';
        const hemistichs = line.hemistichs;
        const text = esc(line.text_bn || '');

        if (margin) {
            const verse = hemistichs && hemistichs.length >= 2
                ? hemistichs.map(h => `<span>${esc(h)}</span>`).join('<span class="hemistich-gap"></span>')
                : text;
            return `<span class="margin-word">${esc(margin)}</span><span class="verse-text">${verse}</span>`;
        } else if (hemistichs && hemistichs.length >= 2) {
            return hemistichs.map(h => `<span>${esc(h)}</span>`).join('<span class="hemistich-gap"></span>');
        }
        return text;
    }

    function detectRefrains(body, baseline) {
        const indices = new Set();
        const verseLines = body.filter(l => (l.type || 'verse') === 'verse');
        if (verseLines.length === 0) return indices;

        const minIndent = Math.min(...verseLines.map(l => l.indent_col || 14));
        const textCounts = {};

        body.forEach((line, i) => {
            if ((line.type || 'verse') === 'verse' && (line.indent_col || 14) === minIndent) {
                const t = line.text_bn || '';
                if (!textCounts[t]) textCounts[t] = [];
                textCounts[t].push(i);
            }
        });

        Object.values(textCounts).forEach(idxs => {
            if (idxs.length >= 2) {
                idxs.slice(1).forEach(idx => indices.add(idx));
                if (idxs.length >= 3) {
                    idxs.forEach(idx => indices.add(idx));
                }
            }
        });

        return indices;
    }

    function computeIndentClass(indentCol, baseline) {
        const diff = indentCol - baseline;
        if (diff >= 20) return ' indent-refrain';
        if (diff >= 8) return ' indent-deep';
        if (diff >= 4) return ' indent-medium';
        return '';
    }

    function renderNotes(notes) {
        if (!notes) return '';

        let html = '<div class="editorial-notes">\n';

        const header = notes.edition_comparison_bn || notes.edition_comparison || '';
        if (header) {
            html += `<div class="notes-header">দ্র: ${esc(header)}</div>\n`;
        }

        (notes.variants || []).forEach(v => {
            if (v.raw) {
                html += `<div class="note-variant">${esc(v.raw_bn || v.raw)}</div>\n`;
            } else {
                const lineRef = v.line_bn || v.line || '';
                const from = v.from_bn || v.from || '';
                const to = v.to_bn || v.to || '';
                html += `<div class="note-variant">
                    <span class="line-ref">${esc(lineRef)} লাইনে</span>
                    <span class="from">${esc(from)}</span>
                    <span class="arrow">⟹</span>
                    <span class="to">${esc(to)}</span>
                </div>\n`;
            }
        });

        html += '</div>\n';
        return html;
    }

    // --- Browse Views ---

    function renderBrowseAll() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="browse-view">
                    <h1 class="browse-title">রচনা সমূহ</h1>
                    <p class="browse-subtitle">বিভাগ অনুসারে গান</p>
                    <div class="genre-grid">
                        ${genres.map(g => `
                            <a class="genre-card" href="#/genre/${g.slug}">
                                <div class="genre-card-name">${esc(g.name_bn)}</div>
                                <div class="genre-card-count">${toBengaliDigits(g.count)} গান</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    }

    function renderBrowseGenre(genreSlug) {
        const app = document.getElementById('app');
        const genre = SearchEngine.getGenre(genreSlug);
        if (!genre) { renderBrowseAll(); return; }

        const subGenres = SearchEngine.getSubGenres(genreSlug);

        if (subGenres.length > 0) {
            app.innerHTML = `
                ${headerBar()}
                <div class="main-content">
                    <div class="browse-view">
                        <div class="breadcrumb">
                            <a href="#/browse">রচনা</a>
                            <span class="crumb-sep">›</span>
                            ${esc(genre.name_bn)}
                        </div>
                        <h1 class="browse-title">${esc(genre.name_bn)}</h1>
                        <div class="genre-grid">
                            ${subGenres.map(sg => `
                                <a class="genre-card" href="#/genre/${genreSlug}/${sg.slug}">
                                    <div class="genre-card-name">${esc(sg.name_bn)}</div>
                                    <div class="genre-card-count">${toBengaliDigits(sg.count)} গান</div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                </div>`;
        } else {
            const songs = SearchEngine.browseSongs({ genre: genreSlug, limit: 1000 });
            app.innerHTML = `
                ${headerBar()}
                <div class="main-content">
                    <div class="browse-view">
                        <div class="breadcrumb">
                            <a href="#/browse">রচনা</a>
                            <span class="crumb-sep">›</span>
                            ${esc(genre.name_bn)}
                        </div>
                        <h1 class="browse-title">${esc(genre.name_bn)}</h1>
                        <p class="browse-subtitle">${toBengaliDigits(songs.length)} গান</p>
                        ${renderSongList(songs)}
                    </div>
                </div>`;
        }
    }

    function renderBrowseSubGenre(genreSlug, subGenreSlug) {
        const app = document.getElementById('app');
        const genre = SearchEngine.getGenre(genreSlug);
        const subGenre = SearchEngine.getSubGenre(subGenreSlug);
        if (!genre || !subGenre) { renderBrowseGenre(genreSlug); return; }

        const songs = SearchEngine.browseSongs({ genre: genreSlug, subGenre: subGenreSlug, limit: 1000 });

        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="browse-view">
                    <div class="breadcrumb">
                        <a href="#/browse">রচনা</a>
                        <span class="crumb-sep">›</span>
                        <a href="#/genre/${genreSlug}">${esc(genre.name_bn)}</a>
                        <span class="crumb-sep">›</span>
                        ${esc(subGenre.name_bn)}
                    </div>
                    <h1 class="browse-title">${esc(subGenre.name_bn)}</h1>
                    <p class="browse-subtitle">${esc(genre.name_bn)} — ${toBengaliDigits(songs.length)} গান</p>
                    ${renderSongList(songs)}
                </div>
            </div>`;
    }

    function renderSongList(songs) {
        if (songs.length === 0) return '<p>কোনো গান পাওয়া যায়নি।</p>';
        return `<div class="song-list">
            ${songs.map(s => `
                <a class="song-list-item" href="#/song/${s.id}">
                    <span class="song-list-num">${toBengaliDigits(s.number)}</span>
                    <span class="song-list-title">${esc(s.title_bn)}</span>
                </a>
            `).join('')}
        </div>`;
    }

    // --- Drama Views ---

    function renderDramasView() {
        const app = document.getElementById('app');
        const dramas = SearchEngine.getDramas();

        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="browse-view">
                    <h1 class="browse-title">নৃত্যনাট্য</h1>
                    <p class="browse-subtitle">নৃত্যনাট্য ও গীতিনাট্য</p>
                    <div class="genre-grid">
                        ${dramas.map(d => `
                            <a class="genre-card" href="#/drama/${d.id}">
                                <div class="genre-card-name">${esc(d.name_bn)}</div>
                                <div class="genre-card-count">
                                    ${toBengaliDigits(d.item_count)} ${d.structure === 'scene-based' ? 'দৃশ্য' : 'গান'}
                                    ${d.date_western ? ` · ${d.date_western}` : ''}
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    }

    function renderDramaView(dramaId) {
        const app = document.getElementById('app');
        const drama = SearchEngine.getDrama(dramaId);

        if (!drama) {
            renderDramasView();
            return;
        }

        // Filter out scene 0 (preamble) — not a real scene
        const items = drama.items.filter(item => !(item.type === 'scene' && item.number === 0));

        const itemList = items.map(item => {
            const label = item.type === 'scene'
                ? `দৃশ্য ${toBengaliDigits(item.number)}`
                : `${toBengaliDigits(item.number)}`;
            return `
                <a class="song-list-item" href="#/drama/${dramaId}#item-${item.number}"
                   onclick="App.scrollToItem(${item.number}); return false;">
                    <span class="song-list-num">${label}</span>
                    <span class="song-list-title">${esc(item.title_bn || '')}</span>
                </a>
            `;
        }).join('');

        const itemBodies = items.map(item => {
            const body = renderSongBody(item.body_structured, true);
            const title = item.type === 'scene'
                ? `দৃশ্য ${toBengaliDigits(item.number)}${item.title_bn ? ' — ' + esc(item.title_bn) : ''}`
                : `${toBengaliDigits(item.number)}. ${esc(item.title_bn || '')}`;
            return `
                <section id="item-${item.number}" style="margin-top: 2rem;">
                    <h2 class="song-title" style="font-size: 1.2rem; border-bottom: 1px solid var(--border);
                        padding-bottom: 0.5rem; margin-bottom: 1rem;">${title}</h2>
                    ${body}
                </section>
            `;
        }).join('');

        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="song-view">
                    <a class="back-link" href="#/dramas">← নৃত্যনাট্য</a>
                    <div class="song-header-section">
                        <h1 class="song-title">${esc(drama.name_bn)}</h1>
                        ${drama.date_western ? `<div class="song-date">${drama.date_western}</div>` : ''}
                    </div>
                    <details style="margin-bottom: 1.5rem;">
                        <summary style="cursor: pointer; color: var(--accent); font-weight: 600;">
                            সূচী (${toBengaliDigits(items.length)} ${drama.structure === 'scene-based' ? 'দৃশ্য' : 'গান'})
                        </summary>
                        <div class="song-list" style="margin-top: 0.5rem;">${itemList}</div>
                    </details>
                    ${itemBodies}
                </div>
            </div>`;
    }

    function scrollToItem(number) {
        const el = document.getElementById(`item-${number}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- Downloads View ---

    let downloadsManifest = null;

    async function renderDownloads() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${headerBar()}
            <div class="main-content">
                <div class="browse-view">
                    <h1 class="browse-title">ডাউনলোড</h1>
                    <p class="browse-subtitle">পিডিএফ এবং অফলাইন সংস্করণ</p>
                    <div id="downloads-content">
                        <div class="loading"><div class="spinner"></div> লোড হচ্ছে...</div>
                    </div>
                </div>
            </div>`;

        const container = document.getElementById('downloads-content');

        if (!downloadsManifest) {
            try {
                const resp = await fetch('downloads/manifest.json');
                if (!resp.ok) throw new Error('not found');
                downloadsManifest = await resp.json();
            } catch {
                container.innerHTML = `<p class="downloads-unavailable">ডাউনলোড এই সংস্করণে উপলব্ধ নয়।<br>
                    <span style="font-size: 0.85rem; color: var(--text-tertiary);">
                        Downloads are only available on the hosted version.
                    </span></p>`;
                return;
            }
        }

        let html = '';

        if (downloadsManifest.bundles && downloadsManifest.bundles.length > 0) {
            html += '<h2 class="downloads-section-title">অফলাইন সংস্করণ</h2>';
            html += downloadsManifest.bundles.map(b => `
                <details class="bundle-details">
                    <summary class="bundle-summary">
                        <div class="download-info">
                            <div class="download-name">${esc(b.name)}</div>
                            <div class="download-desc">${esc(b.description)}</div>
                        </div>
                        <div class="download-meta">${esc(b.size)}</div>
                    </summary>
                    <div class="terminal">
                        <div class="terminal-titlebar">
                            <span class="terminal-dot red"></span>
                            <span class="terminal-dot yellow"></span>
                            <span class="terminal-dot green"></span>
                            <span class="terminal-title">Terminal</span>
                        </div>
                        <pre class="terminal-body"><span class="t-prompt">$</span> <span class="t-cmd">unzip</span> gitabitan-web.zip
<span class="t-dim">Archive:  gitabitan-web.zip
  inflating: index.html
  inflating: gitabitan.db
  inflating: serve.py
  inflating: css/style.css
  inflating: js/app.js
  ...</span>

<span class="t-prompt">$</span> <span class="t-cmd">python3</span> serve.py <span class="t-flag">-h</span>
<span class="t-out">usage: serve.py [-h] [--port PORT] [--no-open]

Serve the Gitabitan web app

options:
  -h, --help   show this help message and exit
  --port PORT  Port to serve on (default: 8080)
  --no-open    Don't open browser automatically</span>

<span class="t-prompt">$</span> <span class="t-cmd">python3</span> serve.py <span class="t-flag">--port</span> <span class="t-arg">3000</span>

  <span class="t-brand">গীতবিতান</span> — Gitabitan Browser
  Serving at <span class="t-link">http://localhost:3000</span>
  Press Ctrl+C to stop
</pre>
                    </div>
                    <a class="download-card bundle-download" href="downloads/${esc(b.file)}" download>
                        <div class="download-info">
                            <div class="download-name">ডাউনলোড — ${esc(b.file)}</div>
                        </div>
                        <div class="download-meta">${esc(b.size)}</div>
                    </a>
                </details>
            `).join('');
        }

        if (downloadsManifest.pdfs && downloadsManifest.pdfs.length > 0) {
            html += '<h2 class="downloads-section-title">পিডিএফ</h2>';
            html += downloadsManifest.pdfs.map(p => `
                <a class="download-card" href="downloads/${esc(p.file)}" download>
                    <div class="download-info">
                        <div class="download-name">${esc(p.name)}</div>
                        ${p.count ? `<div class="download-desc">${toBengaliDigits(p.count)} গান</div>` : ''}
                    </div>
                    <div class="download-meta">${esc(p.size)}</div>
                </a>
            `).join('');
        }

        container.innerHTML = html;
    }

    // --- Helpers ---

    function toBengaliDigits(n) {
        const digits = '০১২৩৪৫৬৭৮৯';
        return String(n).replace(/\d/g, d => digits[d]);
    }

    // Public API
    return { init, scrollToItem };
})();

// Start the app
document.addEventListener('DOMContentLoaded', App.init);
