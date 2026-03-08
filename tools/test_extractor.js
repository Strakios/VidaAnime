require('dotenv').config();
// No requirement for node-fetch on Node v22+ as fetch is global
const EMBED_TO_TEST = 'https://streamwish.to/e/cx8unpyhtovu';
const EXTERNAL_URL = process.env.EXTERNAL_EXTRACTOR_URL;

console.log('═══ Extractor Connectivity Test ═══');
console.log(`- Configured URL: ${EXTERNAL_URL || 'MISSING'}`);

if (!EXTERNAL_URL) {
    console.error('ERROR: EXTERNAL_EXTRACTOR_URL is not defined in .env');
    process.exit(1);
}

async function runTest() {
    const target = EXTERNAL_URL + encodeURIComponent(EMBED_TO_TEST);
    console.log(`- Testing Target: ${target}`);

    try {
        console.log('- Sending request...');
        const res = await fetch(target, { timeout: 15000 });

        console.log(`- Status: ${res.status} ${res.statusText}`);

        if (!res.ok) {
            const text = await res.text();
            console.error(`- Response Error: ${text}`);
            return;
        }

        const data = await res.json();
        console.log('- Response Data:', JSON.stringify(data, null, 2));

        if (data.success && data.stream) {
            console.log('\n✅ SUCCESS: Connection works.');
            console.log(`- Extracted Stream: ${data.stream}`);
            const baseUrl = EXTERNAL_URL.split('/extract')[0];
            const proxied = `${baseUrl}/stream?url=${encodeURIComponent(data.stream)}`;
            console.log(`- Predicted Final URL: ${proxied}`);
        } else {
            console.log('\n❌ FAILED: Python returned error or no stream.');
        }

    } catch (e) {
        console.error('\n❌ NETWORK ERROR: Could not reach Python server.');
        console.error(`- Message: ${e.message}`);
        console.error('- Make sure your Python script is running on port 5000.');
    }
}

runTest();
