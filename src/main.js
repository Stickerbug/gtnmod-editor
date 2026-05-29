import * as Blockly from 'blockly';
import * as ZhHans from 'blockly/msg/zh-hans';
import './blocks/index.js';
import './generator.js';
import { toolboxForKind } from './toolbox.js';
import { studio } from './app.js';

Blockly.setLocale(ZhHans);

const workspace = Blockly.inject('blockly-area', {
  toolbox: toolboxForKind('cards'),
  renderer: 'zelos',
  theme: Blockly.Theme.defineTheme('gardenLight', {
    base: Blockly.Themes.Classic,
    fontStyle: {
      family: '"Segoe UI", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      weight: '600',
      size: 11,
    },
    componentStyles: {
      workspaceBackgroundColour: '#f7f9fc',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#18202b',
      flyoutBackgroundColour: '#ffffff',
      flyoutForegroundColour: '#18202b',
      flyoutOpacity: 1,
      scrollbarColour: '#b8c5d6',
      insertionMarkerColour: '#2078f2',
      insertionMarkerOpacity: 0.35,
    },
  }),
  grid: { spacing: 24, length: 3, colour: '#dde6f2', snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2.4, minScale: 0.35, scaleSpeed: 1.15 },
  trashcan: true,
  move: { scrollbars: true, drag: true, wheel: true },
  sounds: false,
});

studio.init(workspace);
window.gardenModStudio = studio;

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => studio.selectKind(btn.dataset.kind));
});

document.getElementById('btn-add').onclick = () => studio.addEntity();
document.getElementById('btn-dup').onclick = () => studio.duplicateEntity();
document.getElementById('btn-del').onclick = () => studio.deleteEntity();
document.getElementById('btn-new').onclick = () => studio.reset();

const fileInput = document.getElementById('file-input');
document.getElementById('btn-open').onclick = () => fileInput.click();
fileInput.onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  studio.importJson(text);
  fileInput.value = '';
};

document.getElementById('btn-save').onclick = () => {
  const json = studio.exportJson();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${studio.model.info.name || 'mod'}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('btn-copy-json').onclick = async () => {
  await navigator.clipboard.writeText(studio.exportJson());
};

document.querySelectorAll('[data-collapse]').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = document.getElementById(btn.dataset.collapse);
    panel.classList.toggle('collapsed');
    setTimeout(() => Blockly.svgResize(workspace), 180);
  });
});

window.addEventListener('resize', () => Blockly.svgResize(workspace));
setTimeout(() => Blockly.svgResize(workspace), 80);
