const axios = require('axios');
const cheerio = require('cheerio');
const JsUnpacker = require('./unpacker');
const puppeteer = require('puppeteer-core');

// Usaremos un User-Agent móvil sólido que esquiva bloqueos frecuentes.
const MOBILE_UA = "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36";

// Función usando el Chromium integrado en Windows para sortear el JS
async function bypassWithPuppeteer(url) {
    let browser = null;
    try {
        console.log('[Puppeteer Bypass] Arrancando WebView Headless para saltar protecciones...');
        browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(MOBILE_UA);

        let nativeStream = null;

        // Escuchar las peticiones de red para cazar directamente el archivo M3U8 o MP4 final
        page.on('request', req => {
            const reqUrl = req.url();
            if (reqUrl.includes('.m3u8') && !reqUrl.includes('master.txt') && !nativeStream) {
                nativeStream = { type: 'hls', url: reqUrl };
            } else if (reqUrl.includes('.mp4') && !reqUrl.includes('streamtape_do_not_delete.mp4') && !nativeStream) {
                nativeStream = { type: 'mp4', url: reqUrl };
            }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Esperar máximo 8 segundos, simulando el delay del JS Anti-Bot de Cloudflare o Streamwish
        for (let i = 0; i < 80; i++) {
            if (nativeStream) break;
            await new Promise(r => setTimeout(r, 100)); // Checa cada 100ms
        }

        if (nativeStream) {
            console.log(`[Puppeteer Bypass] ¡Éxito! Stream nativo interceptado: ${nativeStream.url}`);
            return nativeStream;
        }

        // Fallback: Si no lo cazó en red, extraemos el HTML luego de 8 segs y aplicamos regex regular
        const html = await page.content();
        const match = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
            html.match(/hls\d*["']?\s*:\s*["']([^"']+)["']/i) ||
            html.match(/sources:\s*\[\s*{\s*file:\s*["']([^"']+)["']/i) ||
            html.match(/(https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) ||
            html.match(/(https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i) ||
            html.match(/src:\s*["']([^"']+\.m3u8[^"']*)["']/i);

        if (match && match[1]) {
            let mediaUrl = match[1];
            if (!mediaUrl.startsWith('http')) {
                const urlObj = new URL(url);
                mediaUrl = `${urlObj.protocol}//${urlObj.host}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
            }
            console.log(`[Puppeteer Bypass] Extraído desde DOM post-Carga: ${mediaUrl}`);
            return { type: mediaUrl.includes('.mp4') ? 'mp4' : 'hls', url: mediaUrl };
        }

    } catch (e) {
        console.error('[Puppeteer Bypass] Error:', e.message);
    } finally {
        if (browser) await browser.close();
    }
    return null;
}

// Extracción directa de M3U8/MP4 desde los servidores web.
async function extractStreamWish(url) {
    try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        const res = await axios.get(url, {
            headers: {
                // Removemos User-Agent, fijamos Origin y Referer
                'Origin': baseUrl,
                'Referer': baseUrl,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });
        const html = res.data;

        // Búsqueda directa (variantes ampliadas para capturar Streamwise)
        const match = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
            html.match(/hls\d*["']?\s*:\s*["']([^"']+)["']/i) ||
            html.match(/sources:\s*\[\s*{\s*file:\s*["']([^"']+)["']/i) ||
            html.match(/(https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) ||
            html.match(/(https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i) ||
            html.match(/src:\s*["']([^"']+\.m3u8[^"']*)["']/i); // Nueva variante detectada a veces

        if (match && match[1]) {
            let mediaUrl = match[1];
            if (!mediaUrl.startsWith('http')) {
                const urlObj = new URL(url);
                mediaUrl = `${urlObj.protocol}//${urlObj.host}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
            }
            return { type: mediaUrl.includes('.mp4') ? 'mp4' : 'hls', url: mediaUrl };
        }

        // JS Unpacker fallback: Desempaquetar código ofuscado (P.A.C.K.E.R) nativamente
        if (JsUnpacker.detect(html)) {
            console.log('[StreamWish] Código empaquetado detectado, procediendo a desempaquetar...');
            const unpackedHtml = JsUnpacker.unpack(html);

            // Re-evaluar el código desempaquetado
            const unpackedMatch = unpackedHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                unpackedHtml.match(/sources:\s*\[\s*{\s*file:\s*["']([^"']+)["']/i) ||
                unpackedHtml.match(/(https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) ||
                unpackedHtml.match(/src:\s*["']([^"']+\.m3u8[^"']*)["']/i);

            if (unpackedMatch && unpackedMatch[1]) {
                let mediaUrl = unpackedMatch[1];
                if (!mediaUrl.startsWith('http')) {
                    const urlObj = new URL(url);
                    mediaUrl = `${urlObj.protocol}//${urlObj.host}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
                }
                console.log(`[StreamWish] Extraído tras Desempaquetado: ${mediaUrl}`);
                return { type: mediaUrl.includes('.mp4') ? 'mp4' : 'hls', url: mediaUrl };
            }
        }

        if (html.includes('Page is loading') || html.includes('script') || html.includes('captcha')) {
            console.log('[StreamWish Warning] Servidor bloqueado por Anti-Bot activo o Cloudflare. Delegando bypass a Edge Headless...');
            return await bypassWithPuppeteer(url) || { type: 'iframe', url: url };
        }
    } catch (e) {
        console.error('Error in StreamWish extractor:', e.message);
    }
    return null;
}

async function extractFembed(url) {
    try {
        let fLink = url;
        // Convertir si trae 'value='
        if (url.includes('value=')) {
            const extractValue = url.substring(url.lastIndexOf('=') + 1);
            fLink = `https://embedsito.com/v/${extractValue}`;
        }

        const apiUrl = fLink.replace('/v/', '/api/source/');
        const res = await axios.post(apiUrl, {}, {
            headers: {
                'User-Agent': MOBILE_UA,
                'Referer': fLink
            }
        });

        if (res.data && res.data.success && res.data.data && res.data.data.length > 0) {
            const streams = res.data.data;
            const best = streams[streams.length - 1]; // Highest quality
            return { type: 'mp4', url: best.file };
        }
    } catch (e) {
        console.error('Error in Fembed extractor:', e.message);
    }
    // Fallback: Delegar a Edge Headless si Fembed/Embedsito arroja Captcha
    return await bypassWithPuppeteer(url) || { type: 'iframe', url: url };
}

// Extracción desde Okru
async function extractOkru(url) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': MOBILE_UA,
                'Referer': url
            }
        });
        const match = res.data.match(/data-options="([^"]+)"/i);
        if (match && match[1]) {
            const unescaped = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const dataOpts = JSON.parse(unescaped);

            if (dataOpts.flashvars && dataOpts.flashvars.metadata) {
                const metadata = JSON.parse(dataOpts.flashvars.metadata);
                if (metadata.videos && metadata.videos.length > 0) {
                    // Ordenamos asumiendo que el último es el de mayor calidad o pillamos el full.
                    const best = metadata.videos.find(v => ['full', 'hd', 'sd'].includes(v.name)) || metadata.videos[metadata.videos.length - 1];
                    return { type: 'mp4', url: best.url };
                }
            }
        }
    } catch (e) {
        console.error('Error in Okru extractor:', e.message);
    }
    return { type: 'iframe', url: url };
}

// Extractor Genérico
async function extractStreamUrl(embedUrl) {
    if (!embedUrl) return null;

    // Direct matches
    if (embedUrl.includes('.m3u8')) return { type: 'hls', url: embedUrl };
    if (embedUrl.includes('.mp4')) return { type: 'mp4', url: embedUrl };

    // Mega passthrough (Mega handles its own iframe stream in browser usually, or we pass the link back to open in tab)
    if (embedUrl.includes('mega.nz')) return { type: 'mega', url: embedUrl };

    console.log(`[Extractor] Resolving: ${embedUrl}`);

    if (embedUrl.includes('streamwish') || embedUrl.includes('sw')) {
        return await extractStreamWish(embedUrl);
    } else if (embedUrl.includes('fembed') || embedUrl.includes('fblh') || embedUrl.includes('embedsito')) {
        return await extractFembed(embedUrl);
    } else if (embedUrl.includes('ok.ru') || embedUrl.includes('okru')) {
        return await extractOkru(embedUrl);
    }

    // Default: Return iframe fallback si no sabemos extraerlo nativamente pero queremos q el browser trabaje
    return { type: 'iframe', url: embedUrl };
}

module.exports = {
    extractStreamUrl
};
