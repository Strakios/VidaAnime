require('dotenv').config();
console.log('>>> [DEBUG] anim server.js is LOADING...');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./src/routes/api');

const os = require('os');
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_ID = Math.random().toString(36).substring(2, 10).toUpperCase();
global.SERVER_ID = SESSION_ID;

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

// Static files (Frontend HTML5)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/clear-cache', (req, res) => {
  apiRoutes.stack.find(s => s.route && s.route.path === '/api/clear-cache')?.handle(req, res, () => { });
  // Fallback if not found in stack (though it should be)
  const animeCtrl = require('./src/controllers/animeController');
  animeCtrl.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});
app.use('/', apiRoutes);

// SPA fallback - Redirigir a index.html para rutas no API
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
  console.log(`🎬 Anim Server [${SESSION_ID}] READY!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log('═'.repeat(50) + '\n');
});
