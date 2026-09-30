import { t } from './i18n.js';

// Registro de símbolos: una tabla de datos. Para agregar uno nuevo:
//   1. sumá una entrada acá con `circuit` (¿se asigna a un circuito?) y `draw`;
//   2. sumá sus textos en i18n.js (sym.<tipo>.btn / .name / .put).
// La barra, el conteo de la leyenda, el hit-test y las exportaciones lo toman de acá.
// `draw(x, y, col)` devuelve markup SVG centrado en (x, y); `col` es el color del circuito.
export const SYMBOLS = {
  toma: {
    circuit: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="9" fill="${col}"/>` +
      `<path d="M${x - 3} ${y - 4}v4M${x + 3} ${y - 4}v4M${x} ${y + 2}v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`
  },
  luz: {
    circuit: true,
    draw: (x, y, col) =>
      `<circle cx="${x}" cy="${y}" r="9" fill="var(--room)" stroke="${col}" stroke-width="2.4"/>` +
      `<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`
  },
  llave: {
    circuit: true,
    draw: (x, y, col) =>
      `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" fill="${col}"/>` +
      `<path d="M${x - 3} ${y + 3}L${x + 3} ${y - 3}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`
  },
  tablero: {
    circuit: false,
    draw: (x, y) =>
      `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="3" fill="#1d2b38" stroke="#fff" stroke-width="1"/>` +
      `<text x="${x}" y="${y + 4}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${t('sym.tablero.abbr')}</text>`
  }
};

export const SYMBOL_TYPES = Object.keys(SYMBOLS);
