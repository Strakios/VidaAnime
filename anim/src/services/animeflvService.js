const NodeCache = require('node-cache');
const axios = require('axios');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const API_BASE = process.env.ANIMEFLV_API || 'https://animeflv.ahmedrangel.com';

async function fetchAPI(endpoint, options = {}) {
    const cacheKey = `${endpoint}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const url = `${API_BASE}${endpoint}`;

    try {
        const response = await axios({
            url: url,
            method: options.method || 'GET',
            data: options.body || undefined,
            headers: {
                'Accept': 'application/json',
                'User-Agent': "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
                'Referer': 'https://www3.animeflv.net/'
            }
        });

        const data = response.data;
        cache.set(cacheKey, data);
        return data;
    } catch (err) {
        console.error('API Fetch Error:', err.message);
        throw err;
    }
}

module.exports = {
    getLatestEpisodes: () => fetchAPI('/api/list/latest-episodes'),
    getAnimesOnAir: () => fetchAPI('/api/list/animes-on-air'),
    searchAnime: (query, page = 1) => fetchAPI(`/api/search?query=${encodeURIComponent(query)}&page=${page}`),
    getAnimeBySlug: (slug) => fetchAPI(`/api/anime/${encodeURIComponent(slug)}`),
    getEpisodeBySlug: (slug) => fetchAPI(`/api/anime/episode/${encodeURIComponent(slug)}`),
    searchByFilter: async (filters = {}, order = 'default', page = 1) => {
        return fetchAPI(`/api/search/by-filter?order=${order}&page=${page}`, { method: 'POST', body: filters });
    }
};
