const express = require('express');
const router = express.Router();
const animeCtrl = require('../controllers/animeController');
const streamCtrl = require('../controllers/streamController');
const userDataCtrl = require('../controllers/userDataController');

// Content
router.get('/api/today', animeCtrl.getToday);
router.get('/api/weekly', animeCtrl.getWeekly);
router.get('/api/catalog', animeCtrl.getCatalog);
router.get('/api/search', animeCtrl.search);
router.get('/api/schedule', animeCtrl.getSchedule);
router.get('/api/season', animeCtrl.getSeason);
router.get('/api/top', animeCtrl.getTop);

// Details
router.get('/api/anime/:slug', animeCtrl.getAnime);
router.get('/api/episode/:slug', animeCtrl.getEpisode);
router.get('/api/episode/:animeSlug/:number', animeCtrl.getEpisodeByNumber);

// User Data (Persistencia en el motor)
router.get('/api/favorites', userDataCtrl.getFavorites);
router.post('/api/favorites', userDataCtrl.addFavorite);
router.delete('/api/favorites/:slug', userDataCtrl.removeFavorite);
router.get('/api/history', userDataCtrl.getHistory);
router.post('/api/history', userDataCtrl.updateHistory);

// Streaming
router.get('/api/stream/resolve', streamCtrl.resolveStream);
router.get('/api/stream/proxy', streamCtrl.proxyStream);

// Utils
router.post('/api/clear-cache', (req, res) => {
    animeCtrl.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
});

router.get('/api/ping', (req, res) => res.json({ success: true, server: 'Anim-Motor' }));

module.exports = router;
