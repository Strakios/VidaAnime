# AnimeVidaa 🎬

Plataforma IPTV/Web App de Anime para Smart TV (VIDAA OS), con interfaz tipo Netflix y reproducción de episodios.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Modo desarrollo (auto-reload)
npm run dev
```

Abrir **http://localhost:3000** en el navegador.

## 🏗️ Arquitectura

```
AnimeVidaa/
├── server.js                  # Express entry point
├── .env                       # Configuración
├── src/
│   ├── services/
│   │   └── animeflvService.js # API AnimeFLV + Cache
│   ├── controllers/
│   │   ├── animeController.js # Endpoints de contenido
│   │   ├── playlistController.js # Generador M3U
│   │   └── userDataController.js # Favoritos/Historial
│   └── routes/
│       └── api.js             # Rutas Express
├── public/
│   ├── index.html             # SPA principal
│   ├── css/styles.css         # Tema dark anime
│   └── js/
│       ├── app.js             # Controlador principal
│       ├── navigation.js      # Navegación por teclado
│       └── player.js          # Reproductor de video
└── data/
    ├── favorites.json         # Favoritos (JSON)
    └── history.json           # Historial (JSON)
```

## 📡 API Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/today` | Últimos episodios |
| `GET /api/weekly` | Animes en emisión (con covers) |
| `GET /api/season` | Temporada actual |
| `GET /api/top?page=` | Top por rating |
| `GET /api/catalog?page=&order=` | Catálogo paginado |
| `GET /api/search?q=` | Búsqueda por texto |
| `GET /api/anime/:slug` | Detalle de anime |
| `GET /api/episode/:slug` | Servidores de episodio |
| `GET /api/episode/:slug/:num` | Episodio por número |
| `GET /playlist.m3u` | Lista IPTV |
| `GET/POST/DELETE /api/favorites` | Gestión de favoritos |
| `GET/POST /api/history` | Historial de reproducción |

## 🎮 Controles Smart TV

- **← → ↑ ↓** Navegar
- **Enter** Seleccionar
- **Escape/Backspace** Volver

## 📺 Características

- Interfaz tipo Netflix 1920×1080
- Navegación solo teclado (VIDAA OS)
- Reproductor con selector de servidores
- Continuar viendo (historial automático)
- Favoritos persistentes
- Catálogo con paginación y orden
- Buscador de anime
- Lista M3U para IPTV
- Caché de API (5 min)
- Rate limiting
- Lazy loading de imágenes

- Se creo un motor nombrado como "Anim", encargado de realizar todo el proceso de extraccion y procesamiento de datos diseñado para ser portado a otras plataformas con puertas de instalación disponible.

- Instalador Vidaa edge https://github.com/Strakios/VidaAnime/tree/main/edge
