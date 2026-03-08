const extractorService = require('../services/extractorService');
const { URL } = require('url');
const axios = require('axios');

async function resolveStream(req, res, next) {
    try {
        const { embed, download } = req.query;
        if (embed) {
            const result = await extractorService.extractStreamUrl(embed);
            if (result) {
                return res.json({ success: true, type: result.type, url: result.url });
            }
        }
        return res.json({ success: false, error: 'Could not resolve stream URL' });
    } catch (err) {
        next(err);
    }
}

// Proxying the stream to bypass CORS and inject specific headers
async function proxyStream(req, res, next) {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ success: false, error: 'url parameter required' });

        const parsedUrl = new URL(url);

        const forwardHeaders = {
            'User-Agent': "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
            'Referer': parsedUrl.origin + '/',
            'Origin': parsedUrl.origin
        };

        const isM3U8 = url.includes('.m3u8');

        if (isM3U8) {
            // Bajamos el texto del playlist para modificar las rutas a nuestro proxy
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'text',
                headers: forwardHeaders,
                validateStatus: () => true,
                timeout: 15000
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
            const lines = response.data.split('\n');
            const rewritten = lines.map(line => {
                const trimmed = line.trim();
                // Sub-Playlists o Fragmentos TS
                if (trimmed && !trimmed.startsWith('#')) {
                    const absUrl = trimmed.startsWith('http') ? trimmed : (trimmed.startsWith('/') ? parsedUrl.origin + trimmed : baseUrl + trimmed);
                    return `/api/stream/proxy?url=${encodeURIComponent(absUrl)}`;
                }
                // Archivos encriptados URI=
                if (trimmed.includes('URI=')) {
                    return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
                        const absUri = uri.startsWith('http') ? uri : (uri.startsWith('/') ? parsedUrl.origin + uri : baseUrl + uri);
                        return `URI="/api/stream/proxy?url=${encodeURIComponent(absUri)}"`;
                    });
                }
                return line;
            }).join('\n');

            return res.status(response.status).send(rewritten);
        } else {
            // Petición de fragmentos TS puros o Video MP4. Pipe directo con cabeceras correctas.
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: forwardHeaders,
                validateStatus: () => true,
                timeout: 15000
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            if (response.headers['content-type']) {
                res.setHeader('Content-Type', response.headers['content-type']);
            }
            res.status(response.status);
            response.data.pipe(res);
        }
    } catch (err) {
        console.error('\n--- Proxy Fatal Error ---');
        console.error('URL Request:', req.query.url);
        if (err.response) {
            console.error('Target API Status:', err.response.status);
            console.error('Target API Headers:', err.response.headers);
        } else {
            console.error('Message:', err.message);
        }
        res.status(500).json({ success: false, error: 'Proxy error' });
    }
}

module.exports = { resolveStream, proxyStream };
