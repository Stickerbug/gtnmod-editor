/* 效果行句型表：对象 + 动作 + 结果，遵守 docs/卡牌描述规范.md。
   每个模板给出 parts(row)：字符串直接输出，槽位（slot）渲染成控件。
   管道型 op 标 internal：不写进卡面描述。 */

import rules from '../generated/card-text-rules.js';
import { ZONE_LABELS, TARGET_LABELS, ZONE_CARD_PICK_LABELS } from './terms.js';

export const slot = (name, options, extra = {}) => Object.assign({ slot: name, options }, extra);
export const TARGETS = ['目标', '自己'];

/* 状态下拉：id → 中文（生成器从游戏运行时抽取；当前模组的自定义状态由编辑器追加）。
   值写的是 id（status_op / status_add_named 收的就是 id），显示的是中文。
   statusLabels 是各官方包申报的状态（arctic:frost 这类），不加进来预览文本会漏内部 id。 */
const STATUS_OPTIONS = Object.entries({
  ...(rules.statusCatalog || {}),
  ...(rules.statusLabels || {}),
}).map(([value, label]) => ({ value, label }));

/* 内置标签（flag_*）：条件里判断 card_has_tag 时用 */
export const BUILTIN_TAG_OPTIONS = Object.entries(rules.tagLabels || {}).map(([value, label]) => ({ value, label }));
/* 伤害类型：运行时认 damage_type = physical / magic（magic 在卡面上画成电伤图标）。
   选项写成 {value,label,icon}：value 原样写进步骤，label 给下拉框显示，
   icon 是卡面同款图标的键（见 src/gtn-text/icons.js），选中的那一项会在行里画出图标。 */
export const DAMAGE_TYPES = [
  { value: 'physical', label: '物理', icon: 'D' },
  { value: 'magic', label: '电伤', icon: 'electric_damage' },
];

/* 伞原子（Round 33 / 批次 AC）共用的引用下拉：value 写回去的都是运行时认的
   写法（字符串 ref / 卡牌 ID）。读的时候 steps.js 会把对象引用翻成 ref 名
   （expr.describe），所以这些 value 能跟数据里的 {ref:"…"} 对上。 */
export const CARD_REFS = [
  { value: 'current_card', label: '本牌' },
  { value: 'last_created_card', label: '上一步生成的牌' },
  { value: 'selected_card', label: '所选的牌' },
];
export const PLAYER_REFS = [
  { value: 'source', label: '自己' },
  { value: 'target', label: '目标' },
  { value: 'equipment_target', label: '装备目标' },
];
export const TAG_ACTIONS = [
  { value: 'add', label: '使' },
  { value: 'remove', label: '移除' },
  { value: 'toggle', label: '翻转' },
  { value: 'clear', label: '清除' },
];
export const CARD_ZONES = [
  { value: 'hand', label: '手牌' },
  { value: 'deck', label: '抽牌堆' },
  { value: 'discard', label: '弃牌堆' },
  { value: 'exile', label: '放逐区' },
  { value: 'equipment', label: '装备栏' },
];

/* 牌型（card_type）下拉：值写运行时 id（thorn / bloom / guard / root），
   中文沿用卡面描述里的说法（thorn=攻击牌、bloom=技能牌）。Round 38 / 批次 AD-3
   的 action_filter 三个牌型分支用这张表。 */
export const CARD_TYPE_OPTIONS = [
  { value: 'thorn', label: '攻击' },
  { value: 'bloom', label: '技能' },
  { value: 'guard', label: '守护' },
  { value: 'root', label: '根系' },
];

/* Round 46 / 批次 AJ：卡片位写成对象引用时的中文读法。
   ``zone_card``（区域里按属性取极值挑一张）与 ``{"ref":"<名字>"}``（复用
   前面记住的牌）都返回一段只读文字——效果行里不声明可编辑槽位，
   免得用户改别的槽位时把选择器写坏。普通引用（current_card 等）返回空串，
   照旧走原来的下拉槽位。 */
export function cardPositionText(value) {
  if (!value || typeof value !== 'object') return '';
  const ref = String(value.selector || value.ref || value.op || value.type || '');
  if (ref === 'zone_card' || ref === 'zone_card_pick') {
    const zone = ZONE_LABELS[String(value.zone || 'hand')] || '手牌';
    const ownerRaw = value.owner !== undefined ? value.owner : (value.target !== undefined ? value.target : 'self');
    const owner = typeof ownerRaw === 'string'
      ? (TARGET_LABELS[ownerRaw] || ownerRaw)
      : '自己';
    const pick = value.pick && typeof value.pick === 'object' ? value.pick : {};
    const by = ZONE_CARD_PICK_LABELS[String(pick.by || 'cost_e')] || String(pick.by || 'E 消耗');
    const extreme = String(pick.mode || 'max') === 'min' ? '最低' : '最高';
    return `${owner}的${zone}中${by}${extreme}的一张牌`;
  }
  if (typeof value.ref === 'string' && value.ref && Object.keys(value).length === 1) {
    return '刚才记住的牌';
  }
  return '';
}

export function createTemplates(terms) {
  const statusParts = (row) => {
    const statusSlot = slot('status', STATUS_OPTIONS, { status: true });
    /* 游戏里 status_add_named 用 amount 表示层数 */
    const stacks = slot('stacks', null, { number: true, param: 'amount' });
    if (row && row.values && row.values.target === '自己') {
      return ['使自己获得', stacks, '层', statusSlot];
    }
    return ['对', slot('target', TARGETS), '施加', stacks, '层', statusSlot];
  };

  return {
    request_target: { badge: '目标', parts: () => ['选择1个目标'] },
    /* Round 36 / 批次 AD-1：请求族四合一 —— request 伞用顶层 type 选类别
       （target / card / confirm / zone / forced_target / discount_copy /
       reorder_deck）。下面几条旧句型保留给老工程打开时反渲染。 */
    request: {
      badge: '请求',
      parts: (row) => {
        const kind = String((row && row.source && row.source.type) || '').trim();
        if (kind === 'card') {
          return [
            '从', slot('target', TARGETS), slot('zone', ['弃牌堆', '手牌', '抽牌堆', '放逐区']),
            '选择', slot('count', null, { number: true }), '张牌',
          ];
        }
        if (kind === 'confirm') {
          const params = (row && row.source && row.source.params) || {};
          const title = params.title ? String(params.title) : '';
          return title ? ['请求确认：', title] : ['请求二次确认'];
        }
        if (kind === 'zone') {
          return ['从', slot('zone', [
            { value: 'deck', label: '抽牌堆' },
            { value: 'discard', label: '弃牌堆' },
            { value: 'exile', label: '放逐区' },
          ]), '选择1张牌加入手牌'];
        }
        if (kind === 'forced_target') {
          return ['宣告', slot('target', TARGETS), '为本回合的强制目标'];
        }
        if (kind === 'discount_copy') {
          return ['复制所选手牌并使其 E -', slot('discount_e', null, { number: true })];
        }
        if (kind === 'reorder_deck') {
          return ['请求重排对方牌堆顺序'];
        }
        return ['选择1个目标'];
      },
    },
    deal_damage: {
      /* 运行时 _atomic_deal_damage 不读 damage_type（伤害类型由来源/卡牌推断）；
         要打魔法伤害请用 direct_damage（它才有 DAMAGE_TYPES 槽）。 */
      badge: '伤害',
      parts: (row) => {
        /* Round 44 / 批次 AH：``target`` 写成 {"selector":"bounce",…} 时这一步就是
           整条弹射链——主段用 amount/hits，后续每段用 per_target_amount /
           per_target_hits，段数写在选择器的 count / count_from 里。
           （旧的 ricochet_attack 原子已删除，替代写法就是这一条。） */
        const source = (row && row.source) || {};
        const target = source.target;
        const ref = target && typeof target === 'object'
          ? String(target.selector || target.ref || target.op || '')
          : '';
        const bounce = (ref === 'bounce' || ref === 'bounce_targets') ? target : null;
        const parts = [
          '对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }),
          '[[icon:D]]',
          slot('hits', null, { number: true, omitWhenOne: true, prefix: '×' }),
        ];
        if (bounce) {
          const countText = String(bounce.count_from || '') === 'positive_hits'
            ? '（按主段实际命中次数）'
            : `${bounce.count != null ? bounce.count : 0} 次`;
          parts.push(`，弹射 ${countText}`);
          const perAmount = source.per_target_amount;
          if (perAmount != null && String(perAmount) !== String(source.amount)) {
            parts.push(`（每段 ${perAmount}[[icon:D]]）`);
          }
        }
        return parts;
      },
    },
    direct_damage: {
      badge: '直伤',
      parts: () => [
        '对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }),
        slot('damage_type', DAMAGE_TYPES),
      ],
    },
    heal: {
      badge: '回复',
      parts: () => ['回复', slot('target', TARGETS), slot('amount', null, { number: true }), '[[icon:H]]'],
    },
    /* Round 32 / 批次 AA：生命族六合一（heal/lose_health/set_health/swap_health/
       on_fatal_*）。上面那条 heal 只为打开老工程时反渲染，新写法走这条。 */
    health_op: {
      badge: '生命',
      parts: (row) => {
        const mode = String((row && row.values && row.values.mode) || 'heal');
        if (mode === 'lose') {
          return ['使', slot('target', TARGETS), '失去', slot('amount', null, { number: true }), '[[icon:H]]'];
        }
        if (mode === 'set') {
          return ['将', slot('target', TARGETS), '的生命值设为', slot('amount', null, { number: true })];
        }
        if (mode === 'swap') {
          return ['交换', slot('target1', TARGETS), '与', slot('target2', TARGETS), '的生命值'];
        }
        if (mode === 'fatal') {
          return ['受到致命伤害时触发濒死保护'];
        }
        return ['回复', slot('target', TARGETS), slot('amount', null, { number: true }), '[[icon:H]]'];
      },
    },
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
    /* 这两个 op 作用在"被解析出来的那张牌"上（默认本牌），运行时并不读 target */
    move_to_discard: { badge: '弃置', parts: () => ['将本牌置入弃牌堆'] },
    move_to_exile: { badge: '放逐', parts: () => ['将本牌放逐'] },
    move_to_deck: {
      badge: '入牌堆',
      /* 运行时读 position: top / bottom / random（默认 top）；
         以前写成 'to' + 中文值，所以选"抽牌堆底"其实毫无效果 */
      parts: () => ['将本牌置于', slot('position', [
        { value: 'top', label: '抽牌堆顶' },
        { value: 'bottom', label: '抽牌堆底' },
        { value: 'random', label: '随机位置' },
      ])],
    },
    /* Round 29 / 批次 X：move_to_hand / move_to_deck / move_to_discard / move_to_exile
       合并成 move_card(zone=...)。上面四条保留给老数据渲染（写出来会拿到
       "已移除 + 替代写法"），新写法统一走这条。 */
    move_card: {
      badge: '移动',
      parts: (row) => {
        /* Round 46 / 批次 AJ：``cards`` 写成区域选牌选择器时按"把挑中的那张
           移过去"来读（batch 形态），其余写法走原来的"将本牌移动"。 */
        const source = (row && row.source) || {};
        const picked = cardPositionText(source.cards);
        if (picked) {
          const zone = ZONE_LABELS[String(source.target_zone || source.zone || source.to || 'discard')] || '弃牌堆';
          return ['将', picked, '移动到', zone];
        }
        return ['将本牌移动到', slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
          { value: 'exile', label: '放逐区' },
        ])];
      },
    },
    choose_from_zone: {
      badge: '选牌',
      parts: () => ['从', slot('zone', [
        { value: 'deck', label: '抽牌堆' },
        { value: 'discard', label: '弃牌堆' },
        { value: 'exile', label: '放逐区' },
      ]), '选择1张牌加入手牌'],
    },
    draw: {
      badge: '抽取',
      parts: (row) => {
        const values = (row && row.values) || {};
        const count = values.count !== undefined ? values.count : values.amount;
        if (!count && Array.isArray(values.modifiers) && values.modifiers.length) {
          return ['使', slot('target', TARGETS), '获得', slot('amount', null, { number: true }), '层迟缓'];
        }
        return [slot('target', TARGETS), '抽取', slot('count', null, { number: true }), '张牌'];
      },
    },
    draw_cards: {
      badge: '抽取',
      parts: () => [slot('target', TARGETS), '抽取', slot('amount', null, { number: true }), '张牌'],
    },
    /* Round 32 / 批次 AA：资源族五合一（gain_e/gain_m/spend_resource/
       coffee_gain_e/aura_enemy_elixir_recovery）。gain_e/gain_m 保留给老工程。 */
    resource_op: {
      badge: '资源',
      parts: (row) => {
        const values = (row && row.values) || {};
        const icon = String(values.resource || 'e').toLowerCase().startsWith('m') ? '[[icon:M]]' : '[[icon:E]]';
        const spend = String(values.mode || '') === 'spend';
        const delta = values.delta !== undefined ? values.delta : values.amount;
        if (spend || (typeof delta === 'number' && delta < 0)) {
          return ['消耗', slot('amount', null, { number: true }), icon];
        }
        return [slot('target', TARGETS), '获得', slot('delta', null, { number: true }), icon];
      },
    },
    gain_m: { badge: 'M', parts: () => ['获得', slot('amount', null, { number: true }), '[[icon:M]]'] },
    gain_e: { badge: 'E', parts: () => ['获得', slot('amount', null, { number: true }), '[[icon:E]]'] },
    player_prop_add: {
      badge: '上限',
      parts: () => [
        '使', slot('target', TARGETS),
        /* 运行时读的是属性名（health/elixir/magic…），不能再写图标标记进去 */
        slot('prop', [
          { value: 'max_health', label: '生命', icon: 'H' },
          { value: 'max_elixir', label: '体力', icon: 'E' },
          { value: 'max_magic', label: '魔力', icon: 'M' },
        ]),
        '上限+', slot('amount', null, { number: true }),
      ],
    },
    player_prop_set: {
      badge: '设定',
      parts: () => [
        '使', slot('target', TARGETS), '的',
        slot('property', [
          { value: 'health', label: '生命', icon: 'H' },
          { value: 'armor', label: '护甲', icon: 'A' },
          { value: 'elixir', label: '体力', icon: 'E' },
          { value: 'magic', label: '魔力', icon: 'M' },
        ]),
        '变为', slot('value', null, { number: true }),
      ],
    },
    /* Round 29 / 批次 X：player_prop_set / player_prop_add 合并成
       player_prop_change(mode=set|add)。上面两条保留给老数据渲染。 */
    player_prop_change: {
      badge: '玩家属性',
      parts: () => [
        '使', slot('target', TARGETS), '的',
        slot('property', [
          { value: 'health', label: '生命', icon: 'H' },
          { value: 'max_health', label: '生命上限', icon: 'H' },
          { value: 'max_elixir', label: '体力上限', icon: 'E' },
          { value: 'max_magic', label: '魔力上限', icon: 'M' },
        ]),
        slot('mode', [{ value: 'set', label: '变为' }, { value: 'add', label: '增加' }]),
        slot('value', null, { number: true }),
      ],
    },
    card_var_change: {
      badge: '卡变量',
      parts: () => [
        slot('mode', [{ value: 'set', label: '设置' }, { value: 'add', label: '增加' }]),
        '本牌的变量', slot('name', null), '为', slot('value', null, { number: true }),
      ],
    },
    player_var_change: {
      badge: '玩家变量',
      parts: () => [
        slot('mode', [
          { value: 'set', label: '设置' },
          { value: 'add', label: '增加' },
          { value: 'sub', label: '减少' },
          { value: 'mul', label: '乘以' },
          { value: 'div', label: '除以' },
        ]),
        slot('target', TARGETS), '的变量', slot('name', null),
        '为', slot('value', null, { number: true }),
      ],
    },
    /* Round 42 / 批次 AF：``card_counter`` 已删除（卡内计数改用
       ``card_prop_change(property:"play_count"|"equip_turns")``），句型一并下架。 */
    destroy_equipment: {
      badge: '摧毁',
      parts: () => [
        '摧毁', slot('mode', [
          { value: 'choice', label: '所选的' },
          { value: 'random', label: '随机1件' },
          { value: 'all', label: '全部' },
        ]), slot('scope', [
          { value: 'target', label: '目标玩家' },
          { value: 'field', label: '全场' },
        ]), '的装备',
      ],
    },
    card_prop_add: {
      badge: '牌属性',
      /* 牌属性名是卡自己定的（power_value / swift_value / fission_level…），
         给不了固定下拉，改成自由文本 */
      parts: () => ['使1张牌的', slot('property', null, { free: true }), '增加', slot('amount', null, { number: true })],
    },
    card_prop_set: {
      badge: '牌属性',
      parts: () => ['使1张牌的', slot('property', null, { free: true }), '变为', slot('value', null, { number: true })],
    },
    /* Round 31 / 批次 Z：card_prop_set / card_prop_add / card_prop_mul 并成
       card_prop_change(mode=set|add|mul)。上面两条保留给老数据渲染。 */
    card_prop_change: {
      badge: '牌属性',
      parts: (row) => {
        /* Round 46 / 批次 AJ：``card`` 写成 zone_card 选择器时把"从谁的哪个区
           里按什么挑哪一张"直接写进句子，其余槽位照旧可编辑。 */
        const picked = cardPositionText((row && row.source && row.source.card) || null);
        if (picked) {
          return [
            '使', picked, '的', slot('property', null, { free: true }),
            slot('mode', [{ value: 'set', label: '变为' }, { value: 'add', label: '增加' }, { value: 'mul', label: '乘以' }]),
            slot('value', null, { number: true, param: ['value', 'amount', 'multiplier'] }),
          ];
        }
        return [
          '使1张牌的', slot('property', null, { free: true }),
          slot('mode', [{ value: 'set', label: '变为' }, { value: 'add', label: '增加' }, { value: 'mul', label: '乘以' }]),
          slot('value', null, { number: true, param: ['value', 'amount', 'multiplier'] }),
        ];
      },
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
    /* Round 51 / 批次 AO：装备属性写值族两合一（set/add 走 mode），
       两个旧句型保留在上面给老工程反渲染。 */
    equipment_prop_change: {
      badge: '装备',
      parts: (row) => {
        const mode = String(((row && row.source) || {}).mode || 'set').trim().toLowerCase();
        if (mode === 'add') {
          return ['使本装备的', slot('property', ['护甲', '攻击次数', '伤害']), '增加',
                  slot('amount', null, { number: true })];
        }
        return ['使本装备的', slot('property', ['护甲', '攻击次数', '伤害']), '变为',
                slot('value', null, { number: true })];
      },
    },
    destroy_self_equipment: { badge: '摧毁', parts: () => ['摧毁本装备'] },
    add_tag: {
      badge: '标签',
      parts: () => [
        slot('mode', [{ value: 'add', label: '使本牌获得' }, { value: 'remove', label: '移除本牌的' },
          { value: 'clear', label: '清除本牌的全部' }]),
        slot('tag', ['迅捷', '沉重', '放逐', '不可摧毁', '唯一']), '标签',
      ],
    },
    /* Round 24：tag_remove_named 并进 remove_tag（与 add_tag 同族）。 */
    remove_tag: {
      badge: '标签',
      parts: () => ['移除本牌的', slot('tag', ['迅捷', '沉重', '放逐', '不可摧毁', '唯一']), '标签'],
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
        slot('status', STATUS_OPTIONS, { status: true }),
      ],
    },
    resolve_status_once: {
      badge: '结算',
      parts: () => ['立即结算', slot('target', TARGETS), '的', slot('status', STATUS_OPTIONS, { status: true }), '各1次'],
    },
    create_copies_to_deck_top: {
      badge: '生成',
      parts: () => ['生成', slot('count', null, { number: true }), '张复制，置于自己抽牌堆顶'],
    },
    copy_card_instance: { badge: '复制', parts: () => ['生成1张复制'] },
    for_each_selected_card: { badge: '逐张', parts: () => ['对选中的每张牌分别结算下列效果'] },

    /* --- 第三批：按 editor_coverage_report 的障碍榜补的通用句型 --- */
    for_each: {
      badge: '循环',
      parts: () => ['对列表中的每一项分别结算下列效果'],
    },
    /* Round 37 / 批次 AD-2：延迟族三合一 —— delayed_effect 用 mode 选分支
       （timed / blind / reveal_hand）。下面是新句型；旧句型 timed_effect /
       delayed_blind_next_turn 保留给老工程打开时反渲染。 */
    delayed_effect: {
      badge: '延迟',
      parts: (row) => {
        const mode = String((row && row.source && row.source.mode) || 'timed').trim();
        if (mode === 'blind') {
          return [
            '使', slot('target', TARGETS), '下个回合开始时失明',
            slot('amount', null, { number: true, prefix: '（', suffix: '层）' }),
          ];
        }
        if (mode === 'reveal_hand') {
          return ['在', slot('target', TARGETS), '下个回合开始时展示其手牌'];
        }
        return [
          '在', slot('target', TARGETS),
          /* trigger 写的是运行时事件键（§1 时点表），以前给的是中文标签，写回去引擎不认 */
          slot('trigger', [
            { value: 'owner_turn_start', label: '拥有者回合开始时' },
            { value: 'owner_turn_end', label: '拥有者回合结束时' },
            { value: 'target_turn_start', label: '目标回合开始时' },
            { value: 'target_turn_end', label: '目标回合结束时' },
            { value: 'any_turn_start', label: '任意回合开始时' },
          ]),
          '执行下列效果',
          slot('duration', null, { number: true, prefix: '（持续', suffix: '回合）' }),
        ];
      },
    },
    timed_effect: {
      badge: '延迟',
      parts: () => [
        '在', slot('target', TARGETS),
        /* trigger 写的是运行时事件键（§1 时点表），以前给的是中文标签，写回去引擎不认 */
        slot('trigger', [
          { value: 'owner_turn_start', label: '拥有者回合开始时' },
          { value: 'owner_turn_end', label: '拥有者回合结束时' },
          { value: 'target_turn_start', label: '目标回合开始时' },
          { value: 'target_turn_end', label: '目标回合结束时' },
          { value: 'any_turn_start', label: '任意回合开始时' },
        ]),
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
      /* 运行时读不到任何参数：就是直接结束本回合 */
      parts: () => ['直接结束本回合'],
    },
    /* Round 38 / 批次 AD-3：回合控制族三合一 —— turn_control 用 mode 选分支
       （end / skip / extra）。下面是新句型；旧句型 force_end_turn / skip_turn
       保留给老工程打开时反渲染。 */
    turn_control: {
      badge: '回合控制',
      parts: (row) => {
        const mode = String((row && row.source && row.source.mode) || 'end').trim();
        if (mode === 'skip') {
          return [
            '使', slot('target', TARGETS), '跳过',
            slot('amount', null, { number: true, prefix: '下', suffix: '个回合' }),
          ];
        }
        if (mode === 'extra') {
          return ['使', slot('target', TARGETS), '获得一个额外回合'];
        }
        /* Round 45 / 批次 AI：第四个分支 —— 蜜糖控制（旧 honey_control 原子）
           并进 turn_control(mode:"forced_action")，句型沿用旧 op 的读法。 */
        if (mode === 'forced_action') {
          return [
            '控制', slot('target', TARGETS), '，持续',
            slot('duration', null, { number: true }), '回合',
          ];
        }
        return ['直接结束本回合'];
      },
    },
    /* Round 42 / 批次 AF：``action_filter`` 已删除——四个 mode 分别由
       ``player_prop_change``（shovel_active / attack_blocked / attack_only）
       与 ``log`` 表达，句型一并下架。 */
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
      parts: () => ['清除', slot('target', TARGETS), '的', slot('status', STATUS_OPTIONS, { status: true })],
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
        /* 运行时读的是资源名（elixir/magic/health），不能写图标标记进去 */
        slot('resource', [
          { value: 'elixir', label: '体力', icon: 'E' },
          { value: 'magic', label: '魔力', icon: 'M' },
          { value: 'health', label: '生命', icon: 'H' },
        ]),
      ],
    },
    /* Round 24（C 类收敛）：burn / poison / toxic 与 add_armor / dodge_permanent /
       remove_armor / set_armor / dodge_this 都已并进下面的规范句型——
       状态走 status_add_named(status="burn"/"poison"/"toxic")，
       护甲闪避走 player_stat_change(mode, stat)。 */
    apply_turn_regen: {
      /* 运行时读 turns + power + kind；以前写的是 amount → 数量根本没生效 */
      badge: '回复',
      parts: () => [
        '使', slot('target', TARGETS), '在接下来的',
        slot('turns', null, { number: true }), '个回合里，每回合开始时恢复',
        slot('power', null, { number: true }),
        slot('kind', [
          { value: 'heal', label: '生命', icon: 'H' },
          { value: 'magic', label: '魔力', icon: 'M' },
        ]),
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

    /* --- 第五批（Round 17 收口）：官方包里剩下的通用原子补句型 ---
       槽位只暴露"运行时确实会读"的参数（见 docs/引擎原子与数据步骤清单.md §6），
       其余参数原样留在步骤里，不在描述里假装可改。 */
    /* Round 24：护甲/闪避族的唯一入口（mode 选 add/remove/set，stat 选 armor/dodge） */
    player_stat_change: {
      badge: '护甲/闪避',
      parts: () => [
        slot('mode', [
          { value: 'add', label: '增加' },
          { value: 'remove', label: '减少' },
          { value: 'set', label: '设为' },
        ]),
        slot('target', TARGETS),
        '的',
        slot('stat', [
          { value: 'armor', label: '护甲' },
          { value: 'dodge', label: '闪避' },
        ]),
        slot('amount', null, { number: true }),
      ],
    },
    /* Round 42 / 批次 AF：``turn_mod_add`` 已删除（写的 e_regen_mod /
       m_regen_mod / draw_mod 零读取方），句型一并下架。 */
    resource_spend: {
      badge: '消耗',
      parts: () => [
        '使', slot('target', TARGETS), '消耗',
        slot('amount', null, { number: true }),
        slot('resource', [
          { value: 'e', label: '体力', icon: 'E' },
          { value: 'm', label: '魔力', icon: 'M' },
        ]),
      ],
    },
    /* Round 42 / 批次 AF：``global_mult`` 已删除（global_*_mult 三个字段零读取方），
       句型一并下架。 */
    equip_reduce_draw: {
      badge: '装备',
      parts: () => [
        '装备效果：',
        slot('target', [{ value: 'self', label: '自己' }, { value: 'enemy', label: '敌方' }]),
        '每回合少抽', slot('amount', null, { number: true }), '张',
      ],
    },
    add_equipment_armor: {
      badge: '装备',
      parts: () => ['使', slot('target', TARGETS), '身上装备的护甲增加', slot('amount', null, { number: true })],
    },
    add_equipment_to_zone: {
      badge: '装备',
      parts: () => [
        '将', slot('card', null, { free: true }), '置入',
        slot('target', TARGETS), '的装备栏',
      ],
    },
    add_charge_to_hand: {
      badge: '电荷',
      parts: () => [
        '使', slot('target', TARGETS), '的手牌各获得',
        slot('amount', null, { number: true }), '层电荷',
      ],
    },
    assembler_effect: {
      badge: '装配',
      parts: () => ['对', slot('target', TARGETS), '结算重构机效果（放逐1张手牌后随机获得）'],
    },
    auto_play_zone_top: {
      badge: '自动打出',
      parts: () => [
        '强制', slot('actor', TARGETS), '自动打出其',
        slot('zone', [
          { value: 'deck', label: '抽牌堆顶' },
          { value: 'hand', label: '手牌' },
          { value: 'discard', label: '弃牌堆' },
        ]),
        '的牌',
      ],
    },
    choose_from_discard: {
      badge: '选牌',
      parts: () => ['从弃牌堆中选择1张牌'],
    },
    clear_statuses: {
      badge: '清状态',
      /* statuses 写 "all" 或列表；多数卡写 all，这里给两个明确选项 */
      parts: () => [
        '清除', slot('target', TARGETS), '的',
        slot('statuses', [
          { value: 'all', label: '全部状态' },
          { value: 'debuffs', label: '全部减益' },
        ]),
      ],
    },
    cogwheel_return: {
      badge: '回收',
      parts: () => ['回收本回合打出、已进牌堆或弃牌堆的牌（齿轮）'],
    },
    consume_magic_for_status: {
      badge: '状态',
      parts: () => [
        '消耗魔力，对', slot('target', TARGETS), '施加',
        slot('status', STATUS_OPTIONS, { status: true }),
      ],
    },
    counter_pending_attack_damage: {
      /* Round 43 / 批次 AG：该 op 已删除（替代写法 = 读响应上下文里的
         first_hit_damage，走 ``direct_damage`` + ``if_else``），句型只留作
         旧包的反渲染。 */
      badge: '反制',
      parts: () => [
        '将本次攻击伤害的', slot('ratio', null, { number: true }),
        '倍反射给', slot('target', TARGETS),
      ],
    },
    create_card: {
      badge: '生成',
      parts: () => [
        '生成1张', slot('card_id', null, { free: true }),
        '并置入', slot('target', TARGETS), '的',
        slot('to', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
          { value: 'exile', label: '放逐区' },
        ]),
      ],
    },
    crit_multiplier_add: {
      badge: '暴击',
      parts: () => [
        '使', slot('target', TARGETS), '的暴击倍率增加',
        slot('amount', null, { number: true }),
      ],
    },
    damage: {
      badge: '伤害',
      /* 引擎别名 → deal_damage；卡面写法与普通伤害一致 */
      parts: () => [
        '对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }),
        '[[icon:D]]',
        slot('hits', null, { number: true, omitWhenOne: true, prefix: '×' }),
      ],
    },
    declare_forced_target: {
      badge: '强制目标',
      parts: () => ['宣告', slot('target', TARGETS), '为本回合的强制目标'],
    },
    defer_game_over: {
      badge: '延后结算',
      parts: () => ['延后死亡结算，依次执行下列效果'],
    },
    delayed_blind_next_turn: {
      badge: '延迟',
      parts: () => [
        '使', slot('target', TARGETS), '下个回合开始时失明',
        slot('amount', null, { number: true, prefix: '（', suffix: '层）' }),
      ],
    },
    destroy_all_destroyable_equipment: {
      badge: '摧毁',
      parts: () => ['摧毁', slot('target', TARGETS), '所有可摧毁的装备'],
    },
    destroy_current_equipment: {
      badge: '摧毁',
      parts: () => ['摧毁当前牌对应的装备'],
    },
    discard_hand_by_paid_e: {
      badge: '弃牌',
      parts: () => [
        '使', slot('target', TARGETS), '弃置总费用不超过',
        slot('threshold', null, { number: true }), '的手牌',
      ],
    },
    electric_web_arm: {
      badge: '电网',
      parts: () => ['对', slot('target', TARGETS), '结算电网（', slot('amount', null, { number: true }), '）'],
    },
    flower_burst: {
      badge: '绽放',
      parts: () => ['使', slot('target', TARGETS), '的花朵绽放（', slot('amount', null, { number: true }), '）'],
    },
    give_magic_orb_to_hand: {
      badge: '给牌',
      parts: () => ['将魔法宝珠加入', slot('target', TARGETS), '手牌'],
    },
    grant_temp_swift_highest_e: {
      badge: '迅捷',
      parts: () => [
        '使 E 最高的', slot('target', TARGETS), '获得',
        slot('amount', null, { number: true }), '层临时迅捷',
      ],
    },
    honey_control: {
      badge: '控制',
      parts: () => [
        '控制', slot('target', TARGETS), '，持续',
        slot('duration', null, { number: true }), '回合',
      ],
    },
    increase_next_cost: {
      badge: '费用',
      parts: () => [
        '使', slot('target', TARGETS), '下一张牌的费用增加',
        slot('amount', null, { number: true }),
      ],
    },
    lose_health: {
      badge: '失去生命',
      parts: () => ['使', slot('target', TARGETS), '直接失去', slot('amount', null, { number: true }), '[[icon:H]]'],
    },
    magic_grapes_damage: {
      badge: '伤害',
      parts: () => [
        '对', slot('target', TARGETS), '造成', slot('amount', null, { number: true }),
        '[[icon:D]]（每件装备多1段）',
      ],
    },
    magic_relic_trigger: {
      badge: '触发',
      parts: () => ['触发魔法遗物效果'],
    },
    /* Round 37 / 批次 AD-2：监听族四合一 —— on_event 用 trigger 选时点
       （play / this_play / after_all / equipment_trigger）。管道型分支
       （出牌监听、本次出牌一次、随后执行）走"内部步骤"折叠行；
       装备触发（魔法遗物）照旧写进描述。旧句型 magic_relic_trigger /
       register_play_listener / once_per_play 保留给老工程打开时反渲染。 */
    on_event: {
      badge: '触发',
      /* Round 47 / 批次 AK：``response`` 分支（吸收 / 反射的伤害响应窗口）
         要写进描述——旧句型 absorb_attack_damage / magic_salt_reflect 的
         读法在这里续上；其余 trigger 照旧按 internal 折叠。 */
      internal: (row) => {
        const source = (row && row.source) || {};
        if (source.response) return false;
        return String(source.trigger || 'play').trim() !== 'equipment_trigger';
      },
      parts: (row) => {
        const source = (row && row.source) || {};
        const kind = String(source.response || '').trim();
        if (kind === 'reflect') {
          return [
            '消耗', slot('cost_m', null, { number: true }), '[[icon:M]]，按',
            slot('ratio', null, { number: true }), '倍反射本次物理攻击',
          ];
        }
        if (kind === 'absorb') {
          return [
            '使', slot('target', TARGETS),
            '受到的攻击伤害被吸收',
            slot('once', [
              { value: 'true', label: '（仅一次）' },
              { value: 'false', label: '（持续）' },
            ], { boolean: true }),
          ];
        }
        return ['触发魔法遗物效果'];
      },
      internalLabel: (row) => {
        const trigger = String((row && row.source && row.source.trigger) || 'play').trim();
        if (trigger === 'this_play') {
          return `本次出牌内结算一次${row.values.name ? `（${row.values.name}）` : ''}`;
        }
        if (trigger === 'after_all') return '随后执行下列效果';
        if (trigger === 'equipment_trigger') return '触发魔法遗物效果';
        return `注册出牌监听${row.values.duration ? `（${row.values.duration}）` : ''}`;
      },
    },
    /* Round 42 / 批次 AF：``emit_event`` 已删除（事件总线无订阅方），
       句型一并下架；广播文案改用 ``log``。 */
    magic_salt_reflect: {
      badge: '反射',
      parts: () => [
        '消耗', slot('cost_m', null, { number: true }), '[[icon:M]]，按',
        slot('ratio', null, { number: true }), '倍反射本次物理攻击',
      ],
    },
    move_cards_to_deck: {
      badge: '入牌堆',
      parts: () => [
        '将选中的牌置于', slot('owner', TARGETS), '的抽牌堆',
        slot('position', [
          { value: 'top', label: '顶' },
          { value: 'bottom', label: '底' },
          { value: 'random_top', label: '随机后置于顶' },
          { value: 'random', label: '随机位置' },
        ]),
      ],
    },
    plank_immunity: {
      /* Round 43 / 批次 AG：该 op 已删除（实现是 return None 的空步骤，木板机制
         由装备标签 blocks_cheap_attacks 承载），句型只留作旧包的反渲染。 */
      badge: '免疫',
      parts: () => ['获得木板免疫（抵御下一次致命效果）'],
    },
    random_discard_from_hand: {
      badge: '弃牌',
      parts: () => ['使', slot('target', TARGETS), '随机弃置', slot('amount', null, { number: true }), '张手牌'],
    },
    remove_specific_card: {
      badge: '移除',
      parts: () => [
        '从', slot('target', TARGETS), '的',
        slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
          { value: 'exile', label: '放逐区' },
          { value: 'equipment', label: '装备栏' },
        ]),
        '移除', slot('card', null, { free: true }),
      ],
    },
    request_reorder_deck: {
      badge: '查看',
      parts: () => ['请求重排', slot('target', TARGETS), '的抽牌堆'],
    },
    restore_match_start_stats: {
      badge: '还原',
      parts: () => ['把', slot('target', TARGETS), '的属性恢复到对局开始时'],
    },
    reveal_enemy_hand: {
      badge: '展示',
      parts: () => ['展示', slot('target', TARGETS), '的手牌'],
    },
    reveal_hand_cards: {
      badge: '展示',
      parts: () => ['把', slot('target', TARGETS), '的手牌展示给', slot('to', TARGETS)],
    },
    /* Round 33 / 批次 AB：reveal_card_set / reveal_enemy_hand / reveal_hand_cards
       三合一（mode 选展示源）；上面三条保留给老工程反渲染。 */
    reveal: {
      badge: '展示',
      parts: (row) => {
        const mode = String((row && row.values && row.values.mode) || 'enemy_hand');
        if (mode === 'card_set') {
          return [
            '把', slot('target', TARGETS), '的', slot('source', [
              { value: 'initial_deck', label: '初始牌组' },
              { value: 'deck', label: '抽牌堆' },
              { value: 'hand', label: '手牌' },
              { value: 'discard', label: '弃牌堆' },
              { value: 'exile', label: '放逐区' },
            ]),
            '展示给', slot('viewer', TARGETS),
          ];
        }
        if (mode === 'hand') {
          return ['把', slot('target', TARGETS), '的手牌展示给', slot('viewer', TARGETS)];
        }
        return ['展示', slot('target', TARGETS), '的手牌'];
      },
    },
    /* Round 44 / 批次 AH：``ricochet_attack`` 原子已删除，替代写法是
       deal_damage + target:{"selector":"bounce",…}（见上面的句型）。老工程里
       残留的这个 op 会走通用行渲染，运行时也会显式报"已移除 + 替代写法"。 */
    seal_equipment: {
      badge: '装备',
      parts: () => [
        '使', slot('target', TARGETS), '的装备获得',
        slot('amount', null, { number: true }), '层尘封',
      ],
    },
    set_card_prop_random: {
      badge: '牌属性',
      parts: () => [
        '把', slot('target', TARGETS), '的',
        slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
        ]),
        '中牌的', slot('property', null, { free: true }), '设为',
        slot('min', null, { number: true }), '~', slot('max', null, { number: true }), '的随机值',
      ],
    },
    set_health: {
      badge: '设定',
      parts: () => ['把', slot('target', TARGETS), '的生命设为', slot('amount', null, { number: true })],
    },
    set_invincible: {
      badge: '无敌',
      parts: () => ['使', slot('target', TARGETS), '获得无敌'],
    },
    /* Round 31 / 批次 Z：set_untargetable / untargetable_layers / set_invincible
       并成 player_status_layers(status=untargetable|invincible)。上面三条保留给
       老数据渲染。 */
    player_status_layers: {
      badge: '状态层',
      parts: () => [
        '使', slot('target', TARGETS), '获得',
        slot('amount', null, { number: true }),
        '层', slot('status', [
          { value: 'untargetable', label: '无法选中' },
          { value: 'invincible', label: '无敌' },
        ]),
      ],
    },
    settle_status: {
      badge: '结算',
      parts: () => [
        '立即结算', slot('target', TARGETS), '的',
        slot('status', STATUS_OPTIONS, { status: true }),
      ],
    },
    shuffle_discard_into_deck: {
      badge: '洗牌',
      parts: () => ['把弃牌堆洗回抽牌堆'],
    },
    shuffle_hand: {
      badge: '洗牌',
      parts: () => ['打乱', slot('target', TARGETS), '的手牌'],
    },
    /* Round 33 / 批次 AB：shuffle_discard_into_deck + shuffle_hand 合并成
       shuffle(zone=discard|hand)；上面两条保留给老工程反渲染。 */
    shuffle: {
      badge: '洗牌',
      parts: (row) => {
        const zone = String((row && row.values && row.values.zone) || 'discard');
        const zoneSlot = slot('zone', [
          { value: 'discard', label: '弃牌堆洗回抽牌堆' },
          { value: 'hand', label: '打乱手牌' },
        ]);
        if (zone === 'hand') {
          return ['打乱', slot('target', TARGETS), '的手牌（', zoneSlot, '）'];
        }
        return ['把弃牌堆洗回抽牌堆（', zoneSlot, '）'];
      },
    },
    skip_turn: {
      badge: '跳过',
      parts: () => [
        '使', slot('target', TARGETS), '跳过',
        slot('amount', null, { number: true, prefix: '下', suffix: '个回合' }),
      ],
    },
    snapshot_card_props: {
      badge: '记录',
      parts: () => [
        '记录', slot('target', TARGETS), '的',
        slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
        ]),
        '中牌的', slot('property', null, { free: true }), '原值',
      ],
    },
    /* Round 33 / 批次 AB：快照族——snapshot(mode:"card_props") 与
       restore(mode=card_props|match_start|turn_start)；上面几条保留给老工程反渲染。 */
    snapshot: {
      badge: '记录',
      parts: () => [
        '记录', slot('target', TARGETS), '的',
        slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
        ]),
        '中牌的', slot('property', null, { free: true }), '原值',
      ],
    },
    restore: {
      badge: '还原',
      parts: (row) => {
        const mode = String((row && row.values && row.values.mode) || 'card_props');
        if (mode === 'match_start') {
          return ['把', slot('target', TARGETS), '的属性恢复到对局开始时'];
        }
        if (mode === 'turn_start') {
          return ['把', slot('target', TARGETS), '的属性恢复到回合开始时'];
        }
        return ['还原', slot('target', TARGETS), '记录过的牌属性'];
      },
    },
    third_eye_precision_or_hidden: {
      badge: '第三只眼',
      parts: () => ['第三只眼：根据选中的牌决定必中或隐藏'],
    },
    toggle_tag_in_zone: {
      badge: '标签',
      parts: () => [
        '翻转', slot('target', TARGETS), '的',
        slot('zone', [
          { value: 'hand', label: '手牌' },
          { value: 'deck', label: '抽牌堆' },
          { value: 'discard', label: '弃牌堆' },
          { value: 'exile', label: '放逐区' },
        ]),
        '中牌的', slot('tag', null, { free: true }), '标签',
      ],
    },
    transform_cards: {
      badge: '变换',
      parts: () => ['把', slot('target', TARGETS), '的指定区域里的牌随机变换'],
    },
    yin_yang_effect: {
      badge: '阴阳',
      parts: () => ['对', slot('target', TARGETS), '触发阴阳效果'],
    },

    /* --- Round 33 / 批次 AC：4 个伞原子 ---
       官方包的数据已经统一走伞形状，旧名（place_as_equip / status_add_named /
       add_tag / auto_play_card…）的模板只为打开老工程反渲染保留：
       * `equipment_op` 判别键是 `mode`（place/give/armor/destroy/seal/
         unprotect/each），destroy 再用 `pick` 选 choice/random/all/self；
       * `status_op` / `tag_op` 判别键是 **`action`**——步骤自己的 `op` 键被伞
         占用，运行时只从 `action` 读子模式（见 game_engine._atomic_status_op）；
       * `auto_play` 判别键是 `mode`（card/zone_top/queue）。
       下拉槽位的 `param` 必须写成 mode/action/pick，否则写回去引擎读不到。 */
    equipment_op: {
      badge: '装备',
      parts: (row) => {
        const values = (row && row.values) || {};
        const source = (row && row.source) || {};
        /* 分支以**步骤里的原始键**为准：填槽位只有两趟，嵌套判别（mode → pick）
           在第二趟才读得到 pick，靠 values 会漏掉最后一层。 */
        const mode = String(source.mode ?? values.mode ?? 'place');
        const ownerSlot = slot('owner', ['自己', '目标']);
        const modeSlot = slot('mode', [
          { value: 'place', label: '将本牌置入' },
          { value: 'give', label: '生成' },
          { value: 'armor', label: '使' },
          { value: 'destroy', label: '摧毁' },
          { value: 'seal', label: '尘封' },
          { value: 'unprotect', label: '解除' },
          { value: 'each', label: '逐件结算' },
        ]);
        if (mode === 'give') {
          return [modeSlot, slot('card', null, { free: true }), '并置入', slot('target', TARGETS), '的装备栏'];
        }
        if (mode === 'armor') {
          return [modeSlot, slot('target', TARGETS), '身上装备的护甲增加', slot('amount', null, { number: true })];
        }
        if (mode === 'destroy') {
          const pick = String(source.pick ?? values.pick ?? 'choice');
          const pickSlot = slot('pick', [
            { value: 'choice', label: '所选的' },
            { value: 'random', label: '随机1件' },
            { value: 'all', label: '全部' },
            { value: 'self', label: '本装备' },
          ], { param: 'pick' });
          if (pick === 'self') return [modeSlot, pickSlot];
          if (pick === 'all') {
            return [
              modeSlot, pickSlot, slot('target', TARGETS), '的装备',
              slot('filter', [{ value: '', label: '（全部）' }, { value: 'destroyable', label: '（仅可摧毁的）' }]),
            ];
          }
          return [modeSlot, pickSlot, slot('target', TARGETS), '的装备'];
        }
        if (mode === 'seal') {
          return [
            modeSlot, slot('target', TARGETS), '的装备',
            slot('amount', null, { number: true, prefix: '（', suffix: '层尘封）' }),
          ];
        }
        if (mode === 'unprotect') {
          return [modeSlot, slot('target', TARGETS), '的装备保护'];
        }
        if (mode === 'each') {
          return [modeSlot, slot('target', TARGETS), '的每件装备（下列效果）'];
        }
        /* place：owner 缺省是出牌玩家自己（引擎回落到 player_id），
           effect_target 缺省是出牌时选中的目标。 */
        return [modeSlot, ownerSlot, '的装备栏，效果指向', slot('effect_target', TARGETS)];
      },
    },
    status_op: {
      badge: '状态',
      parts: (row) => {
        const values = (row && row.values) || {};
        const source = (row && row.source) || {};
        /* action:"set" 是旧 set_status_named（把状态层数设成 N）；
           add 也是引擎的合法子模式，set 只是它的一个下拉写法。
           mode:"set"（旧写法）也当 set 段显示。 */
        const rawAction = String(source.action ?? values.action ?? 'add');
        const action = rawAction === 'add' && String(source.mode ?? values.mode ?? '') === 'set'
          ? 'set' : rawAction;
        const actionSlot = slot('action', [
          { value: 'add', label: '使' },
          { value: 'set', label: '将' },
          { value: 'remove', label: '移除' },
          { value: 'clear', label: '清除' },
          { value: 'settle', label: '结算' },
        ]);
        const statusSlot = slot('status', STATUS_OPTIONS, { status: true });
        const stacks = slot('amount', null, { number: true });
        /* amount 写 "all"（或者干脆不写）时是"清空层数"，数字输入框放不下它 */
        const amount = source.amount ?? values.amount;
        const clearAll = amount === undefined || amount === null || amount === ''
          || !Number.isFinite(Number(amount));
        if (action === 'set') {
          return [actionSlot, slot('target', TARGETS), '的', statusSlot, '层数设为', stacks, '层'];
        }
        if (action === 'remove') {
          if (clearAll) return [actionSlot, slot('target', TARGETS), '的', statusSlot, '层数'];
          return [actionSlot, slot('target', TARGETS), '的', stacks, '层', statusSlot];
        }
        if (action === 'clear') {
          /* 引擎的 clear 段：`statuses:"all"` 或名单；`buffs`/`debuffs` 是 preset
             名单，必须写在 `preset` 键上（写进 statuses 会被当成一个状态名）。 */
          return [
            actionSlot, slot('target', TARGETS), '的',
            slot('preset', [
              { value: 'all', label: '全部状态' },
              { value: 'debuffs', label: '全部减益' },
              { value: 'buffs', label: '全部增益' },
            ]),
          ];
        }
        if (action === 'settle') {
          return [
            actionSlot, slot('target', TARGETS), '的', statusSlot, '各1次',
            slot('reduce', null, { number: true, prefix: '（结算后减少', suffix: '层）' }),
          ];
        }
        return [actionSlot, slot('target', TARGETS), '获得', stacks, '层', statusSlot];
      },
    },
    tag_op: {
      badge: '标签',
      parts: (row) => {
        const values = (row && row.values) || {};
        const source = (row && row.source) || {};
        const action = String(source.action ?? values.action ?? 'add');
        const actionSlot = slot('action', TAG_ACTIONS);
        const tagSlot = slot('tag', BUILTIN_TAG_OPTIONS, { tag: true });
        /* 带 zone/zones 的是区域级（旧 add_tag_to_zone），不带是单卡级（旧 add_tag）。
           区域级只有 add/remove/toggle 三段，clear 只在单卡级有效。 */
        const zoneLevel = source.zone !== undefined || source.zones !== undefined;
        const zoneSlot = slot('zone', CARD_ZONES, { param: ['zone', 'zones'] });
        if (action === 'clear') {
          return [actionSlot, '本牌的全部标签'];
        }
        /* Round 46 / 批次 AJ：卡片位是对象（区域选牌 / 刚才记住的牌）时给只读读法。 */
        const cardText = cardPositionText(source.card);
        const cardPart = cardText || slot('card', CARD_REFS);
        if (zoneLevel) {
          if (action === 'add') {
            return [actionSlot, slot('target', TARGETS), '的', zoneSlot, '中的牌获得', tagSlot, '标签'];
          }
          return [actionSlot, slot('target', TARGETS), '的', zoneSlot, '中牌的', tagSlot, '标签'];
        }
        if (action === 'add') {
          return [actionSlot, cardPart, '获得', tagSlot, '标签'];
        }
        return [actionSlot, cardPart, '的', tagSlot, '标签'];
      },
    },
    auto_play: {
      badge: '自动打出',
      parts: (row) => {
        const values = (row && row.values) || {};
        const source = (row && row.source) || {};
        const mode = String(source.mode ?? values.mode ?? 'card');
        const modeSlot = slot('mode', [
          { value: 'card', label: '自动打出' },
          { value: 'zone_top', label: '强制自动打出' },
          { value: 'queue', label: '登记自动打出' },
        ]);
        if (mode === 'zone_top') {
          return [
            modeSlot, slot('actor', PLAYER_REFS), '的', slot('zone', [
              { value: 'deck', label: '抽牌堆顶' },
              { value: 'hand', label: '手牌' },
              { value: 'discard', label: '弃牌堆' },
              { value: 'exile', label: '放逐区' },
            ]), '的牌',
            slot('cost', [{ value: 'free', label: '（不支付费用）' }, { value: 'normal', label: '（支付费用）' }]),
          ];
        }
        if (mode === 'queue') {
          return [modeSlot, slot('card', CARD_REFS), '（拥有者回合开始时）'];
        }
        return [
          modeSlot, '1张', slot('card', CARD_REFS),
          slot('no_cost', [{ value: 'true', label: '（不支付费用）' }, { value: 'false', label: '（支付费用）' }], { boolean: true }),
        ];
      },
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
    /* Round 32 / 批次 AA：if 并入 if_else（不写 else 就是旧 if）。 */
    if_else: {
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
    /* Round 17 补：其余管道型 op（不进卡面描述，只在"内部步骤"里显示） */
    add_var: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `变量 ${row.values.name || '?'} 增加 ${row.values.value ?? 0}`,
    },
    list_append: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `列表 ${row.values.name || '?'} 追加一项`,
    },
    /* Round 32 / 批次 AA：列表五兄弟并成 list_modify（list=变量名、mode=动作）。 */
    list_modify: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `列表 ${row.values.list || row.values.name || '?'} ${row.values.mode || 'append'}`,
    },
    /* Round 32 / 批次 AA：费用族并成 modify_next_cost（delta 正负定方向）。
       Round 43 / 批次 AG：``modify_next_cost`` 也已删除（加费/减费 =
       card_prop_add_to_zone 写 temp_heavy_value / temp_swift_value），
       句型只留作旧包的反渲染。 */
    modify_next_cost: {
      badge: '费用',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `下次出牌费用 ${(row.values.delta ?? row.values.amount ?? 1)}`,
    },
    mark_original_card: {
      badge: '内部',
      internal: true,
      parts: () => [],
      internalLabel: (row) => `标记本牌 ${row.values.marker || '?'} = ${row.values.value ?? 1}`,
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
  { id: 'magic_damage', label: '魔法伤害（电伤）', steps: [
    { op: 'direct_damage', target: 'target', amount: 5, damage_type: 'magic', damage_tag: 'gtn:battery' },
  ] },
  { id: 'heal', label: '回复生命', steps: [{ op: 'health_op', mode: 'heal', target: 'self', amount: 5 }] },
  { id: 'damage_status', label: '伤害并附加状态', steps: [
    { op: 'deal_damage', target: 'target', amount: 3 },
    { op: 'status_op', action: 'add', target: 'target', status: 'fire', amount: 2 },
  ] },
  { id: 'status_self', label: '使自己获得状态', steps: [
    { op: 'status_op', action: 'add', target: 'self', status: 'armor', amount: 2 },
  ] },
  { id: 'draw', label: '抽牌', steps: [{ op: 'draw', amount: 2 }] },
  { id: 'gain_resource', label: '获得资源 E/M', steps: [{ op: 'resource_op', resource: 'e', delta: 1, target: 'self' }] },
  { id: 'equip', label: '置入装备栏', steps: [{ op: 'equipment_op', mode: 'place' }] },
  { id: 'destroy_own_equipment', label: '摧毁本装备', steps: [{ op: 'equipment_op', mode: 'destroy', pick: 'self' }] },
  { id: 'tag_self', label: '使本牌获得标签', steps: [{ op: 'tag_op', action: 'add', card: 'current_card', tag: 'exile' }] },
  { id: 'auto_play_copy', label: '自动打出上一步的复制', steps: [
    { op: 'auto_play', mode: 'card', card: { ref: 'last_created_card' }, no_cost: true },
  ] },
  { id: 'discard_to_deck', label: '从弃牌堆放回牌堆顶', steps: [
    { op: 'request', type: 'card', target: 'self', zone: 'discard', choice_type: 'choose_from_discard', cancellable: true },
    { op: 'move_card', card: { ref: 'selected_card' }, target: 'self', zone: 'deck', position: 'top' },
  ] },
  { id: 'conditional', label: '条件分支（如果…则…）', steps: [
    { op: 'if_else', condition: { op: 'compare', a: { op: 'last_damage' }, operator: '>=', b: 1 }, then: [] },
  ] },
  { id: 'repeat_targets', label: '对所有可选目标生效', steps: [
    { op: 'for_each', items: 'wide_strike_targets', bind: 'target', body: [] },
  ] },
  { id: 'cleanse', label: '清除状态', steps: [
    { op: 'status_op', action: 'remove', target: 'self', status: 'fire' },
  ] },
  { id: 'draw_to_limit', label: '抽至手牌上限', steps: [
    {
      op: 'if_else',
      condition: {
        op: 'compare',
        a: { op: 'sub', values: [{ op: 'player_stat', target: 'self', stat: 'hand_limit' }, { op: 'hand_count', target: 'self' }] },
        operator: '>',
        b: 0,
      },
      then: [
        {
          op: 'draw',
          target: 'self',
          count: { op: 'sub', values: [{ op: 'player_stat', target: 'self', stat: 'hand_limit' }, { op: 'hand_count', target: 'self' }] },
          hooks: true,
          log_amount: 'requested',
        },
      ],
    },
  ] },
];

/** 一行 → 中文句子（管道型返回空串）。 */
/** 槽位值 → 描述里要显示的东西：成对选项优先用它的图标标记，其次中文 label。 */
function slotDisplay(part, raw) {
  const options = Array.isArray(part.options) ? part.options : [];
  if (!options.some((option) => option && typeof option === 'object')) return raw;
  if (raw === undefined || raw === null || raw === '') return '';
  const matched = options.find((option) => option && typeof option === 'object'
    && String(option.value) === String(raw));
  if (!matched) return raw;
  if (matched.icon) return `[[icon:${matched.icon}]]`;
  return matched.label ?? matched.value;
}

export function describeRow(row, templates, expr) {
  if (row.generic) return row.summary || row.op;
  const tpl = templates[row.tpl];
  if (!tpl) return row.op;
  if (tpl.internal) return '';
  return tpl.parts(row).map((part) => {
    if (typeof part === 'string') return part;
    const value = row.values[part.slot];
    const first = part.options && part.options.length
      ? (typeof part.options[0] === 'object' ? part.options[0].value : part.options[0])
      : '';
    const resolved = (value !== undefined && value !== null && value !== '')
      ? slotDisplay(part, value)
      : (part.number ? 1 : slotDisplay(part, first));
    if (part.omitWhenOne && Number(resolved) <= 1) return '';
    return (part.prefix || '') + resolved + (part.suffix || '');
  }).join('');
}

export function describeRows(rows, templates, expr) {
  return rows.map((row) => describeRow(row, templates, expr)).filter(Boolean).join('；');
}
