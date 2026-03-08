const fs = require('fs');
const path = require('path');
const { getFirestoreDoc, setFirestoreDoc } = require('../services/firebaseService');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FAVORITES_FILE = path.join(DATA_DIR, 'favorites.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function readJSON(file) {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return []; }
}
function writeJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { }
}

// Formato nativo de AnimeVidaa (Sin transformadores de Ukiku)

// ─── Favorites ───
async function getFavorites(req, res) {
    const uid = req.headers['x-user-uid'] || req.query.uid;
    if (uid) {
        const doc = await getFirestoreDoc(uid, 'backups', 'favs');
        if (doc) {
            const list = doc.list.map(f => ({
                slug: f.slug || (f.link || '').replace('/anime/', ''),
                title: f.title || f.name,
                cover: f.cover || f.img,
                type: f.type
            }));
            return res.json({ success: true, data: list });
        }
    }
    res.json({ success: true, data: readJSON(FAVORITES_FILE) });
}

async function addFavorite(req, res) {
    const { slug, title, cover, type } = req.body;
    if (!slug || !title) return res.status(400).json({ success: false, error: 'slug y title requeridos' });

    const uid = req.headers['x-user-uid'] || req.query.uid;
    if (uid) {
        let doc = await getFirestoreDoc(uid, 'backups', 'favs');
        let currentList = doc ? doc.list : [];

        if (!currentList.find(f => (f.title || f.name) === title)) {
            currentList.unshift({ slug, title, cover: cover || '', type: type || '', addedAt: new Date().toISOString() });
            await setFirestoreDoc(uid, 'backups', 'favs', currentList);
        }

        const list = currentList.map(f => ({
            slug: f.slug || (f.link || '').replace('/anime/', ''),
            title: f.title || f.name,
            cover: f.cover || f.img,
            type: f.type
        }));
        return res.json({ success: true, data: list });
    }

    const favorites = readJSON(FAVORITES_FILE);
    if (!favorites.find(f => f.slug === slug)) {
        favorites.unshift({ slug, title, cover: cover || '', type: type || '', addedAt: new Date().toISOString() });
        writeJSON(FAVORITES_FILE, favorites);
    }
    res.json({ success: true, data: favorites });
}

async function removeFavorite(req, res) {
    const { slug } = req.params;
    const uid = req.headers['x-user-uid'] || req.query.uid;

    if (uid) {
        let doc = await getFirestoreDoc(uid, 'backups', 'favs');
        if (doc) {
            let currentList = doc.list;
            currentList = currentList.filter(f => {
                const fSlug = f.slug || (f.link || '').replace('/anime/', '');
                return fSlug !== slug;
            });
            await setFirestoreDoc(uid, 'backups', 'favs', currentList);

            const list = currentList.map(f => ({
                slug: f.slug || (f.link || '').replace('/anime/', ''),
                title: f.title || f.name,
                cover: f.cover || f.img,
                type: f.type
            }));
            return res.json({ success: true, data: list });
        }
    }

    let favorites = readJSON(FAVORITES_FILE);
    favorites = favorites.filter(f => f.slug !== slug);
    writeJSON(FAVORITES_FILE, favorites);
    res.json({ success: true, data: favorites });
}

// ─── History ───
async function getHistory(req, res) {
    const uid = req.headers['x-user-uid'] || req.query.uid;
    if (uid) {
        const doc = await getFirestoreDoc(uid, 'backups', 'history');
        if (doc) {
            const list = doc.list.map(h => ({
                animeSlug: h.animeSlug || (h.link || '').replace('/anime/', ''),
                animeTitle: h.animeTitle || h.name,
                animeCover: h.animeCover || '',
                episodeSlug: h.episodeSlug || h.eid,
                episodeNumber: h.episodeNumber || (parseInt((h.chapter || '').replace('Episodio ', '')) || 0),
                progress: h.progress || 0
            }));
            return res.json({ success: true, data: list });
        }
    }
    res.json({ success: true, data: readJSON(HISTORY_FILE) });
}

async function updateHistory(req, res) {
    const { animeSlug, animeTitle, animeCover, episodeSlug, episodeNumber, progress } = req.body;
    if (!animeSlug || !episodeSlug) return res.status(400).json({ success: false, error: 'Requeridos' });

    const uid = req.headers['x-user-uid'] || req.query.uid;
    if (uid) {
        let doc = await getFirestoreDoc(uid, 'backups', 'history');
        let currentList = doc ? doc.list : [];

        currentList = currentList.filter(h => (h.episodeSlug || h.eid) !== episodeSlug);
        currentList.unshift({
            animeSlug, animeTitle: animeTitle || '', animeCover: animeCover || '',
            episodeSlug, episodeNumber: episodeNumber || 0, watchedAt: new Date().toISOString(),
            progress: progress || 0
        });
        currentList = currentList.slice(0, 100);

        await setFirestoreDoc(uid, 'backups', 'history', currentList);

        const list = currentList.map(h => ({
            animeSlug: h.animeSlug || (h.link || '').replace('/anime/', ''),
            animeTitle: h.animeTitle || h.name,
            animeCover: h.animeCover || '',
            episodeSlug: h.episodeSlug || h.eid,
            episodeNumber: h.episodeNumber || (parseInt((h.chapter || '').replace('Episodio ', '')) || 0),
            progress: h.progress || 0
        }));
        return res.json({ success: true, data: list });
    }

    let history = readJSON(HISTORY_FILE);
    history = history.filter(h => h.episodeSlug !== episodeSlug);
    history.unshift({
        animeSlug, animeTitle: animeTitle || '', animeCover: animeCover || '',
        episodeSlug, episodeNumber: episodeNumber || 0, watchedAt: new Date().toISOString(),
        progress: progress || 0
    });
    history = history.slice(0, 100);
    writeJSON(HISTORY_FILE, history);
    res.json({ success: true, data: history });
}

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite,
    getHistory,
    updateHistory
};
