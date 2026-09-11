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
    switch (op) {
      case 'and': return `${value(expr.left ?? values[0])}且${value(expr.right ?? values[1])}`;
      case 'or': return `${value(expr.left ?? values[0])}或${value(expr.right ?? values[1])}`;
      case 'not': {
        const inner = describe(expr.value ?? expr.cond ?? values[0], depth + 1);
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
      case 'choice_value': return '选择值';
      case 'player_var': return `变量${expr.name || ''}`;
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
