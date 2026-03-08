
const fetch = require('node-fetch');

function unpackJS(packed) {
    try {
        // More flexible packer regex
        const match = packed.match(/}\s*\((['"].*?['"]),\s*(\d+),\s*(\d+),\s*(['"].*?['"])\.split/s);
        if (!match) {
            // Try another common variant
            const match2 = packed.match(/}\((['"].*?['"]),\s*(\d+),\s*(\d+),\s*(['"].*?['"])\.split/s);
            if (!match2) return null;
            return performUnpack(match2[1].slice(1, -1), parseInt(match2[2]), parseInt(match2[3]), match2[4].slice(1, -1).split('|'));
        }

        let p = match[1].slice(1, -1);
        let a = parseInt(match[2], 10);
        let c = parseInt(match[3], 10);
        let k = match[4].slice(1, -1).split('|');

        return performUnpack(p, a, c, k);
    } catch (e) {
        console.error('js unpack error', e);
        return null;
    }
}

function performUnpack(p, a, c, k) {
    const baseN = (value, base) => {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        do {
            result = chars[value % base] + result;
            value = Math.floor(value / base);
        } while (value > 0);
        return result || '0';
    };

    while (c--) {
        if (k[c]) {
            const regex = new RegExp('\\b' + baseN(c, a) + '\\b', 'g');
            p = p.replace(regex, k[c]);
        }
    }
    return p;
}

async function testExtraction(url) {
    console.log(`Testing extraction for: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.google.com/'
            }
        });

        if (!response.ok) {
            console.log(`Response not OK: ${response.status}`);
            return;
        }

        const html = await response.text();
        console.log(`HTML Length: ${html.length}`);

        // Check for packed JS
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,[dr]\).*?\)\)/gs);
        if (packedMatch) {
            console.log(`Found ${packedMatch.length} packed JS blocks`);
            packedMatch.forEach((packed, idx) => {
                const unpacked = unpackJS(packed);
                if (unpacked) {
                    console.log(`--- Unpacked Block ${idx} ---`);
                    // console.log(unpacked.substring(0, 500) + '...');

                    // Look for HLS links as in the Android code
                    const hlsRegex = /hls\d": ?["']([^"']*)["']/g;
                    let match;
                    while ((match = hlsRegex.exec(unpacked)) !== null) {
                        console.log(`Found HLS Option: ${match[1]}`);
                    }

                    // General master.m3u8 search
                    const m3u8Match = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/i);
                    if (m3u8Match) console.log(`Found Master M3U8: ${m3u8Match[1]}`);
                }
            });
        } else {
            console.log('No packed JS found');
        }

    } catch (err) {
        console.error('Test error:', err.message);
    }
}

const testUrl = process.argv[2] || 'https://streamwish.to/e/cx8unpyhtovu';
testExtraction(testUrl);
