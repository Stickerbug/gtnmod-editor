/* 效果行句型表：对象 + 动作 + 结果，遵守 docs/卡牌描述规范.md。
   每个模板给出 parts(row)：字符串直接输出，槽位（slot）渲染成控件。
   管道型 op 标 internal：不写进卡面描述。 */

export const slot = (name, options, extra = {}) => Object.assign({ slot: name, options }, extra);
export const TARGETS = ['目标', '自己'];

export function createTemplates(terms) {
  const statusParts = (row) => {
    const statusSlot = slot('status', ['流血', '灼烧', '中毒', '虚弱', '霜冻']);
    /* 游戏里 status_add_named 用 amount 表示层数 */
    const stacks = slot('stacks', null, { number: true, param: 'amount' });
    if (row && row.values && row.values.target === '自己') {
      return ['使自己获得', stacks, '层', statusSlot];
    }
    return ['对', slot('target', TARGETS), '施加', stacks, '层', statusSlot];
  };

  return {
    request_target: { badge: '目标', parts: () => ['选择1个目标'] },
    deal_damage: {
      badge: '伤害',
      parts: () => [
        '对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }),
        slot('damage_type', ['[[icon:D]]', '[[icon:electric_damage]]']),
        slot('hits', null, { number: true, omitWhenOne: true, prefix: '×' }),
      ],
    },
    direct_damage: {
      badge: '直伤',
      parts: () => ['对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }), '[[icon:D]]'],
    },
    heal: {
      badge: '回复',
      parts: () => ['回复', slot('target', TARGETS), slot('amount', null, { number: true }), '[[icon:H]]'],
    },
    add_status: { badge: '状态', parts: statusParts },
    status_add_named: { badge: '状态', parts: statusParts },
    apply_jungle_status: { badge: '状态', parts: statusParts },
    request_card: {
      badge: '选牌',
      parts: () => [
        '从', slot('target', TARGETS), slot('zone', ['弃牌堆', '手牌', '抽牌堆', '放逐区']),
        '选择', slot('count', null, { number: true }), '张牌',
      ],
    },
    place_as_equip: { badge: '装备', parts: () => ['将本牌置入装备栏'] },
    give_card_to_hand: { badge: '给牌', parts: () => ['将1张牌加入', slot('target', TARGETS), '手牌'] },
    give_card_to_deck: { badge: '入牌堆', parts: () => ['将1张牌置于', slot('target', TARGETS), '抽牌堆顶'] },
    move_to_hand: { badge: '入手', parts: () => ['将1张牌加入', slot('target', TARGETS), '手牌'] },
    move_to_discard: { badge: '弃置', parts: () => ['使', slot('target', TARGETS), '弃置1张手牌'] },
    move_to_exile: { badge: '放逐', parts: () => ['将', slot('target', TARGETS), '弃牌堆中的1张牌放逐'] },
    move_to_deck: {
      badge: '入牌堆',
      parts: () => ['将', slot('target', TARGETS), '的1张牌置于', slot('to', ['抽牌堆顶', '抽牌堆底'])],
    },
    draw: { badge: '抽取', parts: () => ['抽取', slot('amount', null, { number: true }), '张牌'] },
    draw_cards: {
      badge: '抽取',
      parts: () => [slot('target', TARGETS), '抽取', slot('amount', null, { number: true }), '张牌'],
    },
    gain_m: { badge: 'M', parts: () => ['获得', slot('amount', null, { number: true }), '[[icon:M]]'] },
    gain_e: { badge: 'E', parts: () => ['获得', slot('amount', null, { number: true }), '[[icon:E]]'] },
    player_prop_add: {
      badge: '上限',
      parts: () => [
        '使', slot('target', TARGETS),
        slot('prop', ['[[icon:H]]', '[[icon:E]]', '[[icon:M]]']),
        '上限+', slot('amount', null, { number: true }),
      ],
    },
    player_prop_set: {
      badge: '设定',
      parts: () => [
        '使', slot('target', TARGETS), '的',
        slot('property', ['生命', '护甲', '灵气 E', '魔力 M']),
        '变为', slot('value', null, { number: true }),
      ],
    },
    card_prop_add: {
      badge: '牌属性',
      parts: () => ['使1张牌的', slot('property', ['伤害', '攻击次数', '消耗']), '增加', slot('amount', null, { number: true })],
    },
    card_prop_set: {
      badge: '牌属性',
      parts: () => ['使1张牌的', slot('property', ['伤害', '攻击次数', '消耗']), '变为', slot('value', null, { number: true })],
    },
    card_prop_add_to_zone: {
      badge: '加牌',
      parts: () => [
        '向', slot('target', TARGETS), '的',
        slot('zone', ['弃牌堆', '手牌', '抽牌堆', '放逐区', '装备栏']),
        '加入', slot('count', null, { number: true, param: ['count', 'amount'] }), '张牌',
      ],
    },
    equipment_prop_add: {
      badge: '装备',
      parts: () => ['使本装备的', slot('property', ['护甲', '攻击次数', '伤害']), '增加', slot('amount', null, { number: true })],
    },
    equipment_prop_set: {
      badge: '装备',
      parts: () => ['使本装备的', slot('property', ['护甲', '攻击次数', '伤害']), '变为', slot('value', null, { number: true })],
    },
    destroy_self_equipment: { badge: '摧毁', parts: () => ['摧毁本装备'] },
    add_tag: {
      badge: '标签',
      parts: () => ['使本牌获得', slot('tag', ['迅捷', '沉重', '放逐', '不可摧毁', '唯一']), '标签'],
    },
    add_tag_to_zone: {
      badge: '标签',
      parts: () => [
        '使', slot('target', TARGETS), '的',
        slot('zone', ['手牌', '弃牌堆', '抽牌堆']), '中的牌获得',
        slot('tag', ['迅捷', '沉重', '放逐']), '标签',
      ],
    },
    status_remove_named: {
      badge: '清状态',
      parts: () => [
        '移除', slot('target', TARGETS), '的',
        slot('amount', null, { number: true }), '层',
        slot('status', ['流血', '灼烧', '中毒', '虚弱', '霜冻']),
      ],
    },
    resolve_status_once: {
      badge: '结算',
      parts: () => ['立即结算', slot('target', TARGETS), '的', slot('status', ['灼烧', '中毒', '流血']), '各1次'],
    },
    create_copies_to_deck_top: {
      badge: '生成',
      parts: () => ['生成', slot('count', null, { number: true }), '张复制，置于自己抽牌堆顶'],
    },
    copy_card_instance: { badge: '复制', parts: () => ['生成1张复制'] },
    ocean_for_each_selectable_target: { badge: '群体', parts: () => ['对所有可选目标分别结算下列效果'] },
    for_each_selected_card: { badge: '逐张', parts: () => ['对选中的每张牌分别结算下列效果'] },

    /* --- 第三批：按 editor_coverage_report 的障碍榜补的通用句型 --- */
    for_each: {
      badge: '循环',
      parts: () => ['对列表中的每一项分别结算下列效果'],
    },
    timed_effect: {
      badge: '延迟',
      parts: () => [
        '在', slot('target', TARGETS),
        slot('trigger', ['回合开始时', '回合结束时', '下个回合开始时']),
        '执行下列效果',
        slot('duration', null, { number: true, prefix: '（持续', suffix: '回合）' }),
      ],
    },
    auto_play_card: {
      badge: '自动打出',
      parts: () => ['自动打出1张牌', slot('no_cost', ['（不支付费用）', '（支付费用）'])],
    },
    queue_auto_play: {
      badge: '自动打出',
      parts: () => ['每回合自动打出1张牌'],
    },
    force_end_turn: {
      badge: '结束回合',
      parts: () => ['结束', slot('target', TARGETS), '的回合'],
    },
    draw_to_hand_limit: {
      badge: '抽满',
      parts: () => [slot('target', TARGETS), '抽至手牌上限'],
    },
    random_zone_card_to_hand: {
      badge: '随机入手',
      parts: () => [
        '从', slot('target', TARGETS), '的',
        slot('zone', ['弃牌堆', '抽牌堆', '放逐区']),
        '随机选择', slot('count', null, { number: true }), '张牌加入其手牌',
      ],
    },
    clear_status: {
      badge: '清状态',
      parts: () => ['清除', slot('target', TARGETS), '的', slot('status', ['灼烧', '中毒', '流血', '霜冻'])],
    },
    remove_status: {
      badge: '移除状态',
      parts: () => [
        '移除', slot('target', TARGETS), '的',
        slot('amount', null, { number: true }), '层',
        slot('status', ['灼烧', '中毒', '流血', '霜冻']),
      ],
    },
    request_ui: {
      badge: '界面',
      parts: () => ['弹出选择界面，让玩家作出选择'],
    },
    for_each_list: {
      badge: '循环',
      parts: () => ['对列表中的每一项分别结算下列效果'],
    },
    copy_card: { badge: '复制', parts: () => ['生成1张复制'] },
    spend_resource: {
      badge: '消耗',
      parts: () => [
        '消耗', slot('amount', null, { number: true }),
        slot('resource', ['[[icon:E]]', '[[icon:M]]', '[[icon:H]]']),
      ],
    },
    apply_burn: { badge: '状态', parts: (row) => statusParts(row) },
    poison: { badge: '状态', parts: (row) => statusParts(row) },
    apply_turn_regen: {
      badge: '回复',
      parts: () => [
        '使', slot('target', TARGETS), '每回合开始时恢复',
        slot('amount', null, { number: true }), '[[icon:H]]',
      ],
    },

    /* --- 第四批：原子重构抽出的新通用 op --- */
    for_each_target: {
      badge: '循环',
      parts: () => ['对每个目标分别结算下列效果'],
    },
    repeat: {
      badge: '重复',
      parts: () => [
        '重复', slot('times', null, { number: true, param: ['times', 'count'] }), '次，执行下列效果',
      ],
    },
    absorb_attack_damage: {
      badge: '吸收',
      parts: () => [
        '使', slot('target', TARGETS),
        '受到的攻击伤害被吸收', slot('once', ['（仅一次）', '（持续）']),
      ],
    },
    deck_catalog_pick: {
      badge: '选牌',
      parts: () => [
        '从牌表中选择', slot('pick', null, { number: true }), '张牌放入',
        slot('destination', ['手牌', '弃牌堆', '抽牌堆顶', '放逐区']),
      ],
    },
    reveal_card_set: {
      badge: '展示',
      parts: () => ['向', slot('viewer', TARGETS), '展示', slot('source', ['手牌', '抽牌堆', '弃牌堆']), '中的牌'],
    },
    restore_card_props: {
      badge: '还原',
      parts: () => ['还原被记录的卡牌属性'],
    },
    /* 管道型：变量与监听器，不进卡面描述 */
    card_var_set: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `设置卡变量 ${row.values.name || '?'} = ${row.values.value ?? 0}`,
    },
    card_var_add: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `卡变量 ${row.values.name || '?'} 增加 ${row.values.value ?? 0}`,
    },
    register_play_listener: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `注册出牌监听${row.values.duration ? `（${row.values.duration}）` : ''}`,
    },
    if: {
      badge: '条件',
      cond: true,
      parts: () => ['若', slot('condition', null, { text: true }), '，则执行后续效果'],
    },

    /* --- 管道型：只做开关/内部步骤，不进描述 --- */
    once_per_play: {
      badge: '开关',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `每回合仅触发一次${row.values.key ? `（${row.values.key}）` : ''}`,
    },
    log: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `战报文案：${row.values.msg || '（未填写）'}`,
    },
    var_set: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `设置变量 ${row.values.name || '?'} = ${row.values.value ?? 0}`,
    },
    set_var: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `设置变量 ${row.values.name || '?'} = ${row.values.value ?? 0}`,
    },
    var_add: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `变量 ${row.values.name || '?'} 增加 ${row.values.amount ?? 0}`,
    },
    _terms: terms,
  };
}

/**
 * 模板库：高频模式的"一键插入"预设。
 * 每项是一段现成的步骤数组，插进效果行后仍可继续改槽位。
 * 顺序按官方包里的实际使用频率排（见 tools/op_priority_report.py）。
 */
export const TEMPLATE_PRESETS = [
  { id: 'damage', label: '造成伤害', steps: [{ op: 'deal_damage', target: 'target', amount: 5 }] },
  { id: 'heal', label: '回复生命', steps: [{ op: 'heal', target: 'self', amount: 5 }] },
  { id: 'damage_status', label: '伤害并附加状态', steps: [
    { op: 'deal_damage', target: 'target', amount: 3 },
    { op: 'status_add_named', target: 'target', status: 'fire', amount: 2 },
  ] },
  { id: 'status_self', label: '使自己获得状态', steps: [
    { op: 'status_add_named', target: 'self', status: 'armor', amount: 2 },
  ] },
  { id: 'draw', label: '抽牌', steps: [{ op: 'draw', amount: 2 }] },
  { id: 'gain_resource', label: '获得资源 E/M', steps: [{ op: 'gain_e', amount: 1 }] },
  { id: 'equip', label: '置入装备栏', steps: [{ op: 'place_as_equip' }] },
  { id: 'discard_to_deck', label: '从弃牌堆放回牌堆顶', steps: [
    { op: 'request_card', target: 'self', zone: 'discard', count: 1 },
    { op: 'give_card_to_deck', target: 'self' },
  ] },
  { id: 'conditional', label: '条件分支（如果…则…）', steps: [
    { op: 'if', condition: { op: 'compare', a: { op: 'last_damage' }, operator: '>=', b: 1 }, then: [] },
  ] },
  { id: 'repeat_targets', label: '对所有可选目标生效', steps: [
    { op: 'ocean_for_each_selectable_target', body: [] },
  ] },
  { id: 'cleanse', label: '清除状态', steps: [
    { op: 'clear_status', target: 'self', status: 'fire' },
  ] },
  { id: 'draw_to_limit', label: '抽至手牌上限', steps: [{ op: 'draw_to_hand_limit', target: 'self' }] },
];

/** 一行 → 中文句子（管道型返回空串）。 */
export function describeRow(row, templates, expr) {
  if (row.generic) return row.summary || row.op;
  const tpl = templates[row.tpl];
  if (!tpl) return row.op;
  if (tpl.internal) return '';
  return tpl.parts(row).map((part) => {
    if (typeof part === 'string') return part;
    const value = row.values[part.slot];
    const resolved = (value !== undefined && value !== null && value !== '')
      ? value
      : (part.number ? 1 : (part.options ? part.options[0] : ''));
    if (part.omitWhenOne && Number(resolved) <= 1) return '';
    return (part.prefix || '') + resolved + (part.suffix || '');
  }).join('');
}

export function describeRows(rows, templates, expr) {
  return rows.map((row) => describeRow(row, templates, expr)).filter(Boolean).join('；');
}
