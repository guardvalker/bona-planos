// Exportaciones: SVG autónomo (plano + leyenda + resumen), PNG, impresión/PDF y JSON.
// El SVG usa colores fijos de tema claro: sale igual aunque la app esté en oscuro.
import { getPlan, summarize, describeRow, techText, normalize, U, polyInfo, bbox, isRect } from './state.js';
import { SYMBOLS, drawSymbol } from './symbols.js';
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
  plan.rooms.forEach(r => r.pts.forEach(q => ext(q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2)));
  plan.walls.forEach(w => w.pts.forEach(q => ext(q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3)));
  plan.zones.forEach(z => ext(z.x - 3, z.y - 20, z.x + z.w + 3, z.y + z.h + 3));
  plan.items.forEach(i => { const k = i.s || 1; ext(i.x - 16 * k, i.y - 16 * k, i.x + 16 * k, i.y + 28 * k); });
  plan.cables.forEach(cb => cb.pts.forEach(q => ext(q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4)));
  plan.labels.forEach(l => {
    const k = l.s || 1, along = l.text.length * 3.8 * k + 6, across = 10 * k;      // semilargo y semialto aproximados del texto
    const v = l.rot === 90 || l.rot === 270;
    ext(l.x - (v ? across : along), l.y - (v ? along : across), l.x + (v ? across : along), l.y + (v ? along : across));
  });
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 320; y1 = 200; }
  const pw = x1 - x0, ph = y1 - y0;

  // líneas de la leyenda
  const lines = sum.rows.map(r => ({ color: r.color, label: cName(r.n, r.name), detail: describeRow(r), total: r.total, tech: techText(plan.circuits[r.n - 1]) }));
  if (sum.orphan) lines.push({ color: C.none, label: t('legend.unassigned'), detail: describeRow(sum.orphan), total: sum.orphan.total, tech: '' });
  const otherTxt = [...Object.entries(sum.other).map(([k, n]) => tn(`count.${k}`, n)), ...(sum.cableTotal > 0 ? [t('legend.cableTotal', { m: fmtNum(sum.cableTotal) })] : [])].join(' · ');
  const longest = Math.max(...lines.map(l => Math.max((l.label + l.detail).length + 14, l.tech.length * 0.85 + 4)), 40);
  const W = Math.max(pw + PAD * 2, longest * 7.4 + PAD * 2 + 30, 420);

  const py = HEAD + PAD;
  let legendY = py + ph + PAD + 8;
  const legendH = 30 + lines.reduce((a, l) => a + ROW + (l.tech ? 16 : 0), 0) + (otherTxt ? ROW : 0) + ROW + PAD;
  const H = legendY + legendH;

  let g = '';
  // plano
  g += `<g transform="translate(${(W - pw) / 2 - x0} ${py - y0})">`;
  for (const r of plan.rooms) {
    const info = polyInfo(r.pts), b = bbox(r.pts);
    const size = isRect(r.pts) ? `${fmtNum(b.w / U)} × ${fmtNum(b.h / U)} m` : `${fmtNum(Math.round(info.area / (U * U) * 10) / 10)} m²`;
    g += `<polygon points="${r.pts.map(q => q.join(',')).join(' ')}" fill="${C.room}" stroke="${C.wall}" stroke-width="3" stroke-linejoin="round"/>`
      + `<text x="${info.cx}" y="${info.cy - 2}" font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle">${esc(r.name)}</text>`
      + `<text x="${info.cx}" y="${info.cy + 12}" font-size="10" fill="${C.mute}" text-anchor="middle">${size}</text>`;
  }
  for (const w of plan.walls) {
    g += `<polyline points="${w.pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${C.wall}" stroke-width="4" stroke-linecap="square"/>`;
  }
  for (const z of plan.zones) {
    g += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${z.color}" fill-opacity=".1" stroke="${z.color}" stroke-width="3" stroke-dasharray="10 6"/>`
      + (z.name ? `<text x="${z.x + 6}" y="${z.y + (z.w < 60 || z.h < 30 ? -6 : 15)}" font-size="12" font-weight="700" fill="${z.color}">${esc(z.name)}</text>` : '');
  }
  for (const cb of plan.cables) {
    const c = plan.circuits.find(c => c.id === cb.c), col = c ? c.color : C.none;
    const pts = cb.pts.map(q => q.join(',')).join(' ');
    const op = 1 - ((c && c.fade) || 0);
    g += `<g${op < 1 ? ` opacity="${op}"` : ''}><polyline points="${pts}" fill="none" stroke="${C.room}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`
      + `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="3.5" stroke-dasharray="9 5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  for (const it of plan.items) {
    const sym = SYMBOLS[it.type];
    if (!sym) continue;
    const c = plan.circuits.find(c => c.id === it.c);
    const col = c ? c.color : C.none;
    g += drawSymbol(it, col).replaceAll('var(--room)', C.room).replaceAll('var(--wall)', C.wall);
    if (sym.circuit && c) {
      const k = it.s || 1;
      g += `<text x="${it.x}" y="${it.y + 22 * k}" font-size="${Math.max(7, 10 * k)}" font-weight="700" fill="${C.ink}" text-anchor="middle">${t('circuit.short', { n: plan.circuits.indexOf(c) + 1 })}</text>`;
    }
  }
  for (const l of plan.labels) {
    const k = l.s || 1;
    g += `<text x="${l.x}" y="${l.y + 4.5 * k}" font-size="${13 * k}" font-weight="600" fill="${C.ink}" text-anchor="middle"${l.rot ? ` transform="rotate(${l.rot} ${l.x} ${l.y})"` : ''}>${esc(l.text)}</text>`;
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
      + `<text x="${PAD + 22}" y="${y + 12}" font-size="13" fill="${C.ink}"><tspan font-weight="600">${esc(l.label)}</tspan><tspan fill="${C.mute}" dx="8">${esc(l.detail)}</tspan></text>`
      + `<text x="${W - PAD}" y="${y + 12}" font-size="13" font-weight="600" fill="${C.ink}" text-anchor="end">${tn('count.boca', l.total)}</text>`;
    if (l.tech) g += `<text x="${PAD + 22}" y="${y + 28}" font-size="11" fill="${C.mute}">${esc(l.tech)}</text>`;
    y += ROW + (l.tech ? 16 : 0);
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
