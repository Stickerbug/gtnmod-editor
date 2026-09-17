import JSZip from 'jszip';
import { createEffectEditor } from './effect-editor.js';
import opCatalog from './generated/op-catalog.json';
import opSchema from './generated/op-schema.json';
import { cardTextRules } from './gtn-text/index.js';

/* 运行时全量 op（生成契约）= 有块的 op + 只有运行时支持的 op */
const opSchemaOps = new Set([
  ...Object.keys(opSchema.ops || {}),
  ...(opSchema.runtimeOnly || []),
]);
/* 版本号与构建时间（vite define 注入）：界面顶部显示，用来确认浏览器加载的是哪一版 */
const STUDIO_VERSION = (typeof __GTN_STUDIO_VERSION__ !== 'undefined') ? __GTN_STUDIO_VERSION__ : 'dev';
const STUDIO_BUILD_STAMP = (typeof __GTN_STUDIO_BUILD_STAMP__ !== 'undefined') ? __GTN_STUDIO_BUILD_STAMP__ : 'dev';
const STUDIO_BUILT_AT = (typeof __GTN_STUDIO_BUILT_AT__ !== 'undefined') ? __GTN_STUDIO_BUILT_AT__ : '';
/* 游戏内置标签（来自生成的术语表）：官方包里大量使用它们，不该报"未定义标签" */
const builtinTags = new Set(Object.keys(cardTextRules.tagLabels || {}));

/* Blockly 已整体移除：逻辑编辑只走效果行编辑器（src/effect-editor.js）。
   下面这些名字只为遗留调用点保留成空实现，`this.workspace` 永远是 null，
   所以那些分支都会安全地提前返回；后续可逐步删干净。 */
const BLOCK_CATEGORIES = [];
const BLOCK_REGISTRY = [];
/* Blockly 本体已移除；保留同名桩，让遗留的 Blockly.inject 调用安全返回 null，
   逻辑编辑完全由效果行编辑器承担。 */
const Blockly = {
  inject: () => null,
  svgResize: () => {},
  Theme: { defineTheme: (name, config) => config },
  Themes: { Classic: {} },
};
const makeV2Toolbox = () => ({});
const registerV2Blocks = () => {};
const loadWorkspaceJson = () => {};
const stepsToWorkspaceJson = () => ({});
const workspaceToJson = () => ({});
const workspaceToSteps = () => [];

/* 事件钩子下拉的取值（原在 v2BlockRegistry.js，现就地保留） */
const hookOptions = [
  ['打出卡牌前', 'before_play_card'],
  ['打出卡牌后', 'after_play_card'],
  ['伤害前', 'before_damage'],
  ['修改伤害', 'modify_damage'],
  ['伤害后', 'after_damage'],
  ['回合开始', 'turn_start'],
  ['回合结束', 'turn_end'],
  ['抽牌前', 'before_draw'],
  ['抽牌后', 'after_draw'],
  ['状态添加', 'status_added'],
  ['装备摧毁', 'equipment_destroyed'],
];

const AUTOSAVE_KEY = 'gtn_mod_studio_autosave_v2';
const AUTOSAVE_INTERVAL_MS = 30000;

/* 包内图片单独存一份缓存（用另一个 localStorage key，不进 mod.json、不进导出包）。
   不缓存的话刷新页面后 blob URL 全部失效，预览里的卡图会变空。 */
const ASSET_CACHE_KEY = 'gtn_mod_studio_assets_v1';
const ASSET_CACHE_MAX_BYTES = 2500000;

const IMAGE_MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

/* JSZip 给 .svg 猜的 MIME 是 text/plain，直接拿去当图片用会被浏览器拒画
   （表现为卡图区域空白）。一律按扩展名给 MIME。 */
function imageMimeTypeForName(name) {
  const match = String(name || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return (match && IMAGE_MIME_BY_EXT[match[0]]) || 'application/octet-stream';
}

function bytesToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlFromBuffer(buffer, mime) {
  return `data:${mime};base64,${bytesToBase64(buffer)}`;
}

function blobFromDataUrl(dataUrl) {
  const match = /^data:([^;,]*)(;base64)?,/i.exec(String(dataUrl || ''));
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const body = String(dataUrl).slice(match[0].length);
  try {
    if (!match[2]) return new Blob([decodeURIComponent(body)], { type: mime });
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch (_) {
    return null;
  }
}

const CAPABILITIES = [
  'cards',
  'tags',
  'statuses',
  'opening_events',
  /* 与游戏 mod_spec_v2.VALID_CAPABILITIES 保持一致，别漏（漏了会把官方包的
     ui_components / compatibility 当成"未知 capability"报警）。 */
  'ui_components',
  'ui.modal',
  'ui.choice',
  'ui.visual_limited',
  'patches',
  'compatibility',
  'event_hooks',
  'logic_dsl',
  'logic.basic',
  'logic.advanced',
  'localization',
];

const CARD_TYPES = [
  ['攻击', 'thorn'],
  ['技能', 'bloom'],
  ['反制', 'guard'],
  ['装备', 'root'],
];

const CARD_TYPE_META = {
  thorn: { label: 'Thorn', color: '#C0392B' },
  bloom: { label: 'Bloom', color: '#2E8B57' },
  guard: { label: 'Guard', color: '#2F80C1' },
  root: { label: 'Root', color: '#7D5A2B' },
};

const QUALITY = ['Common', 'Unusual', 'Epic', 'Ultra', 'Super'];

/* 与引擎 `mod_runtime_v2` 同名词表（发布期校验在 mod_validator_v2，两条路同一份口径）：
   INPUT_VALUE_TYPES / TEXT_INPUT_NORMALIZES / TEXT_INPUT_MODERATIONS /
   REQUEST_UI_ON_INVALID_VALUES / TEXT_INPUT_HARD_MAX_LENGTH。
   编辑器本地校验用它们当场报错，省得等导出后服务端才拒。 */
const UI_INPUT_VALUE_TYPES = ['text', 'string', 'number', 'int', 'float'];
const UI_TEXT_NORMALIZES = ['none', 'trim', 'lower', 'trim_lower'];
const UI_TEXT_MODERATIONS = ['mask', 'reject', 'off'];
const UI_TEXT_HARD_MAX_LENGTH = 200;
const UI_REQUEST_ON_INVALID = ['close', 'keep'];

const TOKEN_ACCENTS = ['neutral', 'thorn', 'bloom', 'root', 'guard', 'magic', 'fire', 'poison'];
const PANEL_TOKENS = ['solid', 'glass', 'parchment'];
const SIZE_TOKENS = ['small', 'medium', 'large'];
const ICON_TOKENS = ['mana', 'fire', 'leaf', 'shield', 'thorn', 'heart', 'skull'];
// 与引擎 `mod_spec_v2.VALID_UI_CONTROL_TYPES`（20 个）**同一张表**：
// 引擎把 radio_group/zone_picker 归一到 select、divider/warning_text/dynamic_text/
// preview_value 归一到 text（见 mod_runtime_v2.UI_CONTROL_TYPE_ALIASES）。
// 以前这里还有 button / button_group：一个响应只有一个 `button` + `values`，
// 控件级按钮要改响应协议，所以先收掉（按钮写在组件的 buttons 上）。
const UI_CONTROL_TYPES = [
  // 文本族
  'text',
  'text_input',
  'input',
  'dynamic_text',
  'divider',
  'warning_text',
  'preview_value',
  // 数值族
  'slider',
  'number',
  'number_input',
  // 选择族
  'select',
  'radio_group',
  'checkbox',
  'multi_select',
  // 选牌族
  'card_picker',
  'card_catalog_picker',
  'multi_card_picker',
  'equipment_picker',
  'multi_equipment_picker',
  // 选人/选区域
  'player_picker',
  'target_picker',
  'zone_picker',
];

// 与引擎 `mod_spec_v2.VALID_UI_COMPONENT_TYPES`（16 个）同一张表。
const UI_COMPONENT_TYPES = [
  'modal',
  'confirm',
  'text',
  'select',
  'slider',
  'number',
  'number_input',
  'checkbox',
  'multi_select',
  'card_picker',
  'card_catalog_picker',
  'multi_card_picker',
  'equipment_picker',
  'multi_equipment_picker',
  'player_picker',
  'target_picker',
];

const PATCH_OPS = [
  'add_tag',
  'remove_tag',
  'append_event_steps',
  'prepend_event_steps',
  'add_description_line',
  'modify_numeric_field',
  'add_ui_style_token',
];

const RESOURCE_GROUPS = [
  { key: 'manifest', label: 'Manifest', singular: 'Manifest' },
  { key: 'cards', label: '卡牌', singular: '卡牌' },
  { key: 'tags', label: '标签', singular: '标签' },
  { key: 'statuses', label: '状态', singular: '状态' },
  { key: 'opening_events', label: '开局事件', singular: '开局事件' },
  { key: 'ui_components', label: 'UI 组件', singular: 'UI 组件' },
  { key: 'event_hooks', label: '事件 Hook', singular: '事件 Hook' },
  { key: 'patches', label: '补丁', singular: '补丁' },
  { key: 'compatibility', label: '兼容补丁', singular: '兼容补丁' },
  { key: 'test_lab', label: '测试实验室', singular: '测试实验室' },
];

const RESOURCE_LABELS = Object.fromEntries(RESOURCE_GROUPS.map(item => [item.key, item]));

const EVENT_SETS = {
  cards: [
    ['on_play', '打出时'],
    ['on_response', '作为反制响应时'],
    ['on_equip', '装备时'],
    ['on_equipment_trigger', '装备主动触发时'],
    ['on_owner_turn_start', '持有者回合开始时'],
    ['on_enemy_turn_start', '敌方回合开始时'],
    ['on_any_turn_start', '任意玩家回合开始时'],
    ['on_damage_taken', '装备者受到伤害时'],
    ['on_equipment_destroy', '装备被摧毁时'],
    ['on_fatal_set_health_exile', '持有者将失败时'],
    ['on_enter_hand', '进入手牌时'],
    ['on_hand_owner_turn_start', '在手牌中且持有者回合开始时'],
    ['on_discard', '进入弃牌堆时'],
    ['on_discard_owner_turn_start', '在弃牌堆中且持有者回合开始时'],
    ['on_exile', '放逐时'],
    ['on_turn_start_while_equipped', '装备者回合开始时'],
    ['on_before_destroyed', '被摧毁前'],
  ],
  statuses: [
    ['on_apply', '添加时'],
    ['on_remove', '移除时'],
    ['on_turn_start', '持有者回合开始时'],
    ['on_turn_end', '持有者回合结束时'],
    ['on_damage_taken', '持有者受到伤害时'],
    ['on_damage_dealt', '持有者造成伤害时'],
    ['on_before_play_card', '持有者打牌前'],
    ['on_after_play_card', '持有者打牌后'],
  ],
  opening_events: [['on_apply', '应用时']],
  event_hooks: [['steps', '执行步骤']],
  patches: [['steps', '补丁步骤']],
};

const DOCS = {
  manifest: 'Manifest 定义模组命名空间、版本、依赖、能力和加载顺序。社区 v2 模组必须使用非保留命名空间。',
  cards: '卡牌的真实效果来自 events.steps。类型只作为游戏选择器和 UI 颜色，不应决定真实逻辑。',
  tags: '标签是可被卡牌、状态、伤害或 UI 引用的资源。自定义标签必须使用命名空间 ID。',
  statuses: '状态支持层数、持续时间、唯一化和事件触发。状态层数为 0 时默认清除。',
  opening_events: '开局事件可以定义位置、权重和应用逻辑，并可通过 request_ui 请求受控选择。',
  ui_components: 'UI 组件只能使用受控 schema 和样式 token，不能包含任意 HTML/CSS/JS。',
  event_hooks: '事件钩子监听全局游戏事件，按 priority 和 mod_id 稳定排序执行。',
  patches: '补丁只能执行白名单操作，用于安全修改已有资源。',
  compatibility: '兼容补丁在可选模组存在时启用，适合处理扩展包之间的联动。',
  test_lab: 'Test Lab 使用当前草稿做静态诊断和轻量模拟，不替代服务器运行时测试。',
};

function defaultDraft() {
  return {
    format_version: 2,
    manifest: {
      id: 'my_mod',
      name: 'New GTN Mod',
      version: '0.1.0',
      api_version: '2.0',
      author: '',
      description: '',
      capabilities: ['cards', 'logic.basic'],
      dependencies: [],
      optional_dependencies: [],
      conflicts: [],
      load_before: [],
      load_after: [],
    },
    registries: {
      cards: [makeCard('basic_attack')],
      tags: [],
      statuses: [],
      opening_events: [],
      ui_components: [],
    },
    event_hooks: [],
    patches: [],
    compatibility: [],
    editor: {
      workspaces: {},
      ui_layouts: {},
      version: 1,
    },
  };
}

function makeCard(id = 'new_card') {
  return {
    id,
    name_cn: '新卡牌',
    name_en: titleize(id),
    description: '',
    effect_text: '',
    card_type: 'thorn',
    cost_e: 1,
    cost_m: 0,
    count: 3,
    quality: 'Common',
    icon: '',
    color: '',
    tags: [],
    events: {},
  };
}

function makeTag(id = 'new_tag') {
  return {
    id,
    name_cn: '新标签',
    name_en: titleize(id),
    description: '',
    color: '#62748e',
    icon: 'thorn',
    applies_to: ['card'],
  };
}

function makeStatus(id = 'new_status') {
  return {
    id,
    name_cn: '新状态',
    name_en: titleize(id),
    description: '',
    icon: 'shield',
    color: '#64748b',
    visible: true,
    show_stack: true,
    stacking: 'stack',
    max_stack: 0,
    decay_timing: 'none',
    clear_on_death: true,
    keep_when_zero: false,
    events: {},
  };
}

function makeOpeningEvent(id = 'new_event') {
  return {
    id,
    name_cn: '新开局事件',
    name_en: titleize(id),
    description: '',
    position: 1,
    weight: 1,
    unique: false,
    requires_ui_choice: false,
    events: {},
  };
}

function makeUiComponent(id = 'new_window') {
  return {
    id,
    type: 'modal',
    title_cn: '新窗口',
    title_en: 'New Window',
    controls: [
      { id: 'message', type: 'text', label_cn: '文本', label_en: 'Text', text_cn: '请选择一个选项。', text_en: 'Choose an option.' },
    ],
    buttons: [
      { id: 'confirm', text_cn: '确认', text_en: 'Confirm', role: 'confirm' },
      { id: 'cancel', text_cn: '取消', text_en: 'Cancel', role: 'cancel' },
    ],
    style: { accent: 'neutral', icon: 'thorn', panel: 'solid', size: 'medium', layout: 'vertical' },
  };
}

function makeHook() {
  return {
    id: cryptoRandomId('hook'),
    hook: 'modify_damage',
    priority: 100,
    filter: {},
    steps: [],
  };
}

function makePatch() {
  return {
    id: cryptoRandomId('patch'),
    target_type: 'card',
    target: '',
    op: 'add_tag',
    value: '',
  };
}

function makeCompatibility() {
  return {
    id: cryptoRandomId('compat'),
    if_mod_loaded: '',
    patches: [],
  };
}

function cryptoRandomId(prefix) {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function titleize(value) {
  return String(value || 'New Card')
    .split(/[_:\-/\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function colorizeCardPreviewText(value) {
  const escaped = escapeHtml(value || '');
  return escaped
    .replace(/([+-]?\d+(?:\.\d+)?(?:\s*[×x]\s*\d+)?D(?:\s*[×x]\s*\d+)?)/g, '<span class="card-token damage">$1</span>')
    .replace(/([+-]?\d+A)/g, '<span class="card-token armor">$1</span>')
    .replace(/([+-]?\d+H)/g, '<span class="card-token heal">$1</span>')
    .replace(/([+-]?\d+E)/g, '<span class="card-token elixir">$1</span>')
    .replace(/([+-]?\d+M)/g, '<span class="card-token magic">$1</span>')
    .replace(/(\d+\s*层\s*F|\d+F)/g, '<span class="card-token fire">$1</span>')
    .replace(/(\d+\s*层\s*P|\d+P)/g, '<span class="card-token poison">$1</span>')
    .replace(/(\d+\s*层\s*淬毒)/g, '<span class="card-token toxic">$1</span>')
    .replace(/\n/g, '<br>');
}

function slugify(value, fallback = 'new_resource') {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return text || fallback;
}

function namespaceOf(draft) {
  /* 资源命名空间：DLC / 扩展包会声明 manifest.resource_namespace（例如 id=bio_dlc、
     resource_namespace=bio、卡牌 id 全是 bio:*）。服务端 mod_validator_v2 就是按
     `resource_namespace or manifest.id` 校验的，这里必须跟它一致。 */
  const declared = String(draft?.manifest?.resource_namespace || '').trim();
  return slugify(declared || draft?.manifest?.id || 'my_mod', 'my_mod').replaceAll('/', '_');
}

function normalizeResourceId(draft, raw, fallback = 'new_resource') {
  const text = String(raw || '').trim();
  if (!text) return `${namespaceOf(draft)}:${fallback}`;
  if (text.includes(':')) {
    const [ns, path] = text.split(':', 2);
    return `${slugify(ns, namespaceOf(draft)).replaceAll('/', '_')}:${slugify(path, fallback)}`;
  }
  return `${namespaceOf(draft)}:${slugify(text, fallback)}`;
}

function shortId(draft, id) {
  const ns = `${namespaceOf(draft)}:`;
  const text = String(id || '');
  return text.startsWith(ns) ? text.slice(ns.length) : text;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const text = typeof value === 'string' ? value : canonical(value);
  if (!crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return `local-${Math.abs(hash).toString(16)}`;
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function listTextToDeps(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([a-z0-9_]+)(?:\s*@\s*(.+))?$/);
      return match ? { id: match[1], version: match[2] || '' } : { id: line, version: '' };
    });
}

function depsToListText(value) {
  return Array.isArray(value)
    ? value.map(item => typeof item === 'string' ? item : `${item.id || ''}${item.version ? ` @ ${item.version}` : ''}`).join('\n')
    : '';
}

function parseJsonField(text, fallback) {
  try {
    const parsed = JSON.parse(text || '');
    return parsed;
  } catch (_) {
    return fallback;
  }
}

/* Round 91 / 批次 CN：「既能写普通值、又能写取值表达式」的字段用这一档：
   合法 JSON（数字 / 字符串 / {"op":…} 表达式）按 JSON 解析，其它按原文字符串存。
   引擎侧这些参数都吃取值表达式（`eval_v2_value`），以前编辑器把它们存成**字符串**，
   表达式就静默失效了。 */
function parseJsonOrTextField(text, fallback) {
  const raw = String(text ?? '').trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

function arrayFromCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function csvFromArray(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function isSupportedImageName(name) {
  return /\.(svg|webp|png|jpe?g)$/i.test(String(name || ''));
}

function packageMainFileName(zip) {
  const names = Object.keys(zip.files || {});
  const exact = names.find(name => ['mod.json', 'gtnmod.json'].includes(name.toLowerCase()));
  if (exact) return exact;
  return names.find(name => /^[^/]+\.json$/i.test(name)) || '';
}

function safeAssetPath(name, fallback = 'image.svg') {
  const cleaned = String(name || fallback)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[^a-zA-Z0-9_. -]+/g, '_')
    .trim() || fallback;
  return `card-art/${cleaned.replace(/\s+/g, '')}`;
}

function isRuntimeGeneratedImageUrl(value) {
  const text = String(value || '').trim();
  return text.startsWith('/api/mod-assets/')
    || text.startsWith('/static/assets/mod-card-art/')
    || text.startsWith('data:image/');
}

function isPackagedAssetPath(value) {
  const text = String(value || '').replace(/\\/g, '/').trim();
  return /^(assets\/cards|assets\/card-art|card-art|cards)\//i.test(text) && isSupportedImageName(text);
}

function cardAssetLookupKeys(card) {
  const rawIds = [
    card?.legacy_id,
    card?.id,
    shortId({ manifest: { id: '' } }, card?.id || ''),
    card?.name_en,
    card?.name_cn,
  ].filter(Boolean);
  const forms = new Set();
  for (const raw of rawIds) {
    const text = String(raw || '').trim();
    if (!text) continue;
    forms.add(text);
    forms.add(text.toLowerCase());
    forms.add(text.replace(/\s+/g, ''));
    forms.add(text.toLowerCase().replace(/\s+/g, ''));
    forms.add(text.toLowerCase().replace(/[_\-\s]+/g, ''));
  }
  const candidates = [];
  for (const form of forms) {
    for (const folder of ['assets/cards', 'assets/card-art', 'card-art', 'cards']) {
      for (const ext of ['.svg', '.webp', '.png', '.jpg', '.jpeg']) {
        candidates.push(`${folder}/${form}${ext}`.toLowerCase());
      }
    }
  }
  return candidates;
}

function pluralKey(kind) {
  if (kind === 'event_hooks') return 'event_hooks';
  if (kind === 'patches') return 'patches';
  if (kind === 'compatibility') return 'compatibility';
  return kind;
}

export class GtnModStudio {
  constructor(root) {
    this.root = root;
    this.modDraft = defaultDraft();
    this.selectedKind = 'manifest';
    this.selectedId = null;
    this.centerTab = '基础信息';
    this.inspectorTab = '属性';
    this.bottomTab = '校验结果';
    this.searchQuery = '';
    this.filterKind = 'all';
    this.currentWorkspaceKey = '';
    this.currentWorkspaceMeta = null;
    this.workspace = null;
    this.selectedEvent = 'on_play';
    this.selectedUiControlIndex = 0;
    this.validation = { errors: [], warnings: [], refs: [] };
    this.testLogs = [];
    this.runtimeErrors = [];
    this.diffText = '';
    this.contentHash = '';
    this.savedHash = '';
    this.dirty = false;
    this.changeTimer = null;
    this.autosaveTimer = null;
    this.cardPreviewHold = null;
    this.assetFiles = new Map();
    this.assetObjectUrls = new Map();
    this.assetDataUrls = new Map();
    /* 「从服务器导入」的清单缓存与筛选词 */
    this.serverModList = null;
    this.serverModError = '';
    this.serverModFilter = '';
  }

  async init() {
    registerV2Blocks();
    this.renderShell();
    this.bindGlobalEvents();
    this.restoreAssetCache();
    this.tryLoadAutosave();
    this.ensureInitialSelection();
    await this.refreshCompiledState({ validate: true });
    this.renderAll();
    this.autosaveTimer = setInterval(() => this.saveDraft(), AUTOSAVE_INTERVAL_MS);
  }

  renderShell() {
    this.root.innerHTML = `
      <div class="studio-shell">
        <header class="studio-topbar">
          <div class="studio-brand">
            <img class="studio-mark" src="./mod-editor-icon.svg" alt="" aria-hidden="true">
            <div class="studio-title-block">
              <strong>GTN Mod Studio <span class="studio-version" id="studio-version" title="构建时间（服务器本地时间）：${STUDIO_BUILD_STAMP}｜UTC：${STUDIO_BUILT_AT}">v${STUDIO_VERSION}</span></strong>
              <span id="studio-subtitle">format_version=2 · 可视化声明式 DSL</span>
            </div>
          </div>
          <div class="studio-toolbar">
            <button class="studio-btn" data-action="save-draft">保存草稿</button>
            <button class="studio-btn" data-action="import-json">导入 JSON / GTNMOD</button>
            <button class="studio-btn" data-action="import-server" title="读取服务器 /mods/ 上已经部署的包（和游戏正在加载的是同一份）">从服务器导入…</button>
            <button class="studio-btn primary" data-action="export-json">导出 .gtnmod</button>
            <button class="studio-btn" data-action="validate">校验</button>
            <button class="studio-btn" data-action="test-run">测试运行</button>
            <button class="studio-btn" data-action="reset-local" title="清除浏览器里保存的草稿与图片缓存（不影响已导出的文件）">重置本地草稿</button>
          </div>
          <div class="studio-state">
            <span id="studio-status-pill" class="status-pill">未保存</span>
            <code id="studio-hash">hash: --</code>
          </div>
        </header>

        <main class="studio-main">
          <aside class="studio-left">
            <div class="panel-title-row">
              <div>
                <strong>资源树</strong>
                <span>资源、引用与模板</span>
              </div>
              <button class="icon-button" data-action="add-resource" title="新建资源">+</button>
            </div>
            <div class="resource-search">
              <input id="resource-search-input" placeholder="搜索资源或积木">
              <select id="resource-filter">
                <option value="all">全部类型</option>
                ${RESOURCE_GROUPS.filter(g => !['manifest', 'test_lab'].includes(g.key)).map(g => `<option value="${g.key}">${g.label}</option>`).join('')}
              </select>
            </div>
            <div class="resource-actions">
              <button class="studio-btn small" data-action="duplicate-resource">复制</button>
              <button class="studio-btn small" data-action="delete-resource">删除</button>
              <button class="studio-btn small" data-action="find-refs">查找引用</button>
            </div>
            <div id="resource-tree" class="resource-tree"></div>
          </aside>

          <section class="studio-center">
            <div id="center-editor" class="center-editor"></div>
          </section>

          <aside class="studio-right">
            <div class="inspector-tabs" id="inspector-tabs">
              ${['属性', '文档', '引用', '错误', 'JSON'].map(tab => `<button data-inspector-tab="${tab}">${tab}</button>`).join('')}
            </div>
            <div id="inspector-body" class="inspector-body"></div>
          </aside>
        </main>

        <footer class="studio-bottom">
          <div class="bottom-tabs" id="bottom-tabs">
            ${['校验结果', '测试日志', '运行时错误', '生成 JSON', 'Diff'].map(tab => `<button data-bottom-tab="${tab}">${tab}</button>`).join('')}
          </div>
          <div id="bottom-body" class="bottom-body"></div>
        </footer>
      </div>
      <input id="json-file-input" type="file" accept=".json,.gtnmod,application/json,application/zip" hidden>
      <input id="card-image-file-input" type="file" accept=".svg,.webp,.png,.jpg,.jpeg,image/svg+xml,image/webp,image/png,image/jpeg" hidden>
    `;
  }

  bindGlobalEvents() {
    this.root.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        this.handleAction(actionButton.dataset.action, actionButton);
        return;
      }
      const resourceButton = event.target.closest('[data-resource-kind]');
      if (resourceButton) {
        this.selectResource(resourceButton.dataset.resourceKind, resourceButton.dataset.resourceId || null);
        return;
      }
      const tabButton = event.target.closest('[data-center-tab]');
      if (tabButton) {
        this.saveWorkspace();
        this.centerTab = tabButton.dataset.centerTab;
        this.renderCenter();
        this.renderInspector();
        return;
      }
      const eventButton = event.target.closest('[data-event-key]');
      if (eventButton) {
        this.saveWorkspace();
        this._pinnedEvent = '';
        this.selectedEvent = eventButton.dataset.eventKey;
        this.renderCenter();
        return;
      }
      const removeEventButton = event.target.closest('[data-remove-event]');
      if (removeEventButton) {
        this.removeEvent(removeEventButton.dataset.removeEvent);
        return;
      }
      const inspectorButton = event.target.closest('[data-inspector-tab]');
      if (inspectorButton) {
        this.inspectorTab = inspectorButton.dataset.inspectorTab;
        this.renderInspector();
        return;
      }
      const bottomButton = event.target.closest('[data-bottom-tab]');
      if (bottomButton) {
        this.bottomTab = bottomButton.dataset.bottomTab;
        this.renderBottom();
      }
    });

    this.root.addEventListener('input', event => {
      const target = event.target;
      if (target.id === 'resource-search-input') {
        this.searchQuery = target.value;
        this.renderResourceTree();
        return;
      }
      if (target.matches('[data-bind]')) {
        this.updateBoundValue(target);
      }
    });

    this.root.addEventListener('change', event => {
      const target = event.target;
      if (target.id === 'resource-filter') {
        this.filterKind = target.value;
        this.renderResourceTree();
        return;
      }
      if (target.matches('[data-add-event]')) {
        this.addEvent(target.value);
        return;
      }
      if (target.matches('[data-bind]')) {
        this.updateBoundValue(target);
      }
    });

    const fileInput = this.root.querySelector('#json-file-input');
    fileInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      await this.importModFile(file);
      fileInput.value = '';
    });

    const imageInput = this.root.querySelector('#card-image-file-input');
    imageInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      await this.attachImageToCurrentCard(file);
      imageInput.value = '';
    });

    window.addEventListener('resize', () => {
      if (this.workspace) Blockly.svgResize(this.workspace);
    });
    window.addEventListener('beforeunload', () => {
      try {
        this.saveWorkspace();
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.modDraft));
        this.persistAssetCache();
      } catch (_) {
        // Ignore shutdown-time storage failures.
      }
    });
    this.root.addEventListener('pointerdown', event => this.handleCardPreviewPointerDown(event));
    this.root.addEventListener('pointermove', event => this.handleCardPreviewPointerMove(event));
    this.root.addEventListener('pointerup', () => this.clearCardPreviewHold());
    this.root.addEventListener('pointercancel', () => this.clearCardPreviewHold());
  }

  async handleAction(action, button) {
    if (action === 'save-draft') {
      await this.saveDraft();
      this.toast('草稿已保存');
    } else if (action === 'import-json') {
      this.root.querySelector('#json-file-input').click();
    } else if (action === 'import-server') {
      await this.openServerImport();
    } else if (action === 'export-json') {
      await this.exportJson();
    } else if (action === 'validate') {
      await this.refreshCompiledState({ validate: true });
      this.bottomTab = '校验结果';
      this.renderAll();
      this.toast(this.validation.errors.length ? '校验存在错误' : '校验通过');
    } else if (action === 'test-run') {
      await this.runTestLab();
      this.bottomTab = '测试日志';
      this.renderAll();
    } else if (action === 'reset-local') {
      this.resetLocalState();
    } else if (action === 'add-resource') {
      this.addResource();
    } else if (action === 'duplicate-resource') {
      this.duplicateResource();
    } else if (action === 'delete-resource') {
      this.deleteResource();
    } else if (action === 'find-refs') {
      this.inspectorTab = '引用';
      this.renderInspector();
    } else if (action === 'add-template') {
      this.addTemplate(button.dataset.template);
    } else if (action === 'add-ui-control') {
      this.addUiControl();
    } else if (action === 'delete-ui-control') {
      this.deleteUiControl(Number(button.dataset.index));
    } else if (action === 'add-ui-button') {
      this.addUiButton();
    } else if (action === 'delete-ui-button') {
      this.deleteUiButton(Number(button.dataset.index));
    } else if (action === 'select-ui-control') {
      this.selectedUiControlIndex = Number(button.dataset.index);
      this.renderCenter();
    } else if (action === 'copy-event-json') {
      await navigator.clipboard.writeText(JSON.stringify(this.currentEventSteps(), null, 2));
      this.toast('事件 AST 已复制');
    } else if (action === 'clear-event-workspace') {
      if (this.workspace) {
        loadWorkspaceJson(this.workspace, stepsToWorkspaceJson([], this.currentTriggerTitle()));
        this.lockWorkspaceTriggerHead();
        this.saveWorkspace();
        this.markDirty();
      }
    } else if (action === 'copy-logic-to') {
      this.copyCurrentLogicToPrompt();
    } else if (action === 'add-compat-patch') {
      this.addCompatibilityPatch();
    } else if (action === 'delete-compat-patch') {
      this.deleteCompatibilityPatch(Number(button.dataset.index));
    } else if (action === 'choose-card-image') {
      this.root.querySelector('#card-image-file-input')?.click();
    }
  }

  handleCardPreviewPointerDown(event) {
    const card = event.target.closest('.mod-card-preview.card');
    if (!card) return;
    const stage = card.closest('.preview-stage');
    this.clearCardPreviewHold();
    const startX = event.clientX;
    const startY = event.clientY;
    const timer = window.setTimeout(() => {
      stage?.classList.add('show-card-note');
      this.cardPreviewHold = { card, stage, startX, startY, timer: null, shown: true };
    }, 420);
    this.cardPreviewHold = { card, stage, startX, startY, timer, shown: false };
  }

  handleCardPreviewPointerMove(event) {
    const hold = this.cardPreviewHold;
    if (!hold) return;
    const moved = Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY);
    if (moved > 8) this.clearCardPreviewHold();
  }

  clearCardPreviewHold() {
    const hold = this.cardPreviewHold;
    if (!hold) return;
    if (hold.timer) window.clearTimeout(hold.timer);
    hold.stage?.classList.remove('show-card-note');
    this.cardPreviewHold = null;
  }

  tryLoadAutosave() {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.format_version === 2 && parsed?.manifest) {
        this.modDraft = this.normalizeDraft(parsed);
        const legacy = this.legacyWorkspaceCount();
        if (legacy) {
          this.runtimeErrors.push(
            `本地草稿里有 ${legacy} 处旧版 Blockly 工作区数据（画布已移除，不再使用）。`
            + '如果某些资源的效果逻辑看着是空的，点顶部「重置本地草稿」后重新导入模组即可。',
          );
        }
      }
    } catch (error) {
      this.runtimeErrors.push(`读取草稿失败：${error.message}`);
    }
  }

  /** 清掉浏览器里的草稿与图片缓存，回到干净状态（不影响已导出的文件）。 */
  resetLocalState() {
    if (!confirm('将清除浏览器里自动保存的草稿和导入的图片缓存，然后重新加载页面。\n已导出的 .gtnmod 文件不受影响。继续吗？')) return;
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      localStorage.removeItem(ASSET_CACHE_KEY);
    } catch (_) {
      /* 清不掉也无所谓 */
    }
    this.toast('已清除本地草稿，正在重新加载…');
    setTimeout(() => window.location.reload(), 400);
  }

  async saveDraft() {
    this.saveWorkspace();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.modDraft));
    this.persistAssetCache();
    this.savedHash = await sha256(this.modDraft);
    this.dirty = false;
    this.updateHeader();
  }

  normalizeDraft(input) {
    const draft = defaultDraft();
    const out = {
      ...draft,
      ...clone(input || {}),
      manifest: { ...draft.manifest, ...(input?.manifest || {}) },
      registries: {
        cards: Array.isArray(input?.registries?.cards) ? input.registries.cards : [],
        tags: Array.isArray(input?.registries?.tags) ? input.registries.tags : [],
        statuses: Array.isArray(input?.registries?.statuses) ? input.registries.statuses : [],
        opening_events: Array.isArray(input?.registries?.opening_events) ? input.registries.opening_events : [],
        ui_components: Array.isArray(input?.registries?.ui_components) ? input.registries.ui_components : [],
      },
      event_hooks: Array.isArray(input?.event_hooks) ? input.event_hooks : [],
      patches: Array.isArray(input?.patches) ? input.patches : [],
      compatibility: Array.isArray(input?.compatibility) ? input.compatibility : [],
      editor: {
        workspaces: input?.editor?.workspaces && typeof input.editor.workspaces === 'object' ? input.editor.workspaces : {},
        ui_layouts: input?.editor?.ui_layouts && typeof input.editor.ui_layouts === 'object' ? input.editor.ui_layouts : {},
        version: 1,
        readonly_ast: input?.editor?.readonly_ast || {},
      },
    };
    for (const item of out.registries.cards) item.events ||= {};
    for (const item of out.registries.statuses) item.events ||= {};
    for (const item of out.registries.opening_events) item.events ||= {};
    return out;
  }

  /* ---------- 从服务器导入（/api/mods 清单 + /mods/ 包体） ---------- */

  /** 打开「从服务器导入」弹窗（元素挂在 body 上，不受中间面板重绘影响）。 */
  async openServerImport() {
    const dialog = this.ensureServerImportDialog();
    dialog.classList.add('open');
    this.renderServerImportDialog();
    await this.loadServerModList();
  }

  ensureServerImportDialog() {
    let dialog = document.getElementById('studio-server-import');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'studio-server-import';
    dialog.className = 'studio-modal';
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-server-close]')) { this.closeServerImport(); return; }
      if (event.target.closest('[data-server-refresh]')) { this.loadServerModList(true); return; }
      const row = event.target.closest('[data-server-file]');
      if (row) this.importFromServer(row.dataset.serverFile);
    });
    dialog.addEventListener('input', (event) => {
      if (event.target.matches('[data-server-filter]')) {
        this.serverModFilter = event.target.value;
        this.renderServerImportList();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dialog.classList.contains('open')) this.closeServerImport();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  closeServerImport() {
    document.getElementById('studio-server-import')?.classList.remove('open');
  }

  renderServerImportDialog() {
    const dialog = document.getElementById('studio-server-import');
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="studio-modal-backdrop" data-server-close></div>
      <div class="studio-modal-panel" role="dialog" aria-label="从服务器导入模组">
        <header class="studio-modal-head">
          <div>
            <strong>从服务器导入模组</strong>
            <p class="hint">读取服务器上已经部署的包（<code>/mods/</code>），和游戏正在加载的是同一份。</p>
          </div>
          <input class="studio-modal-filter" data-server-filter placeholder="筛选名称 / ID / 文件名" value="${escapeHtml(this.serverModFilter || '')}">
          <button class="studio-btn small" data-server-refresh type="button">刷新</button>
          <button class="studio-btn small" data-server-close type="button">关闭</button>
        </header>
        <div class="studio-modal-list" data-server-list>${this.serverModList ? '' : '<p class="empty-small">正在读取服务器模组列表…</p>'}</div>
      </div>`;
    this.renderServerImportList();
  }

  renderServerImportList() {
    const host = document.querySelector('#studio-server-import [data-server-list]');
    if (!host) return;
    if (this.serverModError) {
      host.innerHTML = `<p class="empty-small">读取失败：${escapeHtml(this.serverModError)}</p>`;
      return;
    }
    if (!this.serverModList) return;
    const keyword = String(this.serverModFilter || '').trim().toLowerCase();
    const rows = this.serverModList.filter((mod) => !keyword
      || `${mod.name} ${mod.nameEn} ${mod.id} ${mod.filename}`.toLowerCase().includes(keyword));
    if (!rows.length) {
      host.innerHTML = '<p class="empty-small">没有匹配的模组。</p>';
      return;
    }
    const currentId = this.modDraft.manifest?.id || '';
    host.innerHTML = rows.map((mod) => `
      <button class="server-mod-row${mod.id && mod.id === currentId ? ' is-current' : ''}" type="button" data-server-file="${escapeHtml(mod.filename)}">
        <span class="server-mod-name">${escapeHtml(mod.name || mod.filename)}${mod.vanilla ? '<em>原版</em>' : ''}${mod.id && mod.id === currentId ? '<em>当前草稿</em>' : ''}</span>
        <span class="server-mod-meta">
          <code>${escapeHtml(mod.id || '-')}</code>
          <span>v${escapeHtml(mod.version || '?')}</span>
          <span>${mod.cards} 张卡</span>
          ${mod.hash ? `<span title="内容 hash">#${escapeHtml(mod.hash.slice(0, 8))}</span>` : ''}
        </span>
        <span class="server-mod-file">${escapeHtml(mod.filename)}</span>
      </button>`).join('');
  }

  /** 读服务器模组清单（复用游戏自己的 /api/mods，代价很小，带缓存）。 */
  async loadServerModList(force = false) {
    if (this.serverModList && !force) {
      this.renderServerImportList();
      return;
    }
    this.serverModList = null;
    this.serverModError = '';
    this.renderServerImportDialog();
    try {
      const response = await fetch('/api/mods?summary=1', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.mods || []);
      this.serverModList = list.map((mod) => ({
        filename: String(mod.filename || ''),
        id: String(mod.manifest?.id || mod.info?.id || ''),
        name: String(mod.info?.name_cn || mod.info?.name || mod.filename || ''),
        nameEn: String(mod.info?.name_en || ''),
        version: String(mod.info?.version || ''),
        cards: Number(mod.cards_count || 0),
        vanilla: !!mod.is_vanilla,
        hash: String(mod.content_hash || ''),
      })).filter((mod) => mod.filename);
    } catch (error) {
      this.serverModError = error.message;
    }
    this.renderServerImportList();
  }

  /** 下载服务器上的包并走和"挑文件"完全一样的导入流程。 */
  async importFromServer(filename) {
    const name = String(filename || '').trim();
    if (!name) return;
    this.toast(`正在下载 ${name}…`);
    try {
      const response = await fetch(`/mods/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], name, { type: 'application/octet-stream' });
      await this.importModFile(file);
      this.closeServerImport();
      this.toast(`已导入服务器上的 ${name}`);
    } catch (error) {
      this.runtimeErrors.push(`从服务器导入 ${name} 失败：${error.message}`);
      this.bottomTab = '运行时错误';
      this.renderBottom();
      this.toast('从服务器导入失败');
    }
  }

  async importModFile(file) {
    try {
      if (String(file.name || '').toLowerCase().endsWith('.gtnmod')) {
        const zip = await JSZip.loadAsync(file);
        const mainName = packageMainFileName(zip);
        if (!mainName) throw new Error('GTNMOD 包缺少 mod.json');
        const text = await zip.file(mainName).async('string');
        await this.importJson(text);
        /* 官方包把四语言文本放在 locales/*.json 里。只读 mod.json 会丢掉翻译，
          既让编辑器看不到真实名称，也会让校验报"未提供 locales/zh.json"。
          这里把 locale 原文收进草稿（校验接口用），同时合并进卡牌字段（编辑器显示用）。 */
        await this.mergeLocalesFromZip(zip);
        await this.loadAssetsFromZip(zip);
        this.normalizeCardAssetReferences();
        this.testLogs.push(`已导入包内图片 ${this.assetFiles.size} 个。`);
        this.persistAssetCache();
        /* locales 与图片都挂到草稿上之后再校验一次：
          否则底部面板会一直留着"导入瞬间"那份"未提供 locales / 翻译缺失"的旧结果。 */
        await this.refreshCompiledState({ validate: true });
        this.renderAll();
        return;
      }
      this.clearAssets();
      this.persistAssetCache();
      await this.importJson(await file.text());
    } catch (error) {
      this.runtimeErrors.push(`导入失败：${error.message}`);
      this.renderBottom();
      this.toast('导入失败');
    }
  }

  clearAssets() {
    for (const url of this.assetObjectUrls.values()) URL.revokeObjectURL(url);
    this.assetFiles.clear();
    this.assetObjectUrls.clear();
    this.assetDataUrls.clear();
  }

  /**
   * 读入 zip 里的 locales/*.json：
   * · 原文挂到 draft.locales（服务端校验时用得到，避免"未提供 locales"警告）
   * · 卡牌名称与文本合并进卡片字段（编辑器里能看到、能编辑真实翻译）
   */
  async mergeLocalesFromZip(zip) {
    const locales = {};
    for (const entry of Object.values(zip.files || {})) {
      const match = /^locales\/([a-z]{2}(?:-[A-Za-z]{2})?)\.json$/i.exec(String(entry.name).replace(/\\/g, '/'));
      if (!match) continue;
      try {
        locales[match[1].toLowerCase()] = JSON.parse(await entry.async('string'));
      } catch (error) {
        this.runtimeErrors.push(`读取 locales/${match[1]}.json 失败：${error.message}`);
      }
    }
    if (!Object.keys(locales).length) return;

    this.modDraft.locales = locales;
    this.modDraft.manifest.default_language = this.modDraft.manifest.default_language || 'zh';
    for (const [lang, payload] of Object.entries(locales)) {
      const manifest = payload.manifest || {};
      if (lang === 'zh') {
        this.modDraft.manifest.name_cn = this.modDraft.manifest.name_cn || manifest.name || '';
      }
      for (const card of this.modDraft.registries.cards || []) {
        const short = String(card.id || '').split(':').pop();
        const entry = (payload.cards || {})[card.id]
          || (payload.cards || {})[short]
          || null;
        if (!entry) continue;
        if (lang === 'zh') {
          card.name_cn = entry.name || card.name_cn;
          card.effect_text = entry.effect_text || card.effect_text;
          card.description = entry.description || card.description;
        } else if (lang === 'en') {
          card.name_en = entry.name || card.name_en;
        }
        card.name_i18n = { ...(card.name_i18n || {}), [lang]: entry.name || '' };
        card.effect_text_i18n = { ...(card.effect_text_i18n || {}), [lang]: entry.effect_text || '' };
        card.description_i18n = { ...(card.description_i18n || {}), [lang]: entry.description || '' };
      }
    }
    this.testLogs.push(`已合并 ${Object.keys(locales).length} 个语言文件。`);
  }

  async loadAssetsFromZip(zip) {
    this.clearAssets();
    const entries = Object.values(zip.files || {});
    for (const entry of entries) {
      if (entry.dir || !isSupportedImageName(entry.name)) continue;
      const normalized = entry.name.replace(/\\/g, '/');
      if (!/^(assets\/cards|assets\/card-art|card-art|cards)\//i.test(normalized)) continue;
      /* 自己按扩展名定 MIME：JSZip 会把 .svg 猜成 text/plain，
         那样 blob URL / data URL 都不能当图片用（卡图空白就是这个原因）。 */
      const buffer = await entry.async('arraybuffer');
      const mime = imageMimeTypeForName(normalized);
      const blob = new Blob([buffer], { type: mime });
      this.assetFiles.set(normalized, blob);
      this.assetObjectUrls.set(normalized, URL.createObjectURL(blob));
      this.rememberAssetDataUrl(normalized, dataUrlFromBuffer(buffer, mime));
    }
  }

  /** 记下图片的 data URL 供刷新后恢复；总量超上限就整体不缓存（避免撑爆 localStorage）。 */
  rememberAssetDataUrl(path, dataUrl) {
    if (!path || !dataUrl) return;
    if (this.assetCacheBytes() + dataUrl.length > ASSET_CACHE_MAX_BYTES) {
      if (!this._assetCacheOverflowed) {
        this._assetCacheOverflowed = true;
        this.runtimeErrors.push(
          `包内图片合计超过 ${Math.round(ASSET_CACHE_MAX_BYTES / 1024 / 1024 * 10) / 10} MB，`
          + '已跳过图片缓存：刷新页面后需要重新导入包才能看到卡图。',
        );
      }
      return;
    }
    this.assetDataUrls.set(path, dataUrl);
  }

  assetCacheBytes() {
    let total = 0;
    for (const value of this.assetDataUrls.values()) total += value.length;
    return total;
  }

  persistAssetCache() {
    try {
      if (!this.assetDataUrls.size) localStorage.removeItem(ASSET_CACHE_KEY);
      else localStorage.setItem(ASSET_CACHE_KEY, JSON.stringify(Object.fromEntries(this.assetDataUrls)));
    } catch (_) {
      /* 配额不足时放弃缓存，不影响编辑 */
    }
  }

  restoreAssetCache() {
    try {
      const raw = localStorage.getItem(ASSET_CACHE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      for (const [path, dataUrl] of Object.entries(data)) {
        if (typeof dataUrl !== 'string' || !isSupportedImageName(path)) continue;
        const blob = blobFromDataUrl(dataUrl);
        if (!blob) continue;
        this.assetFiles.set(path, blob);
        this.assetObjectUrls.set(path, URL.createObjectURL(blob));
        this.assetDataUrls.set(path, dataUrl);
      }
    } catch (_) {
      /* 缓存坏了不影响启动 */
    }
  }

  normalizeCardAssetReferences() {
    const assetByLower = new Map([...this.assetFiles.keys()].map(path => [path.toLowerCase(), path]));
    for (const card of this.modDraft.registries.cards || []) {
      const assets = card.assets && typeof card.assets === 'object' ? { ...card.assets } : {};
      const existing = String(assets.image || assets.card_image || card.image || card.image_url || '').replace(/\\/g, '/').trim();
      if (isPackagedAssetPath(existing) && assetByLower.has(existing.toLowerCase())) {
        assets.image = assetByLower.get(existing.toLowerCase());
      } else if (!assets.image || isRuntimeGeneratedImageUrl(assets.image)) {
        for (const key of cardAssetLookupKeys(card)) {
          if (assetByLower.has(key)) {
            assets.image = assetByLower.get(key);
            break;
          }
        }
      }
      if (assets.image && isRuntimeGeneratedImageUrl(assets.image)) delete assets.image;
      if (Object.keys(assets).length) card.assets = assets;
      else delete card.assets;
      if (isRuntimeGeneratedImageUrl(card.image)) delete card.image;
      if (isRuntimeGeneratedImageUrl(card.image_url) || isPackagedAssetPath(card.image_url)) delete card.image_url;
      if (isPackagedAssetPath(card.image)) {
        card.assets = { ...(card.assets || {}), image: card.image.replace(/\\/g, '/') };
        delete card.image;
      }
    }
  }

  cardImagePath(card) {
    const assets = card?.assets && typeof card.assets === 'object' ? card.assets : {};
    return String(assets.image || assets.card_image || card?.image || '').trim();
  }

  cardImageUrl(card) {
    const path = this.cardImagePath(card);
    if (!path) return '';
    if (/^(data:|https?:|\/)/i.test(path)) return path;
    return this.assetObjectUrls.get(path) || '';
  }

  async attachImageToCurrentCard(file) {
    const card = this.currentItem();
    if (this.selectedKind !== 'cards' || !card) return;
    if (!isSupportedImageName(file.name)) {
      this.toast('只支持 SVG/WebP/PNG/JPG 图片');
      return;
    }
    const ext = (file.name.match(/\.[^.]+$/)?.[0] || '.svg').toLowerCase();
    const base = slugify(shortId(this.modDraft, card.id || card.name_en || 'card'), 'card').replaceAll('/', '_');
    const path = safeAssetPath(`${base}${ext}`);
    this.assetFiles.set(path, file);
    if (this.assetObjectUrls.has(path)) URL.revokeObjectURL(this.assetObjectUrls.get(path));
    this.assetObjectUrls.set(path, URL.createObjectURL(file));
    try {
      this.rememberAssetDataUrl(path, dataUrlFromBuffer(await file.arrayBuffer(), imageMimeTypeForName(path)));
      this.persistAssetCache();
    } catch (_) {
      /* 单张图读不出来不影响其它功能 */
    }
    card.assets = { ...(card.assets || {}), image: path };
    delete card.image_url;
    delete card.image;
    this.markDirty();
    await this.refreshCompiledState({ validate: false });
    this.renderAll();
  }

  ensureInitialSelection() {
    if (this.selectedKind === 'manifest') return;
    const list = this.getList(this.selectedKind);
    if (!this.selectedId && list[0]) this.selectedId = this.itemKey(this.selectedKind, list[0], 0);
  }

  async importJson(text) {
    try {
      const data = JSON.parse(text);
      this.saveWorkspace();
      if (data.format_version !== 2) {
        throw new Error('只支持 GTN Mod Spec v2（format_version 必须为 2）');
      }
      this.modDraft = this.normalizeDraft(data);
      this.testLogs.push('已导入 v2 JSON。');
      this.selectedKind = 'manifest';
      this.selectedId = null;
      this.centerTab = '基础信息';
      this.disposeWorkspace();
      this.markDirty();
      await this.refreshCompiledState({ validate: true });
      this.renderAll();
    } catch (error) {
      this.runtimeErrors.push(`导入失败：${error.message}`);
      this.renderBottom();
      this.toast('导入失败');
    }
  }

  renderAll() {
    this.updateHeader();
    this.renderResourceTree();
    this.renderCenter();
    this.renderInspector();
    this.renderBottom();
  }

  updateHeader() {
    const subtitle = this.root.querySelector('#studio-subtitle');
    if (subtitle) subtitle.textContent = `${this.modDraft.manifest.name || '未命名模组'} · ${this.modDraft.manifest.version || '0.0.0'} · 编辑器 v${STUDIO_VERSION}（${STUDIO_BUILD_STAMP}）`;
    const status = this.root.querySelector('#studio-status-pill');
    if (status) {
      status.className = 'status-pill';
      if (this.validation.errors.length) {
        status.textContent = '有错误';
        status.classList.add('danger');
      } else if (this.dirty) {
        status.textContent = '未保存';
        status.classList.add('warn');
      } else {
        status.textContent = '可导出';
        status.classList.add('ok');
      }
    }
    const hash = this.root.querySelector('#studio-hash');
    if (hash) hash.textContent = `content_hash: ${this.contentHash ? this.contentHash.slice(0, 16) : '--'}`;
  }

  renderResourceTree() {
    const tree = this.root.querySelector('#resource-tree');
    if (!tree) return;
    const q = this.searchQuery.trim().toLowerCase();
    const parts = [];
    for (const group of RESOURCE_GROUPS) {
      if (this.filterKind !== 'all' && group.key !== this.filterKind && !['manifest', 'test_lab'].includes(group.key)) continue;
      const items = this.getList(group.key);
      const count = items.length;
      if (group.key === 'manifest' || group.key === 'test_lab') {
        if (q && !group.label.toLowerCase().includes(q)) continue;
        parts.push(`
          <button class="resource-group solo ${this.selectedKind === group.key ? 'active' : ''}" data-resource-kind="${group.key}">
            <span>${group.label}</span>
          </button>
        `);
        continue;
      }
      const filtered = items
        .map((item, index) => ({ item, index, key: this.itemKey(group.key, item, index) }))
        .filter(row => !q || JSON.stringify(row.item).toLowerCase().includes(q));
      parts.push(`
        <details class="resource-group" open>
          <summary>${group.label}<span>${count}</span></summary>
          <div class="resource-items">
            ${filtered.map(row => `
              <button class="resource-item ${this.selectedKind === group.key && this.selectedId === row.key ? 'active' : ''}"
                data-resource-kind="${group.key}" data-resource-id="${escapeHtml(row.key)}">
                <strong>${escapeHtml(this.displayName(group.key, row.item))}</strong>
                <code>${escapeHtml(this.displayId(row.item))}</code>
              </button>
            `).join('') || '<div class="empty-small">没有匹配资源</div>'}
          </div>
        </details>
      `);
    }
    tree.innerHTML = parts.join('');
    const search = this.root.querySelector('#resource-search-input');
    if (search && search.value !== this.searchQuery) search.value = this.searchQuery;
    const filter = this.root.querySelector('#resource-filter');
    if (filter) filter.value = this.filterKind;
  }

  selectResource(kind, id = null) {
    this.saveWorkspace();
    this.selectedKind = kind;
    this.selectedId = id;
    this.centerTab = this.defaultTabFor(kind);
    this.selectedEvent = this.defaultEventFor(kind);
    if (kind !== 'ui_components') this.selectedUiControlIndex = 0;
    this.renderAll();
  }

  defaultTabFor(kind) {
    if (kind === 'cards' || kind === 'opening_events' || kind === 'statuses') return '基础信息';
    if (kind === 'ui_components') return '结构';
    if (kind === 'event_hooks') return '钩子';
    if (kind === 'patches') return '补丁';
    if (kind === 'compatibility') return '兼容';
    if (kind === 'test_lab') return '单卡测试';
    return '基础信息';
  }

  defaultEventFor(kind) {
    return EVENT_SETS[kind]?.[0]?.[0] || 'on_play';
  }

  getList(kind) {
    if (kind in this.modDraft.registries) return this.modDraft.registries[kind];
    if (kind === 'event_hooks') return this.modDraft.event_hooks;
    if (kind === 'patches') return this.modDraft.patches;
    if (kind === 'compatibility') return this.modDraft.compatibility;
    return [];
  }

  setList(kind, value) {
    if (kind in this.modDraft.registries) this.modDraft.registries[kind] = value;
    else if (kind === 'event_hooks') this.modDraft.event_hooks = value;
    else if (kind === 'patches') this.modDraft.patches = value;
    else if (kind === 'compatibility') this.modDraft.compatibility = value;
  }

  currentItem() {
    const list = this.getList(this.selectedKind);
    if (!list.length) return null;
    return list.find((item, index) => this.itemKey(this.selectedKind, item, index) === this.selectedId) || list[0];
  }

  currentIndex() {
    const list = this.getList(this.selectedKind);
    return list.findIndex((item, index) => this.itemKey(this.selectedKind, item, index) === this.selectedId);
  }

  itemKey(kind, item, index) {
    return String(item?.id || item?.hook || item?.if_mod_loaded || `${kind}_${index}`);
  }

  displayName(kind, item) {
    if (!item) return '未命名';
    return item.name_cn || item.title_cn || item.name || item.hook || item.op || item.if_mod_loaded || item.id || '未命名';
  }

  displayId(item) {
    return item?.id || item?.target || item?.if_mod_loaded || '';
  }

  addResource() {
    if (this.selectedKind === 'manifest' || this.selectedKind === 'test_lab') {
      this.selectedKind = 'cards';
    }
    const kind = this.selectedKind;
    const list = this.getList(kind);
    let item;
    if (kind === 'cards') item = makeCard(`new_card_${list.length + 1}`);
    else if (kind === 'tags') item = makeTag(`new_tag_${list.length + 1}`);
    else if (kind === 'statuses') item = makeStatus(`new_status_${list.length + 1}`);
    else if (kind === 'opening_events') item = makeOpeningEvent(`new_event_${list.length + 1}`);
    else if (kind === 'ui_components') item = makeUiComponent(`new_window_${list.length + 1}`);
    else if (kind === 'event_hooks') item = makeHook();
    else if (kind === 'patches') item = makePatch();
    else if (kind === 'compatibility') item = makeCompatibility();
    if (!item) return;
    list.push(item);
    this.selectedId = this.itemKey(kind, item, list.length - 1);
    this.centerTab = this.defaultTabFor(kind);
    this.markDirty();
    this.renderAll();
  }

  duplicateResource() {
    const list = this.getList(this.selectedKind);
    const index = this.currentIndex();
    if (index < 0) return;
    const copy = clone(list[index]);
    if (copy.id) copy.id = `${shortId(this.modDraft, copy.id)}_copy`;
    else copy.id = cryptoRandomId(this.selectedKind);
    if (copy.name_cn) copy.name_cn += ' 副本';
    list.splice(index + 1, 0, copy);
    this.selectedId = this.itemKey(this.selectedKind, copy, index + 1);
    this.markDirty();
    this.renderAll();
  }

  deleteResource() {
    const list = this.getList(this.selectedKind);
    const index = this.currentIndex();
    if (index < 0) return;
    const item = list[index];
    const refs = this.findReferences(item?.id || '');
    if (refs.length && !confirm(`此资源仍有 ${refs.length} 处引用。仍要删除吗？`)) return;
    list.splice(index, 1);
    this.selectedId = list[index] ? this.itemKey(this.selectedKind, list[index], index) : (list[0] ? this.itemKey(this.selectedKind, list[0], 0) : null);
    this.markDirty();
    this.renderAll();
  }

  addTemplate(template) {
    this.selectedKind = 'cards';
    const list = this.modDraft.registries.cards;
    const id = `${template || 'template'}_${list.length + 1}`;
    const card = makeCard(id);
    if (template === 'attack') {
      Object.assign(card, { name_cn: '基础攻击', name_en: 'Basic Attack', card_type: 'thorn', cost_e: 1, effect_text: '造成 6D' });
      card.events = { on_play: { steps: [{ op: 'deal_damage', target: 'target', amount: 6 }] } };
    } else if (template === 'heal') {
      Object.assign(card, { name_cn: '治疗', name_en: 'Heal', card_type: 'bloom', cost_e: 1, effect_text: '回复 4H' });
      /* Round 32 / 批次 AA：heal 并进 health_op(mode:"heal")。 */
      card.events = { on_play: { steps: [{ op: 'health_op', mode: 'heal', target: 'source', amount: 4 }] } };
    } else if (template === 'status') {
      Object.assign(card, { name_cn: '施加状态', name_en: 'Apply Status', card_type: 'bloom', effect_text: '给目标添加 2 层状态' });
      /* Round 30 / 批次 Y：旧写法 add_status 已删除，改成规范 op + log:true
         （复刻旧写法"默认播报层数"的战报）。 */
      card.events = { on_play: { steps: [{ op: 'status_op', action: 'add', target: 'target', status: `${namespaceOf(this.modDraft)}:new_status`, amount: 2, log: true }] } };
    } else if (template === 'equipment') {
      Object.assign(card, { name_cn: '装备触发', name_en: 'Trigger Equipment', card_type: 'root', effect_text: '装备后可触发' });
      card.events = { on_equipment_trigger: { steps: [{ op: 'resource_op', resource: 'e', delta: 1, target: 'source' }] } };
    } else if (template === 'guard') {
      Object.assign(card, { name_cn: '反制牌', name_en: 'Guard Card', card_type: 'guard', effect_text: '使当前伤害减半' });
      card.events = { on_response: { steps: [{ op: 'modify_event_value', mode: 'set', value: { op: 'floor', value: { op: 'div', a: { op: 'event_value' }, b: 2 } } }] } };
    } else if (template === 'mana_converter') {
      Object.assign(card, { name_cn: '魔力转换器', name_en: 'Mana Converter', card_type: 'bloom', cost_e: 0, effect_text: '选择消耗 E，按 2:1 转化为 M' });
      const component = makeUiComponent('mana_converter_window');
      component.title_cn = '魔力转换器';
      component.controls = [{ id: 'spend_e', type: 'slider', label_cn: '消耗能量', min: 0, max: { player_stat: ['source', 'elixir'] }, step: 2, default: 2 }];
      this.modDraft.registries.ui_components.push(component);
      card.events = {
        on_play: {
          steps: [
            { op: 'request_ui', component: normalizeResourceId(this.modDraft, component.id), save_as: 'mana_choice', target_player: 'source' },
            { op: 'resource_op', resource: 'e', target: 'source', delta: { op: 'mul', a: { op: 'get', object: { op: 'var', name: 'mana_choice' }, key: 'spend_e' }, b: -1 } },
            { op: 'resource_op', resource: 'm', target: 'source', delta: { op: 'floor', value: { op: 'div', a: { op: 'get', object: { op: 'var', name: 'mana_choice' }, key: 'spend_e' }, b: 2 } } },
          ],
        },
      };
    } else if (template === 'ui_number_window') {
      /* 批次 CT：**输入数字窗口**——玩家填 0~10，按填的数造成伤害。
         演示 `input` 伞的 `value_type:"number"`、`on_invalid:"keep"`（填错保持窗口）与
         `{"op":"get","object":{"op":"var","name":"<save_as>"},"key":"<控件 id>"}` 读数链。 */
      Object.assign(card, {
        name_cn: '输入数字造成伤害', name_en: 'Number Input Damage',
        card_type: 'thorn', cost_e: 1,
        effect_text: '让玩家输入 0~10 的数字，对目标造成等量伤害',
      });
      const component = makeUiComponent('number_input_window');
      component.title_cn = '输入伤害数值';
      component.controls = [
        { id: 'amount', type: 'input', value_type: 'number', label_cn: '伤害数值',
          min: 0, max: 10, step: 1, default: 3, help_text: '0 ~ 10' },
      ];
      component.buttons = [
        { id: 'confirm', text_cn: '确定', text_en: 'Confirm', role: 'confirm' },
        { id: 'cancel', text_cn: '取消', text_en: 'Cancel', role: 'cancel' },
      ];
      this.modDraft.registries.ui_components.push(component);
      card.events = {
        on_play: {
          steps: [
            { op: 'request_ui', component: normalizeResourceId(this.modDraft, component.id),
              save_as: 'damage_pick', target_player: 'source',
              timeout_ms: 60000, on_invalid: 'keep' },
            { op: 'deal_damage', target: 'target',
              amount: { op: 'get', object: { op: 'var', name: 'damage_pick' }, key: 'amount' } },
          ],
        },
      };
    } else if (template === 'ui_text_memory') {
      /* 批次 CT：**输入记忆窗口**——文本框带违禁词过滤与 `default_from`（下次带出上次输入）。 */
      Object.assign(card, {
        name_cn: '记住玩家口令', name_en: 'Remember Text',
        card_type: 'bloom', cost_e: 0,
        effect_text: '让玩家输入一段口令（最多 12 字，过滤违禁词），记进玩家变量',
      });
      const component = makeUiComponent('text_memory_window');
      component.title_cn = '输入口令';
      component.controls = [
        { id: 'note', type: 'text_input', label_cn: '口令', max_length: 12, min_length: 1,
          placeholder_cn: '最多 12 个字', normalize: 'trim', moderation: 'reject',
          default_from: { player_var: 'last_note' }, help_text: '同一局内再打开会带出上次输入' },
      ];
      component.buttons = [
        { id: 'confirm', text_cn: '确认', text_en: 'Confirm', role: 'confirm' },
        { id: 'cancel', text_cn: '取消', text_en: 'Cancel', role: 'cancel' },
      ];
      this.modDraft.registries.ui_components.push(component);
      card.events = {
        on_play: {
          steps: [
            { op: 'request_ui', component: normalizeResourceId(this.modDraft, component.id),
              save_as: 'note_pick', target_player: 'source',
              timeout_ms: 60000, on_invalid: 'keep',
              on_cancel: [{ op: 'log', message: '取消了口令输入' }] },
            { op: 'player_var_change', mode: 'set', target: 'source', name: 'last_note',
              value: { op: 'get', object: { op: 'var', name: 'note_pick' }, key: 'note' } },
            { op: 'log', message: '已记住新口令' },
          ],
        },
      };
    } else if (template === 'ui_tabbed_window') {
      /* 批次 CT：**分页选择窗口**——基础页选「抽牌 / 回血」，高级页填数量，之后按分支结算。 */
      Object.assign(card, {
        name_cn: '分页窗口：抽牌或回血', name_en: 'Tabbed Choice',
        card_type: 'bloom', cost_e: 1,
        effect_text: '弹出分页窗口：基础页选「抽牌 / 回血」，高级页填数量（1~3）',
      });
      const component = makeUiComponent('tabbed_choice_window');
      component.title_cn = '抽牌还是回血';
      component.controls = [
        { id: 'mode', type: 'select', label_cn: '要做什么', tab: 'basic', tab_cn: '基础',
          options: [{ value: 'draw', label_cn: '抽牌' }, { value: 'heal', label_cn: '回血' }],
          default: 'draw' },
        { id: 'count', type: 'number_input', label_cn: '数量', tab: 'advanced', tab_cn: '高级',
          min: 1, max: 3, step: 1, default: 1 },
      ];
      component.buttons = [
        { id: 'confirm', text_cn: '确认', text_en: 'Confirm', role: 'confirm' },
        { id: 'cancel', text_cn: '取消', text_en: 'Cancel', role: 'cancel' },
      ];
      this.modDraft.registries.ui_components.push(component);
      const readChoice = (key) => ({ op: 'get', object: { op: 'var', name: 'mode_pick' }, key });
      card.events = {
        on_play: {
          steps: [
            { op: 'request_ui', component: normalizeResourceId(this.modDraft, component.id),
              save_as: 'mode_pick', target_player: 'source',
              timeout_ms: 45000, on_invalid: 'keep' },
            { op: 'if_else',
              condition: { op: 'compare', a: readChoice('mode'), operator: '==', b: 'draw' },
              then: [{ op: 'draw', target: 'source', count: readChoice('count') }],
              else: [{ op: 'health_op', mode: 'heal', target: 'source', amount: readChoice('count') }] },
          ],
        },
      };
    }
    list.push(card);
    this.selectedId = this.itemKey('cards', card, list.length - 1);
    this.centerTab = '预览';
    this.markDirty();
    this.renderAll();
  }

  renderCenter() {
    this.disposeWorkspace();
    const el = this.root.querySelector('#center-editor');
    if (!el) return;
    if (this.selectedKind === 'manifest') el.innerHTML = this.renderManifestEditor();
    else if (this.selectedKind === 'cards') el.innerHTML = this.renderCardEditor();
    else if (this.selectedKind === 'tags') el.innerHTML = this.renderTagEditor();
    else if (this.selectedKind === 'statuses') el.innerHTML = this.renderStatusEditor();
    else if (this.selectedKind === 'opening_events') el.innerHTML = this.renderOpeningEventEditor();
    else if (this.selectedKind === 'ui_components') el.innerHTML = this.renderUiComponentEditor();
    else if (this.selectedKind === 'event_hooks') el.innerHTML = this.renderEventHookEditor();
    else if (this.selectedKind === 'patches') el.innerHTML = this.renderPatchEditor();
    else if (this.selectedKind === 'compatibility') el.innerHTML = this.renderCompatibilityEditor();
    else if (this.selectedKind === 'test_lab') el.innerHTML = this.renderTestLab();
    this.afterCenterRender();
  }

  afterCenterRender() {
    /* Blockly 画布已整体移除：效果行编辑器直接挂进逻辑面板的容器。
       注意别再放一个空的画布占位 div —— 它带的 min-height 会把效果行挤出可视区
       （表现就是"面板写着 N 步，但一行都看不见"）。 */
    const stage = this.root.querySelector('.logic-workspace-stage[data-effect-host]');
    if (stage) this.mountEffectEditor(stage);
    /* 卡面预览：iframe 只在"预览"页签渲染时才存在，属于按需加载 */
    const frame = this.root.querySelector('#studio-preview-frame');
    if (frame) {
      frame.addEventListener('load', () => setTimeout(() => this.sendCardToPreview(), 80));
      if (!this._previewMessageBound) {
        this._previewMessageBound = true;
        window.addEventListener('message', (event) => {
          if ((event.data || {}).type === 'gtn-card-host-ready') this.sendCardToPreview();
        });
      }
      this.sendCardToPreview();
    }
  }

  /** 把当前卡包交给游戏渲染器（preview/card-host.html）绘制卡面。 */
  async sendCardToPreview() {
    const frame = this.root.querySelector('#studio-preview-frame');
    if (!frame || !frame.contentWindow) return;
    const card = this.currentItem();
    if (!card || !card.id) return;
    let compiled;
    try {
      compiled = this.compileDraft({ includeEditor: false });
    } catch (error) {
      return;
    }
    /* 游戏渲染器内部按 legacy id 索引（例如 Ice / MagicCompass），不是 mod:id 形式，
       所以两套键都登记，并以 legacy id 优先作为 defId。 */
    const fullId = normalizeResourceId(this.modDraft, card.id, card.id || 'card');
    const defId = card.legacy_id || fullId;
    const defs = {};
    for (const item of (compiled.registries?.cards || [])) {
      const itemFullId = normalizeResourceId(this.modDraft, item.id, item.id || 'card');
      const itemLegacyId = item.legacy_id || itemFullId;
      const def = { ...item, legacy_id: item.legacy_id || itemFullId };
      defs[itemLegacyId] = def;
      defs[itemFullId] = def;
    }
    if (!defs[defId]) {
      const def = { ...card, id: fullId, legacy_id: defId };
      defs[defId] = def;
      defs[fullId] = def;
    }
    /* 导入的卡图在编辑器里是 blob: URL，iframe 取不到；转成 data URL 才能显示。
       两个坑：① data URL 的 MIME 必须是 image/*，否则 <img> 不画（JSZip 会给 SVG 猜 text/plain）；
       ② 游戏渲染器按 image / image_url 取图，不看 assets.image。 */
    try {
      const current = defs[defId];
      const imagePath = this.cardImagePath(card);
      const imageUrl = this.cardImageUrl(card);
      if (current && imageUrl) {
        const mime = imageMimeTypeForName(imagePath || imageUrl);
        const dataUrl = imageUrl.startsWith('data:')
          ? imageUrl
          : dataUrlFromBuffer(await (await fetch(imageUrl)).arrayBuffer(), mime);
        if (dataUrl) {
          current.assets = { ...(current.assets || {}), image: dataUrl };
          current.image = dataUrl;
          current.image_url = dataUrl;
        }
      }
    } catch (error) {
      /* 图片读不出来不该阻断预览 */
    }
    frame.contentWindow.postMessage({
      type: 'gtn-render-card',
      defs,
      defId,
      width: 240,
      lang: 'zh',
      flags: card.tags || [],
    }, '*');
  }

  tabs(tabs) {
    return `<div class="center-tabs">${tabs.map(tab => `<button class="${this.centerTab === tab ? 'active' : ''}" data-center-tab="${tab}">${tab}</button>`).join('')}</div>`;
  }

  renderManifestEditor() {
    const m = this.modDraft.manifest;
    return `
      <div class="editor-head">
        <div><h1>Manifest</h1><p>模组命名空间、依赖、能力与加载顺序。</p></div>
      </div>
      ${this.tabs(['基础信息', '依赖', '能力', 'JSON'])}
      ${this.centerTab === '基础信息' ? `
        <section class="form-grid two">
          ${this.input('manifest.id', '命名空间 ID', m.id)}
          ${this.input('manifest.resource_namespace', '资源命名空间（DLC/扩展包才填，留空=与 ID 相同）', m.resource_namespace || '')}
          ${this.input('manifest.name', '模组名称', m.name)}
          ${this.input('manifest.version', '版本', m.version)}
          ${this.input('manifest.api_version', 'API Version', m.api_version)}
          ${this.input('manifest.author', '作者', m.author)}
          ${this.textarea('manifest.description', '描述', m.description, 5)}
        </section>
      ` : ''}
      ${this.centerTab === '依赖' ? `
        <section class="form-grid two">
          ${this.textarea('manifest.dependencies', 'Dependencies，一行一个：mod_id 或 mod_id @ >=1.0.0', depsToListText(m.dependencies), 8, 'deps')}
          ${this.textarea('manifest.optional_dependencies', 'Optional Dependencies', depsToListText(m.optional_dependencies), 8, 'deps')}
          ${this.textarea('manifest.load_before', 'Load Before，一行一个 mod_id', (m.load_before || []).join('\n'), 6, 'lines')}
          ${this.textarea('manifest.load_after', 'Load After，一行一个 mod_id', (m.load_after || []).join('\n'), 6, 'lines')}
          ${this.textarea('manifest.conflicts', 'Conflicts JSON', JSON.stringify(m.conflicts || [], null, 2), 8, 'json')}
        </section>
      ` : ''}
      ${this.centerTab === '能力' ? `
        <section class="capability-grid">
          ${CAPABILITIES.map(cap => `
            <label class="check-card">
              <input type="checkbox" data-bind="manifest.capabilities" data-array-value="${cap}" ${m.capabilities?.includes(cap) ? 'checked' : ''}>
              <span>${cap}</span>
            </label>
          `).join('')}
        </section>
      ` : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(m) : ''}
    `;
  }

  renderCardEditor() {
    const card = this.currentItem();
    if (!card) return this.emptyEditor('没有卡牌', '点击左上角 + 新建一张 v2 卡牌。');
    const tabs = ['基础信息', '费用与类型', '标签', '效果逻辑', 'UI交互', '预览', 'JSON'];
    return `
      <div class="editor-head">
        <div><h1>${escapeHtml(card.name_cn || card.id)}</h1><p>${escapeHtml(card.id || '')}</p></div>
        <div class="template-row">
          ${[
            ['attack', '基础攻击'],
            ['heal', '治疗'],
            ['status', '添加状态'],
            ['equipment', '装备触发'],
            ['guard', '反制牌'],
            ['mana_converter', '魔力转换器模板'],
            ['ui_number_window', '输入数字窗口'],
            ['ui_text_memory', '口令记忆窗口'],
            ['ui_tabbed_window', '分页选择窗口'],
          ].map(([key, label]) => `<button class="studio-btn small" data-action="add-template" data-template="${key}">${label}</button>`).join('')}
        </div>
      </div>
      ${this.tabs(tabs)}
      ${this.centerTab === '基础信息' ? `
        <section class="form-grid two">
          ${this.input('item.id', 'ID，短 ID 会自动加 namespace', shortId(this.modDraft, card.id))}
          ${this.input('item.name_cn', '中文名', card.name_cn)}
          ${this.input('item.name_en', '英文名', card.name_en)}
          ${this.input('item.icon', 'Icon token', card.icon)}
          ${this.input('item.color', 'Color token', card.color)}
          <div class="studio-card card-image-import-card">
            <h2>卡牌图片</h2>
            ${this.cardImageUrl(card) ? `<img class="card-image-thumb" src="${escapeHtml(this.cardImageUrl(card))}" alt="卡图预览">` : ''}
            <p class="hint">${escapeHtml(this.cardImagePath(card) || '未设置图片')}</p>
            <button class="studio-btn" data-action="choose-card-image" type="button">导入图片</button>
          </div>
          ${this.textarea('item.description', '趣味描述', card.description, 4)}
          ${this.textarea('item.effect_text', '效果描述', card.effect_text, 4)}
        </section>
      ` : ''}
      ${this.centerTab === '费用与类型' ? `
        <section class="form-grid three">
          ${this.select('item.card_type', '类型', card.card_type, CARD_TYPES)}
          ${this.number('item.cost_e', 'E 费用', card.cost_e)}
          ${this.number('item.cost_m', 'M 费用', card.cost_m)}
          ${this.number('item.count', '牌堆数量/权重', card.count)}
          ${this.select('item.quality', '品质', card.quality, QUALITY.map(q => [q, q]))}
        </section>
      ` : ''}
      ${this.centerTab === '标签' ? this.renderCardTags(card) : ''}
      ${this.centerTab === '效果逻辑' ? this.renderLogicWorkspace('cards', card, EVENT_SETS.cards) : ''}
      ${this.centerTab === 'UI交互' ? this.renderCardUiNotes(card) : ''}
      ${this.centerTab === '预览' ? this.renderCardPreview(card) : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(card) : ''}
    `;
  }

  renderCardTags(card) {
    const allTags = this.modDraft.registries.tags.map(tag => tag.id);
    return `
      <section class="tag-editor">
        <div class="chip-grid">
          ${allTags.map(tag => `
            <label class="check-card">
              <input type="checkbox" data-bind="item.tags" data-array-value="${escapeHtml(tag)}" ${card.tags?.includes(tag) ? 'checked' : ''}>
              <span>${escapeHtml(tag)}</span>
            </label>
          `).join('') || '<div class="empty-small">当前模组还没有自定义标签。</div>'}
        </div>
        ${this.textarea('item.tags', '自定义标签 ID，用逗号分隔', csvFromArray(card.tags), 4, 'csv')}
        <p class="hint">可以输入任意命名空间标签 ID。不存在的标签会在校验中提示，但游戏执行时可静默忽略失败操作。</p>
      </section>
    `;
  }

  renderCardUiNotes(card) {
    const uiIds = this.modDraft.registries.ui_components.map(item => item.id);
    /* Round 95 / 批次 CR：request_ui 的**步骤参数**（timeout_ms / on_invalid / on_cancel）
       以前只能改 JSON；这里把它们做成表单。路径就是数据里的真实位置
       （item.events.<事件>.[steps.]<序号>…），改完直接落回 card.events。 */
    const uiSteps = this.collectRequestUiSteps(card);
    return `
      <section class="studio-card">
        <h2>request_ui 步骤参数（${uiSteps.length} 个）</h2>
        ${uiSteps.map(({ step, path, where }) => `
          <div class="ui-step-row">
            <h3>${escapeHtml(where)}</h3>
            <section class="form-grid two">
              ${typeof step.component === 'object' && step.component
                ? '<p class="hint full">内联窗口（写在 JSON 里），改参数请到 JSON 页签。</p>'
                : this.select(`${path}.component`, '窗口', step.component || uiIds[0] || '',
                    (step.component && !uiIds.includes(step.component)
                      ? [[step.component, `${step.component}（当前引用，未在本模组找到）`]] : [])
                    .concat(uiIds.map(id => [id, id]))
                    .concat(uiIds.length ? [] : [['', '（还没有 UI 组件）']]))}
              ${this.input(`${path}.save_as`, '结果存进变量', step.save_as ?? 'ui_result')}
              ${this.input(`${path}.target_player`, '给谁（目标选择器）',
                  typeof step.target_player === 'object' && step.target_player
                    ? JSON.stringify(step.target_player) : (step.target_player ?? 'source'))}
              ${this.input(`${path}.timeout_ms`, '限时毫秒（0=不限时，可写表达式 JSON）',
                  step.timeout_ms === undefined ? '0' : JSON.stringify(step.timeout_ms), 'text', 'json_or_text')}
              ${this.select(`${path}.on_invalid`, '非法回应怎么处理',
                  step.on_invalid || 'close',
                  [['close', 'close（关窗继续，旧行为）'], ['keep', 'keep（保留窗口让玩家改）']])}
            </section>
            <p class="hint">取消分支（on_cancel）：${Array.isArray(step.on_cancel) ? `${step.on_cancel.length} 步` : '未写'}（步骤内容在效果逻辑 / JSON 里改）。</p>
          </div>
        `).join('') || '<p class="empty-small">这张卡还没有 request_ui 步骤。</p>'}
      </section>
      <section class="info-grid">
        <div class="studio-card">
          <h2>request_ui 引用</h2>
          <p>在效果逻辑中使用“请求 UI 组件”积木，引用下列受控 UI 组件。</p>
          <div class="token-list">${uiIds.map(id => `<code>${escapeHtml(id)}</code>`).join('') || '<span class="empty-small">暂无 UI 组件</span>'}</div>
        </div>
        <div class="studio-card">
          <h2>当前卡牌事件</h2>
          <pre>${escapeHtml(JSON.stringify(card.events || {}, null, 2))}</pre>
        </div>
      </section>
    `;
  }

  /* 把卡里所有 request_ui 步骤找出来，连**绑定路径**一起返回（含嵌套体里的）。
     事件有两种写法：数组（item.events.<事件>）与 {steps:[…]}（item.events.<事件>.steps）。 */
  collectRequestUiSteps(card) {
    const found = [];
    const childKeys = ['steps', 'then', 'else', 'body', 'on_hit', 'on_hit_once', 'on_crit', 'on_cancel'];
    const walk = (steps, basePath, where) => {
      if (!Array.isArray(steps)) return;
      steps.forEach((step, index) => {
        if (!step || typeof step !== 'object') return;
        const path = `${basePath}.${index}`;
        const label = `${where}[${index}]`;
        if (step.op === 'request_ui' || step.type === 'request_ui') {
          found.push({ step, path, where: label });
        }
        for (const key of childKeys) {
          if (Array.isArray(step[key])) walk(step[key], `${path}.${key}`, `${label}.${key}`);
        }
      });
    };
    for (const [eventName, event] of Object.entries(card.events || {})) {
      if (Array.isArray(event)) {
        walk(event, `item.events.${eventName}`, eventName);
      } else if (event && typeof event === 'object' && Array.isArray(event.steps)) {
        walk(event.steps, `item.events.${eventName}.steps`, eventName);
      }
    }
    return found;
  }

  renderCardPreview(card) {
    const tags = card.tags || [];
    const type = card.card_type || 'thorn';
    const meta = CARD_TYPE_META[type] || CARD_TYPE_META.thorn;
    const tagDefs = new Map(this.modDraft.registries.tags.map(tag => [normalizeResourceId(this.modDraft, tag.id), tag]));
    const flagHtml = tags.map(rawTag => {
      const fullId = normalizeResourceId(this.modDraft, rawTag, rawTag || 'tag');
      const tagDef = tagDefs.get(fullId);
      const label = tagDef?.name_cn || tagDef?.name_en || String(rawTag || '').split(':').pop();
      const color = tagDef?.color || meta.color;
      return `<span class="card-flag custom" style="--flag-color:${escapeHtml(color)};color:${escapeHtml(color)};border-color:${escapeHtml(color)}">${escapeHtml(label)}</span>`;
    }).join('');
    const imageUrl = this.cardImageUrl(card);
    const effectText = card.effect_text || '效果描述会显示在这里。';
    const description = card.description || '趣味描述会显示在这里。';
    /* 卡面交给游戏自己的渲染器绘制（iframe 只在打开本页签时才创建 = 按需加载）。
       下面的 note 仍用本地数据，方便快速核对名称与趣味描述。 */
    return `
      <section class="preview-stage preview-stage-with-note">
        <iframe id="studio-preview-frame" class="studio-preview-frame"
                src="./preview/card-host.html" title="卡面预览"></iframe>
        <aside class="mod-card-note" style="--note-color:${meta.color}">
          <strong>${escapeHtml(card.name_cn || card.id)}</strong>
          <p>${escapeHtml(description)}</p>
        </aside>
      </section>
    `;
  }

  renderTagEditor() {
    const tag = this.currentItem();
    if (!tag) return this.emptyEditor('没有标签', '点击 + 新建自定义标签。');
    return `
      <div class="editor-head"><div><h1>${escapeHtml(tag.name_cn || tag.id)}</h1><p>${escapeHtml(tag.id || '')}</p></div></div>
      ${this.tabs(['基础信息', '样式', 'JSON'])}
      ${this.centerTab === '基础信息' ? `
        <section class="form-grid two">
          ${this.input('item.id', 'ID', shortId(this.modDraft, tag.id))}
          ${this.input('item.name_cn', '中文名', tag.name_cn)}
          ${this.input('item.name_en', '英文名', tag.name_en)}
          ${this.textarea('item.description', '描述', tag.description, 5)}
          ${this.textarea('item.applies_to', '适用对象，逗号分隔：card,status,damage,event,ui', csvFromArray(tag.applies_to), 4, 'csv')}
        </section>
      ` : ''}
      ${this.centerTab === '样式' ? `
        <section class="form-grid two">
          ${this.input('item.icon', 'Icon token', tag.icon)}
          ${this.color('item.color', '颜色', tag.color || '#64748b')}
          <div class="tag-preview-box">
            <span style="color:${escapeHtml(tag.color || '#64748b')}; border-color:${escapeHtml(tag.color || '#64748b')}">${escapeHtml(tag.name_cn || tag.id)}</span>
          </div>
        </section>
      ` : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(tag) : ''}
    `;
  }

  renderStatusEditor() {
    const status = this.currentItem();
    if (!status) return this.emptyEditor('没有状态', '点击 + 新建自定义状态。');
    return `
      <div class="editor-head"><div><h1>${escapeHtml(status.name_cn || status.id)}</h1><p>${escapeHtml(status.id || '')}</p></div></div>
      ${this.tabs(['基础信息', '叠加规则', '触发逻辑', '显示样式', 'JSON'])}
      ${this.centerTab === '基础信息' ? `
        <section class="form-grid two">
          ${this.input('item.id', 'ID', shortId(this.modDraft, status.id))}
          ${this.input('item.name_cn', '中文名', status.name_cn)}
          ${this.input('item.name_en', '英文名', status.name_en)}
          ${this.textarea('item.description', '描述', status.description, 5)}
        </section>
      ` : ''}
      ${this.centerTab === '叠加规则' ? `
        <section class="form-grid three">
          ${this.select('item.stacking', '叠加规则', status.stacking, [['stack', 'stack'], ['duration', 'duration'], ['unique', 'unique']])}
          ${this.number('item.max_stack', '最大层数，0 表示不限制', status.max_stack)}
          ${this.select('item.decay_timing', '衰减时机', status.decay_timing || 'none', [['不衰减', 'none'], ['回合开始', 'turn_start'], ['回合结束', 'turn_end']])}
          ${this.checkbox('item.clear_on_death', '死亡时清除', status.clear_on_death !== false)}
          ${this.checkbox('item.keep_when_zero', '层数为 0 时不清除', !!status.keep_when_zero)}
        </section>
      ` : ''}
      ${this.centerTab === '触发逻辑' ? this.renderLogicWorkspace('statuses', status, EVENT_SETS.statuses) : ''}
      ${this.centerTab === '显示样式' ? `
        <section class="form-grid three">
          ${this.input('item.icon', 'Icon token', status.icon)}
          ${this.color('item.color', '颜色', status.color || '#64748b')}
          ${this.checkbox('item.visible', '显示在状态栏', status.visible !== false)}
          ${this.checkbox('item.show_stack', '显示层数', status.show_stack !== false)}
        </section>
      ` : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(status) : ''}
    `;
  }

  renderOpeningEventEditor() {
    const item = this.currentItem();
    if (!item) return this.emptyEditor('没有开局事件', '点击 + 新建开局事件。');
    return `
      <div class="editor-head"><div><h1>${escapeHtml(item.name_cn || item.id)}</h1><p>${escapeHtml(item.id || '')}</p></div></div>
      ${this.tabs(['基础信息', '位置与权重', '选择UI', '应用逻辑', 'JSON'])}
      ${this.centerTab === '基础信息' ? `
        <section class="form-grid two">
          ${this.input('item.id', 'ID', shortId(this.modDraft, item.id))}
          ${this.input('item.name_cn', '中文名', item.name_cn)}
          ${this.input('item.name_en', '英文名', item.name_en)}
          ${this.textarea('item.description', '描述', item.description, 5)}
        </section>
      ` : ''}
      ${this.centerTab === '位置与权重' ? `
        <section class="form-grid three">
          ${this.select('item.position', '位置', String(item.position || 1), [['1', '1'], ['2', '2'], ['3', '3']])}
          ${this.number('item.weight', '权重', item.weight || 1)}
          ${this.checkbox('item.unique', '同局唯一', !!item.unique)}
        </section>
      ` : ''}
      ${this.centerTab === '选择UI' ? `
        <section class="form-grid two">
          ${this.checkbox('item.requires_ui_choice', '需要 UI 选择', !!item.requires_ui_choice)}
          <div class="studio-card"><p>如果需要 UI，在应用逻辑中加入 request_ui 积木。第四阶段 runtime 会暂停并等待玩家提交受控结果。</p></div>
        </section>
      ` : ''}
      ${this.centerTab === '应用逻辑' ? this.renderLogicWorkspace('opening_events', item, EVENT_SETS.opening_events) : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(item) : ''}
    `;
  }

  renderUiComponentEditor() {
    const ui = this.currentItem();
    if (!ui) return this.emptyEditor('没有 UI 组件', '点击 + 新建受控 UI 组件。');
    const tabs = ['结构', '预览', 'JSON'];
    return `
      <div class="editor-head"><div><h1>${escapeHtml(ui.title_cn || ui.id)}</h1><p>${escapeHtml(ui.id || '')}</p></div></div>
      ${this.tabs(tabs)}
      ${this.centerTab === '结构' ? this.renderUiStructure(ui) : ''}
      ${this.centerTab === '预览' ? this.renderUiPreview(ui, true) : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(ui) : ''}
    `;
  }

  renderUiStructure(ui) {
    const controls = Array.isArray(ui.controls) ? ui.controls : [];
    const selected = controls[this.selectedUiControlIndex] || controls[0] || null;
    return `
      <section class="ui-builder">
        <div class="ui-tree">
          <h2>UI 结构树</h2>
          ${this.input('item.id', 'ID', shortId(this.modDraft, ui.id))}
          ${this.select('item.type', '组件类型', ui.type || 'modal', UI_COMPONENT_TYPES.map(v => [v, v]))}
          ${this.input('item.title_cn', '中文标题', ui.title_cn)}
          ${this.input('item.title_en', '英文标题', ui.title_en)}
          <div class="control-list">
            ${controls.map((control, index) => `
              <button class="${index === this.selectedUiControlIndex ? 'active' : ''}" data-action="select-ui-control" data-index="${index}">
                <strong>${escapeHtml(control.id || `control_${index + 1}`)}</strong>
                <span>${escapeHtml(control.type || 'text')}</span>
              </button>
            `).join('') || '<div class="empty-small">暂无控件</div>'}
          </div>
          <div class="inline-actions">
            <select id="new-ui-control-type">${UI_CONTROL_TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}</select>
            <button class="studio-btn small" data-action="add-ui-control">添加控件</button>
          </div>
        </div>
        <div class="ui-preview-pane">${this.renderUiPreview(ui)}</div>
        <div class="ui-props">
          <h2>控件属性</h2>
          ${selected ? this.renderUiControlProperties(selected, this.selectedUiControlIndex) : '<p class="empty-small">选择一个控件。</p>'}
          <h2>按钮（最多 6 个）</h2>
          <section class="form-grid one">
            ${(ui.buttons || []).map((button, index) => `
              <div class="button-row">
                ${this.input(`item.buttons.${index}.id`, '按钮 ID', button.id)}
                ${this.input(`item.buttons.${index}.text_cn`, '中文文案', button.text_cn
                  || button.label_cn || button.text || '')}
                ${this.input(`item.buttons.${index}.text_en`, '英文文案', button.text_en
                  || button.label_en || button.text || '')}
                ${this.select(`item.buttons.${index}.role`, '角色',
                  button.role || (button.id === 'cancel' ? 'cancel' : 'confirm'),
                  [['confirm', 'confirm（主按钮）'], ['cancel', 'cancel（次按钮）']])}
                <button class="studio-btn danger" data-action="delete-ui-button" data-index="${index}">删除按钮</button>
              </div>
            `).join('') || '<p class="empty-small">没有按钮，运行时会自动补「确认 / 取消」。</p>'}
            <button class="studio-btn small" data-action="add-ui-button">添加按钮</button>
          </section>
          <h2>样式 token</h2>
          <section class="form-grid one">
            ${this.select('item.style.accent', 'accent', ui.style?.accent || 'neutral', TOKEN_ACCENTS.map(v => [v, v]))}
            ${this.select('item.style.panel', 'panel', ui.style?.panel || 'solid', PANEL_TOKENS.map(v => [v, v]))}
            ${this.select('item.style.size', 'size', ui.style?.size || 'medium', SIZE_TOKENS.map(v => [v, v]))}
            ${this.select('item.style.icon', 'icon', ui.style?.icon || 'thorn', ICON_TOKENS.map(v => [v, v]))}
          </section>
        </div>
      </section>
    `;
  }

  renderUiControlProperties(control, index) {
    return `
      <section class="form-grid one">
        ${this.input(`item.controls.${index}.id`, '控件 ID', control.id)}
        ${this.select(`item.controls.${index}.type`, '类型', control.type || 'text', UI_CONTROL_TYPES.map(v => [v, v]))}
        ${this.input(`item.controls.${index}.label_cn`, '中文标签', control.label_cn)}
        ${this.input(`item.controls.${index}.label_en`, '英文标签', control.label_en)}
        ${['text', 'dynamic_text', 'warning_text', 'preview_value', 'divider'].includes(control.type) ? this.textarea(`item.controls.${index}.text_cn`, '中文文本', control.text_cn || control.text || '', 4) : ''}
        ${['dynamic_text', 'preview_value'].includes(control.type) ? this.input(`item.controls.${index}.value`, 'value 表达式 JSON（算出来替换 {value}）', JSON.stringify(control.value ?? 0), 'text', 'json_or_text') : ''}
        ${['slider', 'number', 'number_input'].includes(control.type) ? `
          ${this.input(`item.controls.${index}.default`, '默认值，可为表达式 JSON', JSON.stringify(control.default ?? 0), 'text', 'json_or_text')}
          ${this.input(`item.controls.${index}.min`, 'min，可为表达式 JSON', JSON.stringify(control.min ?? 0), 'text', 'json_or_text')}
          ${this.input(`item.controls.${index}.max`, 'max，可为表达式 JSON', JSON.stringify(control.max ?? 10), 'text', 'json_or_text')}
          ${this.input(`item.controls.${index}.step`, 'step', JSON.stringify(control.step ?? 1), 'text', 'json_or_text')}
        ` : ''}
        ${['select', 'radio_group', 'multi_select', 'card_catalog_picker'].includes(control.type) ? this.textarea(`item.controls.${index}.options`, 'options JSON', JSON.stringify(control.options || [{ value: 'a', label_cn: '选项 A' }], null, 2), 8, 'json') : ''}
        ${['select', 'radio_group'].includes(control.type) ? this.input(`item.controls.${index}.default`, '默认选项 value（可空，也可写表达式 JSON）', control.default === undefined ? '' : (typeof control.default === 'string' ? control.default : JSON.stringify(control.default)), 'text', 'json_or_text') : ''}
        ${this.textarea(`item.controls.${index}.default_from`, '默认值来源 / 输入记忆 JSON（可空）：{"player_var":"名字"} / {"card_var":"名字"} / {"var":"名字"}', JSON.stringify(control.default_from || null, null, 2), 4, 'json')}
        ${control.type === 'zone_picker' ? this.textarea(`item.controls.${index}.zones`, '可用区域（留空=全部）JSON', JSON.stringify(control.zones || [], null, 2), 4, 'json') : ''}
        ${control.type === 'text_input' ? `
          ${this.input(`item.controls.${index}.max_length`, '最大长度（引擎硬上限 200）', JSON.stringify(control.max_length ?? 64))}
          ${this.input(`item.controls.${index}.min_length`, '最小长度', JSON.stringify(control.min_length ?? 0))}
          ${this.input(`item.controls.${index}.pattern`, '正则（可空，整串匹配）', control.pattern || '')}
          ${this.select(`item.controls.${index}.normalize`, '归一化', control.normalize || 'trim', UI_TEXT_NORMALIZES.map(v => [v, v]))}
          ${this.select(`item.controls.${index}.moderation`, '违禁词过滤', control.moderation || 'mask', [['mask', 'mask（≥3 打码 / ≥4 拒）'], ['reject', 'reject（≥3 就拒）'], ['off', 'off（不过滤）']])}
          ${this.input(`item.controls.${index}.placeholder_cn`, '占位提示（中文）', control.placeholder_cn || '')}
        ` : ''}
        ${control.type === 'input' ? this.select(`item.controls.${index}.value_type`, '输入值类型', control.value_type || 'text', UI_INPUT_VALUE_TYPES.map(v => [v, v])) : ''}
        ${this.input(`item.controls.${index}.tab`, '分页 ID（可空，同 ID 归为一页）', control.tab || '')}
        ${control.tab ? this.input(`item.controls.${index}.tab_cn`, '分页名称（中文）', control.tab_cn || control.tab_label_cn || '') : ''}
        ${this.textarea(`item.controls.${index}.visible_if`, '显示条件 JSON（条件算子，或 {"control":"<id>","equals":…} 联动）', JSON.stringify(control.visible_if || null, null, 2), 4, 'json')}
        ${this.textarea(`item.controls.${index}.disabled_if`, '禁用条件 JSON（同上）', JSON.stringify(control.disabled_if || null, null, 2), 4, 'json')}
        ${['multi_card_picker', 'multi_equipment_picker', 'multi_select'].includes(control.type) ? `
          ${this.input(`item.controls.${index}.min_select`, '最少选几个', JSON.stringify(control.min_select ?? 0))}
          ${this.input(`item.controls.${index}.max_select`, '最多选几个', JSON.stringify(control.max_select ?? 1))}
        ` : ''}
        ${this.checkbox(`item.controls.${index}.required`, '必填', !!control.required)}
        ${this.input(`item.controls.${index}.help_text`, '帮助文字', control.help_text || '')}
        <button class="studio-btn danger" data-action="delete-ui-control" data-index="${index}">删除控件</button>
      </section>
    `;
  }

  renderUiPreview(ui, standalone = false) {
    const controls = Array.isArray(ui.controls) ? ui.controls : [];
    return `
      <div class="ui-preview-shell ${standalone ? 'standalone' : ''}">
        <div class="ui-modal-preview ${escapeHtml(ui.style?.panel || 'solid')} ${escapeHtml(ui.style?.accent || 'neutral')}">
          <header><span class="ui-icon">${escapeHtml(ui.style?.icon || 'thorn')}</span><strong>${escapeHtml(ui.title_cn || ui.title_en || ui.id)}</strong></header>
          <div class="ui-preview-controls">
            ${controls.map(control => this.renderControlPreview(control)).join('') || '<p class="empty-small">暂无控件</p>'}
          </div>
          <footer>
            ${(ui.buttons || []).map(btn => `<button class="studio-btn ${btn.role === 'cancel' ? '' : 'primary'}">${escapeHtml(btn.text_cn || btn.text_en || btn.id)}</button>`).join('')}
          </footer>
        </div>
      </div>
    `;
  }

  renderControlPreview(control) {
    const label = escapeHtml(control.label_cn || control.id);
    if (control.type === 'divider') return '<hr>';
    if (control.type === 'text' || control.type === 'dynamic_text') return `<p class="ui-text">${escapeHtml(control.text_cn || control.text || label)}</p>`;
    if (control.type === 'warning_text') return `<p class="ui-warning">${escapeHtml(control.text_cn || label)}</p>`;
    if (control.type === 'slider') return `<label>${label}<input type="range" min="0" max="10" value="4" disabled></label>`;
    if (control.type === 'number') return `<label>${label}<input type="number" value="${escapeHtml(control.default ?? 0)}" disabled></label>`;
    if (control.type === 'select') return `<label>${label}<select disabled><option>${escapeHtml(control.options?.[0]?.label_cn || control.options?.[0]?.value || '选项')}</option></select></label>`;
    if (control.type === 'radio_group') return `<label>${label}${(control.options || [{ value: 'a', label_cn: '选项 A' }]).slice(0, 3).map(opt => `<span class="inline-check"><input type="radio" disabled> ${escapeHtml(opt.label_cn || opt.value)}</span>`).join('')}</label>`;
    if (control.type === 'multi_select') return `<label>${label}${(control.options || [{ value: 'a', label_cn: '选项 A' }]).slice(0, 3).map(opt => `<span class="inline-check"><input type="checkbox" disabled> ${escapeHtml(opt.label_cn || opt.value)}</span>`).join('')}</label>`;
    if (control.type === 'zone_picker') return `<label>${label}<select disabled><option>手牌</option><option>抽牌堆</option><option>弃牌堆</option></select></label>`;
    if (control.type === 'preview_value') return `<p class="ui-text">${escapeHtml(control.text_cn || '{value}')} <strong>7</strong></p>`;
    if (control.type === 'text_input') return `<label>${label}<input type="text" placeholder="${escapeHtml(control.placeholder_cn || '')}" maxlength="${escapeHtml(String(control.max_length ?? 64))}" disabled></label>`;
    if (control.type === 'input') return `<label>${label}<input type="${control.value_type === 'number' ? 'number' : 'text'}" disabled></label>`;
    if (control.type === 'checkbox') return `<label class="inline-check"><input type="checkbox" disabled> ${label}</label>`;
    if (control.type?.includes('picker')) return `<button class="picker-preview">${label}</button>`;
    return `<label>${label}<input disabled value="${escapeHtml(control.default ?? '')}"></label>`;
  }

  renderEventHookEditor() {
    const hook = this.currentItem();
    if (!hook) return this.emptyEditor('没有事件钩子', '点击 + 新建 event hook。');
    return `
      <div class="editor-head"><div><h1>${escapeHtml(hook.hook || 'Event Hook')}</h1><p>${escapeHtml(hook.id || '')}</p></div></div>
      ${this.tabs(['钩子', '过滤器', '逻辑', 'JSON'])}
      ${this.centerTab === '钩子' ? `
        <section class="form-grid three">
          ${this.select('item.hook', 'Hook', hook.hook, hookOptions)}
          ${this.number('item.priority', 'Priority，越小越早', hook.priority || 0)}
          ${this.input('item.id', '内部 ID', hook.id || '')}
        </section>
      ` : ''}
      ${this.centerTab === '过滤器' ? this.textarea('item.filter', 'filter JSON', JSON.stringify(hook.filter || {}, null, 2), 12, 'json') : ''}
      ${this.centerTab === '逻辑' ? this.renderLogicWorkspace('event_hooks', hook, EVENT_SETS.event_hooks) : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(hook) : ''}
    `;
  }

  renderPatchEditor() {
    const patch = this.currentItem();
    if (!patch) return this.emptyEditor('没有补丁', '点击 + 新建 patch。');
    const needsSteps = ['append_event_steps', 'prepend_event_steps'].includes(patch.op);
    return `
      <div class="editor-head"><div><h1>${escapeHtml(patch.op || 'Patch')}</h1><p>${escapeHtml(patch.target || '')}</p></div></div>
      ${this.tabs(['补丁', '步骤', 'JSON'])}
      ${this.centerTab === '补丁' ? `
        <section class="form-grid two">
          ${this.input('item.id', '内部 ID', patch.id || '')}
          ${this.select('item.target_type', '目标类型', patch.target_type || 'card', [['card', 'card'], ['tag', 'tag'], ['status', 'status'], ['opening_event', 'opening_event'], ['ui_component', 'ui_component']])}
          ${this.input('item.target', '目标资源 ID', patch.target)}
          ${this.select('item.op', '操作', patch.op || 'add_tag', PATCH_OPS.map(op => [op, op]))}
          ${patch.op === 'modify_numeric_field' ? this.select('item.field', '字段', patch.field || 'cost_e', fieldOptions) : this.input('item.value', 'value / tag / line / token', typeof patch.value === 'object' ? JSON.stringify(patch.value) : patch.value || '')}
          ${patch.op === 'modify_numeric_field' ? this.input('item.value', '数值或表达式', typeof patch.value === 'object' ? JSON.stringify(patch.value) : patch.value || 0) : ''}
        </section>
      ` : ''}
      ${this.centerTab === '步骤' ? (needsSteps ? this.renderLogicWorkspace('patches', patch, EVENT_SETS.patches) : '<div class="empty-editor"><h2>此补丁操作不需要 steps</h2></div>') : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(patch) : ''}
    `;
  }

  renderCompatibilityEditor() {
    const item = this.currentItem();
    if (!item) return this.emptyEditor('没有兼容补丁', '点击 + 新建 compatibility。');
    return `
      <div class="editor-head"><div><h1>Compatibility</h1><p>${escapeHtml(item.if_mod_loaded || 'if_mod_loaded')}</p></div></div>
      ${this.tabs(['兼容', '补丁列表', 'JSON'])}
      ${this.centerTab === '兼容' ? `
        <section class="form-grid two">
          ${this.input('item.id', '内部 ID', item.id || '')}
          ${this.input('item.if_mod_loaded', '当模组存在时启用', item.if_mod_loaded || '')}
        </section>
      ` : ''}
      ${this.centerTab === '补丁列表' ? `
        <section class="studio-card">
          <button class="studio-btn small" data-action="add-compat-patch">添加兼容补丁</button>
          <div class="compat-patches">
            ${(item.patches || []).map((patch, index) => `
              <div class="compat-patch">
                <strong>${escapeHtml(patch.op || 'patch')}</strong>
                <code>${escapeHtml(patch.target || '')}</code>
                <button class="studio-btn tiny danger" data-action="delete-compat-patch" data-index="${index}">删除</button>
              </div>
            `).join('') || '<p class="empty-small">暂无 patch。</p>'}
          </div>
          ${this.textarea('item.patches', 'patches JSON', JSON.stringify(item.patches || [], null, 2), 12, 'json')}
        </section>
      ` : ''}
      ${this.centerTab === 'JSON' ? this.jsonPanel(item) : ''}
    `;
  }

  renderTestLab() {
    const cards = this.modDraft.registries.cards;
    const selectedCardId = this.testCardId || cards[0]?.id || '';
    return `
      <div class="editor-head"><div><h1>Test Lab</h1><p>静态测试、UI 预览和 Loadout 诊断。</p></div></div>
      ${this.tabs(['单卡测试', '状态测试', 'UI组件预览', 'Loadout诊断'])}
      ${this.centerTab === '单卡测试' ? `
        <section class="test-lab-grid">
          <div class="studio-card">
            <h2>输入</h2>
            <label>卡牌<select id="test-card-select">${cards.map(card => `<option value="${escapeHtml(card.id)}" ${card.id === selectedCardId ? 'selected' : ''}>${escapeHtml(card.name_cn || card.id)}</option>`).join('')}</select></label>
            <label>事件<select id="test-event-select">${(EVENT_SETS.cards || []).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
            <button class="studio-btn primary" data-action="test-run">执行静态测试</button>
          </div>
          <div class="studio-card">
            <h2>输出</h2>
            <pre>${escapeHtml(this.testLogs.slice(-12).join('\n') || '点击测试运行。')}</pre>
          </div>
        </section>
      ` : ''}
      ${this.centerTab === '状态测试' ? this.jsonPanel(this.modDraft.registries.statuses) : ''}
      ${this.centerTab === 'UI组件预览' ? `<section class="preview-grid">${this.modDraft.registries.ui_components.map(ui => this.renderUiPreview(ui, true)).join('') || '<div class="empty-editor">暂无 UI 组件</div>'}</section>` : ''}
      ${this.centerTab === 'Loadout诊断' ? this.renderLoadoutDiagnostic() : ''}
    `;
  }

  renderLoadoutDiagnostic() {
    const compiled = this.compileDraft({ includeEditor: false });
    const order = [compiled.manifest.id];
    const hookOrder = (compiled.event_hooks || []).slice().sort((a, b) => (a.priority || 0) - (b.priority || 0) || String(a.hook).localeCompare(String(b.hook)));
    return `
      <section class="info-grid">
        <div class="studio-card"><h2>加载顺序</h2><pre>${escapeHtml(JSON.stringify(order, null, 2))}</pre></div>
        <div class="studio-card"><h2>依赖错误</h2><pre>${escapeHtml(this.validation.errors.filter(e => e.includes('依赖') || e.includes('dependency')).join('\n') || '无')}</pre></div>
        <div class="studio-card"><h2>Patch</h2><pre>${escapeHtml(JSON.stringify(compiled.patches || [], null, 2))}</pre></div>
        <div class="studio-card"><h2>Event Hook 顺序</h2><pre>${escapeHtml(JSON.stringify(hookOrder.map(h => ({ hook: h.hook, priority: h.priority })), null, 2))}</pre></div>
        <div class="studio-card"><h2>Loadout Hash</h2><code>${escapeHtml(this.contentHash || '--')}</code></div>
      </section>
    `;
  }

  renderLogicWorkspace(kind, item, events) {
    const catalog = this.eventsForItem(kind, item, events);
    /* 左侧只列"这张资源上已经有时点"的事件，不再把十几个时点全摊开；
       没列出来的用「＋ 添加时点」自己加（会先在数据里建好这个事件）。 */
    const declared = this.declaredEventKeys(kind, item, catalog);
    /* 切换卡片时，如果当前选中的时点在这张卡上没有内容，自动跳到**第一个有内容的时点**，
       否则用户会看到一个空白编辑器却不知道要切换事件。 */
    if (!declared.includes(this.selectedEvent)) this.selectedEvent = declared[0] || '';
    if (declared.length && !this.hasEventContent(kind, item, this.selectedEvent)) {
      const withContent = declared.find(eventKey => this.hasEventContent(kind, item, eventKey));
      /* 刚「＋ 添加时点」选中的那个空时点要停住，别马上被"跳到有内容的时点"抢走 */
      if (withContent && this._pinnedEvent !== this.selectedEvent) this.selectedEvent = withContent;
    }
    const key = this.workspaceKey(kind, item, this.selectedEvent);
    const selectedLabel = catalog.find(([k]) => k === this.selectedEvent)?.[1] || this.selectedEvent;
    const stepCount = this.draftStepsForEvent(kind, item, this.selectedEvent).length;
    const remaining = catalog.filter(([k]) => !declared.includes(k));
    this.currentWorkspaceKey = key;
    this.currentWorkspaceMeta = { kind, eventKey: this.selectedEvent, itemKey: this.itemKey(kind, item, this.currentIndex()) };
    return `
      <section class="logic-editor">
        <div class="logic-sidebar">
          <h2>事件</h2>
          ${declared.length ? declared.map((eventKey) => {
            const label = catalog.find(([k]) => k === eventKey)?.[1] || eventKey;
            return `
            <div class="logic-event-row ${this.selectedEvent === eventKey ? 'active' : ''}">
              <button class="logic-event" data-event-key="${eventKey}">
                <span>${escapeHtml(label)}</span>
                ${this.hasEventContent(kind, item, eventKey) ? '<strong>已编辑</strong>' : ''}
              </button>
              <button class="logic-event-remove" data-remove-event="${eventKey}" title="从这张资源上移除这个时点">×</button>
            </div>`;
          }).join('') : '<p class="empty-small">这张资源还没有任何时点。用下面的「＋ 添加时点」挑一个。</p>'}
          <div class="logic-actions">
            ${remaining.length ? `
            <select class="studio-select logic-add-event" data-add-event>
              <option value="">＋ 添加时点…</option>
              ${remaining.map(([eventKey, label]) => `<option value="${eventKey}">${escapeHtml(label)}</option>`).join('')}
            </select>` : ''}
            <button class="studio-btn small" data-action="copy-event-json">复制 AST</button>
            <button class="studio-btn small" data-action="copy-logic-to">复制到其他事件</button>
            <button class="studio-btn small danger" data-action="clear-event-workspace">清空</button>
          </div>
        </div>
        <div class="logic-panel">
          <div class="logic-topline">
            <strong>${escapeHtml(selectedLabel)}</strong>
            <span>效果行编辑器 · ${stepCount} 步</span>
          </div>
          <!-- 效果行编辑器挂载点（Blockly 已移除，见 src/effect-editor.js） -->
          <div class="logic-workspace-stage"${declared.length ? ' data-effect-host' : ''}>${declared.length ? '' : '<div class="gee-empty">先在左边「＋ 添加时点」里挑一个时点（例如「打出时」），这张资源才会有地方放效果行。</div>'}</div>
        </div>
      </section>
    `;
  }

  /** 资源上已经声明过的时点（按目录顺序；目录里没有的排后面）。 */
  declaredEventKeys(kind, item, catalog) {
    if (kind === 'event_hooks' || kind === 'patches') return ['steps'];
    const owned = Object.keys(item?.events || {});
    const ordered = catalog.map(([key]) => key).filter(key => owned.includes(key));
    for (const key of owned) if (!ordered.includes(key)) ordered.push(key);
    return ordered;
  }

  /**
   * 下拉选项 = 生成目录（内置状态/标签）+ 当前草稿里自定义的那些。
   * kind 传 'statuses' / 'cards_tags' 分别取 registries.statuses / registries.tags。
   */
  choiceListFromRegistry(kind, catalog = {}) {
    const out = new Map();
    for (const [value, label] of Object.entries(catalog || {})) out.set(value, label);
    const list = kind === 'statuses' ? (this.modDraft.registries.statuses || []) : (this.modDraft.registries.tags || []);
    for (const item of list) {
      const id = String(item?.id || '').trim();
      if (!id) continue;
      const fallback = item.name_cn || item.name_en || id.split(':').pop();
      out.set(id, fallback);
      const short = id.split(':').pop();
      if (short && !out.has(short)) out.set(short, fallback);
    }
    return Array.from(out, ([value, label]) => ({ value, label }));
  }

  /** 「＋ 添加时点」：在资源数据里建好这个事件，再切过去。 */
  addEvent(eventKey) {
    const key = String(eventKey || '').trim();
    if (!key) return;
    const item = this.currentItem();
    if (!item) return;
    const kind = this.selectedKind;
    if (kind === 'event_hooks' || kind === 'patches') return;
    item.events = item.events && typeof item.events === 'object' ? item.events : {};
    if (!item.events[key]) item.events[key] = { steps: [] };
    this.selectedEvent = key;
    this._pinnedEvent = key;
    this.markDirty();
    this.renderCenter();
    this.renderInspector();
  }

  /** 把某个时点从资源上移除（数据里也删掉）。 */
  removeEvent(eventKey) {
    const key = String(eventKey || '').trim();
    const item = this.currentItem();
    if (!key || !item || !item.events || !(key in item.events)) return;
    const hasContent = this.hasEventContent(this.selectedKind, item, key);
    if (hasContent && !confirm('这个时点已经有内容，移除后数据也会一起删除。继续吗？')) return;
    delete item.events[key];
    if (this.selectedEvent === key) this.selectedEvent = '';
    this.markDirty();
    this.renderCenter();
    this.renderInspector();
  }

  eventsForItem(kind, item, baseEvents = []) {
    const out = [...baseEvents];
    const seen = new Set(out.map(([key]) => key));
    if (item && item.events && typeof item.events === 'object') {
      Object.keys(item.events).sort().forEach(key => {
        if (!seen.has(key)) {
          seen.add(key);
          out.push([key, key]);
        }
      });
    }
    return out;
  }

  logicTriggerMeta(kind, eventKey, fallbackLabel) {
    const cardTitles = {
      on_play: '当这张牌被打出时',
      on_response: '当这张牌作为反制响应时',
      on_equip: '当这张牌进入装备区时',
      on_equipment_trigger: '当这件装备主动触发时',
      on_owner_turn_start: '当持有者回合开始时',
      on_enemy_turn_start: '当敌方回合开始时',
      on_any_turn_start: '当任意玩家回合开始时',
      on_damage_taken: '当装备者受到伤害时',
      on_equipment_destroy: '当这件装备被摧毁时',
      on_fatal_set_health_exile: '当持有者将要失败时',
      on_enter_hand: '当这张牌进入手牌时',
      on_discard: '当这张牌进入弃牌堆时',
      on_exile: '当这张牌进入放逐区时',
      on_turn_start_while_equipped: '当装备者回合开始时',
      on_before_destroyed: '当这件装备将被摧毁时',
      on_hand_owner_turn_start: '当此卡在手牌中且持有者回合开始时',
      on_discard_owner_turn_start: '当此卡在弃牌堆中且持有者回合开始时',
    };
    const statusTitles = {
      on_apply: '当状态被添加时',
      on_remove: '当状态被移除时',
      on_turn_start: '当状态持有者回合开始时',
      on_turn_end: '当状态持有者回合结束时',
      on_damage_taken: '当状态持有者受到伤害时',
      on_damage_dealt: '当状态持有者造成伤害时',
      on_before_play_card: '当状态持有者打牌前',
      on_after_play_card: '当状态持有者打牌后',
    };
    const genericTitles = {
      opening_events: { on_apply: '当开局事件被应用时' },
      patches: { steps: '当补丁被应用时' },
    };
    let title = fallbackLabel || eventKey;
    if (kind === 'cards') title = cardTitles[eventKey] || title;
    else if (kind === 'statuses') title = statusTitles[eventKey] || title;
    else if (kind === 'event_hooks') title = `当 ${fallbackLabel || eventKey} Hook 触发时`;
    else title = genericTitles[kind]?.[eventKey] || title;
    return { title, note: '只读触发头，不会导出为积木' };
  }

  hasEventContent(kind, item, eventKey) {
    /* Blockly 已整体移除，所以不能再拿 editor.workspaces 当"这个时点有内容"的证据：
       旧草稿里留着 Blockly 工作区但没有 steps 时，会出现"事件标着已编辑、效果行却是空的"
       这种自相矛盾的状态（用户看到的就是这个）。只认 steps。 */
    const event = eventKey === 'steps' ? item?.steps : item?.events?.[eventKey];
    if (Array.isArray(event)) return event.length > 0;
    if (event && typeof event === 'object') {
      if (Array.isArray(event.steps)) return event.steps.length > 0;
      /* 声明式事件（无 steps，只有配置字段）也算有内容 */
      return Object.keys(event).length > 0;
    }
    return false;
  }

  /** 该时点是否是声明式配置（对象、没有 steps 数组），是就返回原文。 */
  declarativeEventFor(kind, item, eventKey) {
    if (kind === 'event_hooks' || kind === 'patches') return null;
    const event = item?.events?.[eventKey];
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    if (Array.isArray(event.steps)) return null;
    return Object.keys(event).length ? event : null;
  }

  /** 旧版 Blockly 留在草稿里的工作区数据（只用来提示，不再参与渲染）。 */
  legacyWorkspaceFor(kind, item, eventKey) {
    const saved = this.modDraft?.editor?.workspaces?.[this.workspaceKey(kind, item, eventKey)];
    return saved && typeof saved === 'object' && Object.keys(saved).length ? saved : null;
  }

  legacyWorkspaceCount() {
    const workspaces = this.modDraft?.editor?.workspaces;
    if (!workspaces || typeof workspaces !== 'object') return 0;
    return Object.keys(workspaces).length;
  }

  workspaceKey(kind, item, eventKey) {
    return `${kind}:${this.itemKey(kind, item, this.currentIndex())}:${eventKey}`;
  }

  workspaceItemFromMeta(meta = this.currentWorkspaceMeta) {
    const kind = meta?.kind || this.selectedKind;
    const itemKey = meta?.itemKey;
    const list = this.getList(kind);
    if (itemKey) {
      return list.find((item, index) => this.itemKey(kind, item, index) === itemKey) || null;
    }
    return this.currentItem();
  }

  /** 当前事件的步骤（从草稿里读，不看画布）。 */
  draftEventStepsForCurrent() {
    const meta = this.currentWorkspaceMeta || {};
    const kind = meta.kind || this.selectedKind;
    const eventKey = meta.eventKey || this.selectedEvent;
    const item = this.workspaceItemFromMeta(meta);
    return this.draftStepsForEvent(kind, item, eventKey);
  }

  draftStepsForEvent(kind, item, eventKey) {
    if (!item) return [];
    if (kind === 'event_hooks' || kind === 'patches') {
      return Array.isArray(item.steps) ? item.steps : [];
    }
    const event = item.events?.[eventKey];
    const steps = event?.steps || event;
    return Array.isArray(steps) ? steps : [];
  }

  /**
   * 把效果行编辑器挂进逻辑面板（Blockly 画布已整体移除，这里是唯一逻辑编辑界面）。
   */
  mountEffectEditor(container) {
    this.effectEditor?.element?.remove();
    const host = document.createElement('div');
    host.className = 'gee-host';
    container.appendChild(host);
    /* 切时点/切卡后总是从第一行看起，别停在上一张卡的滚动位置 */
    container.scrollTop = 0;
    this.effectEditor = createEffectEditor({
      container: host,
      steps: this.draftEventStepsForCurrent(),
      /* 状态下拉 = 游戏内置状态 + 本模组 registries.statuses；标签同理 */
      statusChoices: this.choiceListFromRegistry('statuses', cardTextRules.statusCatalog),
      tagChoices: this.choiceListFromRegistry('cards_tags', cardTextRules.tagLabels),
      emptyHint: this.logicEmptyHint(),
      emptyCoverage: this.declarativeEventFor(this.currentWorkspaceMeta?.kind || this.selectedKind,
        this.workspaceItemFromMeta(), this.currentWorkspaceMeta?.eventKey || this.selectedEvent)
        ? '此时点是声明式配置' : '',
      /* Round 101 / 批次 CW：「＋ 添加效果…」的全量 op 目录（工具生成，含中文名与默认参数） */
      opCatalog,
      onChange: (next) => {
        this.writeStepsToCurrentEvent(next);
        this.markDirty(false);
        this.scheduleWorkspaceReseed();
      },
    });
  }

  scheduleWorkspaceReseed() {
    clearTimeout(this._reseedTimer);
    this._reseedTimer = setTimeout(() => {
      if (!this.workspace) return;
      this.seedWorkspaceFromEvent();
    }, 260);
  }

  /** 空状态提示：说清"当前是哪个时点、这张卡哪些时点有内容"，别让用户对着空白猜。 */
  logicEmptyHint() {
    const meta = this.currentWorkspaceMeta || {};
    const kind = meta.kind || this.selectedKind;
    const eventKey = meta.eventKey || this.selectedEvent;
    const item = this.workspaceItemFromMeta(meta);
    if (!item) return '没有选中的资源。';
    const events = this.eventsForItem(kind, item, EVENT_SETS[kind] || []);
    const currentLabel = (events.find(([key]) => key === eventKey) || [])[1] || eventKey;
    const withContent = events
      .map(([key, label]) => [label, this.draftStepsForEvent(kind, item, key).length])
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${label}（${count} 步）`);
    if (!withContent.length) {
      if (this.legacyWorkspaceFor(kind, item, eventKey)) {
        return '⚠ 这个时点里只有旧版（Blockly）保存的积木，编辑器已移除画布，无法自动还原成效果行。'
          + '请点「+ 添加效果」重写这个时点，或重新导入模组后再编辑。';
      }
      const declarative = this.declarativeEventFor(kind, item, eventKey);
      if (declarative) {
        return '这个时点用的是声明式配置（没有步骤列表）：'
          + `${JSON.stringify(declarative).slice(0, 160)} —— 可以在「JSON」页签里改。`;
      }
      return '这张卡还没有任何效果步骤。点击「+ 添加效果」开始，或用「从模板插入…」选一个常见模式。';
    }
    return `当前时点「${currentLabel}」没有效果步骤。这张卡有内容的时点：${withContent.join('、')}。`;
  }

  seedWorkspaceFromEvent() {
    const meta = this.currentWorkspaceMeta || {};
    const kind = meta.kind || this.selectedKind;
    const eventKey = meta.eventKey || this.selectedEvent;
    const item = this.workspaceItemFromMeta(meta);
    if (!item || !this.workspace) return;
    const event = kind === 'event_hooks'
      ? { steps: item.steps || [] }
      : kind === 'patches'
        ? { steps: item.steps || [] }
        : item.events?.[eventKey];
    const steps = event?.steps || event;
    try {
      const generated = stepsToWorkspaceJson(Array.isArray(steps) ? steps : [], this.currentTriggerTitle());
      loadWorkspaceJson(this.workspace, generated);
      this.lockWorkspaceTriggerHead();
      this.modDraft.editor.workspaces[this.currentWorkspaceKey] = generated;
      if (Array.isArray(steps) && steps.length) this.toast('已从 AST 尝试反编译为 Blockly 积木。');
    } catch (error) {
      this.modDraft.editor.readonly_ast ||= {};
      this.modDraft.editor.readonly_ast[this.currentWorkspaceKey] = steps;
      this.toast('此事件无法反编译，已保留只读 AST。');
    }
  }

  migrateWorkspaceTriggerHeadIfNeeded() {
    if (!this.workspace) return;
    const hasHead = this.workspace.getAllBlocks(false).some(block => block.type === 'gtn_event_head');
    if (hasHead) {
      this.lockWorkspaceTriggerHead();
      return;
    }
    const steps = workspaceToSteps(this.workspace);
    const generated = stepsToWorkspaceJson(steps, this.currentTriggerTitle());
    loadWorkspaceJson(this.workspace, generated);
    this.modDraft.editor.workspaces[this.currentWorkspaceKey] = generated;
  }

  lockWorkspaceTriggerHead() {
    if (!this.workspace) return;
    const title = this.currentTriggerTitle();
    for (const block of this.workspace.getAllBlocks(false)) {
      if (block.type !== 'gtn_event_head') continue;
      const field = block.getField('LABEL');
      if (field && field.getValue() !== title) field.setValue(title);
      block.setDeletable(false);
      block.setMovable(false);
      if (typeof block.setEditable === 'function') block.setEditable(false);
    }
  }

  currentTriggerTitle() {
    const meta = this.workspace ? this.currentWorkspaceMeta : null;
    const kind = meta?.kind || this.selectedKind;
    const eventKey = meta?.eventKey || this.selectedEvent;
    const events = EVENT_SETS[kind] || [];
    const selectedLabel = events.find(([key]) => key === eventKey)?.[1] || eventKey;
    return this.logicTriggerMeta(kind, eventKey, selectedLabel).title;
  }

  saveWorkspace() {
    if (!this.workspace || !this.currentWorkspaceKey) return;
    this.lockWorkspaceTriggerHead();
    this.modDraft.editor.workspaces[this.currentWorkspaceKey] = workspaceToJson(this.workspace);
    const steps = workspaceToSteps(this.workspace);
    this.writeStepsToCurrentEvent(steps);
  }

  writeStepsToCurrentEvent(steps) {
    const meta = this.currentWorkspaceMeta || {};
    const kind = meta.kind || this.selectedKind;
    const eventKey = meta.eventKey || this.selectedEvent;
    const item = this.workspaceItemFromMeta(meta);
    if (!item) return;
    if (kind === 'event_hooks' || kind === 'patches') {
      item.steps = steps;
    } else {
      item.events ||= {};
      if (steps.length) item.events[eventKey] = { steps };
      else delete item.events[eventKey];
    }
  }

  currentEventSteps() {
    if (this.workspace) return workspaceToSteps(this.workspace);
    const item = this.currentItem();
    if (!item) return [];
    if (this.selectedKind === 'event_hooks' || this.selectedKind === 'patches') return item.steps || [];
    const event = item.events?.[this.selectedEvent];
    return event?.steps || event || [];
  }

  disposeWorkspace(save = true) {
    /* Blockly 已移除：这里只负责清理效果行编辑器 */
    if (this.workspace) {
      if (save) this.saveWorkspace();
      this.workspace.dispose();
      this.workspace = null;
    }
    clearTimeout(this._reseedTimer);
    this.effectEditor?.element?.remove();
    this.effectEditor = null;
  }

  input(path, label, value, type = 'text', mode = '') {
    const modeAttr = mode ? ` data-mode="${escapeHtml(mode)}"` : '';
    return `<label class="field"><span>${escapeHtml(label)}</span><input type="${type}" data-bind="${escapeHtml(path)}"${modeAttr} value="${escapeHtml(value ?? '')}"></label>`;
  }

  number(path, label, value) {
    return `<label class="field"><span>${escapeHtml(label)}</span><input type="number" data-bind="${escapeHtml(path)}" value="${escapeHtml(value ?? 0)}"></label>`;
  }

  color(path, label, value) {
    return `<label class="field"><span>${escapeHtml(label)}</span><input type="color" data-bind="${escapeHtml(path)}" value="${escapeHtml(value || '#64748b')}"></label>`;
  }

  textarea(path, label, value, rows = 4, mode = 'text') {
    return `<label class="field full"><span>${escapeHtml(label)}</span><textarea rows="${rows}" data-bind="${escapeHtml(path)}" data-mode="${mode}">${escapeHtml(value ?? '')}</textarea></label>`;
  }

  select(path, label, value, options) {
    return `<label class="field"><span>${escapeHtml(label)}</span><select data-bind="${escapeHtml(path)}">${options.map(([name, val]) => `<option value="${escapeHtml(val)}" ${String(value) === String(val) ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>`;
  }

  checkbox(path, label, checked) {
    return `<label class="check-card"><input type="checkbox" data-bind="${escapeHtml(path)}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  }

  jsonPanel(value) {
    return `<section class="json-panel"><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></section>`;
  }

  emptyEditor(title, detail) {
    return `<div class="empty-editor"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
  }

  updateBoundValue(element) {
    const path = element.dataset.bind;
    if (!path) return;
    const mode = element.dataset.mode;
    let value;
    if (element.type === 'checkbox' && element.dataset.arrayValue) {
      this.updateArrayCheckbox(path, element.dataset.arrayValue, element.checked);
      return;
    }
    if (element.type === 'checkbox') value = element.checked;
    else if (element.type === 'number') value = Number(element.value || 0);
    else if (mode === 'json') value = parseJsonField(element.value, this.getByPath(path));
    else if (mode === 'json_or_text') value = parseJsonOrTextField(element.value, this.getByPath(path));
    else if (mode === 'deps') value = listTextToDeps(element.value);
    else if (mode === 'lines') value = element.value.split('\n').map(line => line.trim()).filter(Boolean);
    else if (mode === 'csv') value = arrayFromCsv(element.value);
    else value = element.value;
    if (path === 'item.id') value = normalizeResourceId(this.modDraft, value, 'resource');
    if (path === 'manifest.id') value = slugify(value, 'my_mod').replaceAll('/', '_');
    if (path === 'manifest.resource_namespace') {
      value = String(value || '').trim() ? slugify(value, 'my_mod').replaceAll('/', '_') : '';
    }
    this.setByPath(path, value);
    if (path === 'item.id') this.selectedId = value;
    this.markDirty();
    if (path.endsWith('.id') || path === 'manifest.name' || path === 'manifest.version') {
      this.renderResourceTree();
      this.updateHeader();
    }
  }

  updateArrayCheckbox(path, value, checked) {
    const arr = Array.isArray(this.getByPath(path)) ? [...this.getByPath(path)] : [];
    if (checked && !arr.includes(value)) arr.push(value);
    if (!checked) {
      const index = arr.indexOf(value);
      if (index >= 0) arr.splice(index, 1);
    }
    this.setByPath(path, arr);
    this.markDirty();
  }

  getByPath(path) {
    const parts = path.split('.');
    let obj = this.resolvePathRoot(parts.shift());
    for (const part of parts) obj = obj?.[part];
    return obj;
  }

  setByPath(path, value) {
    const parts = path.split('.');
    let obj = this.resolvePathRoot(parts.shift());
    while (parts.length > 1) {
      const part = parts.shift();
      if (obj[part] === undefined) obj[part] = {};
      obj = obj[part];
    }
    obj[parts[0]] = value;
  }

  resolvePathRoot(root) {
    if (root === 'manifest') return this.modDraft.manifest;
    if (root === 'item') return this.currentItem();
    return this.modDraft[root];
  }

  addUiControl() {
    const ui = this.currentItem();
    if (!ui) return;
    const type = this.root.querySelector('#new-ui-control-type')?.value || 'text';
    ui.controls ||= [];
    ui.controls.push({ id: `${type}_${ui.controls.length + 1}`, type, label_cn: '新控件', label_en: 'Control' });
    this.selectedUiControlIndex = ui.controls.length - 1;
    this.markDirty();
    this.renderCenter();
  }

  deleteUiControl(index) {
    const ui = this.currentItem();
    if (!ui?.controls?.[index]) return;
    ui.controls.splice(index, 1);
    this.selectedUiControlIndex = Math.max(0, Math.min(this.selectedUiControlIndex, ui.controls.length - 1));
    this.markDirty();
    this.renderCenter();
  }

  /* Round 95 / 批次 CR：按钮以前只能改 JSON。引擎口径（mod_runtime_v2._sanitize_ui_component）：
     一个窗口最多 6 个按钮、每个按钮要有 id，文案认 text_cn / text_en（label_* 也认），
     role 只有 'cancel' 有特殊样式（次按钮），其余都按主按钮渲染。 */
  addUiButton() {
    const ui = this.currentItem();
    if (!ui) return;
    ui.buttons ||= [];
    if (ui.buttons.length >= 6) {
      this.toast('引擎最多认 6 个按钮');
      return;
    }
    const index = ui.buttons.length + 1;
    ui.buttons.push({ id: `option_${index}`, text_cn: '选项', text_en: `Option ${index}`, role: 'confirm' });
    this.markDirty();
    this.renderCenter();
  }

  deleteUiButton(index) {
    const ui = this.currentItem();
    if (!ui?.buttons?.[index]) return;
    ui.buttons.splice(index, 1);
    this.markDirty();
    this.renderCenter();
  }

  addCompatibilityPatch() {
    const item = this.currentItem();
    if (!item) return;
    item.patches ||= [];
    item.patches.push(makePatch());
    this.markDirty();
    this.renderCenter();
  }

  deleteCompatibilityPatch(index) {
    const item = this.currentItem();
    if (!item?.patches?.[index]) return;
    item.patches.splice(index, 1);
    this.markDirty();
    this.renderCenter();
  }

  async copyCurrentLogicToPrompt() {
    const item = this.currentItem();
    const events = EVENT_SETS[this.selectedKind] || [];
    const choices = events.map(([key, label]) => `${key}：${label}`).join('\n');
    const target = prompt(`复制当前事件逻辑到哪个事件？\n${choices}`, events[0]?.[0] || '');
    if (!target || !events.some(([key]) => key === target)) return;
    const sourceKey = this.workspaceKey(this.selectedKind, item, this.selectedEvent);
    const targetKey = this.workspaceKey(this.selectedKind, item, target);
    this.saveWorkspace();
    this.modDraft.editor.workspaces[targetKey] = clone(this.modDraft.editor.workspaces[sourceKey] || {});
    this.markDirty();
    this.toast('逻辑已复制');
  }

  markDirty(schedule = true) {
    this.dirty = true;
    this.updateHeader();
    if (schedule) {
      clearTimeout(this.changeTimer);
      this.changeTimer = setTimeout(() => this.refreshCompiledState({ validate: false }).then(() => {
        this.renderInspector();
        this.renderBottom();
      }), 250);
    }
  }

  compileDraft({ includeEditor = true } = {}) {
    this.saveWorkspace();
    const out = clone(this.modDraft);
    out.format_version = 2;
    /* manifest.id 是模组身份，不能被资源命名空间顶掉（DLC 包：id=bio_dlc、resource_namespace=bio）。 */
    out.manifest.id = slugify(out.manifest.id || 'my_mod', 'my_mod').replaceAll('/', '_');
    if (out.manifest.resource_namespace) {
      out.manifest.resource_namespace = slugify(out.manifest.resource_namespace, out.manifest.id).replaceAll('/', '_');
    }
    out.manifest.api_version = out.manifest.api_version || '2.0';
    for (const key of Object.keys(out.registries)) {
      out.registries[key] = (out.registries[key] || []).map((item, index) => {
        const next = clone(item);
        if (next.id) next.id = normalizeResourceId(out, next.id, `${key}_${index + 1}`);
        if (key === 'cards') next.tags = (next.tags || []).map(tag => normalizeResourceId(out, tag, 'tag'));
        if (key === 'cards') this.sanitizeCardAssetForPackage(next);
        return next;
      });
    }
    if (!includeEditor) delete out.editor;
    return out;
  }

  sanitizeCardAssetForPackage(card) {
    const assets = card.assets && typeof card.assets === 'object' ? { ...card.assets } : {};
    const candidates = [assets.image, assets.card_image, card.image, card.image_url]
      .map(value => String(value || '').replace(/\\/g, '/').trim())
      .filter(Boolean);
    const packaged = candidates.find(value => isPackagedAssetPath(value) && !isRuntimeGeneratedImageUrl(value));
    if (packaged) assets.image = packaged;
    if (assets.image && isRuntimeGeneratedImageUrl(assets.image)) delete assets.image;
    if (assets.card_image && isRuntimeGeneratedImageUrl(assets.card_image)) delete assets.card_image;
    if (Object.keys(assets).length) card.assets = assets;
    else delete card.assets;
    if (isPackagedAssetPath(card.image) || isRuntimeGeneratedImageUrl(card.image)) delete card.image;
    if (isPackagedAssetPath(card.image_url) || isRuntimeGeneratedImageUrl(card.image_url)) delete card.image_url;
  }

  async refreshCompiledState({ validate = true } = {}) {
    const compiled = this.compileDraft({ includeEditor: true });
    this.contentHash = await sha256(compiled);
    if (validate) {
      this.validation = this.validate(compiled);
      /* 本地校验只看结构；服务端用的才是线上那份 op 白名单，
         能拦住"本地通过、线上报错"。连不上就退化成仅本地校验。 */
      const online = await this.validateWithServer(compiled);
      this.validation = {
        ...this.validation,
        errors: [...this.validation.errors, ...online.errors],
        warnings: [...this.validation.warnings, ...online.warnings],
      };
    }
    return compiled;
  }

  /** 调 /api/mod-studio/validate（同源代理转发到游戏服务）。 */
  async validateWithServer(compiled) {
    const payload = { ...compiled };
    delete payload.editor;
    let response;
    try {
      response = await fetch('/api/mod-studio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return { errors: [], warnings: [`未能连接校验服务，已跳过服务端校验（${error.message}）`] };
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 413) {
      return { errors: [], warnings: [data.error || '模组超过服务端校验上限（128 KB），已跳过服务端校验'] };
    }
    if (response.status === 429) {
      return { errors: [], warnings: [data.error || '校验请求过于频繁，稍后再试'] };
    }
    if (!response.ok && !(data.errors || []).length) {
      return { errors: [data.error || `服务端校验失败（HTTP ${response.status}）`], warnings: [] };
    }
    const errors = (data.errors || []).map((text) => `[服务端] ${text}`);
    const warnings = (data.warnings || []).map((text) => `[服务端] ${text}`);
    return { errors, warnings };
  }

  validate(compiled) {
    const errors = [];
    const warnings = [];
    const namespaceRe = /^[a-z0-9_]+$/;
    const resourceRe = /^[a-z0-9_]+:[a-z0-9_]+(?:\/[a-z0-9_]+)*$/;
    const reserved = new Set(['gtn', 'core', 'system']);
    const m = compiled.manifest || {};
    /* 资源命名空间：DLC / 扩展包可以声明 resource_namespace，资源 ID 用它而不是 manifest.id
       （与服务端 mod_validator_v2 的 `resource_namespace or mod_id` 保持一致）。 */
    const resourceNamespace = String(m.resource_namespace || m.id || '').trim() || m.id;
    if (!namespaceRe.test(m.id || '')) errors.push('manifest.id 必须只包含小写字母、数字、下划线。');
    if (reserved.has(m.id)) errors.push('社区 v2 模组不能使用 gtn/core/system 命名空间。');
    if (!namespaceRe.test(resourceNamespace || '')) errors.push('manifest.resource_namespace 必须是合法模组命名空间。');
    if (reserved.has(resourceNamespace)) errors.push(`社区 v2 模组不能使用保留资源命名空间 ${resourceNamespace}。`);
    if (!m.name) errors.push('manifest.name 必填。');
    if (!m.version) errors.push('manifest.version 必填。');
    if (!String(m.api_version || '').startsWith('2.')) errors.push('manifest.api_version 必须兼容 2.x。');
    for (const cap of m.capabilities || []) {
      if (!CAPABILITIES.includes(cap)) warnings.push(`未知 capability：${cap}`);
    }
    const seen = new Map();
    const allIds = new Set();
    for (const [key, items] of Object.entries(compiled.registries || {})) {
      if (!Array.isArray(items)) {
        errors.push(`registries.${key} 必须是数组。`);
        continue;
      }
      for (const [index, item] of items.entries()) {
        if (!resourceRe.test(item.id || '')) errors.push(`registries.${key}[${index}].id 不是合法命名空间资源 ID：${item.id || ''}`);
        if (resourceRe.test(item.id || '') && !String(item.id).startsWith(`${resourceNamespace}:`)) {
          errors.push(`registries.${key}[${index}].id 必须使用当前模组命名空间 ${resourceNamespace}:，当前为 ${item.id}`);
        }
        if (seen.has(item.id)) errors.push(`资源 ID 重复：${item.id}`);
        seen.set(item.id, `${key}[${index}]`);
        allIds.add(item.id);
        if (key === 'ui_components') this.validateUiComponent(item, errors, warnings);
        this.validateStepsInResource(key, item, errors, warnings);
      }
    }
    for (const card of compiled.registries.cards || []) {
      for (const tag of card.tags || []) {
        if (!resourceRe.test(tag)) {
          errors.push(`卡牌 ${card.id} 的标签 ID 不合法：${tag}`);
          continue;
        }
        if (allIds.has(tag) || builtinTags.has(String(tag).split(':').pop())) continue;
        /* 本地看不到别的包（同一命名空间的 Addition 包、依赖模组）定义的标签，
           服务端也不做这项校验，所以这里不报——否则官方 DLC 一导入就飘红。
           （例：sewers:confusion 定义在 Sewers Cards Addition，被 DLC 的卡引用；
           garden:candle 引用 arctic:ready 同理。） */
        continue;
      }
    }
    for (const hook of compiled.event_hooks || []) {
      if (!hookOptions.some(([, value]) => value === hook.hook)) warnings.push(`未知 event hook：${hook.hook}`);
      if (!Number.isInteger(Number(hook.priority || 0))) errors.push(`event hook ${hook.id || hook.hook} 的 priority 必须是整数。`);
      this.validateSteps(hook.steps || [], `event_hooks.${hook.hook}`, errors, warnings);
    }
    for (const patch of compiled.patches || []) this.validatePatch(patch, allIds, errors, warnings);
    for (const compat of compiled.compatibility || []) {
      if (!namespaceRe.test(compat.if_mod_loaded || '')) errors.push(`compatibility.if_mod_loaded 不合法：${compat.if_mod_loaded || ''}`);
      for (const patch of compat.patches || []) this.validatePatch(patch, allIds, errors, warnings, true);
    }
    return { errors, warnings, refs: [] };
  }

  validateUiComponent(ui, errors, warnings) {
    if (!UI_COMPONENT_TYPES.includes(ui.type)) {
      warnings.push(`UI 组件 ${ui.id} 的类型 ${ui.type} 当前 runtime 可能不支持。`);
    }
    const controlIds = new Set();
    for (const control of ui.controls || []) {
      if (!control.id) errors.push(`UI 组件 ${ui.id} 有控件缺少 id。`);
      if (controlIds.has(control.id)) errors.push(`UI 组件 ${ui.id} 控件 ID 重复：${control.id}`);
      controlIds.add(control.id);
      if (!UI_CONTROL_TYPES.includes(control.type)) errors.push(`UI 控件 ${control.id} 类型不在白名单：${control.type}`);
      this.validateUiControlParams(ui, control, errors, warnings);
    }
    /* Round 96 / 批次 CS：按钮的发布期检查（运行时是"丢弃/回落"，所以只 warning）。 */
    if (!(ui.title_cn || ui.title || ui.title_en)) {
      warnings.push(`UI 组件 ${ui.id} 没有标题文案（窗口顶上会是空的）。`);
    }
    const buttons = ui.buttons;
    if (buttons !== undefined && !Array.isArray(buttons)) {
      warnings.push(`UI 组件 ${ui.id} 的 buttons 必须是数组（运行时会补默认按钮）。`);
    } else if (Array.isArray(buttons)) {
      if (buttons.length > 6) {
        warnings.push(`UI 组件 ${ui.id} 有 ${buttons.length} 个按钮，引擎只认前 6 个。`);
      }
      buttons.forEach((button, index) => {
        if (!button || typeof button !== 'object') {
          warnings.push(`UI 组件 ${ui.id} 的按钮[${index}] 必须是对象（引擎会丢弃）。`);
          return;
        }
        if (!String(button.id || '').trim()) {
          warnings.push(`UI 组件 ${ui.id} 的按钮[${index}] 没有 id（引擎会丢弃，不会渲染）。`);
        }
        if (!(button.text_cn || button.label_cn || button.text || button.label)) {
          warnings.push(`UI 组件 ${ui.id} 的按钮 ${button.id || index + 1} 没有中文文案。`);
        }
        if (button.role !== undefined && typeof button.role !== 'string') {
          warnings.push(`UI 组件 ${ui.id} 的按钮 ${button.id || index + 1} role 必须是字符串。`);
        }
      });
    }
  }

  /* Round 94 / 批次 CQ：新 UI 控件的参数校验（与 mod_validator_v2._ui_control_param_checks
     同一套口径）——运行时**会拒绝**的写错值报 error，运行时**静默兜底**的报 warning。 */
  validateUiControlParams(ui, control, errors, warnings) {
    const where = `UI 控件 ${ui.id}.${control.id || '(无 id)'}`;
    if (control.type === 'input') {
      const valueType = String(control.value_type || 'text').trim().toLowerCase();
      if (!UI_INPUT_VALUE_TYPES.includes(valueType)) {
        errors.push(`${where} 的 value_type 不在受控词表：${control.value_type}（只认 ${UI_INPUT_VALUE_TYPES.join(' / ')}）`);
      }
    }
    if (control.type === 'text_input') {
      const normalize = String(control.normalize || 'trim').trim().toLowerCase();
      if (!UI_TEXT_NORMALIZES.includes(normalize)) {
        errors.push(`${where} 的 normalize 不在受控词表：${control.normalize}（只认 ${UI_TEXT_NORMALIZES.join(' / ')}）`);
      }
      const moderation = String(control.moderation || 'mask').trim().toLowerCase();
      if (!UI_TEXT_MODERATIONS.includes(moderation)) {
        errors.push(`${where} 的 moderation 不在受控词表：${control.moderation}（只认 ${UI_TEXT_MODERATIONS.join(' / ')}）`);
      }
      const pattern = String(control.pattern || '').trim();
      if (pattern) {
        try {
          new RegExp(pattern);
        } catch (error) {
          errors.push(`${where} 的 pattern 不是合法正则：${error.message}`);
        }
      }
      const maxLength = control.max_length;
      if (maxLength !== undefined && maxLength !== null) {
        if (typeof maxLength !== 'number' || !Number.isFinite(maxLength)) {
          warnings.push(`${where} 的 max_length 不是数字（运行时按默认 64 处理）：${maxLength}`);
        } else if (maxLength <= 0 || maxLength > UI_TEXT_HARD_MAX_LENGTH) {
          warnings.push(`${where} 的 max_length 超出 1..${UI_TEXT_HARD_MAX_LENGTH}（运行时按硬上限/默认值处理）：${maxLength}`);
        }
      }
    }
    const defaultFrom = control.default_from;
    if (defaultFrom && typeof defaultFrom === 'object' && !Array.isArray(defaultFrom)) {
      if (!['player_var', 'card_var', 'var'].some(key => key in defaultFrom)) {
        warnings.push(`${where} 的 default_from 认不出来（只认 player_var / card_var / var），运行时会忽略：${JSON.stringify(defaultFrom)}`);
      }
    } else if (defaultFrom) {
      warnings.push(`${where} 的 default_from 必须是对象（只认 player_var / card_var / var），运行时会忽略。`);
    }
    for (const key of ['visible_if', 'disabled_if']) {
      const rule = control[key];
      if (rule !== undefined && rule !== null && (typeof rule !== 'object' || Array.isArray(rule))) {
        warnings.push(`${where} 的 ${key} 必须是对象（条件算子或兄弟控件规则），当前会被忽略。`);
      }
    }
    if (typeof control.min_select === 'number' && typeof control.max_select === 'number'
        && control.min_select > control.max_select) {
      warnings.push(`${where} 的 min_select(${control.min_select}) 大于 max_select(${control.max_select})，运行时会把上限抬到下限。`);
    }
  }

  validateStepsInResource(kind, item, errors, warnings) {
    const events = item.events || {};
    for (const [eventName, event] of Object.entries(events)) {
      const label = `${kind}.${item.id}.${eventName}`;
      /* 声明式事件（官方包里就有：void 的 on_damage_absorb / on_target_restrict）
         内容是一组配置字段而不是 steps 列表，服务端 mod_validator_v2 同样接受，别误报。 */
      if (event && typeof event === 'object' && !Array.isArray(event) && !Array.isArray(event.steps)) {
        if (event.steps !== undefined) errors.push(`${label} 的 steps 必须是数组。`);
        continue;
      }
      const steps = Array.isArray(event) ? event : (event?.steps || []);
      this.validateSteps(steps, label, errors, warnings);
    }
  }

  validateSteps(steps, label, errors, warnings, depth = 0) {
    if (!Array.isArray(steps)) {
      errors.push(`${label} steps 必须是数组。`);
      return;
    }
    if (steps.length > 200) errors.push(`${label} steps 超过 200。`);
    if (depth > 20) errors.push(`${label} 嵌套深度超过 20。`);
    /* op 白名单来自生成契约（运行时全量），不再是写死的旧清单——
       否则像 request_target 这种高频 op 会被误报"未识别"。 */
    const knownOps = opSchemaOps;
    const legacyKnownOps = new Set([
      'deal_damage', 'heal', 'draw_cards', 'gain_e', 'gain_m',
      'move_card', 'create_card', 'destroy_equipment', 'if', 'for_each', 'set_var', 'add_var', 'log',
      'request_ui', 'request_card', 'modify_event_value', 'stop', 'cancel_event', 'cancel_current_card', 'show_hint',
      'repeat', 'break', 'continue',
      'repeat_until', 'if_else', 'direct_damage', 'lifesteal_damage', 'triangle_damage',
      /* Round 24 / 29 / 31：护甲/闪避、状态族、清状态、每回合修正、资源、标签、
         装备减抽、摧毁装备、卡牌属性、玩家状态层数各自的旧名已合并
         （见 mod_spec_v2.REMOVED_ATOMIC_OPS），这里补上规范名。 */
      'player_status_layers', 'card_prop_change',
      'player_stat_change', 'turn_mod_add', 'resource_spend', 'global_mult', 'equip_reduce_draw', 'vulnus',
      'clear_statuses', 'clear_status',
      'status_add_named', 'status_remove_named', 'set_status_named',
      /* Round 29 / 批次 X：取牌族 / 区域移动 / 摧毁装备 / 变量 / 玩家属性 / 卡内计数器
         各自的旧名已合并（见 mod_spec_v2.REMOVED_ATOMIC_OPS），这里换成规范名。 */
      'set_health', 'aura_enemy_elixir_recovery', 'choose_from_zone',
      'reveal_enemy_hand', 'steal_enemy_card', 'reveal_deck_top',
      'copy_card', 'copy_choice_with_discount', 'discard_choice_then_draw', 'give_card_to_hand', 'give_card_to_deck',
      'give_card_to_discard', 'give_card_to_exile', 'remove_specific_card', 'move_card',
      'place_as_equip', 'add_equipment_to_zone',
      'destroy_equipment', 'destroy_equipment_choice_or_first',
      'destroy_all_destroyable_equipment', 'destroy_self_equipment', 'trigger_manual',
      'equip_protection', 'response_declare', 'invincible', 'skip_turn', 'block_action',
      'force_end_turn', 'fission', 'fusion', 'multiply_next_damage', 'reduce_next_cost',
      'increase_next_cost', 'add_tag', 'remove_tag', 'clear_tags', 'player_prop_change',
      'card_prop_set', 'card_prop_add', 'card_prop_mul', 'equipment_prop_set',
      'equipment_prop_add', 'player_var_change', 'card_var_change', 'card_counter', 'list_set',
      'list_append', 'list_clear', 'for_each_list', 'for_each_selected_card', 'timed_effect',
    ]);
    /* 兼容：旧清单里可能有生成契约未收录的名字，两者取并集 */
    const allKnownOps = new Set([...knownOps, ...legacyKnownOps]);
    const uiIds = new Set(this.modDraft.registries.ui_components.map(ui => normalizeResourceId(this.modDraft, ui.id)));
    for (const [index, step] of steps.entries()) {
      if (!step || typeof step !== 'object') {
        errors.push(`${label}[${index}] 必须是对象。`);
        continue;
      }
      const op = step.op || step.type;
      if (!allKnownOps.has(op)) {
        warnings.push(
          `${label}[${index}] 使用当前编辑器未完全识别的 op：${op}`
          + '（若游戏代码刚加过原子能力，先在 Python联机版 跑 tools/extract_op_schema.py 重新生成契约）',
        );
      }
      if (op === 'request_ui') {
        const component = typeof step.component === 'string' ? normalizeResourceId(this.modDraft, step.component) : step.component?.id;
        if (typeof component === 'string' && !component.startsWith('inline:') && !uiIds.has(component)) errors.push(`${label}[${index}] request_ui 引用了不存在的 UI 组件：${component}`);
        /* Round 94 / 批次 CQ：步骤参数的词表校验（与 mod_validator_v2._request_ui_param_checks 同口径）。 */
        if (step.on_invalid !== undefined) {
          const onInvalid = String(step.on_invalid || 'close').trim().toLowerCase();
          if (!UI_REQUEST_ON_INVALID.includes(onInvalid)) {
            errors.push(`${label}[${index}] request_ui 的 on_invalid 不在受控词表：${step.on_invalid}（只认 ${UI_REQUEST_ON_INVALID.join(' / ')}）`);
          }
        }
        const timeout = step.timeout_ms;
        if (timeout !== undefined && timeout !== null
            && (typeof timeout !== 'number' && typeof timeout !== 'object')) {
          warnings.push(`${label}[${index}] request_ui 的 timeout_ms 不是数字也不是取值表达式（运行时按 0 = 不限时）：${timeout}`);
        } else if (typeof timeout === 'number' && timeout < 0) {
          warnings.push(`${label}[${index}] request_ui 的 timeout_ms 是负数（运行时按 0 = 不限时）：${timeout}`);
        }
      }
      for (const childKey of ['steps', 'then', 'else', 'body', 'on_cancel']) {
        if (Array.isArray(step[childKey])) this.validateSteps(step[childKey], `${label}[${index}].${childKey}`, errors, warnings, depth + 1);
      }
    }
  }

  validatePatch(patch, allIds, errors, warnings, compatibility = false) {
    if (!PATCH_OPS.includes(patch.op)) errors.push(`patch op 不在白名单：${patch.op}`);
    if (patch.target && !allIds.has(patch.target)) warnings.push(`${compatibility ? 'compatibility ' : ''}patch 目标当前不存在：${patch.target}`);
  }

  async exportJson() {
    await this.refreshCompiledState({ validate: true });
    if (this.validation.errors.length) {
      this.toast('存在错误，已阻止导出');
      this.bottomTab = '校验结果';
      this.renderAll();
      return;
    }
    const json = JSON.stringify(this.compileDraft({ includeEditor: true }), null, 2);
    const zip = new JSZip();
    zip.file('mod.json', json);
    for (const [path, assetBlob] of this.assetFiles.entries()) {
      if (isSupportedImageName(path)) zip.file(path, assetBlob);
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.modDraft.manifest.id || 'gtn_mod'}-${this.modDraft.manifest.version || '0.1.0'}.gtnmod`;
    a.click();
    URL.revokeObjectURL(url);
    this.testLogs.push(`已导出 ${a.download}`);
  }

  async runTestLab() {
    await this.refreshCompiledState({ validate: true });
    const cardId = this.root.querySelector('#test-card-select')?.value || this.modDraft.registries.cards[0]?.id;
    const eventKey = this.root.querySelector('#test-event-select')?.value || 'on_play';
    const card = this.modDraft.registries.cards.find(item => item.id === cardId) || this.modDraft.registries.cards[0];
    const steps = card?.events?.[eventKey]?.steps || [];
    const summary = [
      `测试卡牌：${card?.name_cn || card?.id || '无'}`,
      `事件：${eventKey}`,
      `步骤数：${steps.length}`,
      `校验错误：${this.validation.errors.length}`,
      `校验警告：${this.validation.warnings.length}`,
      steps.length ? `首个步骤：${JSON.stringify(steps[0])}` : '此事件没有逻辑。',
    ].join('\n');
    this.testLogs.push(summary);
  }

  renderInspector() {
    const tabs = this.root.querySelectorAll('[data-inspector-tab]');
    tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.inspectorTab === this.inspectorTab));
    const body = this.root.querySelector('#inspector-body');
    if (!body) return;
    const item = this.selectedKind === 'manifest' ? this.modDraft.manifest : this.currentItem();
    if (this.inspectorTab === '属性') {
      body.innerHTML = `
        <h2>${escapeHtml(RESOURCE_LABELS[this.selectedKind]?.singular || this.selectedKind)}</h2>
        <dl class="inspector-list">
          <dt>当前资源</dt><dd>${escapeHtml(this.displayName(this.selectedKind, item))}</dd>
          <dt>ID</dt><dd><code>${escapeHtml(this.displayId(item) || this.modDraft.manifest.id)}</code></dd>
          <dt>当前 Tab</dt><dd>${escapeHtml(this.centerTab)}</dd>
          <dt>当前事件</dt><dd>${escapeHtml(this.selectedEvent || '-')}</dd>
        </dl>
      `;
    } else if (this.inspectorTab === '文档') {
      body.innerHTML = `
        <h2>说明</h2>
        <p>${escapeHtml(DOCS[this.selectedKind] || '')}</p>
        <h2>Block Registry</h2>
        <div class="token-list">${BLOCK_CATEGORIES.map(cat => `<span>${escapeHtml(cat.name)}</span>`).join('')}</div>
        <p>积木数量：${BLOCK_REGISTRY.length}</p>
      `;
    } else if (this.inspectorTab === '引用') {
      const id = item?.id || '';
      const refs = this.findReferences(id);
      body.innerHTML = `<h2>引用 ${escapeHtml(id)}</h2>${refs.map(ref => `<div class="ref-row">${escapeHtml(ref)}</div>`).join('') || '<p class="empty-small">没有找到引用。</p>'}`;
    } else if (this.inspectorTab === '错误') {
      body.innerHTML = `
        <h2>错误</h2>
        ${this.validation.errors.map(e => `<div class="issue danger">${escapeHtml(e)}</div>`).join('') || '<p class="empty-small">无错误。</p>'}
        <h2>警告</h2>
        ${this.validation.warnings.map(e => `<div class="issue warn">${escapeHtml(e)}</div>`).join('') || '<p class="empty-small">无警告。</p>'}
      `;
    } else {
      body.innerHTML = `<pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>`;
    }
  }

  findReferences(id) {
    if (!id) return [];
    const refs = [];
    const walk = (value, path) => {
      if (typeof value === 'string' && value === id) refs.push(path);
      else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
      else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`));
    };
    walk(this.modDraft, 'modDraft');
    return refs.filter(ref => !ref.endsWith('.id'));
  }

  renderBottom() {
    const tabs = this.root.querySelectorAll('[data-bottom-tab]');
    tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.bottomTab === this.bottomTab));
    const body = this.root.querySelector('#bottom-body');
    if (!body) return;
    if (this.bottomTab === '校验结果') {
      body.innerHTML = `
        <div class="bottom-grid">
          <div><strong>错误 ${this.validation.errors.length}</strong>${this.validation.errors.map(e => `<p class="issue danger">${escapeHtml(e)}</p>`).join('') || '<p class="empty-small">无错误。</p>'}</div>
          <div><strong>警告 ${this.validation.warnings.length}</strong>${this.validation.warnings.map(e => `<p class="issue warn">${escapeHtml(e)}</p>`).join('') || '<p class="empty-small">无警告。</p>'}</div>
        </div>
      `;
    } else if (this.bottomTab === '测试日志') {
      body.innerHTML = `<pre>${escapeHtml(this.testLogs.slice(-30).join('\n\n') || '暂无测试日志。')}</pre>`;
    } else if (this.bottomTab === '运行时错误') {
      body.innerHTML = `<pre>${escapeHtml(this.runtimeErrors.join('\n') || '暂无运行时错误。')}</pre>`;
    } else if (this.bottomTab === '生成 JSON') {
      body.innerHTML = `<pre>${escapeHtml(JSON.stringify(this.compileDraft({ includeEditor: true }), null, 2))}</pre>`;
    } else {
      body.innerHTML = `<pre>${escapeHtml(this.diffText || (this.dirty ? '草稿已修改，尚未保存。' : '无差异。'))}</pre>`;
    }
  }

  toast(message) {
    let node = document.querySelector('.studio-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'studio-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
  }
}

export async function bootstrapGtnModStudio(root) {
  const studio = new GtnModStudio(root);
  await studio.init();
  window.gtnModStudio = studio;
  return studio;
}
