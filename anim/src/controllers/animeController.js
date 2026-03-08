const api = require('../services/animeflvService');
const scraper = require('../services/scraperService');
const NodeCache = require('node-cache');

// Caché para detalles de anime (12 horas)
const animeCache = new NodeCache({ stdTTL: 43200 });

async function getToday(req, res, next) {
    try {
        const episodes = await scraper.scrapeLatestEpisodes();
        if (episodes && episodes.length > 0) {
            return res.json({ success: true, data: episodes });
        }
        const result = await api.getLatestEpisodes();
        res.json({ success: true, data: result.data || [] });
    } catch (err) { next(err); }
}

async function getWeekly(req, res, next) {
    try {
        const [onAir, coversMap] = await Promise.all([
            scraper.scrapeOnAir(1),
            scraper.scrapeCoversMap(1)
        ]);

        if (onAir && onAir.length > 0) {
            const enriched = onAir.map(a => ({
                ...a,
                cover: a.cover || coversMap[a.slug] || ''
            }));
            return res.json({ success: true, data: enriched });
        }

        const result = await api.getAnimesOnAir();
        res.json({ success: true, data: result.data || [] });
    } catch (err) { next(err); }
}

async function getCatalog(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const order = req.query.order || 'updated';
        const animes = await scraper.scrapeCatalog(page, order);

        if (animes && animes.length > 0) {
            return res.json({ success: true, data: { media: animes, foundPages: 500 } });
        }

        const result = await api.searchByFilter({}, order, page);
        res.json({ success: true, data: result.data });
    } catch (err) { next(err); }
}

async function search(req, res, next) {
    try {
        const result = await api.searchAnime(req.query.q || '', parseInt(req.query.page) || 1);
        res.json({ success: true, data: result.data });
    } catch (err) { next(err); }
}

async function getAnime(req, res, next) {
    try {
        const slug = req.params.slug;
        const cached = animeCache.get(`detail_${slug}`);
        if (cached) return res.json({ success: true, data: cached });

        const data = await scraper.scrapeAnimeDetail(slug);
        if (data && data.title) {
            animeCache.set(`detail_${slug}`, data);
            return res.json({ success: true, data: data });
        }

        const result = await api.getAnimeBySlug(slug);
        res.json({ success: true, data: result.data });
    } catch (err) { next(err); }
}

async function getEpisode(req, res, next) {
    try {
        const slug = req.params.slug;
        const servers = await scraper.scrapeServersFromEpisode(slug);
        if (servers && servers.length > 0) {
            return res.json({ success: true, data: { servers } });
        }

        const result = await api.getEpisodeBySlug(slug);
        let data = result.data;
        if (data.servers && Array.isArray(data.servers)) {
            data.servers = data.servers.map(server => {
                let decodedUrl = server.code || server.embed || '';
                if (decodedUrl && decodedUrl.includes('<iframe')) {
                    const srcMatch = decodedUrl.match(/src=["'](.*?)["']/);
                    if (srcMatch && srcMatch[1]) decodedUrl = srcMatch[1].replace(/&amp;/g, '&');
                }
                return {
                    ...server,
                    server: server.server || 'Unknown',
                    code: decodedUrl,
                    lang: (server.title || '').toUpperCase().includes('SUB') ? 'SUB' : 'LAT'
                };
            });
        }
        res.json({ success: true, data: data });
    } catch (err) { next(err); }
}

// ─── Nuevos Endpoints de Contenido (Basados en AnimeVidaa) ───

async function getSchedule(req, res, next) {
    try {
        const [onAir, coversMap] = await Promise.all([
            scraper.scrapeOnAir(2),
            scraper.scrapeCoversMap(2)
        ]);

        let animes = onAir && onAir.length > 0 ? onAir : [];
        if (animes.length === 0) {
            const result = await api.getAnimesOnAir();
            animes = result.data || result || [];
        }

        const schedule = {
            'Lunes': [], 'Martes': [], 'Miércoles': [], 'Jueves': [], 'Viernes': [], 'Sábado': [], 'Domingo': []
        };
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        // Enriquecer con fecha real de próximo episodio
        const batchSize = 10;
        for (let i = 0; i < animes.length; i += batchSize) {
            const batch = animes.slice(i, i + batchSize);
            await Promise.all(batch.map(async (anime) => {
                try {
                    let detail = animeCache.get(`detail_${anime.slug}`);
                    if (!detail) {
                        detail = await scraper.scrapeAnimeDetail(anime.slug);
                        if (detail) animeCache.set(`detail_${anime.slug}`, detail);
                    }
                    if (detail) {
                        anime.cover = detail.cover || anime.cover || coversMap[anime.slug] || '';
                        if (detail.nextEpisodeDate) {
                            const dateObj = new Date(detail.nextEpisodeDate + 'T12:00:00');
                            const dayIndex = dateObj.getDay();
                            anime.day = dayNames[dayIndex];
                        }
                    }
                } catch (e) { }
            }));
        }

        animes.forEach((anime, index) => {
            const day = anime.day || dayNames[(index % 7) + 1 === 7 ? 0 : (index % 7) + 1];
            if (schedule[day]) schedule[day].push(anime);
            else schedule['Lunes'].push(anime);
        });

        res.json({ success: true, data: schedule });
    } catch (err) { next(err); }
}

async function getEpisodeByNumber(req, res, next) {
    req.params.slug = `${req.params.animeSlug}-${req.params.number}`;
    return getEpisode(req, res, next);
}

async function getSeason(req, res, next) {
    try {
        const animes = await scraper.scrapeCatalog(1, 'updated');
        res.json({ success: true, data: { media: animes } });
    } catch (err) { next(err); }
}

async function getTop(req, res, next) {
    try {
        const animes = await scraper.scrapeCatalog(1, 'rating');
        res.json({ success: true, data: { media: animes } });
    } catch (err) { next(err); }
}

const clearCache = () => animeCache.flushAll();

module.exports = {
    getToday, getWeekly, getCatalog, search, getAnime, getEpisode,
    getSchedule, getEpisodeByNumber, getSeason, getTop, clearCache
};
