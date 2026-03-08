const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res = await axios.get('https://www3.animeflv.net/browse?order=updated', {
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(res.data);
        console.log('--- Browse Grid ---');
        $('.ListAnimes li').each((i, el) => {
            if (i < 5) {
                const title = $(el).find('h3.Title').text();
                const img = $(el).find('img').attr('src');
                const slug = $(el).find('a').attr('href').replace('/anime/', '');
                console.log(`Title: ${title}, Slug: ${slug}, Img: ${img}`);
            }
        });
    } catch (e) {
        console.log(e.message);
    }
}

check();
