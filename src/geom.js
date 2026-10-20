// Unión de dos ambientes de lados rectos (horizontales/verticales).
// Se arma una grilla con las coordenadas de ambos polígonos, se marcan las celdas que cubre
// alguno y se recorre el borde del conjunto. Devuelve { pts } o { error: clave i18n }.
import { inPoly } from './state.js';

const straight = pts => pts.every((q, i) => { const n = pts[(i + 1) % pts.length]; return q[0] === n[0] || q[1] === n[1]; });
const uniq = a => [...new Set(a)].sort((p, q) => p - q);

export function unionRooms(a, b) {
  if (!straight(a) || !straight(b)) return { error: 'merge.errDiag' };
  const xs = uniq([...a, ...b].map(q => q[0])), ys = uniq([...a, ...b].map(q => q[1]));
  const nx = xs.length - 1, ny = ys.length - 1;
  const fill = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (_, j) => {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return inPoly(cx, cy, a) || inPoly(cx, cy, b);
  }));
  const on = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && fill[i][j];

  // las celdas tienen que formar una sola pieza (comparten pared, no solo una esquina)
  const cells = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (fill[i][j]) cells.push([i, j]);
  if (!cells.length) return { error: 'merge.errApart' };
  const seen = new Set([cells[0].join()]), stack = [cells[0]];
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = [i + di, j + dj];
      if (on(k[0], k[1]) && !seen.has(k.join())) { seen.add(k.join()); stack.push(k); }
    }
  }
  if (seen.size !== cells.length) return { error: 'merge.errApart' };

  // aristas del borde, en sentido horario en pantalla
  const edges = new Map();
  const add = (x0, y0, x1, y1) => { const k = x0 + ',' + y0; (edges.get(k) || edges.set(k, []).get(k)).push([x1, y1]); };
  for (const [i, j] of cells) {
    if (!on(i, j - 1)) add(xs[i], ys[j], xs[i + 1], ys[j]);
    if (!on(i + 1, j)) add(xs[i + 1], ys[j], xs[i + 1], ys[j + 1]);
    if (!on(i, j + 1)) add(xs[i + 1], ys[j + 1], xs[i], ys[j + 1]);
    if (!on(i - 1, j)) add(xs[i], ys[j + 1], xs[i], ys[j]);
  }
  const total = [...edges.values()].reduce((s, l) => s + l.length, 0);
  const start = [...edges.keys()][0].split(',').map(Number);
  let cur = start, loop = [], n = 0;
  do {
    loop.push(cur); n++;
    const list = edges.get(cur.join(','));
    if (!list || !list.length) return { error: 'merge.errHole' };
    cur = list.shift();
  } while (cur[0] !== start[0] || cur[1] !== start[1]);
  if (n !== total) return { error: 'merge.errHole' };      // quedó un hueco o una pieza suelta

  // sacar los puntos intermedios de tramos rectos
  const pts = loop.filter((q, i) => {
    const p = loop[(i + loop.length - 1) % loop.length], nx2 = loop[(i + 1) % loop.length];
    return !((p[0] === q[0] && q[0] === nx2[0]) || (p[1] === q[1] && q[1] === nx2[1]));
  });
  return pts.length >= 3 ? { pts } : { error: 'merge.errApart' };
}
