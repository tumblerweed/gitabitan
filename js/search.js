/**
 * Gitabitan Search Engine — sql.js wrapper.
 *
 * Loads the SQLite database (with FTS5) via sql.js WASM
 * and exposes query functions for the app.
 */

const SearchEngine = (() => {
    let db = null;

    /** Initialize: load WASM + database. */
    async function init() {
        const SQL = await initSqlJs({
            locateFile: file => `vendor/${file}`
        });

        const response = await fetch('gitabitan.db');
        const buf = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buf));
    }

    /** Run a query and return rows as objects. */
    function query(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    /** Search songs using LIKE (sql.js doesn't include FTS5). */
    function search(text, { genre = null, subGenre = null, limit = 50 } = {}) {
        if (!text || !text.trim()) {
            return browseSongs({ genre, subGenre, limit });
        }

        const pattern = '%' + text.trim() + '%';
        let sql = `SELECT id, number, title_bn, genre_bn, sub_genre_bn,
                          genre_slug, sub_genre_slug, date_western, play_name_bn
                   FROM songs
                   WHERE (title_bn LIKE ? OR body_bn LIKE ?
                          OR genre_bn LIKE ? OR sub_genre_bn LIKE ?)`;
        const params = [pattern, pattern, pattern, pattern];

        if (genre) {
            sql += ' AND genre_slug = ?';
            params.push(genre);
        }
        if (subGenre) {
            sql += ' AND sub_genre_slug = ?';
            params.push(subGenre);
        }

        sql += ' ORDER BY global_sequence LIMIT ?';
        params.push(limit);

        return query(sql, params);
    }

    /** Browse songs (no search text). */
    function browseSongs({ genre = null, subGenre = null, limit = 200 } = {}) {
        let sql = `SELECT id, number, title_bn, genre_bn, sub_genre_bn,
                          genre_slug, sub_genre_slug, date_western, play_name_bn
                   FROM songs WHERE 1=1`;
        const params = [];

        if (genre) {
            sql += ' AND genre_slug = ?';
            params.push(genre);
        }
        if (subGenre) {
            sql += ' AND sub_genre_slug = ?';
            params.push(subGenre);
        }

        sql += ' ORDER BY global_sequence LIMIT ?';
        params.push(limit);

        return query(sql, params);
    }

    /** Get a single song with full data. */
    function getSong(id) {
        const rows = query(
            `SELECT * FROM songs WHERE id = ?`, [id]
        );
        if (rows.length === 0) return null;
        const song = rows[0];
        song.body_structured = JSON.parse(song.body_structured || '[]');
        song.notes = JSON.parse(song.notes || 'null');
        return song;
    }

    /** Get all genres with song counts. */
    function getGenres() {
        return query(`
            SELECT g.slug, g.name_bn, g.sort_order,
                   (SELECT count(*) FROM songs WHERE genre_slug = g.slug) AS count
            FROM genres g
            ORDER BY g.sort_order
        `);
    }

    /** Get sub-genres for a genre, with counts. */
    function getSubGenres(genreSlug) {
        return query(`
            SELECT sg.slug, sg.name_bn, sg.sort_order, sg.genre_slug,
                   (SELECT count(*) FROM songs WHERE sub_genre_slug = sg.slug) AS count
            FROM sub_genres sg
            WHERE sg.genre_slug = ?
            ORDER BY sg.sort_order
        `, [genreSlug]);
    }

    /** Get genre info by slug. */
    function getGenre(slug) {
        const rows = query(`SELECT * FROM genres WHERE slug = ?`, [slug]);
        return rows[0] || null;
    }

    /** Get sub-genre info by slug. */
    function getSubGenre(slug) {
        const rows = query(`SELECT * FROM sub_genres WHERE slug = ?`, [slug]);
        return rows[0] || null;
    }

    /** Get all dramas. */
    function getDramas() {
        return query(`
            SELECT d.id, d.name_bn, d.sort_order, d.date_western, d.structure,
                   (SELECT count(*) FROM drama_items WHERE drama_id = d.id) AS item_count
            FROM dramas d
            ORDER BY d.sort_order
        `);
    }

    /** Get a drama with its items. */
    function getDrama(id) {
        const rows = query(`SELECT * FROM dramas WHERE id = ?`, [id]);
        if (rows.length === 0) return null;
        const drama = rows[0];
        drama.items = query(
            `SELECT * FROM drama_items WHERE drama_id = ? ORDER BY number`, [id]
        );
        drama.items.forEach(item => {
            item.body_structured = JSON.parse(item.body_structured || '[]');
        });
        return drama;
    }

    /** Search drama items using LIKE (sql.js doesn't include FTS5). */
    function searchDramas(text, { limit = 20 } = {}) {
        if (!text || !text.trim()) return [];
        const pattern = '%' + text.trim() + '%';
        return query(`
            SELECT di.id, di.drama_id, di.number, di.type, di.title_bn,
                   d.name_bn AS drama_name_bn
            FROM drama_items di
            JOIN dramas d ON d.id = di.drama_id
            WHERE di.title_bn LIKE ? OR di.body_bn LIKE ?
            ORDER BY d.sort_order, di.number
            LIMIT ?
        `, [pattern, pattern, limit]);
    }

    /** Get adjacent songs for navigation. */
    function getAdjacentSongs(id) {
        const current = query(`SELECT global_sequence FROM songs WHERE id = ?`, [id]);
        if (current.length === 0) return { prev: null, next: null };
        const seq = current[0].global_sequence;

        const prev = query(
            `SELECT id, title_bn, number FROM songs WHERE global_sequence = ?`, [seq - 1]
        );
        const next = query(
            `SELECT id, title_bn, number FROM songs WHERE global_sequence = ?`, [seq + 1]
        );
        return {
            prev: prev[0] || null,
            next: next[0] || null
        };
    }

    return {
        init, search, searchDramas, browseSongs, getSong,
        getGenres, getSubGenres, getGenre, getSubGenre,
        getDramas, getDrama, getAdjacentSongs
    };
})();
