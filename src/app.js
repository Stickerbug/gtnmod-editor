import * as Blockly from 'blockly';
import { generateEffectsFromWorkspace } from './generator.js';
import { ensureScriptXml, scriptFromEffects } from './effectXml.js';

const BUILTIN_FLAGS = [
  ['放逐', 'exile'],
  ['精准', 'precision'],
  ['不可摧毁', 'indestructible'],
  ['不可叠加', 'non_stackable'],
  ['萌芽', 'sprout'],
  ['共生', 'symbiosis'],
  ['不可取消', 'uncancellable'],
  ['仅自己可用', 'self_only'],
  ['无限火力移除', 'infinite_exclude'],
];

const KIND_CONFIG = {
  cards: { label: '卡牌', script: true, scriptTitle: '卡牌脚本' },
  events: { label: '开局事件', script: true, scriptTitle: '开局事件脚本' },
  statuses: { label: '状态', script: true, scriptTitle: '状态脚本' },
  tags: { label: '标签', script: true, scriptTitle: '标签脚本' },
  variables: { label: '变量', script: false, scriptTitle: '变量定义' },
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const SCRIPT_TRIGGER_BY_KIND = {
  cards: 'trigger_on_play',
  events: 'trigger_event_apply',
  statuses: 'trigger_status_exists',
  tags: 'trigger_tag_exists',
};

function scriptOptions(kind, entity = null) {
  return {
    triggerType: SCRIPT_TRIGGER_BY_KIND[kind] || 'trigger_on_play',
    equipOnPlay: kind === 'cards' && entity?.card_type === 'root',
  };
}

function defaultScript(effects = [], kind = 'cards', entity = null) {
  return scriptFromEffects(effects, scriptOptions(kind, entity));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function hasEffects(script) {
  return Array.isArray(script?.effects) && script.effects.length > 0;
}

const GENERATED_VARIABLE_INITIALS = {
  '咖啡首次使用': 1,
  '三角形层数': 0,
  '魔法电池本回合回魔': 0,
};

function collectReferencedVariables(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedVariables(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (value.ref === 'var' && value.name) out.add(String(value.name));
  if (value.type === 'coffee_gain_e') out.add('咖啡首次使用');
  if (value.type === 'triangle_damage') out.add('三角形层数');
  if (['var_set', 'var_add', 'var_sub', 'var_mul', 'var_div'].includes(value.type) && value.params?.name) {
    out.add(String(value.params.name));
  }
  for (const child of Object.values(value)) collectReferencedVariables(child, out);
  return out;
}

function collectVariablesFromXml(xml, out = new Set()) {
  if (!xml || typeof xml !== 'string' || !xml.includes('<')) return out;
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    doc.querySelectorAll('field[name="NAME"]').forEach(field => {
      const name = field.textContent?.trim();
      if (name) out.add(name);
    });
  } catch (_) {
    const pattern = /<field\s+name=["']NAME["'][^>]*>([^<]+)<\/field>/g;
    for (const match of xml.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (name) out.add(name);
    }
  }
  return out;
}

function legacyCardEffects(card) {
  const effects = [];
  const num = key => Number(card?.[key] || 0);
  if (num('damage') > 0) {
    const params = { target: 'enemy', amount: num('damage') };
    if (num('hits') > 1) params.hits = num('hits');
    effects.push({ type: 'damage', params });
  }
  if (num('heal') > 0) effects.push({ type: 'heal', params: { target: 'self', amount: num('heal') } });
  if (num('draw') > 0) effects.push({ type: 'draw', params: { target: 'self', amount: num('draw') } });
  if (num('gain_e') > 0) effects.push({ type: 'gain_e', params: { target: 'self', amount: num('gain_e') } });
  if (num('gain_m') > 0) effects.push({ type: 'gain_m', params: { target: 'self', amount: num('gain_m') } });
  if (num('armor') > 0) effects.push({ type: 'add_armor', params: { target: 'self', amount: num('armor') } });
  if (num('dodge') > 0) effects.push({ type: 'dodge_permanent', params: { amount: num('dodge') } });
  if (num('poison') > 0) effects.push({ type: 'poison', params: { target: 'enemy', amount: num('poison') } });
  if (num('burn') > 0) effects.push({ type: 'burn', params: { target: 'enemy', amount: num('burn') } });
  return effects;
}

function itemEffects(kind, item) {
  if (Array.isArray(item?.effects) && item.effects.length) return item.effects;
  if (kind === 'cards') return legacyCardEffects(item);
  return Array.isArray(item?.effects) ? item.effects : [];
}

function createDefaultEntity(kind) {
  if (kind === 'cards') {
    return {
      id: uid('Card'),
      name_cn: '新卡牌',
      name_en: 'New Card',
      cost_e: 0,
      cost_m: 0,
      card_type: 'bloom',
      count: 1,
      quality: 'Common',
      description: '',
      effect_text: '',
      flags: [],
      effects: [],
      trigger_cost_e: -1,
      trigger_effect_text: '',
      trigger_effects: [],
      response_trigger: '',
      script: defaultScript([], 'cards'),
    };
  }
  if (kind === 'events') {
    return {
      id: 1000 + Math.floor(Math.random() * 9000),
      name_cn: '新开局事件',
      name_en: 'New Event',
      desc: '',
      position: 3,
      effects: [],
      params: {},
      script: defaultScript([], 'events'),
    };
  }
  if (kind === 'statuses') {
    return {
      id: uid('status'),
      name_cn: '新状态',
      name_en: 'New Status',
      display_text: '',
      stackable: true,
      max_stacks: 99,
      desc: '',
      script: defaultScript([], 'statuses'),
    };
  }
  if (kind === 'tags') {
    return {
      id: uid('tag'),
      name_cn: '新标签',
      name_en: 'New Tag',
      desc: '',
      script: defaultScript([], 'tags'),
    };
  }
  return {
    id: uid('var'),
    name: '新变量',
    scope: 'player',
    initial: 0,
    desc: '',
  };
}

function scriptKey(kind, id) {
  const prefix = kind === 'cards' ? 'card' : kind === 'events' ? 'event' : kind === 'statuses' ? 'status' : 'tag';
  return `${prefix}:${id}`;
}

function displayName(entity, kind) {
  if (!entity) return '';
  if (kind === 'variables') return entity.name || entity.id;
  return entity.name_cn || entity.name_en || String(entity.id);
}

function exportEntity(entity) {
  const out = clone(entity);
  delete out.script;
  return out;
}

export class ModStudio {
  constructor() {
    this.workspace = null;
    this.activeKind = 'cards';
    this.activeIndex = -1;
    this.workspaceDirty = false;
    this.loadingWorkspace = false;
    this.loadedWorkspaceXml = '';
    this.model = this.createEmptyModel();
  }

  createEmptyModel() {
    return {
      format_version: 1,
      info: {
        name: '新模组',
        version: '1.0.0',
        author: '',
        description: '',
        game_version: '*',
      },
      variables: [],
      cards: [],
      events: [],
      custom_statuses: [],
      custom_tags: [],
      scripts: {},
    };
  }

  init(workspace) {
    this.workspace = workspace;
    this.workspace.addChangeListener(event => {
      const ignoredTypes = new Set(['viewport_change', 'selected', 'click', 'toolbox_item_select', 'theme_change']);
      if (!this.hasScript() || this.loadingWorkspace || ignoredTypes.has(event?.type)) return;
      this.workspaceDirty = true;
      window.clearTimeout(this.previewTimer);
      this.previewTimer = window.setTimeout(() => this.refreshPreview(), 120);
    });
    this.bindModInfo();
    this.renderTabs();
    this.addEntity();
  }

  reset() {
    this.saveCurrentScript();
    this.model = this.createEmptyModel();
    this.activeKind = 'cards';
    this.activeIndex = -1;
    this.bindModInfo();
    this.renderTabs();
    this.addEntity();
  }

  list(kind = this.activeKind) {
    if (kind === 'cards') return this.model.cards;
    if (kind === 'events') return this.model.events;
    if (kind === 'statuses') return this.model.custom_statuses;
    if (kind === 'tags') return this.model.custom_tags;
    return this.model.variables;
  }

  ensureVariable(name, initial = 0) {
    const clean = String(name || '').trim();
    if (!clean || clean === '先添加变量') return;
    const exists = this.model.variables.some(variable => String(variable.name || variable.id || '').trim() === clean);
    if (exists) return;
    this.model.variables.push({
      id: clean,
      name: clean,
      scope: 'player',
      initial,
      desc: '由脚本引用自动创建',
    });
  }

  ensureReferencedVariables() {
    const names = new Set();
    for (const kind of ['cards', 'events', 'custom_statuses', 'custom_tags']) {
      for (const entity of this.model[kind] || []) {
        collectReferencedVariables(entity.effects, names);
        collectReferencedVariables(entity.script?.effects, names);
        collectVariablesFromXml(entity.script?.xml, names);
      }
    }
    for (const script of Object.values(this.model.scripts || {})) {
      collectReferencedVariables(script?.effects, names);
      collectVariablesFromXml(script?.xml, names);
    }
    for (const name of names) this.ensureVariable(name, GENERATED_VARIABLE_INITIALS[name] ?? 0);
  }

  currentEntity() {
    const arr = this.list();
    return this.activeIndex >= 0 && this.activeIndex < arr.length ? arr[this.activeIndex] : null;
  }

  hasScript(kind = this.activeKind) {
    return !!KIND_CONFIG[kind]?.script;
  }

  withWorkspaceEventsMuted(action) {
    this.loadingWorkspace = true;
    if (Blockly.Events?.disable) Blockly.Events.disable();
    try {
      return action();
    } finally {
      if (Blockly.Events?.enable) Blockly.Events.enable();
      this.loadingWorkspace = false;
    }
  }

  currentWorkspaceXml() {
    if (!this.workspace) return '';
    return Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(this.workspace));
  }

  bindModInfo() {
    for (const [id, key] of [
      ['mod-name', 'name'],
      ['mod-version', 'version'],
      ['mod-author', 'author'],
      ['mod-description', 'description'],
    ]) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = this.model.info[key] || '';
      el.oninput = () => {
        this.model.info[key] = el.value;
        this.refreshPreview();
      };
    }
  }

  renderTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.kind === this.activeKind);
    });
    this.renderList();
    this.updateWorkspaceHeader();
  }

  updateWorkspaceHeader() {
    const cfg = KIND_CONFIG[this.activeKind];
    document.getElementById('workspace-title').textContent = cfg.scriptTitle;
    document.getElementById('workspace-subtitle').textContent = cfg.script
      ? '拖入触发、目标、动作、条件和变量块，导出时会生成效果列表。'
      : '变量用于脚本中的“变量”块；变量定义本身不需要画布脚本。';
  }

  selectKind(kind) {
    if (!KIND_CONFIG[kind]) return;
    this.saveCurrentScript();
    this.activeKind = kind;
    this.activeIndex = -1;
    this.renderTabs();
    if (this.list().length > 0) this.selectEntity(0);
    else this.clearWorkspaceAndProps();
  }

  addEntity() {
    this.saveCurrentScript();
    const arr = this.list();
    arr.push(createDefaultEntity(this.activeKind));
    this.activeIndex = arr.length - 1;
    this.renderList();
    this.loadCurrent();
  }

  duplicateEntity() {
    const arr = this.list();
    const current = arr[this.activeIndex];
    if (!current) return;
    this.saveCurrentScript();
    const cloned = clone(current);
    cloned.id = uid(this.activeKind === 'variables' ? 'var' : this.activeKind.slice(0, -1));
    if (cloned.name_cn) cloned.name_cn = `${cloned.name_cn} 副本`;
    if (cloned.name) cloned.name = `${cloned.name} 副本`;
    arr.splice(this.activeIndex + 1, 0, cloned);
    this.activeIndex += 1;
    this.renderList();
    this.loadCurrent();
  }

  deleteEntity() {
    const arr = this.list();
    if (!arr[this.activeIndex]) return;
    arr.splice(this.activeIndex, 1);
    this.activeIndex = Math.min(this.activeIndex, arr.length - 1);
    this.renderList();
    if (this.activeIndex >= 0) this.loadCurrent();
    else this.clearWorkspaceAndProps();
  }

  selectEntity(index) {
    this.saveCurrentScript();
    this.activeIndex = index;
    this.renderList();
    this.loadCurrent();
  }

  renderList() {
    const list = document.getElementById('entity-list');
    list.innerHTML = '';
    const arr = this.list();
    if (!arr.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = `还没有${KIND_CONFIG[this.activeKind].label}。`;
      list.appendChild(empty);
      return;
    }
    arr.forEach((entity, idx) => {
      const row = document.createElement('button');
      row.className = `entity-item${idx === this.activeIndex ? ' active' : ''}`;
      row.innerHTML = `<span>${displayName(entity, this.activeKind)}</span><small>${entity.id ?? ''}</small>`;
      row.onclick = () => this.selectEntity(idx);
      list.appendChild(row);
    });
  }

  clearWorkspaceAndProps() {
    this.withWorkspaceEventsMuted(() => this.workspace.clear());
    this.workspaceDirty = false;
    this.loadedWorkspaceXml = this.currentWorkspaceXml();
    document.getElementById('props').innerHTML = '';
    document.getElementById('props-title').textContent = '对象属性';
    this.refreshPreview();
  }

  loadCurrent() {
    const entity = this.currentEntity();
    if (!entity) return this.clearWorkspaceAndProps();
    this.withWorkspaceEventsMuted(() => {
      this.workspace.clear();
      if (this.hasScript()) {
        this.loadScriptWorkspace(entity);
      }
    });
    this.workspaceDirty = false;
    this.loadedWorkspaceXml = this.currentWorkspaceXml();
    this.renderProps(entity);
    this.refreshPreview();
    this.revealWorkspaceBlocks();
  }

  loadScriptWorkspace(entity) {
    const loadXml = xml => {
      if (!xml) return false;
      try {
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), this.workspace);
        return this.workspace.getAllBlocks(false).length > 0;
      } catch (err) {
        console.warn('无法载入脚本 XML', err);
        this.workspace.clear();
        return false;
      }
    };
    if (loadXml(entity.script?.xml)) return;
    const rebuilt = scriptFromEffects(entity.script?.effects || entity.effects || [], scriptOptions(this.activeKind, entity));
    entity.script = { ...(entity.script || {}), ...rebuilt };
    loadXml(entity.script.xml);
  }

  revealWorkspaceBlocks() {
    requestAnimationFrame(() => {
      try {
        if (typeof this.workspace.getParentSvg === 'function') Blockly.svgResize(this.workspace);
        const topBlocks = this.workspace.getTopBlocks(false);
        if (!topBlocks.length) return;
        if (typeof this.workspace.cleanUp === 'function') this.workspace.cleanUp();
        if (typeof this.workspace.centerOnBlock === 'function') this.workspace.centerOnBlock(topBlocks[0].id);
      } catch (err) {
        console.warn('无法定位脚本块', err);
      }
    });
  }

  saveCurrentScript() {
    const entity = this.currentEntity();
    if (!entity || !this.hasScript()) return;
    const xml = this.currentWorkspaceXml();
    if (!this.workspaceDirty && xml === this.loadedWorkspaceXml) return;
    let effects = [];
    try {
      effects = generateEffectsFromWorkspace(this.workspace);
    } catch (err) {
      console.warn('无法生成效果列表，已保留 Blockly XML', err);
    }
    entity.script = { xml, effects };
    entity.effects = entity.script.effects;
    this.workspaceDirty = false;
    this.loadedWorkspaceXml = xml;
  }

  renderProps(entity) {
    const host = document.getElementById('props');
    host.innerHTML = '';
    document.getElementById('props-title').textContent = `${KIND_CONFIG[this.activeKind].label}属性`;
    if (this.activeKind === 'cards') this.renderCardProps(host, entity);
    else if (this.activeKind === 'events') this.renderEventProps(host, entity);
    else if (this.activeKind === 'statuses') this.renderStatusProps(host, entity);
    else if (this.activeKind === 'tags') this.renderTagProps(host, entity);
    else this.renderVariableProps(host, entity);
  }

  addField(host, entity, key, label, type = 'text', options = null) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else if (type === 'select') {
      input = document.createElement('select');
      for (const [text, value] of options) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        input.appendChild(opt);
      }
    } else {
      input = document.createElement('input');
      input.type = type;
    }
    input.value = entity[key] ?? '';
    input.oninput = () => {
      entity[key] = type === 'number' ? Number(input.value || 0) : input.value;
      this.renderList();
      this.refreshPreview();
    };
    wrap.appendChild(input);
    host.appendChild(wrap);
    return input;
  }

  addRow(host, children) {
    const row = document.createElement('div');
    row.className = 'field-row';
    for (const child of children) row.appendChild(child);
    host.appendChild(row);
  }

  fieldNode(entity, key, label, type = 'text', options = null) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      for (const [text, value] of options) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        input.appendChild(opt);
      }
    } else {
      input = document.createElement('input');
      input.type = type;
    }
    input.value = entity[key] ?? '';
    input.oninput = () => {
      entity[key] = type === 'number' ? Number(input.value || 0) : input.value;
      this.renderList();
      this.refreshPreview();
    };
    wrap.appendChild(input);
    return wrap;
  }

  renderCardProps(host, entity) {
    this.addField(host, entity, 'id', '卡牌 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addRow(host, [
      this.fieldNode(entity, 'cost_e', 'E 消耗', 'number'),
      this.fieldNode(entity, 'cost_m', 'M 消耗', 'number'),
    ]);
    this.addRow(host, [
      this.fieldNode(entity, 'card_type', '类型', 'select', [
        ['攻击', 'thorn'],
        ['技能', 'bloom'],
        ['反制', 'guard'],
        ['装备', 'root'],
      ]),
      this.fieldNode(entity, 'quality', '品质', 'select', [
        ['Common', 'Common'],
        ['Unusual', 'Unusual'],
        ['Epic', 'Epic'],
        ['Ultra', 'Ultra'],
        ['Super', 'Super'],
      ]),
    ]);
    this.addRow(host, [
      this.fieldNode(entity, 'count', '牌池数量', 'number'),
      this.fieldNode(entity, 'trigger_cost_e', '装备触发 E', 'number'),
    ]);
    this.addField(host, entity, 'response_trigger', '反制响应类型');
    this.addField(host, entity, 'trigger_effect_text', '装备触发文字');
    this.addField(host, entity, 'effect_text', '效果文字', 'textarea');
    this.addField(host, entity, 'description', '描述', 'textarea');
    this.renderFlags(host, entity);
  }

  renderFlags(host, entity) {
    const wrap = document.createElement('label');
    wrap.textContent = '标签';
    const grid = document.createElement('div');
    grid.className = 'flag-grid';
    const selected = new Set(entity.flags || []);
    for (const [label, flag] of BUILTIN_FLAGS) {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(flag);
      input.onchange = () => {
        if (input.checked) selected.add(flag);
        else selected.delete(flag);
        entity.flags = Array.from(selected);
        this.refreshPreview();
      };
      row.append(input, document.createTextNode(label));
      grid.appendChild(row);
    }
    wrap.appendChild(grid);
    host.appendChild(wrap);
  }

  renderEventProps(host, entity) {
    this.addField(host, entity, 'id', '事件 ID', 'number');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'position', '位置权重', 'number');
    this.addField(host, entity, 'desc', '描述', 'textarea');
  }

  renderStatusProps(host, entity) {
    this.addField(host, entity, 'id', '状态 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'display_text', '状态栏显示模板');
    this.addField(host, entity, 'max_stacks', '最大层数', 'number');
    this.addField(host, entity, 'desc', '说明', 'textarea');
  }

  renderTagProps(host, entity) {
    this.addField(host, entity, 'id', '标签 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'desc', '说明', 'textarea');
  }

  renderVariableProps(host, entity) {
    this.addField(host, entity, 'id', '变量 ID');
    this.addField(host, entity, 'name', '变量名');
    this.addField(host, entity, 'scope', '作用域', 'select', [
      ['玩家变量（每个玩家各自拥有）', 'player'],
      ['队伍变量（2v2 队伍共享）', 'team'],
      ['全局变量（整局共享）', 'global'],
    ]);
    this.addField(host, entity, 'initial', '初始值', 'number');
    this.addField(host, entity, 'desc', '说明', 'textarea');
  }

  collectScripts() {
    const scripts = {};
    for (const kind of ['cards', 'events', 'statuses', 'tags']) {
      for (const entity of this.list(kind)) {
        if (entity.id == null) continue;
        scripts[scriptKey(kind, entity.id)] = entity.script || defaultScript(entity.effects || [], kind, entity);
      }
    }
    return scripts;
  }

  exportModel() {
    this.saveCurrentScript();
    this.ensureReferencedVariables();
    const scripts = this.collectScripts();
    return {
      format_version: 1,
      info: this.model.info,
      variables: this.model.variables.map(exportEntity),
      cards: this.model.cards.map(card => ({ ...exportEntity(card), effects: card.script?.effects || card.effects || [] })),
      events: this.model.events.map(event => ({ ...exportEntity(event), effects: event.script?.effects || event.effects || [] })),
      custom_statuses: this.model.custom_statuses.map(exportEntity),
      custom_tags: this.model.custom_tags.map(exportEntity),
      scripts,
    };
  }

  refreshPreview() {
    const preview = document.getElementById('preview');
    if (!preview) return;
    preview.textContent = JSON.stringify(this.exportModel(), null, 2);
  }

  exportJson() {
    return JSON.stringify(this.exportModel(), null, 2);
  }

  importJson(text) {
    const data = JSON.parse(text);
    const info = data.info || data.meta || {};
    const scripts = data.scripts || {};
    const attach = (kind, arr) => (Array.isArray(arr) ? arr : []).map(item => {
      const key = scriptKey(kind, item.id);
      const fallbackEffects = itemEffects(kind, item);
      const importedScript = scripts[key] || scripts[`${key}:play`] || item.script || null;
      const script = importedScript && (importedScript.xml || hasEffects(importedScript))
        ? importedScript
        : defaultScript(fallbackEffects, kind, item);
      return {
        ...item,
        effects: fallbackEffects,
        script: ensureScriptXml(script, fallbackEffects, scriptOptions(kind, item)),
      };
    });
    this.saveCurrentScript();
    this.model = {
      format_version: 1,
      info: {
        name: info.name || '导入模组',
        version: info.version || '1.0.0',
        author: info.author || '',
        description: info.description || '',
        game_version: info.game_version || '*',
      },
      variables: Array.isArray(data.variables) ? data.variables : [],
      cards: attach('cards', data.cards),
      events: attach('events', data.events),
      custom_statuses: attach('statuses', data.custom_statuses),
      custom_tags: attach('tags', data.custom_tags),
      scripts: {},
    };
    this.ensureReferencedVariables();
    this.bindModInfo();
    this.activeKind = this.model.cards.length ? 'cards' : 'variables';
    this.activeIndex = -1;
    this.renderTabs();
    if (this.list().length) this.selectEntity(0);
    else this.addEntity();
    this.showNotice(`已导入 ${this.model.cards.length} 张卡牌，当前脚本块 ${this.workspace.getAllBlocks(false).length} 个。`);
  }

  showNotice(message) {
    let notice = document.getElementById('studio-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'studio-notice';
      notice.className = 'studio-notice';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('show');
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => notice.classList.remove('show'), 3200);
  }
}

export const studio = new ModStudio();
