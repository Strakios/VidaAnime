const extractor = require('./src/services/extractorService');
const animeController = require('./src/services/scraperService');

async function test() {
    console.log("Fetching episode servers...");
    const servers = await animeController.scrapeServersFromEpisode('naruto-1');

    // Find a streamwish or fembed server
    for (let s of servers) {
        if (s.server.toLowerCase().includes('streamwish') || s.server.toLowerCase().includes('sw')) {
            console.log("Testing server:", s.server, s.code);
            const result = await extractor.extractStreamUrl(s.code);
            console.log("Result:", result);
            break;
        }
    }
}
test();
