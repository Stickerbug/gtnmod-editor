/* 内部标识 → 中文。卡面描述里不允许出现内部 id（见 docs/卡牌描述规范.md）。 */

/* 游戏内置状态的中文名；模组自定义状态由 generated 数据里的 statusLabels 补 */
export const STATUS_LABELS = {
  fire: '灼烧', poison: '中毒', bleed: '流血', weakness: '虚弱', frost: '霜冻',
  toxic: '剧毒', toxic_poison: '剧毒', armor: '护甲', dodge: '闪避', shield: '护盾',
  fragile: '易碎', sluggish: '迟钝', blind: '致盲', invincible: '无敌', stun: '眩晕',
  heavyweight: '沉重', slow: '迟缓', root_status: '缠绕',
};

export const PROPERTY_LABELS = {
  damage: '伤害', hits: '攻击次数', cost_e: 'E 消耗', cost_m: 'M 消耗',
  health: '生命', armor: '护甲', elixir: '灵气 E', magic: '魔力 M',
  /* player_prop_add 的句型自带"上限+"，这里只给属性名 */
  max_health: '生命', max_elixir: '灵气', max_magic: '魔力',
  base_max_health: '生命', base_max_elixir: '灵气', base_max_magic: '魔力',
  attack: '攻击', count: '数量', value: '数值', power: '威力',
};

export const ZONE_LABELS = {
  hand: '手牌', deck: '抽牌堆', discard: '弃牌堆', exile: '放逐区',
  equipment: '装备栏', board: '场上', grave: '阵亡区',
};

export const TARGET_LABELS = {
  target: '目标', enemy: '目标', self: '自己', all_enemies: '所有玩家',
  all_selectable: '所有可选目标', source: '自己', player: '目标',
  play_targets: '目标', choice_target: '目标', all_others: '其他玩家',
  wide_strike_targets: '所有目标', attacker: '攻击者', owner: '装备拥有者',
  /* Round 17 补：这些选择器在包数据里出现过，之前会原样漏进卡面描述 */
  all_players: '所有玩家', all: '所有玩家', both: '双方',
  event_target: '事件目标', event_source: '事件来源', damage_source: '伤害来源',
  equipment_target: '装备目标',
};

/** 装备实例上的字段（equipment_prop 的 property）；表里没有的原样显示。 */
export const EQUIPMENT_PROPERTY_LABELS = {
  effect_target: '装备目标',
};

/** 中文 label → 运行时值。只取每个 label 的第一个 id（表里第一个是最规范的写法）。 */
function invertLabelMap(map) {
  const out = {};
  Object.entries(map).forEach(([value, label]) => {
    if (!(label in out)) out[label] = value;
  });
  return out;
}

/** 效果行槽位写回数据时用的"显示名 → 运行时 id"表（槽位名 → 映射）。 */
export const SLOT_VALUE_IDS = {
  target: invertLabelMap(TARGET_LABELS),
  zone: invertLabelMap(ZONE_LABELS),
  property: invertLabelMap(PROPERTY_LABELS),
  prop: invertLabelMap(PROPERTY_LABELS),
  status: invertLabelMap(STATUS_LABELS),
};

/** 生成一组翻译函数；rules 是 generated/card-text-rules.js 的默认导出。 */
export function createTermTranslator(rules = {}) {
  const packStatuses = rules.statusLabels || {};
  const tagLabels = rules.tagLabels || {};

  const status = (raw) => {
    const key = String(raw || '').trim();
    if (!key) return '';
    const short = key.split(':').pop();
    return STATUS_LABELS[key] || STATUS_LABELS[short] || packStatuses[key] || packStatuses[short] || key;
  };
  const tag = (raw) => {
    const key = String(raw || '').trim();
    return tagLabels[key] || status(key);
  };
  const property = (raw) => PROPERTY_LABELS[String(raw || '').trim()] || String(raw || '');
  const zone = (raw) => ZONE_LABELS[String(raw || '').trim()] || String(raw || '');
  const target = (raw) => TARGET_LABELS[String(raw || '').trim()] || String(raw || '');

  return { status, tag, property, zone, target };
}

/* ---------- 条件/表达式 → 中文 ---------- */

export const COMPARE_OPERATORS = {
  gte: '≥', lte: '≤', gt: '＞', lt: '＜', eq: '=', ne: '≠',
  '>=': '≥', '<=': '≤', '>': '＞', '<': '＜', '==': '=', '!=': '≠',
};

export const CARD_PROPERTY_LABELS = {
  extra_hits: '额外攻击次数', damage: '伤害', hits: '攻击次数',
};

/** 表达式树 → 中文。terms 来自 createTermTranslator()。 */
export function createExpressionDescriber(terms) {
  const value = (expr) => {
    if (expr === null || expr === undefined) return '';
    if (typeof expr === 'number' || typeof expr === 'boolean') return String(expr);
    if (typeof expr === 'string') {
      if (expr === 'current_card') return '本牌';
      if (expr === 'target') return '目标';
      if (expr === 'self' || expr === 'source') return '自己';
      return expr;
    }
    if (typeof expr !== 'object') return String(expr);
    return describe(expr);
  };

  const describe = (expr, depth = 0) => {
    if (expr === null || expr === undefined || depth > 4) return '';
    if (typeof expr === 'number' || typeof expr === 'boolean' || typeof expr === 'string') {
      return value(expr);
    }
    const op = String(expr.op || expr.ref || expr.type || '');
    const values = Array.isArray(expr.values) ? expr.values : [];
    /* and/or/not 三种写法：values / conditions / left+right 都要认（包数据里都有） */
    const branches = (node) => {
      if (Array.isArray(node.conditions)) return node.conditions;
      if (Array.isArray(node.values)) return node.values;
      return [node.left ?? node.value, node.right];
    };
    switch (op) {
      case 'and': return branches(expr).filter((item) => item !== undefined).map(value).join('且');
      case 'or': return branches(expr).filter((item) => item !== undefined).map(value).join('或');
      case 'not': {
        const inner = describe(expr.value ?? expr.cond ?? expr.condition
          ?? values[0] ?? (Array.isArray(expr.conditions) ? expr.conditions[0] : undefined), depth + 1);
        /* "本牌具有放逐标签" → "本牌不具有放逐标签"，更接近规范里的写法 */
        return inner.startsWith('本牌具有') ? `本牌不${inner.slice(2)}` : `非${inner}`;
      }
      case 'compare': {
        const left = value(expr.a ?? expr.left ?? values[0]);
        const right = value(expr.b ?? expr.right ?? values[1]);
        const operator = COMPARE_OPERATORS[String(expr.operator || expr.cmp || '')] || '?';
        return `${left}${operator}${right}`;
      }
      case 'add': return values.map(value).join('+');
      case 'sub': return values.map(value).join('-');
      case 'mul': return values.map(value).join('×');
      case 'div': return `${value(expr.a ?? values[0])}÷${value(expr.b ?? values[1])}`;
      case 'floor': return `向下取整(${value(expr.value ?? values[0])})`;
      case 'ceil': return `向上取整(${value(expr.value ?? values[0])})`;
      case 'min': return `min(${values.map(value).join(', ')})`;
      case 'max': return `max(${values.map(value).join(', ')})`;
      case 'card_has_tag': return `本牌具有${terms.tag(expr.tag)}标签`;
      case 'has_tag': return `${value(expr.card)}具有${terms.tag(expr.tag)}标签`;
      case 'card_property': {
        const property = CARD_PROPERTY_LABELS[String(expr.property)] || String(expr.property || '');
        return `${value(expr.card)}的${property}`;
      }
      case 'last_damage': return expr.side === 'dealt' ? '上次造成的伤害' : '上次受到的伤害';
      case 'status_stack': return `${value(expr.target || 'target')}的${terms.status(expr.status)}层数`;
      case 'hand_count': return `${value(expr.target || 'target')}的手牌数`;
      case 'deck_count': return `${value(expr.target || 'target')}的抽牌堆数`;
      case 'player_stat': return `${value(expr.target || 'target')}的${terms.property(expr.stat)}`;
      case 'player_property': return `${value(expr.target || 'target')}的${terms.property(expr.property)}`;
      case 'var': return `${expr.name || '?'}`;
      case 'player_var': return `${expr.name || '?'}`;
      case 'card_var': return `卡变量${expr.name || '?'}`;
      case 'card_prop':
      case 'card_property':
        return `${value(expr.card || expr.card_id || '')}的${terms.property(expr.property || expr.prop)}`;
      case 'zone_count': return `${value(expr.target || 'target')}的${terms.zone(expr.zone)}牌数`;
      case 'selected_cards_count': return '已选牌数';
      case 'selected_card_index': return '已选牌序号';
      case 'last_positive_hits': return '上次命中次数';
      case 'hand_full': return `${value(expr.target || 'target')}手牌已满`;
      case 'current_turn_player': return '当前回合玩家';
      case 'has_status_named': return `${value(expr.target || 'target')}拥有${terms.status(expr.status)}`;
      case 'card_has_modifier': return `本牌具有标记${expr.modifier || ''}`;
      case 'damage_type_is': {
        const type = String(expr.type_name || expr.damage_type || '');
        return `本次伤害${type === 'magic' ? '是魔法（电伤）' : '是物理'}`;
      }
      case 'target_selectable': return `${value(expr.target || 'target')}可被选中`;
      case 'play_was_countered': return '本次打出被反制';
      case 'get': return `${value(expr.object)}的${expr.key || '?'}`;
      case 'choice_value': return '选择值';
      /* 装备属性（Round 18）：equipment_prop{equipment, property} 读的是装备实例上的字段 */
      case 'equipment_prop':
      case 'equipment_property': {
        const equipment = expr.equipment;
        const ref = equipment && typeof equipment === 'object'
          ? String(equipment.ref || equipment.op || equipment.type || '')
          : String(equipment || '');
        const owner = ref === 'current_equipment' ? '当前装备'
          : (ref === 'first' ? '第一件装备' : `${value(equipment) || '装备'}`);
        const property = String(expr.property || expr.prop || '');
        return `${owner}的${PROPERTY_LABELS[property] || EQUIPMENT_PROPERTY_LABELS[property] || property || '?'}`;
      }
      case 'current_equipment': return '当前装备';
      case 'equipment_by_instance_id': return '指定装备';
      default: {
        const scalar = Object.entries(expr)
          .filter(([key, item]) => !['op', 'ref', 'type', 'values'].includes(key)
            && item !== null && typeof item !== 'object')
          .slice(0, 3)
          .map(([key, item]) => `${key}=${item}`)
          .join(' ');
        return scalar ? `${op}(${scalar})` : (op || '条件');
      }
    }
  };

  return { value, describe };
}
