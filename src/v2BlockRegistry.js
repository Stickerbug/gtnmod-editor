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

/* Round 46 / 批次 AJ：通用选择器 ``zone_card`` 的 ``pick.by`` 下拉——
   值写运行时属性名（与 game_engine._zone_card_pick_value 一张表）。 */
const zoneCardPickOptions = [
  ['E费用', 'cost_e'],
  ['M费用', 'cost_m'],
  ['伤害', 'power_value'],
  ['裂变层数', 'fission_level'],
  ['聚变层数', 'fusion_level'],
  ['迅捷值', 'swift_value'],
  ['暂时迅捷值', 'temp_swift_value'],
  ['沉重值', 'heavy_value'],
  ['暂时沉重值', 'temp_heavy_value'],
  ['电荷', 'charge_value'],
  ['耐久', 'durability'],
  ['攻击段数', 'hits'],
  ['额外命中', 'extra_hits'],
];

/* 区域选牌能顺带过滤的牌型（写进 filter.card_type；'任意' = 不写这一条）。 */
const zoneCardTypeOptions = [
  ['任意牌型', 'any'],
  ['攻击牌', 'thorn'],
  ['技能牌', 'bloom'],
  ['守护牌', 'guard'],
  ['根须牌', 'root'],
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
  }, (b, c) => ({ op: 'if_else', condition: c.value(b, 'COND', false), then: c.statement(b, 'THEN') }), '条件成立时执行。'),
  block('gtn_if_else', 'flow', {
    message0: '如果 %1 那么 %2 否则 %3',
    args0: [
      inputValue('COND', 'Boolean'),
      { type: 'input_statement', name: 'THEN' },
      { type: 'input_statement', name: 'ELSE' },
    ],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({ op: 'if_else', condition: c.value(b, 'COND', false), then: c.statement(b, 'THEN'), else: c.statement(b, 'ELSE') }), '条件分支。'),
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

  /* Round 46 / 批次 AJ：``{"ref":"<名字>"}``——复用"区域选牌"块里
     "记住为"的那张牌（同一个名字第二次解析拿到同一张牌，不会重新抽）。 */
  block('gtn_card_named_ref', 'targets', {
    message0: '刚才记住的牌 %1',
    args0: [fieldInput('NAME', '')],
    output: 'CardRef',
  }, b => ({ ref: String(b.getFieldValue('NAME') || '') }), '复用区域选牌块绑定的那张牌（名字要和"记住为"一致）。', 'CardRef'),

  /* Round 46 / 批次 AJ：通用选择器 ``zone_card``——"按属性取极值的区域选牌"。
     它写出卡数据里的 {"selector":"zone_card",…}，输出类型是 CardRef，
     所以能插进 card_prop_change / tag_op / move_card 的卡片位。
     ``AS`` 留空 = 不绑定上下文变量；填了名字，后面的块可以用
     "变量卡牌"（``{"ref":"<名字>"}``）复用同一张牌，不会重新抽。 */
  block('gtn_card_zone_pick', 'targets', {
    message0: '在 %1 的 %2 里取 %3 %4 的 %5（平手取 %6）%7',
    args0: [
      inputValue('TARGET', TARGET_CHECK),
      fieldDropdown('ZONE', zoneOptions),
      fieldDropdown('BY', zoneCardPickOptions),
      fieldDropdown('MODE', [['最大', 'max'], ['最小', 'min']]),
      fieldDropdown('TYPE', zoneCardTypeOptions),
      fieldDropdown('TIE', [['第一张', 'first'], ['最后一张', 'last'], ['随机', 'random']]),
      fieldInput('AS', ''),
    ],
    output: 'CardRef',
    inputsInline: true,
  }, (b, c) => {
    const filter = { require_selectable: true };
    const cardType = c.field(b, 'TYPE', 'any');
    if (cardType && cardType !== 'any') filter.card_type = cardType;
    const picker = {
      selector: 'zone_card',
      zone: c.field(b, 'ZONE', 'hand'),
      owner: c.value(b, 'TARGET', 'source'),
      filter,
      pick: {
        by: c.field(b, 'BY', 'cost_e'),
        mode: c.field(b, 'MODE', 'max'),
        tie: c.field(b, 'TIE', 'first'),
      },
    };
    const as = String(c.field(b, 'AS', '') || '').trim();
    if (as) picker.as = as;
    return picker;
  },
  '按"可选中 + 牌型"过滤一个区域，再按属性取最大/最小挑一张牌（平手取第一张/最后一张/随机）。'
  + '填了"记住为"就把这张牌写进上下文变量，后面的"变量卡牌"块用同名 ref 复用它（不重复抽取）。'
  + '费用上下限、排除标签等更多过滤键写进 JSON 后仍会被运行时读取，但这块只编辑牌型。', 'CardRef'),

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
  }, (b, c) => ({ op: 'health_op', mode: 'heal', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 0) }), '回复生命。'),
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
  }, (b, c) => ({ op: 'resource_op', resource: 'e', delta: c.value(b, 'AMOUNT', 0), target: c.value(b, 'TARGET', 'source') }), '正数获得，负数失去。'),
  block('gtn_gain_m', 'resources', {
    message0: '使 %1 获得 %2 M',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'resource_op', resource: 'm', delta: c.value(b, 'AMOUNT', 0), target: c.value(b, 'TARGET', 'source') }), '正数获得，负数失去。'),
  block('gtn_draw_cards', 'resources', {
    message0: '使 %1 抽 %2 张牌',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'draw', target: c.value(b, 'TARGET', 'source'), count: c.value(b, 'AMOUNT', 1) }), '抽牌。'),

  /* Round 30 / 批次 Y：这三块原先写旧写法 ``add_status`` / ``remove_status`` /
     ``set_status``；旧写法已删除（见 mod_spec_v2.REMOVED_ATOMIC_OPS），块改成
     写规范 op。``log: true`` 复刻旧写法"默认播报层数"的战报，块 id 与反向渲染
     保持不变，老工程照常打开。 */
  block('gtn_add_status', 'statuses', {
    message0: '给 %1 添加状态 %2 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'status_op', action: 'add', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 1), log: true }), '添加状态。'),
  block('gtn_remove_status', 'statuses', {
    message0: '移除 %1 的状态 %2 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'status_op', action: 'remove', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 1), log: true }), '移除状态。'),
  block('gtn_set_status', 'statuses', {
    message0: '设置 %1 的状态 %2 为 %3 层',
    args0: [inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'gtn:poison'), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'status_op', mode: 'set', target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS'), amount: c.value(b, 'AMOUNT', 0), log: true }), '设置状态层数。'),

  block('gtn_move_card', 'zones', {
    message0: '移动卡牌 %1 到 %2 的 %3',
    args0: [inputValue('CARD', 'CardRef'), inputValue('OWNER', TARGET_CHECK), fieldDropdown('ZONE', zoneOptions)],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({ op: 'move_card', card: c.value(b, 'CARD', 'current_card'), owner: c.value(b, 'OWNER', 'source'), target_zone: c.field(b, 'ZONE', 'discard') }), '移动一张卡到指定区域。'),
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
  }, (b, c) => ({ op: 'equipment_op', mode: 'destroy', pick: 'choice', target: c.value(b, 'TARGET', 'target'), equipment: c.value(b, 'EQUIPMENT', 'first') }), '摧毁装备。'),
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
  }, (b, c) => ({ op: 'tag_op', action: 'add', card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG') }), '添加标签。'),
  block('gtn_remove_tag', 'tags', {
    message0: '移除卡牌 %1 的标签 %2',
    args0: [inputValue('CARD', 'CardRef'), fieldInput('TAG', 'gtn:exile')],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    /* Round 31 / 批次 Z：remove_tag 并进 tag_op(action:"remove")。 */
  }, (b, c) => ({ op: 'tag_op', action: 'remove', card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG') }), '移除标签。'),

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
  block('gtn_event_context', 'advanced', {
    message0: '事件上下文 %1',
    args0: [fieldInput('KEY', 'damage_tag')],
    output: VALUE_CHECK,
  }, b => ({ op: 'get', object: { op: 'var', name: 'event_context' }, key: b.getFieldValue('KEY') || '' }), '读取当前事件上下文。', 'ValueExpr'),
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
  /* Round 33 / 批次 AC：装备事件里的"装备指向的目标"（auto_play actor 等用得到）。
     运行时认 dict / 字符串两种写法，这里原样写回 {ref:"equipment_target"}。 */
  legacyValueBlock('gtn_value_equipment_target', 'values', '装备指向的目标',
    [],
    () => ({ ref: 'equipment_target' }),
    '读取本装备的 effect_target。', 'PlayerRef'),
  /* Round 33 / 批次 AC：装备/状态伞的数值里用到的三种取值形态（官方包的
     status_op amount 就写着它们）。以前反向渲染会把它们塞进 gtn_text 变成
     一串 JSON 文本，画布保存一次就丢了。 */
  legacyValueBlock('gtn_value_hit_count', 'values', '本次第几段命中',
    [],
    () => ({ op: 'hit_count' }),
    '多段伤害结算里当前的命中序号（从 1 开始）。', 'Number'),
  legacyValueBlock('gtn_value_last_positive_hits', 'values', '上次命中次数',
    [],
    () => ({ op: 'last_positive_hits' }),
    '上一次结算实际命中的段数。', 'Number'),
  legacyValueBlock('gtn_value_equipment_count', 'values', '%1 的装备数量',
    [inputValue('TARGET', TARGET_CHECK)],
    (b, c) => ({ op: 'equipment_count', target: c.value(b, 'TARGET', 'source') }),
    '读取玩家装备数量。', 'Number'),
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
    'repeat',
    (b, c) => ({ until: c.value(b, 'COND', false), body: c.statement(b, 'DO') }),
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
  /* Round 42 / 批次 AF：``lifesteal_damage`` / ``triangle_damage`` 已删除，
     两个块一并下架——等价写法是"deal_damage + health_op / player_var_change"
     的组合（官方包 vanilla:fang / vanilla:triangle 的卡数据就是范例）。 */
  /* Round 24：护甲/闪避族的唯一入口 player_stat_change（旧 add_armor /
     remove_armor / set_armor / dodge_permanent / dodge_this 都已并进来）。 */
  legacyStatementBlock('gtn_armor_op', 'damage', '%1 %2 的 %3 %4',
    [fieldDropdown('OP', [['增加', 'add'], ['减少', 'remove'], ['设为', 'set']]), inputValue('TARGET', TARGET_CHECK), fieldDropdown('STAT', [['护甲', 'armor'], ['闪避', 'dodge']]), inputValue('AMOUNT')],
    'player_stat_change',
    (b, c) => ({ mode: c.field(b, 'OP', 'add'), stat: c.field(b, 'STAT', 'armor'), target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 1) }),
    '修改护甲或闪避。'),

  legacyStatementBlock('gtn_named_status_op', 'statuses', '%1 %2 状态 %3 %4 层',
    /* Round 31 / 批次 Z：`set_status_named` 并进 `status_add_named(mode:"set")`，
       OP 下拉因此改成 mode（移除仍走 `status_remove_named`）。 */
    [fieldDropdown('OP', [['添加', 'add'], ['移除', 'remove'], ['设为', 'set']]), inputValue('TARGET', TARGET_CHECK), fieldInput('STATUS', 'poison'), inputValue('AMOUNT')],
    'status_op',
    (b, c) => {
      const mode = c.field(b, 'OP', 'add');
      const base = { target: c.value(b, 'TARGET', 'target'), status: c.field(b, 'STATUS', 'poison'), amount: c.value(b, 'AMOUNT', 1) };
      return mode === 'set'
        ? { op: 'status_op', mode: 'set', ...base }
        : { op: 'status_op', action: mode, ...base };
    },
    '按 ID 修改任意状态。'),
  /* Round 24：clear_buffs / clear_debuffs / clear_all_effects 并进
     clear_statuses(preset=...)；Round 31 起「指定状态」走
     status_remove_named(amount:"all")。 */
  legacyStatementBlock('gtn_clear_status_op', 'statuses', '清除 %1 的 %2',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('WHAT', [['正面状态', 'buffs'], ['负面状态', 'debuffs'], ['全部状态', 'all'], ['指定状态', 'clear_status']])],
    'clear_statuses',
    (b, c) => {
      const what = c.field(b, 'WHAT', 'buffs');
      const target = c.value(b, 'TARGET', 'target');
      return what === 'clear_status'
        ? { op: 'status_op', action: 'remove', target, status: 'poison', amount: 'all' }
        : { op: 'clear_statuses', preset: what, target };
    },
    '清除状态。'),

  /* Round 24：cost_e / cost_m → resource_spend；Round 31：resource_spend 也并进
     spend_resource（resource 选 elixir/magic，日志由 log 模板给）。 */
  legacyStatementBlock('gtn_pay_resource', 'resources', '支付 %1 %2',
    [inputValue('AMOUNT'), fieldDropdown('RES', [['E', 'e'], ['M', 'm']])],
    'spend_resource',
    (b, c) => {
      const res = c.field(b, 'RES', 'e');
      return {
        resource: res === 'm' ? 'magic' : 'elixir',
        amount: c.value(b, 'AMOUNT', 1),
        log: res === 'm' ? '{target}消耗{amount}M' : '{target}消耗{amount}E',
      };
    },
    '消耗资源。'),
  /* Round 42 / 批次 AF：``turn_mod_add``（Round 24 合并 mod_e_regen /
     mod_m_regen / mod_draw）已删除——它写的三个字段零读取方，块一并下架。 */
  legacyStatementBlock('gtn_set_health', 'resources', '设置 %1 的 H 为 %2',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'health_op',
    (b, c) => ({ op: 'health_op', mode: 'set', target: c.value(b, 'TARGET', 'source'), amount: c.value(b, 'AMOUNT', 1) }),
    '直接设置玩家生命。'),
  legacyStatementBlock('gtn_aura_enemy_elixir_recovery', 'resources', '使 %1 的 E 回复修正 %2',
    [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    'resource_op',
    (b, c) => ({ op: 'resource_op', mode: 'aura_recovery', resource: 'e', amount: c.value(b, 'AMOUNT', -1) }),
    '装备光环式 E 回复修正。'),

  legacyStatementBlock('gtn_player_prop_set_add', 'variables', '玩家 %1 的 %2 %3 %4',
    /* Round 29 / 批次 X：player_prop_set / player_prop_add 合并成
       player_prop_change(mode=set|add)，MODE 下拉写的就是 mode 值本身
       （Round 31 修掉下拉里仍写着旧 op 名、导致 mode 读不出来的旧账）。 */
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('PROP', playerPropOptions), fieldDropdown('MODE', [['设为', 'set'], ['增加', 'add']]), inputValue('VALUE')],
    'player_prop_change',
    (b, c) => ({ op: 'player_prop_change', mode: c.field(b, 'MODE', 'set'), target: c.value(b, 'TARGET', 'source'), property: c.field(b, 'PROP', 'health'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0) }),
    '修改玩家属性，包括 H/E/M 上限和手牌上限。'),
  legacyStatementBlock('gtn_card_prop_set_add', 'variables', '卡牌 %1 的 %2 %3 %4',
    /* Round 31 / 批次 Z：card_prop_set / card_prop_add / card_prop_mul 三条并成
       card_prop_change(mode=set|add|mul)，MODE 下拉改成写 mode 参数。 */
    [inputValue('CARD', 'CardRef'), fieldDropdown('PROP', cardPropOptions), fieldDropdown('MODE', [['设为', 'set'], ['增加', 'add'], ['乘以', 'mul']]), inputValue('VALUE')],
    'card_prop_change',
    (b, c) => ({ op: 'card_prop_change', mode: c.field(b, 'MODE', 'set'), card: c.value(b, 'CARD', 'current_card'), property: c.field(b, 'PROP', 'fusion_level'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0), multiplier: c.value(b, 'VALUE', 1) }),
    '修改当前或所选卡牌属性，如 E/M、聚变、裂变、番茄层数。'),
  legacyStatementBlock('gtn_equipment_prop_set_add', 'equipment', '装备 %1 的 %2 %3 %4',
    [inputValue('EQUIPMENT', ['EquipmentRef', 'String']), fieldDropdown('PROP', equipPropOptions), fieldDropdown('MODE', [['设为', 'equipment_prop_set'], ['增加', 'equipment_prop_add']]), inputValue('VALUE')],
    'equipment_prop_set',
    (b, c) => ({ op: c.field(b, 'MODE', 'equipment_prop_set'), equipment: c.value(b, 'EQUIPMENT', 'current_equipment'), property: c.field(b, 'PROP', 'turns_equipped'), value: c.value(b, 'VALUE', 0), amount: c.value(b, 'VALUE', 0) }),
    '修改装备属性。'),

  /* Round 24：tag_add_named / tag_remove_named → add_tag；Round 31：remove_tag
     并进 add_tag(mode:"remove")，OP 下拉改成写 mode 参数。 */
  legacyStatementBlock('gtn_card_tag_op_named', 'tags', '卡牌 %1 %2 标签 %3',
    [inputValue('CARD', 'CardRef'), fieldDropdown('OP', [['添加', 'add'], ['移除', 'remove']]), fieldInput('TAG', 'exile')],
    'tag_op',
    (b, c) => ({ op: 'tag_op', action: c.field(b, 'OP', 'add'), card: c.value(b, 'CARD', 'current_card'), tag: c.field(b, 'TAG', 'exile') }),
    '添加或移除任意标签 ID。'),
  legacyStatementBlock('gtn_clear_tags', 'tags', '清除卡牌 %1 的全部标签',
    [inputValue('CARD', 'CardRef')],
    'tag_op',
    (b, c) => ({ op: 'tag_op', action: 'clear', card: c.value(b, 'CARD', 'current_card') }),
    '清空当前实例的有效标签。'),

  legacyStatementBlock('gtn_fission_fusion', 'advanced', '%1 卡牌 %2 数值 %3',
    /* Round 42 / 批次 AF：``fission`` 与 ``fusion`` 已删除（裂变 = 
       card_prop_change(fission_level)；聚变 = vanilla:fusion 的卡数据组合），
       两个下拉项下架，保留 ``multiply_next_damage`` 与费用族两项。 */
    [fieldDropdown('OP', [['下次伤害乘以', 'multiply_next_damage'], ['下次费用减少', 'reduce_next_cost'], ['下次费用增加', 'increase_next_cost']]), inputValue('CARD', 'CardRef'), inputValue('AMOUNT')],
    'multiply_next_damage',
    (b, c) => {
      const selected = c.field(b, 'OP', 'multiply_next_damage');
      const amount = c.value(b, 'AMOUNT', 1);
      /* Round 32 / 批次 AA：费用族并进 modify_next_cost（delta 正负定方向）。 */
      /* Round 43 / 批次 AG：``modify_next_cost`` 已删除（加费/减费写的
         temp_heavy_value / temp_swift_value 本来就在属性白名单里），两个下拉项
         现在直接产 ``card_prop_add_to_zone``。 */
      if (selected === 'reduce_next_cost' || selected === 'increase_next_cost') {
        return {
          op: 'card_prop_add_to_zone',
          target: 'source',
          zone: 'hand',
          property: selected === 'reduce_next_cost' ? 'temp_swift_value' : 'temp_heavy_value',
          amount,
          require_selectable: false,
          silent: true,
        };
      }
      return { op: selected, card: c.value(b, 'CARD', 'current_card'), amount, multiplier: c.value(b, 'AMOUNT', 2) };
    },
    '通用卡牌一次性属性操作。'),
  legacyStatementBlock('gtn_move_current_zone', 'zones', '将当前卡牌移到 %1 的 %2',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions)],
    /* Round 29 / 批次 X：move_to_* 四条合并成 move_card(zone=...)。 */
    'move_card',
    (b, c) => ({ op: 'move_card', zone: c.field(b, 'ZONE', 'discard'), target: c.value(b, 'TARGET', 'source') }),
    '把当前卡移动到指定区域。'),
  /* Round 46 / 批次 AJ：把"区域选牌"块挑中的那张牌搬走
     （move_card(mode:"batch") 的 cards 位置；目的区只支持抽牌堆/弃牌堆/放逐区，
     与运行时的 _move_card_batch_payload 口径一致）。 */
  block('gtn_move_picked_card', 'zones', {
    message0: '把 %1 移动到 %2 的 %3',
    args0: [
      inputValue('CARDS', 'CardRef'),
      inputValue('TARGET', TARGET_CHECK),
      fieldDropdown('ZONE', [['抽牌堆顶', 'deck'], ['弃牌堆', 'discard'], ['放逐区', 'exile']]),
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => ({
    op: 'move_card',
    mode: 'batch',
    cards: c.value(b, 'CARDS', 'current_card'),
    owner: c.value(b, 'TARGET', 'source'),
    target_zone: c.field(b, 'ZONE', 'deck'),
  }), '把一张指定的牌（例如"区域选牌"挑出来的那张）移动到抽牌堆顶 / 弃牌堆 / 放逐区。'),
  legacyStatementBlock('gtn_give_card', 'zones', '给 %1 的 %2 加入卡牌 ID %3',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions), fieldInput('CARD_ID', 'Basic')],
    'give_card_to_hand',
    (b, c) => {
      /* Round 33 / 批次 AB：give_card_to_hand / give_card_to_deck 并进
         move_card(mode:"give", target_zone=…)；弃牌堆仍走 create_card。 */
      const zone = c.field(b, 'ZONE', 'hand');
      const target = c.value(b, 'TARGET', 'source');
      const cardId = c.field(b, 'CARD_ID', 'Basic');
      if (zone === 'discard') {
        return { op: 'create_card', card_id: cardId, to: 'discard', target };
      }
      return { op: 'move_card', mode: 'give', target_zone: zone, target, card_id: cardId };
    },
    '创建指定 ID 的卡并加入区域；不存在时运行时会给 Error。'),
  legacyStatementBlock('gtn_choose_from_zone', 'zones', '从 %1 的 %2 选择卡牌保存选择',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', [['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['放逐区', 'exile']])],
    /* Round 29 / 批次 X：choose_from_deck/discard/exile 合并成 choose_from_zone(zone=...)。
       Round 36 / 批次 AD-1：再并进 request 伞（type:"zone"）。 */
    'choose_from_zone',
    (b, c) => ({ op: 'request', type: 'zone', zone: c.field(b, 'ZONE', 'deck'), target: c.value(b, 'TARGET', 'source') }),
    '弹出受控选牌窗口。'),
  legacyStatementBlock('gtn_reveal_or_steal', 'zones', '%1 %2 的手牌',
    [fieldDropdown('OP', [['查看', 'reveal_enemy_hand'], ['拿取', 'steal_enemy_card']]), inputValue('TARGET', TARGET_CHECK)],
    /* Round 33 / 批次 AB：reveal_enemy_hand 并进 reveal(mode:"enemy_hand")，
       steal_enemy_card 并进 move_card(mode:"steal")。 */
    'reveal',
    (b, c) => {
      const selected = c.field(b, 'OP', 'reveal_enemy_hand');
      const target = c.value(b, 'TARGET', 'target');
      if (selected === 'steal_enemy_card') {
        return { op: 'move_card', mode: 'steal', target };
      }
      return { op: 'reveal', mode: 'enemy_hand', target };
    },
    '查看或拿取目标手牌。'),
  legacyStatementBlock('gtn_discard_choice_then_draw', 'zones', '弃置所选手牌并抽 1 张', [],
    'discard_choice_then_draw', () => ({}), '染色体式效果。'),
  legacyStatementBlock('gtn_copy_choice_discount', 'zones', '复制所选手牌并使其 E -%1',
    [inputValue('DISCOUNT')],
    'copy_choice_with_discount',
    /* Round 36 / 批次 AD-1：并进 request(type:"discount_copy")。 */
    (b, c) => ({ op: 'request', type: 'discount_copy', discount_e: c.value(b, 'DISCOUNT', 1) }),
    '拟态式效果。'),
  legacyStatementBlock('gtn_request_card_choice', 'ui', '弹出选牌 %1 的 %2 区 类型 %3 最少 %4 最多 %5',
    [inputValue('TARGET', TARGET_CHECK), fieldDropdown('ZONE', cardOnlyZoneOptions.concat([['装备', 'equipment']])), fieldInput('CARD_TYPE', ''), inputValue('MIN'), inputValue('MAX')],
    'request_card',
    /* Round 36 / 批次 AD-1：并进 request(type:"card")（判别键写顶层，其余参数面不变）。 */
    (b, c) => ({ op: 'request', type: 'card', target: c.value(b, 'TARGET', 'source'), zone: c.field(b, 'ZONE', 'hand'), card_type: c.field(b, 'CARD_TYPE', ''), min_count: c.value(b, 'MIN', 1), max_count: c.value(b, 'MAX', 1), choice_type: 'choose_card', cancellable: true }),
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
    /* Round 31 / 批次 Z：destroy_equipment_choice_or_first / destroy_self_equipment /
       destroy_all_destroyable_equipment 也并进 destroy_equipment（mode/filter）。 */
    [fieldDropdown('OP', [['摧毁所选或第一件', 'choice'], ['随机摧毁（1件）', 'random'], ['摧毁全部', 'all'], ['摧毁全部可摧毁', 'all:destroyable'], ['摧毁自身装备', 'self']]), inputValue('TARGET', TARGET_CHECK)],
    'equipment_op',
    (b, c) => {
      /* Round 29 / 批次 X：destroy_random_equip / destroy_all_equip /
         destroy_all_field_equip 合并成 equipment_op(mode:"destroy", pick=..., scope=...)。 */
      const selected = c.field(b, 'OP', 'choice');
      const target = c.value(b, 'TARGET', 'target');
      const [mode, filter] = String(selected).split(':');
      const step = { op: 'equipment_op', mode: 'destroy', pick: mode, scope: 'target', target };
      if (filter) {
        step.filter = filter;
      }
      return step;
    },
    '装备摧毁通用操作。'),
  /* Round 42 / 批次 AF：``emit_event`` 已删除（事件总线没有订阅方），
     这个"主动触发"占位块改写 ``log`` 的静默形态（message 为空 = 不播报）。 */
  legacyStatementBlock('gtn_trigger_manual', 'equipment', '主动触发当前装备', [], 'log',
    () => ({ message: '', silent: true }), '触发装备的主动效果（占位步骤，本身不产生任何结算）。'),
  /* Round 24：equip_reduce_own_draw / equip_reduce_enemy_draw → equip_reduce_draw(target=...)。 */
  legacyStatementBlock('gtn_equip_reduce_own_draw', 'equipment', '装备效果：%1 每回合少抽 %2 张',
    [fieldDropdown('WHO', [['自己', 'self'], ['敌方', 'enemy']]), inputValue('AMOUNT')],
    'draw',
    (b, c) => ({
      op: 'draw',
      count: 0,
      hooks: false,
      target: 'self',
      modifiers: [{ type: 'sluggish', amount: c.value(b, 'AMOUNT', 1), target: c.field(b, 'WHO', 'self') }],
    }),
    '装备在场时减少某一方每回合的抽牌数。'),
  /* Round 42 / 批次 AF：``equip_protection`` 别名（→ counter_equip_protect）已删除，
     块改写 ``player_prop_change``（装备保护层数就是玩家属性 equipment_protection）。 */
  legacyStatementBlock('gtn_equipment_protection', 'counter', '保护当前装备不被摧毁', [],
    'player_prop_change',
    () => ({ mode: 'add', property: 'equipment_protection', target: 'self', amount: 1 }),
    '反制装备摧毁。'),

  legacyStatementBlock('gtn_control_effect', 'counter', '%1 %2',
    [fieldDropdown('OP', [['禁止行动', 'block_own'], ['跳过回合', 'skip'], ['强制结束回合', 'end']]), inputValue('TARGET', TARGET_CHECK)],
    'turn_control',
    (b, c) => {
      /* Round 38 / 批次 AD-3：回合控制族三合一 ——
         跳过回合 / 强制结束回合写 `turn_control(mode=skip|end)`。
         Round 42 / 批次 AF：`action_filter` 已删除，禁止行动改写
         `player_prop_change(mode:"set", property:"shovel_active", value:1)`。
         原「无敌」选项删掉：它写的 `invincible` 早已不是可用 op，同一效果走
         `gtn_untargetable_layers` 块（`player_status_layers`）或 JSON 页签。 */
      const choice = c.field(b, 'OP', 'end');
      if (choice === 'block_own') {
        return { op: 'player_prop_change', mode: 'set', property: 'shovel_active', target: 'self', value: 1 };
      }
      /* 「强制结束回合」只作用于出牌者（旧 force_end_turn 也不解析 target），
         所以这个分支不写 target，避免画布保存时凭空多出参数。 */
      if (choice === 'end') return { op: 'turn_control', mode: 'end' };
      return { op: 'turn_control', mode: 'skip', target: c.value(b, 'TARGET', 'target') };
    },
    '行动控制类效果。'),
  legacyStatementBlock('gtn_honey_control', 'counter', '蜂蜜控制 %1 持续 %2 回合',
    [inputValue('TARGET', TARGET_CHECK), inputValue('DURATION')],
    /* Round 45 / 批次 AI：``honey_control`` 并进
       ``turn_control(mode:"forced_action")`` —— 画布照旧拖这个块，
       存回去的是伞原子写法；反渲染见下面的 forced_action 分支。 */
    'turn_control',
    (b, c) => ({
      mode: 'forced_action',
      target: c.value(b, 'TARGET', 'target'),
      duration: c.value(b, 'DURATION', 1),
    }),
    '强制目标下回合从左到右自动打出可支付的攻击牌；没有可打出的攻击牌时自动结束回合。'),
  legacyStatementBlock('gtn_response_declare', 'counter', '声明反制窗口 类型 %1 目标 %2',
    [fieldDropdown('TRIGGER', [['攻击', 'attack'], ['回复H', 'heal'], ['装备摧毁', 'destroy_equipment'], ['任意', 'any']]), inputValue('TARGET', TARGET_CHECK)],
    'response_declare',
    (b, c) => ({ trigger: c.field(b, 'TRIGGER', 'attack'), target: c.value(b, 'TARGET', 'source') }),
    '把本牌加入反制窗口。'),

  legacyStatementBlock('gtn_var_target_set_add', 'variables', '%1 的变量 %2 %3 %4',
    [fieldDropdown('TARGET', propTargetOptions), fieldInput('NAME', '变量'), fieldDropdown('MODE', [['设为', 'set'], ['增加', 'add'], ['减少', 'sub'], ['乘以', 'mul'], ['除以', 'div']]), inputValue('VALUE')],
    /* Round 29 / 批次 X：var_set/add/sub/mul/div 合并成 player_var_change(mode=...)。 */
    'player_var_change',
    (b, c) => ({ op: 'player_var_change', mode: c.field(b, 'MODE', 'set'), target: c.field(b, 'TARGET', 'self'), name: c.field(b, 'NAME', '变量'), value: c.value(b, 'VALUE', 0) }),
    '玩家/队伍/全局变量操作。'),
  legacyStatementBlock('gtn_list_op', 'variables', '列表 %1 %2 %3',
    [fieldInput('NAME', '列表'), fieldDropdown('OP', [['设为', 'list_set'], ['追加', 'list_append'], ['清空', 'list_clear']]), inputValue('VALUE')],
    'list_modify',
    (b, c) => {
      const mode = { list_set: 'set', list_append: 'append', list_clear: 'clear' }[c.field(b, 'OP', 'list_set')] || 'set';
      const value = mode === 'set' ? c.value(b, 'VALUE', []) : c.value(b, 'VALUE', 0);
      return { op: 'list_modify', list: c.field(b, 'NAME', '列表'), mode, value };
    },
    '列表操作，用于批量保存卡牌、目标或变量。'),
  legacyStatementBlock('gtn_for_each_list', 'flow', '遍历列表 %1 每项为 %2 %3',
    [inputValue('LIST'), fieldInput('NAME', 'item'), { type: 'input_statement', name: 'DO' }],
    'for_each',
    (b, c) => ({ op: 'for_each', list: c.value(b, 'LIST', []), name: c.field(b, 'NAME', 'item'), body: c.statement(b, 'DO') }),
    '遍历列表。'),
  legacyStatementBlock('gtn_for_each_selected_card', 'flow', '遍历已选卡牌 %1',
    [{ type: 'input_statement', name: 'DO' }],
    'for_each',
    (b, c) => {
      const steps = c.statement(b, 'DO');
      return { op: 'for_each', bind: 'selected_card', steps, body: steps };
    },
    '遍历最近一次卡牌选择窗口中选中的卡牌。'),
  /* Round 37 / 批次 AD-2：延迟族三合一 —— 这个块写回去的是
     ``delayed_effect(mode:"timed")``（旧名 timed_effect 已退役）。
     本批补上 TARGET 输入：官方包的延迟步骤都写着 ``target``，以前画布不承载，
     保存回去会把它丢掉。 */
  legacyStatementBlock('gtn_timed_effect', 'advanced', '持续 %1 回合 触发 %2 对 %3 执行 %4',
    [inputValue('DURATION'), fieldDropdown('TRIGGER', [['目标回合开始', 'target_turn_start'], ['目标回合结束', 'target_turn_end'], ['装备者回合开始', 'owner_turn_start'], ['装备者回合结束', 'owner_turn_end'], ['友方回合开始', 'friendly_turn_start'], ['敌方回合开始', 'enemy_turn_start'], ['任意回合开始', 'any_turn_start']]), inputValue('TARGET', TARGET_CHECK), { type: 'input_statement', name: 'DO' }],
    'delayed_effect',
    (b, c) => ({ op: 'delayed_effect', mode: 'timed', duration: c.value(b, 'DURATION', 1), trigger: c.field(b, 'TRIGGER', 'target_turn_start'), target: c.value(b, 'TARGET', 'target'), body: c.statement(b, 'DO') }),
    '持续时间分区：把一组效果登记为未来回合触发。'),

  /* --- Round 17 收口：Round 6a/6b 之后新加、但编辑器还没有块的 op --- */
  block('gtn_declare_forced_target', 'targets', {
    message0: '宣告 %1 为本回合的强制目标',
    args0: [inputValue('TARGET', TARGET_CHECK)],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({
    /* Round 36 / 批次 AD-1：并进 request(type:"forced_target")。 */
    op: 'request',
    type: 'forced_target',
    target: c.value(b, 'TARGET', 'self'),
  }), '本回合所有需要选择玩家的效果只能指向该玩家；该玩家下个回合开始时自动清除。'),
  block('gtn_reveal_hand_cards', 'zones', {
    message0: '把 %1 的手牌展示给 %2 %3',
    args0: [
      inputValue('TARGET', TARGET_CHECK),
      inputValue('VIEWER', TARGET_CHECK),
      fieldDropdown('MARK', [['（只展示）', 'plain'], ['并标记为被揭示', 'mark']]),
    ],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({
    /* Round 33 / 批次 AB：reveal_hand_cards 并进 reveal(mode:"hand", viewer=…)。 */
    op: 'reveal',
    mode: 'hand',
    target: c.value(b, 'TARGET', 'target'),
    viewer: c.value(b, 'VIEWER', 'self'),
    mark: c.field(b, 'MARK', 'plain') === 'mark',
  }), '把目标的手牌展示给观看者，可选地给每张可选中牌加 revealed 实例标记。'),
  block('gtn_untargetable_layers', 'counter', {
    message0: '使 %1 获得 %2 层不可选中',
    args0: [inputValue('TARGET', TARGET_CHECK), inputValue('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
  }, (b, c) => ({
    /* Round 31 / 批次 Z：untargetable_layers → player_status_layers(status=...)。 */
    op: 'player_status_layers',
    status: 'untargetable',
    target: c.value(b, 'TARGET', 'self'),
    amount: c.value(b, 'AMOUNT', 1),
  }), '只加“不可被选中”层数（shovel 缺省不点亮），可把 status 改成 invincible。'),
);

BLOCK_REGISTRY.push(
  /* --- Round 33 / 批次 AC：4 个伞原子（装备/状态/标签/自动打出）---
     数据侧已经统一走伞形状，画布这边也一样：正向编译写的就是
     `op + mode/action`，反向渲染（astStepToBlock）把伞步骤还原成这些块。
     只有真正接线的输入才写进步骤，其余键留给 JSON 页签，避免画布保存时凭空
     多出参数。参数面按 game_engine 的 `_atomic_*` 实现给（见 _atomic_equipment_op
     / _atomic_status_op / _atomic_tag_op / _atomic_auto_play）。 */
  block('gtn_equipment_op', 'equipment', {
    message0: '装备 %1 目标 %2 效果指向 %3 卡牌 %4 数量 %5 挑选 %6 %7',
    args0: [
      fieldDropdown('MODE', [
        ['置入装备栏', 'place'],
        ['生成装备', 'give'],
        ['装备护甲', 'armor'],
        ['摧毁装备', 'destroy'],
        ['尘封装备', 'seal'],
        ['解除装备保护', 'unprotect'],
        ['逐件遍历', 'each'],
      ]),
      inputValue('TARGET', TARGET_CHECK),
      inputValue('EFFECT_TARGET', TARGET_CHECK),
      inputValue('CARD', ['CardRef', 'String']),
      inputValue('AMOUNT'),
      fieldDropdown('PICK', [
        ['所选的', 'choice'],
        ['随机1件', 'random'],
        ['全部', 'all'],
        ['全部可摧毁', 'all:destroyable'],
        ['本装备', 'self'],
      ]),
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => {
    const mode = c.field(b, 'MODE', 'place');
    const step = { op: 'equipment_op', mode };
    const target = c.value(b, 'TARGET', null);
    if (target !== null) step[mode === 'place' ? 'owner' : 'target'] = target;
    const effectTarget = c.value(b, 'EFFECT_TARGET', null);
    if (effectTarget !== null) step.effect_target = effectTarget;
    const card = c.value(b, 'CARD', null);
    if (card !== null) step.card = card;
    if (mode === 'armor' || mode === 'seal') step.amount = c.value(b, 'AMOUNT', 1);
    if (mode === 'destroy') {
      /* 伞的摧毁段内部再选 pick，filter/record_count 跟着"全部可摧毁"走。 */
      const [pick, filter] = String(c.field(b, 'PICK', 'choice')).split(':');
      step.pick = pick;
      if (filter) {
        step.filter = filter;
        step.record_count = true;
      }
    }
    if (mode === 'each') {
      const body = c.statement(b, 'DO');
      if (body.length) step.body = body;
    }
    return step;
  }, '装备伞：置入装备栏 / 生成装备 / 装备护甲 / 摧毁（choice·random·all·self）/ 尘封 / 解除保护 / 逐件遍历。'),
  block('gtn_status_op', 'statuses', {
    message0: '状态 %1 目标 %2 状态 ID %3 层数 %4 清理名单 %5 结算后减少 %6',
    args0: [
      fieldDropdown('ACTION', [
        ['施加层数', 'add'],
        ['设为层数', 'set'],
        ['移除层数', 'remove'],
        ['清除状态', 'clear'],
        ['立即结算', 'settle'],
      ]),
      inputValue('TARGET', TARGET_CHECK),
      fieldInput('STATUS', 'poison'),
      inputValue('AMOUNT'),
      fieldDropdown('LIST', [['全部状态', 'all'], ['全部减益', 'debuffs'], ['全部增益', 'buffs']]),
      inputValue('REDUCE'),
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => {
    const action = c.field(b, 'ACTION', 'add');
    const step = { op: 'status_op' };
    const target = c.value(b, 'TARGET', null);
    if (target !== null) step.target = target;
    if (action === 'clear') {
      /* 引擎的名单式清状态：`statuses:"all"` 或 preset 名单（buffs/debuffs）。 */
      const list = c.field(b, 'LIST', 'all');
      step.action = 'clear';
      if (list === 'all') step.statuses = 'all';
      else step.preset = list;
      return step;
    }
    const status = c.field(b, 'STATUS', '');
    if (status) step.status = status;
    if (action === 'settle') {
      step.action = 'settle';
      const reduce = c.value(b, 'REDUCE', null);
      if (reduce !== null) step.reduce = reduce;
      return step;
    }
    /* 子模式写在 `action` 上——伞占用了步骤自己的 `op` 键，运行时只认 action。 */
    step.action = action;
    const amount = c.value(b, 'AMOUNT', null);
    if (amount !== null) step.amount = amount;
    return step;
  }, '状态伞：加/设层数、减层数、清状态（preset 名单）、DoT 立即结算。'),
  block('gtn_tag_op', 'tags', {
    message0: '标签 %1 卡牌 %2 目标 %3 区域 %4 标签 ID %5',
    args0: [
      fieldDropdown('ACTION', [['添加', 'add'], ['移除', 'remove'], ['翻转', 'toggle'], ['清空', 'clear']]),
      inputValue('CARD', 'CardRef'),
      inputValue('TARGET', TARGET_CHECK),
      fieldDropdown('ZONE', [
        ['（单卡）', ''],
        ['手牌', 'hand'],
        ['抽牌堆', 'deck'],
        ['弃牌堆', 'discard'],
        ['放逐区', 'exile'],
        ['装备栏', 'equipment'],
      ]),
      fieldInput('TAG', 'exile'),
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => {
    const step = { op: 'tag_op', action: c.field(b, 'ACTION', 'add') };
    const card = c.value(b, 'CARD', null);
    if (card !== null) step.card = card;
    const target = c.value(b, 'TARGET', null);
    if (target !== null) step.target = target;
    /* 带区域就是区域级（旧 add_tag_to_zone），不带就是单卡级（旧 add_tag）。 */
    const zone = c.field(b, 'ZONE', '');
    if (zone) step.zone = zone;
    const tag = c.field(b, 'TAG', '');
    if (tag) step.tag = tag;
    return step;
  }, '标签伞：单卡加/减/清空实例标签，或按区域给一批牌加/减/翻转标签。'),
  block('gtn_auto_play', 'zones', {
    message0: '自动打出 %1 卡牌 %2 执行者 %3 区域 %4 费用 %5 失败处理 %6',
    args0: [
      fieldDropdown('MODE', [['指定卡牌', 'card'], ['区域顶牌', 'zone_top'], ['登记每回合', 'queue']]),
      inputValue('CARD', 'CardRef'),
      inputValue('ACTOR', TARGET_CHECK),
      fieldDropdown('ZONE', [
        ['抽牌堆顶', 'deck'],
        ['手牌', 'hand'],
        ['弃牌堆', 'discard'],
        ['放逐区', 'exile'],
      ]),
      fieldDropdown('COST', [['支付费用', 'normal'], ['不支付费用', 'free']]),
      fieldDropdown('ON_FAILURE', [['（缺省）', ''], ['放回原区域', 'return'], ['留在手牌', 'hand'], ['弃置', 'discard']]),
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
  }, (b, c) => {
    const mode = c.field(b, 'MODE', 'card');
    const cost = c.field(b, 'COST', 'normal');
    const step = { op: 'auto_play', mode };
    const card = c.value(b, 'CARD', null);
    if (card !== null) step.card = card;
    if (mode === 'card') {
      /* card 段用布尔 no_cost；下拉统一成 normal/free，写回来才对得上引擎。 */
      step.no_cost = cost === 'free';
      return step;
    }
    const actor = c.value(b, 'ACTOR', null);
    if (actor !== null) step.actor = actor;
    const zone = c.field(b, 'ZONE', '');
    if (zone) step.zone = zone;
    step.cost = cost;
    const onFailure = c.field(b, 'ON_FAILURE', '');
    if (onFailure) step.on_failure = onFailure;
    return step;
  }, '自动打出伞：立刻打出指定卡牌、强制打出某区域的第一张可打出牌，或登记"拥有者回合开始时自动打出"。'),
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
        } else if (blockDef.id === 'gtn_pay_resource') {
          entry.inputs = { AMOUNT: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_player_prop_set_add') {
          entry.inputs = { TARGET: shadowTarget('source'), VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_card_prop_set_add') {
          entry.inputs = { CARD: { block: { type: 'gtn_card_current' } }, VALUE: shadowNumber(1) };
        } else if (blockDef.id === 'gtn_card_zone_pick') {
          entry.inputs = { TARGET: shadowTarget('source') };
        } else if (blockDef.id === 'gtn_move_picked_card') {
          entry.inputs = { CARDS: { block: { type: 'gtn_card_current' } }, TARGET: shadowTarget('source') };
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

/**
 * 无头编译：序列化出来的块 JSON → 步骤数组（与 `workspaceToSteps` 同一套编译器，
 * 只是不依赖真 Blockly 工作区）。自测脚本用它做"步骤 → 块 → 步骤"的往返校验，
 * 命令行工具也可以在 Node 里直接检查画布会写出什么数据。
 *
 * 入参既可以是 `stepsToWorkspaceJson()` 的整个工作区 JSON，也可以直接给块数组。
 */
export function blocksJsonToSteps(data) {
  const compiler = makeCompiler();
  const byId = new Map(BLOCK_REGISTRY.map(item => [item.id, item]));
  const wrap = (json) => {
    if (!json || typeof json !== 'object') return null;
    return {
      type: json.type,
      fields: json.fields || {},
      inputs: json.inputs || {},
      nextJson: json.next && json.next.block ? json.next.block : null,
      getFieldValue(name) {
        return Object.prototype.hasOwnProperty.call(this.fields, name) ? this.fields[name] : null;
      },
      getInputTargetBlock(name) {
        const input = this.inputs[name];
        if (!input) return null;
        return wrap(input.block || input.shadow);
      },
      getNextBlock() {
        return wrap(this.nextJson);
      },
    };
  };
  const list = Array.isArray(data) ? data
    : (data && data.blocks && Array.isArray(data.blocks.blocks) ? data.blocks.blocks : []);
  const steps = [];
  for (const top of list) {
    if (!top || typeof top !== 'object') continue;
    const def = byId.get(top.type);
    /* 输出型（值）块不是步骤：画布里它们挂在输入口上，不该当成顶层步骤编译 */
    if (def && def.json && def.json.output) continue;
    if (top.type === 'gtn_event_head') {
      steps.push(...compiler.statement(wrap(top), 'DO'));
      continue;
    }
    steps.push(...compiler.chain(wrap(top)));
  }
  return steps.filter(Boolean);
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
  if (op === 'heal' || (op === 'health_op' && String(step.mode || 'heal') === 'heal')) {
    return blockJson('gtn_heal', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount ?? step.delta, 0),
    });
  }
  if (op === 'draw_cards' || (op === 'draw' && !step.modifiers)) {
    return blockJson('gtn_draw_cards', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount ?? step.count, 1),
    });
  }
  if (op === 'gain_e' || (op === 'resource_op' && String(step.resource || 'e') !== 'm' && String(step.mode || '') !== 'spend' && String(step.mode || '') !== 'aura_recovery')) {
    return blockJson('gtn_gain_e', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount ?? step.delta, 0),
    });
  }
  if (op === 'gain_m' || (op === 'resource_op' && String(step.resource || 'e') === 'm' && String(step.mode || '') !== 'spend')) {
    return blockJson('gtn_gain_m', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount ?? step.delta, 0),
    });
  }
  /* 旧写法 add_status / remove_status / set_status 只在"老工程反向渲染"里出现；
     三个块现在写的是规范 op（Round 30 / 批次 Y），保存时自动升级。 */
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
    /* Round 33 / 批次 AB：move_card 现在也承载造牌/夺取/换手牌等 mode，反向
       渲染回到对应的老块。 */
    const moveMode = String(step.mode || '');
    if (moveMode === 'give') {
      return blockJson('gtn_give_card', {
        TARGET: valueInputToBlock(step.target, 'source'),
      }, {
        ZONE: String(step.target_zone || step.zone || 'hand'),
        CARD_ID: String(step.card_id || step.card || step.id || 'Basic'),
      });
    }
    if (moveMode === 'steal') {
      return blockJson('gtn_reveal_or_steal', {
        TARGET: valueInputToBlock(step.target, 'target'),
      }, { OP: 'steal_enemy_card' });
    }
    return blockJson('gtn_move_card', {
      CARD: valueInputToBlock(step.card, 'current_card'),
      OWNER: valueInputToBlock(step.owner, 'source'),
    }, { ZONE: String(step.target_zone || step.to || step.zone || 'discard') });
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
  if (op === 'if' || op === 'if_else') {
    return blockJson('gtn_if_else', {
      COND: valueInputToBlock(step.condition || step.cond, false),
      THEN: statementInputToBlocks(step.then || []),
      ELSE: statementInputToBlocks(step.else || []),
    });
  }
  if (op === 'for_each') {
    /* Round 32 / 批次 AA：bind:"selected_card"（原 for_each_selected_card）与
       list 来源（原 for_each_list）都并进 for_each，反渲染按参数回原块。 */
    if (String(step.bind || '') === 'selected_card') {
      return blockJson('gtn_for_each_selected_card', {
        DO: statementInputToBlocks(step.steps || step.body || []),
      });
    }
    if (step.list !== undefined) {
      return blockJson('gtn_for_each_list', {
        LIST: valueInputToBlock(step.list, []),
        DO: statementInputToBlocks(step.steps || step.body || []),
      }, { NAME: String(step.name || step.as || 'item') });
    }
    return blockJson('gtn_for_each_target', {
      TARGETS: valueInputToBlock(step.items || step.targets || step.list || 'all_players', 'all_players'),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { VAR: String(step.as || step.var || 'target') });
  }
  if (op === 'repeat_until' || (op === 'repeat' && step.until !== undefined)) {
    return blockJson('gtn_repeat_until', {
      COND: valueInputToBlock(step.until ?? step.condition ?? step.cond, false),
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
  /* Round 42 / 批次 AF：``lifesteal_damage`` / ``triangle_damage`` 的反渲染
     一并删除（两个 op 已不存在，老工程里的同名步骤走兜底块）。 */
  /* Round 24：合并后的规范名（旧名只在 REMOVED_ATOMIC_OPS 里报错，不再进编辑器）。 */
  if (op === 'player_stat_change') {
    return blockJson('gtn_armor_op', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, {
      OP: String(step.mode || 'add'),
      STAT: String(step.stat || 'armor'),
    });
  }
  if (
    ['status_add_named', 'status_remove_named', 'set_status_named'].includes(op)
    && !(op === 'status_remove_named' && String(step.amount) === 'all')
  ) {
    return blockJson('gtn_named_status_op', {
      TARGET: valueInputToBlock(step.target, 'target'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, {
      /* Round 31 / 批次 Z：mode 化的 status_add_named 反向渲染成 mode 下拉；
         旧的 set_status_named 写法也照常打开（保存时升级成 mode:"set"）。 */
      OP: op === 'status_remove_named' ? 'remove' : String(step.mode || (op === 'set_status_named' ? 'set' : 'add')),
      STATUS: String(step.status || step.id || step.name || 'poison'),
    });
  }
  if (op === 'clear_statuses' && step.preset) {
    return blockJson('gtn_clear_status_op', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { WHAT: String(step.preset) });
  }
  if (op === 'clear_status' || (op === 'status_remove_named' && String(step.amount) === 'all')) {
    return blockJson('gtn_clear_status_op', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { WHAT: 'clear_status' });
  }
  if (op === 'resource_spend' || op === 'spend_resource') {
    return blockJson('gtn_pay_resource', {
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { RES: String(step.resource || 'e').startsWith('m') || String(step.resource) === 'magic' ? 'm' : 'e' });
  }
  /* Round 42 / 批次 AF：``turn_mod_add`` 的反渲染一并删除。 */
  if (op === 'set_health' || (op === 'health_op' && String(step.mode || '') === 'set')) {
    return blockJson('gtn_set_health', {
      TARGET: valueInputToBlock(step.target, 'source'),
      AMOUNT: valueInputToBlock(step.amount ?? step.value, 1),
    });
  }
  if (op === 'aura_enemy_elixir_recovery' || (op === 'resource_op' && String(step.mode || '') === 'aura_recovery')) {
    return blockJson('gtn_aura_enemy_elixir_recovery', {
      AMOUNT: valueInputToBlock(step.amount, -1),
    });
  }
  if (['player_prop_set', 'player_prop_add'].includes(op)) {
    /* 老写法（Round 29 前）仍然能反向渲染成同一块：op 名决定 mode。 */
    return blockJson('gtn_player_prop_set_add', {
      TARGET: valueInputToBlock(step.target, 'source'),
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { PROP: String(step.property || 'health'), MODE: op === 'player_prop_add' ? 'add' : 'set' });
  }
  if (op === 'player_prop_change') {
    return blockJson('gtn_player_prop_set_add', {
      TARGET: valueInputToBlock(step.target, 'source'),
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { PROP: String(step.property || 'health'), MODE: String(step.mode || 'set') });
  }
  if (['card_prop_set', 'card_prop_add', 'card_prop_mul'].includes(op)) {
    return blockJson('gtn_card_prop_set_add', {
      CARD: cardRefInputToBlock(step.card || 'current_card'),
      VALUE: valueInputToBlock(step.value ?? step.amount ?? step.multiplier, 0),
    }, { PROP: String(step.property || 'fusion_level'), MODE: op.replace('card_prop_', '') });
  }
  if (op === 'card_prop_change') {
    return blockJson('gtn_card_prop_set_add', {
      CARD: cardRefInputToBlock(step.card || 'current_card'),
      VALUE: valueInputToBlock(step.value ?? step.amount ?? step.multiplier, 0),
    }, { PROP: String(step.property || 'fusion_level'), MODE: String(step.mode || 'set') });
  }
  if (['equipment_prop_set', 'equipment_prop_add'].includes(op)) {
    return blockJson('gtn_equipment_prop_set_add', {
      EQUIPMENT: valueInputToBlock(step.equipment || 'current_equipment', 'current_equipment'),
      VALUE: valueInputToBlock(step.value ?? step.amount, 0),
    }, { PROP: String(step.property || 'turns_equipped'), MODE: op });
  }
  /* add_tag / remove_tag 的标签块由 gtn_card_tag_op_named 承接。 */
  if ((op === 'add_tag' && String(step.mode) !== 'clear') || op === 'remove_tag') {
    return blockJson('gtn_card_tag_op_named', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
    }, {
      OP: op === 'remove_tag' ? 'remove' : String(step.mode || 'add'),
      TAG: String(step.tag || step.flag || 'exile'),
    });
  }
  if (op === 'clear_tags' || (op === 'add_tag' && String(step.mode) === 'clear')) {
    return blockJson('gtn_clear_tags', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
    });
  }
  if (['multiply_next_damage', 'reduce_next_cost', 'increase_next_cost'].includes(op)) {
    return blockJson('gtn_fission_fusion', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
      AMOUNT: valueInputToBlock(step.amount ?? step.multiplier, 1),
    }, { OP: op });
  }
  /* Round 32 / 批次 AA：费用族并进 modify_next_cost（delta 正负定方向）。 */
  /* Round 43 / 批次 AG：``modify_next_cost`` 已删除——费用修正现在就是
     ``card_prop_add_to_zone(property:"temp_swift_value"/"temp_heavy_value")``，
     反渲染跟着换到这条数据写法上。 */
  if (op === 'card_prop_add_to_zone' && ['temp_swift_value', 'temp_heavy_value'].includes(step.property)) {
    const lighter = step.property === 'temp_swift_value';
    return blockJson('gtn_fission_fusion', {
      CARD: valueInputToBlock(step.card || 'current_card', 'current_card'),
      AMOUNT: valueInputToBlock(step.amount ?? step.value ?? 1, 1),
    }, { OP: lighter ? 'reduce_next_cost' : 'increase_next_cost' });
  }
  if (['move_to_hand', 'move_to_deck', 'move_to_discard', 'move_to_exile'].includes(op)) {
    return blockJson('gtn_move_current_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op.replace('move_to_', '') });
  }
  if (op === 'move_card') {
    /* Round 46 / 批次 AJ：``cards`` 位置（batch 形态）还原成"把…移动到…"块。 */
    if (step.cards !== undefined) {
      return blockJson('gtn_move_picked_card', {
        CARDS: cardRefInputToBlock(step.cards),
        TARGET: valueInputToBlock(step.owner ?? step.target ?? 'source', 'source'),
      }, { ZONE: String(step.target_zone || step.zone || step.to || 'deck') });
    }
    return blockJson('gtn_move_current_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: String(step.zone || step.to || 'discard') });
  }
  if (['give_card_to_hand', 'give_card_to_deck', 'give_card_to_discard', 'give_card_to_exile'].includes(op)) {
    return blockJson('gtn_give_card', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op.replace('give_card_to_', ''), CARD_ID: String(step.card_id || step.id || 'Basic') });
  }
  if (op === 'create_card' && String(step.to || step.zone || '') === 'discard') {
    /* Round 31 / 批次 Z：give_card_to_discard 的替代写法。 */
    return blockJson('gtn_give_card', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: 'discard', CARD_ID: String(step.card_id || step.id || 'Basic') });
  }
  if (op === 'request') {
    /* Round 36 / 批次 AD-1：请求伞按顶层 type 回到各条旧块；画布不建模的
       类别（target / reorder_deck）走"原样保留"的兜底块，效果行编辑器照常读写。 */
    const requestType = String(step.type || '').trim();
    if (requestType === 'zone') {
      return blockJson('gtn_choose_from_zone', {
        TARGET: valueInputToBlock(step.target, 'source'),
      }, { ZONE: String(step.zone || step.from || 'deck') });
    }
    if (requestType === 'card') {
      return blockJson('gtn_request_card_choice', {
        TARGET: valueInputToBlock(step.target, 'source'),
        MIN: valueInputToBlock(step.min_count, 1),
        MAX: valueInputToBlock(step.max_count, 1),
      }, {
        ZONE: String(step.zone || 'hand'),
        CARD_TYPE: String(step.card_type || ''),
      });
    }
    if (requestType === 'discount_copy') {
      return blockJson('gtn_copy_choice_discount', { DISCOUNT: valueInputToBlock(step.discount_e, 1) });
    }
    if (requestType === 'forced_target') {
      return blockJson('gtn_declare_forced_target', {
        TARGET: valueInputToBlock(step.target, 'self'),
      });
    }
    return blockJson('gtn_unknown_step', {}, { RAW: JSON.stringify(step ?? null) });
  }
  if (['choose_from_deck', 'choose_from_discard', 'choose_from_exile'].includes(op)) {
    return blockJson('gtn_choose_from_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: op.replace('choose_from_', '') });
  }
  if (op === 'choose_from_zone') {
    return blockJson('gtn_choose_from_zone', {
      TARGET: valueInputToBlock(step.target, 'source'),
    }, { ZONE: String(step.zone || step.from || 'deck') });
  }
  if (['reveal_enemy_hand', 'steal_enemy_card'].includes(op)) {
    return blockJson('gtn_reveal_or_steal', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: op });
  }
  if (op === 'reveal') {
    /* Round 33 / 批次 AB：reveal 伞的 enemy_hand / hand 两段回原块；
       card_set 段没有对应的画布块（效果行编辑器里可读可写）。 */
    const revealMode = String(step.mode || 'enemy_hand');
    if (revealMode === 'enemy_hand') {
      return blockJson('gtn_reveal_or_steal', {
        TARGET: valueInputToBlock(step.target, 'target'),
      }, { OP: 'reveal_enemy_hand' });
    }
    if (revealMode === 'hand') {
      return blockJson('gtn_reveal_hand_cards', {
        TARGET: valueInputToBlock(step.target, 'target'),
        VIEWER: valueInputToBlock(step.viewer || step.to, 'self'),
      }, { MARK: step.mark === false ? 'plain' : 'mark' });
    }
    return blockJson('gtn_unknown_step', {}, { RAW: JSON.stringify(step ?? null) });
  }
  if (op === 'shuffle' || op === 'snapshot' || op === 'restore') {
    /* Round 33 / 批次 AB：洗牌/快照/还原三伞目前只在效果行编辑器里编辑，
       画布给"原样保留"的兜底块（保存时逐字写回）。 */
    return blockJson('gtn_unknown_step', {}, { RAW: JSON.stringify(step ?? null) });
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
    }, {
      /* Round 31 / 批次 Z：老名字反向渲染成新的 mode 下拉值。 */
      OP: {
        destroy_equipment_choice_or_first: 'choice',
        destroy_self_equipment: 'self',
        destroy_all_destroyable_equipment: 'all:destroyable',
        destroy_random_equip: 'random',
        destroy_all_equip: 'all',
      }[op] || 'choice',
    });
  }
  if (op === 'destroy_equipment') {
    const mode = String(step.mode || 'choice');
    const scope = String(step.scope || 'target');
    const destroyable = String(step.filter || '').includes('destroyable') || String(step.filter || '').includes('destructible');
    const selected = scope === 'field' && mode === 'all'
      ? 'all'
      : (mode === 'all' && destroyable ? 'all:destroyable' : mode);
    return blockJson('gtn_destroy_equipment_generic', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: selected });
  }
  if (op === 'player_status_layers' || ['untargetable_layers', 'set_untargetable', 'set_invincible'].includes(op)) {
    /* Round 31 / 批次 Z：三条状态层数原子并进 player_status_layers。 */
    return blockJson('gtn_untargetable_layers', {
      TARGET: valueInputToBlock(step.target, 'self'),
      AMOUNT: valueInputToBlock(step.amount, 1),
    });
  }
  /* Round 42 / 批次 AF：``trigger_manual`` / ``emit_event`` 的反向渲染一并删除
     （两个 op 已不存在；"主动触发"块现在写 ``log`` 的静默形态）。 */
  if (op === 'log' && step.silent === true && !String(step.message ?? step.text ?? '')) {
    return blockJson('gtn_trigger_manual');
  }
  if (op === 'equip_reduce_draw') {
    return blockJson('gtn_equip_reduce_own_draw', {
      AMOUNT: valueInputToBlock(step.amount, 1),
    }, { WHO: String(step.target || 'self') });
  }
  /* Round 32 / 批次 AA：装备减抽并进 draw(count:0, modifiers=[sluggish])。 */
  if (op === 'draw' && Array.isArray(step.modifiers) && step.modifiers.length) {
    const modifier = step.modifiers[0] || {};
    return blockJson('gtn_equip_reduce_own_draw', {
      AMOUNT: valueInputToBlock(modifier.amount, 1),
    }, { WHO: String(modifier.target || 'self') });
  }
  if (op === 'player_prop_change' && String(step.property || '') === 'equipment_protection'
      && String(step.mode || 'set') === 'add' && Number(step.amount ?? step.value ?? 1) === 1) {
    return blockJson('gtn_equipment_protection');
  }
  /* Round 38 / 批次 AD-3：回合控制族三合一的反向渲染 —— end / skip 两个分支
     回到"行动控制"块；extra 分支（卡数据 0 步）画布没有对应形状，走兜底块。 */
  /* Round 45 / 批次 AI：蜜糖控制（旧 honey_control，现 mode:"forced_action"）
     回到"蜂蜜控制"块；老工程里的旧 op 名也一并反渲染成同一个块。 */
  if (op === 'honey_control'
      || (op === 'turn_control' && String(step.mode || '') === 'forced_action')) {
    return blockJson('gtn_honey_control', {
      TARGET: valueInputToBlock(step.target, 'target'),
      DURATION: valueInputToBlock(step.duration ?? 1, 1),
    });
  }
  if (op === 'turn_control' && ['end', 'skip'].includes(String(step.mode || 'end'))) {
    /* 「结束回合」分支不承载 target（引擎也不读它）——带上输入会让画布保存时
       凭空多出 target 键；「跳过回合」分支才需要目标。 */
    if (String(step.mode || 'end') === 'end') {
      return blockJson('gtn_control_effect', {}, { OP: 'end' });
    }
    return blockJson('gtn_control_effect', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: 'skip' });
  }
  /* Round 42 / 批次 AF：``action_filter`` / ``block_own_actions`` / ``block_action``
     的反渲染一并删除——禁止行动现在写 ``player_prop_change(set shovel_active)``，
     由通用玩家属性块承载。 */
  /* 老工程里的旧 op 名同形状反渲染（下拉值已换成伞分支名，见块定义）。 */
  if (['skip_turn', 'force_end_turn'].includes(op)) {
    return blockJson('gtn_control_effect', {
      TARGET: valueInputToBlock(step.target, 'target'),
    }, { OP: op === 'skip_turn' ? 'skip' : 'end' });
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
    }, { TARGET: String(step.target || 'self'), NAME: String(step.name || '变量'), MODE: op.replace('var_', '') });
  }
  if (op === 'player_var_change') {
    return blockJson('gtn_var_target_set_add', {
      VALUE: valueInputToBlock(step.value, 0),
    }, { TARGET: String(step.target || 'self'), NAME: String(step.name || '变量'), MODE: String(step.mode || 'set') });
  }
  if (['list_set', 'list_append', 'list_clear'].includes(op)) {
    return blockJson('gtn_list_op', {
      VALUE: valueInputToBlock(step.list ?? step.item, []),
    }, { NAME: String(step.name || '列表'), OP: op });
  }
  /* Round 32 / 批次 AA：列表五兄弟并进 list_modify（list/mode/value）。 */
  if (op === 'list_modify') {
    const mode = String(step.mode || 'set');
    return blockJson('gtn_list_op', {
      VALUE: valueInputToBlock(step.value, []),
    }, {
      NAME: String(step.list || step.name || '列表'),
      OP: { set: 'list_set', append: 'list_append', clear: 'list_clear' }[mode] || 'list_set',
    });
  }
  if (op === 'for_each_list') {
    return blockJson('gtn_for_each_list', {
      LIST: valueInputToBlock(step.list, []),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { NAME: String(step.name || 'item') });
  }
  /* Round 32 / 批次 AA：for_each_list / for_each_selected_card 并进 for_each。 */
  if (op === 'for_each' && String(step.bind || '') === 'selected_card') {
    return blockJson('gtn_for_each_selected_card', {
      DO: statementInputToBlocks(step.steps || step.body || []),
    });
  }
  if (op === 'for_each_list' || (op === 'for_each' && step.list !== undefined)) {
    return blockJson('gtn_for_each_list', {
      LIST: valueInputToBlock(step.list, []),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { NAME: String(step.name || step.as || 'item') });
  }
  if (op === 'for_each_selected_card') {
    return blockJson('gtn_for_each_selected_card', {
      DO: statementInputToBlocks(step.steps || step.body || []),
    });
  }
  /* Round 37 / 批次 AD-2：延迟族三合一的反向渲染 —— timed 分支回到
     gtn_timed_effect 块；blind / reveal_hand 两个预设画布没有专门的块
     （合并前也没有），走"原样保留"的兜底块，效果行编辑器照常读写。 */
  if (op === 'delayed_effect' && String(step.mode || 'timed') === 'timed') {
    return blockJson('gtn_timed_effect', {
      DURATION: valueInputToBlock(step.duration, 1),
      TARGET: valueInputToBlock(step.target, 'target'),
      DO: statementInputToBlocks(step.steps || step.body || []),
    }, { TRIGGER: String(step.trigger || 'target_turn_start') });
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

  /* --- Round 33 / 批次 AC：4 个伞原子的反向渲染 ---
     反向渲染把伞步骤还原成对应的伞块（保存时仍写回伞形状），只有步骤里真的
     有的键才接上输入；画布不承载的修饰键（log/silent/record_count 之外的
     长尾参数）留在 JSON 页签，不会被改写成别的形状。 */
  if (op === 'equipment_op') {
    const mode = String(step.mode || 'place');
    const inputs = {};
    if (step.target !== undefined) inputs.TARGET = valueInputToBlock(step.target, 'source');
    else if (step.owner !== undefined) inputs.TARGET = valueInputToBlock(step.owner, 'source');
    if (step.effect_target !== undefined) inputs.EFFECT_TARGET = valueInputToBlock(step.effect_target, 'source');
    if (step.card !== undefined) inputs.CARD = valueInputToBlock(step.card, 'current_card');
    if (mode === 'armor' || mode === 'seal') inputs.AMOUNT = valueInputToBlock(step.amount, 1);
    if (mode === 'each') inputs.DO = statementInputToBlocks(step.body || step.steps || []);
    const destroyable = String(step.filter || step.destructible || '').includes('destroyable');
    const pick = mode === 'destroy'
      ? `${String(step.pick || 'choice')}${destroyable ? ':destroyable' : ''}`
      : 'choice';
    return blockJson('gtn_equipment_op', inputs, { MODE: mode, PICK: pick });
  }
  if (op === 'status_op') {
    const rawAction = String(step.action || (String(step.mode || '') === 'set' ? 'set' : 'add'));
    const action = rawAction === 'add' && String(step.mode || '') === 'set' ? 'set' : rawAction;
    const inputs = {};
    if (step.target !== undefined) inputs.TARGET = valueInputToBlock(step.target, 'target');
    const fields = { ACTION: action };
    if (action === 'clear') {
      fields.LIST = step.preset ? String(step.preset) : 'all';
    } else if (step.status !== undefined) {
      fields.STATUS = String(step.status);
    }
    if (action !== 'settle' && step.amount !== undefined) {
      inputs.AMOUNT = valueInputToBlock(step.amount, 1);
    }
    if (action === 'settle' && step.reduce !== undefined) {
      inputs.REDUCE = valueInputToBlock(step.reduce, 1);
    }
    return blockJson('gtn_status_op', inputs, fields);
  }
  if (op === 'tag_op') {
    const action = String(step.action || step.mode || 'add');
    const zone = step.zone !== undefined
      ? String(step.zone)
      : (Array.isArray(step.zones) && step.zones.length === 1 ? String(step.zones[0]) : '');
    const inputs = {};
    if (step.card !== undefined) inputs.CARD = cardRefInputToBlock(step.card);
    if (step.target !== undefined) inputs.TARGET = valueInputToBlock(step.target, 'target');
    return blockJson('gtn_tag_op', inputs, { ACTION: action, ZONE: zone, TAG: String(step.tag || '') });
  }
  if (op === 'auto_play') {
    const mode = String(step.mode || 'card');
    const cost = mode === 'card'
      ? (step.no_cost === true ? 'free' : 'normal')
      : String(step.cost || 'normal');
    const inputs = {};
    if (step.card !== undefined) inputs.CARD = valueInputToBlock(step.card, 'current_card');
    if (step.actor !== undefined) inputs.ACTOR = valueInputToBlock(step.actor, 'equipment_target');
    return blockJson('gtn_auto_play', inputs, {
      MODE: mode,
      COST: cost,
      ZONE: String(step.zone || ''),
      ON_FAILURE: String(step.on_failure || ''),
    });
  }
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
  /* Round 46 / 批次 AJ：通用选择器 zone_card 的反渲染——数据里的
     {"selector":"zone_card",…} 还原成"在…里取…最大/最小的一张牌"块。
     它用 ``selector`` 键而不是 op/ref，所以要排在 op 判别之前。 */
  const selectorKind = (() => {
    if (value.selector) return String(value.selector);
    const ref = String(value.ref || value.op || value.type || '');
    return (ref === 'zone_card' || ref === 'zone_card_pick')
      && (value.pick || value.filter || value.as) ? 'zone_card' : '';
  })();
  if (selectorKind === 'zone_card') {
    const pick = value.pick && typeof value.pick === 'object' ? value.pick : {};
    const filter = value.filter && typeof value.filter === 'object' ? value.filter : {};
    return blockJson('gtn_card_zone_pick', {
      TARGET: valueInputToBlock(value.owner || 'source', 'source'),
    }, {
      ZONE: String(value.zone || 'hand'),
      BY: String(pick.by || 'cost_e'),
      MODE: String(pick.mode || 'max'),
      TYPE: String(filter.card_type || 'any'),
      TIE: String(pick.tie || 'first'),
      AS: String(value.as || value.save_as || ''),
    });
  }
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
  /* Round 33 / 批次 AC：卡引用 / 装备目标 的对象写法要还原成对应块，
     否则会掉进 gtn_text 变成一串 JSON 文本。 */
  if (op === 'current_card' || op === 'this_card') return blockJson('gtn_card_current');
  if (op === 'selected_card' || op === 'chosen_card' || op === 'choice_card') return blockJson('gtn_card_chosen');
  if (op === 'equipment_target' || op === 'equip_target') return blockJson('gtn_value_equipment_target');
  if (op === 'hit_count' || op === 'damage_hits') return blockJson('gtn_value_hit_count');
  if (op === 'last_positive_hits' || op === 'positive_hits') return blockJson('gtn_value_last_positive_hits');
  if (op === 'equipment_count') {
    return blockJson('gtn_value_equipment_count', {
      TARGET: valueInputToBlock(value.target || 'source', 'source'),
    });
  }
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

/* Round 46 / 批次 AJ：卡片位上的 ``{"ref":"<名字>"}`` 是"区域选牌"块用
   ``as`` 绑定的那张牌，还原成"刚才记住的牌"块；其余引用照旧走 astValueToBlock。 */
const NAMED_CARD_REF_IGNORE = [
  'current_card', 'this_card', 'selected_card', 'chosen_card', 'choice_card',
  'last_created_card', 'created_card', 'event_card', 'used_card', 'trigger_card',
  'destroyed_card', 'card_instance', 'var', 'list_item', 'zone_card', 'zone_card_pick',
];

function cardRefInputToBlock(value, fallback = 'current_card') {
  if (
    value && typeof value === 'object' && typeof value.ref === 'string'
    && value.ref && !NAMED_CARD_REF_IGNORE.includes(value.ref)
  ) {
    return { block: blockJson('gtn_card_named_ref', {}, { NAME: value.ref }) };
  }
  return valueInputToBlock(value, fallback);
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
