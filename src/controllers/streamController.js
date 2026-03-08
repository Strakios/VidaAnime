const MOTOR_URL = 'http://localhost:3000';

async function resolveStream(req, res) {
    try {
        const { embed } = req.query;
        const response = await fetch(`${MOTOR_URL}/api/stream/resolve?embed=${encodeURIComponent(embed)}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.json({ success: false, error: 'Motor de resolución no disponible' });
    }
}

async function proxyStream(req, res) {
    try {
        const { url } = req.query;
        const response = await fetch(`${MOTOR_URL}/api/stream/proxy?url=${encodeURIComponent(url)}`);

        // Forward headers
        res.setHeader('Content-Type', response.headers.get('content-type'));
        res.setHeader('Access-Control-Allow-Origin', '*');

        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ success: false, error: 'Proxy del motor no disponible' });
    }
}

module.exports = { resolveStream, proxyStream };
