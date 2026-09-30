// Diálogos compartidos.
const $ = s => document.querySelector(s);

// Pide un texto (reemplaza a prompt()). Resuelve con el texto o null si se cancela.
export function askText(title, value) {
  return new Promise(resolve => {
    const box = $('#ask'), input = $('#aInput'), form = box.querySelector('form');
    $('#aTitle').textContent = title;
    input.value = value;
    box.classList.add('show');
    input.focus(); input.select();
    const done = v => {
      box.classList.remove('show');
      form.onsubmit = null; $('#aCancel').onclick = null; box.onkeydown = null;
      resolve(v);
    };
    form.onsubmit = e => { e.preventDefault(); done(input.value.trim()); };
    $('#aCancel').onclick = () => done(null);
    box.onkeydown = e => { if (e.key === 'Escape') done(null); };
  });
}
