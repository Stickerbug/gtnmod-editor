import * as Blockly from 'blockly';
import { generateEffectsFromWorkspace } from './generator.js';
import { ensureScriptXml, scriptFromEffects } from './effectXml.js';
import { toolboxForKind } from './toolbox.js';

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

function uniqueFlagOptions(options) {
  const seen = new Set();
  const result = [];
  for (const [label, value] of options) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push([String(label || id), id]);
  }
  return result;
}

function tagName(tag) {
  return String(tag?.name_cn || tag?.name || tag?.name_en || tag?.id || '').trim();
}

function flagOptionsForModel(model, selectedFlags = []) {
  const options = [...BUILTIN_FLAGS];
  for (const tag of model?.custom_tags || []) {
    const id = String(tag?.id || tag?.name || '').trim();
    if (id) options.push([tagName(tag) || id, id]);
  }
  const known = new Set(options.map(([, value]) => value));
  for (const flag of selectedFlags || []) {
    const id = String(flag || '').trim();
    if (id && !known.has(id)) options.push([`标签ID: ${id}`, id]);
  }
  return uniqueFlagOptions(options);
}

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

const TAG_COLOR_DEFAULTS = {
  color: '#1f618d',
  background: '#eaf2f8',
};

const LOCAL_CACHE_KEY = 'garden_of_thorn_mod_editor_autosave_v1';
const LOCAL_CACHE_INTERVAL_MS = 30000;

function clampRgb(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(255, Math.round(num)));
}

function toHexByte(value) {
  return clampRgb(value).toString(16).padStart(2, '0');
}

function rgbToHex(r, g, b) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000');
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function normalizeHexColor(value, fallback = '#000000') {
  const raw = String(value || '').trim();
  const fb = /^#[0-9a-f]{6}$/i.test(fallback) ? fallback.toLowerCase() : '#000000';
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1].split('').map(ch => ch + ch).join('')}`.toLowerCase();
  }
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  if (full) return `#${full[1]}`.toLowerCase();
  const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) return rgbToHex(rgb[1], rgb[2], rgb[3]);
  return fb;
}

function readableTagTextColor(background) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#142033' : '#ffffff';
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

function findResponseDeclare(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findResponseDeclare(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'response_declare') return value.params || {};
  for (const child of Object.values(value)) {
    const found = findResponseDeclare(child);
    if (found) return found;
  }
  return null;
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

function runtimeScriptEffects(item, entry = 'onPlay') {
  const aliasMap = {
    onPlay: ['onPlay', 'play', 'on_play'],
    onOwnerTurnStart: ['onOwnerTurnStart', 'owner_turn_start', 'on_owner_turn_start'],
    onEnemyTurnStart: ['onEnemyTurnStart', 'enemy_turn_start', 'on_enemy_turn_start'],
    onAnyTurnStart: ['onAnyTurnStart', 'any_turn_start', 'on_any_turn_start'],
    onDamageTaken: ['onDamageTaken', 'damage_taken', 'on_damage_taken'],
    onEquipmentTrigger: ['onEquipmentTrigger', 'equipment_trigger', 'on_equipment_trigger'],
    onEquipmentDestroy: ['onEquipmentDestroy', 'equipment_destroy', 'on_equipment_destroy', 'onDestroy'],
    onHandOwnerTurnStart: ['onHandOwnerTurnStart', 'hand_owner_turn_start', 'on_hand_owner_turn_start'],
    onEnterHand: ['onEnterHand', 'enter_hand', 'on_enter_hand'],
    onDiscardOwnerTurnStart: ['onDiscardOwnerTurnStart', 'discard_owner_turn_start', 'on_discard_owner_turn_start'],
    onDeckOwnerTurnStart: ['onDeckOwnerTurnStart', 'deck_owner_turn_start', 'on_deck_owner_turn_start'],
    onCardUsed: ['onCardUsed', 'card_used', 'on_card_used'],
    onEquipmentTriggered: ['onEquipmentTriggered', 'equipment_triggered', 'on_equipment_triggered'],
    onEquipmentDestroyed: ['onEquipmentDestroyed', 'equipment_destroyed', 'on_equipment_destroyed'],
    onResourceSpent: ['onResourceSpent', 'resource_spent', 'on_resource_spent'],
    onPlayerStatChanged: ['onPlayerStatChanged', 'player_stat_changed', 'on_player_stat_changed'],
    onResponse: ['onResponse', 'response', 'on_response'],
  };
  const aliases = aliasMap[entry] || [entry];
  const scripts = item?.scripts;
  if (!scripts || typeof scripts !== 'object') return null;
  for (const key of aliases) {
    if (!Object.prototype.hasOwnProperty.call(scripts, key)) continue;
    const script = scripts[key];
    if (Array.isArray(script)) return script;
    if (script && typeof script === 'object' && Array.isArray(script.effects)) return script.effects;
    return [];
  }
  return null;
}

function runtimeEffectsForEditor(item) {
  const scripts = item?.scripts;
  if (!scripts || typeof scripts !== 'object') return null;
  const out = [];
  const addScript = (entry, wrapperType = null) => {
    const effects = runtimeScriptEffects(item, entry);
    if (effects === null) return false;
    if (wrapperType) out.push({ type: wrapperType, params: { effects } });
    else out.push(...effects);
    return true;
  };
  let found = addScript('onPlay');
  const responseEffects = runtimeScriptEffects(item, 'onResponse');
  if (responseEffects !== null) {
    out.push({
      type: 'response_declare',
      params: {
        timing: item.response_trigger || 'thorn',
        cost_e: Number(item.cost_e || 0),
        cost_m: Number(item.cost_m || 0),
      },
    });
    out.push(...responseEffects);
    found = true;
  }
  found = addScript('onOwnerTurnStart', 'on_owner_turn_start') || found;
  found = addScript('onEnemyTurnStart', 'on_enemy_turn_start') || found;
  found = addScript('onAnyTurnStart', 'on_any_turn_start') || found;
  found = addScript('onDamageTaken', 'on_damage_taken') || found;
  found = addScript('onEquipmentTrigger', 'on_equipment_trigger') || found;
  found = addScript('onEquipmentDestroy', 'on_equipment_destroy') || found;
  found = addScript('onHandOwnerTurnStart', 'on_hand_owner_turn_start') || found;
  found = addScript('onEnterHand', 'on_enter_hand') || found;
  found = addScript('onDiscardOwnerTurnStart', 'on_discard_owner_turn_start') || found;
  found = addScript('onDeckOwnerTurnStart', 'on_deck_owner_turn_start') || found;
  found = addScript('onCardUsed', 'on_card_used') || found;
  found = addScript('onEquipmentTriggered', 'on_equipment_triggered') || found;
  found = addScript('onEquipmentDestroyed', 'on_equipment_destroyed') || found;
  found = addScript('onResourceSpent', 'on_resource_spent') || found;
  found = addScript('onPlayerStatChanged', 'on_player_stat_changed') || found;
  return found ? out : null;
}

function exportCardRuntimeScripts(card, effects) {
  const scripts = card.scripts && typeof card.scripts === 'object' ? clone(card.scripts) : {};
  const response = findResponseDeclare(effects);
  if (!response && (effects.length || Object.prototype.hasOwnProperty.call(scripts, 'onPlay'))) {
    scripts.onPlay = { effects };
  }
  if (response) {
    scripts.onResponse = { effects: effects.filter(effect => !(effect && typeof effect === 'object' && effect.type === 'response_declare')) };
    if (card.card_type === 'guard') delete scripts.onPlay;
  }
  return scripts;
}

function hasRootEquipEffect(effects) {
  return (effects || []).some(effect => {
    const type = typeof effect === 'string' ? effect : effect?.type;
    return type === 'place_as_equip' || type === 'equip_this_card';
  });
}

function ensureRootEquipEffect(card, effects) {
  const list = Array.isArray(effects) ? effects : [];
  if (card?.card_type !== 'root' || hasRootEquipEffect(list)) return list;
  return [
    { type: 'place_as_equip', params: { card: { ref: 'current_card' } } },
    ...list,
  ];
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
      keep_when_zero: false,
      desc: '',
      script: defaultScript([], 'statuses'),
    };
  }
  if (kind === 'tags') {
    return {
      id: uid('tag'),
      name_cn: '新标签',
      name_en: 'New Tag',
      category: 'keyword',
      visible: true,
      stackable: false,
      color: TAG_COLOR_DEFAULTS.color,
      background: TAG_COLOR_DEFAULTS.background,
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

function editorExportMeta() {
  return {
    tool: 'Garden of Thorn Mod Editor',
    tool_version: '1',
    schema: 'gtn_mod_format_v1',
  };
}

export class ModStudio {
  constructor() {
    this.workspace = null;
    this.activeKind = 'cards';
    this.activeIndex = -1;
    this.activeWorkspaceMode = 'code';
    this.workspaceDirty = false;
    this.loadingWorkspace = false;
    this.loadedWorkspaceXml = '';
    this.model = this.createEmptyModel();
    this.localCacheTimer = null;
    this.lastLocalCacheSnapshot = '';
  }

  createEmptyModel() {
    return {
      format_version: 1,
      editor: editorExportMeta(),
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

  localCacheAvailable() {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch (_) {
      return false;
    }
  }

  localCachePayload() {
    return {
      saved_at: new Date().toISOString(),
      activeKind: this.activeKind,
      activeIndex: this.activeIndex,
      activeWorkspaceMode: this.activeWorkspaceMode,
      model: this.exportModel(),
    };
  }

  saveLocalCache({ force = false, silent = true } = {}) {
    if (!this.localCacheAvailable() || !this.workspace) return false;
    try {
      const payload = this.localCachePayload();
      const snapshot = JSON.stringify(payload);
      if (!force && snapshot === this.lastLocalCacheSnapshot) return true;
      window.localStorage.setItem(LOCAL_CACHE_KEY, snapshot);
      this.lastLocalCacheSnapshot = snapshot;
      if (!silent) this.showNotice('已保存到本地缓存');
      return true;
    } catch (err) {
      console.warn('本地缓存保存失败', err);
      if (!silent) this.showNotice('本地缓存保存失败');
      return false;
    }
  }

  startLocalCache() {
    if (this.localCacheTimer) window.clearInterval(this.localCacheTimer);
    this.localCacheTimer = window.setInterval(() => {
      this.saveLocalCache();
    }, LOCAL_CACHE_INTERVAL_MS);
  }

  restoreLocalCache() {
    if (!this.localCacheAvailable()) return false;
    try {
      const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      const model = cached?.model || cached;
      if (!model || typeof model !== 'object') return false;
      const hasContent = ['cards', 'events', 'custom_statuses', 'custom_tags', 'variables']
        .some(key => Array.isArray(model[key]) && model[key].length > 0);
      if (!hasContent) return false;
      this.importJson(JSON.stringify(model), { silent: true, skipCacheSave: true });
      if (KIND_CONFIG[cached.activeKind]) this.activeKind = cached.activeKind;
      this.activeWorkspaceMode = ['init', 'code'].includes(cached.activeWorkspaceMode)
        ? cached.activeWorkspaceMode
        : this.activeWorkspaceMode;
      this.updateToolbox();
      this.renderTabs();
      const arr = this.list();
      const nextIndex = Number(cached.activeIndex);
      this.activeIndex = arr.length
        ? Math.max(0, Math.min(arr.length - 1, Number.isFinite(nextIndex) ? nextIndex : 0))
        : -1;
      if (arr.length) this.loadCurrent();
      else this.clearWorkspaceAndProps();
      this.lastLocalCacheSnapshot = JSON.stringify(this.localCachePayload());
      this.showNotice('已恢复本地缓存');
      return true;
    } catch (err) {
      console.warn('本地缓存恢复失败', err);
      return false;
    }
  }

  init(workspace) {
    this.workspace = workspace;
    this.updateToolbox();
    this.workspace.addChangeListener(event => {
      const ignoredTypes = new Set(['viewport_change', 'selected', 'click', 'toolbox_item_select', 'theme_change']);
      if (!this.hasScript() || this.loadingWorkspace || ignoredTypes.has(event?.type)) return;
      this.workspaceDirty = true;
      window.clearTimeout(this.previewTimer);
      this.previewTimer = window.setTimeout(() => this.refreshPreview(), 120);
    });
    const restored = this.restoreLocalCache();
    if (!restored) {
      this.bindModInfo();
      this.renderTabs();
      this.addEntity();
    }
    this.startLocalCache();
    window.addEventListener('beforeunload', () => this.saveLocalCache({ force: true }));
  }

  reset() {
    this.saveCurrentScript();
    this.model = this.createEmptyModel();
    this.activeKind = 'cards';
    this.activeIndex = -1;
    this.updateToolbox();
    this.bindModInfo();
    this.renderTabs();
    this.addEntity();
    this.saveLocalCache({ force: true });
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

  updateToolbox() {
    if (!this.workspace || typeof this.workspace.updateToolbox !== 'function') return;
    this.workspace.updateToolbox(toolboxForKind(this.activeKind));
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
    document.getElementById('workspace-title').textContent = this.activeWorkspaceMode === 'init'
      ? `${cfg.label}初始化`
      : cfg.scriptTitle;
    document.getElementById('workspace-subtitle').textContent = this.activeWorkspaceMode === 'init'
      ? '初始化区只编辑对象的基础规则和默认属性；代码区只放会执行的逻辑块。'
      : (cfg.script
          ? '拖入触发、目标、动作、条件和变量块，导出时会生成效果列表。'
          : '变量用于脚本中的“变量”块；变量定义本身不需要画布脚本。');
    document.querySelectorAll('[data-workspace-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.workspaceMode === this.activeWorkspaceMode);
    });
    const initArea = document.getElementById('init-area');
    const blocklyArea = document.getElementById('blockly-area');
    if (initArea) initArea.classList.toggle('hidden', this.activeWorkspaceMode !== 'init');
    if (blocklyArea) blocklyArea.classList.toggle('hidden', this.activeWorkspaceMode !== 'code');
  }

  setWorkspaceMode(mode) {
    if (!['init', 'code'].includes(mode) || mode === this.activeWorkspaceMode) return;
    if (this.activeWorkspaceMode === 'code') this.saveCurrentScript();
    this.activeWorkspaceMode = mode;
    this.updateWorkspaceHeader();
    this.renderInitPanel(this.currentEntity());
    window.setTimeout(() => {
      if (this.workspace && typeof Blockly.svgResize === 'function') Blockly.svgResize(this.workspace);
    }, 0);
  }

  selectKind(kind) {
    if (!KIND_CONFIG[kind]) return;
    this.saveCurrentScript();
    this.activeKind = kind;
    this.activeIndex = -1;
    this.updateToolbox();
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
    const initArea = document.getElementById('init-area');
    if (initArea) initArea.innerHTML = '';
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
    this.renderInitPanel(entity);
    this.refreshPreview();
    if (this.activeWorkspaceMode === 'code') this.revealWorkspaceBlocks();
  }

  loadScriptWorkspace(entity) {
    const rebuildEffects = () => {
      const scriptEffects = Array.isArray(entity.script?.effects) ? entity.script.effects : [];
      const entityEffects = Array.isArray(entity.effects) ? entity.effects : [];
      return scriptEffects.length ? scriptEffects : entityEffects;
    };
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
    const fallbackEffects = rebuildEffects();
    if (loadXml(entity.script?.xml)) {
      if (!fallbackEffects.length || this.workspace.getAllBlocks(false).length > 1) return;
      this.workspace.clear();
    }
    const rebuilt = scriptFromEffects(fallbackEffects, scriptOptions(this.activeKind, entity));
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
    if (type === 'checkbox') input.checked = !!entity[key];
    else input.value = entity[key] ?? '';
    input.oninput = () => {
      entity[key] = type === 'checkbox'
        ? !!input.checked
        : (type === 'number' ? Number(input.value || 0) : input.value);
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
    if (type === 'checkbox') input.checked = !!entity[key];
    else input.value = entity[key] ?? '';
    input.oninput = () => {
      entity[key] = type === 'checkbox'
        ? !!input.checked
        : (type === 'number' ? Number(input.value || 0) : input.value);
      this.renderList();
      this.refreshPreview();
    };
    wrap.appendChild(input);
    return wrap;
  }

  tagPreviewText(entity) {
    return String(entity?.abbr || entity?.name_cn || entity?.name_en || entity?.id || 'Tag').trim() || 'Tag';
  }

  commitTagColor(entity, key, value, hooks = []) {
    entity[key] = normalizeHexColor(value, TAG_COLOR_DEFAULTS[key] || '#000000');
    for (const hook of hooks) hook();
    this.renderList();
    this.refreshPreview();
  }

  makeTagColorControl(entity, key, label, hooks = []) {
    const wrap = document.createElement('div');
    wrap.className = 'tag-color-control';

    const title = document.createElement('div');
    title.className = 'tag-color-title';
    title.textContent = label;

    const line = document.createElement('div');
    line.className = 'tag-color-line';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = normalizeHexColor(entity[key], TAG_COLOR_DEFAULTS[key]);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.spellcheck = false;
    hexInput.value = picker.value;

    const rgb = document.createElement('div');
    rgb.className = 'tag-rgb-grid';
    const rgbInputs = {};

    const syncInputs = (hex) => {
      const value = normalizeHexColor(hex, TAG_COLOR_DEFAULTS[key]);
      picker.value = value;
      hexInput.value = value;
      const parts = hexToRgb(value);
      rgbInputs.r.value = parts.r;
      rgbInputs.g.value = parts.g;
      rgbInputs.b.value = parts.b;
    };

    const commit = (hex) => {
      this.commitTagColor(entity, key, hex, [() => syncInputs(hex), ...hooks]);
    };

    for (const channel of ['r', 'g', 'b']) {
      const item = document.createElement('label');
      item.className = 'tag-rgb-channel';
      const caption = document.createElement('span');
      caption.textContent = channel.toUpperCase();
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '255';
      input.step = '1';
      rgbInputs[channel] = input;
      input.oninput = () => {
        commit(rgbToHex(rgbInputs.r.value, rgbInputs.g.value, rgbInputs.b.value));
      };
      item.append(caption, input);
      rgb.appendChild(item);
    }

    picker.oninput = () => commit(picker.value);
    hexInput.onchange = () => commit(hexInput.value);
    hexInput.onkeydown = event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit(hexInput.value);
    };

    line.append(picker, hexInput);
    wrap.append(title, line, rgb);
    syncInputs(entity[key] || TAG_COLOR_DEFAULTS[key]);
    return wrap;
  }

  makeTagColorPreview(entity) {
    const wrap = document.createElement('div');
    wrap.className = 'tag-color-preview-card';
    const label = document.createElement('span');
    label.className = 'tag-color-preview-chip';
    const update = () => {
      const bg = normalizeHexColor(entity.background, TAG_COLOR_DEFAULTS.background);
      const fg = normalizeHexColor(entity.color, readableTagTextColor(bg));
      label.textContent = this.tagPreviewText(entity);
      label.style.color = fg;
      label.style.backgroundColor = bg;
      label.style.borderColor = fg;
    };
    update();
    wrap.appendChild(label);
    return { node: wrap, update };
  }

  renderInitPanel(entity) {
    const host = document.getElementById('init-area');
    if (!host) return;
    host.innerHTML = '';
    if (!entity) return;
    const card = document.createElement('section');
    card.className = 'init-card';
    const title = document.createElement('h3');
    title.textContent = `${KIND_CONFIG[this.activeKind].label}初始化`;
    card.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'init-grid';
    card.appendChild(grid);
    const add = (...nodes) => {
      for (const node of nodes) grid.appendChild(node);
    };
    if (this.activeKind === 'cards') {
      add(
        this.fieldNode(entity, 'cost_e', 'E 消耗', 'number'),
        this.fieldNode(entity, 'cost_m', 'M 消耗', 'number'),
        this.fieldNode(entity, 'count', '牌池数量/权重', 'number'),
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
        this.fieldNode(entity, 'trigger_cost_e', '装备触发 E（-1 表示不可触发）', 'number'),
        this.fieldNode(entity, 'response_trigger', '反制响应类型'),
        this.fieldNode(entity, 'trigger_effect_text', '装备触发文字'),
      );
      const flagCard = document.createElement('section');
      flagCard.className = 'init-card';
      this.renderFlags(flagCard, entity);
      host.append(card, flagCard);
      return;
    }
    if (this.activeKind === 'events') {
      add(this.fieldNode(entity, 'position', '位置权重', 'number'));
      const help = document.createElement('div');
      help.className = 'init-help';
      help.textContent = '开局事件的名称和描述在右侧编辑；具体效果在代码区编辑。';
      card.appendChild(help);
    } else if (this.activeKind === 'statuses') {
      add(
        this.fieldNode(entity, 'display_text', '状态栏显示模板'),
        this.fieldNode(entity, 'max_stacks', '最大层数', 'number'),
        this.fieldNode(entity, 'stackable', '允许叠加', 'checkbox'),
        this.fieldNode(entity, 'keep_when_zero', '层数为 0 时不清除本状态', 'checkbox'),
      );
      const help = document.createElement('div');
      help.className = 'init-help';
      help.textContent = '默认规则：状态层数降到 0 或以下时自动消除；勾选后会保留 0 层状态。';
      card.appendChild(help);
    } else if (this.activeKind === 'tags') {
      add(
        this.fieldNode(entity, 'category', '标签属性', 'select', [
          ['通用关键词', 'keyword'],
          ['装备标签', 'equipment'],
          ['目标限制', 'targeting'],
          ['规则修饰', 'rule'],
          ['隐藏标记', 'hidden'],
        ]),
        this.fieldNode(entity, 'visible', '在卡牌上显示', 'checkbox'),
        this.fieldNode(entity, 'stackable', '允许重复/叠加', 'checkbox'),
        this.fieldNode(entity, 'abbr', '短显示名'),
      );
      const preview = this.makeTagColorPreview(entity);
      add(
        preview.node,
        this.makeTagColorControl(entity, 'color', '文字颜色', [preview.update]),
        this.makeTagColorControl(entity, 'background', '背景颜色', [preview.update]),
      );
    } else if (this.activeKind === 'variables') {
      add(
        this.fieldNode(entity, 'scope', '作用域', 'select', [
          ['玩家变量（每个玩家各自拥有）', 'player'],
          ['队伍变量（2v2 队伍共享）', 'team'],
          ['全局变量（整局共享）', 'global'],
        ]),
        this.fieldNode(entity, 'initial', '初始值', 'number'),
      );
    }
    host.appendChild(card);
  }

  renderCardProps(host, entity) {
    this.addField(host, entity, 'id', '卡牌 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'effect_text', '效果描述', 'textarea');
    this.addField(host, entity, 'description', '趣味描述', 'textarea');
  }

  renderFlags(host, entity) {
    const wrap = document.createElement('label');
    wrap.textContent = '标签';
    const grid = document.createElement('div');
    grid.className = 'flag-grid';
    const selected = new Set(entity.flags || []);
    const commit = () => {
      entity.flags = Array.from(selected);
      this.refreshPreview();
    };
    for (const [label, flag] of flagOptionsForModel(this.model, entity.flags || [])) {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(flag);
      input.onchange = () => {
        if (input.checked) selected.add(flag);
        else selected.delete(flag);
        commit();
      };
      row.append(input, document.createTextNode(label));
      grid.appendChild(row);
    }
    const customRow = document.createElement('div');
    customRow.className = 'flag-custom';
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '输入标签ID';
    const customButton = document.createElement('button');
    customButton.type = 'button';
    customButton.textContent = '添加';
    customButton.onclick = () => {
      const value = String(customInput.value || '').trim();
      if (!value) return;
      selected.add(value);
      commit();
      this.renderProps(entity);
      this.renderInitPanel(entity);
    };
    customInput.onkeydown = event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      customButton.click();
    };
    customRow.append(customInput, customButton);
    wrap.appendChild(grid);
    wrap.appendChild(customRow);
    host.appendChild(wrap);
  }

  renderEventProps(host, entity) {
    this.addField(host, entity, 'id', '事件 ID', 'number');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'desc', '效果描述', 'textarea');
  }

  renderStatusProps(host, entity) {
    this.addField(host, entity, 'id', '状态 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'desc', '效果描述', 'textarea');
  }

  renderTagProps(host, entity) {
    this.addField(host, entity, 'id', '标签 ID');
    this.addRow(host, [
      this.fieldNode(entity, 'name_cn', '中文名'),
      this.fieldNode(entity, 'name_en', '英文名'),
    ]);
    this.addField(host, entity, 'desc', '效果描述', 'textarea');
  }

  renderVariableProps(host, entity) {
    this.addField(host, entity, 'id', '变量 ID');
    this.addField(host, entity, 'name', '变量名');
    this.addField(host, entity, 'desc', '效果描述', 'textarea');
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
      editor: editorExportMeta(),
      info: this.model.info,
      variables: this.model.variables.map(exportEntity),
      cards: this.model.cards.map(card => {
        const effects = ensureRootEquipEffect(card, card.script?.effects || card.effects || []);
        const exported = { ...exportEntity(card), effects, scripts: exportCardRuntimeScripts(card, effects) };
        const response = findResponseDeclare(effects);
        if (response) {
          exported.response_trigger = response.timing || exported.response_trigger || 'thorn';
          if (response.cost_e !== undefined && response.cost_e !== '') exported.cost_e = Number(response.cost_e) || 0;
          if (response.cost_m !== undefined && response.cost_m !== '') exported.cost_m = Number(response.cost_m) || 0;
          exported.response_title = response.title || '';
          exported.response_content = response.content || '';
        }
        return exported;
      }),
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

  importJson(text, options = {}) {
    const data = JSON.parse(text);
    const info = data.info || data.meta || {};
    const scripts = data.scripts || {};
    const attach = (kind, arr) => (Array.isArray(arr) ? arr : []).map(item => {
      const key = scriptKey(kind, item.id);
      const legacyEffects = itemEffects(kind, item);
      const runtimeEffects = kind === 'cards' ? runtimeEffectsForEditor(item) : null;
      const fallbackEffects = runtimeEffects !== null ? runtimeEffects : legacyEffects;
      const importedScript = scripts[key] || scripts[`${key}:play`] || item.script || null;
      const script = importedScript && (importedScript.xml || hasEffects(importedScript))
        ? importedScript
        : defaultScript(fallbackEffects, kind, item);
      return {
        ...(kind === 'statuses' ? { keep_when_zero: false } : {}),
        ...(kind === 'tags' ? {
          visible: true,
          stackable: false,
          category: 'keyword',
          color: TAG_COLOR_DEFAULTS.color,
          background: TAG_COLOR_DEFAULTS.background,
        } : {}),
        ...item,
        effects: fallbackEffects,
        script: ensureScriptXml(script, fallbackEffects, scriptOptions(kind, item)),
      };
    });
    this.saveCurrentScript();
    this.model = {
      format_version: 1,
      editor: data.editor || editorExportMeta(),
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
    this.updateToolbox();
    this.renderTabs();
    if (this.list().length) this.selectEntity(0);
    else this.addEntity();
    if (!options.skipCacheSave) this.saveLocalCache({ force: true });
    if (options.silent) return;
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
if (typeof window !== 'undefined') {
  window.gardenModStudio = studio;
}
