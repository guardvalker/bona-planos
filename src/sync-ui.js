// Interfaz del sync opcional: botón de cuenta en Inicio, diálogo de ingreso (email + código)
// y avisos de conflicto. Se crea recién si hay config.js; sin eso el DOM no tiene nada de esto.
import { t, lang } from './i18n.js';
import { esc } from './canvas.js';

const $ = s => document.querySelector(s);
const fmtTime = d => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-AR', { timeStyle: 'short' }).format(d);

export function initSyncUI(sync) {
  let step = 'email', email = '', busy = false, msg = '';
  let snap = sync.state;

  /* ---------- markup ---------- */
  $('#home .home-top').insertAdjacentHTML('afterend', '<div id="syncNotes" aria-live="polite"></div>');
  $('#home .foot').insertAdjacentHTML('afterbegin', '<button id="hCloud"></button>');
  document.body.insertAdjacentHTML('beforeend', `
    <div id="acct" class="overlay" role="dialog" aria-modal="true" aria-labelledby="acTitle">
      <div class="box">
        <strong id="acTitle">${t('sync.title')}</strong>
        <div id="acBody"></div>
        <div id="acMsg" class="help" aria-live="polite"></div>
        <div class="row" id="acBtns"></div>
      </div>
    </div>`);

  /* ---------- botón y avisos en Inicio ---------- */
  function statusText(s) {
    if (s.status === 'syncing') return t('sync.syncing');
    if (s.status === 'offline') return t('sync.offline');
    if (s.status === 'error') return t('sync.errorShort');
    return s.lastSync ? t('sync.synced', { time: fmtTime(s.lastSync) }) : t('sync.signedIn');
  }
  function renderHome() {
    $('#hCloud').textContent = snap.user ? `☁ ${snap.user.email ? snap.user.email + ' · ' : ''}${statusText(snap)}` : t('sync.open');
    $('#syncNotes').innerHTML = snap.notes.map(n =>
      `<p class="note">${esc(t(n.key, { name: n.params.name || t('plan.unnamed') }))}</p>`).join('') +
      (snap.notes.length ? `<button id="notesOk" class="notes-ok">${t('sync.dismiss')}</button>` : '');
    const ok = $('#notesOk');
    if (ok) ok.addEventListener('click', () => sync.dismissNotes());
  }

  /* ---------- diálogo ---------- */
  function renderDialog() {
    const body = $('#acBody'), btns = $('#acBtns');
    $('#acMsg').textContent = msg;
    const b = (id, label, cls = '') => `<button id="${id}" class="${cls}"${busy ? ' disabled' : ''}>${label}</button>`;
    if (snap.user) {
      body.innerHTML = `<p>${t('sync.as', { email: esc(snap.user.email || '') })}</p>` +
        `<p class="help">${esc(statusText(snap))}${snap.status === 'error' && snap.error ? ` — ${esc(snap.error)}` : ''}</p>`;
      btns.innerHTML = b('acNow', t('sync.now'), 'primary') + b('acOut', t('sync.signOut'), 'danger') + b('acClose', t('data.close'));
    } else if (step === 'email') {
      body.innerHTML = `<p class="help">${t('sync.help')}</p>` +
        `<input id="acEmail" type="email" autocomplete="email" inputmode="email" value="${esc(email)}" aria-label="${t('sync.email')}" placeholder="${t('sync.email')}">`;
      btns.innerHTML = b('acSend', t('sync.send'), 'primary') + b('acClose', t('data.close'));
    } else {
      body.innerHTML = `<p class="help">${t('sync.codeSent', { email: esc(email) })}</p>` +
        `<input id="acCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" aria-label="${t('sync.code')}" placeholder="${t('sync.code')}">`;
      btns.innerHTML = b('acVerify', t('sync.verify'), 'primary') + b('acBack', t('sync.changeEmail')) + b('acClose', t('data.close'));
    }
  }

  const run = async (fn, okMsg = '') => {
    busy = true; msg = ''; renderDialog();
    try { await fn(); msg = okMsg; } catch (e) { msg = t('sync.error', { msg: e && e.message ? e.message : String(e) }); }
    busy = false; renderDialog();
    const first = $('#acEmail') || $('#acCode') || $('#acNow');
    if (first) first.focus();
  };

  $('#acct').addEventListener('click', e => {
    const id = e.target.closest('button') && e.target.closest('button').id;
    if (id === 'acClose') $('#acct').classList.remove('show');
    else if (id === 'acSend') {
      email = $('#acEmail').value.trim();
      if (!email) return;
      run(async () => { await sync.sendOtp(email); step = 'code'; });
    } else if (id === 'acVerify') {
      const code = $('#acCode').value.trim();
      if (!code) return;
      run(async () => { await sync.verifyOtp(email, code); step = 'email'; });
    } else if (id === 'acBack') { step = 'email'; msg = ''; renderDialog(); $('#acEmail').focus(); }
    else if (id === 'acNow') run(() => sync.syncNow());
    else if (id === 'acOut') run(() => sync.signOut());
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#acct').classList.contains('show')) $('#acct').classList.remove('show');
  });
  $('#acct').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ($('#acSend') || $('#acVerify')).click(); }
  });
  $('#hCloud').addEventListener('click', () => {
    msg = ''; renderDialog();
    $('#acct').classList.add('show');
    const first = $('#acEmail') || $('#acNow');
    if (first) first.focus();
  });

  renderHome();
  return function onState(s) {
    snap = s;
    renderHome();
    if ($('#acct').classList.contains('show') && !busy) renderDialog();
  };
}
