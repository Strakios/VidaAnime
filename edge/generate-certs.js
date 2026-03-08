/* ══════════════════════════════════════════════════════
   SSL Certificate Generator for VIDAA Edge
   Generates self-signed certs for vidaahub.com
   ══════════════════════════════════════════════════════ */

const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

function generateCerts() {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        console.log('✅ SSL certificates already exist');
        return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
    }

    console.log('🔐 Generating self-signed SSL certificates for vidaahub.com...');

    const attrs = [
        { name: 'commonName', value: 'vidaahub.com' },
        { name: 'organizationName', value: 'VidaAnime' },
        { name: 'countryName', value: 'MX' }
    ];

    const pems = selfsigned.generate(attrs, {
        keySize: 2048,
        days: 365,
        algorithm: 'sha256',
        extensions: [
            {
                name: 'subjectAltName', altNames: [
                    { type: 2, value: 'vidaahub.com' },
                    { type: 2, value: '*.vidaahub.com' }
                ]
            }
        ]
    });

    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);

    console.log('✅ Certificates generated and saved to certs/');
    return { key: pems.private, cert: pems.cert };
}

module.exports = { generateCerts };

// Run directly
if (require.main === module) {
    generateCerts();
}
