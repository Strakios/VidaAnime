const MOTOR_URL = 'http://localhost:3000';

async function engineProxy(path, req, res) {
    try {
        const url = new URL(path, MOTOR_URL);
        // Forward query params
        Object.keys(req.query).forEach(key => url.searchParams.append(key, req.query[key]));

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Engine error: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error(`[VidaAnime Proxy Error] ${path}:`, err.message);
        res.json({ success: false, error: 'Motor Anim no disponible' });
    }
}

async function getToday(req, res) { return engineProxy('/api/today', req, res); }
async function getWeekly(req, res) { return engineProxy('/api/weekly', req, res); }
async function getCatalog(req, res) { return engineProxy('/api/catalog', req, res); }
async function search(req, res) { return engineProxy('/api/search', req, res); }
async function getAnime(req, res) { return engineProxy(`/api/anime/${req.params.slug}`, req, res); }
async function getEpisode(req, res) { return engineProxy(`/api/episode/${req.params.slug}`, req, res); }
async function getSchedule(req, res) { return engineProxy('/api/schedule', req, res); }
async function getEpisodeByNumber(req, res) {
    return engineProxy(`/api/episode/${req.params.animeSlug}/${req.params.number}`, req, res);
}
async function getSeason(req, res) { return engineProxy('/api/season', req, res); }
async function getTop(req, res) { return engineProxy('/api/top', req, res); }

module.exports = {
    getToday, getWeekly, getCatalog, search, getAnime, getEpisode,
    getSchedule, getEpisodeByNumber, getSeason, getTop
};
