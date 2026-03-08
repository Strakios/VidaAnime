/* ══════════════════════════════════════════════════════
   VidaAnime Edge — VIDAA TV PWA Installer Server
   HTTPS server on port 443 (required by VIDAA browser)
   Must spoof vidaahub.com DNS → your local IP
   ══════════════════════════════════════════════════════ */

const https = require('https');
const express = require('express');
const path = require('path');
const proxy = require('express-http-proxy');
const { generateCerts } = require('./generate-certs');

const app = express();
app.use(express.json());

// === API PROXY ===
// Redirige peticiones /api al api-server.js en el puerto 3005
app.use('/api', proxy('http://localhost:3005', {
    proxyReqPathResolver: (req) => {
        return '/api' + req.url;
    }
}));

// Static files (para cuando se haga el build)
const buildPath = path.join(__dirname, 'dist', 'vidaa-edge', 'browser');
if (require('fs').existsSync(buildPath)) {
    app.use(express.static(buildPath));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

// CORS for dev
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// SPA fallback
app.use((req, res) => {
    const buildPath = path.join(__dirname, 'dist', 'vidaa-edge', 'browser');
    const indexPath = path.join(buildPath, 'index.html');
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');

    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else if (require('fs').existsSync(publicIndexPath)) {
        res.sendFile(publicIndexPath);
    } else {
        res.status(200).send(`
            <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #121212; color: white;">
                    <img src="/logo.png" style="width: 150px; margin-bottom: 20px;">
                    <h1>VidaAnime Edge Installer</h1>
                    <p style="color: #aaa;">El servidor está listo, pero no se encontró la interfaz (index.html).</p>
                    <p>Por favor, ejecuta <code>npm run build</code> en la carpeta <code>edge</code> para generar la interfaz.</p>
                </body>
            </html>
        `);
    }
});

// Generate SSL certs (auto-creates on first run)
const ssl = generateCerts();

// Start HTTPS on port 443
const PORT = 443;
const server = https.createServer(ssl, app);

server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'unknown';
    for (const iface of Object.values(interfaces)) {
        for (const info of iface) {
            if (info.family === 'IPv4' && !info.internal) {
                localIp = info.address;
                break;
            }
        }
        if (localIp !== 'unknown') break;
    }

    console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║       🎬 VidaAnime Edge — VIDAA TV Installer       ║
  ╠══════════════════════════════════════════════════════╣
  ║                                                      ║
  ║   HTTPS Server: https://localhost:${PORT}               ║
  ║   Local IP:     ${localIp.padEnd(38)}║
  ║                                                      ║
  ║   📋 Pasos:                                          ║
  ║   1. Apunta vidaahub.com → ${localIp.padEnd(22)}   ║
  ║      (en tu router/DNS/Pi-hole/AdGuard)              ║
  ║   2. Abre https://vidaahub.com en el TV              ║
  ║   3. Instala la app desde la interfaz                ║
  ║   4. Reinicia el TV                                  ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
    if (err.code === 'EACCES') {
        console.error(`\n  ❌ Error: Puerto ${PORT} requiere permisos de administrador.`);
        console.error(`  ➡️  Ejecuta: (admin) node server.js\n`);
    } else if (err.code === 'EADDRINUSE') {
        console.error(`\n  ❌ Error: Puerto ${PORT} ya está siendo usado por otro proceso.`);
        console.error(`  ➡️  Cierra cualquier aplicación que use el puerto 443 (p.ej. Skype, IIS, Apache).\n`);
    } else {
        console.error('Server error:', err);
    }
});
