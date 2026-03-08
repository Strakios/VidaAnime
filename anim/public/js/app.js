const API = '/api';
let currentAnime = null;

// SPA Navigation
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');

        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${targetView}`).classList.add('active');

        if (targetView === 'catalog') initCatalog();
    });
});

// Fetch Data
async function fetchAPI(endpoint) {
    try {
        const res = await fetch(`${API}${endpoint}`);
        const data = await res.json();
        return data.success ? data.data : null;
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

// Render Cards
function createCard(item, isEpisode = false) {
    const el = document.createElement('div');
    el.className = 'card';
    const link = isEpisode ? `/episode/${item.slug}` : `/anime/${item.slug}`;

    // AnimeFLV often provides covers, we fallback to default if missing
    const coverUrl = item.cover || `https://animeflv.net/uploads/animes/covers/${item.id || 1}.jpg`;

    el.innerHTML = `
        <div class="card-img-wrapper">
            <img src="${coverUrl}" alt="Cover" onerror="this.src='https://via.placeholder.com/200x300?text=No+Cover'">
        </div>
        <div class="card-info">
            <div class="card-title">${item.title}</div>
            ${isEpisode ? `<div class="card-ep">Caps: ${item.episode_number || '?'}</div>` : ''}
        </div>
    `;

    el.onclick = () => {
        if (isEpisode) {
            // Emulate Phase 3-4 Trigger
            openPlayer(item.slug);
        } else {
            openDetail(item.slug);
        }
    };
    return el;
}

async function initHome() {
    // Ultimos episodios
    const today = await fetchAPI('/today');
    const gridLatest = document.getElementById('grid-latest');
    gridLatest.innerHTML = '';
    if (today) today.forEach(item => gridLatest.appendChild(createCard(item, true)));

    // En emision
    const weekly = await fetchAPI('/weekly');
    const gridWeekly = document.getElementById('grid-weekly');
    gridWeekly.innerHTML = '';
    if (weekly) weekly.forEach(item => gridWeekly.appendChild(createCard(item, false)));
}

async function initCatalog() {
    const gridCatalog = document.getElementById('grid-catalog');
    if (gridCatalog.innerHTML !== '') return; // Ya cargado
    gridCatalog.innerHTML = '<p>Cargando catálogo...</p>';
    const catalog = await fetchAPI('/catalog');
    gridCatalog.innerHTML = '';
    if (catalog && catalog.media) {
        catalog.media.forEach(item => gridCatalog.appendChild(createCard(item, false)));
    }
}

// Búsqueda
document.getElementById('search-input').addEventListener('input', async (e) => {
    const q = e.target.value;
    const grid = document.getElementById('grid-search');
    if (q.length < 3) return;
    const res = await fetchAPI(`/search?q=${encodeURIComponent(q)}`);
    grid.innerHTML = '';
    if (res && res.media) {
        res.media.forEach(item => grid.appendChild(createCard(item, false)));
    }
});

// Detail View
async function openDetail(slug) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-detail').classList.add('active');

    const data = await fetchAPI(`/anime/${slug}`);
    if (!data) return;

    document.getElementById('detail-cover').src = data.cover;
    document.getElementById('detail-title').innerText = data.title;
    document.getElementById('detail-synopsis').innerText = data.synopsis || 'Sin sinopsis.';

    const genresEl = document.getElementById('detail-genres');
    genresEl.innerHTML = '';
    if (data.genres) data.genres.forEach(g => {
        const s = document.createElement('span'); s.innerText = g; genresEl.appendChild(s);
    });

    const epGrid = document.getElementById('episodes-grid');
    epGrid.innerHTML = '';
    if (data.episodes) {
        // Sort asc
        const eps = [...data.episodes].reverse();
        eps.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'ep-btn';
            btn.innerText = ep.number;
            btn.onclick = () => openPlayer(`${slug}-${ep.number}`);
            epGrid.appendChild(btn);
        });
    }
}

// Inicializar
initHome();
