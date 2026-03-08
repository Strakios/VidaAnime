/* ══════════════════════════════════════════════════════
   AnimeVidaa — Smart TV Keyboard Navigation Engine
   D-pad style: Arrow Keys, Enter, Escape/Backspace
   Works entirely without mouse — visual focus ring
   ══════════════════════════════════════════════════════ */

const Navigation = (() => {
    let enabled = true;
    let _focusedEl = null;

    function init() {
        // Capture ALL key events at document level
        document.addEventListener('keydown', handleKeyDown, true);

        // When user clicks with mouse, also set our focus to that element
        document.addEventListener('click', (e) => {
            const focusable = e.target.closest('.focusable');
            if (focusable) {
                setFocusOnElement(focusable);
            }
        }, true);

        // Prevent default scrolling on arrow keys globally
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) {
                // Only prevent if not typing in an input
                if (document.activeElement?.tagName !== 'INPUT') {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }

    function disable() { enabled = false; }
    function enable() { enabled = true; }

    /* ─── Get all currently visible focusable elements ─── */
    function getFocusables() {
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return [];

        const navbar = document.getElementById('navbar');
        const navItems = navbar && navbar.style.display !== 'none'
            ? Array.from(navbar.querySelectorAll('.focusable'))
            : [];

        const screenItems = Array.from(activeScreen.querySelectorAll('.focusable'));

        const all = [...navItems, ...screenItems];

        // Filter to only visible elements
        return all.filter(el => {
            if (!el.offsetParent && el.style.display !== 'fixed' && !el.closest('.navbar')) {
                // Check if it's in a fixed/absolute parent
                const style = window.getComputedStyle(el);
                if (style.position !== 'fixed' && style.position !== 'absolute') {
                    // Check parent
                    let parent = el.parentElement;
                    while (parent) {
                        const ps = window.getComputedStyle(parent);
                        if (ps.display === 'none') return false;
                        if (ps.position === 'fixed' || ps.position === 'absolute') break;
                        parent = parent.parentElement;
                    }
                }
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    }

    function getFocusedElement() { return _focusedEl; }

    function clearFocus() {
        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        _focusedEl = null;
    }

    function setFocusOnElement(element) {
        if (!element) return;
        clearFocus();
        _focusedEl = element;
        element.classList.add('focused');

        // Ensure tabindex for focus
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }

        // Don't steal focus from iframe
        if (document.activeElement?.tagName !== 'IFRAME') {
            element.focus({ preventScroll: true });
        }

        scrollIntoViewSmart(element);
    }

    function scrollIntoViewSmart(el) {
        // Horizontal scroll in row
        const rowScroll = el.closest('.row-scroll');
        if (rowScroll) {
            const elRect = el.getBoundingClientRect();
            const rowRect = rowScroll.getBoundingClientRect();
            const pad = 80;
            if (elRect.left < rowRect.left + pad) {
                rowScroll.scrollBy({ left: elRect.left - rowRect.left - pad, behavior: 'smooth' });
            } else if (elRect.right > rowRect.right - pad) {
                rowScroll.scrollBy({ left: elRect.right - rowRect.right + pad, behavior: 'smooth' });
            }
        }

        // Vertical scroll in screen
        const screen = el.closest('.screen');
        if (screen) {
            const elRect = el.getBoundingClientRect();
            const topBound = 90;
            const bottomBound = window.innerHeight - 40;
            if (elRect.top < topBound) {
                screen.scrollBy({ top: elRect.top - topBound - 20, behavior: 'smooth' });
            } else if (elRect.bottom > bottomBound) {
                screen.scrollBy({ top: elRect.bottom - bottomBound + 40, behavior: 'smooth' });
            }
        }
    }

    /* ─── Spatial navigation: find nearest in direction ─── */
    function findNearest(direction) {
        const focusables = getFocusables();
        if (focusables.length === 0) return null;

        if (!_focusedEl || focusables.indexOf(_focusedEl) === -1) {
            return focusables[0];
        }

        const cr = _focusedEl.getBoundingClientRect();
        const cx = cr.left + cr.width / 2;
        const cy = cr.top + cr.height / 2;

        let best = null;
        let bestScore = Infinity;

        for (const el of focusables) {
            if (el === _focusedEl) continue;
            const r = el.getBoundingClientRect();
            const ex = r.left + r.width / 2;
            const ey = r.top + r.height / 2;
            const dx = ex - cx;
            const dy = ey - cy;

            let valid = false, primary = 0, secondary = 0;

            switch (direction) {
                case 'right':
                    valid = dx > 10;
                    primary = dx; secondary = Math.abs(dy);
                    break;
                case 'left':
                    valid = dx < -10;
                    primary = -dx; secondary = Math.abs(dy);
                    break;
                case 'down':
                    valid = dy > 10;
                    primary = dy; secondary = Math.abs(dx);
                    break;
                case 'up':
                    valid = dy < -10;
                    primary = -dy; secondary = Math.abs(dx);
                    break;
            }

            if (valid) {
                // Strongly prefer same-row (small secondary) and closer (small primary)
                const score = primary * 1 + secondary * 3;
                if (score < bestScore) {
                    bestScore = score;
                    best = el;
                }
            }
        }

        return best;
    }

    /* ─── Key handler ─── */
    function handleKeyDown(e) {
        if (!enabled) return;

        let key = e.key;

        // Hisense VIDAA OS TV Remote KeyCodes
        // Older WebKit environments don't emit standard e.key strings for hardware buttons
        if (e.keyCode === 10009 || e.keyCode === 461) key = 'Escape'; // Back/Return
        if (e.keyCode === 415 || e.keyCode === 10252) key = 'MediaPlay';
        if (e.keyCode === 19 || e.keyCode === 10253) key = 'MediaPause';
        if (e.keyCode === 412) key = 'MediaRewind';
        if (e.keyCode === 417) key = 'MediaFastForward';
        if (e.keyCode === 413) key = 'MediaStop';

        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

        // When typing in search, only intercept arrow up/down and escape
        if (isTyping) {
            if (key === 'Escape') {
                e.preventDefault();
                activeEl.blur();
                // Re-focus on the input element in our system
                setFocusOnElement(activeEl);
                return;
            }
            if (key === 'ArrowDown') {
                e.preventDefault();
                activeEl.blur();
                const next = findNearest('down');
                if (next) setFocusOnElement(next);
                return;
            }
            if (key === 'ArrowUp') {
                e.preventDefault();
                activeEl.blur();
                const next = findNearest('up');
                if (next) setFocusOnElement(next);
                return;
            }
            // Let all other keys go to the input naturally
            return;
        }

        switch (key) {
            case 'ArrowRight':
                e.preventDefault();
                moveFocus('right');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moveFocus('left');
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveFocus('down');
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveFocus('up');
                break;
            case 'Enter':
            case ' ': {
                if (!_focusedEl) return;
                e.preventDefault();
                activateCurrent();
                break;
            }
            case 'Escape':
            case 'Backspace':
                e.preventDefault();
                if (typeof App !== 'undefined' && App.goBack) App.goBack();
                break;


            // TV Media Keys
            case 'MediaPlayPause':
            case 'Play':
            case 'Pause':
            case 'MediaPlay':
            case 'MediaPause':
                e.preventDefault();
                if (typeof Player !== 'undefined' && Player.togglePlayPause) Player.togglePlayPause();
                break;
            case 'MediaFastForward':
                e.preventDefault();
                if (typeof Player !== 'undefined' && Player.seek) Player.seek(10);
                break;
            case 'MediaRewind':
            case 'MediaTrackPrevious':
                e.preventDefault();
                if (typeof Player !== 'undefined' && Player.seek) Player.seek(-10);
                break;
            case 'MediaTrackNext':
                e.preventDefault();
                if (typeof Player !== 'undefined' && Player.nextEpisode) Player.nextEpisode();
                break;
        }

        // Si estamos en el reproductor, cualquier tecla debe mostrar los controles
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id === 'screen-player') {
            if (typeof Player !== 'undefined' && Player.showOverlayTemporarily) {
                Player.showOverlayTemporarily();
            }
        }
    }

    function moveFocus(direction) {
        const next = findNearest(direction);
        if (next) {
            setFocusOnElement(next);
        } else if (!_focusedEl) {
            // Nothing focused yet — focus first element
            focusFirst();
        }
    }

    function activateCurrent() {
        if (!_focusedEl) {
            focusFirst();
            return;
        }
        // If it's an input, focus it for typing
        if (_focusedEl.tagName === 'INPUT' || _focusedEl.tagName === 'TEXTAREA') {
            _focusedEl.focus();
            return;
        }
        // Trigger click
        _focusedEl.click();
    }

    function focusFirst() {
        const focusables = getFocusables();
        // Try to focus first content element (skip nav)
        const navbar = document.getElementById('navbar');
        const navCount = navbar ? navbar.querySelectorAll('.focusable').length : 0;
        if (focusables.length > navCount) {
            setFocusOnElement(focusables[navCount]);
        } else if (focusables.length > 0) {
            setFocusOnElement(focusables[0]);
        }
    }

    function updateFocusables() {
        // No-op kept for compatibility; focus list is computed dynamically now
    }

    return {
        init, enable, disable,
        updateFocusables,
        setFocusOnElement,
        clearFocus,
        focusFirst,
        getFocusedElement
    };
})();
