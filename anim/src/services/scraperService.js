const axios = require('axios');
const cheerio = require('cheerio');

// Constants para bypass (Fase 1)
const ANIMEFLV_BASE = 'https://www3.animeflv.net';
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': 'https://www3.animeflv.net/'
};

// Variable global en memoria para guardar las cookies de Cloudflare (Fase 1)
let cfCookies = '';

// Fase 1: Bypass Cloudflare request proxy
async function fetchHTML(url) {
    try {
        const baseCookies = `device=computer; InstiSession=eyJpZCI6IjRlNGYwNWYxLTg4NDMtNGQwOS05ODlmLWM1OWQ5N2NmNjVlYyIsInJlZmVycmVyIjoiIiwiY2FtcGFpZ24iOnsic291cmNlIjpudWxsLCJtZWRpdW0iOm51bGwsImNhbXBhaWduIjpudWxsLCJ0ZXJtIjpudWxsLCJjb250ZW50IjpudWxsfX0=`;
        const activeCookies = cfCookies ? `${baseCookies}; ${cfCookies}` : baseCookies;

        const response = await axios.get(url, {
            headers: {
                ...DEFAULT_HEADERS,
                'Cookie': activeCookies
            },
            timeout: 10000,
            responseEncoding: 'utf8'
        });

        if (response.headers['set-cookie']) {
            cfCookies = response.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }

        return response.data;
    } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 503)) {
            console.warn('[scraper] Bloqueo detectado, limpiando cookies...');
            cfCookies = '';
        }
        throw error;
    }
}

// Fase 2: Obtener Servidores Directamente (ServersFactory.kt)
async function scrapeServersFromEpisode(episodeSlug) {
    const html = await fetchHTML(`${ANIMEFLV_BASE}/ver/${episodeSlug}`);
    const $ = cheerio.load(html);
    let servers = [];

    $('script').each((i, el) => {
        const scriptContent = $(el).html() || '';
        if (scriptContent.includes('var videos = {')) {
            const regex = /var videos = (\{.+?\});/is;
            const match = scriptContent.match(regex);
            if (match && match[1]) {
                try {
                    const json = JSON.parse(match[1]);
                    if (json.SUB) servers = servers.concat(json.SUB.map(s => ({ ...s, lang: 'SUB' })));
                    if (json.LAT) servers = servers.concat(json.LAT.map(s => ({ ...s, lang: 'LAT' })));
                } catch (e) { }
            }
        }
    });

    if (servers.length === 0) {
        $('table.RTbl.Dwnl tr').each((i, el) => {
            const btn = $(el).find('a.Button.Sm.fa-download');
            const href = btn.attr('href');
            if (href) {
                let link = href.substring(href.lastIndexOf("http"));
                link = decodeURIComponent(link);
                const nombre = $(el).find('td').eq(0).text().trim() || 'Desconocido';
                servers.push({ server: nombre, title: nombre, code: link, lang: 'DL' });
            }
        });
    }
    return servers;
}

// Función para extraer los últimos episodios de la Home
async function scrapeLatestEpisodes() {
    try {
        const html = await fetchHTML(ANIMEFLV_BASE);
        const $ = cheerio.load(html);
        const eps = [];
        $('.ListEpisodios li').each((i, el) => {
            const title = $(el).find('strong.Title').text().trim();
            const episode = $(el).find('span.Capi').text().trim();
            const img = $(el).find('img').attr('src') || '';
            const href = $(el).find('a').attr('href') || '';
            const slug = href.replace('/ver/', '');
            if (slug) {
                eps.push({
                    title,
                    number: parseInt(episode.replace('Episodio ', '')) || 0,
                    cover: img.startsWith('http') ? img : (img.startsWith('/') ? `${ANIMEFLV_BASE}${img}` : img),
                    slug,
                    animeSlug: slug.substring(0, slug.lastIndexOf('-'))
                });
            }
        });
        return eps;
    } catch (e) {
        console.error('[Scraper] Error en scrapeLatestEpisodes:', e.message);
        return [];
    }
}

// Función para extraer animes "En Emisión" de forma exhaustiva
async function scrapeOnAir(pages = 3) {
    try {
        const animes = [];
        const seen = new Set();

        for (let p = 1; p <= pages; p++) {
            const html = await fetchHTML(`${ANIMEFLV_BASE}/browse?status%5B%5D=1&order=updated&page=${p}`);
            const $ = cheerio.load(html);

            $('.ListAnimes li').each((i, el) => {
                const title = $(el).find('h3.Title').text().trim() || $(el).find('a').text().trim();
                const img = $(el).find('img').attr('src') || '';
                const href = $(el).find('a').attr('href') || '';
                const slug = href.replace('/anime/', '');
                const type = $(el).find('.Type').first().text().trim();

                if (slug && !seen.has(slug)) {
                    seen.add(slug);
                    animes.push({
                        title,
                        slug,
                        type,
                        cover: img.startsWith('http') ? img.replace('www3.animeflv.net', 'animeflv.net') : (img.startsWith('/') ? `https://animeflv.net${img}` : img)
                    });
                }
            });

            if ($('.ListAnimes li').length < 24) break;
        }

        return animes;
    } catch (e) {
        console.error('[Scraper] Error en scrapeOnAir:', e.message);
        return [];
    }
}

// Función para extraer el catálogo completo (Browse)
async function scrapeCatalog(page = 1, order = 'updated', filters = {}) {
    try {
        let url = `${ANIMEFLV_BASE}/browse?page=${page}&order=${order}`;
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        const animes = [];
        $('.ListAnimes li').each((i, el) => {
            const title = $(el).find('h3.Title').text().trim();
            const img = $(el).find('img').attr('src') || '';
            const href = $(el).find('a').attr('href') || '';
            const slug = href.replace('/anime/', '');
            const type = $(el).find('.Type').first().text().trim();
            const rating = $(el).find('.Vts').text().trim();
            if (slug) {
                animes.push({
                    title,
                    slug,
                    type,
                    rating,
                    cover: img.startsWith('http') ? img : (img.startsWith('/') ? `${ANIMEFLV_BASE}${img}` : img)
                });
            }
        });
        return animes;
    } catch (e) {
        console.error('[Scraper] Error en scrapeCatalog:', e.message);
        return [];
    }
}

// Función para extraer el detalle de un anime específico
async function scrapeAnimeDetail(slug) {
    try {
        const url = `${ANIMEFLV_BASE}/anime/${slug}`;
        const html = await fetchHTML(url);
        if (!html) return null;

        const $ = cheerio.load(html);

        const info = {
            title: $('.Ficha h1.Title').first().text().trim() || $('.Title').first().text().trim(),
            slug: slug,
            genres: [],
            synopsis: $('.Description p').text().trim() || $('.Description').text().trim(),
            rating: $('#votes_pnt').text().trim() || $('#votes_prmd').text().trim(),
            votes: $('#votes_nmbr').text().trim(),
            type: $('.Type').first().text().trim(),
            status: $('.AnmStts').text().trim(),
            cover: $('.AnimeCover img').attr('src') || $('meta[property="og:image"]').attr('content') || '',
            banner: $('.Bg').attr('style')?.match(/url\((.*?)\)/)?.[1] || '',
            nextEpisodeDate: null,
            episodes: []
        };

        if (info.cover && !info.cover.startsWith('http')) info.cover = `${ANIMEFLV_BASE}${info.cover}`;
        if (info.banner && !info.banner.startsWith('http')) info.banner = `${ANIMEFLV_BASE}${info.banner}`;

        // Normalizar dominio de imágenes para evitar 403 de www3
        if (info.cover) info.cover = info.cover.replace('www3.animeflv.net', 'animeflv.net');
        if (info.banner) {
            info.banner = info.banner.replace('www3.animeflv.net', 'animeflv.net');
            if (info.banner.includes("'")) info.banner = info.banner.replace(/'/g, "");
        }

        $('.Genres a').each((i, el) => {
            info.genres.push($(el).text().trim());
        });

        // Extraer fecha del próximo episodio (Fallback DOM)
        const nextEpDate = $('span.Date.fa-calendar').text().trim() || $('.fa-play-circle.Next .Date').text().trim();
        if (nextEpDate) info.nextEpisodeDate = nextEpDate;

        // Extraer lista de episodios y metadatos avanzados desde el JS de la página
        $('script').each((i, el) => {
            const content = $(el).html() || '';
            if (content.includes('var anime_info =')) {
                // Prioridad Absoluta: Extraer Fecha desde la variable cruda 'anime_info'
                const infoMatch = content.match(/var anime_info = (\[.+?\]);/is);
                if (infoMatch && infoMatch[1]) {
                    try {
                        const parsedInfo = JSON.parse(infoMatch[1]);
                        if (parsedInfo.length >= 4 && parsedInfo[3] && parsedInfo[3].trim() !== '') {
                            info.nextEpisodeDate = parsedInfo[3].trim();
                        }
                    } catch (e) { }
                }

                const episodesRegex = /var episodes = (\[.+?\]);/is;
                const match = content.match(episodesRegex);
                if (match && match[1]) {
                    try {
                        const epsData = JSON.parse(match[1]);
                        info.episodes = epsData.map(e => ({
                            number: e[0],
                            id: e[1],
                            slug: `${slug}-${e[0]}`
                        })).reverse();
                    } catch (e) { }
                }
            }
        });

        if (!info.title || info.title.toUpperCase().includes("SESION")) {
            // Re-intentar con selector de Ukiku si falla el de AnimeFLV estándar
            info.title = $('h1.Title').text().trim();
        }

        return info.title ? info : null;
    } catch (e) {
        console.error(`[Scraper] Error en scrapeAnimeDetail para ${slug}:`, e.message);
        return null;
    }
}

async function scrapeCoversMap(pages = 2) {
    const coversMap = {};
    try {
        for (let p = 1; p <= pages; p++) {
            const html = await fetchHTML(`${ANIMEFLV_BASE}/browse?order=updated&page=${p}`);
            const $ = cheerio.load(html);
            $('.ListAnimes li').each((i, el) => {
                const href = $(el).find('a').attr('href');
                const img = $(el).find('img').attr('src');
                if (href && img) {
                    const slug = href.replace('/anime/', '');
                    if (!coversMap[slug]) coversMap[slug] = img.startsWith('http') ? img : (img.startsWith('/') ? `${ANIMEFLV_BASE}${img}` : img);
                }
            });
        }
    } catch (e) { }
    return coversMap;
}

module.exports = {
    fetchHTML,
    scrapeServersFromEpisode,
    scrapeCoversMap,
    scrapeLatestEpisodes,
    scrapeOnAir,
    scrapeCatalog,
    scrapeAnimeDetail,
    DEFAULT_HEADERS
};
