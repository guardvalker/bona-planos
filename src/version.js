// Subir APP_VERSION y agregar una entrada en CHANGELOG (claves de i18n.js) en cada cambio publicado.
// También subir CACHE_NAME en sw.js: si no, las instalaciones existentes no ven el cambio.
export const APP_VERSION = '1.8.4';
export const CHANGELOG = [
  { v: '1.8.4', date: '2026-10-20', items: ['cl.1_8_4'] },
  { v: '1.8.3', date: '2026-10-20', items: ['cl.1_8_3'] },
  { v: '1.8.2', date: '2026-10-20', items: ['cl.1_8_2'] },
  { v: '1.8.1', date: '2026-10-20', items: ['cl.1_8_1'] },
  { v: '1.8.0', date: '2026-10-20', items: ['cl.1_8_0'] },
  { v: '1.7.2', date: '2026-10-19', items: ['cl.1_7_2'] },
  { v: '1.7.1', date: '2026-10-19', items: ['cl.1_7_1'] },
  { v: '1.7.0', date: '2026-10-19', items: ['cl.1_7_0'] },
  { v: '1.6.0', date: '2026-10-19', items: ['cl.1_6_0'] },
  { v: '1.5.0', date: '2026-10-19', items: ['cl.1_5_0'] },
  { v: '1.4.1', date: '2026-10-19', items: ['cl.1_4_1'] },
  { v: '1.4.0', date: '2026-10-19', items: ['cl.1_4_0'] },
  { v: '1.3.4', date: '2026-10-01', items: ['cl.1_3_4'] },
  { v: '1.3.3', date: '2026-10-01', items: ['cl.1_3_3'] },
  { v: '1.3.2', date: '2026-10-01', items: ['cl.1_3_2'] },
  { v: '1.3.1', date: '2026-09-30', items: ['cl.1_3_1'] },
  { v: '1.3.0', date: '2026-09-30', items: ['cl.1_3_0'] },
  { v: '1.2.0', date: '2026-09-29', items: ['cl.1_2_0'] },
  { v: '1.1.0', date: '2026-09-29', items: ['cl.1_1_0.a', 'cl.1_1_0.b', 'cl.1_1_0.c', 'cl.1_1_0.d'] },
  { v: '1.0.1', date: '2026-09-29', items: ['cl.1_0_1'] },
  { v: '1.0.0', date: '2026-09-29', items: ['cl.1_0_0.a', 'cl.1_0_0.b', 'cl.1_0_0.c', 'cl.1_0_0.d'] }
];
