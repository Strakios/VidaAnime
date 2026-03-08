const express = require('express');
const router = express.Router();
const animeCtrl = require('../controllers/animeController');
// Limpiar caché al cargar las rutas para asegurar datos frescos tras reinicio
if (animeCtrl.clearCache) animeCtrl.clearCache();
const playlistCtrl = require('../controllers/playlistController');
const userDataCtrl = require('../controllers/userDataController');
const streamCtrl = require('../controllers/streamController');

// ─── Content Endpoints ───
router.get('/api/today', animeCtrl.getToday);
router.get('/api/weekly', animeCtrl.getWeekly);
router.get('/api/season', animeCtrl.getSeason);
router.get('/api/top', animeCtrl.getTop);
router.get('/api/catalog', animeCtrl.getCatalog);
router.get('/api/search', animeCtrl.search);
router.get('/api/schedule', animeCtrl.getSchedule);

// ─── Anime & Episode Detail ───
router.get('/api/anime/:slug', animeCtrl.getAnime);
router.get('/api/episode/:slug', animeCtrl.getEpisode);
router.get('/api/episode/:animeSlug/:number', animeCtrl.getEpisodeByNumber);

// ─── IPTV Playlist ───
router.get('/playlist.m3u', playlistCtrl.generatePlaylist);

// ─── User Data ───
router.get('/api/favorites', userDataCtrl.getFavorites);
router.post('/api/favorites', userDataCtrl.addFavorite);
router.delete('/api/favorites/:slug', userDataCtrl.removeFavorite);
router.get('/api/history', userDataCtrl.getHistory);
router.post('/api/history', userDataCtrl.updateHistory);

// ─── Stream Proxy ───
router.get('/api/stream/resolve', streamCtrl.resolveStream);
router.get('/api/stream/proxy', streamCtrl.proxyStream);

// ─── Health Check ───
router.get('/api/ping', (req, res) => {
    res.json({
        success: true,
        message: 'PONG!',
        serverId: global.SERVER_ID || 'UNKNOWN',
        time: new Date().toISOString()
    });
});

module.exports = router;
