const scraper = require('./src/services/scraperService');

async function test() {
    console.log('--- Testing scrapeAnimeDetail ---');
    try {
        const detail = await scraper.scrapeAnimeDetail('one-piece-tv');
        console.log('Detail Title:', detail?.title || 'EMPTY');
        const html = await scraper.fetchHTML('https://www3.animeflv.net/anime/one-piece-tv');
        const fs = require('fs');
        fs.writeFileSync('test_detail.html', html);
        console.log('HTML saved to test_detail.html');
    } catch (e) {
        console.error('Error in scrapeAnimeDetail:', e.message);
    }
}

test();
