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

// Simbología al estilo de los planos IRAM/IEC: trazo grueso del color del circuito sobre fondo del plano,
// para que se lea chico y en la barra. Los dibujos con "pata" (tomas, llave) se orientan con la rotación.
const stroke = (col, w = 2.4) => `stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const ring = (x, y, r, col) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--room)" ${stroke(col)}/>`;

// `hidden`: ya no se ofrece en la barra pero se sigue dibujando (planos viejos).
// `group`: se elige desde el submenú de ese grupo, no directo de la barra.
export const SYMBOLS = {
  // Tomacorriente: círculo con las tres patas.
  toma: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      ring(x, y, 11, col) +
      `<path d="M${x - 4.5} ${y - 6}v5M${x + 4.5} ${y - 6}v5M${x} ${y + 2}v6" ${stroke(col, 2.6)} fill="none"/>`
  },
  // Boca de luz en techo: círculo con cruz.
  luz: {
    circuit: true, boca: true,
    draw: (x, y, col) => ring(x, y, 10, col) + `<path d="M${x - 7} ${y - 7}L${x + 7} ${y + 7}M${x + 7} ${y - 7}L${x - 7} ${y + 7}" ${stroke(col, 2.6)} fill="none"/>`
  },
  // Termomagnética: contacto con cruz, cuchilla y bornes (símbolo de interruptor automático).
  termica: {
    circuit: true, boca: false,
    draw: (x, y, col) =>
      `<rect x="${x - 8}" y="${y - 12}" width="16" height="24" rx="2" fill="${col}"/>` +
      `<path d="M${x} ${y - 10}v5M${x} ${y + 10}v-5M${x} ${y - 5}l5 10M${x - 3.5} ${y - 8.5}l7 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`
  },
  // Llave (interruptor de un punto): círculo lleno con raya oblicua y trazo.
  llave: {
    circuit: true, boca: true,
    draw: (x, y, col) =>
      `<circle cx="${x - 4}" cy="${y + 5}" r="4.5" fill="${col}"/>` +
      `<path d="M${x - 1} ${y + 2}L${x + 8} ${y - 9}M${x + 4} ${y - 10}l7 5" ${stroke(col, 2.6)} fill="none"/>`
  },
  // Tablero principal: rectángulo lleno con la sigla.
  tablero: {
    circuit: false, boca: false, group: 'tablero',
    draw: (x, y) =>
      `<rect x="${x - 14}" y="${y - 11}" width="28" height="22" rx="2" fill="var(--wall)"/>${txt(x, y, t('sym.tablero.abbr'), 12, 'var(--room)')}`
  },
  // Tablero seccional: rectángulo vacío con la sigla.
  tableroseccional: {
    circuit: false, boca: false, group: 'tablero',
    draw: (x, y) =>
      `<rect x="${x - 14}" y="${y - 11}" width="28" height="22" rx="2" fill="var(--room)" stroke="var(--wall)" stroke-width="2.6"/>${txt(x, y, t('sym.tableroseccional.abbr'), 12, 'var(--wall)')}`
  },

  /* ---- ya no se ofrecen en la barra; los planos que los tienen los siguen mostrando ---- */
  tomadoble: {
    circuit: true, boca: true, hidden: true,
    draw: (x, y, col) => ring(x, y, 8, col) + `<path d="M${x} ${y - 8}v-6M${x} ${y + 8}v6" ${stroke(col, 2.8)} fill="none"/><circle cx="${x}" cy="${y}" r="2.6" fill="${col}"/>`
  },
  tomaaa: {
    circuit: true, boca: true, hidden: true,
    draw: (x, y, col) => `<circle cx="${x}" cy="${y + 2}" r="10" fill="${col}"/><path d="M${x} ${y - 8}v-6" ${stroke(col, 2.8)} fill="none"/>${txt(x, y + 2, t('sym.tomaaa.abbr'), 9)}`
  },
  tv: {
    circuit: true, boca: true, hidden: true,
    draw: (x, y, col) => `<rect x="${x - 12}" y="${y - 8}" width="24" height="16" rx="3" fill="${col}"/>${txt(x, y, t('sym.tv.abbr'), 10)}`
  },
  timbre: {
    circuit: true, boca: true, hidden: true,
    draw: (x, y, col) =>
      ring(x, y, 11, col) +
      `<path d="M${x - 6} ${y + 4}h12M${x - 4.5} ${y + 4}q0 -9 4.5 -9q4.5 0 4.5 9" ${stroke(col, 2)} fill="none"/>` +
      `<circle cx="${x}" cy="${y + 7.5}" r="1.8" fill="${col}"/>`
  }
};

export const SYMBOL_TYPES = Object.keys(SYMBOLS);
export const BAR_TYPES = SYMBOL_TYPES.filter(k => !SYMBOLS[k].hidden && !SYMBOLS[k].group);
export const GROUPS = { tablero: SYMBOL_TYPES.filter(k => SYMBOLS[k].group === 'tablero') };

// Símbolo con su rotación (múltiplos de 90°). La etiqueta y el aro de selección no rotan.
export function drawSymbol(it, col) {
  const m = SYMBOLS[it.type].draw(it.x, it.y, col);
  return it.rot ? `<g transform="rotate(${it.rot} ${it.x} ${it.y})">${m}</g>` : m;
}

// Ícono para la barra: el mismo dibujo del registro, centrado en 0,0.
export const symbolIcon = (type, col = 'currentColor') =>
  `<svg viewBox="-16 -14 32 28" width="28" height="24" aria-hidden="true" focusable="false">${SYMBOLS[type].draw(0, 0, col).replaceAll('#fff', 'var(--sym-in)').replaceAll('var(--room)', 'var(--sym-in)').replaceAll('var(--wall)', 'currentColor')}</svg>`;
