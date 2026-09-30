import { t } from './i18n.js';

// Registro de símbolos: una tabla de datos. Para agregar uno nuevo:
//   1. sumá una entrada acá con `circuit` (¿se asigna a un circuito?), `boca` (¿cuenta
//      como boca en el resumen?) y `draw`;
//   2. sumá sus textos en i18n.js: sym.<tipo>.btn / .name / .put y count.<tipo>.one / .other
//      (más sym.<tipo>.abbr si el dibujo lleva texto).
// La barra, el resumen, el hit-test y las exportaciones lo toman de acá.
// `draw(x, y, col)` devuelve markup SVG centrado en (x, y); `col` es el color del circuito.
const txt = (x, y, s, size = 8, fill = '#fff') =>
  `<text x="${x}" y="${y + size * 0.36}" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="middle">${s}</text>`;
const prongs = (x, y) => `M${x - 3} ${y - 4}v4M${x + 3} ${y - 4}v4M${x} ${y + 2}v4`;

export const SYMBOLS = {
  toma: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="9" fill="${col}"/>` +
      `<path d="${prongs(x, y)}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`
  },
  tomadoble: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<rect x="${x - 14}" y="${y - 9}" width="28" height="18" rx="9" fill="${col}"/>` +
      `<path d="${prongs(x - 6, y)}${prongs(x + 6, y)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>`
  },
  tomaaa: {
    circuit: true, boca: true,
    draw: (x, y, col) => `<circle cx="${x}" cy="${y}" r="9" fill="${col}"/>${txt(x, y, t('sym.tomaaa.abbr'))}`
  },
  tv: {
    circuit: true, boca: true,
    draw: (x, y, col) => `<rect x="${x - 10}" y="${y - 7}" width="20" height="14" rx="3" fill="${col}"/>${txt(x, y, t('sym.tv.abbr'))}`
  },
  luz: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="9" fill="var(--room)" stroke="${col}" stroke-width="2.4"/>` +
      `<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`
  },
  ventilador: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="10" fill="var(--room)" stroke="${col}" stroke-width="2"/>` +
      [0, 90, 180, 270].map(a => `<ellipse cx="${x}" cy="${y - 5}" rx="2.6" ry="4.4" fill="${col}" transform="rotate(${a} ${x} ${y})"/>`).join('')
  },
  llave: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" fill="${col}"/>` +
      `<path d="M${x - 3} ${y + 3}L${x + 3} ${y - 3}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`
  },
  timbre: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="10" fill="var(--room)" stroke="${col}" stroke-width="2"/>` +
      `<path d="M${x - 5} ${y + 3}h10M${x - 4} ${y + 3}q0 -8 4 -8q4 0 4 8" stroke="${col}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${x}" cy="${y + 6}" r="1.5" fill="${col}"/>`
  },
  tablero: {
    circuit: false, boca: false,
    draw: (x, y) =>
      `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="3" fill="#1d2b38" stroke="#fff" stroke-width="1"/>${txt(x, y, t('sym.tablero.abbr'), 11)}`
  },
  // Termomagnética: se ubica junto al tablero y se asigna al circuito que protege.
  termica: {
    circuit: true, boca: false,
    draw: (x, y, col) =>
      `<rect x="${x - 6}" y="${y - 9}" width="12" height="18" rx="2" fill="${col}"/>` +
      `<rect x="${x - 3}" y="${y - 6}" width="6" height="6" rx="1" fill="#fff"/>` +
      `<path d="M${x - 3} ${y + 4}h6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
  }
};

export const SYMBOL_TYPES = Object.keys(SYMBOLS);

// Símbolo con su rotación (múltiplos de 90°). La etiqueta y el aro de selección no rotan.
export function drawSymbol(it, col) {
  const m = SYMBOLS[it.type].draw(it.x, it.y, col);
  return it.rot ? `<g transform="rotate(${it.rot} ${it.x} ${it.y})">${m}</g>` : m;
}

// Ícono para la barra: el mismo dibujo del registro, centrado en 0,0.
export const symbolIcon = (type, col = 'currentColor') =>
  `<svg viewBox="-16 -14 32 28" width="28" height="24" aria-hidden="true" focusable="false">${SYMBOLS[type].draw(0, 0, col)}</svg>`;
