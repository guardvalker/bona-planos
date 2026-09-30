import { applyStatic } from './i18n.js';
import { subscribe, setPlan, getPlan, newPlan } from './state.js';
import { initCanvas } from './canvas.js';
import { handlers } from './tools.js';
import { initUI, render } from './ui.js';
import { loadDraft, saveDraft } from './storage.js';

applyStatic();
initCanvas(handlers);
initUI();

let timer = null;
subscribe(kind => {
  render(kind);
  if (kind === 'data' || kind === 'soft') {
    clearTimeout(timer);
    timer = setTimeout(() => saveDraft(getPlan()), 400);
  }
});

setPlan(loadDraft() || newPlan());
