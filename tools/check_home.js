const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res = await axios.get('https://www3.animeflv.net', {
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(res.data);
        console.log('--- ListAnimes (En Emisión) ---');
        $('.ListAnimes li').each((i, el) => {
            if (i < 5) {
                const title = $(el).find('a').text().trim();
                const href = $(el).find('a').attr('href');
                console.log(`Title: ${title}, Href: ${href}`);
            }
        });
        console.log('--- ListEpisodios (Últimos) ---');
        $('.ListEpisodios li').each((i, el) => {
            if (i < 3) {
                const title = $(el).find('strong.Title').text();
                const ep = $(el).find('span.Capi').text();
                const img = $(el).find('img').attr('src');
                console.log(`Title: ${title}, Ep: ${ep}, Img: ${img}`);
            }
        });
    } catch (e) {
        console.log(e.message);
    }
}

check();
