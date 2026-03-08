const playerView = document.getElementById('view-player');
const videoElement = document.getElementById('html5-player');
const serverSelector = document.getElementById('server-selector');
let currentHls = null;

document.getElementById('close-player').onclick = () => {
    playerView.classList.remove('active');
    stopPlayer();
};

async function openPlayer(episodeSlug) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    playerView.classList.add('active');
    serverSelector.innerHTML = '<span style="color:#fff">Cargando servidores...</span>';

    // 1. Fetch servers from AnimeFLV episode
    const data = await fetchAPI(`/episode/${episodeSlug}`);
    if (!data || !data.servers) {
        serverSelector.innerHTML = '<span style="color:red">Error cargando servidores</span>';
        return;
    }

    renderServers(data.servers);
}

function renderServers(servers) {
    serverSelector.innerHTML = '';

    // Priority servers that we know how to extract (Fase 3 emulation)
    const supported = servers.filter(s =>
        s.server.toLowerCase().includes('streamwish') ||
        s.server.toLowerCase().includes('fembed') ||
        s.server.toLowerCase().includes('mega')
    );

    // Si hay soportados, los ponemos primero, luego el resto
    const others = servers.filter(s => !supported.includes(s));
    const displayServers = [...supported, ...others];

    displayServers.forEach((srv, index) => {
        const btn = document.createElement('button');
        // Quitamos la clase active inicial para que el usuario elija
        btn.className = 'server-btn';
        btn.innerText = srv.server;
        btn.onclick = () => {
            document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playServer(srv.code);
        };
        serverSelector.appendChild(btn);
    });

    // Hemos quitado playServer(displayServers[0].code) automático
    // Para que el reproductor quede a la espera de que el usuario clique el servidor
}

async function playServer(embedUrl) {
    stopPlayer();
    console.log('[Player] Extrayendo enlace directo de:', embedUrl);

    try {
        // En Ukiku esto lo harian las clases en videoservers (Fase 3)
        const res = await fetch(`${API}/stream/resolve?embed=${encodeURIComponent(embedUrl)}`);
        const json = await res.json();

        if (json.success && json.url) {
            console.log(`[Player] Enlace real extraido (${json.type}):`, json.url);

            // Re-Inhabilitando el Proxy: Dado que Streamwish (Cloudflare) introdujo bloqueos avanzados,
            // usaremos el Proxy Backend Inteligente que reescribe listas relativas M3U8 recursivamente
            // garantizando que cada Fragmento TS incruste el 'Referer' y el 'User-Agent'.
            const streamUrl = json.url;
            const proxyUrl = `${API}/stream/proxy?url=${encodeURIComponent(streamUrl)}`;

            let currentIframe = document.getElementById('iframe-player');

            if (json.type === 'iframe') {
                // By-Pass para Protecciones Antibot
                videoElement.pause();
                videoElement.style.display = 'none';
                if (!currentIframe) {
                    currentIframe = document.createElement('iframe');
                    currentIframe.id = 'iframe-player';
                    currentIframe.style.width = '100%';
                    currentIframe.style.height = '100%';
                    currentIframe.style.border = 'none';
                    videoElement.parentElement.appendChild(currentIframe);
                }
                currentIframe.src = streamUrl;
                currentIframe.style.display = 'block';
            } else if (json.type === 'hls') {
                videoElement.style.display = 'block';
                if (currentIframe) currentIframe.style.display = 'none';

                if (Hls.isSupported()) {
                    currentHls = new Hls({
                        maxBufferLength: 30,
                        enableWorker: true,
                        autoStartLoad: true
                    });
                    currentHls.loadSource(proxyUrl);
                    currentHls.attachMedia(videoElement);
                    currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
                        videoElement.play().catch(e => console.log('Autoplay blocked'));
                    });
                } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    videoElement.src = proxyUrl;
                    videoElement.addEventListener('loadedmetadata', () => {
                        videoElement.play();
                    });
                }
            } else if (json.type === 'mega') {
                window.open(streamUrl, '_blank');
                alert('Mega se ha abierto en una nueva pestaña.');
            } else {
                // MP4 Direct Playback
                videoElement.style.display = 'block';
                if (currentIframe) currentIframe.style.display = 'none';
                videoElement.src = proxyUrl;
                videoElement.play();
            }
        } else {
            alert('No se pudo extraer el video nativo de este servidor. Intenta otro.');
        }
    } catch (e) {
        console.error('[Player] Error al resolver el stream:', e);
    }
}

function stopPlayer() {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }
    let currentIframe = document.getElementById('iframe-player');
    if (currentIframe) {
        currentIframe.src = '';
        currentIframe.style.display = 'none';
    }
}

