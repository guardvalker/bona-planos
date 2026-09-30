// Exportaciones: SVG autónomo (plano + leyenda + resumen), PNG, impresión/PDF y JSON.
// El SVG usa colores fijos de tema claro: sale igual aunque la app esté en oscuro.
import { getPlan, summarize, countsText, normalize, U } from './state.js';
import { SYMBOLS } from './symbols.js';
import { t, tn, fmtNum, lang } from './i18n.js';
import { esc } from './canvas.js';

const C = { bg: '#ffffff', room: '#f8fafc', wall: '#1d2b38', ink: '#14202b', mute: '#5d6b78', none: '#8b9aa8' };
const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
const PAD = 24, HEAD = 40, ROW = 24;

const cName = (n, name) => `${t('circuit.short', { n })} ${name}`.trim();

export function buildSvg(plan = getPlan()) {
  const sum = summarize(plan);

  // límites del dibujo (ambientes + elementos con su etiqueta)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ext = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  plan.rooms.forEach(r => ext(r.x - 2, r.y - 2, r.x + r.w + 2, r.y + r.h + 2));
  plan.items.forEach(i => ext(i.x - 14, i.y - 14, i.x + 14, i.y + 28));
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 320; y1 = 200; }
  const pw = x1 - x0, ph = y1 - y0;

  // líneas de la leyenda
  const lines = sum.rows.map(r => ({ color: r.color, label: cName(r.n, r.name), detail: countsText(r.counts), total: r.total }));
  if (sum.orphan) lines.push({ color: C.none, label: t('legend.unassigned'), detail: countsText(sum.orphan.counts), total: sum.orphan.total });
  const otherTxt = Object.entries(sum.other).map(([k, n]) => tn(`count.${k}`, n)).join(' · ');
  const longest = Math.max(...lines.map(l => (l.label + l.detail).length + 14), 40);
  const W = Math.max(pw + PAD * 2, longest * 7.4 + PAD * 2 + 30, 420);

  const py = HEAD + PAD;
  let legendY = py + ph + PAD + 8;
  const legendH = 30 + lines.length * ROW + (otherTxt ? ROW : 0) + ROW + PAD;
  const H = legendY + legendH;

  let g = '';
  // plano
  g += `<g transform="translate(${(W - pw) / 2 - x0} ${py - y0})">`;
  for (const r of plan.rooms) {
    g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${C.room}" stroke="${C.wall}" stroke-width="3"/>`
      + `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 - 2}" font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle">${esc(r.name)}</text>`
      + `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 12}" font-size="10" fill="${C.mute}" text-anchor="middle">${fmtNum(r.w / U)} × ${fmtNum(r.h / U)} m</text>`;
  }
  for (const it of plan.items) {
    const sym = SYMBOLS[it.type];
    if (!sym) continue;
    const c = plan.circuits.find(c => c.id === it.c);
    const col = c ? c.color : C.none;
    g += sym.draw(it.x, it.y, col).replaceAll('var(--room)', C.room);
    if (sym.circuit && c) {
      g += `<text x="${it.x}" y="${it.y + 22}" font-size="10" font-weight="700" fill="${C.ink}" text-anchor="middle">${t('circuit.short', { n: plan.circuits.indexOf(c) + 1 })}</text>`;
    }
  }
  g += '</g>';

  // encabezado
  const date = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-AR', { dateStyle: 'medium' }).format(new Date(plan.updatedAt));
  g += `<text x="${PAD}" y="${HEAD - 10}" font-size="18" font-weight="700" fill="${C.ink}">${esc(plan.name || t('plan.unnamed'))}</text>`
    + `<text x="${W - PAD}" y="${HEAD - 10}" font-size="11" fill="${C.mute}" text-anchor="end">${esc(date)}</text>`
    + `<line x1="${PAD}" y1="${HEAD - 2}" x2="${W - PAD}" y2="${HEAD - 2}" stroke="${C.mute}" stroke-width=".6"/>`;

  // leyenda y resumen
  g += `<text x="${PAD}" y="${legendY + 14}" font-size="13" font-weight="700" fill="${C.ink}">${t('legend.title')}</text>`;
  let y = legendY + 30;
  for (const l of lines) {
    g += `<circle cx="${PAD + 7}" cy="${y + 8}" r="6" fill="${l.color}"/>`
      + `<text x="${PAD + 22}" y="${y + 12}" font-size="13" fill="${C.ink}"><tspan font-weight="600">${esc(l.label)}</tspan><tspan fill="${C.mute}">  ${esc(l.detail)}</tspan></text>`
      + `<text x="${W - PAD}" y="${y + 12}" font-size="13" font-weight="600" fill="${C.ink}" text-anchor="end">${tn('count.boca', l.total)}</text>`;
    y += ROW;
  }
  if (otherTxt) { g += `<text x="${PAD + 22}" y="${y + 12}" font-size="13" fill="${C.mute}">${esc(otherTxt)}</text>`; y += ROW; }
  g += `<line x1="${PAD}" y1="${y + 2}" x2="${W - PAD}" y2="${y + 2}" stroke="${C.mute}" stroke-width=".6"/>`
    + `<text x="${PAD + 22}" y="${y + 20}" font-size="13" font-weight="700" fill="${C.ink}">${t('legend.total')}</text>`
    + `<text x="${W - PAD}" y="${y + 20}" font-size="13" font-weight="700" fill="${C.ink}" text-anchor="end">${tn('count.boca', sum.total)}</text>`;

  const w = Math.ceil(W), h = Math.ceil(H + 8);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`
    + `<rect width="${w}" height="${h}" fill="${C.bg}"/>${g}</svg>`;
  return { svg, w, h };
}

/* ---------- descargas ---------- */
export function slug(name) {
  return (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plano';
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const fileBase = () => slug(getPlan().name);

export function exportSvg() {
  download(new Blob([buildSvg().svg], { type: 'image/svg+xml' }), `${fileBase()}.svg`);
}

export function exportPng() {
  const { svg, w, h } = buildSvg();
  const scale = Math.min(2, 4096 / Math.max(w, h));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob(b => b && download(b, `${fileBase()}.png`), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Impresión / PDF: el CSS de impresión muestra solo #printArea.
export function printPlan() {
  const area = document.getElementById('printArea');
  area.innerHTML = buildSvg().svg;
  const prevTitle = document.title;
  document.title = getPlan().name || prevTitle;   // sugiere el nombre del archivo PDF
  const clean = () => { area.innerHTML = ''; document.title = prevTitle; removeEventListener('afterprint', clean); };
  addEventListener('afterprint', clean);
  window.print();
}

export function exportJson() {
  download(new Blob([JSON.stringify(getPlan(), null, 2)], { type: 'application/json' }), `${fileBase()}.json`);
}

// Lee un archivo .json elegido por el usuario; devuelve el plano normalizado o null.
export async function readPlanFile(file) {
  try { return normalize(JSON.parse(await file.text())); } catch (e) { return null; }
}
