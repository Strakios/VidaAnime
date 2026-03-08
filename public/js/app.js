/* ══════════════════════════════════════════════════════
   VidaAnime — Main Application Controller
   SPA routing, data fetching, rendering, lazy loading
   ══════════════════════════════════════════════════════ */

const App = (() => {
    // ─── State ───
    // ─── State ───
    const API_BASE = `http://${window.location.hostname}:3000`; // Motor Anim Centralizado (Puerto 3000)
    let screenHistory = ['home'];
    let currentScreen = 'home';
    let catalogPage = 1;
    let catalogOrder = 'default';
    let catalogTotalPages = 1;
    let searchTimeout = null;
    let detailCache = {};
    let currentDetailSlug = '';
    let currentDetailData = null;
    let episodeSortAsc = true;
    let episodesPerPage = 50;
    let episodePage = 1;

    // ─── Init ───
    async function init() {
        console.log(">>> [App] Initializing...");
        // VidaAnime — Smart TV Keyboard Navigation Engine
        Navigation.init();
        Player.init();
        setupEvents();
        setupLazyLoad();

        try {
            console.log(">>> [App] Loading Home data...");
            await loadHome();
            console.log(">>> [App] Home loaded successfully.");
        } catch (e) {
            console.error(">>> [App] Error loading Home content:", e);
        } finally {
            hideLoading();
            Navigation.focusFirst();
        }
    }

    // El sistema de Pairing de Ukiku ha sido ELIMINADO. Ahora el motor Anim gestiona todo de forma directa.
    async function checkPairing() { return true; }

    function hideLoading() {
        setTimeout(() => {
            const loading = document.getElementById('loading-screen');
            if (loading) loading.classList.add('hidden');
        }, 800);
    }

    // ─── Event Setup ───
    function setupEvents() {
        // Nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                navigateTo(section);
            });
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => doSearch(searchInput.value), 400);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doSearch(searchInput.value);
            }
        });

        // Catalog order
        document.querySelectorAll('.catalog-order').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.catalog-order').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                catalogOrder = btn.dataset.order;
                catalogPage = 1;
                loadCatalog();
            });
        });

        // Episode sorting
        document.getElementById('ep-sort-asc').addEventListener('click', () => {
            episodeSortAsc = true;
            document.getElementById('ep-sort-asc').classList.add('active');
            document.getElementById('ep-sort-desc').classList.remove('active');
            episodePage = 1;
            renderEpisodes();
        });
        document.getElementById('ep-sort-desc').addEventListener('click', () => {
            episodeSortAsc = false;
            document.getElementById('ep-sort-desc').classList.add('active');
            document.getElementById('ep-sort-asc').classList.remove('active');
            episodePage = 1;
            renderEpisodes();
        });

        // Hero buttons
        document.getElementById('hero-watch-btn').addEventListener('click', heroWatch);
        document.getElementById('hero-detail-btn').addEventListener('click', heroDetail);
    }

    // ─── Navigation ───
    function navigateTo(screen, addToHistory = true) {
        if (screen === currentScreen && screen !== 'detail' && screen !== 'player') return;

        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screenEl = document.getElementById(`screen-${screen}`);
        if (screenEl) {
            screenEl.classList.add('active');
            screenEl.scrollTop = 0;
        }

        // Update navbar
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const navLink = document.querySelector(`.nav-link[data-section="${screen}"]`);
        if (navLink) navLink.classList.add('active');

        // Show/hide navbar on player
        document.getElementById('navbar').style.display = screen === 'player' ? 'none' : '';

        if (addToHistory && screen !== currentScreen) {
            screenHistory.push(screen);
            if (screen === 'player') {
                history.pushState({ screen: 'player' }, '', '#player');
            }
        }
        currentScreen = screen;

        // Load content
        switch (screen) {
            case 'home': /* already loaded */ break;
            case 'catalog': loadCatalog(); break;
            case 'search': break;
            case 'favorites': loadFavorites(); break;
            case 'schedule': loadSchedule(); break;
        }

        setTimeout(() => {
            Navigation.updateFocusables();
            if (screen !== 'player') Navigation.focusFirst();
        }, 200);
    }

    function goBack(fromPopState = false) {
        if (currentScreen === 'player') {
            Player.destroy();
            // Ensure any video elements are absolutely stopped
            const video = document.getElementById('player-video');
            if (video) {
                video.pause();
                video.src = "";
                video.removeAttribute('src');
                video.load();
                video.style.display = 'none';
            }

            if (!fromPopState && window.location.hash === '#player') {
                history.back();
            }
        }

        if (screenHistory.length > 1) {
            screenHistory.pop();
            const prev = screenHistory[screenHistory.length - 1];
            navigateTo(prev, false);
        } else {
            navigateTo('home', false);
        }
    }

    // ─── Data Fetching ───
    async function fetchJSON(url, options = {}) {
        try {
            // Redirigir peticiones de API al motor independiente (Puerto 3000)
            const targetUrl = url.startsWith('/api') ? `${API_BASE}${url}` : url;

            const headers = options.headers || {};
            const uid = localStorage.getItem('ukiku_uid');
            if (uid) headers['x-user-uid'] = uid;

            const res = await fetch(targetUrl, { ...options, headers });
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const data = await res.json();
            if (data.success) return data.data !== undefined ? data.data : data;
            return null;
        } catch (err) {
            console.error('Fetch error:', url, err);
            return null;
        }
    }

    // ─── Home Screen ───
    let heroAnimeSlug = '';
    let heroEpisodeSlug = '';

    async function loadHome() {
        const [latest, history] = await Promise.all([
            fetchJSON('/api/today'),
            fetchJSON('/api/history')
        ]);

        // Hero Banner (first latest episode)
        if (latest && latest.length > 0) {
            const hero = latest[0];
            // Extract anime slug from episode slug (remove the last -N)
            const animeSlug = hero.slug.replace(/-\d+$/, '');
            heroAnimeSlug = animeSlug;
            heroEpisodeSlug = hero.slug;

            const heroBanner = document.getElementById('hero-banner');
            heroBanner.style.backgroundImage = `url(${hero.cover})`;
            document.getElementById('hero-title').textContent = hero.title;
            document.getElementById('hero-synopsis').textContent = `Episodio ${hero.number} disponible ahora`;
        }

        // Continue Watching
        if (history && history.length > 0) {
            const continueRow = document.getElementById('row-continue');
            continueRow.style.display = '';
            renderContinueWatching(history.slice(0, 15));
        }

        // Latest Episodes
        if (latest) renderEpisodeRow('latest-scroll', latest);

        // On Air (weekly)
        loadWeekly();

        // Top
        loadTop();
    }

    async function loadWeekly() {
        const data = await fetchJSON('/api/weekly');
        if (data) renderAnimeRow('weekly-scroll', data);
    }

    async function loadTop() {
        const data = await fetchJSON('/api/top');
        if (data && data.media) renderAnimeRow('top-scroll', data.media);
    }

    function heroWatch() {
        if (heroEpisodeSlug) {
            openPlayerFromSlug(heroEpisodeSlug, heroAnimeSlug);
        }
    }

    function heroDetail() {
        if (heroAnimeSlug) {
            openDetail(heroAnimeSlug);
        }
    }

    // ─── Rendering ───
    function createAnimeCard(anime, extraBadge = '') {
        const card = document.createElement('div');
        card.className = 'anime-card focusable';
        card.tabIndex = 0;

        const coverUrl = anime.cover || '';
        card.innerHTML = `
      <div class="card-img-wrapper">
        <img class="card-img" data-src="${coverUrl}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='260'%3E%3Crect fill='%2316162a' width='185' height='260'/%3E%3C/svg%3E" alt="${anime.title || ''}" loading="lazy">
        ${extraBadge ? `<span class="card-ep-badge">${extraBadge}</span>` : ''}
      </div>
      <div class="card-info">
        <div class="card-title">${anime.title || ''}</div>
        <div class="card-meta">
          ${anime.rating ? `<span class="card-rating">⭐ ${anime.rating}</span>` : ''}
          ${anime.type ? `<span>${anime.type}</span>` : ''}
        </div>
      </div>
    `;

        card.addEventListener('click', () => openDetail(anime.slug));
        observeImage(card.querySelector('.card-img'));
        return card;
    }

    function createEpisodeCard(ep) {
        const card = document.createElement('div');
        card.className = 'anime-card focusable';
        card.tabIndex = 0;

        const coverUrl = ep.cover || '';
        card.innerHTML = `
      <div class="card-img-wrapper">
        <img class="card-img" data-src="${coverUrl}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='260'%3E%3Crect fill='%2316162a' width='185' height='260'/%3E%3C/svg%3E" alt="${ep.title}" loading="lazy">
        <span class="card-ep-badge">Ep ${ep.number}</span>
      </div>
      <div class="card-info">
        <div class="card-title">${ep.title}</div>
      </div>
    `;

        const animeSlug = ep.slug.replace(/-\d+$/, '');
        card.addEventListener('click', () => openDetail(animeSlug));
        observeImage(card.querySelector('.card-img'));
        return card;
    }

    function renderAnimeRow(containerId, animes) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        animes.forEach(anime => {
            container.appendChild(createAnimeCard(anime));
        });
        Navigation.updateFocusables();
    }

    function renderEpisodeRow(containerId, episodes) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        episodes.forEach(ep => {
            container.appendChild(createEpisodeCard(ep));
        });
        Navigation.updateFocusables();
    }

    function renderContinueWatching(history) {
        const container = document.getElementById('continue-scroll');
        container.innerHTML = '';

        const unique = [];
        const seen = new Set();
        history.forEach(h => {
            if (!seen.has(h.animeSlug)) {
                seen.add(h.animeSlug);
                unique.push(h);
            }
        });

        unique.forEach(h => {
            const card = document.createElement('div');
            card.className = 'anime-card focusable';
            card.tabIndex = 0;
            card.innerHTML = `
        <div class="card-img-wrapper">
          <img class="card-img" data-src="${h.animeCover || ''}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='185' height='260'%3E%3Crect fill='%2316162a' width='185' height='260'/%3E%3C/svg%3E" alt="${h.animeTitle}" loading="lazy">
          <span class="card-ep-badge">Ep ${h.episodeNumber}</span>
        </div>
        <div class="card-info">
          <div class="card-title">${h.animeTitle}</div>
          <div class="card-meta"><span>Continuar Ep ${h.episodeNumber}</span></div>
        </div>
      `;
            card.addEventListener('click', () => openPlayerFromSlug(h.episodeSlug, h.animeSlug));
            observeImage(card.querySelector('.card-img'));
            container.appendChild(card);
        });
        Navigation.updateFocusables();
    }

    // ─── Detail Screen ───
    async function openDetail(slug) {
        currentDetailSlug = slug;
        navigateTo('detail');

        const data = await fetchJSON(`/api/anime/${slug}`);
        if (!data) {
            showToast('No se pudo cargar el anime');
            goBack();
            return;
        }
        currentDetailData = data;

        // Fill detail UI
        document.getElementById('detail-cover').src = data.cover || '';
        document.getElementById('detail-backdrop').style.backgroundImage = `url(${data.cover || ''})`;
        document.getElementById('detail-title').textContent = data.title || '';
        document.getElementById('detail-rating').textContent = `⭐ ${data.rating || 'N/A'}`;
        document.getElementById('detail-type').textContent = data.type || '';
        document.getElementById('detail-status').textContent = data.status || '';
        document.getElementById('detail-synopsis').textContent = data.synopsis || '';

        // Genres
        const genresEl = document.getElementById('detail-genres');
        genresEl.innerHTML = (data.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('');

        // Favorite button
        setupFavoriteButton(slug, data);

        // Episodes
        episodePage = 1;
        episodeSortAsc = true;
        document.getElementById('ep-sort-asc').classList.add('active');
        document.getElementById('ep-sort-desc').classList.remove('active');
        renderEpisodes();

        // Related
        if (data.related && data.related.length > 0) {
            const section = document.getElementById('related-section');
            section.style.display = '';
            const container = document.getElementById('related-scroll');
            container.innerHTML = '';
            data.related.forEach(r => {
                const card = createAnimeCard({ slug: r.slug, title: r.title, cover: '' });
                container.appendChild(card);
            });
        } else {
            document.getElementById('related-section').style.display = 'none';
        }

        setTimeout(() => {
            Navigation.updateFocusables();
            Navigation.focusFirst();
        }, 300);
    }

    function renderEpisodes() {
        if (!currentDetailData || !currentDetailData.episodes) return;

        let episodes = [...currentDetailData.episodes];
        if (!episodeSortAsc) episodes.reverse();

        const total = episodes.length;
        const totalPages = Math.ceil(total / episodesPerPage);
        const start = (episodePage - 1) * episodesPerPage;
        const pageEps = episodes.slice(start, start + episodesPerPage);

        const grid = document.getElementById('episodes-grid');
        grid.innerHTML = '';

        pageEps.forEach((ep, i) => {
            const btn = document.createElement('button');
            btn.className = 'episode-card focusable';
            btn.tabIndex = 0;
            btn.textContent = `Ep ${ep.number}`;
            btn.addEventListener('click', () => {
                // VidaAnime — Iframe-Based Player with Virtual Cursor
                // Find the real index in the original array
                const realIndex = currentDetailData.episodes.findIndex(e => e.number === ep.number);
                openPlayer(currentDetailSlug, currentDetailData.episodes, realIndex);
            });
            grid.appendChild(btn);
        });

        // Pagination
        const pagEl = document.getElementById('episodes-pagination');
        pagEl.innerHTML = '';
        if (totalPages > 1) {
            for (let p = 1; p <= totalPages; p++) {
                const btn = document.createElement('button');
                btn.className = `page-btn focusable ${p === episodePage ? 'active' : ''}`;
                btn.textContent = p;
                btn.addEventListener('click', () => {
                    episodePage = p;
                    renderEpisodes();
                });
                pagEl.appendChild(btn);
            }
        }

        Navigation.updateFocusables();
    }

    async function setupFavoriteButton(slug, data) {
        const btn = document.getElementById('detail-fav-btn');
        const favs = await fetchJSON('/api/favorites');
        const isFav = favs && favs.some(f => f.slug === slug);
        btn.textContent = isFav ? '💔 Quitar Favorito' : '❤️ Agregar a Favoritos';

        btn.onclick = async () => {
            if (isFav) {
                await fetch(`${API_BASE}/api/favorites/${slug}`, { method: 'DELETE' });
                showToast('Eliminado de favoritos');
            } else {
                await fetch(`${API_BASE}/api/favorites`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, title: data.title, cover: data.cover, type: data.type })
                });
                showToast('Agregado a favoritos ❤️');
            }
            setupFavoriteButton(slug, data);
        };
    }

    // ─── Player ───
    function openPlayer(animeSlug, episodes, episodeIndex) {
        navigateTo('player');
        Player.loadEpisode(
            animeSlug,
            episodes,
            episodeIndex,
            currentDetailData?.title || '',
            currentDetailData?.cover || ''
        );
    }

    async function openPlayerFromSlug(episodeSlug, animeSlug) {
        // First get anime details for episodes list
        const data = await fetchJSON(`/api/anime/${animeSlug}`);
        if (!data) {
            showToast('No se pudo cargar el anime');
            return;
        }
        currentDetailSlug = animeSlug;
        currentDetailData = data;
        const episodes = data.episodes || [];
        // Find episode number from slug
        const match = episodeSlug.match(/-(\d+)$/);
        const epNum = match ? parseInt(match[1]) : 1;
        const index = episodes.findIndex(e => e.number === epNum);
        openPlayer(animeSlug, episodes, index >= 0 ? index : 0);
    }

    // ─── Catalog ───
    async function loadCatalog() {
        const grid = document.getElementById('catalog-grid');
        grid.innerHTML = '<div style="color:#555;padding:40px;text-align:center">Cargando catálogo...</div>';

        const data = await fetchJSON(`/api/catalog?page=${catalogPage}&order=${catalogOrder}`);
        if (!data || !data.media) {
            grid.innerHTML = '<div style="color:#555;padding:40px;text-align:center">Error cargando catálogo</div>';
            return;
        }

        catalogTotalPages = data.foundPages || 1;
        grid.innerHTML = '';
        data.media.forEach(anime => {
            grid.appendChild(createAnimeCard(anime));
        });

        renderCatalogPagination();
        Navigation.updateFocusables();
    }

    function renderCatalogPagination() {
        const container = document.getElementById('catalog-pagination');
        container.innerHTML = '';

        const maxVisible = 10;
        let start = Math.max(1, catalogPage - Math.floor(maxVisible / 2));
        let end = Math.min(catalogTotalPages, start + maxVisible - 1);
        start = Math.max(1, end - maxVisible + 1);

        if (catalogPage > 1) {
            const prev = document.createElement('button');
            prev.className = 'page-btn focusable';
            prev.textContent = '◀';
            prev.addEventListener('click', () => { catalogPage--; loadCatalog(); });
            container.appendChild(prev);
        }

        for (let p = start; p <= end; p++) {
            const btn = document.createElement('button');
            btn.className = `page-btn focusable ${p === catalogPage ? 'active' : ''}`;
            btn.textContent = p;
            btn.addEventListener('click', () => { catalogPage = p; loadCatalog(); });
            container.appendChild(btn);
        }

        if (catalogPage < catalogTotalPages) {
            const next = document.createElement('button');
            next.className = 'page-btn focusable';
            next.textContent = '▶';
            next.addEventListener('click', () => { catalogPage++; loadCatalog(); });
            container.appendChild(next);
        }
    }

    // ─── Search ───
    async function doSearch(query) {
        const q = (query || '').trim();
        const grid = document.getElementById('search-grid');
        const empty = document.getElementById('search-empty');

        if (q.length < 2) {
            grid.innerHTML = '';
            empty.style.display = q.length === 0 ? '' : 'none';
            return;
        }

        grid.innerHTML = '<div style="color:#555;padding:40px;text-align:center">Buscando...</div>';
        empty.style.display = 'none';

        const data = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
        grid.innerHTML = '';

        if (!data || !data.media || data.media.length === 0) {
            empty.style.display = '';
            empty.querySelector('p').textContent = `No se encontraron resultados para "${q}"`;
            return;
        }

        data.media.forEach(anime => {
            grid.appendChild(createAnimeCard(anime));
        });

        Navigation.updateFocusables();
    }

    // ─── Favorites ───
    async function loadFavorites() {
        const grid = document.getElementById('favorites-grid');
        const empty = document.getElementById('favorites-empty');

        const data = await fetchJSON('/api/favorites');
        grid.innerHTML = '';

        if (!data || data.length === 0) {
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';
        data.forEach(fav => {
            grid.appendChild(createAnimeCard(fav));
        });
        Navigation.updateFocusables();
    }

    // ─── Schedule ───
    let scheduleData = null;
    let scheduleActiveDay = null;

    async function loadSchedule() {
        const tabsContainer = document.getElementById('schedule-tabs');
        const contentContainer = document.getElementById('schedule-content');

        if (!scheduleData) {
            contentContainer.innerHTML = '<div style="color:#555;padding:60px;text-align:center">Cargando programación semanal...</div>';
            const result = await fetchJSON('/api/schedule');
            if (!result) {
                contentContainer.innerHTML = '<div style="color:#555;padding:60px;text-align:center">Error cargando programación</div>';
                return;
            }
            scheduleData = result.data || result;
        }

        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayEmojis = { 'Domingo': '🌅', 'Lunes': '🌙', 'Martes': '🔥', 'Miércoles': '⚡', 'Jueves': '🌟', 'Viernes': '🎉', 'Sábado': '✨' };
        const todayIndex = new Date().getDay();
        const todayName = dayNames[todayIndex];

        if (!scheduleActiveDay) scheduleActiveDay = todayName;

        // Render tabs
        tabsContainer.innerHTML = '';
        dayNames.forEach(day => {
            const tab = document.createElement('button');
            tab.className = `schedule-tab focusable ${day === scheduleActiveDay ? 'active' : ''} ${day === todayName ? 'today' : ''}`;
            tab.tabIndex = 0;
            tab.textContent = `${dayEmojis[day] || ''} ${day}`;
            tab.addEventListener('click', () => {
                scheduleActiveDay = day;
                renderScheduleDay();
                // Update tab active state
                tabsContainer.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
            tabsContainer.appendChild(tab);
        });

        renderScheduleDay();
    }

    function renderScheduleDay() {
        const contentContainer = document.getElementById('schedule-content');
        const dayEmojis = { 'Domingo': '🌅', 'Lunes': '🌙', 'Martes': '🔥', 'Miércoles': '⚡', 'Jueves': '🌟', 'Viernes': '🎉', 'Sábado': '✨' };
        const animes = (scheduleData && scheduleData[scheduleActiveDay]) ? scheduleData[scheduleActiveDay] : [];

        contentContainer.innerHTML = '';

        const dayDiv = document.createElement('div');
        dayDiv.className = 'schedule-day active';

        const header = document.createElement('div');
        header.className = 'schedule-day-header';
        header.innerHTML = `${dayEmojis[scheduleActiveDay] || ''} ${scheduleActiveDay} <span class="day-count">${animes.length} anime${animes.length !== 1 ? 's' : ''}</span>`;
        dayDiv.appendChild(header);

        if (animes.length === 0) {
            dayDiv.innerHTML += '<div class="schedule-empty">No hay anime programado para este día</div>';
        } else {
            const grid = document.createElement('div');
            grid.className = 'schedule-grid';
            animes.forEach(anime => {
                grid.appendChild(createAnimeCard(anime));
            });
            dayDiv.appendChild(grid);
        }

        contentContainer.appendChild(dayDiv);
        Navigation.updateFocusables();
    }

    // ─── Lazy Loading ───
    let imageObserver;
    function setupLazyLoad() {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '200px' });
    }

    function observeImage(img) {
        if (img && imageObserver) {
            imageObserver.observe(img);
        }
    }

    // ─── Public API ───
    return {
        init,
        goBack,
        navigateTo,
        fetchJSON,
        API_BASE
    };
})();

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => App.init());
