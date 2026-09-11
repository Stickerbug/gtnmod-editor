/* 效果行编辑器：直接用步骤数组工作，不依赖 Blockly。
   与 GTN Mod Studio 的数据模型对接方式：

     const editor = createEffectEditor({ container, steps, onChange });
     editor.setSteps(nextSteps);   // 切换卡片/事件时重新载入
     editor.getSteps();            // 取回当前步骤（onChange 里也会给）

   槽位编辑会直接写回原始步骤对象，未识别为句型的 op 以"原样保留"行显示，
   管道型 op（变量、战报文案、每回合一次）默认折叠。 */

import { templates, terms, expr, describeRows, escapeHtml, TEMPLATE_PRESETS } from './gtn-text/index.js';
import { stepsToRows, applySlotEdit } from './gtn-text/steps.js';

const TEMPLATE_BY_OP = templates;

/* ---------- 条件表达式的可视化编辑 ----------
   目前支持游戏卡数据里最常见的两种形态：
     1. compare{a, operator, b} —— 可改运算符与右侧字面量；
     2. not{value: card_has_tag{tag}} —— 可改标签。
   其他形态保持只读，避免破坏表达式树。 */
const OPERATORS = [['>=', '≥'], ['<=', '≤'], ['>', '＞'], ['<', '＜'], ['==', '='], ['!=', '≠']];
const TAG_CHOICES = ['exile', 'sprout', 'symbiosis', 'precision', 'swift', 'heavy', 'void', 'unique', 'copy'];

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
const STATUS_CHOICES = ['fire', 'poison', 'bleed', 'weakness', 'frost'];

function makeSelect(className, choices, current, labelOf = (v) => v) {
  const select = document.createElement('select');
  select.className = className;
  const values = current && !choices.includes(current) ? [current, ...choices] : choices;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labelOf(value);
    option.selected = value === current;
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
    if (form.value === 'status_stack') { next.target = 'target'; next.status = STATUS_CHOICES[0]; }
    if (form.value === 'player_stat') { next.target = 'target'; next.stat = STAT_CHOICES[0]; }
    if (form.value === 'hand_count' || form.value === 'deck_count') next.target = 'target';
    onChange(form.value === 'const' ? 0 : next);
  });
  wrap.appendChild(form);
  if (op === 'status_stack') {
    const status = makeSelect('gee-slot', STATUS_CHOICES, node.status || 'fire', (v) => terms.status(v));
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
    const options = info.tag && !TAG_CHOICES.includes(info.tag) ? [info.tag, ...TAG_CHOICES] : TAG_CHOICES;
    options.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = terms.tag(value);
      option.selected = value === info.tag;
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
    const span = document.createElement('span');
    span.className = 'gee-readonly-slot';
    span.textContent = expr.describe(row.condition || {}) || '条件';
    span.title = '这种条件形态暂不支持在这里编辑';
    container.appendChild(span);
    return;
  }
  renderConditionControls(container, row, info, emit);
}

export function createEffectEditor({ container, steps = [], onChange = () => {}, emptyHint = '', emptyCoverage = '' }) {
  let current = Array.isArray(steps) ? steps : [];
  let rows = [];
  let showInternal = false;

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
      <button type="button" data-role="add-if">+ 添加条件</button>
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
    } else {
      control = document.createElement('select');
      control.className = 'gee-slot';
      const currentValue = row.values[part.slot];
      const rawOptions = part.options || [];
      /* 选项可以是 '值'，也可以是 {value,label}：后者写回的是 value，
         显示的是 label（伤害类型就是这样把 physical/magic 显示成 D / 电伤图标）。 */
      const optionValue = (option) => (option && typeof option === 'object' ? String(option.value) : String(option));
      const optionLabel = (option) => (option && typeof option === 'object'
        ? String(option.label ?? option.value) : String(option));
      const hasCurrent = rawOptions.some((option) => optionValue(option) === currentValue);
      const options = (currentValue && !hasCurrent)
        ? [{ value: currentValue, label: currentValue }, ...rawOptions] : rawOptions;
      options.forEach((option) => {
        const item = document.createElement('option');
        item.value = optionValue(option);
        item.textContent = optionLabel(option);
        item.selected = optionValue(option) === currentValue;
        control.appendChild(item);
      });
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
        line.innerHTML = `<span class="gee-badge">${escapeHtml(template.badge)}</span>`
          + `<span class="gee-internal">${escapeHtml(template.internalLabel(row))}</span>`
          + '<span class="gee-note">不写进描述</span>';
        line.appendChild(makeRemove(row));
        rowsHost.appendChild(line);
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
          + `<code>${escapeHtml(row.summary)}</code>`
          + `<span class="gee-note">${cardSpecific
            ? '此步骤由卡专用原子实现，暂不支持可视化编辑；其它字段仍可正常修改'
            : '此 op 还没有句型模板，保持原样导出'}</span>`;
        line.appendChild(makeRemove(row));
        rowsHost.appendChild(line);
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
        if (typeof part === 'string') line.appendChild(document.createTextNode(part));
        else {
          if (part.prefix) line.appendChild(document.createTextNode(part.prefix));
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
    });
    previewHost.textContent = describeRows(rows, TEMPLATE_BY_OP, expr) || '（暂无效果描述）';
  }

  root.querySelector('[data-role="internal"]').addEventListener('change', (event) => {
    showInternal = event.target.checked;
    render();
  });
  root.querySelector('[data-role="add"]').onclick = () => {
    current.push({ op: 'deal_damage', target: 'target', amount: 0 });
    emit();
  };
  root.querySelector('[data-role="add-if"]').onclick = () => {
    current.push({ op: 'if', condition: {}, then: [] });
    emit();
  };
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
