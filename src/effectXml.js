const XML_NS = 'https://developers.google.com/blockly/xml';

const TARGET_BLOCKS = {
  self: 'target_self',
  teammate: 'target_teammate',
  friendly: 'target_friendly',
  enemy: 'target_enemy',
  all_enemies: 'target_all_enemies',
  both: 'target_both',
  random_friendly: 'target_random_friendly',
  random_enemy: 'target_random_enemy',
  random_player: 'target_random_player',
  random_side: 'target_random_side',
  event_target: 'target_event_target',
  event_source: 'target_event_source',
  last_actor: 'target_last_actor',
  highest_health: 'target_highest_health',
  lowest_health: 'target_lowest_health',
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function scalar(value, fallback = 0) {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  return fallback;
}

function fieldXml(name, value) {
  if (value === undefined || value === null) return '';
  return `<field name="${esc(name)}">${esc(value)}</field>`;
}

function valueXml(name, blockXml) {
  return blockXml ? `<value name="${esc(name)}">${blockXml}</value>` : '';
}

function statementXml(name, blockXml) {
  return blockXml ? `<statement name="${esc(name)}">${blockXml}</statement>` : '';
}

function blockXml(type, { fields = {}, values = {}, statements = {} } = {}) {
  const fieldText = Object.entries(fields).map(([name, value]) => fieldXml(name, value)).join('');
  const valueText = Object.entries(values).map(([name, child]) => valueXml(name, child)).join('');
  const statementText = Object.entries(statements).map(([name, child]) => statementXml(name, child)).join('');
  return `<block type="${esc(type)}">${fieldText}${valueText}${statementText}</block>`;
}

function attachNext(block, next) {
  if (!next) return block;
  const close = block.lastIndexOf('</block>');
  if (close < 0) return block;
  return `${block.slice(0, close)}<next>${next}</next>${block.slice(close)}`;
}

function chain(blocks) {
  const clean = blocks.filter(Boolean);
  if (!clean.length) return '';
  return attachNext(clean[0], chain(clean.slice(1)));
}

function targetBlock(target = 'self') {
  return blockXml(TARGET_BLOCKS[target] || 'target_self');
}

function targetValue(params, name = 'TARGET', fallback = 'self') {
  return { [name]: targetBlock(params?.target || fallback) };
}

function numberBlock(value, fallback = 0) {
  if (value && typeof value === 'object') return expressionToBlock(value, fallback);
  return blockXml('value_number', { fields: { NUM: scalar(value, fallback) } });
}

function expressionToBlock(expr, fallback = 0) {
  if (typeof expr === 'number' || typeof expr === 'string') return numberBlock(expr, fallback);
  if (!expr || typeof expr !== 'object') return numberBlock(fallback, fallback);
  const ref = expr.ref || '';
  if (ref === 'var') {
    return blockXml('value_var', {
      fields: { NAME: expr.name || '' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'target_attribute') {
    return blockXml('value_target_attribute', {
      fields: { ATTR: expr.attr || 'health' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  const attrByRef = {
    hand_size: 'hand_size',
    deck_remaining: 'deck_remaining',
    discard_size: 'discard_size',
    exile_size: 'exile_size',
    equip_count: 'equip_count',
  };
  if (attrByRef[ref]) {
    return blockXml('value_target_attribute', {
      fields: { ATTR: attrByRef[ref] },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'status_count') {
    return blockXml('value_status_count', {
      fields: { STATUS: expr.status || '' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'incoming_damage') return blockXml('value_incoming_damage');
  if (ref === 'last_damage') return blockXml('value_last_damage');
  if (ref === 'math_op') {
    return blockXml('value_math_op', {
      fields: { OP: expr.op || '+' },
      values: { A: expressionToBlock(expr.a, 0), B: expressionToBlock(expr.b, 0) },
    });
  }
  if (ref === 'round') {
    return blockXml('value_round', {
      fields: { MODE: expr.mode || 'round' },
      values: { VALUE: expressionToBlock(expr.value, 0) },
    });
  }
  if (ref === 'min_max') {
    return blockXml('value_min_max', {
      fields: { MODE: expr.mode || 'max' },
      values: { A: expressionToBlock(expr.a, 0), B: expressionToBlock(expr.b, 0) },
    });
  }
  if (ref === 'random') {
    return blockXml('value_random', {
      values: { MIN: expressionToBlock(expr.min, 1), MAX: expressionToBlock(expr.max, 10) },
    });
  }
  return numberBlock(fallback, fallback);
}

function nestedEffects(params) {
  return Array.isArray(params?.effects) ? params.effects : Array.isArray(params?.body) ? params.body : [];
}

function effectsToStatement(params) {
  return chain(nestedEffects(params).map(effectToBlock));
}

function effectToBlock(effect) {
  if (!effect) return '';
  const type = typeof effect === 'string' ? effect : effect.type || '';
  const params = typeof effect === 'string' ? {} : effect.params || {};
  switch (type) {
    case 'damage':
    case 'deal_damage': {
      const hits = Number(params.hits || 1);
      const blockType = hits > 1 ? 'action_damage_multi' : 'action_damage';
      const fields = { IS_PRECISION: params.is_precision ? 'TRUE' : 'FALSE' };
      const values = { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 6) };
      if (hits > 1) values.TIMES = numberBlock(hits, 1);
      return blockXml(blockType, { fields, values });
    }
    case 'damage_multi':
    case 'deal_damage_multi':
      return blockXml('action_damage_multi', {
        fields: {
          IS_PRECISION: params.is_precision ? 'TRUE' : 'FALSE',
        },
        values: {
          ...targetValue(params, 'TARGET', 'enemy'),
          AMOUNT: numberBlock(params.amount, 2),
          TIMES: numberBlock(params.times, 2),
        },
      });
    case 'direct_damage':
      return blockXml('action_direct_damage', {
        fields: { SOURCE: scalar(params.source, '效果') },
        values: { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 1) },
      });
    case 'lifesteal_damage':
      return blockXml('action_lifesteal_damage', {
        values: {
          ...targetValue(params, 'TARGET', 'enemy'),
          AMOUNT: numberBlock(params.amount, 8),
          HEAL: numberBlock(params.heal, 4),
        },
      });
    case 'triangle_damage':
      return blockXml('action_triangle_damage', {
        values: {
          ...targetValue(params, 'TARGET', 'enemy'),
          BASE: numberBlock(params.base, 6),
          PER_STACK: numberBlock(params.per_stack, 3),
          MAX_STACKS: numberBlock(params.max_stacks, 4),
        },
      });
    case 'heal':
      return blockXml('action_heal', { fields: { AMOUNT: scalar(params.amount, 4) }, values: targetValue(params, 'TARGET', 'self') });
    case 'set_health':
      return blockXml('action_set_health', { fields: { AMOUNT: scalar(params.amount, 20) }, values: targetValue(params, 'TARGET', 'self') });
    case 'gain_e':
      return blockXml('action_gain_e', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'self') });
    case 'gain_m':
      return blockXml('action_gain_m', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'self') });
    case 'cost_e':
      return blockXml('action_cost_e', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'self') });
    case 'cost_m':
      return blockXml('action_cost_m', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'self') });
    case 'poison':
    case 'apply_poison':
      return blockXml('action_poison', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'enemy') });
    case 'burn':
    case 'apply_burn':
      return blockXml('action_burn', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'enemy') });
    case 'vulnus':
    case 'apply_vulnerable':
      return blockXml('action_vulnus', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'enemy') });
    case 'toxic':
    case 'apply_toxic':
      return blockXml('action_toxic', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'enemy') });
    case 'draw':
      return blockXml('action_draw', { fields: { AMOUNT: scalar(params.amount, 1) }, values: targetValue(params, 'TARGET', 'self') });
    case 'discard':
      return blockXml('action_discard', { fields: { AMOUNT: scalar(params.amount, 1) } });
    case 'discard_choice_then_draw':
      return blockXml('action_discard_choice_then_draw');
    case 'coffee_gain_e':
      return blockXml('action_coffee_gain_e', { fields: { AMOUNT: scalar(params.amount, 1), FIRST_BONUS: scalar(params.first_bonus, 1) } });
    case 'choose_from_deck':
      return blockXml('action_choose_from_deck');
    case 'choose_from_discard':
      return blockXml('action_choose_from_discard');
    case 'choose_from_exile':
      return blockXml('action_choose_from_exile');
    case 'reveal_hand':
    case 'reveal_enemy_hand':
      return blockXml('action_reveal_hand', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'steal_card':
    case 'steal_enemy_card':
      return blockXml('action_steal_card', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'destroy_random_equip':
      return blockXml('action_destroy_random_equip', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'destroy_all_equip':
      return blockXml('action_destroy_all_equip', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'destroy_all_field_equip':
      return blockXml('action_destroy_all_field_equip');
    case 'destroy_equipment_choice_or_first':
      return blockXml('action_destroy_equipment_choice_or_first', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'destroy_all_destroyable_equipment':
      return blockXml('action_destroy_all_destroyable_equipment', { values: targetValue(params, 'TARGET', 'both') });
    case 'equip_disc_armor':
      return blockXml('action_equip_disc_armor', { fields: { AMOUNT: scalar(params.amount, 2) } });
    case 'equip_sponge':
      return blockXml('action_equip_sponge');
    case 'equip_set_health':
      return blockXml('action_equip_set_health', { fields: { AMOUNT: scalar(params.amount, 60) } });
    case 'equip_reduce_own_draw':
      return blockXml('action_equip_reduce_own_draw', { fields: { AMOUNT: scalar(params.amount, 1) } });
    case 'equip_reduce_own_e':
      return blockXml('action_equip_reduce_own_e', { fields: { AMOUNT: scalar(params.amount, 1) } });
    case 'equip_on_destroy_remove_poison_damage':
      return blockXml('action_equip_on_destroy_remove_poison_damage', { fields: { MULTIPLIER: scalar(params.multiplier, 2) } });
    case 'activate_corruption':
      return blockXml('action_activate_corruption');
    case 'magic_battery_gain_m':
      return blockXml('action_magic_battery_gain_m', {
        fields: { AMOUNT: scalar(params.amount, 1), LIMIT: scalar(params.limit, 3) },
        values: targetValue(params, 'TARGET', 'self'),
      });
    case 'skip_turn':
      return blockXml('action_skip_turn', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'block_enemy_attacks':
    case 'block_card_type':
      return blockXml('action_block_card_type', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: targetValue(params, 'TARGET', 'enemy'),
      });
    case 'force_enemy_attacks_only':
    case 'force_card_type':
      return blockXml('action_force_card_type', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: targetValue(params, 'TARGET', 'enemy'),
      });
    case 'set_untargetable':
    case 'untargetable':
      return blockXml('action_untargetable', { values: targetValue(params, 'TARGET', 'self') });
    case 'block_own_actions':
    case 'block_action':
      return blockXml('action_block_action', { values: targetValue(params, 'TARGET', 'self') });
    case 'fission':
      return blockXml('action_fission', { fields: { CARD_TYPE: params.card_type || 'thorn', TIMES: scalar(params.times, 2) } });
    case 'fusion':
      return blockXml('action_fusion', {
        fields: {
          MIN_COUNT: scalar(params.min_count ?? params.count, 2),
          MAX_COUNT: scalar(params.max_count ?? params.count, 3),
          CARD_TYPE: params.card_type || 'thorn',
        },
      });
    case 'copy_card':
      return blockXml('action_copy_card');
    case 'copy_choice_with_discount':
      return blockXml('action_copy_choice_with_discount', { fields: { DISCOUNT: scalar(params.discount_e, 1) } });
    case 'on_owner_turn_start':
      return blockXml('event_owner_turn_start', { statements: { DO: effectsToStatement(params) } });
    case 'on_enemy_turn_start':
      return blockXml('event_enemy_turn_start', { statements: { DO: effectsToStatement(params) } });
    case 'on_damage_taken':
      return blockXml('event_damage_taken', { statements: { DO: effectsToStatement(params) } });
    case 'on_equipment_trigger':
      return blockXml('event_equipment_trigger', {
        fields: { DESTROY: params.destroy_self ? 'TRUE' : 'FALSE' },
        statements: { DO: effectsToStatement(params) },
      });
    case 'aura_enemy_elixir_recovery':
      return blockXml('aura_enemy_elixir_recovery', { fields: { AMOUNT: scalar(params.amount, -1) } });
    case 'on_fatal_set_health_exile':
      return blockXml('passive_fatal_set_health_exile', { fields: { HEALTH: scalar(params.health, 5) } });
    case 'counter_dodge':
      return blockXml('counter_dodge', { fields: { AMOUNT: scalar(params.amount, 1) } });
    case 'counter_nazar':
      return blockXml('counter_nazar');
    case 'counter_equip_protect':
      return blockXml('counter_equip_protect', { fields: { AMOUNT: scalar(params.amount, 1) } });
    case 'counter_negate_skill':
      return blockXml('counter_negate_skill');
    case 'counter_block_enemy_attacks':
      return blockXml('counter_block_enemy_attacks', { fields: { DURATION: scalar(params.duration, 1) } });
    case 'counter_set_invincible_then_die':
      return blockXml('counter_set_invincible_then_die');
    default:
      return blockXml('raw_effect_json', { fields: { JSON: JSON.stringify(effect) } });
  }
}

export function effectsToXml(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return '';
  const body = chain(effects.map(effectToBlock));
  const positionedBody = body.replace('<block ', '<block x="36" y="36" ');
  return positionedBody ? `<xml xmlns="${XML_NS}">${positionedBody}</xml>` : '';
}

export function scriptFromEffects(effects = []) {
  const normalized = Array.isArray(effects) ? effects : [];
  return { xml: effectsToXml(normalized), effects: normalized };
}

export function ensureScriptXml(script, fallbackEffects = []) {
  const scriptEffects = Array.isArray(script?.effects) ? script.effects : [];
  const fallback = Array.isArray(fallbackEffects) ? fallbackEffects : [];
  const effects = scriptEffects.length ? scriptEffects : fallback;
  const xml = script?.xml && script.xml.includes('<block') ? script.xml : effectsToXml(effects);
  return { ...(script || {}), xml, effects };
}
