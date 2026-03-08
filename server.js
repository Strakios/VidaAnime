require('dotenv').config();

// Node 16 Polyfills for Modern Libraries (Puppeteer/Undici/Axios)
if (typeof ReadableStream === 'undefined') {
  const { ReadableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.TransformStream = TransformStream;
}
if (typeof Blob === 'undefined') {
  global.Blob = require('buffer').Blob;
}
if (typeof File === 'undefined') {
  global.File = class File extends global.Blob {
    constructor(parts, filename, options = {}) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}
if (typeof DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name;
    }
  };
}
if (typeof Headers === 'undefined') {
  // Si fetch no está habilitado, Headers no estará global
  try {
    const { Headers, Request, Response } = require('undici');
    global.Headers = Headers;
    global.Request = Request;
    global.Response = Response;
  } catch (e) { }
}

console.log('>>> [DEBUG] server.js is LOADING...');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./src/routes/api');
const { spawn } = require('child_process');

const os = require('os');
const app = express();

// AnimeVidaa correrá en el 3001, y levantará el Motor Anim en su puerto nativo 3000
const PORT = 3001;
const ENGINE_PORT = 3000;

// Auto-Launch Motor Anim
console.log('>>> [INFO] Arrancando Sub-Motor Anim en puerto 3000...');
const engineProcess = spawn('node', ['server.js'], {
  cwd: path.resolve(__dirname, './anim'),
  env: { ...process.env, PORT: ENGINE_PORT }
});

engineProcess.stdout.on('data', (data) => console.log(`[Motor Anim]: ${data}`));
engineProcess.stderr.on('data', (data) => console.error(`[Motor Anim ERROR]: ${data}`));
engineProcess.on('close', (code) => console.log(`[Motor Anim] terminado con error: ${code}`));
const SESSION_ID = Math.random().toString(36).substring(2, 10).toUpperCase();
global.SERVER_ID = SESSION_ID;
const LOCAL_IPS = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/', apiRoutes);

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api') && !req.path.startsWith('/playlist')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log(`🎬 VidaAnime Server [${SESSION_ID}] READY!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌐 Alternativas: ${LOCAL_IPS.map(ip => `http://${ip}:${PORT}`).join(', ')}`);
  console.log('═'.repeat(50) + '\n');
});
