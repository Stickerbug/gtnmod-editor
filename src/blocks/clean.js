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
  ['装备摧毁保护', 'equip_protection'],
  ['无敌', 'invincible'],
  ['不可选中', 'untargetable'],
  ['邪眼', '邪眼'],
];

const EQUIP_PROPERTIES = [
  ['已装备回合', 'turns_equipped'],
  ['作用目标玩家编号', 'effect_target'],
  ['腐化已激活 1/0', 'corruption_active'],
  ['装备者编号', 'owner'],
];

const CARD_PROPERTIES = [
  ['聚变层数', 'fusion_level'],
  ['裂变层数', 'fission_level'],
  ['E费用', 'cost_e'],
  ['M费用', 'cost_m'],
  ['拟态减费', 'mimic_discount'],
  ['额外伤害', 'bonus_damage'],
  ['回手倒计时', 'return_to_hand_turns'],
  ['持有回合', 'held_turns'],
];

const CARD_DEFINITION_PROPERTIES = [
  ['E费用', 'cost_e'],
  ['M费用', 'cost_m'],
  ['效果描述', 'effect_text'],
  ['趣味描述', 'description'],
  ['类型', 'card_type'],
  ['品质', 'quality'],
  ['数量/权重', 'count'],
  ['中文名', 'name_cn'],
  ['英文名', 'name_en'],
  ['触发E费用', 'trigger_cost_e'],
  ['触发效果文字', 'trigger_effect_text'],
];

const PLAYER_PROPERTIES = [
  ['生命 H', 'health'],
  ['最大生命', 'max_health'],
  ['能量 E', 'elixir'],
  ['能量上限', 'max_elixir'],
  ['魔力 M', 'magic'],
  ['魔力上限', 'max_magic'],
  ['护甲 A', 'armor'],
  ['闪避', 'dodge'],
  ['中毒', 'poison'],
  ['灼烧', 'fire'],
  ['易伤', 'vulnerable'],
  ['淬毒', 'toxic'],
  ['装备摧毁保护', 'equipment_protection'],
  ['禁止攻击回合', 'attack_blocked'],
  ['只能攻击回合', 'attack_only'],
  ['抽牌减少', 'enemy_draw_reduction'],
  ['回 E 减少', 'enemy_e_reduction'],
  ['无敌 1/0', 'invincible'],
  ['不可选中 1/0', 'untargetable'],
  ['绷带激活 1/0', 'bandage_active'],
  ['海绵激活 1/0', 'sponge_active'],
  ['铲子限制 1/0', 'shovel_active'],
  ['跳过回合 1/0', 'skip_turn'],
  ['下一张技能无效 1/0', 'negate_next_skill'],
  ['邪眼激活 1/0', 'nazar_active'],
  ['邪眼大伤计数', 'nazar_big_hits'],
  ['手牌数', 'hand_size'],
  ['手牌上限', 'hand_limit'],
  ['手牌上限额外加成', 'extra_hand_limit_bonus'],
  ['抽牌堆数量', 'deck_remaining'],
  ['弃牌堆数量', 'discard_size'],
  ['放逐区数量', 'exile_size'],
  ['装备数量', 'equip_count'],
  ['本回合受到伤害', 'turn_damage_taken'],
  ['本回合造成伤害', 'turn_damage_dealt'],
  ['累计受到伤害', 'total_damage_taken'],
  ['累计造成伤害', 'total_damage_dealt'],
];

const PLAYER_CHANGE_PROPERTIES = [
  ['生命 H', 'health'],
  ['最大生命', 'max_health'],
  ['能量 E', 'elixir'],
  ['能量上限', 'max_elixir'],
  ['魔力 M', 'magic'],
  ['魔力上限', 'max_magic'],
  ['护甲 A', 'armor'],
  ['闪避', 'dodge'],
  ['中毒', 'poison'],
  ['灼烧', 'fire'],
  ['易伤', 'vulnerable'],
  ['淬毒', 'toxic'],
  ['装备摧毁保护', 'equipment_protection'],
  ['手牌上限', 'hand_limit'],
];

const CHANGE_DIRECTIONS = [
  ['增加', 'increase'],
  ['减少', 'decrease'],
  ['变化', 'change'],
];

const RESOURCE_TYPES = [
  ['E', 'elixir'],
  ['M', 'magic'],
];

const ATTRIBUTES = [
  ['生命 H', 'health'],
  ['能量 E', 'energy'],
  ['魔力 M', 'magic'],
  ['护甲 A', 'armor'],
  ['手牌数', 'hand_size'],
  ['手牌上限', 'hand_limit'],
  ['抽牌堆数量', 'deck_remaining'],
  ['弃牌堆数量', 'discard_size'],
  ['放逐区数量', 'exile_size'],
  ['装备数量', 'equip_count'],
  ['本回合受到伤害', 'turn_damage_taken'],
  ['本回合造成伤害', 'turn_damage_dealt'],
  ['累计受到伤害', 'total_damage_taken'],
  ['累计造成伤害', 'total_damage_dealt'],
];

const COMPARE = [['=', '='], ['≠', '!='], ['<', '<'], ['>', '>'], ['≤', '<='], ['≥', '>=']];
const MATH_OP = [['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/'], ['取余', '%']];
const ROUND_MODE = [['向上取整', 'ceil'], ['向下取整', 'floor'], ['四舍五入', 'round']];

const LIST_ZONE = [['手牌', 'hand'], ['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['装备区', 'equipment'], ['放逐区', 'exile']];

const EQUIPMENT_LOOP_FILTER = [
  ['全部装备', 'all'],
  ['可摧毁装备', 'destroyable'],
  ['不可摧毁装备', 'indestructible'],
  ['指定ID装备', 'named'],
  ['作用于同一目标的装备', 'current_target'],
];

const DAMAGE_SOURCE_RELATION = [
  ['任意来源', 'any'],
  ['来自自身', 'self'],
  ['来自队友', 'friendly'],
  ['来自己方', 'same_side'],
  ['来自敌方', 'enemy'],
];

const EVENT_RELATION = [
  ['自己', 'self'],
  ['队友', 'teammate'],
  ['友方', 'friendly'],
  ['敌方', 'enemy'],
  ['双方', 'both'],
  ['任意玩家', 'any'],
];

const TIMER_TRIGGER = [
  ['目标回合开始', 'target_turn_start'],
  ['自己回合开始', 'owner_turn_start'],
  ['友方回合开始', 'friendly_turn_start'],
  ['敌方回合开始', 'enemy_turn_start'],
  ['任意玩家回合开始', 'any_turn_start'],
];

function numberField(name, value = 1) {
  return { type: 'field_number', name, value, precision: 1 };
}

function numberInput(name) {
  return { type: 'input_value', name, check: 'Number' };
}

function anyInput(name) {
  return { type: 'input_value', name };
}

function uniqueOptions(options) {
  const seen = new Set();
  const result = [];
  for (const [label, value] of options) {
    const key = String(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push([label || key, key]);
  }
  return result;
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

function statusOptions() {
  const model = globalThis.window?.gardenModStudio?.model || {};
  const options = [...STATUS];
  for (const status of model.custom_statuses || []) {
    const value = String(status.id || status.name || '').trim();
    const label = String(status.name || status.id || '').trim();
    if (value) options.push([label || value, value]);
  }
  return uniqueOptions(options);
}

function tagOptions() {
  const model = globalThis.window?.gardenModStudio?.model || {};
  const options = [...TAGS];
  for (const tag of model.custom_tags || []) {
    const value = String(tag.id || tag.name || '').trim();
    const label = String(tag.name || tag.id || '').trim();
    if (value) options.push([label || value, value]);
  }
  return uniqueOptions(options);
}

function cardOptions() {
  const model = globalThis.window?.gardenModStudio?.model || {};
  const options = [];
  for (const card of model.cards || []) {
    const value = String(card.id || card.name || '').trim();
    const label = String(card.name || card.id || '').trim();
    if (value) options.push([label || value, value]);
  }
  const unique = uniqueOptions(options);
  return unique.length ? unique : [['Basic', 'Basic']];
}

function statusField(name = 'STATUS') {
  return { type: 'field_dropdown', name, options: statusOptions };
}

function tagField(name = 'TAG') {
  return { type: 'field_dropdown', name, options: tagOptions };
}

function cardInput(name = 'CARD') {
  return { type: 'input_value', name, check: 'CardRef' };
}

function equipmentInput(name = 'EQUIPMENT') {
  return { type: 'input_value', name, check: 'EquipmentRef' };
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
    message0: '当 %1 受到物理伤害时 来源记为 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('SOURCE_VAR')],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_any_damage',
    message0: '当 %1 受到任意伤害时 来源记为 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('SOURCE_VAR')],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_damage_from',
    message0: '当 %1 受到 %2 伤害时 来源记为 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'RELATION', options: DAMAGE_SOURCE_RELATION },
      variableField('SOURCE_VAR'),
    ],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_card_used',
    message0: '当 %1 使用 %2 手牌时',
    args0: [
      { type: 'field_dropdown', name: 'RELATION', options: EVENT_RELATION },
      { type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES },
    ],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_equipment_triggered',
    message0: '当 %1 触发装备时',
    args0: [{ type: 'field_dropdown', name: 'RELATION', options: EVENT_RELATION }],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_equipment_destroyed',
    message0: '当 %1 的装备被摧毁时',
    args0: [{ type: 'field_dropdown', name: 'RELATION', options: EVENT_RELATION }],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_resource_spent',
    message0: '当 %1 每消耗 %2 %3 时',
    args0: [
      { type: 'field_dropdown', name: 'RELATION', options: EVENT_RELATION },
      numberInput('AMOUNT'),
      { type: 'field_dropdown', name: 'RESOURCE', options: RESOURCE_TYPES },
    ],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_on_player_stat_changed',
    message0: '当 %1 的 %2 %3 时',
    args0: [
      { type: 'field_dropdown', name: 'RELATION', options: EVENT_RELATION },
      { type: 'field_dropdown', name: 'PROPERTY', options: PLAYER_CHANGE_PROPERTIES },
      { type: 'field_dropdown', name: 'DIRECTION', options: CHANGE_DIRECTIONS },
    ],
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
    type: 'trigger_hand_owner_turn_start',
    message0: '当此卡在手牌中且持有者回合开始时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_discard_owner_turn_start',
    message0: '当此卡在弃牌堆中且持有者回合开始时',
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'trigger_deck_owner_turn_start',
    message0: '当此卡在抽牌堆中且持有者回合开始时',
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
    message0: '可手动触发 时机 %1 消耗 %2 E %3 M 每回合最多 %4 次 条件 %5 触发后摧毁 %6',
    args0: [
      { type: 'field_dropdown', name: 'TIMING', options: [['装备一回合后', 'after_one_turn'], ['立即', 'immediate'], ['每回合一次', 'once_per_turn']] },
      numberField('COST_E', 0),
      numberField('COST_M', 0),
      numberField('MAX_USES', 0),
      { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
      { type: 'field_checkbox', name: 'DESTROY', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.TRIGGER,
  },
  {
    type: 'response_declare',
    message0: '声明为反制 响应 %1 消耗 %2 E %3 M 窗口标题 %4 内容 %5',
    args0: [
      { type: 'field_dropdown', name: 'TIMING', options: [['攻击牌', 'thorn'], ['技能牌', 'bloom'], ['装备牌', 'root'], ['回复H', 'heal'], ['装备被摧毁', 'equipment_destroy'], ['任意行动', 'any']] },
      numberField('COST_E', 0),
      numberField('COST_M', 0),
      { type: 'field_input', name: 'TITLE', text: '' },
      { type: 'field_input', name: 'CONTENT', text: '' },
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
    message0: '当此牌在装备栏中，装备者受到物理伤害时 来源记为 %1',
    args0: [variableField('SOURCE_VAR')],
    nextStatement: null,
    style: { hat: 'cap' },
    colour: COLORS.TRIGGER,
  },
  {
    type: 'equipment_manual_trigger',
    message0: '当此牌在装备栏中被手动触发 每回合最多 %1 次 摧毁自己 %2',
    args0: [numberInput('MAX_USES'), { type: 'field_checkbox', name: 'DESTROY', checked: true }],
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
  { type: 'target_damage_source', message0: '本次伤害来源', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_last_actor', message0: '上一次行动者', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_choice', message0: '所选目标', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_team_var_scope', message0: '己方变量作用域', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_global_var_scope', message0: '全局变量作用域', output: 'Target', colour: COLORS.TARGET },
  {
    type: 'target_card_owner',
    message0: '%1 的所在玩家',
    args0: [cardInput('CARD')],
    output: 'Target',
    colour: COLORS.TARGET,
  },
  { type: 'target_highest_health', message0: '生命最高的玩家', output: 'Target', colour: COLORS.TARGET },
  { type: 'target_lowest_health', message0: '生命最低的玩家', output: 'Target', colour: COLORS.TARGET },

  { type: 'card_current', message0: '本卡牌', output: 'CardRef', colour: COLORS.CARD },
  { type: 'card_selected', message0: '所选卡牌', output: 'CardRef', colour: COLORS.CARD },
  { type: 'card_event_card', message0: '事件卡牌', output: 'CardRef', colour: COLORS.CARD },
  { type: 'card_last_created', message0: '刚生成的卡牌', output: 'CardRef', colour: COLORS.CARD },
  {
    type: 'card_by_id',
    message0: '卡牌ID %1',
    args0: [{ type: 'field_input', name: 'CARD_ID', text: 'Basic' }],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'card_in_hand_at',
    message0: '玩家 %1 的第 %2 张手牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('INDEX')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'card_in_deck_at',
    message0: '玩家 %1 抽牌堆第 %2 张牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('INDEX')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'card_in_discard_at',
    message0: '玩家 %1 弃牌堆第 %2 张牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('INDEX')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'card_in_exile_at',
    message0: '玩家 %1 放逐区第 %2 张牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('INDEX')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'card_selected_at',
    message0: '第 %1 张所选卡牌',
    args0: [numberInput('INDEX')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  { type: 'equipment_current', message0: '本装备', output: 'EquipmentRef', colour: COLORS.EQUIP },
  { type: 'equipment_selected', message0: '所选装备', output: 'EquipmentRef', colour: COLORS.EQUIP },
  { type: 'equipment_event_equipment', message0: '事件装备', output: 'EquipmentRef', colour: COLORS.EQUIP },

  {
    type: 'action_request_target',
    message0: '弹出目标选择窗口 标题 %1 内容 %2 候选 %3 可取消 %4',
    args0: [
      { type: 'field_input', name: 'TITLE', text: '选择目标' },
      { type: 'field_input', name: 'CONTENT', text: '' },
      { type: 'input_value', name: 'TARGETS', check: 'Target' },
      { type: 'field_checkbox', name: 'CANCELLABLE', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_request_card',
    message0: '弹出选牌窗口 标题 %1 内容 %2 玩家 %3 区域 %4 可取消 %5',
    args0: [
      { type: 'field_input', name: 'TITLE', text: '选择卡牌' },
      { type: 'field_input', name: 'CONTENT', text: '' },
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'ZONE', options: [['手牌', 'hand'], ['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['放逐区', 'exile'], ['装备栏', 'equipment']] },
      { type: 'field_checkbox', name: 'CANCELLABLE', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_request_cards',
    message0: '弹出多卡选择窗口 标题 %1 内容 %2 从 %3 的手牌选择 %4 到 %5 张 类型 %6 同名 %7 可取消 %8',
    args0: [
      { type: 'field_input', name: 'TITLE', text: '选择卡牌' },
      { type: 'field_input', name: 'CONTENT', text: '' },
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      numberInput('MIN_COUNT'),
      numberInput('MAX_COUNT'),
      { type: 'field_dropdown', name: 'CARD_TYPE', options: CARD_TYPES },
      { type: 'field_checkbox', name: 'SAME_NAME', checked: true },
      { type: 'field_checkbox', name: 'CANCELLABLE', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_request_optional_card',
    message0: '弹出可跳过选牌窗口 标题 %1 内容 %2 玩家 %3 区域 %4',
    args0: [
      { type: 'field_input', name: 'TITLE', text: '选择卡牌' },
      { type: 'field_input', name: 'CONTENT', text: '' },
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'ZONE', options: [['手牌', 'hand'], ['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['放逐区', 'exile'], ['装备栏', 'equipment']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.ACTION,
  },
  {
    type: 'action_request_confirm',
    message0: '弹出确认窗口 标题 %1 内容 %2 确认按钮 %3 取消按钮 %4 可取消 %5',
    args0: [
      { type: 'field_input', name: 'TITLE', text: '确认' },
      { type: 'field_input', name: 'CONTENT', text: '' },
      { type: 'field_input', name: 'OK_TEXT', text: '确认' },
      { type: 'field_input', name: 'CANCEL_TEXT', text: '取消' },
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
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS'), numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_status_remove_named',
    message0: '移除 %1 的状态 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_add_named',
    message0: '给 %1 添加自定义标签 %2',
    args0: [cardInput('CARD'), tagField('TAG')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_remove_named',
    message0: '移除 %1 的自定义标签 %2',
    args0: [cardInput('CARD'), tagField('TAG')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_add_id',
    message0: '给 %1 添加标签ID %2',
    args0: [cardInput('CARD'), { type: 'field_input', name: 'TAG', text: 'custom_tag' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_tag_remove_id',
    message0: '移除 %1 的标签ID %2',
    args0: [cardInput('CARD'), { type: 'field_input', name: 'TAG', text: 'custom_tag' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_add_tag',
    message0: '给 %1 添加标签 %2',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'TAG', options: TAGS }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_remove_tag',
    message0: '移除 %1 的标签 %2',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'TAG', options: TAGS }],
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
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS')],
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
  { type: 'action_equip_this_card', message0: '将 %1 作为装备放置', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_add_equipment_to_zone',
    message0: '将装备 %1 加入 %2 装备区',
    args0: [cardInput('CARD'), { type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_equip_disc_armor', message0: '兼容：圆盘式装备护甲 +%1（可拆成条件 + 护甲）', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_sponge', message0: '装备效果：海绵式伤害转毒', previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_set_health', message0: '装备效果：将自己 H 设为 %1', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_reduce_own_draw', message0: '装备效果：自己每回合少抽 %1 张牌', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_reduce_own_e', message0: '装备效果：自己每回合少回复 %1 E', args0: [numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_on_destroy_remove_poison_damage', message0: '装备被摧毁时：清除中毒并受到层数 ×%1 物理伤害', args0: [numberInput('MULTIPLIER')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_activate_corruption', message0: '激活 %1 的腐化效果', args0: [equipmentInput('EQUIPMENT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_equipment_prop_set',
    message0: '将 %1 的 %2 设为 %3',
    args0: [equipmentInput('EQUIPMENT'), { type: 'field_dropdown', name: 'PROPERTY', options: EQUIP_PROPERTIES.filter(([, value]) => value !== 'owner') }, numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_equipment_prop_add',
    message0: '将 %1 的 %2 增加 %3',
    args0: [equipmentInput('EQUIPMENT'), { type: 'field_dropdown', name: 'PROPERTY', options: EQUIP_PROPERTIES.filter(([, value]) => value !== 'owner' && value !== 'corruption_active') }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  {
    type: 'action_player_prop_set',
    message0: '将 %1 的 %2 设为 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'PROPERTY', options: PLAYER_PROPERTIES }, numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_player_prop_add',
    message0: '将 %1 的 %2 增加 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'PROPERTY', options: PLAYER_PROPERTIES.filter(([, value]) => !['invincible', 'untargetable', 'bandage_active', 'sponge_active', 'shovel_active', 'skip_turn', 'negate_next_skill', 'nazar_active'].includes(value)) }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_max_health_add',
    message0: '将 %1 的 H 上限增加 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_max_elixir_add',
    message0: '将 %1 的 E 上限增加 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_max_magic_add',
    message0: '将 %1 的 M 上限增加 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.STATUS,
  },
  {
    type: 'action_magic_battery_gain_m',
    message0: '魔法电池式回魔 为 %1 +%2 M 每回合上限 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, numberInput('AMOUNT'), numberInput('LIMIT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_destroy_self_equipment', message0: '摧毁 %1', args0: [equipmentInput('EQUIPMENT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  { type: 'action_equip_protection', message0: '使 %1 获得 1 层装备摧毁保护', args0: [equipmentInput('EQUIPMENT')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
  {
    type: 'action_remove_equip_protection',
    message0: '移除 %1 的装备保护',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.EQUIP,
  },
  { type: 'action_place_as_equip', message0: '将 %1 作为装备放置', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.EQUIP },
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
  { type: 'action_transform_card', message0: '变换 %1', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_copy_card', message0: '复制 %1 到手牌', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_copy_choice_with_discount', message0: '复制 %1，并使复制牌下次费用 -%2 E', args0: [cardInput('CARD'), numberInput('DISCOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_card_fission_add', message0: '使 %1 裂变层数增加 %2', args0: [cardInput('CARD'), numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_card_fission_set', message0: '将 %1 裂变层数设为 %2', args0: [cardInput('CARD'), numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_card_fusion_add', message0: '使 %1 聚变层数增加 %2', args0: [cardInput('CARD'), numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_card_fusion_set', message0: '将 %1 聚变层数设为 %2', args0: [cardInput('CARD'), numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_card_discount_set', message0: '将 %1 下次 E 费用减少设为 %2', args0: [cardInput('CARD'), numberInput('AMOUNT')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  {
    type: 'action_card_prop_set',
    message0: '将 %1 的 %2 设为 %3',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'PROPERTY', options: CARD_PROPERTIES }, numberInput('VALUE')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_card_prop_add',
    message0: '将 %1 的 %2 增加 %3',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'PROPERTY', options: CARD_PROPERTIES.filter(([, value]) => !['cost_e', 'cost_m'].includes(value)) }, numberInput('AMOUNT')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_card_prop_mul',
    message0: '将 %1 的 %2 乘以 %3',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'PROPERTY', options: CARD_PROPERTIES.filter(([, value]) => !['cost_e', 'cost_m'].includes(value)) }, numberInput('MULTIPLIER')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_card_damage_multiply',
    message0: '使 %1 的伤害倍率乘以 %2',
    args0: [cardInput('CARD'), numberInput('MULTIPLIER')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_give_card_to_hand',
    message0: '给 %1 一张 %2 到手牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, cardInput('CARD')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_give_card_to_deck',
    message0: '给 %1 一张 %2 到抽牌堆 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      cardInput('CARD'),
      { type: 'field_dropdown', name: 'POSITION', options: [['顶部', 'top'], ['底部', 'bottom'], ['随机', 'random']] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_give_card_to_discard',
    message0: '给 %1 一张 %2 到弃牌堆',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, cardInput('CARD')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  {
    type: 'action_remove_specific_card',
    message0: '从 %1 的 %2 移除牌 %3',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'ZONE', options: [['手牌', 'hand'], ['抽牌堆', 'deck'], ['弃牌堆', 'discard'], ['装备栏', 'equipment'], ['放逐区', 'exile']] },
      cardInput('CARD'),
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.CARD,
  },
  { type: 'action_clear_card_tags', message0: '清空 %1 的所有标签', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_exile_this', message0: '放逐 %1', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_move_to_hand', message0: '将 %1 放入 %2 手牌', args0: [cardInput('CARD'), { type: 'input_value', name: 'TARGET', check: 'Target' }], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  { type: 'action_move_to_discard', message0: '将 %1 放入弃牌堆', args0: [cardInput('CARD')], previousStatement: null, nextStatement: null, colour: COLORS.CARD },
  {
    type: 'action_move_to_deck',
    message0: '将 %1 放回抽牌堆 %2',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'POSITION', options: [['顶部', 'top'], ['底部', 'bottom'], ['随机', 'random']] }],
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
    type: 'value_damage_source',
    message0: '本次伤害来源玩家编号',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_damage_amount',
    message0: '本次伤害数值',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_choice_target',
    message0: '所选目标玩家编号',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_choice_confirmed',
    message0: '确认窗口结果 1/0',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_selected_card_index',
    message0: '当前所选卡牌序号',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_loop_index',
    message0: '当前循环序号',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_selected_cards_count',
    message0: '所选卡牌数量',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_card_property',
    message0: '%1 的 %2',
    args0: [
      cardInput('CARD'),
      { type: 'field_dropdown', name: 'PROPERTY', options: CARD_PROPERTIES },
    ],
    output: 'Number',
    colour: COLORS.CARD,
  },
  {
    type: 'value_card_tag_count',
    message0: '%1 的标签数量',
    args0: [cardInput('CARD')],
    output: 'Number',
    colour: COLORS.CARD,
  },
  {
    type: 'value_card_def_property',
    message0: '卡牌ID %1 的原始 %2',
    args0: [
      cardInput('CARD'),
      { type: 'field_dropdown', name: 'PROPERTY', options: CARD_DEFINITION_PROPERTIES },
    ],
    output: null,
    colour: COLORS.CARD,
  },
  {
    type: 'value_card_def_tags',
    message0: '卡牌ID %1 的原始标签列表',
    args0: [cardInput('CARD')],
    output: 'Array',
    colour: COLORS.CARD,
  },
  {
    type: 'value_equipment_property',
    message0: '%1 的 %2',
    args0: [
      equipmentInput('EQUIPMENT'),
      { type: 'field_dropdown', name: 'PROPERTY', options: EQUIP_PROPERTIES },
    ],
    output: 'Number',
    colour: COLORS.EQUIP,
  },
  {
    type: 'value_player_property',
    message0: '%1 的 %2',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'PROPERTY', options: PLAYER_PROPERTIES },
    ],
    output: 'Number',
    colour: COLORS.STATUS,
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
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), anyInput('VALUE')],
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
    type: 'value_list_var',
    message0: '%1 的列表 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME')],
    output: 'Array',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_list_create',
    message0: '列表 %1 %2 %3',
    args0: [anyInput('A'), anyInput('B'), anyInput('C')],
    output: 'Array',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_list_literal',
    message0: '列表数据 %1',
    args0: [{ type: 'field_input', name: 'JSON', text: '[1,2,3]' }],
    output: 'Array',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_zone_list',
    message0: '%1 的 %2 列表',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'ZONE', options: LIST_ZONE }],
    output: 'Array',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_list_length',
    message0: '%1 的长度',
    args0: [anyInput('LIST')],
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_list_item',
    message0: '%1 的第 %2 项',
    args0: [anyInput('LIST'), numberInput('INDEX')],
    output: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'card_from_var',
    message0: '%1 的变量 %2 中的卡牌',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME')],
    output: 'CardRef',
    colour: COLORS.CARD,
  },
  {
    type: 'condition_list_contains',
    message0: '%1 包含 %2',
    args0: [anyInput('LIST'), anyInput('ITEM')],
    output: 'Boolean',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_list_set',
    message0: '将 %1 的列表 %2 设为 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), anyInput('LIST')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_list_append',
    message0: '将 %3 加入 %1 的列表 %2 末尾',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), anyInput('ITEM')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_list_insert',
    message0: '将 %4 插入 %1 的列表 %2 第 %3 项',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('INDEX'), anyInput('ITEM')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_list_delete',
    message0: '删除 %1 的列表 %2 第 %3 项',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME'), numberInput('INDEX')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_list_clear',
    message0: '清空 %1 的列表 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, variableField('NAME')],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.VARIABLE,
  },
  {
    type: 'value_timer_remaining',
    message0: '当前持续效果剩余次数',
    output: 'Number',
    colour: COLORS.VARIABLE,
  },
  {
    type: 'action_countdown_var',
    message0: '计时器：将 %1 的变量 %2 设为 %3，并在 %4 每次减少 1',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      variableField('NAME'),
      numberInput('DURATION'),
      { type: 'field_dropdown', name: 'TRIGGER', options: TIMER_TRIGGER },
    ],
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
    type: 'control_repeat_until',
    message0: '重复执行 %1 直到 %2',
    args0: [{ type: 'input_statement', name: 'DO' }, { type: 'input_value', name: 'CONDITION', check: 'Boolean' }],
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
    type: 'control_for_each_list',
    message0: '对 %1 的每一项作为变量 %2 执行 %3',
    args0: [anyInput('LIST'), variableField('NAME'), { type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_for_each_equipment',
    message0: '对 %1 的 %2 逐个作为所选装备 指定ID %3 执行 %4',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'FILTER', options: EQUIPMENT_LOOP_FILTER },
      cardInput('CARD'),
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_timed_effect',
    message0: '在 %1 的 %2 时，持续 %3 次执行 %4',
    args0: [
      { type: 'input_value', name: 'TARGET', check: 'Target' },
      { type: 'field_dropdown', name: 'TRIGGER', options: TIMER_TRIGGER },
      numberInput('DURATION'),
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_for_each_selected_card',
    message0: '对每张所选卡牌执行 %1',
    args0: [{ type: 'input_statement', name: 'DO' }],
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
    type: 'control_break',
    message0: '跳出当前循环',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.LOGIC,
  },
  {
    type: 'control_continue',
    message0: '进入下一次循环',
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
    type: 'condition_hand_size_compare',
    message0: '%1 的手牌数 %2 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'OP', options: COMPARE }, numberInput('VALUE')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_hand_limit_compare',
    message0: '%1 的手牌上限 %2 %3',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'OP', options: COMPARE }, numberInput('VALUE')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_status_named',
    message0: '%1 拥有状态 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_status',
    message0: '%1 拥有 %2',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS')],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_has_tag',
    message0: '%1 拥有标签 %2',
    args0: [cardInput('CARD'), { type: 'field_dropdown', name: 'TAG', options: TAGS }],
    output: 'Boolean',
    colour: COLORS.LOGIC,
  },
  {
    type: 'condition_damage_source_relation',
    message0: '本次伤害来源是 %1',
    args0: [{ type: 'field_dropdown', name: 'RELATION', options: DAMAGE_SOURCE_RELATION }],
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
  {
    type: 'value_hand_size',
    message0: '%1 的手牌数',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_hand_limit',
    message0: '%1 的手牌上限',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_zone_count',
    message0: '%1 的 %2 数量',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_dropdown', name: 'ZONE', options: LIST_ZONE }],
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
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, statusField('STATUS')],
    output: 'Number',
    colour: COLORS.VALUE,
  },
  {
    type: 'value_equipment_count_named',
    message0: '%1 装备栏中与 %2 相同的装备数',
    args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, cardInput('CARD')],
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
  'target_', 'card_', 'equipment_', 'action_', 'condition_', 'value_', 'counter_', 'passive_', 'aura_', 'response_',
];
const INLINE_TYPES = [
  'trigger_on_phys_damage',
  'trigger_on_any_damage',
  'trigger_on_damage_from',
  'trigger_hand_owner_turn_start',
  'trigger_discard_owner_turn_start',
  'trigger_deck_owner_turn_start',
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
  'control_repeat_until',
  'control_for_each',
  'control_for_each_list',
  'control_for_each_equipment',
  'control_timed_effect',
  'control_random',
  'control_break',
  'control_continue',
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
  'trigger_on_damage_from',
  'trigger_on_destroy',
  'trigger_hand_owner_turn_start',
  'trigger_discard_owner_turn_start',
  'trigger_deck_owner_turn_start',
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
