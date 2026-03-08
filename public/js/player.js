const Player = (() => {
    let currentAnimeSlug = '';
    let currentAnimeTitle = '';
    let currentAnimeCover = '';
    let currentEpisodes = [];
    let currentEpisodeIndex = -1;
    let currentServers = [];
    let currentServerIndex = 0;
    let overlayTimeout = null;
    let currentHls = null;
    let progressInterval = null;
    let savedProgress = 0;

    // DOM refs
    const video = () => document.getElementById('player-video');
    const overlay = () => document.getElementById('player-overlay');
    const progressBar = () => document.getElementById('player-progress-bar');
    const progressFill = () => document.getElementById('player-progress-fill');
    const progressHandle = () => document.getElementById('player-progress-handle');
    const timeCurrent = () => document.getElementById('player-time-current');
    const timeTotal = () => document.getElementById('player-time-total');
    const playBtn = () => document.getElementById('player-play-btn');
    const centerIcon = () => document.getElementById('player-center-icon');

    function init() {
        console.log('[Player] Initializing Netflix Player...');
        setupEvents();
    }

    function setupEvents() {
        // Overlay Buttons
        document.getElementById('player-back')?.addEventListener('click', () => App.goBack());
        document.getElementById('player-server-toggle')?.addEventListener('click', toggleServers);
        document.getElementById('player-prev')?.addEventListener('click', prevEpisode);
        document.getElementById('player-next')?.addEventListener('click', nextEpisode);
        document.getElementById('player-rewind')?.addEventListener('click', () => seek(-10));
        document.getElementById('player-forward')?.addEventListener('click', () => seek(10));
        playBtn()?.addEventListener('click', togglePlayPause);

        // Video Events
        const v = video();
        if (v) {
            v.addEventListener('timeupdate', updateProgress);
            v.addEventListener('loadedmetadata', () => {
                timeTotal().textContent = formatTime(v.duration);
            });
            v.addEventListener('play', () => updatePlayPauseUI(true));
            v.addEventListener('pause', () => updatePlayPauseUI(false));
            v.addEventListener('click', togglePlayPause);
        }

        // Progress Bar Click
        progressBar()?.addEventListener('click', (e) => {
            const rect = progressBar().getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            v.currentTime = pos * v.duration;
        });
    }

    async function loadEpisode(animeSlug, episodes, index, title, cover) {
        currentAnimeSlug = animeSlug;
        currentAnimeTitle = title;
        currentAnimeCover = cover;
        currentEpisodes = episodes;
        currentEpisodeIndex = index;
        const episode = episodes[index];

        document.getElementById('player-overlay-title').textContent = title;
        document.getElementById('player-overlay-ep').textContent = `Episodio ${episode.number}`;

        // Desactivar navegación global mientras el video está en pantalla
        if (typeof Navigation !== 'undefined') {
            Navigation.clearFocus();
            Navigation.disable();
        }

        // Load Saved Progress
        savedProgress = 0;
        try {
            const hist = await App.fetchJSON('/api/history');
            if (Array.isArray(hist)) {
                const item = hist.find(h => h.episodeSlug === episode.slug);
                if (item && item.progress > 10) {
                    savedProgress = item.progress;
                    console.log(`[Player] Progress found: ${savedProgress}s`);
                }
            }
        } catch (e) { }

        saveToHistory(episode, savedProgress);

        try {
            const json = await App.fetchJSON(`/api/episode/${episode.slug}`);
            if (json && json.servers) {
                currentServers = json.servers;
                currentServerIndex = 0;
                renderServers();
                loadServer(0);
            }
        } catch (e) {
            console.error("[Player] Error loading episode:", e);
        }

        saveToHistory(episode);
    }

    async function loadServer(index) {
        if (index < 0 || index >= currentServers.length) return;
        currentServerIndex = index;
        const server = currentServers[index];

        document.querySelectorAll('.server-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });

        const v = video();
        const frame = document.getElementById('player-iframe');

        destroyHls();
        v.pause();
        v.src = "";
        v.style.display = 'block';
        if (frame) frame.style.display = 'none';

        showToast(`Cargando ${server.name || 'Servidor'}...`);

        try {
            const json = await App.fetchJSON(`/api/stream/resolve?embed=${encodeURIComponent(server.code || server.embed)}`);

            if (json && json.success && json.url && json.type !== 'iframe') {
                const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(json.url)}`;

                if (json.type === 'hls' || proxyUrl.includes('.m3u8')) {
                    if (window.Hls && Hls.isSupported()) {
                        // Smart Buffer Config for TV
                        currentHls = new Hls({
                            maxBufferLength: 30,
                            maxMaxBufferLength: 60,
                            maxBufferSize: 50 * 1024 * 1024, // 50MB max to avoid TV crashes
                            backBufferLength: 30,           // Free memory of watched parts
                            maxBufferHole: 0.5,
                            manifestLoadingMaxRetry: 5,
                            levelLoadingMaxRetry: 5,
                            enableWorker: true
                        });
                        currentHls.loadSource(proxyUrl);
                        currentHls.attachMedia(v);
                        currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
                            if (savedProgress > 0) {
                                const onMeta = () => {
                                    v.currentTime = Math.max(0, savedProgress - 3);
                                    showToast(`Reanudando desde ${formatTime(savedProgress)}`);
                                    v.removeEventListener('loadedmetadata', onMeta);
                                };
                                v.addEventListener('loadedmetadata', onMeta);
                            }
                            v.play().catch(e => console.log("Autoplay blocked"));
                        });
                    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
                        v.src = proxyUrl;
                        if (savedProgress > 0) {
                            const onMeta = () => {
                                v.currentTime = Math.max(0, savedProgress - 3);
                                showToast(`Reanudando desde ${formatTime(savedProgress)}`);
                                v.removeEventListener('loadedmetadata', onMeta);
                            };
                            v.addEventListener('loadedmetadata', onMeta);
                        }
                        v.play();
                    }
                } else {
                    v.src = proxyUrl;
                    v.play();
                }
            } else {
                showToast('Servidor no compatible con reproductor nativo. Intentando fallback...');
                v.style.display = 'none';
                if (frame) {
                    frame.style.display = 'block';
                    frame.src = server.code || server.embed;
                }
            }
        } catch (err) {
            console.error('[Player] Error resolving stream:', err);
        }

        // Importante: Quitar el foco de cualquier botón para evitar re-triggers accidentales con OK
        if (document.activeElement) document.activeElement.blur();

        showOverlayTemporarily();
    }

    function togglePlayPause() {
        const v = video();
        if (v.paused) v.play().catch(e => console.log("Play failed", e));
        else v.pause();
        showOverlayTemporarily();
        animateCenterIcon(v.paused ? 'fa-pause' : 'fa-play');
    }

    function updatePlayPauseUI(isPlaying) {
        const btn = playBtn();
        if (btn) {
            btn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        }
    }

    function animateCenterIcon(iconClass) {
        const icon = centerIcon();
        if (icon) {
            icon.innerHTML = `<i class="fas ${iconClass}"></i>`;
            icon.classList.remove('active');
            void icon.offsetWidth; // Trigger reflow
            icon.classList.add('active');
            setTimeout(() => icon.classList.remove('active'), 800);
        }
    }

    function seek(seconds) {
        const v = video();
        if (!v || isNaN(v.duration)) {
            showToast('Esperando datos del video...');
            return;
        }
        v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
        showOverlayTemporarily();
        showToast(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
    }

    function updateProgress() {
        const v = video();
        if (!v.duration) return;
        const percent = (v.currentTime / v.duration) * 100;
        progressFill().style.width = percent + '%';
        progressHandle().style.left = percent + '%';
        timeCurrent().textContent = formatTime(v.currentTime);
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function showOverlayTemporarily() {
        overlay().classList.add('visible');
        clearTimeout(overlayTimeout);
        overlayTimeout = setTimeout(() => {
            if (document.getElementById('player-servers').style.display === 'none') {
                overlay().classList.remove('visible');
            }
        }, 4000);
    }

    function toggleServers() {
        const s = document.getElementById('player-servers');
        const isHidden = s.style.display === 'none';
        s.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            setTimeout(() => s.querySelector('.focusable')?.focus(), 100);
        }
    }

    function renderServers() {
        const container = document.getElementById('player-servers');
        container.innerHTML = '';
        currentServers.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className = `server-btn focusable ${i === currentServerIndex ? 'active' : ''}`;
            btn.textContent = s.name || `Server ${i + 1}`;
            btn.onclick = () => {
                loadServer(i);
                toggleServers();
            };
            container.appendChild(btn);
        });
    }

    function prevEpisode() {
        if (currentEpisodeIndex > 0) loadEpisode(currentAnimeSlug, currentEpisodes, currentEpisodeIndex - 1, currentAnimeTitle, currentAnimeCover);
    }

    function nextEpisode() {
        if (currentEpisodeIndex < currentEpisodes.length - 1) loadEpisode(currentAnimeSlug, currentEpisodes, currentEpisodeIndex + 1, currentAnimeTitle, currentAnimeCover);
    }

    function destroyHls() {
        if (currentHls) {
            currentHls.destroy();
            currentHls = null;
        }
    }

    function destroy() {
        console.log('[Player] Destroying player and cleaning up...');

        // Detener guardado de progreso
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }

        // Destruir motor Hls
        destroyHls();

        // Matar video y audio
        const v = video();
        if (v) {
            v.pause();
            v.src = "";
            v.removeAttribute('src');
            v.load();
            v.style.display = 'none';
        }

        // Limpiar iframes si los hubiera
        const frame = document.getElementById('player-iframe');
        if (frame) {
            frame.src = 'about:blank';
            frame.style.display = 'none';
        }

        overlay()?.classList.remove('visible');

        // Re-activar navegación global al salir
        if (typeof Navigation !== 'undefined') {
            Navigation.enable();
        }
    }

    async function saveToHistory(episode, progress = 0) {
        if (!episode || !document.getElementById('screen-player').classList.contains('active')) return;

        // Setup periodic progress saving
        if (!progressInterval) {
            progressInterval = setInterval(() => {
                const v = video();
                if (v && !v.paused && v.duration > 0) {
                    saveToHistory(episode, v.currentTime);
                }
            }, 10000); // 10s is safer
        }

        try {
            await App.fetchJSON('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animeSlug: currentAnimeSlug,
                    animeTitle: currentAnimeTitle,
                    animeCover: currentAnimeCover,
                    episodeSlug: episode.slug,
                    episodeNumber: episode.number,
                    progress: Math.floor(progress)
                })
            });
        } catch (e) { }
    }

    return { init, loadEpisode, destroy, togglePlayPause, seek, nextEpisode, prevEpisode, showOverlayTemporarily, saveToHistory };
})();

function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// Global Remote Listener
window.addEventListener('keydown', (e) => {
    const screen = document.getElementById('screen-player');
    if (!screen || !screen.classList.contains('active')) return;

    const keyCode = e.keyCode || e.which;
    console.log('[Remote] Player KeyPressed:', keyCode);

    // OK / Enter / Space -> Play/Pause
    if ([13, 32].includes(keyCode)) {
        const serversMenu = document.getElementById('player-servers');
        const isMenuOpen = serversMenu && serversMenu.style.display !== 'none';

        // Si el menú de servidores está abierto Y tenemos el foco en un botón de ahí,
        // dejar que el navegador haga el click normal.
        if (isMenuOpen && e.target.tagName === 'BUTTON' && keyCode === 13) {
            return;
        }

        // En cualquier otro caso (reproducción normal), OK es Play/Pause
        e.preventDefault();
        Player.togglePlayPause();
    }
    // Left -> Rewind 10s
    else if (keyCode === 37) {
        e.preventDefault();
        Player.seek(-10);
    }
    // Right -> Forward 10s
    else if (keyCode === 39) {
        e.preventDefault();
        Player.seek(10);
    }
    // Back / Escape / Backspace -> Exit Player
    else if ([8, 27, 461, 10009].includes(keyCode)) {
        e.preventDefault();
        App.goBack();
    }
    // TV Specific Play/Pause codes
    else if ([19, 102, 179, 415, 250, 10252, 10253, 11152].includes(keyCode)) {
        e.preventDefault();
        Player.togglePlayPause();
    }
    // TV Specific Seek codes
    else if ([417].includes(keyCode)) { // FWD
        e.preventDefault();
        Player.seek(10);
    }
    else if ([412].includes(keyCode)) { // REW
        e.preventDefault();
        Player.seek(-10);
    }
    else {
        Player.showOverlayTemporarily();
    }
});
