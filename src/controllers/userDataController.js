const MOTOR_URL = 'http://localhost:3000';

async function userDataProxy(path, method, req, res) {
    try {
        const uid = req.headers['x-user-uid'];
        const url = `${MOTOR_URL}${path}`;

        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-uid': uid || ''
            }
        };

        if (method !== 'GET' && req.body) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error(`[VidaAnime UserData Proxy Error] ${path}:`, err.message);
        res.json({ success: false, error: 'Motor de datos no disponible' });
    }
}

function getFavorites(req, res) { return userDataProxy('/api/favorites', 'GET', req, res); }
function addFavorite(req, res) { return userDataProxy('/api/favorites', 'POST', req, res); }
function removeFavorite(req, res) { return userDataProxy(`/api/favorites/${req.params.slug}`, 'DELETE', req, res); }
function getHistory(req, res) { return userDataProxy('/api/history', 'GET', req, res); }
function updateHistory(req, res) { return userDataProxy('/api/history', 'POST', req, res); }

module.exports = {
    getFavorites, addFavorite, removeFavorite,
    getHistory, updateHistory
};
