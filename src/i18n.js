// Todos los textos de la interfaz viven acá. Para agregar un idioma, sumá un
// objeto más a STR con las mismas claves. Los `{x}` se reemplazan con t(clave, {x}).
const STR = {
  es: {
    'app.name': 'Planos',
    'app.title': 'Plano eléctrico rápido',

    'nav.back': 'Planos',
    'nav.backAria': 'Volver a la lista de planos',
    'plan.name': 'Nombre del plano',
    'plan.default': 'Plano {n}',
    'plan.unnamed': 'Sin nombre',
    'plan.copySuffix': ' (copia)',
    'plan.rename': 'Renombrar',
    'plan.duplicate': 'Duplicar',
    'plan.delete': 'Borrar',
    'plan.deleteConfirm': '¿Borrar «{name}»? No se puede deshacer.',
    'plan.renameTitle': 'Nombre del plano',
    'home.title': 'Mis planos',
    'home.new': 'Nuevo plano',
    'home.empty': 'Todavía no tenés planos. Creá el primero.',
    'home.list': 'Planos guardados',
    'home.notPersistent': 'Este navegador no permite guardar planos: se pierden al cerrar la app.',
    'count.room.one': '{n} ambiente',
    'count.room.other': '{n} ambientes',
    'count.item.one': '{n} elemento',
    'count.item.other': '{n} elementos',

    'bar.export': 'Exportar',
    'exp.title': 'Exportar plano',
    'exp.help': 'El plano sale con la leyenda de circuitos y el resumen de bocas.',
    'exp.png': 'Imagen (PNG)',
    'exp.svg': 'Vectorial (SVG)',
    'exp.print': 'Imprimir / PDF',
    'data.download': 'Descargar .json',
    'data.file': 'Cargar archivo…',
    'home.import': 'Importar',
    'import.error': 'No se pudo leer el archivo. Tiene que ser un plano en formato JSON.',
    'legend.title': 'Leyenda y resumen',
    'legend.unassigned': 'Sin circuito',
    'legend.total': 'Total',
    'count.toma.one': '{n} toma',
    'count.toma.other': '{n} tomas',
    'count.luz.one': '{n} luz',
    'count.luz.other': '{n} luces',
    'count.llave.one': '{n} llave',
    'count.llave.other': '{n} llaves',
    'count.tablero.one': '{n} tablero',
    'count.tablero.other': '{n} tableros',
    'count.boca.one': '{n} boca',
    'count.boca.other': '{n} bocas',
    'ask.ok': 'Aceptar',
    'ask.cancel': 'Cancelar',

    'tool.select': 'Mover',
    'tool.room': 'Ambiente',
    'sym.toma.btn': 'Toma',
    'sym.toma.name': 'toma',
    'sym.toma.put': 'poner una toma',
    'sym.luz.btn': 'Luz',
    'sym.luz.name': 'punto de luz',
    'sym.luz.put': 'poner un punto de luz',
    'sym.llave.btn': 'Llave',
    'sym.llave.name': 'llave',
    'sym.llave.put': 'poner una llave',
    'sym.tablero.btn': 'Tablero',
    'sym.tablero.name': 'tablero',
    'sym.tablero.put': 'ubicar el tablero',
    'sym.tablero.abbr': 'TP',

    'bar.label': 'Herramientas',
    'bar.undo': 'Deshacer',
    'bar.redo': 'Rehacer',
    'bar.data': 'Guardar / cargar',
    'bar.clear': 'Vaciar',

    'hint.select': 'Arrastrá para mover. Tocá el fondo y arrastrá para desplazar el plano. Dos dedos para zoom.',
    'hint.room': 'Arrastrá sobre el plano para dibujar un ambiente.',
    'hint.place': 'Tocá el plano para {put}',
    'hint.inCircuit': ' en {circuit}.',

    'canvas.label': 'Plano',
    'zoom.in': 'Acercar',
    'zoom.out': 'Alejar',

    'circuit.short': 'C{n}',
    'circuit.none': 'sin circuito',
    'circuit.list': 'Circuitos',
    'circuit.edit': 'Editar circuitos',
    'circuit.add': 'Agregar circuito',
    'circuit.default': 'Circuito {n}',
    'circuit.color': 'Color del circuito {n}',
    'circuit.name': 'Nombre del circuito {n}',
    'circuit.del': 'Borrar circuito {n}',
    'circuit.delConfirm': 'Este circuito tiene {n} elementos. Si lo borrás quedan sin circuito. ¿Borrar igual?',
    'circuit.lighting': 'Iluminación',
    'circuit.sockets': 'Tomas',
    'circuit.kitchen': 'Cocina',
    'circuit.ac': 'Aire acond.',

    'room.default': 'Ambiente {n}',
    'room.label': 'Ambiente',
    'room.name': 'Nombre del ambiente',
    'sel.none': 'Tocá un elemento para editarlo. Con la herramienta de colocar, cada uno se asigna al circuito activo.',
    'sel.item': '{name} en {circuit}',
    'sel.reassign': ' — tocá otro circuito para cambiarlo',
    'sel.delete': 'Borrar',

    'clear.confirm': '¿Vaciar el plano? Se borran todos los ambientes y elementos (se puede deshacer).',

    'data.title': 'Guardar / cargar plano',
    'data.help': 'Copiá este texto para guardar el plano donde quieras. Para cargar uno, pegalo acá y tocá Cargar.',
    'data.copy': 'Copiar',
    'data.load': 'Cargar',
    'data.close': 'Cerrar',
    'data.copied': 'Copiado.',
    'data.selected': 'Seleccionado: copialo con el menú del teléfono.',
    'data.error': 'No se pudo leer ese texto. Revisá que esté completo.'
  },
  en: {
    'app.name': 'Plans',
    'app.title': 'Quick electrical plan',

    'nav.back': 'Plans',
    'nav.backAria': 'Back to the plan list',
    'plan.name': 'Plan name',
    'plan.default': 'Plan {n}',
    'plan.unnamed': 'Untitled',
    'plan.copySuffix': ' (copy)',
    'plan.rename': 'Rename',
    'plan.duplicate': 'Duplicate',
    'plan.delete': 'Delete',
    'plan.deleteConfirm': 'Delete «{name}»? This cannot be undone.',
    'plan.renameTitle': 'Plan name',
    'home.title': 'My plans',
    'home.new': 'New plan',
    'home.empty': 'You have no plans yet. Create the first one.',
    'home.list': 'Saved plans',
    'home.notPersistent': 'This browser cannot save plans: they are lost when the app closes.',
    'count.room.one': '{n} room',
    'count.room.other': '{n} rooms',
    'count.item.one': '{n} item',
    'count.item.other': '{n} items',

    'bar.export': 'Export',
    'exp.title': 'Export plan',
    'exp.help': 'The plan includes the circuit legend and the outlet summary.',
    'exp.png': 'Image (PNG)',
    'exp.svg': 'Vector (SVG)',
    'exp.print': 'Print / PDF',
    'data.download': 'Download .json',
    'data.file': 'Load file…',
    'home.import': 'Import',
    'import.error': 'Could not read the file. It must be a plan in JSON format.',
    'legend.title': 'Legend and summary',
    'legend.unassigned': 'No circuit',
    'legend.total': 'Total',
    'count.toma.one': '{n} outlet',
    'count.toma.other': '{n} outlets',
    'count.luz.one': '{n} light',
    'count.luz.other': '{n} lights',
    'count.llave.one': '{n} switch',
    'count.llave.other': '{n} switches',
    'count.tablero.one': '{n} panel',
    'count.tablero.other': '{n} panels',
    'count.boca.one': '{n} point',
    'count.boca.other': '{n} points',
    'ask.ok': 'OK',
    'ask.cancel': 'Cancel',

    'tool.select': 'Move',
    'tool.room': 'Room',
    'sym.toma.btn': 'Outlet',
    'sym.toma.name': 'outlet',
    'sym.toma.put': 'place an outlet',
    'sym.luz.btn': 'Light',
    'sym.luz.name': 'light point',
    'sym.luz.put': 'place a light point',
    'sym.llave.btn': 'Switch',
    'sym.llave.name': 'switch',
    'sym.llave.put': 'place a switch',
    'sym.tablero.btn': 'Panel',
    'sym.tablero.name': 'panel',
    'sym.tablero.put': 'place the panel',
    'sym.tablero.abbr': 'MP',

    'bar.label': 'Tools',
    'bar.undo': 'Undo',
    'bar.redo': 'Redo',
    'bar.data': 'Save / load',
    'bar.clear': 'Clear',

    'hint.select': 'Drag to move. Drag the background to pan. Two fingers to zoom.',
    'hint.room': 'Drag on the plan to draw a room.',
    'hint.place': 'Tap the plan to {put}',
    'hint.inCircuit': ' in {circuit}.',

    'canvas.label': 'Plan',
    'zoom.in': 'Zoom in',
    'zoom.out': 'Zoom out',

    'circuit.short': 'C{n}',
    'circuit.none': 'no circuit',
    'circuit.list': 'Circuits',
    'circuit.edit': 'Edit circuits',
    'circuit.add': 'Add circuit',
    'circuit.default': 'Circuit {n}',
    'circuit.color': 'Color of circuit {n}',
    'circuit.name': 'Name of circuit {n}',
    'circuit.del': 'Delete circuit {n}',
    'circuit.delConfirm': 'This circuit has {n} items. If you delete it they will have no circuit. Delete anyway?',
    'circuit.lighting': 'Lighting',
    'circuit.sockets': 'Outlets',
    'circuit.kitchen': 'Kitchen',
    'circuit.ac': 'A/C',

    'room.default': 'Room {n}',
    'room.label': 'Room',
    'room.name': 'Room name',
    'sel.none': 'Tap an item to edit it. With a placing tool, each new item goes to the active circuit.',
    'sel.item': '{name} in {circuit}',
    'sel.reassign': ' — tap another circuit to change it',
    'sel.delete': 'Delete',

    'clear.confirm': 'Clear the plan? All rooms and items are removed (you can undo).',

    'data.title': 'Save / load plan',
    'data.help': 'Copy this text to keep the plan anywhere. To load one, paste it here and tap Load.',
    'data.copy': 'Copy',
    'data.load': 'Load',
    'data.close': 'Close',
    'data.copied': 'Copied.',
    'data.selected': 'Selected: copy it with your phone menu.',
    'data.error': 'Could not read that text. Check that it is complete.'
  }
};

export const lang = (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';

export function t(key, params) {
  let s = (STR[lang] && STR[lang][key]) ?? STR.es[key] ?? key;
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', params[k]);
  return s;
}

// Plural simple: usa la clave `<key>.one` si n === 1 y `<key>.other` en el resto.
export const tn = (key, n) => t(`${key}.${n === 1 ? 'one' : 'other'}`, { n });

// Números con el separador decimal del idioma, sin ceros de más (4,5 — 10).
export const fmtNum = n => (+n.toFixed(2)).toLocaleString(lang === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 2 });

// Traduce el HTML estático: data-i18n (texto), data-i18n-aria, data-i18n-title.
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('app.title');
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}
