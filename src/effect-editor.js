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
  statusCatalog, tagLabels,
} from './gtn-text/index.js';
import { stepsToRows, applySlotEdit, branchKeysOf } from './gtn-text/steps.js';

const TEMPLATE_BY_OP = templates;

/* ---------- 条件表达式的可视化编辑 ----------
   目前支持游戏卡数据里最常见的两种形态：
     1. compare{a, operator, b} —— 可改运算符与右侧字面量；
     2. not{value: card_has_tag{tag}} —— 可改标签。
   其他形态保持只读，避免破坏表达式树。 */
const OPERATORS = [['>=', '≥'], ['<=', '≤'], ['>', '＞'], ['<', '＜'], ['==', '='], ['!=', '≠']];
/* 标签/状态下拉的兜底目录（生成物）：真正渲染时用调用方传进来的完整列表 */
const DEFAULT_TAGS = Object.entries(tagLabels).map(([value, label]) => ({ value, label }));

/* 左值表达式常见的几种形态：能在下拉里选，其余保持只读 */
const LEFT_FORMS = [
  ['last_damage', '上次受到的伤害'],
  ['status_stack', '目标的状态层数'],
  ['hand_count', '目标的手牌数'],
  ['deck_count', '目标的抽牌堆数'],
  ['player_stat', '目标的属性'],
  ['const', '固定数值'],
];
const STAT_CHOICES = ['health', 'elixir', 'magic', 'armor', 'max_health', 'max_elixir', 'max_magic'];
const DEFAULT_STATUS = Object.entries(statusCatalog).map(([value, label]) => ({ value, label }));

/* 选项可能是 '值'，也可能是 {value,label,icon}；下面几个小工具统一两种形态 */
const choiceValue = (choice) => (choice && typeof choice === 'object' ? String(choice.value) : String(choice));
const choiceLabel = (choice) => (choice && typeof choice === 'object'
  ? String(choice.label ?? choice.value) : String(choice));

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

/** 左值表达式编辑器：能识别的形态给下拉，不能识别就只读。 */
function renderLeftValue(node, terms, expr, onChange) {
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
  if (!LEFT_FORMS.some(([key]) => key === op)) {
    const span = document.createElement('span');
    span.className = 'gee-readonly-slot';
    span.textContent = expr.value(node) || '?';
    span.title = '这种左值表达式暂不支持在这里编辑';
    return span;
  }
  const wrap = document.createElement('span');
  wrap.className = 'gee-cond';
  const form = makeSelect('gee-slot', LEFT_FORMS.map(([key]) => key), op,
    (value) => LEFT_FORMS.find(([key]) => key === value)?.[1] || value);
  form.addEventListener('input', () => {
    const next = { op: form.value };
    if (form.value === 'status_stack') { next.target = 'target'; next.status = choiceValue(activeStatusOptions[0]); }
    if (form.value === 'player_stat') { next.target = 'target'; next.stat = STAT_CHOICES[0]; }
    if (form.value === 'hand_count' || form.value === 'deck_count') next.target = 'target';
    onChange(form.value === 'const' ? 0 : next);
  });
  wrap.appendChild(form);
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
  return wrap;
}

function isLiteral(node) {
  return typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean';
}

function conditionEditor(row, expr) {
  const condition = row.source?.condition || row.source?.cond;
  if (!condition || typeof condition !== 'object') return null;
  const op = String(condition.op || condition.ref || '');

  if (op === 'compare') {
    return {
      kind: 'compare',
      condition,
      leftText: expr.value(condition.a),
      operator: String(condition.operator || '>='),
      rightLiteral: isLiteral(condition.b) ? condition.b : null,
      rightText: expr.value(condition.b),
    };
  }
  if (op === 'not') {
    const inner = condition.value ?? condition.cond;
    if (inner && typeof inner === 'object' && String(inner.op || inner.ref) === 'card_has_tag') {
      return { kind: 'not_card_has_tag', condition, inner, tag: String(inner.tag || '') };
    }
  }
  if (op === 'and' || op === 'or') {
    const left = condition.value ?? condition.left ?? (Array.isArray(condition.values) ? condition.values[0] : null);
    const right = condition.right ?? (Array.isArray(condition.values) ? condition.values[1] : null);
    if (left && right) return { kind: 'and_or', condition, operator: op, left, right };
  }
  return null;
}

function renderConditionControls(line, row, info, emit) {
  if (info.kind === 'compare') {
    line.appendChild(renderLeftValue(info.condition.a, terms, expr, (next) => {
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

    if (info.rightLiteral !== null) {
      const right = document.createElement('input');
      right.type = typeof info.rightLiteral === 'number' ? 'number' : 'text';
      right.className = 'gee-slot gee-slot-num';
      right.value = info.rightLiteral;
      right.addEventListener('input', () => {
        info.condition.b = typeof info.rightLiteral === 'number' ? Number(right.value) || 0 : right.value;
        emit();
      });
      line.appendChild(right);
    } else {
      const right = document.createElement('span');
      right.className = 'gee-readonly-slot';
      right.textContent = info.rightText || '?';
      right.title = '右值表达式暂不支持在这里编辑';
      line.appendChild(right);
    }
    return true;
  }

  if (info.kind === 'and_or') {
    const wrap = document.createElement('span');
    wrap.className = 'gee-cond';
    const leftSlot = document.createElement('span');
    leftSlot.className = 'gee-cond';
    renderConditionNode(leftSlot, { condition: info.left }, emit);
    wrap.appendChild(leftSlot);
    const opSelect = makeSelect('gee-slot', ['and', 'or'], info.operator, (v) => (v === 'and' ? '且' : '或'));
    opSelect.addEventListener('input', () => {
      info.condition.op = opSelect.value;
      emit();
    });
    wrap.appendChild(opSelect);
    const rightSlot = document.createElement('span');
    rightSlot.className = 'gee-cond';
    renderConditionNode(rightSlot, { condition: info.right }, emit);
    wrap.appendChild(rightSlot);
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
  return false;
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
  statusChoices = [], tagChoices = [],
}) {
  let current = Array.isArray(steps) ? steps : [];
  let rows = [];
  let showInternal = false;
  /* 状态下拉 = 生成目录 + 本模组自定义状态；标签同理 */
  activeStatusOptions = mergeChoices(DEFAULT_STATUS, statusChoices);
  activeTagOptions = mergeChoices(DEFAULT_TAGS, tagChoices);

  const root = document.createElement('div');
  root.className = 'gtn-effect-editor';
  root.innerHTML = `
    <div class="gee-toolbar">
      <label class="gee-toggle"><input type="checkbox" data-role="internal" /> 显示内部步骤</label>
      <span class="gee-coverage" data-role="coverage"></span>
      <span class="gee-desc-preview" data-role="preview"></span>
    </div>
    <div class="gee-rows" data-role="rows"></div>
    <div class="gee-actions">
      <button type="button" data-role="add">+ 添加效果</button>
      <span class="gee-add-if" data-role="add-if-host"></span>
      <select class="gee-slot" data-role="preset" title="从模板库插入常见效果">
        <option value="">从模板插入…</option>
        ${TEMPLATE_PRESETS.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`).join('')}
      </select>
    </div>`;
  container.innerHTML = '';
  container.appendChild(root);

  const rowsHost = root.querySelector('[data-role="rows"]');
  const previewHost = root.querySelector('[data-role="preview"]');
  const coverageHost = root.querySelector('[data-role="coverage"]');

  function rebuildRows() {
    rows = stepsToRows({ on_play: { steps: current } }, { templates: TEMPLATE_BY_OP, terms, expr });
  }

  function emit() {
    rebuildRows();
    render();
    onChange(current);
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
      control = document.createElement('input');
      control.type = 'number';
      control.className = 'gee-slot gee-slot-num';
      control.value = row.values[part.slot] ?? 1;
    } else if (part.free) {
      /* 值域开放（例如牌属性名）的槽位用自由文本，别硬塞一个假下拉 */
      control = document.createElement('input');
      control.type = 'text';
      control.className = 'gee-slot gee-slot-text';
      control.value = row.values[part.slot] ?? '';
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
        control.addEventListener('input', () => { if (applySlotEdit(row, part, control.value)) emit(); });
        return wrap;
      }
    }
    control.addEventListener('input', () => {
      if (applySlotEdit(row, part, control.value)) emit();
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

      if (template && template.internal) {
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
        const cardSpecific = /^[a-z0-9]+_[a-z0-9_]+$/.test(opName);
        line.innerHTML = `<span class="gee-badge${cardSpecific ? ' gee-badge-warn' : ''}">`
          + `${cardSpecific ? '卡专用步骤' : '原样保留'}</span>`
          + `<code>${escapeHtml(tokenText(row.summary))}</code>`
          + `<span class="gee-note">${cardSpecific
            ? '此步骤由卡专用原子实现，暂不支持可视化编辑；其它字段仍可正常修改'
            : '此 op 还没有句型模板，保持原样导出'}</span>`;
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
  root.querySelector('[data-role="add"]').onclick = () => {
    current.push({ op: 'deal_damage', target: 'target', amount: 0 });
    emit();
  };
  /* 「＋ 添加条件…」：先选条件形态，向导把完整条件写好（不再插空对象） */
  const addIfSelect = conditionPresetSelect('', '＋ 添加条件…');
  addIfSelect.classList.add('gee-slot-add');
  addIfSelect.addEventListener('change', () => {
    const chosen = CONDITION_PRESETS.find((item) => item.id === addIfSelect.value);
    addIfSelect.value = '';
    if (!chosen) return;
    current.push({ op: 'if', condition: chosen.build(), then: [] });
    emit();
  });
  root.querySelector('[data-role="add-if-host"]').appendChild(addIfSelect);
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
    setSteps(next) { current = Array.isArray(next) ? next : []; rebuildRows(); render(); },
    getSteps() { return current; },
    getDescription() { return describeRows(rows, TEMPLATE_BY_OP, expr); },
  };
}
