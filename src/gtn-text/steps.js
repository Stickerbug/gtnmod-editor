/* 卡数据步骤树 → 效果行。展开顶层步骤与其分支体；管道型 op 标 internal。 */

import { describeRow } from './templates.js';
import rules from '../generated/card-text-rules.js';

/** 步骤参数里的取值 → 编辑器句子里的说法（目标/状态/属性/区域）。 */
/* [[icon:...]] 与状态别名的归一：老数据里可能写 'burn'/'灼烧'/'f'，统一成规范 id */
const STATUS_CATALOG = rules.statusCatalog || {};
const STATUS_ALIASES = rules.statusAliases || {};

function canonicalStatusId(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return text;
  if (STATUS_CATALOG[text]) return text;
  return STATUS_ALIASES[text] || STATUS_ALIASES[text.toLowerCase()] || text;
}

/* 伤害类型的历史写法（早期编辑器把图标 token 直接写进 damage_type）→ 运行时值 */
const DAMAGE_TYPE_ALIASES = {
  physical: 'physical',
  damage: 'physical',
  '[[icon:d]]': 'physical',
  '[[icon:damage]]': 'physical',
  magic: 'magic',
  magical: 'magic',
  spell: 'magic',
  electric: 'magic',
  electric_damage: 'magic',
  '[[icon:electric_damage]]': 'magic',
};

function mapSlotValue(part, raw, terms) {
  const text = String(raw);
  /* {value,label} 成对选项的槽位（伤害类型、属性名、资源名…）：
     步骤里存的就是运行时值，别翻译，显示交给选项的 label/icon。 */
  if (Array.isArray(part.options) && part.options.some((option) => option && typeof option === 'object')) {
    if (part.slot === 'damage_type') return DAMAGE_TYPE_ALIASES[text.trim().toLowerCase()] || 'physical';
    /* 状态：老数据里可能是 burn/灼烧，归一成运行时 id，下拉才选得中 */
    if (part.status || part.slot === 'status') return canonicalStatusId(text);
    return text;
  }
  if (part.slot === 'status') return terms.status(text);
  if (part.slot === 'property' || part.slot === 'prop') return terms.property(text);
  if (part.slot === 'zone') return terms.zone(text);
  if (part.slot === 'damage_type') return DAMAGE_TYPE_ALIASES[text.trim().toLowerCase()] || 'physical';
  if (part.free) return text;
  if (part.options) return terms.target(text) || text;
  return text;
}

function stepParams(step) {
  const params = (step && typeof step.params === 'object' && step.params) ? step.params : (step || {});
  return params;
}

function describeStepParams(step) {
  const params = stepParams(step);
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || typeof value === 'object') continue;
    if (['op', 'type', 'log', 'params'].includes(key)) continue;
    parts.push(`${key}=${value}`);
    if (parts.length >= 3) break;
  }
  return parts.join(' ');
}

/* 哪些 op 的哪些参数是"分支体"，展开成缩进子行 */
const CHILD_KEYS = {
  if: [['then', '则'], ['else', '否则']],
  for_each: [['body', '循环体'], ['steps', '循环体']],
  for_each_selected_card: [['body', '循环体'], ['steps', '循环体']],
  ocean_for_each_selectable_target: [['body', '循环体'], ['steps', '循环体']],
  for_each_target: [['body', '循环体'], ['steps', '循环体']],
  repeat: [['body', '循环体'], ['steps', '循环体']],
  absorb_attack_damage: [['body', '其后'], ['steps', '其后']],
  register_play_listener: [['body', '监听到出牌时'], ['steps', '监听到出牌时']],
  once_per_play: [['steps', '其中']],
};

function childListsOf(op, step) {
  const params = stepParams(step);
  const lists = [];
  for (const [key, label] of CHILD_KEYS[op] || []) {
    const value = params[key];
    if (Array.isArray(value) && value.length) lists.push({ array: value, label });
  }
  return lists;
}

/**
 * 这个 op 的分支槽位（含**空**的分支）：效果行编辑器用它给"则 / 否则 / 循环体"
 * 画一个占位行，否则用户加完条件根本找不到往哪儿写效果。
 */
export function branchSlotsOf(op, step) {
  const params = stepParams(step);
  return (CHILD_KEYS[op] || []).map(([key, label]) => ({ key, label, array: params[key] }));
}

/** 容器类 op 的分支槽位名单（不给具体步骤）。 */
export function branchKeysOf(op) {
  return (CHILD_KEYS[op] || []).map(([key, label]) => ({ key, label }));
}

/** stepsToRows(events, { templates, terms, expr }) → 效果行数组（含子行）。 */
export function stepsToRows(events, { templates, terms, expr }) {
  const onPlay = events && events.on_play;
  const steps = (onPlay && onPlay.steps) || [];
  const out = [];

  const buildRow = (step, depth, branchLabel, parentArray) => {
    const op = String((step && (step.op || step.type)) || '').trim();
    const params = stepParams(step);
    const template = templates[op];
    const base = { op, depth, branchLabel, parentArray, source: step };
    if (!template) {
      return { ...base, generic: true, values: {}, summary: `${op} ${describeStepParams(step)}`.trim() };
    }
    const values = {};
    const fill = (parts) => parts.forEach((part) => {
      if (typeof part === 'string') return;
      const keys = Array.isArray(part.param) ? part.param : [part.param || part.slot];
      let raw;
      for (const key of keys) {
        if (params[key] !== undefined && params[key] !== null) { raw = params[key]; break; }
      }
      /* 状态优先用卡数据里的本地化 label（例如 apply_jungle_status 的 label） */
      if (part.slot === 'status' && params.label) raw = params.label;
      if (raw === undefined || raw === null) return;
      if (typeof raw === 'object') {
        const inner = raw.value ?? (raw.params && raw.params.value);
        if (typeof inner === 'number' || typeof inner === 'string') values[part.slot] = inner;
        /* 复杂表达式（例如 3+X 回合）：把中文读法放进值里，
           编辑器会把它渲染成只读标签，而不是假装成可编辑的数字。 */
        else values[part.slot] = expr.describe(raw);
        return;
      }
      values[part.slot] = mapSlotValue(part, raw, terms);
    });
    fill(template.parts({ values }));
    fill(template.parts({ values }));
    /* 条件行：表达式树 → 中文，作为可编辑的默认值 */
    if (op === 'if') {
      const condition = expr.describe(step.condition || step.cond || {});
      values.condition = condition || '条件成立';
    }
    if (template.internal) {
      for (const [key, value] of Object.entries(params)) {
        if (typeof value !== 'object' && values[key] === undefined) values[key] = value;
      }
    }
    return { ...base, tpl: op, values };
  };

  const walk = (list, depth, parentArray, branchLabel) => {
    list.forEach((step) => {
      if (!step || typeof step !== 'object') return;
      const op = String(step.op || step.type || '').trim();
      out.push(buildRow(step, depth, branchLabel, parentArray));
      childListsOf(op, step).forEach(({ array, label }) => {
        walk(array, depth + 1, array, label);
      });
    });
  };
  walk(steps, 0, steps, '');
  return out;
}

/**
 * 槽位 → 步骤参数键。模板里可以用 param 指定别名
 * （例如 stacks 实际写进 amount，count 可能写进 count 或 amount）。
 */
export function slotParamKey(part, source) {
  const keys = Array.isArray(part.param) ? part.param : [part.param || part.slot];
  if (source && typeof source === 'object') {
    for (const key of keys) {
      if (source[key] !== undefined) return key;
    }
  }
  return keys[0];
}

/** 把编辑后的槽位值写回步骤对象（condition 这类自由文本不写回）。 */
export function applySlotEdit(row, part, value) {
  if (!row || !row.source || part.text) return false;
  const key = slotParamKey(part, row.source);
  row.source[key] = part.number ? Number(value) || 0 : value;
  return true;
}

export { describeRow };
