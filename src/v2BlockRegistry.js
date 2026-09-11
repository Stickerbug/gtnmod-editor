import * as Blockly from 'blockly';

const VALUE_CHECK = ['Number', 'String', 'Boolean', 'ValueExpr'];
const TARGET_CHECK = ['PlayerRef', 'PlayerList'];

export const BLOCK_CATEGORIES = [
  { id: 'flow', name: '流程', colour: 120 },
  { id: 'conditions', name: '条件', colour: 210 },
  { id: 'values', name: '数值', colour: 230 },
  { id: 'targets', name: '目标', colour: 55 },
  { id: 'damage', name: '伤害与回复', colour: 350 },
  { id: 'resources', name: '资源', colour: 185 },
  { id: 'statuses', name: '状态', colour: 300 },
  { id: 'zones', name: '卡牌区域', colour: 260 },
  { id: 'equipment', name: '装备', colour: 220 },
  { id: 'tags', name: '标签', colour: 310 },
  { id: 'variables', name: '变量', colour: 32 },
  { id: 'ui', name: 'UI交互', colour: 205 },
  { id: 'counter', name: '反制', colour: 15 },
  { id: 'log', name: '日志', colour: 45 },
  { id: 'advanced', name: '高级', colour: 285 },
];

const categoryById = new Map(BLOCK_CATEGORIES.map(item => [item.id, item]));

const playerOptions = [
  ['自己', 'source'],
  ['当前目标', 'target'],
  ['对方', 'enemy'],
  ['所有玩家', 'all_players'],
  ['所有敌方', 'all_enemies'],
  ['来源玩家', 'source'],
  ['所选玩家', 'chosen_player'],
];

const zoneOptions = [
  ['手牌', 'hand'],
  ['抽牌堆', 'deck'],
  ['弃牌堆', 'discard'],
  ['放逐区', 'exile'],
  ['装备区', 'equipment'],
];

const statOptions = [
  ['生命 H', 'health'],
  ['能量 E', 'elixir'],
  ['魔力 M', 'magic'],
  ['护甲 A', 'armor'],
  ['最大生命', 'max_health'],
  ['最大能量', 'max_elixir'],
  ['最大魔力', 'max_magic'],
  ['手牌数量', 'hand'],
  ['牌堆数量', 'deck'],
  ['弃牌数量', 'discard'],
  ['装备数量', 'equipment'],
];

const cardPropOptions = [
  ['ID', 'id'],
  ['类型', 'type'],
  ['E费用', 'cost_e'],
  ['M费用', 'cost_m'],
  ['E费用覆盖', 'cost_e_override'],
  ['M费用覆盖', 'cost_m_override'],
  ['伤害', 'damage'],
  ['额外伤害', 'bonus_damage'],
  ['回手牌倒计时', 'return_to_hand_turns'],
  ['手中保留回合', 'held_turns'],
  ['拟态减费', 'mimic_discount'],
  ['标签数量', 'tag_count'],
  ['聚变层数', 'fusion_level'],
  ['裂变层数', 'fission_level'],
];

const fieldOptions = [
  ['E费用', 'cost_e'],
  ['M费用', 'cost_m'],
  ['牌堆数量', 'count'],
  ['伤害', 'damage'],
  ['权重', 'weight'],
  ['优先级', 'priority'],
];

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

function inputValue(name, check = VALUE_CHECK) {
  return { type: 'input_value', name, check };
}

function fieldInput(name, text = '') {
  return { type: 'field_input', name, text };
}

function fieldNumber(name, value = 0) {
  return { type: 'field_number', name, value };
}

function fieldDropdown(name, options) {
  return { type: 'field_dropdown', name, options };
}

function block(id, category, json, compileToAst, docs = '', outputType = null) {
  const cat = categoryById.get(category);
  return {
    id,
    category,
    label_cn: json.message0,
    label_en: json.message0,
    inputs: json.args0 || [],
    output_type: outputType || json.output || null,
    allowed_contexts: ['card', 'status', 'opening_event', 'hook', 'patch'],
    compile_to_ast: compileToAst,
    docs,
    examples: [],
    risk_level: 'safe',
    json: {
      type: id,
      colour: cat?.colour ?? 180,
      tooltip: docs,
      ...json,
    },
  };
}

const shadowNumber = value => ({
  shadow: { type: 'gtn_number', fields: { NUM: String(value) } },
});

const shadowText = value => ({
  shadow: { type: 'gtn_text', fields: { TEXT: String(value) } },
});

const shadowTarget = value => ({
  shadow: { type: 'gtn_target', fields: { TARGET: value } },
});

const EVENT_HEAD_BLOCK = {
  type: 'gtn_event_head',
  message0: '%1 %2',
  args0: [
    { type: 'field_label_serializable', name: 'LABEL', text: '当事件触发时' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 20,
  tooltip: '固定触发头，不会导出为逻辑步骤。',
  helpUrl: '',
};

export const BLOCK_REGISTRY = [
  block('gtn_if', 'flow', {
    message0: '如果 %1 那么 %2',
    args0: [inputValue('COND', 'Boolean'), { type: 'input_statement', name: 'THEN' }],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'if', condition: c.value(b, 'COND', false), then: c.statement(b, 'THEN') }), '条件成立时执行。'),
  block('gtn_if_else', 'flow', {
    message0: '如果 %1 那么 %2 否则 %3',
    args0: [
      inputValue('COND', 'Boolean'),
      { type: 'input_statement', name: 'THEN' },
      { type: 'input_statement', name: 'ELSE' },
    ],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'if', condition: c.value(b, 'COND', false), then: c.statement(b, 'THEN'), else: c.statement(b, 'ELSE') }), '条件分支。'),
  block('gtn_repeat', 'flow', {
    message0: '重复 %1 次 %2',
    args0: [inputValue('TIMES'), { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'repeat', times: c.value(b, 'TIMES', 1), steps: c.statement(b, 'DO') }), '有限重复。'),
  block('gtn_for_each_target', 'flow', {
    message0: '对每个目标 %1 作为变量 %2 执行 %3',
    args0: [inputValue('TARGETS', ['PlayerList', 'PlayerRef']), fieldInput('VAR', '目标'), { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'for_each', items: c.value(b, 'TARGETS', 'all_players'), as: c.field(b, 'VAR', 'target'), steps: c.statement(b, 'DO') }), '遍历玩家目标。'),
  block('gtn_for_each_card', 'flow', {
    message0: '对每张牌 %1 作为变量 %2 执行 %3',
    args0: [inputValue('CARDS', ['CardList', 'ZoneRef']), fieldInput('VAR', 'card'), { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'for_each', items: c.value(b, 'CARDS', []), as: c.field(b, 'VAR', 'card'), steps: c.statement(b, 'DO') }), '遍历卡牌列表。'),
  block('gtn_stop', 'flow', {
    message0: '停止后续效果',
    previousStatement: null,
    nextStatement: null,
  }, () => ({ op: 'stop' }), '停止当前事件后续效果。'),
  block('gtn_cancel_event', 'flow', {
    message0: '取消当前事件',
    previousStatement: null,
    nextStatement: null,
  }, () => ({ op: 'cancel_event' }), '用于反制或事件 hook。'),

  block('gtn_cond_compare', 'conditions', {
    message0: '%1 %2 %3',
    args0: [inputValue('A'), fieldDropdown('OP', [['=', '=='], ['≠', '!='], ['>', '>'], ['<', '<'], ['≥', '>='], ['≤', '<=']]), inputValue('B')],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: 'compare', a: c.value(b, 'A', 0), operator: c.field(b, 'OP', '=='), b: c.value(b, 'B', 0) }), '比较两个表达式。', 'Boolean'),
  block('gtn_cond_and_or', 'conditions', {
    message0: '%1 %2 %3',
    args0: [inputValue('A', 'Boolean'), fieldDropdown('OP', [['且', 'and'], ['或', 'or']]), inputValue('B', 'Boolean')],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: c.field(b, 'OP', 'and'), conditions: [c.value(b, 'A', false), c.value(b, 'B', false)] }), '逻辑且/或。', 'Boolean'),
  block('gtn_cond_not', 'conditions', {
    message0: '非 %1',
    args0: [inputValue('VALUE', 'Boolean')],
    output: 'Boolean',
  }, (b, c) => ({ op: 'not', condition: c.value(b, 'VALUE', false) }), '逻辑取反。', 'Boolean'),
  block('gtn_cond_has_status', 'conditions', {
    message0: '%1 有状态 %2',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison')],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: 'compare', a: { op: 'status_stack', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS') }, operator: '>', b: 0 }), '判断状态层数是否大于 0。', 'Boolean'),
  block('gtn_cond_card_has_tag', 'conditions', {
    message0: '卡牌 %1 有标签 %2',
    args0: [inputValue('CARD', 'CardRef'), fieldInput('TAG', 'gtn:exile')],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: 'card_has_tag', card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG') }), '判断卡牌标签。', 'Boolean'),
  block('gtn_cond_zone_exists', 'conditions', {
    message0: '区域 %1 中存在卡牌',
    args0: [inputValue('ZONE', ['ZoneRef', 'CardList'])],
    output: 'Boolean',
  }, (b, c) => ({ op: 'compare', a: { op: 'count', selector: c.value(b, 'ZONE', []) }, operator: '>', b: 0 }), '判断区域是否非空。', 'Boolean'),
  block('gtn_cond_last_damage_positive', 'conditions', {
    message0: '当前伤害大于 0',
    output: 'Boolean',
  }, () => ({ op: 'compare', a: { op: 'last_damage' }, operator: '>', b: 0 }), '常用于吸血。', 'Boolean'),

  block('gtn_number', 'values', {
    message0: '%1',
    args0: [fieldNumber('NUM', 0)],
    output: 'Number',
  }, b => Number(b.getFieldValue('NUM') || 0), '数字字面量。', 'Number'),
  block('gtn_text', 'values', {
    message0: '文本 %1',
    args0: [fieldInput('TEXT', '')],
    output: 'String',
  }, b => String(b.getFieldValue('TEXT') || ''), '文本字面量。', 'String'),
  block('gtn_value_player_stat', 'values', {
    message0: '%1 的 %2',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldDropdown('STAT', statOptions)],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: 'player_stat', target: c.value(b, 'TARGET', 'source'), stat: c.field(b, 'STAT', 'health') }), '读取玩家数值。', 'Number'),
  block('gtn_value_zone_count', 'values', {
    message0: '%1 的 %2 数量',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', zoneOptions)],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: 'count', selector: { ref: c.field(b, 'ZONE', 'hand'), target: c.value(b, 'TARGET', 'source') } }), '读取区域数量。', 'Number'),
  block('gtn_value_status_stack', 'values', {
    message0: '%1 的状态 %2 层数',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison')],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: 'status_stack', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS') }), '读取状态层数。', 'Number'),
  block('gtn_value_card_prop', 'values', {
    message0: '卡牌 %1 的 %2',
    args0: [inputValue('CARD', 'CardRef'), fieldDropdown('PROP', cardPropOptions)],
    output: VALUE_CHECK,
    inputsInline: true,
  }, (b, c) => ({ op: 'card_prop', card: c.value(b, 'CARD', 'current_card'), property: c.field(b, 'PROP', 'id') }), '读取卡牌属性。', 'ValueExpr'),
  block('gtn_value_last_damage', 'values', {
    message0: '上次造成伤害',
    output: 'Number',
  }, () => ({ op: 'last_damage' }), '读取上一次实际伤害。', 'Number'),
  block('gtn_value_event_value', 'values', {
    message0: '当前事件数值',
    output: 'Number',
  }, () => ({ op: 'event_value' }), '读取可被 hook 修改的事件值。', 'Number'),
  block('gtn_value_math', 'values', {
    message0: '%1 %2 %3',
    args0: [inputValue('A'), fieldDropdown('OP', [['+', 'add'], ['-', 'sub'], ['×', 'mul'], ['÷', 'div'], ['min', 'min'], ['max', 'max']]), inputValue('B')],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: c.field(b, 'OP', 'add'), a: c.value(b, 'A', 0), b: c.value(b, 'B', 0) }), '加减乘除、最小、最大。', 'Number'),
  block('gtn_value_round', 'values', {
    message0: '%1 %2',
    args0: [fieldDropdown('OP', [['floor', 'floor'], ['ceil', 'ceil']]), inputValue('VALUE')],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: c.field(b, 'OP', 'floor'), value: c.value(b, 'VALUE', 0) }), '向下/向上取整。', 'Number'),
  block('gtn_value_random_int', 'values', {
    message0: '随机整数 %1 到 %2',
    args0: [inputValue('MIN'), inputValue('MAX')],
    output: 'Number',
    inputsInline: true,
  }, (b, c) => ({ op: 'random', min: c.value(b, 'MIN', 1), max: c.value(b, 'MAX', 6) }), '随机整数。', 'Number'),
  block('gtn_value_var', 'values', {
    message0: '变量 %1',
    args0: [fieldInput('NAME', 'x')],
    output: VALUE_CHECK,
  }, b => ({ op: 'var', name: b.getFieldValue('NAME') || 'x' }), '读取临时变量。', 'ValueExpr'),

  block('gtn_target', 'targets', {
    message0: '玩家 %1',
    args0: [fieldDropdown('TARGET', playerOptions)],
    output: 'PlayerRef',
  }, b => b.getFieldValue('TARGET') || 'source', '玩家选择器。', 'PlayerRef'),
  block('gtn_target_random', 'targets', {
    message0: '随机玩家 %1',
    args0: [fieldDropdown('SCOPE', [['所有玩家', 'all_players'], ['所有敌方', 'all_enemies']])],
    output: 'PlayerRef',
  }, b => ({ selector: 'random_player', scope: b.getFieldValue('SCOPE') || 'all_players' }), '随机玩家选择器。', 'PlayerRef'),
  block('gtn_zone', 'targets', {
    message0: '%1 的 %2',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', zoneOptions)],
    output: 'ZoneRef',
    inputsInline: true,
  }, (b, c) => ({ ref: c.field(b, 'ZONE', 'hand'), target: c.value(b, 'TARGET', 'source') }), '玩家区域。', 'ZoneRef'),
  block('gtn_card_current', 'targets', {
    message0: '当前卡牌',
    output: 'CardRef',
  }, () => 'current_card', '当前正在处理的卡牌。', 'CardRef'),
  block('gtn_card_chosen', 'targets', {
    message0: '所选卡牌',
    output: 'CardRef',
  }, () => 'chosen_card', 'UI 或选择窗口选择的卡牌。', 'CardRef'),
  block('gtn_card_by_id', 'targets', {
    message0: '卡牌 ID %1',
    args0: [fieldInput('CARD_ID', 'gtn:basic')],
    output: 'CardRef',
  }, b => ({ id: b.getFieldValue('CARD_ID') || 'gtn:basic' }), '按资源 ID 引用卡牌定义。', 'CardRef'),

  block('gtn_deal_damage', 'damage', {
    message0: '对 %1 造成 %2 点伤害',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'deal_damage', target: c.value(b, 'TARGET', 'target'), amount: c.value(b, 'AMOUNT', 0) }), '基础物理伤害。'),
  block('gtn_deal_damage_hits', 'damage', {
    message0: '对 %1 造成 %2 次 %3 点伤害',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('HITS'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'deal_damage', target: c.value(b, 'TARGET', 'target'), hits: c.value(b, 'HITS', 1), amount: c.value(b, 'AMOUNT', 0) }), '多段伤害。'),
  block('gtn_heal', 'damage', {
    message0: '回复 %1 %2 点生命',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'heal', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 0) }), '回复生命。'),
  block('gtn_modify_event_value', 'damage', {
    message0: '将当前伤害事件值 %1 %2',
    args0: [fieldDropdown('MODE', [['设为', 'set'], ['增加', 'add'], ['减少', 'sub'], ['乘以', 'mul'], ['除以', 'div']]), inputValue('VALUE')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'modify_event_value', mode: c.field(b, 'MODE', 'set'), value: c.value(b, 'VALUE', 0) }), '修改 hook 里的事件值。'),

  block('gtn_gain_e', 'resources', {
    message0: '使 %1 获得 %2 E',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'gain_e', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 0) }), '正数获得，负数失去。'),
  block('gtn_gain_m', 'resources', {
    message0: '使 %1 获得 %2 M',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'gain_m', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 0) }), '正数获得，负数失去。'),
  block('gtn_draw_cards', 'resources', {
    message0: '使 %1 抽 %2 张牌',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'draw_cards', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 1) }), '抽牌。'),

  block('gtn_add_status', 'statuses', {
    message0: '给 %1 添加状态 %2 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'add_status', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 1) }), '添加状态。'),
  block('gtn_remove_status', 'statuses', {
    message0: '移除 %1 的状态 %2 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'remove_status', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 1) }), '移除状态。'),
  block('gtn_set_status', 'statuses', {
    message0: '设置 %1 的状态 %2 为 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'set_status', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 0) }), '设置状态层数。'),

  block('gtn_move_card', 'zones', {
    message0: '移动卡牌 %1 到 %2 的 %3',
    args0: [inputValue('CARD', 'CardRef'), inputValue('OWNER', TARGET_CHECK), fieldDropdown('ZONE', zoneOptions)],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'move_card', card: c.value(b, 'CARD', 'current_card'), owner: c.value(b, 'OWNER', 'source'), to: c.field(b, 'ZONE', 'discard') }), '移动一张卡到指定区域。'),
  block('gtn_create_card', 'zones', {
    message0: '创建卡牌 %1 到 %2 的 %3',
    args0: [fieldInput('CARD_ID', 'gtn:basic'), inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', zoneOptions)],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'create_card', card_id: c.field(b, 'CARD_ID', 'gtn:basic'), target: c.value(b, 'TARGET', 'source'), to: c.field(b, 'ZONE', 'hand') }), '创建卡牌实例。'),

  block('gtn_destroy_equipment', 'equipment', {
    message0: '摧毁 %1 的装备 %2',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('EQUIPMENT', ['EquipmentRef', 'String'])],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'destroy_equipment', target: c.value(b, 'TARGET', 'target'), equipment: c.value(b, 'EQUIPMENT', 'first') }), '摧毁装备。'),
  block('gtn_equipment_current', 'equipment', {
    message0: '当前装备',
    output: 'EquipmentRef',
  }, () => 'current_equipment', '当前装备引用。', 'EquipmentRef'),

  block('gtn_add_tag', 'tags', {
    message0: '给卡牌 %1 添加标签 %2',
    args0: [inputValue('CARD', 'CardRef'), fieldInput('TAG', 'gtn:exile')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'add_tag', card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG') }), '添加标签。'),
  block('gtn_remove_tag', 'tags', {
    message0: '移除卡牌 %1 的标签 %2',
    args0: [inputValue('CARD', 'CardRef'), fieldInput('TAG', 'gtn:exile')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'remove_tag', card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG') }), '移除标签。'),

  block('gtn_set_var', 'variables', {
    message0: '设置临时变量 %1 为 %2',
    args0: [fieldInput('NAME', 'x'), inputValue('VALUE')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'set_var', name: c.field(b, 'NAME', 'x'), value: c.value(b, 'VALUE', 0) }), '设置事件临时变量。'),
  block('gtn_add_var', 'variables', {
    message0: '临时变量 %1 增加 %2',
    args0: [fieldInput('NAME', 'x'), inputValue('VALUE')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'add_var', name: c.field(b, 'NAME', 'x'), value: c.value(b, 'VALUE', 1) }), '增加事件临时变量。'),

  block('gtn_request_ui', 'ui', {
    message0: '请求 UI 组件 %1 保存为 %2 给 %3',
    args0: [fieldInput('COMPONENT', 'my_mod:choice_window'), fieldInput('SAVE_AS', 'ui_result'), inputValue('TARGET', TARGET_CHECK)],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'request_ui', component: c.field(b, 'COMPONENT'), save_as: c.field(b, 'SAVE_AS', 'ui_result'), target_player: c.value(b, 'TARGET', 'source') }), '暂停执行并请求受控 UI。'),
  block('gtn_confirm_ui', 'ui', {
    message0: '显示确认框 标题 %1 内容 %2 保存为 %3',
    args0: [fieldInput('TITLE', '确认'), fieldInput('TEXT', '是否继续？'), fieldInput('SAVE_AS', 'confirm_result')],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({
    op: 'request_ui',
    component: {
      id: 'inline:confirm',
      type: 'confirm',
      title_cn: c.field(b, 'TITLE', '确认'),
      controls: [{ id: 'text', type: 'text', text_cn: c.field(b, 'TEXT', '') }],
      buttons: [{ id: 'confirm', text_cn: '确认' }, { id: 'cancel', text_cn: '取消', role: 'cancel' }],
    },
    save_as: c.field(b, 'SAVE_AS', 'confirm_result'),
    target_player: 'source',
  }), '内联确认框。'),

  block('gtn_counter_cancel_card', 'counter', {
    message0: '取消当前卡牌效果',
    previousStatement: null,
    nextStatement: null,
  }, () => ({ op: 'cancel_current_card' }), '反制当前卡牌。'),
  block('gtn_counter_cancel_damage', 'counter', {
    message0: '取消当前伤害',
    previousStatement: null,
    nextStatement: null,
  }, () => ({ op: 'modify_event_value', mode: 'set', value: 0 }), '伤害事件置零。'),
  block('gtn_counter_half_damage', 'counter', {
    message0: '当前伤害减半',
    previousStatement: null,
    nextStatement: null,
  }, () => ({ op: 'modify_event_value', mode: 'set', value: { op: 'floor', value: { op: 'div', a: { op: 'event_value' }, b: 2 } } }), '伤害减半。'),

  block('gtn_log', 'log', {
    message0: '添加战斗日志 %1',
    args0: [fieldInput('TEXT', '模组效果触发')],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'log', message: c.field(b, 'TEXT', '') }), '追加战斗日志。'),
  block('gtn_hint', 'log', {
    message0: '显示提示给当前玩家 %1',
    args0: [fieldInput('TEXT', '提示')],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'show_hint', message: c.field(b, 'TEXT', '') }), '客户端提示。'),

  block('gtn_event_context', 'advanced', {
    message0: '事件上下文 %1',
    args0: [fieldInput('KEY', 'damage_tag')],
    output: VALUE_CHECK,
  }, b => ({ op: 'get', object: { op: 'var', name: 'event_context' }, key: b.getFieldValue('KEY') || '' }), '读取当前事件上下文。', 'ValueExpr'),
  block('gtn_unknown_step', 'internal', {
    message0: '未识别操作 %1',
    args0: [fieldInput('RAW', '{}')],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => {
    try {
      return JSON.parse(c.field(b, 'RAW', '{}'));
    } catch {
      return { op: 'unknown_step', raw: c.field(b, 'RAW', '{}') };
    }
  }, '内部兼容块，不显示在工具箱中。'),
];

const propTargetOptions = [
  ['自己', 'self'],
  ['当前目标', 'target'],
  ['敌方', 'enemy'],
  ['队友', 'teammate'],
  ['所有友方', 'friendly'],
  ['所有敌方', 'all_enemies'],
];

const playerPropOptions = [
  ['生命 H', 'health'],
  ['最大生命', 'max_health'],
  ['能量 E', 'elixir'],
  ['最大能量', 'max_elixir'],
  ['魔力 M', 'magic'],
  ['最大魔力', 'max_magic'],
  ['护甲 A', 'armor'],
  ['闪避', 'dodge'],
  ['手牌上限', 'hand_limit'],
  ['手牌上限加成', 'extra_hand_limit_bonus'],
];

const equipPropOptions = [
  ['已装备回合', 'turns_equipped'],
  ['耐久', 'durability'],
  ['每回合触发上限', 'trigger_limit_per_turn'],
  ['本回合已触发', 'triggered_this_turn'],
  ['效果目标', 'effect_target'],
  ['不可摧毁保护', 'destroy_protection'],
];

const cardOnlyZoneOptions = [
  ['手牌', 'hand'],
  ['抽牌堆', 'deck'],
  ['弃牌堆', 'discard'],
  ['放逐区', 'exile'],
];

function legacyStatementBlock(id, category, message0, args0, op, compileParams, docs = '') {
  return block(id, category, {
    message0,
    args0,
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op, ...(compileParams ? compileParams(b, c) : {}) }), docs);
}

function legacyValueBlock(id, category, message0, args0, compileToAst, docs = '', outputType = 'ValueExpr') {
  return block(id, category, {
    message0,
    args0,
    output: outputType,
    inputsInline: true,
  }, compileToAst, docs, outputType);
}

BLOCK_REGISTRY.push(
  block('gtn_target_extended', 'targets', {
    message0: '目标 %1',
    args0: [fieldDropdown('TARGET', [
      ['自己', 'source'],
      ['当前目标', 'target'],
      ['敌方', 'enemy'],
      ['队友', 'teammate'],
      ['所有友方', 'all_friendlies'],
      ['所有敌方', 'all_enemies'],
      ['所有玩家', 'all_players'],
      ['随机敌方', 'random_enemy'],
      ['随机玩家', 'random_player'],
    ])],
    output: 'PlayerRef',
  }, b => b.getFieldValue('TARGET') || 'source', '更完整的玩家目标选择器。', 'PlayerRef'),

  legacyValueBlock('gtn_value_player_var', 'values', '玩家 %1 的变量 %2',
    [inputValue('TARGET', TARGET_CHECK), fieldInput('NAME', '变量')],
    (b, c) => ({ op: 'player_var', target: c.value(b, 'TARGET', 'source'), name: c.field(b, 'NAME', '变量') }),
    '读取玩家变量。'),
  legacyValueBlock('gtn_value_global_var', 'values', '全局变量 %1',
    [fieldInput('NAME', '变量')],
    (b, c) => ({ op: 'global_var', name: c.field(b, 'NAME', '变量') }),
    '读取全局变量。'),
  legacyValueBlock('gtn_value_equipment_prop', 'values', '装备 %1 的 %2',
    [inputValue('EQUIPMENT', ['EquipmentRef', 'String']), fieldDropdown('PROP', equipPropOptions)],
    (b, c) => ({ op: 'equipment_prop', equipment: c.value(b, 'EQUIPMENT', 'current_equipment'), property: c.field(b, 'PROP', 'turns_equipped') }),
    '读取装备属性。'),
  legacyValueBlock('gtn_value_damage_amount', 'values', '当前伤害值', [],
    () => ({ op: 'damage_amount' }), '读取当前伤害事件中的伤害值。', 'Number'),
  legacyValueBlock('gtn_value_damage_source', 'values', '伤害来源玩家', [],
    () => ({ op: 'damage_source' }), '读取当前伤害来源玩家。', 'PlayerRef'),
  legacyValueBlock('gtn_value_hand_full', 'values', '%1 手牌是否已满',
    [inputValue('TARGET', TARGET_CHECK)],
    (b, c) => ({ op: 'hand_full', target: c.value(b, 'TARGET', 'source') }),
    '判断手牌是否达到上限。', 'Boolean'),
  legacyValueBlock('gtn_value_last_created_card', 'values', '上一张创建的卡牌',
    [],
    () => ({ op: 'last_created_card' }),
    '读取最近一次由效果创建或复制出的卡牌。', 'CardRef'),
  legacyValueBlock('gtn_value_selected_card_at', 'values', '所选卡牌第 %1 张',
    [inputValue('INDEX')],
    (b, c) => ({ op: 'selected_card_at', index: c.value(b, 'INDEX', 1) }),
    '读取当前选择窗口中第 N 张已选卡牌。', 'CardRef'),
  legacyValueBlock('gtn_value_selected_card_index', 'values', '当前所选卡牌序号',
    [],
    () => ({ op: 'selected_card_index' }),
    '在遍历所选卡牌时读取当前序号。', 'Number'),
  legacyValueBlock('gtn_value_selected_cards_count', 'values', '已选卡牌数量',
    [],
    () => ({ op: 'selected_cards_count' }),
    '读取当前选择窗口的已选卡牌数量。', 'Number'),
  legacyValueBlock('gtn_value_clamp', 'values', '限制 %1 在 %2 到 %3',
    [inputValue('VALUE'), inputValue('MIN'), inputValue('MAX')],
    (b, c) => ({ op: 'clamp', value: c.value(b, 'VALUE', 0), min: c.value(b, 'MIN', 0), max: c.value(b, 'MAX', 0) }),
    '把数值限制在区间内。', 'Number'),

  legacyStatementBlock('gtn_repeat_until', 'flow', '重复直到 %1 %2',
    [inputValue('COND', 'Boolean'), { type: 'input_statement', name: 'DO' }],
    'repeat_until',
    (b, c) => ({ condition: c.value(b, 'COND', false), body: c.statement(b, 'DO') }),
    '在条件成立前重复执行，运行时有安全上限。'),
  legacyStatementBlock('gtn_break', 'flow', '跳出循环', [], 'break', () => ({}), '跳出当前循环。'),
  legacyStatementBlock('gtn_continue', 'flow', '继续下一次循环', [], 'continue', () => ({}), '跳过本次循环剩余步骤。'),

  block('gtn_cond_has_status_named', 'conditions', {
    message0: '%1 拥有状态 %2',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'poison')],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: 'has_status_named', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS', 'poison') }), '判断状态是否存在。', 'Boolean'),
  block('gtn_cond_hand_full', 'conditions', {
    message0: '%1 手牌已满',
    args0: [inputValue('TARGET', TARGET_CHECK)],
    output: 'Boolean',
    inputsInline: true,
  }, (b, c) => ({ op: 'hand_full', target: c.value(b, 'TARGET', 'source') }), '判断手牌是否满。', 'Boolean'),

  legacyStatementBlock('gtn_direct_damage', 'damage', '对 %1 造成 %2 点直接伤害',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'direct_damage',
    (b, c) => ({ target: c.value(b, 'TARGET', 'target'), amount: c.value(b, 'AMOUNT', 1) }),
    '绕过攻击流程的直接伤害。'),
  legacyStatementBlock('gtn_lifesteal_damage', 'damage', '对 %1 造成 %2D 若造成伤害则回复 %3H',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT'), inputValue('HEAL')],
    'lifesteal_damage',
    (b, c) => ({ target: c.value(b, 'TARGET', 'target'), amount: c.value(b, 'AMOUNT', 8), heal: c.value(b, 'HEAL', 4) }),
    '吸血式攻击，可由通用判断组合替代，也保留为常用原子效果。'),
  legacyStatementBlock('gtn_triangle_damage', 'damage', '三角形伤害 对 %1 基础 %2 每层 +%3 上限 %4',
    [inputValue('TARGET', TARGET_CHECK), inputValue('BASE'), inputValue('PER'), inputValue('MAX')],
    'triangle_damage',
    (b, c) => ({ target: c.value(b, 'TARGET', 'target'), base: c.value(b, 'BASE', 6), per_stack: c.value(b, 'PER', 3), max_stacks: c.value(b, 'MAX', 4) }),
    '读取并增加三角形层数的原子组合。'),
  legacyStatementBlock('gtn_armor_op', 'damage', '护甲 %1 %2 %3',
    [fieldDropdown('OP', [['增加', 'add_armor'], ['减少', 'remove_armor'], ['设为', 'set_armor']]), inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'add_armor',
    (b, c) => ({ op: c.field(b, 'OP', 'add_armor'), target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 1) }),
    '修改护甲。'),

  legacyStatementBlock('gtn_named_status_op', 'statuses', '%1 %2 状态 %3 %4 层',
    [fieldDropdown('OP', [['添加', 'status_add_named'], ['移除', 'status_remove_named'], ['设为', 'set_status_named']]), inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'poison'), inputValue('AMOUNT')],
    'status_add_named',
    (b, c) => ({ op: c.field(b, 'OP', 'status_add_named'), target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS', 'poison'), amount: c.value(b, 'AMOUNT', 1) }),
    '按 ID 修改任意状态。'),
  legacyStatementBlock('gtn_clear_status_op', 'statuses', '清除 %1 的 %2',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('WHAT', [['正面状态', 'clear_buffs'], ['负面状态', 'clear_debuffs'], ['全部状态', 'clear_all_effects'], ['指定状态', 'clear_status']])],
    'clear_buffs',
    (b, c) => ({ op: c.field(b, 'WHAT', 'clear_buffs'), target: c.value(b, 'TARGET', 'target') }),
    '清除状态。'),

  legacyStatementBlock('gtn_pay_resource', 'resources', '支付 %1 %2',
    [inputValue('AMOUNT'), fieldDropdown('RES', [['E', 'cost_e'], ['M', 'cost_m']])],
    'cost_e',
    (b, c) => ({ op: c.field(b, 'RES', 'cost_e'), amount: c.value(b, 'AMOUNT', 1) }),
    '消耗资源。'),
  legacyStatementBlock('gtn_regen_modifier', 'resources', '修改 %1 的每回合 %2 回复 %3',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('RES', [['E', 'mod_e_regen'], ['M', 'mod_m_regen'], ['抽牌数', 'mod_draw']]), inputValue('AMOUNT')],
    'mod_e_regen',
    (b, c) => ({ op: c.field(b, 'RES', 'mod_e_regen'), target: c.value(b, 'TARGET', 'target'), amount: c.value(b, 'AMOUNT', 1) }),
    '修改回合开始回复或抽牌。'),
  legacyStatementBlock('gtn_set_health', 'resources', '设置 %1 的 H 为 %2',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'set_health',
    (b, c) => ({ target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 1) }),
    '直接设置玩家生命。'),
  legacyStatementBlock('gtn_aura_enemy_elixir_recovery', 'resources', '使 %1 的 E 回复修正 %2',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'aura_enemy_elixir_recovery',
    (b, c) => ({ target: c.value(b, 'TARGET', 'target'), amount: c.value(b, 'AMOUNT', -1) }),
    '装备光环式 E 回复修正。'),

  legacyStatementBlock('gtn_player_prop_set_add', 'variables', '玩家 %1 的 %2 %3 %4',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('PROP', playerPropOptions), fieldDropdown('MODE', [['设为', 'player_prop_set'], ['增加', 'player_prop_add']]), inputValue('VALUE')],
    'player_prop_set',
    (b, c) => ({ op: c.field(b, 'MODE', 'player_prop_set'), target: c.value(b, 'TARGET', 'source'), property: c.field(b, 'PROP', 'health'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0) }),
    '修改玩家属性，包括 H/E/M 上限和手牌上限。'),
  legacyStatementBlock('gtn_card_prop_set_add', 'variables', '卡牌 %1 的 %2 %3 %4',
    [inputValue('CARD', 'CardRef'), fieldDropdown('PROP', cardPropOptions), fieldDropdown('MODE', [['设为', 'card_prop_set'], ['增加', 'card_prop_add'], ['乘以', 'card_prop_mul']]), inputValue('VALUE')],
    'card_prop_set',
    (b, c) => ({ op: c.field(b, 'MODE', 'card_prop_set'), card: c.value(b, 'CARD', 'current_card'), property: c.field(b, 'PROP', 'fusion_level'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0), multiplier: c.value(b, 'VALUE', 1) }),
    '修改当前或所选卡牌属性，如 E/M、聚变、裂变、番茄层数。'),
  legacyStatementBlock('gtn_equipment_prop_set_add', 'equipment', '装备 %1 的 %2 %3 %4',
    [inputValue('EQUIPMENT', ['EquipmentRef', 'String']), fieldDropdown('PROP', equipPropOptions), fieldDropdown('MODE', [['设为', 'equipment_prop_set'], ['增加', 'equipment_prop_add']]), inputValue('VALUE')],
    'equipment_prop_set',
    (b, c) => ({ op: c.field(b, 'MODE', 'equipment_prop_set'), equipment: c.value(b, 'EQUIPMENT', 'current_equipment'), property: c.field(b, 'PROP', 'turns_equipped'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0) }),
    '修改装备属性。'),

  legacyStatementBlock('gtn_card_tag_op_named', 'tags', '卡牌 %1 %2 标签 %3',
    [inputValue('CARD', 'CardRef'), fieldDropdown('OP', [['添加', 'tag_add_named'], ['移除', 'tag_remove_named']]), fieldInput('TAG', 'exile')],
    'tag_add_named',
    (b, c) => ({ op: c.field(b, 'OP', 'tag_add_named'), card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG', 'exile') }),
    '添加或移除任意标签 ID。'),
  legacyStatementBlock('gtn_clear_tags', 'tags', '清除卡牌 %1 的全部标签',
    [inputValue('CARD', 'CardRef')],
    'clear_tags',
    (b, c) => ({ card: c.value(b, 'CARD', 'current_card') }),
    '清空当前实例的有效标签。'),

  legacyStatementBlock('gtn_fission_fusion', 'advanced', '%1 卡牌 %2 数值 %3',
    [fieldDropdown('OP', [['裂变层数增加', 'fission'], ['聚变/伤害倍率', 'fusion'], ['下次伤害乘以', 'multiply_next_damage'], ['下次费用减少', 'reduce_next_cost'], ['下次费用增加', 'increase_next_cost']]), inputValue('CARD', 'CardRef'), inputValue('AMOUNT')],
    'fission',
    (b, c) => ({ op: c.field(b, 'OP', 'fission'), card: c.value(b, 'CARD', 'current_card'), amount: c.value(b, 'AMOUNT', 1), multiplier: c.value(b, 'AMOUNT', 2) }),
    '通用卡牌一次性属性操作。'),
  legacyStatementBlock('gtn_move_current_zone', 'zones', '将当前卡牌移到 %1 的 %2',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions)],
    'move_to_discard',
    (b, c) => ({ op: `move_to_${c.field(b, 'ZONE', 'discard')}`, target: c.value(b, 'TARGET', 'source') }),
    '把当前卡移动到指定区域。'),
  legacyStatementBlock('gtn_give_card', 'zones', '给 %1 的 %2 加入卡牌 ID %3',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions), fieldInput('CARD_ID', 'Basic')],
    'give_card_to_hand',
    (b, c) => ({ op: `give_card_to_${c.field(b, 'ZONE', 'hand')}`, target: c.value(b, 'TARGET', 'source'), card_id: c.field(b, 'CARD_ID', 'Basic') }),
    '创建指定 ID 的卡并加入区域；不存在时运行时会给 Error。'),
  legacyStatementBlock('gtn_choose_from_zone', 'zones', '从 %1 的 %2 选择卡牌保存选择',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', [['抽牌堆', 'choose_from_deck'], ['弃牌堆', 'choose_from_discard'], ['放逐区', 'choose_from_exile']])],
    'choose_from_deck',
    (b, c) => ({ op: c.field(b, 'ZONE', 'choose_from_deck'), target: c.value(b, 'TARGET', 'source') }),
    '弹出受控选牌窗口。'),
  legacyStatementBlock('gtn_reveal_or_steal', 'zones', '%1 %2 的手牌',
    [fieldDropdown('OP', [['查看', 'reveal_enemy_hand'], ['拿取', 'steal_enemy_card']]), inputValue('TARGET', TARGET_CHECK)],
    'reveal_enemy_hand',
    (b, c) => ({ op: c.field(b, 'OP', 'reveal_enemy_hand'), target: c.value(b, 'TARGET', 'target') }),
    '查看或拿取目标手牌。'),
  legacyStatementBlock('gtn_discard_choice_then_draw', 'zones', '弃置所选手牌并抽 1 张', [],
    'discard_choice_then_draw', () => ({}), '染色体式效果。'),
  legacyStatementBlock('gtn_copy_choice_discount', 'zones', '复制所选手牌并使其 E -%1',
    [inputValue('DISCOUNT')],
    'copy_choice_with_discount',
    (b, c) => ({ discount_e: c.value(b, 'DISCOUNT', 1) }),
    '拟态式效果。'),
  legacyStatementBlock('gtn_request_card_choice', 'ui', '弹出选牌 %1 的 %2 区 类型 %3 最少 %4 最多 %5',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions.concat([['装备', 'equipment']])), fieldInput('CARD_TYPE', ''), inputValue('MIN'), inputValue('MAX')],
    'request_card',
    (b, c) => ({ target: c.value(b, 'TARGET', 'source'), zone: c.field(b, 'ZONE', 'hand'), card_type: c.field(b, 'CARD_TYPE', ''), min_count: c.value(b, 'MIN', 1), max_count: c.value(b, 'MAX', 1), choice_type: 'choose_card', cancellable: true }),
    '弹出受控卡牌选择窗口，结果可通过所选卡牌相关数值块读取。'),
  legacyStatementBlock('gtn_remove_specific_card', 'zones', '从 %1 的 %2 移除卡牌 %3',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions), inputValue('CARD', 'CardRef')],
    'remove_specific_card',
    (b, c) => ({ target: c.value(b, 'TARGET', 'source'), zone: c.field(b, 'ZONE', 'hand'), card: c.value(b, 'CARD', 'chosen_card') }),
    '从指定区域移除一张指定卡。'),
  legacyStatementBlock('gtn_copy_card', 'zones', '复制卡牌 %1 到手牌',
    [inputValue('CARD', 'CardRef')],
    'copy_card',
    (b, c) => ({ card: c.value(b, 'CARD', 'chosen_card') }),
    '复制指定卡牌到当前玩家手牌。'),

  legacyStatementBlock('gtn_place_as_equip', 'equipment', '将此牌装备到 %1 效果指向 %2',
    [inputValue('OWNER', TARGET_CHECK), inputValue('EFFECT_TARGET', TARGET_CHECK)],
    'place_as_equip',
    (b, c) => ({ target: c.value(b, 'OWNER', 'source'), effect_target: c.value(b, 'EFFECT_TARGET', 'source') }),
    '把当前牌作为装备加入装备区。'),
  legacyStatementBlock('gtn_add_equipment_to_zone', 'equipment', '给 %1 装备卡牌 ID %2',
    [inputValue('TARGET', TARGET_CHECK), fieldInput('CARD_ID', 'GoldenLeaf')],
    'add_equipment_to_zone',
    (b, c) => ({ target: c.value(b, 'TARGET', 'source'), card_id: c.field(b, 'CARD_ID', 'GoldenLeaf') }),
    '从任意 ID 创建装备。'),
  legacyStatementBlock('gtn_destroy_equipment_generic', 'equipment', '%1 %2 的装备',
    [fieldDropdown('OP', [['摧毁所选或第一件', 'destroy_equipment_choice_or_first'], ['随机摧毁', 'destroy_random_equip'], ['摧毁全部', 'destroy_all_equip'], ['摧毁全部可摧毁', 'destroy_all_destroyable_equipment'], ['摧毁自身装备', 'destroy_self_equipment']]), inputValue('TARGET', TARGET_CHECK)],
    'destroy_equipment_choice_or_first',
    (b, c) => ({ op: c.field(b, 'OP', 'destroy_equipment_choice_or_first'), target: c.value(b, 'TARGET', 'target') }),
    '装备摧毁通用操作。'),
  legacyStatementBlock('gtn_trigger_manual', 'equipment', '主动触发当前装备', [], 'trigger_manual', () => ({}), '触发装备的主动效果。'),
  legacyStatementBlock('gtn_equip_reduce_own_draw', 'equipment', '装备效果：自己每回合少抽 %1 张',
    [inputValue('AMOUNT')],
    'equip_reduce_own_draw',
    (b, c) => ({ amount: c.value(b, 'AMOUNT', 1) }),
    '装备在场时减少装备者自己的回合抽牌数。'),
  legacyStatementBlock('gtn_equipment_protection', 'counter', '保护当前装备不被摧毁', [], 'equip_protection', () => ({}), '反制装备摧毁。'),

  legacyStatementBlock('gtn_control_effect', 'counter', '%1 %2',
    [fieldDropdown('OP', [['无敌', 'invincible'], ['跳过回合', 'skip_turn'], ['禁止行动', 'block_action'], ['强制结束回合', 'force_end_turn']]), inputValue('TARGET', TARGET_CHECK)],
    'invincible',
    (b, c) => ({ op: c.field(b, 'OP', 'invincible'), target: c.value(b, 'TARGET', 'target') }),
    '行动控制类效果。'),
  legacyStatementBlock('gtn_honey_control', 'counter', '蜂蜜控制 %1 持续 %2 回合',
    [inputValue('TARGET', TARGET_CHECK), inputValue('DURATION')],
    'honey_control',
    (b, c) => ({ target: c.value(b, 'TARGET', 'target'), duration: c.value(b, 'DURATION', 1) }),
    '强制目标下回合从左到右自动打出可支付的攻击牌；没有可打出的攻击牌时自动结束回合。'),
  legacyStatementBlock('gtn_response_declare', 'counter', '声明反制窗口 类型 %1 目标 %2',
    [fieldDropdown('TRIGGER', [['攻击', 'attack'], ['回复H', 'heal'], ['装备摧毁', 'destroy_equipment'], ['任意', 'any']]), inputValue('TARGET', TARGET_CHECK)],
    'response_declare',
    (b, c) => ({ trigger: c.field(b, 'TRIGGER', 'attack'), target: c.value(b, 'TARGET', 'source') }),
    '把本牌加入反制窗口。'),

  legacyStatementBlock('gtn_var_target_set_add', 'variables', '%1 的变量 %2 %3 %4',
    [fieldDropdown('TARGET', propTargetOptions), fieldInput('NAME', '变量'), fieldDropdown('MODE', [['设为', 'var_set'], ['增加', 'var_add'], ['减少', 'var_sub'], ['乘以', 'var_mul'], ['除以', 'var_div']]), inputValue('VALUE')],
    'var_set',
    (b, c) => ({ op: c.field(b, 'MODE', 'var_set'), target: c.field(b, 'TARGET', 'self'), name: c.field(b, 'NAME', '变量'), value: c.value(b, 'VALUE', 0) }),
    '玩家/队伍/全局变量操作。'),
  legacyStatementBlock('gtn_list_op', 'variables', '列表 %1 %2 %3',
    [fieldInput('NAME', '列表'), fieldDropdown('OP', [['设为', 'list_set'], ['追加', 'list_append'], ['清空', 'list_clear']]), inputValue('VALUE')],
    'list_set',
    (b, c) => ({ op: c.field(b, 'OP', 'list_set'), name: c.field(b, 'NAME', '列表'), list: c.value(b, 'VALUE', []), item: c.value(b, 'VALUE', 0) }),
    '列表操作，用于批量保存卡牌、目标或变量。'),
  legacyStatementBlock('gtn_for_each_list', 'flow', '遍历列表 %1 每项为 %2 %3',
    [inputValue('LIST'), fieldInput('NAME', 'item'), { type: 'input_statement', name: 'DO' }],
    'for_each_list',
    (b, c) => ({ list: c.value(b, 'LIST', []), name: c.field(b, 'NAME', 'item'), body: c.statement(b, 'DO') }),
    '遍历列表。'),
  legacyStatementBlock('gtn_for_each_selected_card', 'flow', '遍历已选卡牌 %1',
    [{ type: 'input_statement', name: 'DO' }],
    'for_each_selected_card',
    (b, c) => {
      const steps = c.statement(b, 'DO');
      return { steps, body: steps };
    },
    '遍历最近一次卡牌选择窗口中选中的卡牌。'),
  legacyStatementBlock('gtn_timed_effect', 'advanced', '持续 %1 回合 触发 %2 执行 %3',
    [inputValue('DURATION'), fieldDropdown('TRIGGER', [['目标回合开始', 'target_turn_start'], ['装备者回合开始', 'owner_turn_start'], ['友方回合开始', 'friendly_turn_start'], ['敌方回合开始', 'enemy_turn_start'], ['任意回合开始', 'any_turn_start']]), { type: 'input_statement', name: 'DO' }],
    'timed_effect',
    (b, c) => ({ duration: c.value(b, 'DURATION', 1), trigger: c.field(b, 'TRIGGER', 'target_turn_start'), body: c.statement(b, 'DO') }),
    '持续时间分区：把一组效果登记为未来回合触发。'),
);

export function registerV2Blocks() {
  const blocks = [EVENT_HEAD_BLOCK, ...BLOCK_REGISTRY.map(item => item.json)];
  Blockly.defineBlocksWithJsonArray(blocks);
}

export function makeV2Toolbox() {
  const contents = BLOCK_CATEGORIES.map(category => {
    const blocks = BLOCK_REGISTRY
      .filter(blockDef => blockDef.category === category.id);
    return {
      kind: 'category',
      name: category.name,
      colour: category.colour,
      contents: blocks
      .map(blockDef => {
        const entry = { kind: 'block', type: blockDef.id };
        if (blockDef.id === 'gtn_deal_damage') {
          entry.inputs = { TARGET: shadowTarget('target'), AMOUNT: shadowNumber(6) };
        } else if (blockDef.id === 'gtn_deal_damage_hits') {
          entry.inputs = { TARGET: shadowTarget('target'), HITS: shadowNumber(2), AMOUNT: shadowNumber(3) };
        } else if (blockDef.id === 'gtn_heal') {
          entry.inputs = { TARGET: shadowTarget('source'), AMOUNT: shadowNumber(4) };
        } else if (blockDef.id === 'gtn_gain_e' || blockDef.id === 'gtn_gain_m') {
          entry.inputs = { TARGET: shadowTarget('source'), AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_draw_cards') {
          entry.inputs = { TARGET: shadowTarget('source'), AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_add_status' || blockDef.id === 'gtn_remove_status' || blockDef.id === 'gtn_set_status') {
          entry.inputs = { TARGET: shadowTarget('target'), AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_set_var' || blockDef.id === 'gtn_add_var') {
          entry.inputs = { VALUE: shadowNumber(1) };
        } else if (['gtn_direct_damage', 'gtn_armor_op', 'gtn_named_status_op', 'gtn_regen_modifier', 'gtn_set_health', 'gtn_aura_enemy_elixir_recovery'].includes(blockDef.id)) {
          entry.inputs = { TARGET: shadowTarget('target'), AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_lifesteal_damage') {
          entry.inputs = { TARGET: shadowTarget('target'), AMOUNT: shadowNumber(8), HEAL: shadowNumber(4) };
        } else if (blockDef.id === 'gtn_triangle_damage') {
          entry.inputs = { TARGET: shadowTarget('target'), BASE: shadowNumber(6), PER: shadowNumber(3), MAX: shadowNumber(4) };
        } else if (blockDef.id === 'gtn_pay_resource') {
          entry.inputs = { AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_player_prop_set_add') {
          entry.inputs = { TARGET: shadowTarget('source'), VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_card_prop_set_add') {
          entry.inputs = { CARD: { block: { type: 'gtn_card_current' } }, VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_equipment_prop_set_add') {
          entry.inputs = { EQUIPMENT: { block: { type: 'gtn_equipment_current' } }, VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_var_target_set_add') {
          entry.inputs = { VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_fission_fusion') {
          entry.inputs = { CARD: { block: { type: 'gtn_card_current' } }, AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_move_current_zone' || blockDef.id === 'gtn_give_card') {
          entry.inputs = { TARGET: shadowTarget('source') };
        } else if (['gtn_reveal_or_steal', 'gtn_choose_from_zone', 'gtn_destroy_equipment_generic', 'gtn_control_effect'].includes(blockDef.id)) {
          entry.inputs = { TARGET: shadowTarget('target') };
        } else if (blockDef.id === 'gtn_request_card_choice') {
          entry.inputs = { TARGET: shadowTarget('source'), MIN: shadowNumber(1), MAX: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_remove_specific_card') {
          entry.inputs = { TARGET: shadowTarget('source'), CARD: { block: { type: 'gtn_card_chosen' } } };
        } else if (blockDef.id === 'gtn_copy_card') {
          entry.inputs = { CARD: { block: { type: 'gtn_card_chosen' } } };
        } else if (blockDef.id === 'gtn_place_as_equip') {
          entry.inputs = { OWNER: shadowTarget('source'), EFFECT_TARGET: shadowTarget('source') };
        } else if (blockDef.id === 'gtn_add_equipment_to_zone' || blockDef.id === 'gtn_response_declare') {
          entry.inputs = { TARGET: shadowTarget('source') };
        } else if (blockDef.id === 'gtn_equip_reduce_own_draw') {
          entry.inputs = { AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_timed_effect') {
          entry.inputs = { DURATION: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_value_selected_card_at') {
          entry.inputs = { INDEX: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_value_clamp') {
          entry.inputs = { VALUE: shadowNumber(0), MIN: shadowNumber(0), MAX: shadowNumber(10) };
        } else if (blockDef.id === 'gtn_log') {
          entry.inputs = { TEXT: shadowText('模组效果触发') };
        }
        return entry;
      }),
    };
  }).filter(category => category.contents.length > 0);
  contents.push({ kind: 'sep' });
  contents.push({ kind: 'category', name: '函数', custom: 'PROCEDURE', colour: 285 });
  return { kind: 'categoryToolbox', contents };
}

export function workspaceToSteps(workspace) {
  const compiler = makeCompiler();
  const steps = [];
  const tops = workspace.getTopBlocks(true);
  for (const top of tops) {
    if (top.outputConnection) continue;
    if (top.type === 'gtn_event_head') {
      steps.push(...compiler.statement(top, 'DO'));
      continue;
    }
    steps.push(...compiler.chain(top));
  }
  return steps.filter(Boolean);
}

export function workspaceToJson(workspace) {
  return Blockly.serialization.workspaces.save(workspace);
}

export function stepsToWorkspaceJson(steps, triggerLabel = '当事件触发时') {
  const head = blockJson('gtn_event_head', {
    DO: statementInputToBlocks(steps),
  }, {
    LABEL: triggerLabel,
  });
  head.x = 28;
  head.y = 24;
  return { blocks: { languageVersion: 0, blocks: [head] } };
}

export function loadWorkspaceJson(workspace, data) {
  workspace.clear();
  if (data && typeof data === 'object') {
    Blockly.serialization.workspaces.load(data, workspace);
  }
}

function makeCompiler() {
  const byId = new Map(BLOCK_REGISTRY.map(item => [item.id, item]));
  const compiler = {
    field(block, name, fallback = '') {
      const value = block.getFieldValue(name);
      return value === null || value === undefined || value === '' ? fallback : value;
    },
    value(block, name, fallback = null) {
      const child = block.getInputTargetBlock(name);
      if (!child) return fallback;
      return compiler.block(child);
    },
    statement(block, name) {
      return compiler.chain(block.getInputTargetBlock(name));
    },
    chain(start) {
      const out = [];
      let block = start;
      while (block) {
        const compiled = compiler.block(block);
        if (Array.isArray(compiled)) out.push(...compiled);
        else if (compiled !== null && compiled !== undefined) out.push(compiled);
        block = block.getNextBlock();
      }
      return out;
    },
    block(block) {
      const def = byId.get(block.type);
      if (!def) return { op: 'unknown_block', block_type: block.type };
      return def.compile_to_ast(block, compiler);
    },
  };
  return compiler;
}

function astStepToBlock(step) {
  if (!step || typeof step !== 'object') return blockJson('gtn_unknown_step', {}, { RAW: JSON.stringify(step ?? null) });
  const op = step.op || step.type;
  if (op === 'deal_damage') {
    const hits = step.hits ?? step.count ?? step.times;
    const hasMultiHits = hits !== undefined && (typeof hits === 'object' || Number(hits) !== 1);
    if (hasMultiHits) {
      return blockJson('gtn_deal_damage_hits', {
        TARGET: valueInputToBlock(step.target, 'target'),
        HITS: valueInputToBlock(hits, 1),
        AMOUNT: valueInputToBlock(step.amount, 0),
      });
    }
    return blockJson('gtn_deal_damage', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 0),
    });
  }
  if (op === 'heal') {
    return blockJson('gtn_heal', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 0),
    });
  }
  if (op === 'draw_cards') {
    return blockJson('gtn_draw_cards', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, step.count ?? 1),
    });
  }
  if (op === 'gain_e') {
    return blockJson('gtn_gain_e', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 0),
    });
  }
  if (op === 'gain_m') {
    return blockJson('gtn_gain_m', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 0),
    });
  }
  if (op === 'add_status' || op === 'remove_status' || op === 'set_status') {
    return blockJson({
      add_status: 'gtn_add_status',
      remove_status: 'gtn_remove_status',
      set_status: 'gtn_set_status',
    }[op], {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount ?? step.stack, 1),
    }, {
      STATUS: String(step.status || step.id || 'gtn:poison'),
    });
  }
  if (op === 'move_card') {
    return blockJson('gtn_move_card', {
      CARD: valueInputToBlock(step.card, 'current_card'),
      OWNER: valueInputToBlock(step.owner, 'source'),
    }, { ZONE: String(step.to || step.zone || 'discard') });
  }
  if (op === 'create_card') {
    return blockJson('gtn_create_card', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, {
      CARD_ID: String(step.card_id || step.id || 'gtn:basic'),
      ZONE: String(step.to || step.zone || 'hand'),
    });
  }
  if (op === 'destroy_equipment') {
    return blockJson('gtn_destroy_equipment', {
      TARGET: valueInputToBlock(step.target, 'target'),
      EQUIPMENT: valueInputToBlock(step.equipment || 'first', 'first'),
    });
  }
  if (op === 'if') {
    return blockJson('gtn_if_else', {
      COND: valueInputToBlock(step.condition || step.cond, false),
      THEN: statementInputToBlocks(step.then || []),
      ELSE: statementInputToBlocks(step.else || []),
    });
  }
  if (op === 'for_each') {
    return blockJson('gtn_for_each_target', {
      TARGETS: valueInputToBlock(step.items || step.targets || step.list || 'all_players', 'all_players'),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { VAR: String(step.as || step.var || 'target') });
  }
  if (op === 'repeat_until') {
    return blockJson('gtn_repeat_until', {
      COND: valueInputToBlock(step.condition || step.cond, false),
      DO: statementInputToBlocks(step.steps || step.body || []),
    });
  }
  if (op === 'break') return blockJson('gtn_break');
  if (op === 'continue') return blockJson('gtn_continue');
  if (op === 'direct_damage') {
    return blockJson('gtn_direct_damage', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    });
  }
  if (op === 'lifesteal_damage') {
    return blockJson('gtn_lifesteal_damage', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 8),
      HEAL: valueInputToBlock(step.heal, 4),
    });
  }
  if (op === 'triangle_damage') {
    return blockJson('gtn_triangle_damage', {
      TARGET: valueInputToBlock(step.target, 'target'),
      BASE: valueInputToBlock(step.base, 6),
      PER: valueInputToBlock(step.per_stack, 3),
      MAX: valueInputToBlock(step.max_stacks, 4),
    });
  }
  if (['add_armor', 'remove_armor', 'set_armor'].includes(op)) {
    return blockJson('gtn_armor_op', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { OP: op });
  }
  if (['status_add_named', 'status_remove_named', 'set_status_named'].includes(op)) {
    return blockJson('gtn_named_status_op', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { OP: op, STATUS: String(step.status || step.id || step.name || 'poison') });
  }
  if (['clear_buffs', 'clear_debuffs', 'clear_all_effects', 'clear_status'].includes(op)) {
    return blockJson('gtn_clear_status_op', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { WHAT: op });
  }
  if (['cost_e', 'cost_m'].includes(op)) {
    return blockJson('gtn_pay_resource', {
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { RES: op });
  }
  if (['mod_e_regen', 'mod_m_regen', 'mod_draw'].includes(op)) {
    return blockJson('gtn_regen_modifier', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { RES: op });
  }
  if (op === 'set_health') {
    return blockJson('gtn_set_health', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    });
  }
  if (op === 'aura_enemy_elixir_recovery') {
    return blockJson('gtn_aura_enemy_elixir_recovery', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, -1),
    });
  }
  if (['player_prop_set', 'player_prop_add'].includes(op)) {
    return blockJson('gtn_player_prop_set_add', {
      TARGET: valueInputToBlock(step.target, 'source'),
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { PROP: String(step.property || 'health'), MODE: op });
  }
  if (['card_prop_set', 'card_prop_add', 'card_prop_mul'].includes(op)) {
    return blockJson('gtn_card_prop_set_add', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
      VALUE: valueInputToBlock(step.value ?? step.amount ?? step.multiplier, 0),
    }, { PROP: String(step.property || 'fusion_level'), MODE: op });
  }
  if (['equipment_prop_set', 'equipment_prop_add'].includes(op)) {
    return blockJson('gtn_equipment_prop_set_add', {
      EQUIPMENT: valueInputToBlock(step.equipment || 'current_equipment', 'current_equipment'),
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { PROP: String(step.property || 'turns_equipped'), MODE: op });
  }
  if (['tag_add_named', 'tag_remove_named'].includes(op)) {
    return blockJson('gtn_card_tag_op_named', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
    }, { OP: op, TAG: String(step.tag || step.flag || 'exile') });
  }
  if (op === 'clear_tags') {
    return blockJson('gtn_clear_tags', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
    });
  }
  if (['fission', 'fusion', 'multiply_next_damage', 'reduce_next_cost', 'increase_next_cost'].includes(op)) {
    return blockJson('gtn_fission_fusion', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
      AMOUNT: valueInputToBlock(step.amount ?? step.multiplier, 1),
    }, { OP: op });
  }
  if (['move_to_hand', 'move_to_deck', 'move_to_discard', 'move_to_exile'].includes(op)) {
    return blockJson('gtn_move_current_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op.replace('move_to_', '') });
  }
  if (['give_card_to_hand', 'give_card_to_deck', 'give_card_to_discard', 'give_card_to_exile'].includes(op)) {
    return blockJson('gtn_give_card', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op.replace('give_card_to_', ''), CARD_ID: String(step.card_id || step.id || 'Basic') });
  }
  if (['choose_from_deck', 'choose_from_discard', 'choose_from_exile'].includes(op)) {
    return blockJson('gtn_choose_from_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op });
  }
  if (['reveal_enemy_hand', 'steal_enemy_card'].includes(op)) {
    return blockJson('gtn_reveal_or_steal', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: op });
  }
  if (op === 'discard_choice_then_draw') return blockJson('gtn_discard_choice_then_draw');
  if (op === 'copy_choice_with_discount') {
    return blockJson('gtn_copy_choice_discount', { DISCOUNT: valueInputToBlock(step.discount_e, 1) });
  }
  if (op === 'request_card') {
    return blockJson('gtn_request_card_choice', {
      TARGET: valueInputToBlock(step.target, 'source'),
      MIN: valueInputToBlock(step.min_count, 1),
      MAX: valueInputToBlock(step.max_count, 1),
    }, {
      ZONE: String(step.zone || 'hand'),
      CARD_TYPE: String(step.card_type || ''),
    });
  }
  if (op === 'remove_specific_card') {
    return blockJson('gtn_remove_specific_card', {
      TARGET: valueInputToBlock(step.target, 'source'),
      CARD: valueInputToBlock(step.card, 'chosen_card'),
    }, { ZONE: String(step.zone || 'hand') });
  }
  if (op === 'copy_card') {
    return blockJson('gtn_copy_card', {
      CARD: valueInputToBlock(step.card, 'chosen_card'),
    });
  }
  if (op === 'place_as_equip') {
    return blockJson('gtn_place_as_equip', {
      OWNER: valueInputToBlock(step.target, 'source'),
      EFFECT_TARGET: valueInputToBlock(step.effect_target, 'source'),
    });
  }
  if (op === 'add_equipment_to_zone') {
    return blockJson('gtn_add_equipment_to_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { CARD_ID: String(step.card_id || step.id || 'GoldenLeaf') });
  }
  if (['destroy_equipment_choice_or_first', 'destroy_random_equip', 'destroy_all_equip', 'destroy_all_destroyable_equipment', 'destroy_self_equipment'].includes(op)) {
    return blockJson('gtn_destroy_equipment_generic', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: op });
  }
  if (op === 'trigger_manual') return blockJson('gtn_trigger_manual');
  if (op === 'equip_reduce_own_draw') {
    return blockJson('gtn_equip_reduce_own_draw', {
      AMOUNT: valueInputToBlock(step.amount, 1),
    });
  }
  if (op === 'equip_protection') return blockJson('gtn_equipment_protection');
  if (['invincible', 'skip_turn', 'block_action', 'force_end_turn'].includes(op)) {
    return blockJson('gtn_control_effect', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: op });
  }
  if (op === 'response_declare') {
    return blockJson('gtn_response_declare', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { TRIGGER: String(step.trigger || 'attack') });
  }
  if (op === 'set_var') {
    return blockJson('gtn_set_var', { VALUE: valueInputToBlock(step.value, 0) }, { NAME: String(step.name || 'x') });
  }
  if (op === 'add_var') {
    return blockJson('gtn_add_var', { VALUE: valueInputToBlock(step.value, 1) }, { NAME: String(step.name || 'x') });
  }
  if (['var_set', 'var_add', 'var_sub', 'var_mul', 'var_div'].includes(op)) {
    return blockJson('gtn_var_target_set_add', {
      VALUE: valueInputToBlock(step.value, 0),
    }, { TARGET: String(step.target || 'self'), NAME: String(step.name || '变量'), MODE: op });
  }
  if (['list_set', 'list_append', 'list_clear'].includes(op)) {
    return blockJson('gtn_list_op', {
      VALUE: valueInputToBlock(step.list ?? step.item, []),
    }, { NAME: String(step.name || '列表'), OP: op });
  }
  if (op === 'for_each_list') {
    return blockJson('gtn_for_each_list', {
      LIST: valueInputToBlock(step.list, []),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { NAME: String(step.name || 'item') });
  }
  if (op === 'for_each_selected_card') {
    return blockJson('gtn_for_each_selected_card', {
      DO: statementInputToBlocks(step.steps || step.body || []),
    });
  }
  if (op === 'timed_effect') {
    return blockJson('gtn_timed_effect', {
      DURATION: valueInputToBlock(step.duration, 1),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { TRIGGER: String(step.trigger || 'target_turn_start') });
  }
  if (op === 'log') {
    return blockJson('gtn_log', {}, { TEXT: String(step.message || step.text || '') });
  }
  if (op === 'request_ui') {
    return blockJson('gtn_request_ui', {
      TARGET: valueInputToBlock(step.target_player || 'source', 'source'),
    }, {
      COMPONENT: typeof step.component === 'string' ? step.component : String(step.component?.id || 'my_mod:window'),
      SAVE_AS: String(step.save_as || 'ui_result'),
    });
  }
  if (op === 'modify_event_value') {
    return blockJson('gtn_modify_event_value', {
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { MODE: String(step.mode || step.operator || 'set') });
  }
  if (op === 'cancel_current_card') return blockJson('gtn_counter_cancel_card');
  if (op === 'stop') return blockJson('gtn_stop');
  return blockJson('gtn_unknown_step', {}, { RAW: JSON.stringify(step) });
}

function astValueToBlock(value) {
  if (typeof value === 'number') return blockJson('gtn_number', {}, { NUM: String(value) });
  if (typeof value === 'boolean') return blockJson('logic_boolean', {}, { BOOL: value ? 'TRUE' : 'FALSE' });
  if (typeof value === 'string') {
    if (['source', 'self', 'target', 'enemy', 'all_players', 'all_enemies', 'chosen_player'].includes(value)) {
      return blockJson('gtn_target', {}, { TARGET: value === 'self' ? 'source' : value });
    }
    if (['teammate', 'all_friendlies', 'friendly', 'random_enemy', 'random_player'].includes(value)) {
      return blockJson('gtn_target_extended', {}, { TARGET: value });
    }
    if (value === 'current_card') return blockJson('gtn_card_current');
    if (value === 'chosen_card') return blockJson('gtn_card_chosen');
    return blockJson('gtn_text', {}, { TEXT: value });
  }
  if (!value || typeof value !== 'object') return blockJson('gtn_number', {}, { NUM: '0' });
  const op = value.op || value.ref || value.type;
  if (op === 'const' || op === 'literal') return astValueToBlock(value.value ?? value.const);
  if (op === 'var') return blockJson('gtn_value_var', {}, { NAME: String(value.name || value.var || 'x') });
  if (op === 'player_var') {
    return blockJson('gtn_value_player_var', {
      TARGET: valueInputToBlock(value.target || 'source', 'source'),
    }, { NAME: String(value.name || '变量') });
  }
  if (op === 'global_var') return blockJson('gtn_value_global_var', {}, { NAME: String(value.name || '变量') });
  if (op === 'player_stat') {
    return blockJson('gtn_value_player_stat', {
      TARGET: valueInputToBlock(value.target || value.player || 'source', 'source'),
    }, { STAT: String(value.stat || value.property || value.field || 'health') });
  }
  if (op === 'status_stack') {
    return blockJson('gtn_value_status_stack', {
      TARGET: valueInputToBlock(value.target || 'target', 'target'),
    }, { STATUS: String(value.status || 'gtn:poison') });
  }
  if (op === 'card_prop' || op === 'card_property') {
    return blockJson('gtn_value_card_prop', {
      CARD: valueInputToBlock(value.card || 'current_card', 'current_card'),
    }, { PROP: String(value.property || value.prop || value.field || 'id') });
  }
  if (op === 'equipment_prop' || op === 'equipment_property') {
    return blockJson('gtn_value_equipment_prop', {
      EQUIPMENT: valueInputToBlock(value.equipment || 'current_equipment', 'current_equipment'),
    }, { PROP: String(value.property || value.prop || value.field || 'turns_equipped') });
  }
  if (op === 'last_damage') return blockJson('gtn_value_last_damage');
  if (op === 'last_created_card') return blockJson('gtn_value_last_created_card');
  if (op === 'selected_card_at') {
    return blockJson('gtn_value_selected_card_at', {
      INDEX: valueInputToBlock(value.index, 1),
    });
  }
  if (op === 'selected_card_index') return blockJson('gtn_value_selected_card_index');
  if (op === 'selected_cards_count') return blockJson('gtn_value_selected_cards_count');
  if (op === 'event_value') return blockJson('gtn_value_event_value');
  if (op === 'damage_amount' || op === 'current_damage') return blockJson('gtn_value_damage_amount');
  if (op === 'damage_source') return blockJson('gtn_value_damage_source');
  if (op === 'hand_full') {
    return blockJson('gtn_value_hand_full', {
      TARGET: valueInputToBlock(value.target || 'source', 'source'),
    });
  }
  if (['add', 'sub', 'mul', 'div', 'min', 'max'].includes(op)) {
    return blockJson('gtn_value_math', {
      A: valueInputToBlock(value.a ?? value.values?.[0], 0),
      B: valueInputToBlock(value.b ?? value.values?.[1], 0),
    }, { OP: op });
  }
  if (op === 'floor' || op === 'ceil') {
    return blockJson('gtn_value_round', {
      VALUE: valueInputToBlock(value.value, 0),
    }, { OP: op });
  }
  if (op === 'clamp') {
    return blockJson('gtn_value_clamp', {
      VALUE: valueInputToBlock(value.value, 0),
      MIN: valueInputToBlock(value.min, 0),
      MAX: valueInputToBlock(value.max, 0),
    });
  }
  if (op === 'compare') {
    return blockJson('gtn_cond_compare', {
      A: valueInputToBlock(value.a, 0),
      B: valueInputToBlock(value.b, 0),
    }, { OP: String(value.operator || '==') });
  }
  if (op === 'and' || op === 'or') {
    return blockJson('gtn_cond_and_or', {
      A: valueInputToBlock(value.conditions?.[0] ?? value.values?.[0], false),
      B: valueInputToBlock(value.conditions?.[1] ?? value.values?.[1], false),
    }, { OP: op });
  }
  if (op === 'not') {
    return blockJson('gtn_cond_not', { VALUE: valueInputToBlock(value.condition || value.value, false) });
  }
  if (op === 'card_has_tag') {
    return blockJson('gtn_cond_card_has_tag', {
      CARD: valueInputToBlock(value.card || 'current_card', 'current_card'),
    }, { TAG: String(value.tag || value.id || '') });
  }
  if (op === 'has_status_named' || op === 'has_status') {
    return blockJson('gtn_cond_has_status_named', {
      TARGET: valueInputToBlock(value.target || 'target', 'target'),
    }, { STATUS: String(value.status || value.id || value.name || 'poison') });
  }
  if (['hand', 'deck', 'discard', 'exile', 'equipment'].includes(op)) {
    return blockJson('gtn_zone', {
      TARGET: valueInputToBlock(value.target || 'source', 'source'),
    }, { ZONE: op });
  }
  return blockJson('gtn_text', {}, { TEXT: JSON.stringify(value) });
}

function valueInputToBlock(value, fallback) {
  const block = astValueToBlock(value === undefined ? fallback : value);
  return { block };
}

function statementInputToBlocks(steps) {
  const blocks = (Array.isArray(steps) ? steps : []).map(astStepToBlock).filter(Boolean);
  if (!blocks.length) return undefined;
  for (let i = 0; i < blocks.length - 1; i += 1) {
    blocks[i].next = { block: blocks[i + 1] };
  }
  return { block: blocks[0] };
}

function blockJson(typeOrBlock, inputs = {}, fields = {}) {
  const out = typeof typeOrBlock === 'string' ? { type: typeOrBlock } : { ...typeOrBlock };
  if (Object.keys(fields).length) out.fields = fields;
  const realInputs = Object.fromEntries(Object.entries(inputs).filter(([, value]) => value !== undefined));
  if (Object.keys(realInputs).length) out.inputs = realInputs;
  return out;
}

export function blockDocsFor(type) {
  return BLOCK_REGISTRY.find(item => item.id === type)?.docs || '';
}

export { hookOptions };
