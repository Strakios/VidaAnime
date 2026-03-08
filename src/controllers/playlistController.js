const MOTOR_URL = 'http://localhost:3000';

async function generatePlaylist(req, res, next) {
    try {
        const response = await fetch(`${MOTOR_URL}/api/weekly`);
        const json = await response.json();
        const animes = (json.data || []).reverse();

        let m3u = '#EXTM3U\n';
        m3u += '#PLAYLIST:AnimeVidaa - Anime en Emisión\n\n';

        for (const anime of animes.slice(0, 30)) {
            try {
                const detailRes = await fetch(`${MOTOR_URL}/api/anime/${anime.slug}`);
                const detail = await detailRes.json();
                const episodes = detail.data?.episodes || [];
                const cover = detail.data?.cover || '';
                const lastEps = episodes.slice(-3);

                for (const ep of lastEps) {
                    try {
                        const epRes = await fetch(`${MOTOR_URL}/api/episode/${ep.slug}`);
                        const epData = await epRes.json();
                        const servers = epData.data?.servers || [];
                        const embedServer = servers.find(s => s.embed || s.code) || {};
                        const embedUrl = embedServer.code || embedServer.embed || '';

                        if (embedUrl) {
                            m3u += `#EXTINF:-1 tvg-name="${anime.title} - Ep ${ep.number}" tvg-logo="${cover}" group-title="${anime.title}",${anime.title} - Episodio ${ep.number}\n`;
                            m3u += `${embedUrl}\n`;
                        }
                    } catch { /* skip episode */ }
                }
            } catch { /* skip anime */ }
        }

        res.setHeader('Content-Type', 'audio/mpegurl');
        res.setHeader('Content-Disposition', 'attachment; filename="animevidaa.m3u"');
        res.send(m3u);
    } catch (err) {
        next(err);
    }
}

module.exports = { generatePlaylist };
