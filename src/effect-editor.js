/* 效果行编辑器：直接用步骤数组工作，不依赖 Blockly。
   与 GTN Mod Studio 的数据模型对接方式：

     const editor = createEffectEditor({ container, steps, onChange });
     editor.setSteps(nextSteps);   // 切换卡片/事件时重新载入
     editor.getSteps();            // 取回当前步骤（onChange 里也会给）

   槽位编辑会直接写回原始步骤对象，未识别为句型的 op 以"原样保留"行显示，
   管道型 op（变量、战报文案、每回合一次）默认折叠。 */

import {
  templates, terms, expr, describeRows, escapeHtml, TEMPLATE_PRESETS,
  appendTokenText, tokenText, inlineIconSrc, inlineIconLabel,
  statusCatalog, statusLabels, tagLabels, SLOT_VALUE_IDS,
} from './gtn-text/index.js';
import { stepsToRows, applySlotEdit, branchKeysOf } from './gtn-text/steps.js';
import opSchema from './generated/op-schema.json';

const TEMPLATE_BY_OP = templates;

/* Round 108 / 批次 DF：官方状态内置表（`Python联机版/official_statuses.py` →
   `tools/extract_op_schema.py` 生成）。17 条官方状态已经不在官方包里声明了，
   下拉、校验提示都从这份表取，别再假设"包里总有一份状态清单"。 */
export const OFFICIAL_STATUSES = Array.isArray(opSchema.officialStatuses) ? opSchema.officialStatuses : [];
const OFFICIAL_STATUS_BY_ID = new Map(OFFICIAL_STATUSES.map(item => [String(item.id), item]));
const OFFICIAL_STATUS_BY_SHORT = new Map(
  OFFICIAL_STATUSES.map(item => [String(item.id).split(':').pop(), item]),
);

/** 内置状态表里的那一条（按完整 id 或短名查），没有则返回 null。 */
export function officialStatusDef(statusId) {
  const raw = String(statusId || '').trim();
  if (!raw) return null;
  return OFFICIAL_STATUS_BY_ID.get(raw) || OFFICIAL_STATUS_BY_SHORT.get(raw.split(':').pop()) || null;
}

/** 官方状态命名空间（arctic / bio / hel / jungle / ocean / sewers）。 */
export const OFFICIAL_STATUS_NAMESPACES = new Set(
  OFFICIAL_STATUSES.map(item => String(item.id).split(':')[0]),
);

/* ---------- 条件表达式的可视化编辑 ----------
   支持三种形态：
     1. compare{a, operator, b} —— 可改运算符，左右两侧都能是值表达式；
     2. not{value: …} / and / or —— 递归渲染里面的条件；
     3. 值表达式本身（取值形态 + 算术表达式）可递归编辑：
        add/sub/mul/div/min/max/floor/ceil 以及 player_stat、equipment_prop 等取值节点。
   运行时真正认的形状见 mod_runtime_v2.eval_v2_value / check_v2_condition；
   这里只渲染这些形状，认不出来的仍保持只读，避免破坏表达式树。 */
const OPERATORS = [['>=', '≥'], ['<=', '≤'], ['>', '＞'], ['<', '＜'], ['==', '='], ['=', '='], ['!=', '≠']];
/* 数据里还有一种"把运算符当 op 写"的旧写法：{"op": "<=", a, b}，运行时同样认 */
const SYMBOL_OPERATORS = ['>=', '<=', '>', '<', '==', '=', '!=', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne'];
/* 标签/状态下拉的兜底目录（生成物）：真正渲染时用调用方传进来的完整列表 */
const DEFAULT_TAGS = Object.entries(tagLabels).map(([value, label]) => ({ value, label }));

/* 左值表达式常见的几种形态：能在下拉里选，其余保持只读 */
const LEFT_FORMS = [
  ['last_damage', '上次受到的伤害'],
  ['damage_amount', '本次伤害量'],
  ['status_stack', '目标的状态层数'],
  ['hand_count', '目标的手牌数'],
  ['deck_count', '目标的抽牌堆数'],
  ['discard_count', '目标的弃牌堆数'],
  ['player_stat', '目标的属性'],
  ['player_property', '目标的属性（别名）'],
  ['zone_count', '目标的区域牌数'],
  ['counter_cards_in_hand', '目标手牌里的反制牌数'],
  ['selected_cards_count', '已选牌数'],
  ['selected_card_index', '已选牌序号'],
  ['last_positive_hits', '上次命中次数'],
  ['hand_full', '目标手牌已满'],
  ['current_turn_player', '当前回合玩家'],
  ['var', '变量'],
  ['player_var', '玩家变量'],
  ['card_var', '卡变量'],
  ['card_prop', '牌的属性'],
  ['choice_value', '选择项的值'],
  ['get', '对象的字段'],
  ['target_player', '目标玩家'],
  ['source_player', '来源玩家'],
  ['damage_source', '伤害来源'],
  ['const', '固定数值'],
];
/* 算术表达式：运行时 eval_v2_value 支持 add/sub/mul/div/min/max/floor/ceil（clamp/random 暂不在此列） */
const ARITH_FORMS = [
  ['add', '加法'],
  ['sub', '减法'],
  ['mul', '乘法'],
  ['div', '除法'],
  ['min', '取较小'],
  ['max', '取较大'],
  ['floor', '向下取整'],
  ['ceil', '向上取整'],
];
const ARITH_OPS = ARITH_FORMS.map(([key]) => key);
/* floor / ceil 只吃一个操作数（写在 value 上） */
const SINGLE_ARITH_OPS = new Set(['floor', 'ceil']);
const ARITH_SYMBOLS = { add: '＋', sub: '－', mul: '×', div: '÷' };
/* 取值形态里额外支持、但不在左值下拉老列表里的节点 */
const EXTRA_VALUE_FORMS = [['equipment_prop', '装备属性']];
/* 值下拉 = 取值形态 + 算术算子（左右两侧共用同一份） */
const VALUE_FORMS = [...LEFT_FORMS, ...EXTRA_VALUE_FORMS, ...ARITH_FORMS];
const valueFormLabel = (value) => (VALUE_FORMS.find(([key]) => key === value) || [null, value])[1];
/* 这些取值形态的 target 是玩家选择器（运行时 resolve_v2_target），行内也能改 */
const TARGETED_VALUE_OPS = [
  'status_stack', 'player_stat', 'player_property', 'hand_count', 'deck_count',
  'discard_count', 'zone_count', 'counter_cards_in_hand', 'hand_full', 'player_var',
];
const TARGET_CHOICES = [
  { value: 'source', label: '自己' },
  { value: 'target', label: '目标' },
  { value: 'self', label: '自己（self）' },
  { value: 'enemy', label: '对手' },
];
const STAT_CHOICES = ['health', 'elixir', 'magic', 'armor', 'max_health', 'max_elixir', 'max_magic'];
const ZONE_CHOICES = ['hand', 'deck', 'discard', 'exile', 'equipment'];
/* 右值可以是"某个玩家的引用"（运行时认这些取玩家的表达式） */
const PLAYER_RIGHT_OPS = [
  'source_player', 'target_player', 'current_turn_player', 'event_source', 'damage_source', 'attacker', 'owner',
];
/* Round 103 / 批次 DD（反馈 #177）：状态下拉以前只有 26 个内置状态——新模组里
   **选不到「护盾」**（它是 Jungle 包申报的 `jungle:shield`），也选不到「无敌」。
   现在把"各包申报的状态"和两条玩家状态（无敌 / 无法选中）一起并进来：
   同名（中文标签相同）只留一条，**优先命名空间 id**（`jungle:shield` 而不是别名 `shield`）。 */
function buildDefaultStatusOptions() {
  const merged = new Map();
  const push = (value, label) => {
    const key = String(label);
    const existing = merged.get(key);
    if (existing) {
      const existingCanonical = String(existing.value).includes(':');
      const nextCanonical = String(value).includes(':');
      /* 同名的两条（`jungle:shield` 与别名 `shield`）只留**命名空间 id** 那条 */
      if (!nextCanonical || existingCanonical) return;
    }
    if ([...merged.values()].some((item) => item.value === value)) return;
    merged.set(key, { value, label });
  };
  for (const item of OFFICIAL_STATUSES) {
    push(item.id, item.name_zh || item.name_en || item.id);
  }
  for (const [value, label] of Object.entries(statusCatalog)) push(value, label);
  for (const [value, label] of Object.entries(statusLabels)) push(value, label);
  push('invincible', '无敌');
  push('untargetable', '无法选中');
  return [...merged.values()];
}

/* 合并"内置目录 + 本模组状态"之后再去一次重：同名的两条只留**命名空间 id**，
   否则尾巴上会漂出 `unable_counter` / `blood_debt` 这类短别名（反馈 #177 同类问题）。 */
function dedupeStatusOptions(options) {
  const byLabel = new Map();
  for (const option of options || []) {
    const label = choiceLabel(option);
    const value = choiceValue(option);
    const existing = byLabel.get(label);
    if (existing) {
      const existingCanonical = String(existing).includes(':');
      const nextCanonical = value.includes(':');
      if (!nextCanonical || existingCanonical) continue;
    }
    byLabel.set(label, value);
  }
  return [...byLabel.entries()].map(([label, value]) => ({ value, label }));
}

const DEFAULT_STATUS = buildDefaultStatusOptions();

/* 选项可能是 '值'，也可能是 {value,label,icon}；下面几个小工具统一两种形态 */
const choiceValue = (choice) => (choice && typeof choice === 'object' ? String(choice.value) : String(choice));
const choiceLabel = (choice) => (choice && typeof choice === 'object'
  ? String(choice.label ?? choice.value) : String(choice));

/* 下拉里显示的是中文（"目标"/"弃牌堆"/"护甲"…），写回数据必须换回运行时 id，
   否则引擎的 resolve_v2_target / 区域词表认不出来。 */
function slotValueForWrite(part, value) {
  if (part.free) return value;
  const table = SLOT_VALUE_IDS[part.slot];
  if (!table) return value;
  return table[value] ?? value;
}

/** 把两份选项列表按 value 合并（内置目录 + 当前模组自定义的）。 */
function mergeChoices(base = [], extra = []) {
  const out = new Map();
  for (const choice of [...base, ...extra]) {
    const value = choiceValue(choice);
    if (!value || out.has(value)) continue;
    out.set(value, choice);
  }
  return Array.from(out.values());
}

/* 当前编辑器实例用的选项（createEffectEditor 里会覆盖成"内置 + 本模组"）。 */
let activeStatusOptions = DEFAULT_STATUS;
let activeTagOptions = DEFAULT_TAGS;

const statusLabelOf = (value) => {
  const found = activeStatusOptions.find((choice) => choiceValue(choice) === value);
  return found ? choiceLabel(found) : terms.status(value);
};
const tagLabelOf = (value) => {
  const found = activeTagOptions.find((choice) => choiceValue(choice) === value);
  return found ? choiceLabel(found) : terms.tag(value);
};

/* ---------- 条件向导 ----------
   只生成运行时真正认的条件形状（mod_runtime_v2.check_v2_condition）：
   compare / card_has_tag / has_status_named / damage_type_is / target_selectable
   / play_was_countered / and / or / not。
   「＋ 添加条件」以前往步骤里塞一个空的 {}，认不出来就直接只读，用户就卡住了；
   现在改成先选条件形态，再把完整的条件对象写进去。 */
const CONDITION_PRESETS = [
  {
    id: 'last_damage',
    label: '如果 上次受到的伤害 ≥ 1',
    build: () => ({ op: 'compare', a: { op: 'last_damage' }, operator: '>=', b: 1 }),
  },
  {
    id: 'status_stack',
    label: '如果 目标某状态层数 ≥ 1',
    build: () => ({
      op: 'compare',
      a: { op: 'status_stack', target: 'target', status: choiceValue(activeStatusOptions[0]) },
      operator: '>=',
      b: 1,
    }),
  },
  {
    id: 'has_status',
    label: '如果 目标拥有某状态',
    build: () => ({
      op: 'has_status_named',
      target: 'target',
      status: choiceValue(activeStatusOptions[0]),
    }),
  },
  {
    id: 'card_has_tag',
    label: '如果 本牌有某标签',
    build: () => ({ op: 'card_has_tag', card: 'current_card', tag: choiceValue(activeTagOptions[0]) }),
  },
  {
    id: 'not_card_has_tag',
    label: '如果 本牌没有某标签',
    build: () => ({
      op: 'not',
      value: { op: 'card_has_tag', card: 'current_card', tag: choiceValue(activeTagOptions[0]) },
    }),
  },
  {
    id: 'hand_count',
    label: '如果 目标手牌 ≥ 3',
    build: () => ({ op: 'compare', a: { op: 'hand_count', target: 'target' }, operator: '>=', b: 3 }),
  },
  {
    id: 'deck_count',
    label: '如果 自己抽牌堆 ≥ 1',
    build: () => ({ op: 'compare', a: { op: 'deck_count', target: 'self' }, operator: '>=', b: 1 }),
  },
  {
    id: 'selected_cards_count',
    label: '如果 已选牌 ≥ 1',
    build: () => ({ op: 'compare', a: { op: 'selected_cards_count' }, operator: '>=', b: 1 }),
  },
  {
    id: 'damage_type',
    label: '如果 本次伤害是魔法（电伤）',
    build: () => ({ op: 'damage_type_is', type_name: 'magic' }),
  },
  {
    id: 'target_selectable',
    label: '如果 目标可被选中',
    build: () => ({ op: 'target_selectable', target: 'target' }),
  },
  {
    id: 'play_was_countered',
    label: '如果 本次打出被反制',
    build: () => ({ op: 'play_was_countered' }),
  },
];

function conditionPresetSelect(currentId = '', title = '用向导设置…') {
  const select = document.createElement('select');
  select.className = 'gee-slot gee-cond-preset';
  select.title = title;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = title;
  placeholder.selected = !currentId;
  select.appendChild(placeholder);
  CONDITION_PRESETS.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    option.selected = preset.id === currentId;
    select.appendChild(option);
  });
  return select;
}

function cloneSteps(steps) {
  return JSON.parse(JSON.stringify(steps || []));
}

function makeSelect(className, choices, current, labelOf = (v) => v) {
  const select = document.createElement('select');
  select.className = className;
  /* choices 既可以是 '值'，也可以是 {value,label}；current 不在列表里时补一条 */
  const values = choices.map(choiceValue);
  const list = current && !values.includes(String(current))
    ? [{ value: current, label: labelOf(current) }, ...choices]
    : choices;
  list.forEach((choice) => {
    const option = document.createElement('option');
    option.value = choiceValue(choice);
    option.textContent = choice && typeof choice === 'object'
      ? choiceLabel(choice)
      : labelOf(choice);
    option.selected = option.value === String(current);
    select.appendChild(option);
  });
  return select;
}

/** 值表达式编辑器：字面量 / 取值形态 / 算术表达式（算术节点递归渲染操作数）。 */
function renderValueExpr(node, onChange) {
  const op = String((node && (node.op || node.ref)) || '');
  if (isLiteral(node)) {
    const input = document.createElement('input');
    input.type = typeof node === 'number' ? 'number' : 'text';
    input.className = 'gee-slot gee-slot-num';
    input.value = node;
    input.addEventListener('input', () => onChange(
      typeof node === 'number' ? Number(input.value) || 0 : input.value,
    ));
    return input;
  }
  if (ARITH_OPS.includes(op)) return renderArithmeticValue(node, op, onChange);
  if (!VALUE_FORMS.some(([key]) => key === op)) {
    const span = document.createElement('span');
    span.className = 'gee-readonly-slot';
    span.textContent = expr.value(node) || '?';
    span.title = '这种值表达式暂不支持在这里编辑';
    return span;
  }
  const wrap = document.createElement('span');
  wrap.className = 'gee-cond';
  const form = makeSelect('gee-slot', VALUE_FORMS.map(([key]) => key), op, valueFormLabel);
  form.addEventListener('input', () => onChange(buildValueNode(form.value)));
  wrap.appendChild(form);
  /* 普通 var 只有写了 target 才是"按玩家存的变量"，此时才给归属下拉 */
  if (TARGETED_VALUE_OPS.includes(op) || (op === 'var' && 'target' in node)) {
    const target = makeSelect('gee-slot', TARGET_CHOICES, String(node.target || 'source'),
      (value) => terms.target(value));
    target.title = '目标';
    target.addEventListener('input', () => { node.target = target.value; onChange(node); });
    wrap.appendChild(target);
  }
  if (op === 'status_stack') {
    const status = makeSelect('gee-slot', activeStatusOptions, node.status || choiceValue(activeStatusOptions[0]), statusLabelOf);
    status.addEventListener('input', () => { node.status = status.value; onChange(node); });
    wrap.appendChild(status);
  }
  if (op === 'player_stat') {
    const stat = makeSelect('gee-slot', STAT_CHOICES, node.stat || 'health', (v) => terms.property(v));
    stat.addEventListener('input', () => { node.stat = stat.value; onChange(node); });
    wrap.appendChild(stat);
  }
  /* Round 17：以下左值形态补上真正能改的字段（以前是只读，卡面描述只能整块保留） */
  if (op === 'player_property') {
    const stat = makeSelect('gee-slot', STAT_CHOICES, node.property || 'health', (v) => terms.property(v));
    stat.addEventListener('input', () => { node.property = stat.value; onChange(node); });
    wrap.appendChild(stat);
  }
  if (op === 'zone_count') {
    const zone = makeSelect('gee-slot', ZONE_CHOICES, node.zone || 'hand', (v) => terms.zone(v));
    zone.addEventListener('input', () => { node.zone = zone.value; onChange(node); });
    wrap.appendChild(zone);
  }
  if (op === 'var' || op === 'player_var' || op === 'card_var') {
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'gee-slot gee-slot-text';
    name.value = String(node.name || '');
    name.title = '变量名';
    name.addEventListener('input', () => { node.name = name.value; onChange(node); });
    wrap.appendChild(name);
  }
  if (op === 'card_prop') {
    const property = document.createElement('input');
    property.type = 'text';
    property.className = 'gee-slot gee-slot-text';
    property.value = String(node.property || node.prop || '');
    property.title = '牌属性名（如 damage / fission_level）';
    property.addEventListener('input', () => {
      if ('prop' in node && !('property' in node)) node.prop = property.value;
      else node.property = property.value;
      onChange(node);
    });
    wrap.appendChild(property);
  }
  if (op === 'choice_value' || op === 'get') {
    const key = document.createElement('input');
    key.type = 'text';
    key.className = 'gee-slot gee-slot-text';
    key.value = String(node.key || '');
    key.title = op === 'choice_value' ? '选择项键名' : '字段名';
    key.addEventListener('input', () => { node.key = key.value; onChange(node); });
    wrap.appendChild(key);
  }
  /* 装备属性（desert:emerald 这类"装备的目标/自定义字段"）：装备来源 + 属性名 + 拥有者 */
  if (op === 'equipment_prop') {
    const equipment = node.equipment;
    const ref = equipment && typeof equipment === 'object'
      ? String(equipment.ref || equipment.op || '')
      : String(equipment || '');
    const refSelect = makeSelect('gee-slot', ['current_equipment', 'first'],
      ref || 'current_equipment',
      (value) => (value === 'first' ? '第一件装备' : (value === 'current_equipment' ? '当前装备' : `引用 ${value}`)));
    refSelect.title = '装备来源';
    refSelect.addEventListener('input', () => {
      if (equipment && typeof equipment === 'object' && !Array.isArray(equipment)) equipment.ref = refSelect.value;
      else node.equipment = { ref: refSelect.value };
      onChange(node);
    });
    wrap.appendChild(refSelect);
    const property = document.createElement('input');
    property.type = 'text';
    property.className = 'gee-slot gee-slot-text';
    property.value = String(node.property || node.prop || '');
    property.title = '装备属性名（如 effect_target）';
    property.addEventListener('input', () => {
      if ('prop' in node && !('property' in node)) node.prop = property.value;
      else node.property = property.value;
      onChange(node);
    });
    wrap.appendChild(property);
    const owner = makeSelect('gee-slot', ['source', 'target'],
      String(node.target || 'source'), (value) => (value === 'target' ? '目标' : '自己'));
    owner.title = '装备拥有者';
    owner.addEventListener('input', () => { node.target = owner.value; onChange(node); });
    wrap.appendChild(owner);
  }
  return wrap;
}

/** 从下拉选项造一个新的值表达式节点（切换形态时用；不丢运行时字段）。 */
function buildValueNode(value) {
  if (value === 'const') return 0;
  if (ARITH_OPS.includes(value)) {
    return SINGLE_ARITH_OPS.has(value) ? { op: value, value: 1 } : { op: value, values: [1, 1] };
  }
  const next = { op: value };
  if (value === 'status_stack') { next.target = 'target'; next.status = choiceValue(activeStatusOptions[0]); }
  if (value === 'player_stat') { next.target = 'target'; next.stat = STAT_CHOICES[0]; }
  if (value === 'player_property') { next.target = 'target'; next.property = STAT_CHOICES[0]; }
  if (value === 'hand_count' || value === 'deck_count') next.target = 'target';
  if (value === 'zone_count') { next.target = 'target'; next.zone = ZONE_CHOICES[0]; }
  if (value === 'counter_cards_in_hand') next.target = 'target';
  if (value === 'var' || value === 'player_var' || value === 'card_var') next.name = 'x';
  if (value === 'card_prop') { next.card = { ref: 'current_card' }; next.property = 'extra_hits'; }
  if (value === 'choice_value') next.key = 'choice';
  if (value === 'get') { next.object = { op: 'var', name: 'x' }; next.key = 'field'; }
  if (value === 'equipment_prop') {
    next.equipment = { ref: 'current_equipment' };
    next.property = 'effect_target';
    next.target = 'source';
  }
  return next;
}

/** 算术节点的操作数槽位：values 列表 / a·b / 单值 value 三种写法都认。 */
function arithmeticSlots(node, op) {
  if (Array.isArray(node.values)) return node.values.map((_, index) => ({ index }));
  if (SINGLE_ARITH_OPS.has(op)) return [{ key: 'value' }];
  if ('a' in node || 'b' in node) return [{ key: 'a' }, { key: 'b' }];
  return [{ key: 'value' }];
}

const readSlot = (node, slot) => (slot.index === undefined ? node[slot.key] : node.values[slot.index]);
function writeSlot(node, slot, next) {
  if (slot.index === undefined) node[slot.key] = next;
  else node.values[slot.index] = next;
}

/** 算术表达式编辑：算符下拉 + 递归操作数（values 写法还能增删项）。 */
function renderArithmeticValue(node, op, onChange) {
  const wrap = document.createElement('span');
  wrap.className = 'gee-cond gee-expr';
  const form = makeSelect('gee-slot', VALUE_FORMS.map(([key]) => key), op, valueFormLabel);
  form.addEventListener('input', () => onChange(buildValueNode(form.value)));
  wrap.appendChild(form);

  const slots = arithmeticSlots(node, op);
  const single = slots.length === 1 && slots[0].key === 'value';
  slots.forEach((slot, index) => {
    if (index > 0) {
      wrap.appendChild(document.createTextNode(ARITH_SYMBOLS[op] || (op === 'min' || op === 'max' ? '、' : '，')));
    }
    const value = readSlot(node, slot);
    const nested = value && typeof value === 'object' && ARITH_OPS.includes(String(value.op || value.ref || ''));
    if (single || nested) wrap.appendChild(document.createTextNode('（'));
    wrap.appendChild(renderValueExpr(value, (next) => { writeSlot(node, slot, next); onChange(node); }));
    if (single || nested) wrap.appendChild(document.createTextNode('）'));
  });

  /* values 列表型允许加减项；a/b 型保持原样（改结构风险大，数据里也少） */
  if (Array.isArray(node.values)) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'gee-expr-item';
    add.textContent = '＋';
    add.title = '再加一项（数值 1）';
    add.addEventListener('click', () => { node.values.push(1); onChange(node); });
    wrap.appendChild(add);
    if (node.values.length > 2) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gee-expr-item';
      remove.textContent = '－';
      remove.title = '删掉最后一项';
      remove.addEventListener('click', () => { node.values.pop(); onChange(node); });
      wrap.appendChild(remove);
    }
  }
  return wrap;
}

function isLiteral(node) {
  return typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean';
}

/** 条件节点的"分支列表"：兼容 values / conditions / left+right 三种写法。 */
function conditionParts(node) {
  if (Array.isArray(node.values)) return node.values;
  if (Array.isArray(node.conditions)) return node.conditions;
  const left = node.value ?? node.left;
  const right = node.right;
  if (left && right) return [left, right];
  return null;
}

/** 认一个条件节点（不认返回 null，由调用方退回"用向导重建"）。 */
function conditionNodeInfo(node, expr) {
  if (!node || typeof node !== 'object') return null;
  const op = String(node.op || node.ref || '');

  if (op === 'compare' || SYMBOL_OPERATORS.includes(op)) {
    const isSymbolForm = op !== 'compare';
    return {
      kind: 'compare',
      condition: node,
      leftText: expr.value(node.a),
      operator: String(isSymbolForm ? op : (node.operator || '>=')),
      rightLiteral: isLiteral(node.b) ? node.b : null,
      rightText: expr.value(node.b),
    };
  }
  if (op === 'not') {
    const inner = node.value ?? node.cond ?? node.condition
      ?? (Array.isArray(node.conditions) ? node.conditions[0] : null);
    if (inner && typeof inner === 'object') {
      if (String(inner.op || inner.ref) === 'card_has_tag') {
        return { kind: 'not_card_has_tag', condition: node, inner, tag: String(inner.tag || '') };
      }
      return { kind: 'not', condition: node, inner };
    }
  }
  if (op === 'and' || op === 'or') {
    const parts = conditionParts(node);
    if (parts && parts.length >= 2) {
      return { kind: 'and_or', condition: node, operator: op, parts };
    }
  }
  if (op === 'card_has_tag' || op === 'has_tag') {
    return { kind: 'card_has_tag', condition: node, op, tag: String(node.tag || '') };
  }
  if (op === 'card_has_modifier') {
    return { kind: 'card_has_modifier', condition: node, modifier: String(node.modifier || '') };
  }
  if (op === 'has_status_named') {
    return {
      kind: 'has_status',
      condition: node,
      status: String(node.status || ''),
      target: String(node.target || 'target'),
    };
  }
  if (op === 'damage_type_is') {
    return {
      kind: 'damage_type',
      condition: node,
      typeName: String(node.type_name || node.damage_type || 'physical'),
    };
  }
  if (op === 'target_selectable') return { kind: 'target_selectable', condition: node };
  if (op === 'play_was_countered') return { kind: 'play_was_countered', condition: node };
  /* 值表达式直接当条件用（运行时最后一行退回 eval_v2_value 取真值）：
     hand_full / zone_exists / card_exists 都是这种写法 */
  if (op === 'hand_full') return { kind: 'hand_full', condition: node };
  if (op === 'zone_exists' || op === 'card_exists') {
    return { kind: 'zone_exists', condition: node, op };
  }
  return null;
}

function conditionEditor(row, expr) {
  const condition = row.source?.condition || row.source?.cond;
  return conditionNodeInfo(condition, expr);
}

function renderConditionControls(line, row, info, emit) {
  if (info.kind === 'compare') {
    line.appendChild(renderValueExpr(info.condition.a, (next) => {
      info.condition.a = next;
      emit();
    }));

    const operator = document.createElement('select');
    operator.className = 'gee-slot';
    OPERATORS.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === info.operator;
      operator.appendChild(option);
    });
    operator.addEventListener('input', () => {
      info.condition.operator = operator.value;
      emit();
    });
    line.appendChild(operator);

    /* 右值四态：数值 / 变量 / 玩家 / 表达式（Round 18 起表达式可递归编辑） */
    const bNode = info.condition.b;
    const varNode = bNode && typeof bNode === 'object'
      && ['var', 'player_var', 'temp_var', 'global_var'].includes(String(bNode.op || bNode.ref));
    const playerNode = bNode && typeof bNode === 'object'
      && PLAYER_RIGHT_OPS.includes(String(bNode.op || bNode.ref));
    const mode = varNode ? 'var' : (playerNode ? 'player' : (info.rightLiteral !== null ? 'literal' : 'expr'));
    const modeSelect = document.createElement('select');
    modeSelect.className = 'gee-slot gee-cond-mode';
    modeSelect.title = '右值来源';
    [['literal', '数值'], ['var', '变量'], ['player', '玩家'], ['expr', '表达式']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === mode;
      modeSelect.appendChild(option);
    });
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === 'literal') {
        info.condition.b = typeof info.rightLiteral === 'number' ? 1 : 1;
      } else if (modeSelect.value === 'var') {
        info.condition.b = { op: 'var', name: 'x', target: 'self' };
      } else if (modeSelect.value === 'player') {
        info.condition.b = { op: 'source_player' };
      } else {
        info.condition.b = { op: 'player_stat', target: 'target', stat: 'max_health' };
      }
      emit();
    });
    line.appendChild(modeSelect);
    if (mode === 'literal') {
      const right = document.createElement('input');
      right.type = typeof info.rightLiteral === 'number' ? 'number' : 'text';
      right.className = 'gee-slot gee-slot-num';
      right.value = info.rightLiteral;
      right.addEventListener('input', () => {
        info.condition.b = typeof info.rightLiteral === 'number' ? Number(right.value) || 0 : right.value;
        emit();
      });
      line.appendChild(right);
    } else if (mode === 'var') {
      const name = document.createElement('input');
      name.type = 'text';
      name.className = 'gee-slot gee-slot-text';
      name.value = String(bNode.name || '');
      name.title = '变量名';
      name.addEventListener('input', () => {
        bNode.name = name.value;
        emit();
      });
      line.appendChild(name);
      const target = document.createElement('select');
      target.className = 'gee-slot';
      target.title = '变量归属';
      [['self', '自己'], ['target', '目标'], ['source', '来源']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = value === String(bNode.target || 'self');
        target.appendChild(option);
      });
      target.addEventListener('input', () => {
        bNode.target = target.value;
        emit();
      });
      line.appendChild(target);
    } else if (mode === 'player') {
      const player = makeSelect('gee-slot',
        [{ value: 'source_player', label: '来源玩家' }, { value: 'target_player', label: '目标玩家' },
          { value: 'current_turn_player', label: '当前回合玩家' }, { value: 'event_source', label: '事件来源' },
          { value: 'damage_source', label: '伤害来源' }],
        String(bNode.op || bNode.ref), (v) => v);
      player.addEventListener('input', () => {
        info.condition.b = { op: player.value };
        emit();
      });
      line.appendChild(player);
    } else {
      line.appendChild(renderValueExpr(bNode, (next) => {
        info.condition.b = next;
        emit();
      }));
    }
    return true;
  }

  if (info.kind === 'and_or') {
    const wrap = document.createElement('span');
    wrap.className = 'gee-cond';
    wrap.appendChild(document.createTextNode('（'));
    info.parts.forEach((part, index) => {
      if (index > 0) {
        const opSelect = makeSelect('gee-slot', ['and', 'or'], info.operator,
          (v) => (v === 'and' ? '且' : '或'));
        opSelect.addEventListener('input', () => {
          info.condition.op = opSelect.value;
          emit();
        });
        wrap.appendChild(opSelect);
      }
      const slot = document.createElement('span');
      slot.className = 'gee-cond';
      renderConditionNode(slot, { source: { condition: part } }, emit);
      wrap.appendChild(slot);
    });
    wrap.appendChild(document.createTextNode('）'));
    line.appendChild(wrap);
    return true;
  }

  if (info.kind === 'not_card_has_tag') {
    const tag = document.createElement('select');
    tag.className = 'gee-slot';
    const options = info.tag && !activeTagOptions.some((choice) => choiceValue(choice) === info.tag)
      ? [{ value: info.tag, label: tagLabelOf(info.tag) }, ...activeTagOptions]
      : activeTagOptions;
    options.forEach((choice) => {
      const option = document.createElement('option');
      option.value = choiceValue(choice);
      option.textContent = choice && typeof choice === 'object' ? choiceLabel(choice) : tagLabelOf(choice);
      option.selected = option.value === info.tag;
      tag.appendChild(option);
    });
    tag.addEventListener('input', () => {
      info.inner.tag = tag.value;
      emit();
    });
    line.appendChild(tag);
    return true;
  }
  if (info.kind === 'not') {
    /* 通用"非"：里面是什么就渲染什么（card_has_tag 之外的形态以前整块只读） */
    line.appendChild(document.createTextNode('非'));
    const innerSlot = document.createElement('span');
    innerSlot.className = 'gee-cond';
    renderConditionNode(innerSlot, { source: { condition: info.inner } }, emit);
    line.appendChild(innerSlot);
    return true;
  }
  if (info.kind === 'card_has_tag') {
    /* 直接判"本牌有某标签"（不被 not 包着）以前认不出来，现在给同样的下拉 */
    const tag = document.createElement('select');
    tag.className = 'gee-slot';
    const options = info.tag && !activeTagOptions.some((choice) => choiceValue(choice) === info.tag)
      ? [{ value: info.tag, label: tagLabelOf(info.tag) }, ...activeTagOptions]
      : activeTagOptions;
    options.forEach((choice) => {
      const option = document.createElement('option');
      option.value = choiceValue(choice);
      option.textContent = choice && typeof choice === 'object' ? choiceLabel(choice) : tagLabelOf(choice);
      option.selected = option.value === info.tag;
      tag.appendChild(option);
    });
    tag.addEventListener('input', () => {
      info.condition.tag = tag.value;
      emit();
    });
    line.appendChild(document.createTextNode('具有'));
    line.appendChild(tag);
    line.appendChild(document.createTextNode('标签'));
    return true;
  }
  if (info.kind === 'card_has_modifier') {
    const modifier = document.createElement('input');
    modifier.type = 'text';
    modifier.className = 'gee-slot gee-slot-text';
    modifier.value = info.modifier;
    modifier.title = '标记名（modifier）';
    modifier.addEventListener('input', () => {
      info.condition.modifier = modifier.value;
      emit();
    });
    line.appendChild(document.createTextNode('本牌具有标记'));
    line.appendChild(modifier);
    return true;
  }
  if (info.kind === 'has_status') {
    const status = makeSelect('gee-slot', activeStatusOptions,
      info.status || choiceValue(activeStatusOptions[0]), statusLabelOf);
    status.addEventListener('input', () => {
      info.condition.status = status.value;
      emit();
    });
    const target = makeSelect('gee-slot',
      [{ value: 'target', label: '目标' }, { value: 'self', label: '自己' },
        { value: 'enemy', label: '对方' }, { value: 'source', label: '来源' }],
      info.target, (v) => terms.target(v));
    target.addEventListener('input', () => {
      info.condition.target = target.value;
      emit();
    });
    line.appendChild(target);
    line.appendChild(document.createTextNode('拥有'));
    line.appendChild(status);
    return true;
  }
  if (info.kind === 'damage_type') {
    const type = makeSelect('gee-slot',
      [{ value: 'physical', label: '物理' }, { value: 'magic', label: '魔法（电伤）' }],
      info.typeName, (v) => (v === 'magic' ? '魔法（电伤）' : '物理'));
    type.addEventListener('input', () => {
      info.condition.type_name = type.value;
      emit();
    });
    line.appendChild(document.createTextNode('本次伤害类型是'));
    line.appendChild(type);
    return true;
  }
  if (info.kind === 'target_selectable') {
    line.appendChild(document.createTextNode('目标可被选中'));
    line.appendChild(renderReadonly(String(expr.describe(info.condition.target || {}) || '')));
    return true;
  }
  if (info.kind === 'play_was_countered') {
    line.appendChild(document.createTextNode('本次打出被反制'));
    return true;
  }
  if (info.kind === 'hand_full') {
    const target = makeSelect('gee-slot',
      [{ value: 'target', label: '目标' }, { value: 'self', label: '自己' },
        { value: 'source', label: '来源' }],
      String(info.condition.target || 'target'), (v) => terms.target(v));
    target.addEventListener('input', () => {
      info.condition.target = target.value;
      emit();
    });
    line.appendChild(target);
    line.appendChild(document.createTextNode('手牌已满'));
    return true;
  }
  if (info.kind === 'zone_exists') {
    const zone = makeSelect('gee-slot', ZONE_CHOICES,
      String(info.condition.zone || ''), (v) => terms.zone(v));
    zone.addEventListener('input', () => {
      info.condition.zone = zone.value;
      emit();
    });
    line.appendChild(document.createTextNode('存在区域'));
    line.appendChild(zone);
    return true;
  }
  return false;
}

/** 只读小标签（表达式不能行内改，也不该假装能改）。 */
function renderReadonly(text) {
  const span = document.createElement('span');
  span.className = 'gee-readonly-slot';
  span.textContent = text;
  span.title = '这项是表达式，暂不支持行内编辑；可在 JSON 页签里改';
  return span;
}

/** 把一个条件节点渲染成控件（compare / not+tag / and-or 递归）。 */
function renderConditionNode(container, row, emit) {
  const info = conditionEditor(row, expr);
  if (!info) {
    /* 条件没设置或形态认不出来：给一个"用向导设好"的入口，而不是只读到底 */
    const wrap = document.createElement('span');
    wrap.className = 'gee-cond gee-cond-repair';
    const span = document.createElement('span');
    span.className = 'gee-readonly-slot gee-badge-warn';
    /* 条件挂在步骤上（condition / cond），不是挂在行对象上 */
    const source = row.source || {};
    const condition = source.condition || source.cond || {};
    const hasCondition = condition && typeof condition === 'object' && Object.keys(condition).length > 0;
    const described = expr.describe(condition) || '';
    span.textContent = described || (hasCondition ? '这个条件要用向导重建' : '条件未设置');
    span.title = described
      ? `当前条件：${described}（这种形态不能在行内细调，可以用向导换一种写法）`
      : '这个条件还没有设置，或形态太高级（比如嵌套表达式），可以用向导重建';
    wrap.appendChild(span);
    const preset = conditionPresetSelect('', '用向导设置…');
    preset.addEventListener('change', () => {
      const chosen = CONDITION_PRESETS.find((item) => item.id === preset.value);
      if (!chosen) return;
      if ('cond' in source && !('condition' in source)) source.cond = chosen.build();
      else source.condition = chosen.build();
      emit();
    });
    wrap.appendChild(preset);
    if (hasCondition) {
      const raw = document.createElement('code');
      raw.className = 'gee-cond-raw';
      raw.textContent = JSON.stringify(condition).slice(0, 120);
      raw.title = raw.textContent;
      wrap.appendChild(raw);
    }
    container.appendChild(wrap);
    return;
  }
  renderConditionControls(container, row, info, emit);
}

export function createEffectEditor({
  container, steps = [], onChange = () => {}, emptyHint = '', emptyCoverage = '',
  statusChoices = [], tagChoices = [], opCatalog = null,
}) {
  let current = Array.isArray(steps) ? steps : [];
  let rows = [];
  /* Round 102 / 批次 CZ：内部步骤（变量 / 战报 / 成本修正…）**默认显示**。
     以前默认隐藏，作者用「＋ 添加效果…」加完"变量累加"却什么都看不到（用户反馈）。 */
  let showInternal = true;
  /* 撤销/重做：每次改动前后各留一份快照（改错不用重新导入模组） */
  const undoStack = [];
  const redoStack = [];
  const UNDO_LIMIT = 60;
  let lastSnapshot = JSON.stringify(current);
  /* 状态下拉 = 生成目录 + 本模组自定义状态；标签同理 */
  activeStatusOptions = dedupeStatusOptions(mergeChoices(DEFAULT_STATUS, statusChoices));
  activeTagOptions = mergeChoices(DEFAULT_TAGS, tagChoices);

  const root = document.createElement('div');
  root.className = 'gtn-effect-editor';
  root.innerHTML = `
    <div class="gee-toolbar">
      <label class="gee-toggle"><input type="checkbox" data-role="internal" checked
        title="变量、战报、成本修正这类"不写进卡面描述"的步骤。默认显示，取消勾选可折叠。" />
        显示内部步骤（变量 / 战报）</label>
      <button type="button" class="gee-undo" data-role="undo" title="撤销（Ctrl+Z）" disabled>↶</button>
      <button type="button" class="gee-undo" data-role="redo" title="重做（Ctrl+Shift+Z）" disabled>↷</button>
      <span class="gee-coverage" data-role="coverage"></span>
      <span class="gee-desc-preview" data-role="preview"></span>
    </div>
    <div class="gee-rows" data-role="rows"></div>
    <div class="gee-actions">
      <button type="button" data-role="add" title="从全部可写 op 里挑一个（可搜索）">+ 添加效果…</button>
      <button type="button" data-role="add-if"
        title="添加一个条件分支（可搜索；写出来的就是引擎认的 if_else）">+ 添加条件…</button>
      <select class="gee-slot" data-role="preset" title="从模板库插入常见效果">
        <option value="">从模板插入…</option>
        ${TEMPLATE_PRESETS.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`).join('')}
      </select>
    </div>
    <div class="gee-add-panel" data-role="add-panel" hidden>
      <div class="gee-add-head">
        <input type="search" class="gee-add-search" data-role="add-search"
               placeholder="搜索效果：中文名或 op 名（例：状态 / status_op / 抽牌）" />
        <span class="gee-add-count" data-role="add-count"></span>
      </div>
      <div class="gee-add-list" data-role="add-list"></div>
    </div>
    <div class="gee-add-panel" data-role="cond-panel" hidden>
      <div class="gee-add-head">
        <input type="search" class="gee-add-search" data-role="cond-search"
               placeholder="搜索条件：如 伤害 / 状态 / 标签 / 手牌 / 随机" />
        <span class="gee-add-count" data-role="cond-count"></span>
      </div>
      <div class="gee-add-list" data-role="cond-list"></div>
    </div>`;
  container.innerHTML = '';
  container.appendChild(root);

  const rowsHost = root.querySelector('[data-role="rows"]');
  const previewHost = root.querySelector('[data-role="preview"]');
  const coverageHost = root.querySelector('[data-role="coverage"]');

  function rebuildRows() {
    rows = stepsToRows({ on_play: { steps: current } }, { templates: TEMPLATE_BY_OP, terms, expr });
  }

  /** 只重画（不入撤销栈）。 */
  function refresh() {
    rebuildRows();
    render();
    onChange(current);
  }

  /** 记录一次改动：把"改动前"的快照压栈，清空 redo。 */
  function emit() {
    const snapshot = JSON.stringify(current);
    if (snapshot !== lastSnapshot) {
      undoStack.push(lastSnapshot);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack.length = 0;
      lastSnapshot = snapshot;
    }
    refresh();
    updateHistoryButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(current));
    current = JSON.parse(undoStack.pop());
    lastSnapshot = JSON.stringify(current);
    refresh();
    updateHistoryButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(current));
    current = JSON.parse(redoStack.pop());
    lastSnapshot = JSON.stringify(current);
    refresh();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const undoButton = root.querySelector('[data-role="undo"]');
    const redoButton = root.querySelector('[data-role="redo"]');
    if (undoButton) undoButton.disabled = !undoStack.length;
    if (redoButton) redoButton.disabled = !redoStack.length;
  }

  function makeSlot(row, part) {
    if (part.text) {
      /* 条件槽：能识别成 compare / not+card_has_tag 就给出结构化控件 */
      const wrap = document.createElement('span');
      wrap.className = 'gee-cond';
      renderConditionNode(wrap, row, emit);
      return wrap;
    }
    let control;
    if (part.number) {
      const rawValue = row.values[part.slot];
      /* 表达式（例如"3+X 回合"）不能假装成数字输入框，给只读标签 */
      if (rawValue !== undefined && !Number.isFinite(Number(rawValue))) {
        const span = document.createElement('span');
        span.className = 'gee-readonly-slot';
        span.textContent = String(rawValue);
        span.title = '这里是表达式，不能在行内改数；可在 JSON 页签里改';
        return span;
      }
      control = document.createElement('input');
      control.type = 'number';
      control.className = 'gee-slot gee-slot-num';
      control.value = rawValue ?? 1;
    } else if (part.free) {
      /* 值域开放（例如牌属性名）的槽位用自由文本，别硬塞一个假下拉 */
      control = document.createElement('input');
      control.type = 'text';
      control.className = 'gee-slot gee-slot-text';
      control.value = row.values[part.slot] ?? '';
    } else if (part.boolean) {
      /* 布尔槽位（例如 auto_play 的 no_cost）：<select> 的值只会是字符串，
         直接写回去会把 true/false 变成永远为真的字符串，所以这里单独归一。 */
      control = document.createElement('select');
      control.className = 'gee-slot';
      const raw = row.values[part.slot];
      const current = raw === undefined || raw === null
        ? 'false'
        : String(raw === true || raw === 'true');
      (part.options || []).forEach((option) => {
        const item = document.createElement('option');
        item.value = String(option && typeof option === 'object' ? option.value : option);
        item.textContent = tokenText(String(option && typeof option === 'object'
          ? (option.label ?? option.value) : option));
        item.selected = item.value === current;
        control.appendChild(item);
      });
    } else {
      control = document.createElement('select');
      control.className = 'gee-slot';
      const currentValue = row.values[part.slot];
      /* 状态/标签槽用"内置目录 + 本模组自定义"的完整列表（templates 里给的是内置部分） */
      const rawOptions = part.status ? activeStatusOptions
        : (part.tag ? activeTagOptions : (part.options || []));
      /* 选项可以是 '值'，也可以是 {value,label}：后者写回的是 value，
         显示的是 label（伤害类型就是这样把 physical/magic 显示成"物理/电伤"），
         带 icon 的选项还会在下拉后面画一个卡面同款图标。 */
      const optionValue = (option) => (option && typeof option === 'object' ? String(option.value) : String(option));
      const optionLabel = (option) => (option && typeof option === 'object'
        ? String(option.label ?? option.value) : String(option));
      const hasCurrent = rawOptions.some((option) => optionValue(option) === currentValue);
      /* 认不出来的值也给个能读的名字（状态查中文名，别把内部 id 直接摆出来） */
      const fallbackLabel = part.status ? statusLabelOf(currentValue)
        : (part.tag ? tagLabelOf(currentValue) : currentValue);
      const options = (currentValue && !hasCurrent)
        ? [{ value: currentValue, label: fallbackLabel }, ...rawOptions] : rawOptions;
      options.forEach((option) => {
        const item = document.createElement('option');
        item.value = optionValue(option);
        /* <option> 里放不了图片，退回中文短名（"伤害"/"电伤"/"生命"…） */
        item.textContent = tokenText(optionLabel(option));
        item.selected = optionValue(option) === currentValue;
        control.appendChild(item);
      });
      const fallbackValue = options.length ? optionValue(options[0]) : undefined;
      const selectedOption = options.find((option) => optionValue(option) === (currentValue ?? fallbackValue));
      const iconKey = selectedOption && typeof selectedOption === 'object' ? selectedOption.icon : '';
      const iconSrc = iconKey ? inlineIconSrc(iconKey) : '';
      if (iconSrc) {
        const wrap = document.createElement('span');
        wrap.className = 'gee-slot-wrap';
        wrap.appendChild(control);
        const img = document.createElement('img');
        img.className = 'gee-icon';
        img.src = iconSrc;
        img.alt = inlineIconLabel(iconKey);
        img.title = img.alt;
        wrap.appendChild(img);
        control.addEventListener('input', () => {
          if (applySlotEdit(row, part, slotValueForWrite(part, control.value))) emit();
        });
        return wrap;
      }
    }
    control.addEventListener('input', () => {
      if (applySlotEdit(row, part, slotValueForWrite(part, control.value))) emit();
    });
    if (!part.suffix) return control;
    /* 带后缀的槽位（例如"持续 N 回合"）要连后缀一起渲染 */
    const wrap = document.createElement('span');
    wrap.className = 'gee-slot-wrap';
    wrap.appendChild(control);
    wrap.appendChild(document.createTextNode(part.suffix));
    return wrap;
  }

  function makeRemove(row) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gee-remove';
    button.textContent = '×';
    button.title = '删除这一行';
    button.onclick = () => {
      /* 子行挂在父步骤的分支数组里，删除要落到那个数组上 */
      const target = row?.parentArray || current;
      const at = row ? target.indexOf(row.source) : -1;
      if (at >= 0) target.splice(at, 1);
      emit();
    };
    return button;
  }

  /* Round 101 / 批次 CW：没有句型的步骤（`random` / `multiply_next_damage` /
     `modify_event_value` …）以前是**只读**的"原样保留"行——现在可以就地改原始 JSON，
     这样"从选择器加得出来"的每一个 op 也都真的改得动。 */
  function makeEditJson(row) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gee-json-edit';
    button.textContent = '编辑 JSON';
    button.title = '这一步没有句型：直接改原始步骤 JSON，保存后立即生效';
    button.onclick = () => {
      const host = button.closest('.gee-row');
      if (!host) return;
      const previous = host.nextElementSibling;
      if (previous && previous.classList.contains('gee-json-panel')) {
        previous.remove();
        return;
      }
      const panel = document.createElement('div');
      panel.className = 'gee-json-panel';
      const area = document.createElement('textarea');
      area.rows = 6;
      area.spellcheck = false;
      area.value = JSON.stringify(row.source, null, 2);
      const actions = document.createElement('div');
      actions.className = 'gee-json-actions';
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = '保存';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '取消';
      const error = document.createElement('span');
      error.className = 'gee-json-error';
      cancel.onclick = () => panel.remove();
      save.onclick = () => {
        let parsed;
        try {
          parsed = JSON.parse(area.value);
        } catch (parseError) {
          error.textContent = `JSON 解析失败：${parseError.message}`;
          return;
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          error.textContent = '必须是一个步骤对象（形如 {"op": "…"}）';
          return;
        }
        const target = row.parentArray || current;
        const at = target.indexOf(row.source);
        if (at < 0) {
          error.textContent = '这一步已经不在数据里了（可能已被删除）';
          return;
        }
        target[at] = parsed;
        emit();
      };
      actions.appendChild(save);
      actions.appendChild(cancel);
      actions.appendChild(error);
      panel.appendChild(area);
      panel.appendChild(actions);
      host.parentElement.insertBefore(panel, host.nextSibling);
      area.focus();
    };
    return button;
  }

  /**
   * 容器行下面补"则 / 否则 / 循环体"占位行。
   * 以前只有当分支里已经有内容时才画出来，所以刚加完条件的人根本找不到往哪儿写效果。
   */
  function appendBranchPlaceholders(host, row) {
    if (!row || !row.source) return;
    const keys = branchKeysOf(row.op);
    if (!keys.length) return;
    const indent = ((row.depth || 0) + 1) * 22;
    const handledLabels = new Set();
    keys.forEach(({ key, label }) => {
      if (handledLabels.has(label)) return;
      handledLabels.add(label);
      const sameLabel = keys.filter((item) => item.label === label);
      /* for_each 这类可能写 body 也可能写 steps：任一有内容就算这个分支已经有东西 */
      if (sameLabel.some((item) => Array.isArray(row.source[item.key]) && row.source[item.key].length)) return;
      const targetKey = sameLabel[0].key;
      const line = document.createElement('div');
      line.className = 'gee-row gee-row-branch';
      line.style.marginLeft = `${indent}px`;
      const tag = document.createElement('span');
      tag.className = 'gee-branch';
      tag.textContent = label;
      line.appendChild(tag);
      const picker = document.createElement('select');
      picker.className = 'gee-slot gee-branch-add';
      picker.title = '往这个分支里添加效果';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '＋ 在这里添加效果…';
      picker.appendChild(placeholder);
      TEMPLATE_PRESETS.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.label;
        picker.appendChild(option);
      });
      picker.addEventListener('change', () => {
        const preset = TEMPLATE_PRESETS.find((item) => item.id === picker.value);
        picker.value = '';
        if (!preset) return;
        const list = Array.isArray(row.source[targetKey]) ? row.source[targetKey] : (row.source[targetKey] = []);
        list.push(...cloneSteps(preset.steps));
        emit();
      });
      line.appendChild(picker);
      host.appendChild(line);
    });
  }

  function render() {
    rowsHost.innerHTML = '';
    /* 这张卡能不能完全用效果行编辑：有 generic 行就说明还需要高级画布 */
    const genericCount = rows.filter((row) => row.generic).length;
    coverageHost.textContent = (!rows.length && emptyCoverage)
      ? emptyCoverage
      : (genericCount
        ? `本卡有 ${genericCount} 步需要高级画布`
        : '本卡可完全用效果行编辑');
    coverageHost.classList.toggle('is-partial', genericCount > 0);
    if (!rows.length) {
      /* 空状态要说话：否则用户只看到一片空白，以为编辑器坏了 */
      const empty = document.createElement('div');
      empty.className = 'gee-empty';
      empty.textContent = emptyHint
        || '此时点还没有效果步骤。点击「+ 添加效果」开始，或用「从模板插入…」选一个常见模式。';
      rowsHost.appendChild(empty);
    }
    rows.forEach((row, index) => {
      const template = row.tpl ? TEMPLATE_BY_OP[row.tpl] : null;

      /* Round 37 / 批次 AD-2：internal 允许写成 (row) => bool ——
         on_event 这类伞原子的分支里，有的要进描述（魔法遗物），有的只是管道。 */
      const isInternal = template
        ? (typeof template.internal === 'function' ? template.internal(row) : template.internal)
        : false;
      if (template && isInternal) {
        if (!showInternal) return;
        const line = document.createElement('div');
        line.className = 'gee-row gee-row-internal';
        const badge = document.createElement('span');
        badge.className = 'gee-badge';
        badge.textContent = template.badge;
        line.appendChild(badge);
        const internal = document.createElement('span');
        internal.className = 'gee-internal';
        appendTokenText(internal, tokenText(template.internalLabel(row)));
        line.appendChild(internal);
        const note = document.createElement('span');
        note.className = 'gee-note';
        note.textContent = '不写进描述';
        line.appendChild(note);
        line.appendChild(makeRemove(row));
        rowsHost.appendChild(line);
        appendBranchPlaceholders(rowsHost, row);
        return;
      }

      if (row.generic) {
        const line = document.createElement('div');
        line.className = 'gee-row gee-row-generic';
        /* 卡专用原子：编辑器不假装能编辑它，但要说清楚"这是什么、能改什么、去哪改" */
        const opName = String(row.op || '');
        /* 批次 CW：目录里列过的 op 是公开原子（只是还没句型），别误标成"卡专用步骤" */
        const cardSpecific = !catalogOpSet.has(opName)
          && /^[a-z0-9]+_[a-z0-9_]+$/.test(opName);
        line.innerHTML = `<span class="gee-badge${cardSpecific ? ' gee-badge-warn' : ''}">`
          + `${cardSpecific ? '卡专用步骤' : '原样保留'}</span>`
          + `<code>${escapeHtml(tokenText(row.summary))}</code>`
          + `<span class="gee-note">${cardSpecific
            ? '此步骤由卡专用原子实现，暂不支持可视化编辑；其它字段仍可正常修改'
            : '此 op 还没有句型模板——参数用下面的表单或「编辑 JSON」改'}</span>`;
        const fields = catalogFieldMap.get(opName);
        if (fields) line.appendChild(makeFieldForm(row, fields));
        line.appendChild(makeEditJson(row));
        line.appendChild(makeReplace(row));
        line.appendChild(makeRemove(row));
        rowsHost.appendChild(line);
        appendBranchPlaceholders(rowsHost, row);
        return;
      }

      const line = document.createElement('div');
      const depth = row.depth || 0;
      line.className = 'gee-row' + (depth > 0 ? ' gee-row-child' : '');
      if (depth > 0) line.style.marginLeft = `${depth * 22}px`;
      line.draggable = true;
      if (row.branchLabel) {
        const branch = document.createElement('span');
        branch.className = 'gee-branch';
        branch.textContent = row.branchLabel;
        line.appendChild(branch);
      }
      const badge = document.createElement('span');
      badge.className = 'gee-badge';
      badge.textContent = template.badge;
      line.appendChild(badge);
      template.parts(row).forEach((part) => {
        /* 模板里的 `[[icon:D]]` 这类标记要画成图标，不能把中括号标记暴露给用户 */
        if (typeof part === 'string') appendTokenText(line, part);
        else {
          if (part.prefix) appendTokenText(line, part.prefix);
          line.appendChild(makeSlot(row, part));
        }
      });
      line.appendChild(makeReplace(row));
      line.appendChild(makeRemove(row));

      line.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      line.addEventListener('dragover', (event) => event.preventDefault());
      line.addEventListener('drop', (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isNaN(from) || from === index) return;
        const [moved] = current.splice(from, 1);
        current.splice(index, 0, moved);
        emit();
      });
      rowsHost.appendChild(line);
      appendBranchPlaceholders(rowsHost, row);
    });
    /* 描述预览同样不能露出标记：图标位置直接画图标 */
    previewHost.textContent = '';
    const previewText = describeRows(rows, TEMPLATE_BY_OP, expr) || '（暂无效果描述）';
    appendTokenText(previewHost, previewText);
  }

  root.querySelector('[data-role="internal"]').addEventListener('change', (event) => {
    showInternal = event.target.checked;
    render();
  });
  root.querySelector('[data-role="undo"]').onclick = () => undo();
  root.querySelector('[data-role="redo"]').onclick = () => redo();
  /* Ctrl+Z / Ctrl+Shift+Z（或 Ctrl+Y）——只在编辑器里、且焦点不在文本框时接管 */
  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const tag = String(event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
  });
  /* Round 101 / 批次 CW：以前这个按钮**写死插入 deal_damage**，47 个可写原子里
     有 33 个在界面上根本加不出来。现在它是"全量 op 选择器"的开关：
     目录来自 `src/generated/op-catalog.json`（工具生成，含中文名与最小可运行默认参数）。 */
  const addPanel = root.querySelector('[data-role="add-panel"]');
  const addSearch = root.querySelector('[data-role="add-search"]');
  const addList = root.querySelector('[data-role="add-list"]');
  const addCount = root.querySelector('[data-role="add-count"]');
  const catalogEntries = opCatalog && Array.isArray(opCatalog.ops)
    ? opCatalog.ops.filter((entry) => entry && entry.op && !entry.hidden)
    : [];
  /* 目录里有的 op 都是"引擎公开原子"——它们只是没句型，不该被标成"卡专用步骤" */
  const catalogOpSet = new Set(
    ((opCatalog && opCatalog.ops) || []).map((entry) => entry && entry.op).filter(Boolean),
  );
  /* 批次 CW-2：没有句型的 op 也能在行里改参数（目录里给了 fields 的才有表单；
     没给表单的仍然可以点「编辑 JSON」）。 */
  const catalogFieldMap = new Map(
    ((opCatalog && opCatalog.ops) || [])
      .filter((entry) => entry && entry.op && Array.isArray(entry.fields) && entry.fields.length)
      .map((entry) => [entry.op, entry.fields]),
  );
  const catalogGroups = new Map(
    ((opCatalog && opCatalog.groups) || []).map((group) => [group.id, group.label_cn]),
  );

  function insertStep(step) {
    current.push(JSON.parse(JSON.stringify(step)));
    emit();
  }

  /* Round 101 / 批次 CW-2：「换成别的效果」——以前只能删了重加，现在每一行都能换 op */
  let replaceTargetRow = null;

  function openPickerForReplace(row) {
    replaceTargetRow = row || null;
    toggleAddPanel(true);
    if (replaceTargetRow && addSearch) {
      addSearch.placeholder = `把「${row.op}」换成…（按中文名或 op 名搜索）`;
    }
  }

  function applyPickedStep(step) {
    const next = JSON.parse(JSON.stringify(step));
    if (!replaceTargetRow) {
      current.push(next);
      emit();
      return;
    }
    const target = replaceTargetRow.parentArray || current;
    const at = target.indexOf(replaceTargetRow.source);
    if (at < 0) {
      current.push(next);
    } else {
      target[at] = next;
    }
    replaceTargetRow = null;
    emit();
  }

  function makeReplace(row) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gee-replace';
    button.textContent = '改成…';
    button.title = '把这一步换成别的效果（按中文名或 op 名搜索）';
    button.onclick = () => openPickerForReplace(row);
    return button;
  }

  /** 没有句型的 op：按目录里的 fields 画一张小表单，改完直接写回步骤对象。 */
  function makeFieldForm(row, fields) {
    const form = document.createElement('span');
    form.className = 'gee-fields';
    fields.forEach((field) => {
      const label = document.createElement('label');
      label.className = 'gee-field';
      const caption = document.createElement('span');
      caption.textContent = field.label_cn || field.key;
      label.appendChild(caption);
      let input;
      if (field.kind === 'select') {
        input = document.createElement('select');
        (field.options || []).forEach(([value, text]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          input.appendChild(option);
        });
        input.value = String(row.source[field.key] ?? (field.options?.[0]?.[0] ?? ''));
      } else {
        input = document.createElement('input');
        input.type = field.kind === 'number' ? 'number' : 'text';
        if (field.step !== undefined) input.step = String(field.step);
        if (field.min !== undefined) input.min = String(field.min);
        if (field.max !== undefined) input.max = String(field.max);
        const current = row.source[field.key];
        input.value = current === undefined || current === null ? '' : String(current);
      }
      input.className = 'gee-slot';
      input.dataset.fieldKey = field.key;
      input.addEventListener('change', () => {
        if (field.kind === 'number') {
          const raw = input.value.trim();
          if (raw === '') delete row.source[field.key];
          else row.source[field.key] = Number(raw);
        } else {
          row.source[field.key] = input.value;
        }
        emit();
      });
      label.appendChild(input);
      form.appendChild(label);
    });
    return form;
  }

  function renderAddList(query = '') {
    if (!addList) return;
    const needle = String(query || '').trim().toLowerCase();
    const matched = catalogEntries.filter((entry) => !needle
      || entry.op.toLowerCase().includes(needle)
      || String(entry.label_cn || '').toLowerCase().includes(needle));
    addList.innerHTML = '';
    if (!catalogEntries.length) {
      const empty = document.createElement('div');
      empty.className = 'gee-empty';
      empty.textContent = '这一页没带 op 目录（op-catalog.json），只能用「从模板插入…」。';
      addList.appendChild(empty);
      return;
    }
    if (!matched.length) {
      const empty = document.createElement('div');
      empty.className = 'gee-empty';
      empty.textContent = `没有匹配「${query}」的效果。`;
      addList.appendChild(empty);
      return;
    }
    let lastGroup = '';
    matched.forEach((entry) => {
      const groupId = entry.group || 'other';
      if (groupId !== lastGroup) {
        lastGroup = groupId;
        const title = document.createElement('div');
        title.className = 'gee-add-group';
        title.textContent = catalogGroups.get(groupId) || groupId;
        addList.appendChild(title);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gee-add-item';
      button.dataset.op = entry.op;
      const label = document.createElement('strong');
      label.textContent = entry.label_cn || entry.op;
      const code = document.createElement('code');
      code.textContent = entry.op;
      button.appendChild(label);
      button.appendChild(code);
      if (entry.note) {
        const note = document.createElement('span');
        note.className = 'gee-add-note';
        note.textContent = entry.note;
        button.appendChild(note);
      }
      button.onclick = () => {
        applyPickedStep({ op: entry.op, ...(entry.defaults || {}) });
        toggleAddPanel(false);
      };
      addList.appendChild(button);
    });
    if (addCount) addCount.textContent = `${matched.length} / ${catalogEntries.length} 个效果`;
  }

  function toggleAddPanel(open) {
    if (!addPanel) return;
    const next = open === undefined ? addPanel.hidden : Boolean(open);
    addPanel.hidden = !next;
    if (next) {
      renderAddList('');
      if (addSearch) {
        addSearch.value = '';
        if (!replaceTargetRow) addSearch.placeholder = '搜索效果：中文名或 op 名（例：状态 / status_op / 抽牌）';
        addSearch.focus();
      }
    } else {
      /* 关掉面板就把"替换目标"清掉，避免下一次添加效果误替换上一行 */
      replaceTargetRow = null;
      if (addSearch) addSearch.placeholder = '搜索效果：中文名或 op 名（例：状态 / status_op / 抽牌）';
    }
  }

  root.querySelector('[data-role="add"]').onclick = () => toggleAddPanel();
  if (addSearch) {
    addSearch.addEventListener('input', () => renderAddList(addSearch.value));
    addSearch.addEventListener('keydown', (event) => {
      /* 搜索框里回车 = 直接加第一个匹配项，连点两下键盘就能加一条 */
      if (event.key !== 'Enter') return;
      const first = addList?.querySelector('.gee-add-item');
      if (first) first.click();
    });
  }
  /* 「＋ 添加条件…」（Round 102 / 批次 CZ）：以前是个下拉框，而且生成的是**已删除的
     ``op:"if"``**（引擎只认 ``if_else``，加出来的条件运行时会直接报错）。
     现在改成和「＋ 添加效果…」同一套可搜索面板，并且写正确的 ``if_else``。 */
  const condPanel = root.querySelector('[data-role="cond-panel"]');
  const condSearch = root.querySelector('[data-role="cond-search"]');
  const condList = root.querySelector('[data-role="cond-list"]');
  const condCount = root.querySelector('[data-role="cond-count"]');

  function insertCondition(preset) {
    current.push({ op: 'if_else', condition: preset.build(), then: [] });
    emit();
  }

  function renderConditionList(query = '') {
    if (!condList) return;
    const needle = String(query || '').trim().toLowerCase();
    const matched = CONDITION_PRESETS.filter((preset) => !needle
      || preset.id.toLowerCase().includes(needle)
      || String(preset.label || '').toLowerCase().includes(needle));
    condList.innerHTML = '';
    if (!matched.length) {
      const empty = document.createElement('div');
      empty.className = 'gee-empty';
      empty.textContent = `没有匹配「${query}」的条件。`;
      condList.appendChild(empty);
      return;
    }
    matched.forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gee-add-item';
      button.dataset.condition = preset.id;
      const label = document.createElement('strong');
      label.textContent = preset.label;
      const code = document.createElement('code');
      code.textContent = preset.id;
      button.appendChild(label);
      button.appendChild(code);
      button.onclick = () => {
        insertCondition(preset);
        toggleConditionPanel(false);
      };
      condList.appendChild(button);
    });
    if (condCount) condCount.textContent = `${matched.length} / ${CONDITION_PRESETS.length} 个条件`;
  }

  function toggleConditionPanel(open) {
    if (!condPanel) return;
    const next = open === undefined ? condPanel.hidden : Boolean(open);
    condPanel.hidden = !next;
    if (next) {
      renderConditionList('');
      if (condSearch) {
        condSearch.value = '';
        condSearch.focus();
      }
    }
  }

  root.querySelector('[data-role="add-if"]').onclick = () => toggleConditionPanel();
  if (condSearch) {
    condSearch.addEventListener('input', () => renderConditionList(condSearch.value));
    condSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const first = condList?.querySelector('.gee-add-item');
      if (first) first.click();
    });
  }
  const presetSelect = root.querySelector('[data-role="preset"]');
  presetSelect.addEventListener('change', () => {
    const preset = TEMPLATE_PRESETS.find((item) => item.id === presetSelect.value);
    presetSelect.value = '';
    if (!preset) return;
    /* 深拷贝，避免多个卡共用同一份预设对象 */
    preset.steps.forEach((step) => current.push(JSON.parse(JSON.stringify(step))));
    emit();
  });

  rebuildRows();
  render();

  return {
    element: root,
    setSteps(next) {
      /* 换卡/换时点：重置历史，别把上一张卡的改动撤回来 */
      current = Array.isArray(next) ? next : [];
      undoStack.length = 0;
      redoStack.length = 0;
      lastSnapshot = JSON.stringify(current);
      refresh();
      updateHistoryButtons();
    },
    getSteps() { return current; },
    getDescription() { return describeRows(rows, TEMPLATE_BY_OP, expr); },
  };
}
