/* GTN Mod Studio 线框图的界面层。
   文本规则（句型、术语、表达式、卡面渲染）全部来自 src/gtn-text/，
   这里只负责把数据摆到界面上、把交互接回去。 */

import {
  cardTextRules, terms, expr, templates,
  describeRow, describeRows, stepsToRows, escapeHtml,
} from '../src/gtn-text/index.js';

/* ---------- 数据 ---------- */
const FALLBACK_CARDS = [{
  id: 'demo:magic_compass', legacy_id: 'MagicCompass', type: 'bloom',
  cost_e: 0, cost_m: 0, count: 5, tags: ['self_only'], events: {},
  zh: { name: '魔法指南针', text: '选择任意数量自己弃牌堆中的牌，随机置于自己抽牌堆顶', flavor: '' },
  en: { name: 'Magic Compass', text: 'Choose any number of cards in your discard pile and place them on top of your deck at random.', flavor: '' },
  fr: { name: '', text: '', flavor: '' }, ja: { name: '', text: '', flavor: '' },
}];

const CARDS = (cardTextRules.demoCards && cardTextRules.demoCards.length)
  ? cardTextRules.demoCards
  : FALLBACK_CARDS;

const TYPE_LABEL = { thorn: 'Thorn', bloom: 'Bloom', guard: 'Guard', root: 'Root' };
const LANG_LABEL = { zh: '中文', en: 'English', ja: '日本語', fr: 'Français' };

const FLAG_DEFS = [
  { id: 'precision', cls: 'precision', label: '精准' },
  { id: 'exile', cls: 'exile', label: '放逐' },
  { id: 'indestructible', cls: 'indestructible', label: '不可摧毁' },
  { id: 'non_stackable', cls: 'non-stackable', label: '不叠加' },
  { id: 'uncancellable', cls: 'uncancellable', label: '不可取消' },
  { id: 'self_only', cls: 'self-only', label: '不选择目标' },
  { id: 'void', cls: 'void', label: '虚无' },
  { id: 'unique', cls: 'unique', label: '唯一' },
  { id: 'swift', cls: 'swift', label: '迅捷', value: 1 },
  { id: 'heavy', cls: 'heavy', label: '沉重', value: 1 },
  { id: 'charge', cls: 'charge', label: '电荷', value: 1 },
  { id: 'copy', cls: 'copy', label: '复制', value: 1 },
];

const $ = (id) => document.getElementById(id);

let lang = 'zh';
let activeCard = CARDS[0];
let rows = [];
let activeFlags = [{ id: 'precision', value: null }, { id: 'swift', value: 1 }];
/* 「显示内部步骤」：管道型 op 默认折叠 */
let showInternal = false;
/* 描述来源：pack=模组原文 / generated=由效果行生成 / manual=已手改 */
const textOrigin = new Map();
const textKey = () => `${activeCard ? activeCard.id : ''}:${lang}`;

/* ---------- 本地化 ---------- */
function localized(card, key) {
  if (!card) return '';
  const chain = lang === 'zh' ? ['zh', 'en'] : [lang, 'zh', 'en'];
  for (const code of chain) {
    const value = card[code] && card[code][key];
    if (value) return value;
  }
  return '';
}

function cardName(card, code) {
  if (!card) return '';
  const chain = code === 'zh' ? ['zh', 'en'] : [code, 'en', 'zh'];
  for (const item of chain) {
    const value = card[item] && card[item].name;
    if (value) return value;
  }
  return card.legacy_id || card.id || '';
}

/** 四种语言各有一个名称输入框；改动直接写回卡的本地化数据 */
const NAME_FIELDS = [['fieldNameZh', 'zh'], ['fieldNameEn', 'en'], ['fieldNameJa', 'ja'], ['fieldNameFr', 'fr']];

function ensureI18n(card) {
  ['zh', 'en', 'ja', 'fr'].forEach((code) => {
    if (!card[code]) card[code] = { name: '', text: '', flavor: '' };
  });
  return card;
}

function ensureTexts(card) {
  if (!card.texts) {
    card.texts = {};
    ['zh', 'en', 'ja', 'fr'].forEach((code) => {
      card.texts[code] = (card[code] && card[code].text) || '';
    });
  }
  return card.texts;
}

const currentText = () => (activeCard ? ensureTexts(activeCard)[lang] || '' : '');
const setCurrentText = (value) => { if (activeCard) ensureTexts(activeCard)[lang] = value; };
const textSource = () => textOrigin.get(textKey()) || 'pack';

/* ---------- 左栏 ---------- */
function renderCardList() {
  const keyword = $('search').value.trim().toLowerCase();
  const type = document.querySelector('#typeFilter .is-active')?.dataset.type || 'all';
  const list = $('cardList');
  list.innerHTML = '';
  CARDS
    .filter((card) => type === 'all' || card.type === type)
    .filter((card) => {
      if (!keyword) return true;
      return cardName(card, lang).toLowerCase().includes(keyword)
        || cardName(card, 'en').toLowerCase().includes(keyword)
        || card.id.toLowerCase().includes(keyword);
    })
    .forEach((card) => {
      const li = document.createElement('li');
      li.className = card === activeCard ? 'is-active' : '';
      li.innerHTML = `<span class="dot ${card.type}"></span><span>${escapeHtml(cardName(card, lang))}</span>`
        + `<span class="card-cost-mini">${card.cost_e} E</span>`;
      li.onclick = () => {
        activeCard = card;
        loadRows();
        renderFields();
        renderCardList();
        renderRows();
        renderPreview();
      };
      list.appendChild(li);
    });
}

/* ---------- 中栏：效果行 ---------- */
function loadRows() {
  rows = activeCard ? stepsToRows(activeCard.events, { templates, terms, expr }) : [];
}

const autoDescription = () => describeRows(rows, templates, expr);

function onRowsChanged() {
  if (activeCard && lang === 'zh' && textSource() !== 'manual') {
    setCurrentText(autoDescription());
    textOrigin.set(textKey(), 'generated');
    $('fieldText').value = currentText();
  }
  renderRows();
  renderPreview();
}

function appendSlot(row, part) {
  if (part.prefix) this.appendChild(document.createTextNode(part.prefix));
  let control;
  if (part.text) {
    control = document.createElement('input');
    control.type = 'text';
    control.className = 'slot slot-text';
    control.value = row.values[part.slot] ?? '';
  } else if (part.number) {
    control = document.createElement('input');
    control.type = 'number';
    control.className = 'slot num';
    control.value = row.values[part.slot] ?? 1;
  } else {
    control = document.createElement('select');
    control.className = 'slot';
    const current = row.values[part.slot];
    const options = (current && !part.options.includes(current)) ? [current, ...part.options] : part.options;
    options.forEach((opt) => {
      const option = document.createElement('option');
      option.textContent = opt;
      option.selected = current === opt;
      control.appendChild(option);
    });
  }
  control.addEventListener('input', () => {
    row.values[part.slot] = part.number ? Number(control.value) : control.value;
    onRowsChanged();
  });
  this.appendChild(control);
}

function makeRemoveButton(row, index) {
  const remove = document.createElement('button');
  remove.className = 'row-remove';
  remove.textContent = '×';
  remove.title = '删除这一行';
  remove.onclick = () => { rows.splice(index, 1); onRowsChanged(); };
  return remove;
}

function renderRows() {
  const list = $('effectList');
  list.innerHTML = '';
  rows.forEach((row, index) => {
    const tpl = row.tpl ? templates[row.tpl] : null;

    if (tpl && tpl.internal) {
      if (!showInternal) return;
      const el = document.createElement('div');
      el.className = 'effect-row is-internal';
      el.innerHTML = `<span class="grip">⋮⋮</span>`
        + `<span class="op-badge neutral">${escapeHtml(tpl.badge)}</span>`
        + `<span class="internal-label">${escapeHtml(tpl.internalLabel(row))}</span>`
        + `<span class="internal-note">不写进描述</span>`;
      el.appendChild(makeRemoveButton(row, index));
      list.appendChild(el);
      return;
    }

    if (row.generic) {
      const el = document.createElement('div');
      el.className = 'effect-row is-generic';
      el.innerHTML = `<span class="grip">⋮⋮</span><span class="op-badge neutral">原样保留</span>`
        + `<span class="generic-summary">${escapeHtml(row.summary)}</span>`;
      el.appendChild(makeRemoveButton(row, index));
      list.appendChild(el);
      return;
    }

    const el = document.createElement('div');
    el.className = 'effect-row';
    el.draggable = true;
    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⋮⋮';
    el.appendChild(grip);
    const badge = document.createElement('span');
    badge.className = 'op-badge' + (tpl.cond ? ' cond' : '');
    badge.textContent = tpl.badge;
    el.appendChild(badge);

    tpl.parts(row).forEach((part) => {
      if (typeof part === 'string') el.appendChild(document.createTextNode(part));
      else appendSlot.call(el, row, part);
    });
    el.appendChild(makeRemoveButton(row, index));

    el.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    el.addEventListener('dragover', (event) => event.preventDefault());
    el.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isNaN(from) || from === index) return;
      const [moved] = rows.splice(from, 1);
      rows.splice(index, 0, moved);
      onRowsChanged();
    });
    list.appendChild(el);
  });
}

/* ---------- 中栏：属性表单 ---------- */
function renderFields() {
  if (!activeCard) return;
  ensureI18n(activeCard);
  $('cardTitle').textContent = cardName(activeCard, lang);
  $('cardId').textContent = activeCard.id;
  NAME_FIELDS.forEach(([id, code]) => { $(id).value = activeCard[code].name || ''; });
  $('fieldType').value = activeCard.type || 'bloom';
  $('fieldCostE').value = activeCard.cost_e ?? 0;
  $('fieldCostM').value = activeCard.cost_m ?? 0;
  $('fieldCount').value = activeCard.count ?? 1;
  $('fieldTags').value = (activeCard.tags || []).join(', ');
  $('textLangLabel').textContent = LANG_LABEL[lang] || lang;
  $('fieldText').value = currentText();
  updateTextMode();
  renderArtSlot();
}

/* 美术槽位：文件读成 data URL 存进卡数据，预览经 iframe 交给游戏渲染器 */
function renderArtSlot() {
  const url = activeCard?.art || '';
  const img = $('artPreview');
  img.src = url;
  img.style.display = url ? '' : 'none';
  $('artHint').textContent = url ? `已设置（${activeCard.artName || '图片'}）` : '未设置（使用占位）';
}

function updateTextMode() {
  if (!activeCard) return;
  const source = textSource();
  $('textMode').textContent = source === 'manual'
    ? '已手改'
    : (source === 'generated' ? '由效果行生成' : '来自模组原文');
}

function currentDisplayName() {
  if (!activeCard) return '';
  if (lang === 'zh') return $('fieldNameZh').value || cardName(activeCard, 'zh');
  if (lang === 'en') return $('fieldNameEn').value || cardName(activeCard, 'en');
  return (activeCard[lang] && activeCard[lang].name) || $('fieldNameEn').value || cardName(activeCard, 'en');
}

/* ---------- 右栏：卡面预览 ---------- */
function renderPreviewFlags() {
  /* 标签由游戏渲染器按 def 的 flags 自行绘制，这里只负责把数据送过去 */
  sendCardToFrame();
}

function renderFlagPicker() {
  const picker = $('flagPicker');
  picker.innerHTML = '';
  FLAG_DEFS.forEach((def) => {
    const active = activeFlags.find((item) => item.id === def.id);
    const chip = document.createElement('button');
    chip.className = 'chip' + (active ? ' is-active' : '');
    chip.textContent = def.label;
    if (active && def.value) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'chip-value';
      input.value = active.value ?? def.value;
      input.onclick = (event) => event.stopPropagation();
      input.oninput = () => { active.value = Number(input.value) || 0; renderPreviewFlags(); };
      chip.appendChild(input);
    }
    chip.onclick = () => {
      activeFlags = active
        ? activeFlags.filter((item) => item.id !== def.id)
        : [...activeFlags, { id: def.id, value: def.value || null }];
      renderFlagPicker();
      renderPreviewFlags();
    };
    picker.appendChild(chip);
  });
}

/** 当前表单内容 → 游戏的卡牌定义形状 */
function currentDef() {
  const texts = ensureTexts(activeCard);
  const id = activeCard.id;
  const def = {
    id,
    legacy_id: activeCard.legacy_id || '',
    name_cn: activeCard.zh.name || '',
    name_en: activeCard.en.name || '',
    name_i18n: { zh: activeCard.zh.name || '', en: activeCard.en.name || '',
      ja: activeCard.ja.name || '', fr: activeCard.fr.name || '' },
    card_type: $('fieldType').value || activeCard.type || 'bloom',
    cost_e: Number($('fieldCostE').value) || 0,
    cost_m: Number($('fieldCostM').value) || 0,
    count: Number($('fieldCount').value) || 1,
    effect_text: texts.zh || '',
    effect_text_i18n: { zh: texts.zh || '', en: texts.en || '', ja: texts.ja || '', fr: texts.fr || '' },
    flags: activeFlags.map((item) => item.id),
    tags: activeFlags.map((item) => item.id),
  };
  /* 美术：data URL 直接给渲染器用（iframe 与编辑器不同文档，本地路径取不到） */
  if (activeCard.art) {
    def.assets = { image: activeCard.art };
    def.image = activeCard.art;
  }
  return def;
}

/** 把当前卡发给 iframe 里的游戏渲染器 */
function sendCardToFrame() {
  if (!activeCard) return;
  const frame = $('previewFrame');
  if (!frame || !frame.contentWindow) return;
  const def = currentDef();
  const defs = { [def.id]: def };
  if (def.legacy_id) defs[def.legacy_id] = def;
  frame.contentWindow.postMessage({
    type: 'gtn-render-card',
    defs,
    defId: def.id,
    width: Number($('previewSize').value) || 200,
    lang,
    dark: $('previewDark').checked,
    flags: activeFlags.map((item) => item.id),
  }, '*');
}

function renderPreview() {
  if (!activeCard) return;
  sendCardToFrame();
}

function renderChecks(items) {
  const list = $('checkList');
  list.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = `check ${item.level}`;
    li.textContent = item.text;
    list.appendChild(li);
  });
}

/* ---------- 事件绑定 ---------- */
$('search').addEventListener('input', renderCardList);
$('typeFilter').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#typeFilter .chip').forEach((item) => item.classList.remove('is-active'));
  chip.classList.add('is-active');
  renderCardList();
});

NAME_FIELDS.forEach(([id, code]) => {
  $(id).addEventListener('input', () => {
    ensureI18n(activeCard)[code].name = $(id).value;
    renderPreview();
    renderCardList();
  });
});
['fieldCostE', 'fieldCostM'].forEach((id) => {
  $(id).addEventListener('input', () => { renderPreview(); renderCardList(); });
});
$('fieldType').addEventListener('change', renderPreview);
$('fieldText').addEventListener('input', () => {
  setCurrentText($('fieldText').value);
  textOrigin.set(textKey(), 'manual');
  updateTextMode();
  renderPreview();
});

$('genText').onclick = () => {
  setCurrentText(autoDescription());
  textOrigin.set(textKey(), 'generated');
  $('fieldText').value = currentText();
  updateTextMode();
  renderPreview();
};
$('addRow').onclick = () => { rows.push({ tpl: 'deal_damage', values: {} }); onRowsChanged(); };
$('addIf').onclick = () => { rows.push({ tpl: 'if', values: {} }); onRowsChanged(); };
$('showInternal').onchange = (event) => { showInternal = event.target.checked; renderRows(); };
$('previewSize').onchange = renderPreview;
$('previewDark').onchange = renderPreview;

$('langTabs').addEventListener('click', (event) => {
  const tab = event.target.closest('.lang-tab');
  if (!tab) return;
  document.querySelectorAll('.lang-tab').forEach((item) => item.classList.remove('is-active'));
  tab.classList.add('is-active');
  lang = tab.dataset.lang;
  renderFields();
  renderCardList();
  renderPreview();
});

$('validateBtn').onclick = () => {
  renderChecks([
    { level: 'ok', text: '结构与命名空间：通过（官方包模式）' },
    { level: 'ok', text: `op 白名单：${rows.filter((row) => !row.generic).length} 个 op 全部有效` },
    { level: 'error', text: '效果行 3「附加 流血」：层数必须大于 0' },
    { level: 'warn', text: '日语 / 法语翻译缺失，将回退到中文' },
  ]);
};

/** 把当前卡打成 v2 草案，交给服务器的 /api/mod-studio/validate 做真校验 */
function buildDraft() {
  const def = currentDef();
  const texts = ensureTexts(activeCard);
  const shortId = String(def.id).split(':').pop();
  return {
    format_version: 2,
    manifest: {
      id: String(def.id).split(':')[0] || 'demo_mod',
      name: `${activeCard.legacy_id || shortId} draft`,
      version: '0.1.0',
      api_version: '2.0',
      resource_namespace: String(def.id).split(':')[0] || 'demo_mod',
      default_language: 'zh',
    },
    registries: {
      cards: [{
        id: def.id,
        legacy_id: def.legacy_id || undefined,
        name_cn: def.name_cn,
        name_en: def.name_en,
        card_type: def.card_type,
        cost_e: def.cost_e,
        cost_m: def.cost_m,
        count: def.count,
        effect_text: texts.zh || '',
        effect_text_i18n: texts,
        tags: def.tags,
        events: activeCard.events || {},
      }],
    },
  };
}

$('onlineValidate').onclick = async () => {
  const base = ($('serverUrl').value || '').replace(/\/+$/, '');
  /* 留空表示走同源（编辑器自己的代理），避免跨源被浏览器拦 */
  renderChecks([{ level: 'warn', text: `正在校验 ${base || '同源代理'} …` }]);
  try {
    const response = await fetch(`${base}/api/mod-studio/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDraft()),
    });
    const data = await response.json().catch(() => ({}));
    const items = [];
    (data.errors || []).forEach((text) => items.push({ level: 'error', text }));
    (data.warnings || []).forEach((text) => items.push({ level: 'warn', text }));
    if (!items.length) items.push({ level: 'ok', text: '服务器校验通过' });
    renderChecks(items);
  } catch (error) {
    renderChecks([{ level: 'error', text: `无法连接服务器：${error.message}` }]);
  }
};

/* 美术槽位事件 */
$('artInput').addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !activeCard) return;
  const reader = new FileReader();
  reader.onload = () => {
    activeCard.art = String(reader.result || '');
    activeCard.artName = file.name;
    renderArtSlot();
    renderPreview();
  };
  reader.readAsDataURL(file);
});
$('artClear').onclick = () => {
  if (!activeCard) return;
  activeCard.art = '';
  activeCard.artName = '';
  $('artInput').value = '';
  renderArtSlot();
  renderPreview();
};

/* ---------- 启动 ---------- */
loadRows();
renderFields();
renderCardList();
renderRows();
renderFlagPicker();
renderPreview();

/* iframe 就绪后补发当前卡（首帧消息可能早于渲染器初始化） */
window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'gtn-card-host-ready') sendCardToFrame();
});
$('previewFrame').addEventListener('load', () => setTimeout(sendCardToFrame, 60));

/* 游戏在字体加载完成后给 <html> 加这个类，把 --font-main 切成 Kreadon */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => document.documentElement.classList.add('fonts-loaded-main'));
}
