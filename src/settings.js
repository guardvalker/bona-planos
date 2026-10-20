// Ajustes: tema día/noche, idioma, cuenta y sync (lo agrega sync-ui.js si hay config), novedades y actualización.
import { t, lang, setLang } from './i18n.js';
import { APP_VERSION, CHANGELOG } from './version.js';
import { esc } from './canvas.js';

const $ = s => document.querySelector(s);
const THEME_KEY = 'bona_planos_theme';
const BAR = { light: '#ffffff', dark: '#18222c' };

const savedTheme = () => { try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; } };

// 'auto' sigue al sistema (sin data-theme); 'light'/'dark' lo fuerzan.
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (!m.dataset.media) m.dataset.media = m.getAttribute('media') || '';
    if (!m.dataset.content) m.dataset.content = m.getAttribute('content');
    if (mode === 'auto') { if (m.dataset.media) m.setAttribute('media', m.dataset.media); m.setAttribute('content', m.dataset.content); }
    else { m.removeAttribute('media'); m.setAttribute('content', BAR[mode]); }
  });
}

export function initSettings() {
  const open = () => { $('#settings').classList.add('show'); $('#setClose').focus(); };
  const close = () => $('#settings').classList.remove('show');
  const markTheme = mode => document.querySelectorAll('[data-theme-opt]').forEach(b => {
    const on = b.dataset.themeOpt === mode;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
  markTheme(savedTheme());
  document.querySelector('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-theme-opt]');
    if (!b) return;
    const mode = b.dataset.themeOpt;
    try { if (mode === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, mode); } catch (err) { /* sin storage: vale solo esta sesión */ }
    applyTheme(mode); markTheme(mode);
  });

  [['lEs', 'es'], ['lEn', 'en']].forEach(([id, l]) => {
    $('#' + id).classList.toggle('on', lang === l);
    $('#' + id).setAttribute('aria-pressed', lang === l);
    $('#' + id).addEventListener('click', () => { if (lang !== l) setLang(l); });
  });

  $('#setVer').textContent = t('about.version', { v: APP_VERSION });
  $('#hSet').addEventListener('click', open);
  $('#eSet').addEventListener('click', open);
  $('#setClose').addEventListener('click', close);
  $('#settings').addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('#settings').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });

  $('#abOpen').addEventListener('click', () => {
    $('#abBody').innerHTML = CHANGELOG.map(c =>
      `<h3>${esc(c.v)} · ${esc(c.date)}</h3><ul>${c.items.map(k => `<li>${esc(t(k))}</li>`).join('')}</ul>`).join('');
    close();
    $('#about').classList.add('show');
    $('#abClose').focus();
  });
  $('#abClose').addEventListener('click', () => $('#about').classList.remove('show'));
  $('#about').addEventListener('keydown', e => { if (e.key === 'Escape') $('#about').classList.remove('show'); });
  // Actualización manual: borra caches y service workers y recarga (no depende de que sw.js haya cambiado).
  $('#abUpdate').addEventListener('click', async () => {
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { /* sin SW: solo recarga */ }
    location.reload();
  });
}
