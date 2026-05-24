import * as Blockly from 'blockly';

const COLORS = {
  TRIGGER: 24,
  TARGET: 55,
  ACTION: 350,
  STATUS: 300,
  RESOURCE: 185,
  EQUIP: 220,
  CARD: 260,
  VARIABLE: 32,
  LOGIC: 120,
  VALUE: 145,
};

const CARD_TYPES = [
  ['攻击', 'thorn'],
  ['技能', 'bloom'],
  ['反制', 'guard'],
  ['装备', 'root'],
  ['任意类型', 'any'],
];

const QUALITY = [
  ['Common', 'Common'],
  ['Unusual', 'Unusual'],
  ['Epic', 'Epic'],
  ['Ultra', 'Ultra'],
  ['Super', 'Super'],
];

const TAGS = [
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

const STATUS = [
  ['中毒', 'poison'],
  ['灼烧', 'burn'],
  ['易伤', 'vulnus'],
  ['淬毒', 'toxic'],
  ['闪避', 'dodge'],
  ['无敌', 'invincible'],
  ['不可选中', 'untargetable'],
  ['邪眼', '邪眼'],
];

const ATTRIBUTES = [
  ['生命 H', 'health'],
  ['能量 E', 'energy'],
  ['魔力 M', 'magic'],
  ['护甲 A', 'armor'],
  ['手牌数', 'hand_size'],
  ['抽牌堆数量', 'deck_remaining'],
  ['弃牌堆数量', 'discard_size'],
  ['放逐区数量', 'exile_size'],
  ['装备数量', 'equip_count'],
];

const COMPARE = [['=', '='], ['≠', '!='], ['<', '<'], ['>', '>'], ['≤', '<='], ['≥', '>=']];
const MATH_OP = [['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/'], ['取余', '%']];
const ROUND_MODE = [['向上取整', 'ceil'], ['向下取整', 'floor'], ['四舍五入', 'round']];

function numberField(name, value = 1) {
  return { type: 'field_number', name, value, precision: 1 };
}

function numberInput(name) {
  return { type: 'input_value', name, check: 'Number' };
}

function variableOptions() {
  const model = globalThis.window?.gardenModStudio?.model || {};
  const names = new Set();
  for (const variable of model.variables || []) {
    const value = String(variable.name || variable.id || '').trim();
    if (value) names.add(value);
  }
  const scanEffects = effects => {
    for (const effect of effects || []) {
      const params = effect?.params || {};
      if (params.name) names.add(String(params.name));
      for (const key of ['then', 'else', 'body', 'effects', 'a', 'b']) {
        if (Array.isArray(params[key])) scanEffects(params[key]);
      }
    }
  };
  for (const key of ['cards', 'events', 'custom_statuses', 'custom_tags']) {
    for (const item of model[key] || []) {
      scanEffects(item.effects || []);
      scanEffects(item.script?.effects || []);
      const xml = item.script?.xml || '';
      for (const match of xml.matchAll(/<field name="NAME">([^<]*)<\/field>/g)) {
        const value = match[1].trim();
        if (value) names.add(value);
      }
    }
  }
  const options = Array.from(names).map(value => [value, value]);
  return options.length ? options : [['先添加变量', '']];
}

function variableField(name = 'NAME') {
  return { type: 'field_dropdown', name, options: variableOptions };
}

Blockly.defineBlocksWithJsonArray([
  {
    type: 'trigger_on_play',
    message0: '当卡牌打出时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_event_apply',
    message0: '当开局事件生效时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_status_exists',
    message0: '当状态存在时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_tag_exists',
    message0: '当标签存在时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_friendly_turn_start',
    message0: '当自己或队友回合开始时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_enemy_turn_start',
    message0: '当敌方回合开始时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_phys_damage',
    message0: '当 %1 受到物理伤害时',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_any_damage',
    message0: '当 %1 受到任意伤害时',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_destroy',
    message0: '当此装备被摧毁时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_event',
    message0: '当广播事件 %1 发生时',
    args0: [{ type: 'field_input', name: 'EVENT_NAME', text: '事件名' }],
    output: 'Trigger',
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_manual',
    message0: '可手动触发 时机 %1 消耗 %2 E %3 M 条件 %4 触发后摧毁 %5',
    args0: [
      { type: 'field_dropdown', name: 'TIMING', options: [['装备一回合后', 'after_one_turn'], ['立即', 'immediate'], ['每回合一次', 'once_per_turn']] },
      numberField('COST_E', 0),
      numberField('COST_M', 0),
      { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
      { type: 'field_checkbox', name: 'DESTROY', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'response_declare',
    message0: '声明为反制 响应 %1 消耗 %2 E %3 M',
    args0: [
      { type: 'field_dropdown', name: 'TIMING', options: [['攻击牌', 'thorn'], ['技能牌', 'bloom'], ['装备牌', 'root'], ['任意行动', 'any']] },
      numberField('COST_E', 0),
      numberField('COST_M', 0),
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'event_owner_turn_start',
    message0: '兼容：当此牌在装备栏中，轮到装备者回合时 %1 执行 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'event_enemy_turn_start',
    message0: '兼容：当此牌在装备栏中，轮到敌方回合时 %1 执行 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'event_damage_taken',
    message0: '兼容：当此牌在装备栏中，装备者受到物理伤害时 %1 执行 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'event_equipment_trigger',
    message0: '兼容：当此牌在装备栏中被手动触发 摧毁自己 %1 %2 执行 %3',
    args0: [
      { type: 'field_checkbox', name: 'DESTROY', checked: true },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_any_turn_start',
    message0: '当此牌在装备栏中，任意玩家回合开始时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_owner_turn_start',
    message0: '当此牌在装备栏中，轮到装备者回合时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_owner_turn_ready',
    message0: '当此牌在装备栏中，已装备至少 %1 回合并轮到装备者回合时',
    args0: [numberInput('MIN_TURNS')],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_enemy_turn_start',
    message0: '当此牌在装备栏中，轮到敌方回合时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_damage_taken',
    message0: '当此牌在装备栏中，装备者受到物理伤害时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_manual_trigger',
    message0: '当此牌在装备栏中被手动触发 摧毁自己 %1',
    args0: [{ type: 'field_checkbox', name: 'DESTROY', checked: true }],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'aura_enemy_elixir_recovery',
    message0: '光环：作用目标回合开始 E 回复变化 %1',
    args0: [numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },

  { type: 'target_self', message0: '自己', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_teammate', message0: '队友', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_friendly', message0: '己方', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_enemy', message0: '敌方', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_all_enemies', message0: '所有敌方玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_both', message0: '双方所有玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_random_friendly', message0: '随机己方玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_random_enemy', message0: '随机敌方玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_random_player', message0: '随机玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_random_side', message0: '随机一方', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_event_target', message0: '当前事件目标', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_event_source', message0: '当前事件来源', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_last_actor', message0: '上一次行动者', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_choice', message0: '所选目标', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_highest_health', message0: '生命最高的玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_lowest_health', message0: '生命最低的玩家', output: 'Target', colour: COLORS.TARGET },

  {
    type: 'action_request_target',
    message0: '弹出目标选择窗口 候选 %1 可取消 %2',
    args0: [
      { type: 'input_value', name: 'TARGETS', check: 'Target' },
      { type: 'field_checkbox', name: 'CANCELLABLE', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },

  {
    type: 'action_damage',
    message0: '对 %1 造成 %2 D 精准 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('AMOUNT'),
      { type: 'field_checkbox', name: 'IS_PRECISION', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_damage_multi',
    message0: '对 %1 造成 %2 D，重复 %3 次 精准 %4',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('AMOUNT'),
      numberInput('TIMES'),
      { type: 'field_checkbox', name: 'IS_PRECISION', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_direct_damage',
    message0: '对 %1 造成 %2 点直接伤害 来源 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('AMOUNT'),
      { type: 'field_input', name: 'SOURCE', text: '效果' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_lifesteal_damage',
    message0: '对 %1 造成 %2 D，若造成伤害则回复 %3 H',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('AMOUNT'),
      numberInput('HEAL'),
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_triangle_damage',
    message0: '三角形伤害 对 %1 基础 %2 每层 +%3 上限 %4',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('BASE'),
      numberInput('PER_STACK'),
      numberInput('MAX_STACKS'),
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_heal',
    message0: '为 %1 回复 %2 H',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_set_health',
    message0: '将 %1 的 H 设为 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_add_armor',
    message0: '为 %1 增加 %2 A',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_remove_armor',
    message0: '减少 %1 的 %2 A',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_set_armor',
    message0: '将 %1 的 A 设为 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  { type: 'action_dodge_this', message0: '获得 1 层本次闪避', previousStatement: null, nextStatement: null, colour: COLORS.ACTION },
  {
    type: 'action_dodge_permanent',
    message0: '获得 %1 层常驻闪避',
    args0: [numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },

  {
    type: 'action_poison',
    message0: '对 %1 施加 %2 层中毒',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_burn',
    message0: '对 %1 施加 %2 层灼烧',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_vulnus',
    message0: '对 %1 施加 %2 层易伤',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_toxic',
    message0: '对 %1 施加 %2 层淬毒',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_status_add_named',
    message0: '为 %1 添加状态 %2 层数 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_status_remove_named',
    message0: '移除 %1 的状态 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_add_named',
    message0: '给当前卡牌添加自定义标签 %1',
    args0: [{ type: 'field_input', name: 'TAG', text: '邪眼' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_remove_named',
    message0: '移除当前卡牌的自定义标签 %1',
    args0: [{ type: 'field_input', name: 'TAG', text: '邪眼' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_add_tag',
    message0: '给当前卡牌添加标签 %1',
    args0: [{ type: 'field_dropdown', name: 'TAG', options: TAGS }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_remove_tag',
    message0: '移除当前卡牌标签 %1',
    args0: [{ type: 'field_dropdown', name: 'TAG', options: TAGS }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_clear_buffs',
    message0: '清除 %1 的正面效果',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_clear_debuffs',
    message0: '清除 %1 的负面效果',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_clear_all_effects',
    message0: '清除 %1 的全部效果',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_clear_status',
    message0: '清除 %1 的 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'STATUS', options: STATUS }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },

  {
    type: 'action_gain_e',
    message0: '为 %1 回复 %2 E',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_gain_m',
    message0: '为 %1 回复 %2 M',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_cost_e',
    message0: '使 %1 消耗 %2 E',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_cost_m',
    message0: '使 %1 消耗 %2 M',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_mod_e_regen',
    message0: '调整 %1 每回合回 E %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_mod_m_regen',
    message0: '调整 %1 每回合回 M %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_mod_draw',
    message0: '调整 %1 每回合抽牌 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_draw',
    message0: '使 %1 抽 %2 张牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  { type: 'action_discard', message0: '自己弃 %1 张牌', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  { type: 'action_discard_choice_then_draw', message0: '选择一张手牌丢弃，然后抽 1 张；未选择则直接抽 1 张', previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  { type: 'action_coffee_gain_e', message0: '兼容：咖啡式回复 E 平时 +%1 第一次额外 +%2', args0: [numberInput('AMOUNT'), numberInput('FIRST_BONUS')], previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  { type: 'action_choose_from_deck', message0: '从自己抽牌堆选择一张加入手牌', previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  { type: 'action_choose_from_discard', message0: '从自己弃牌堆选择一张加入手牌', previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  { type: 'action_choose_from_exile', message0: '从自己放逐区选择一张加入手牌', previousStatement: null, nextStatement: null, colour: COLORS.RESOURCE },
  {
    type: 'action_reveal_hand',
    message0: '展示 %1 的手牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },
  {
    type: 'action_steal_card',
    message0: '从 %1 手牌中选择一张加入自己手牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.RESOURCE,
  },

  {
    type: 'action_destroy_random_equip',
    message0: '随机摧毁 %1 的一件装备',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_destroy_all_equip',
    message0: '摧毁 %1 的全部可摧毁装备',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_destroy_all_field_equip', message0: '摧毁场上全部可摧毁装备', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_destroy_equipment_choice_or_first',
    message0: '摧毁 %1 选择的一张装备；未选择则摧毁第一张可摧毁装备',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_destroy_all_destroyable_equipment',
    message0: '摧毁 %1 的全部可摧毁装备',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_equip_this_card', message0: '装备此牌', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_disc_armor', message0: '兼容：圆盘式装备护甲 +%1（可拆成条件 + 护甲）', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_sponge', message0: '装备效果：海绵式伤害转毒', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_set_health', message0: '装备效果：将自己 H 设为 %1', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_reduce_own_draw', message0: '装备效果：自己每回合少抽 %1 张牌', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_reduce_own_e', message0: '装备效果：自己每回合少回复 %1 E', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_on_destroy_remove_poison_damage', message0: '装备被摧毁时：清除中毒并受到层数 ×%1 物理伤害', args0: [numberInput('MULTIPLIER')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_activate_corruption', message0: '激活此腐化装备', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_magic_battery_gain_m',
    message0: '魔法电池式回魔 为 %1 +%2 M 每回合上限 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT'), numberInput('LIMIT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_destroy_self_equipment', message0: '摧毁此装备', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_protection', message0: '保护当前装备免于一次摧毁', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_remove_equip_protection',
    message0: '移除 %1 的装备保护',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_place_as_equip', message0: '将当前卡牌作为装备放置', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_block_action',
    message0: '禁止 %1 行动',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_block_card_type',
    message0: '禁止 %1 使用 %2 持续 %3 回合',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES }, numberInput('DURATION')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_force_card_type',
    message0: '限制 %1 只能使用 %2 持续 %3 回合',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES }, numberInput('DURATION')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_nullify_current_card',
    message0: '使当前 %1 无效',
    args0: [{ type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_invincible',
    message0: '使 %1 无敌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_untargetable',
    message0: '使 %1 不可被选中',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_skip_turn',
    message0: '跳过 %1 的下个回合',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_extra_turn',
    message0: '给 %1 一个额外回合',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_force_end_turn', message0: '立刻结束当前回合', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },

  {
    type: 'action_fission',
    message0: '选择一张 %1 牌，裂变层数增加 %2',
    args0: [{ type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES }, numberInput('TIMES')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_fusion',
    message0: '选择 %1 到 %2 张同名 %3 牌并聚变',
    args0: [numberInput('MIN_COUNT'), numberInput('MAX_COUNT'), { type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  { type: 'action_multiply_next_damage', message0: '下次伤害乘以 %1', args0: [numberInput('MULTIPLIER')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_reduce_next_cost', message0: '下次费用减少 %1', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_increase_next_cost', message0: '下次费用增加 %1', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_transform_card', message0: '变换当前卡牌', previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_copy_card', message0: '复制当前卡牌到手牌', previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_copy_choice_with_discount', message0: '复制所选手牌，并使复制牌下次费用 -%1 E', args0: [numberInput('DISCOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  {
    type: 'action_give_card_to_hand',
    message0: '给 %1 一张牌 %2 到手牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'CARD', text: 'Basic' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_remove_specific_card',
    message0: '从 %1 的 %2 移除牌 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'ZONE', options: [['手牌', 'hand'], ['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['放逐区', 'exile']] },
      { type: 'field_input', name: 'CARD', text: 'Basic' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  { type: 'action_exile_this', message0: '放逐当前卡牌', previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_move_to_discard', message0: '当前卡牌进入弃牌堆', previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  {
    type: 'action_move_to_deck',
    message0: '当前卡牌回到抽牌堆 %1',
    args0: [{ type: 'field_dropdown', name: 'POSITION', options: [['顶部', 'top'], ['底部', 'bottom'], ['随机', 'random']] }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  { type: 'passive_fatal_set_health_exile', message0: '被动：受到致命伤害时 H 设为 %1，清除效果、无敌并放逐此牌', args0: [numberInput('HEALTH')], previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_dodge', message0: '反制效果：获得 %1 层闪避', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_nazar', message0: '反制效果：获得邪眼护符效果', previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_equip_protect', message0: '反制效果：获得 %1 层装备保护', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_negate_skill', message0: '反制效果：使敌方下一张技能牌失效', previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_block_enemy_attacks', message0: '反制效果：敌方本回合不能攻击，持续 %1 回合', args0: [numberInput('DURATION')], previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  { type: 'counter_set_invincible_then_die', message0: '反制效果：致命伤后无敌到自己下回合结束，然后死亡', previousStatement: null, nextStatement: null, colour: COLORS.TRIGGER },
  {
    type: 'raw_effect_json',
    message0: '原始效果数据 %1',
    args0: [{ type: 'field_input', name: 'JSON', text: '{"type":"unknown","params":{}}' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },

  {
    type: 'value_var',
    message0: '%1 的变量 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME')],
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'condition_var_compare',
    message0: '%1 的变量 %2 %3 %4',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), { type: 'field_dropdown', name: 'OP', options: COMPARE }, numberInput('VALUE')],
    output: 'Boolean',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_var_set',
    message0: '将 %1 的变量 %2 设为 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_var_add',
    message0: '将 %1 的变量 %2 增加 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_var_sub',
    message0: '将 %1 的变量 %2 减少 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_var_mul',
    message0: '将 %1 的变量 %2 乘以 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_var_div',
    message0: '将 %1 的变量 %2 除以 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_batch_var_add',
    message0: '批量：为 %1 的变量 %2 增加 %3',
    args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_batch_var_sub',
    message0: '批量：为 %1 的变量 %2 减少 %3',
    args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, variableField('NAME'), numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },

  {
    type: 'control_if',
    message0: '如果 %1 那么 %2',
    args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_if_else',
    message0: '如果 %1 那么 %2 否则 %3',
    args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }, { type: 'input_statement', name: 'ELSE' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_repeat',
    message0: '重复 %1 次 %2',
    args0: [numberInput('TIMES'), { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_for_each',
    message0: '对 %1 中每个玩家执行 %2',
    args0: [{ type: 'input_value', name: 'TARGET_LIST', check: 'Target' }, { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_random',
    message0: '随机二选一 %1 或者 %2',
    args0: [{ type: 'input_statement', name: 'BRANCH_A' }, { type: 'input_statement', name: 'BRANCH_B' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_compare',
    message0: '%1 %2 %3',
    args0: [numberInput('A'), { type: 'field_dropdown', name: 'OP', options: COMPARE }, numberInput('B')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_status_named',
    message0: '%1 拥有状态 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_status',
    message0: '%1 拥有 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'STATUS', options: STATUS }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_tag',
    message0: '当前卡牌拥有标签 %1',
    args0: [{ type: 'field_dropdown', name: 'TAG', options: TAGS }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_target_attribute',
    message0: '%1 的 %2 %3 %4',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'ATTR', options: ATTRIBUTES }, { type: 'field_dropdown', name: 'OP', options: COMPARE }, numberInput('VALUE')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_and_or',
    message0: '%1 %2 %3',
    args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }, { type: 'field_dropdown', name: 'OP', options: [['且', 'and'], ['或', 'or']] }, { type: 'input_value', name: 'B', check: 'Boolean' }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_not',
    message0: '不满足 %1',
    args0: [{ type: 'input_value', name: 'BOOL', check: 'Boolean' }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  { type: 'value_number', message0: '%1', args0: [numberField('NUM', 1)], output: 'Number', colour: COLORS.VALUE },
  {
    type: 'value_target_attribute',
    message0: '%1 的 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'ATTR', options: ATTRIBUTES }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  { type: 'value_incoming_damage', message0: '本次即将受到的伤害', output: 'Number', colour: COLORS.VALUE },
  {
    type: 'value_last_damage',
    message0: '%1 上一次受到的伤害',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_status_count',
    message0: '%1 的状态 %2 层数',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_equipment_count_named',
    message0: '%1 装备栏中 ID 为 %2 的装备数',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'CARD_ID', text: 'Disc' }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_math_op',
    message0: '%1 %2 %3',
    args0: [numberInput('A'), { type: 'field_dropdown', name: 'OP', options: MATH_OP }, numberInput('B')],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_round',
    message0: '%1 %2',
    args0: [{ type: 'field_dropdown', name: 'MODE', options: ROUND_MODE }, numberInput('VALUE')],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_min_max',
    message0: '%1 %2 和 %3',
    args0: [{ type: 'field_dropdown', name: 'MODE', options: [['较小值', 'min'], ['较大值', 'max']] }, numberInput('A'), numberInput('B')],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_random',
    message0: '随机整数 %1 到 %2',
    args0: [numberInput('MIN'), numberInput('MAX')],
    output: 'Number',
    colour: COLORS.VALUE,
  },
]);

const INLINE_PREFIXES = [
  'target_', 'action_', 'condition_', 'value_', 'counter_', 'passive_', 'aura_', 'response_',
];
const INLINE_TYPES = [
  'trigger_on_phys_damage',
  'trigger_on_any_damage',
  'equipment_any_turn_start',
  'equipment_owner_turn_start',
  'equipment_owner_turn_ready',
  'equipment_enemy_turn_start',
  'equipment_damage_taken',
  'equipment_manual_trigger',
  'trigger_manual',
  'control_if',
  'control_if_else',
  'control_repeat',
  'control_for_each',
  'control_random',
  'math_number',
];

function enhanceBlock(type, { inline = false, hat = false } = {}) {
  const definition = Blockly.Blocks[type];
  if (!definition?.init || definition.__gardenEnhanced) return;
  const originalInit = definition.init;
  definition.init = function() {
    originalInit.call(this);
    if (inline) this.setInputsInline(true);
    if (hat) this.hat = 'cap';
  };
  definition.__gardenEnhanced = true;
}

for (const type of Object.keys(Blockly.Blocks)) {
  if (INLINE_PREFIXES.some(prefix => type.startsWith(prefix)) || INLINE_TYPES.includes(type)) {
    enhanceBlock(type, { inline: true, hat: false });
  }
}

for (const type of [
  'trigger_on_play',
  'trigger_event_apply',
  'trigger_status_exists',
  'trigger_tag_exists',
  'trigger_on_friendly_turn_start',
  'trigger_on_enemy_turn_start',
  'trigger_on_phys_damage',
  'trigger_on_any_damage',
  'trigger_on_destroy',
  'equipment_any_turn_start',
  'equipment_owner_turn_start',
  'equipment_owner_turn_ready',
  'equipment_enemy_turn_start',
  'equipment_damage_taken',
  'equipment_manual_trigger',
]) {
  enhanceBlock(type, { inline: true, hat: true });
}

export { CARD_TYPES, QUALITY, TAGS, STATUS, ATTRIBUTES };
