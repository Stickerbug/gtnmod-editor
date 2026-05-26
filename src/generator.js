import * as Blockly from 'blockly';
import {javascriptGenerator} from 'blockly/javascript';

const O = javascriptGenerator.ORDER_ATOMIC;

function v(block, name, fallback = '0') {
  const connected = block.getInput(name) ? javascriptGenerator.valueToCode(block, name, O) : '';
  if (connected) return connected;
  const raw = block.getFieldValue(name);
  if (raw !== null && raw !== undefined && raw !== '') {
    const text = String(raw);
    return /^-?\d+(\.\d+)?$/.test(text) ? text : JSON.stringify(text);
  }
  return fallback;
}

function field(block, name) {
  return block.getFieldValue(name) || '';
}

function numField(block, name) {
  return Number(block.getFieldValue(name) || 0);
}

function normalizeGeneratedValue(value) {
  if (Array.isArray(value)) return value.map(normalizeGeneratedValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normalizeGeneratedValue(val)]));
  }
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"') && text.endsWith('"'))) {
    try { return JSON.parse(text); } catch (_) {}
  }
  return value;
}

function makeEffect(type, params, log) {
  const obj = { type, params: normalizeGeneratedValue(params || {}) };
  if (log) obj.log = log;
  return JSON.stringify(obj);
}

function targetParam(block, name = 'TARGET', fallback = 'self') {
  const normalized = normalizeGeneratedValue(v(block, name, JSON.stringify(fallback)));
  return typeof normalized === 'string' ? normalized : fallback;
}

function refValue(block, name, fallbackRef) {
  return v(block, name, JSON.stringify({ ref: fallbackRef }));
}

function cardValue(block, name = 'CARD', fallbackRef = 'current_card') {
  return refValue(block, name, fallbackRef);
}

function equipmentValue(block, name = 'EQUIPMENT', fallbackRef = 'current_equipment') {
  return refValue(block, name, fallbackRef);
}

javascriptGenerator['trigger_on_play'] = function(b) { return ''; };
javascriptGenerator['trigger_event_apply'] = function(b) { return ''; };
javascriptGenerator['trigger_status_exists'] = function(b) { return ''; };
javascriptGenerator['trigger_tag_exists'] = function(b) { return ''; };
javascriptGenerator['trigger_on_friendly_turn_start'] = function(b) { return ''; };
javascriptGenerator['trigger_on_enemy_turn_start'] = function(b) { return ''; };
javascriptGenerator['trigger_on_phys_damage'] = function(b) { return ''; };
javascriptGenerator['trigger_on_any_damage'] = function(b) { return ''; };
javascriptGenerator['trigger_on_lethal_damage'] = function(b) { return ''; };
javascriptGenerator['trigger_on_draw_this'] = function(b) { return ''; };
javascriptGenerator['trigger_on_end_turn_hand'] = function(b) { return ''; };
javascriptGenerator['trigger_on_overflow_discard'] = function(b) { return ''; };
javascriptGenerator['trigger_on_destroy'] = function(b) { return ''; };
javascriptGenerator['trigger_hand_owner_turn_start'] = function(b) { return ''; };
javascriptGenerator['trigger_discard_owner_turn_start'] = function(b) { return ''; };
javascriptGenerator['trigger_deck_owner_turn_start'] = function(b) { return ''; };
javascriptGenerator['trigger_on_durability_zero'] = function(b) { return ''; };
javascriptGenerator['trigger_on_enemy_use_type'] = function(b) {
  return makeEffect('trigger_on_enemy_use_type', { card_type: field(b, 'CARD_TYPE') });
};
javascriptGenerator['trigger_on_friendly_use_type'] = function(b) {
  return makeEffect('trigger_on_friendly_use_type', { card_type: field(b, 'CARD_TYPE') });
};
javascriptGenerator['trigger_on_card_exile'] = function(b) { return ''; };
javascriptGenerator['trigger_on_deck_empty'] = function(b) { return ''; };
javascriptGenerator['trigger_on_self_magic_heal_cumulative'] = function(b) {
  return makeEffect('trigger_on_self_magic_heal_cumulative', { threshold: numField(b, 'THRESHOLD') });
};
javascriptGenerator['trigger_on_self_damage'] = function(b) { return ''; };

javascriptGenerator['trigger_manual'] = function(b) {
  return makeEffect('trigger_manual', {
    timing: field(b, 'TIMING'),
    cost_e: numField(b, 'COST_E'),
    cost_m: numField(b, 'COST_M'),
    condition: v(b, 'CONDITION', 'null'),
    destroy: field(b, 'DESTROY') === 'true',
  });
};

javascriptGenerator['response_declare'] = function(b) {
  return makeEffect('response_declare', {
    timing: field(b, 'TIMING'),
    cost_e: numField(b, 'COST_E'),
    cost_m: numField(b, 'COST_M'),
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
  });
};
javascriptGenerator['event_owner_turn_start'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('on_owner_turn_start', { effects: __collectEffects(body) });
};
javascriptGenerator['event_enemy_turn_start'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('on_enemy_turn_start', { effects: __collectEffects(body) });
};
javascriptGenerator['event_damage_taken'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('on_damage_taken', { effects: __collectEffects(body) });
};
javascriptGenerator['event_equipment_trigger'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('on_equipment_trigger', {
    destroy_self: field(b, 'DESTROY') === 'TRUE' || field(b, 'DESTROY') === 'true',
    effects: __collectEffects(body),
  });
};
javascriptGenerator['equipment_any_turn_start'] = function() { return ''; };
javascriptGenerator['equipment_owner_turn_start'] = function() { return ''; };
javascriptGenerator['equipment_owner_turn_ready'] = function() { return ''; };
javascriptGenerator['equipment_enemy_turn_start'] = function() { return ''; };
javascriptGenerator['equipment_damage_taken'] = function() { return ''; };
javascriptGenerator['equipment_manual_trigger'] = function() { return ''; };
javascriptGenerator['aura_enemy_elixir_recovery'] = function(b) {
  return makeEffect('aura_enemy_elixir_recovery', { target: 'enemy', amount: v(b, 'AMOUNT', '-1') });
};

javascriptGenerator['action_damage'] = function(b) {
  const params = { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') };
  if (field(b, 'IS_PRECISION') === 'TRUE') params.is_precision = true;
  return makeEffect('damage', params);
};
javascriptGenerator['action_damage_multi'] = function(b) {
  const params = { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0'), hits: v(b, 'TIMES', '1') };
  if (field(b, 'IS_PRECISION') === 'TRUE') params.is_precision = true;
  return makeEffect('damage', params);
};
javascriptGenerator['action_request_target'] = function(b) {
  return makeEffect('request_target', {
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
    candidates: v(b, 'TARGETS', '"enemy"'),
    cancellable: field(b, 'CANCELLABLE') === 'TRUE',
  });
};
javascriptGenerator['action_request_card'] = function(b) {
  const zone = field(b, 'ZONE') || 'hand';
  return makeEffect('request_card', {
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
    target: v(b, 'TARGET', '"self"'),
    zone,
    choice_type: zone === 'deck' ? 'choose_from_deck'
      : zone === 'discard' ? 'choose_from_discard'
      : zone === 'exile' ? 'choose_from_exile'
      : zone === 'equipment' ? 'choose_equipment'
      : 'choose_card_from_hand',
    cancellable: field(b, 'CANCELLABLE') === 'TRUE',
  });
};
javascriptGenerator['action_request_cards'] = function(b) {
  return makeEffect('request_card', {
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
    target: v(b, 'TARGET', '"self"'),
    zone: 'hand',
    choice_type: 'choose_cards_from_hand',
    multi: true,
    min_count: v(b, 'MIN_COUNT', '1'),
    max_count: v(b, 'MAX_COUNT', '1'),
    card_type: field(b, 'CARD_TYPE') || 'any',
    same_name: field(b, 'SAME_NAME') === 'TRUE',
    cancellable: field(b, 'CANCELLABLE') === 'TRUE',
  });
};
javascriptGenerator['action_request_optional_card'] = function(b) {
  const zone = field(b, 'ZONE') || 'hand';
  return makeEffect('request_card', {
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
    target: v(b, 'TARGET', '"self"'),
    zone,
    choice_type: zone === 'deck' ? 'choose_from_deck'
      : zone === 'discard' ? 'choose_from_discard'
      : zone === 'exile' ? 'choose_from_exile'
      : zone === 'equipment' ? 'choose_equipment'
      : 'choose_card_from_hand',
    cancellable: true,
    continue_on_cancel: true,
  });
};
javascriptGenerator['action_request_confirm'] = function(b) {
  return makeEffect('request_confirm', {
    title: field(b, 'TITLE'),
    content: field(b, 'CONTENT'),
    ok_text: field(b, 'OK_TEXT') || '确认',
    cancel_text: field(b, 'CANCEL_TEXT') || '取消',
    cancellable: field(b, 'CANCELLABLE') === 'TRUE',
  });
};
javascriptGenerator['action_direct_damage'] = function(b) {
  return makeEffect('direct_damage', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0'), source: field(b, 'SOURCE') });
};
javascriptGenerator['action_lifesteal_damage'] = function(b) {
  return makeEffect('lifesteal_damage', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0'), heal: v(b, 'HEAL', '0') });
};
javascriptGenerator['action_triangle_damage'] = function(b) {
  return makeEffect('triangle_damage', {
    target: v(b, 'TARGET', '"self"'),
    base: v(b, 'BASE', '6'),
    per_stack: v(b, 'PER_STACK', '3'),
    max_stacks: v(b, 'MAX_STACKS', '4'),
  });
};
javascriptGenerator['action_heal'] = function(b) {
  return makeEffect('heal', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_set_health'] = function(b) {
  return makeEffect('set_health', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_modify_damage'] = function(b) {
  return makeEffect('modify_damage', { formula: field(b, 'FORMULA') });
};

javascriptGenerator['action_poison'] = function(b) {
  return makeEffect('poison', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_burn'] = function(b) {
  return makeEffect('burn', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_vulnus'] = function(b) {
  return makeEffect('vulnus', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_toxic'] = function(b) {
  return makeEffect('toxic', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_add_armor'] = function(b) {
  return makeEffect('add_armor', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_remove_armor'] = function(b) {
  return makeEffect('remove_armor', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_set_armor'] = function(b) {
  return makeEffect('set_armor', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_dodge_this'] = function(b) {
  return makeEffect('dodge_this', {});
};
javascriptGenerator['action_dodge_permanent'] = function(b) {
  return makeEffect('dodge_permanent', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_clear_buffs'] = function(b) {
  return makeEffect('clear_buffs', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_clear_debuffs'] = function(b) {
  return makeEffect('clear_debuffs', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_clear_all_effects'] = function(b) {
  return makeEffect('clear_all_effects', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_clear_status'] = function(b) {
  return makeEffect('clear_status', { target: v(b, 'TARGET', '"self"'), status: field(b, 'STATUS') });
};

javascriptGenerator['action_gain_e'] = function(b) {
  return makeEffect('gain_e', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_gain_m'] = function(b) {
  return makeEffect('gain_m', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_cost_e'] = function(b) {
  return makeEffect('cost_e', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_cost_m'] = function(b) {
  return makeEffect('cost_m', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_mod_e_regen'] = function(b) {
  return makeEffect('mod_e_regen', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_mod_m_regen'] = function(b) {
  return makeEffect('mod_m_regen', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_mod_draw'] = function(b) {
  return makeEffect('mod_draw', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '0') });
};

javascriptGenerator['action_draw'] = function(b) {
  return makeEffect('draw', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_discard'] = function(b) {
  return makeEffect('discard', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_discard_choice_then_draw'] = function() {
  return makeEffect('discard_choice_then_draw', {});
};
javascriptGenerator['action_coffee_gain_e'] = function(b) {
  return makeEffect('coffee_gain_e', { amount: v(b, 'AMOUNT', '1'), first_bonus: v(b, 'FIRST_BONUS', '1') });
};
javascriptGenerator['action_choose_from_deck'] = function(b) {
  return makeEffect('choose_from_deck', {});
};
javascriptGenerator['action_choose_from_discard'] = function(b) {
  return makeEffect('choose_from_discard', {});
};
javascriptGenerator['action_choose_from_exile'] = function(b) {
  return makeEffect('choose_from_exile', {});
};
javascriptGenerator['action_reveal_hand'] = function(b) {
  return makeEffect('reveal_hand', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_reveal_deck_top'] = function(b) {
  return makeEffect('reveal_deck_top', { target: v(b, 'TARGET', '"enemy"'), amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_steal_card'] = function(b) {
  return makeEffect('steal_card', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_copy_card'] = function(b) {
  return makeEffect('copy_card', { card: cardValue(b, 'CARD', 'current_card') });
};
javascriptGenerator['action_copy_choice_with_discount'] = function(b) {
  return makeEffect('copy_choice_with_discount', { card: cardValue(b, 'CARD', 'selected_card'), discount_e: v(b, 'DISCOUNT', '1') });
};
javascriptGenerator['action_card_fission_add'] = function(b) {
  return makeEffect('card_prop_add', { card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), property: 'fission_level', amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_card_fission_set'] = function(b) {
  return makeEffect('card_prop_set', { card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), property: 'fission_level', value: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_card_fusion_add'] = function(b) {
  return makeEffect('card_prop_add', { card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), property: 'fusion_level', amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_card_fusion_set'] = function(b) {
  return makeEffect('card_prop_set', { card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), property: 'fusion_level', value: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_card_discount_set'] = function(b) {
  return makeEffect('card_prop_set', { card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), property: 'mimic_discount', value: v(b, 'AMOUNT', '0') });
};
javascriptGenerator['action_card_prop_set'] = function(b) {
  return makeEffect('card_prop_set', {
    card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')),
    property: field(b, 'PROPERTY') || 'bonus_damage',
    value: v(b, 'VALUE', '0'),
  });
};
javascriptGenerator['action_card_prop_add'] = function(b) {
  return makeEffect('card_prop_add', {
    card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')),
    property: field(b, 'PROPERTY') || 'bonus_damage',
    amount: v(b, 'AMOUNT', '1'),
  });
};
javascriptGenerator['action_random_discard_from_hand'] = function(b) {
  return makeEffect('random_discard_from_hand', { target: v(b, 'TARGET', '"enemy"'), amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_put_card_to_deck'] = function(b) {
  return makeEffect('put_card_to_deck', { position: field(b, 'POSITION') });
};
javascriptGenerator['action_shuffle_discard_into_deck'] = function(b) {
  return makeEffect('shuffle_discard_into_deck', {});
};
javascriptGenerator['action_give_card_to_hand'] = function(b) {
  return makeEffect('give_card_to_hand', { card: v(b, 'CARD', '"Basic"'), target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_give_card_to_deck'] = function(b) {
  return makeEffect('give_card_to_deck', { card: v(b, 'CARD', '""'), target: v(b, 'TARGET', '"self"'), position: field(b, 'POSITION') });
};
javascriptGenerator['action_give_card_to_discard'] = function(b) {
  return makeEffect('give_card_to_discard', { card: v(b, 'CARD', '""'), target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_remove_specific_card'] = function(b) {
  return makeEffect('remove_specific_card', { target: v(b, 'TARGET', '"self"'), zone: field(b, 'ZONE'), card: v(b, 'CARD', '"Basic"') });
};

javascriptGenerator['action_destroy_random_equip'] = function(b) {
  return makeEffect('destroy_random_equip', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_destroy_all_equip'] = function(b) {
  return makeEffect('destroy_all_equip', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_destroy_all_field_equip'] = function(b) {
  return makeEffect('destroy_all_field_equip', {});
};
javascriptGenerator['action_destroy_equipment_choice_or_first'] = function(b) {
  return makeEffect('destroy_equipment_choice_or_first', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_destroy_all_destroyable_equipment'] = function(b) {
  return makeEffect('destroy_all_destroyable_equipment', { target: v(b, 'TARGET', '"both"') });
};
javascriptGenerator['action_equip_protection'] = function(b) {
  return makeEffect('equip_protection', { equipment: equipmentValue(b, 'EQUIPMENT', 'current_equipment') });
};
javascriptGenerator['action_remove_equip_protection'] = function(b) {
  return makeEffect('remove_equip_protection', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_place_as_equip'] = function(b) {
  return makeEffect('place_as_equip', { card: cardValue(b, 'CARD', 'current_card') });
};
javascriptGenerator['action_equip_this_card'] = function(b) {
  return makeEffect('place_as_equip', { card: cardValue(b, 'CARD', 'current_card') });
};
javascriptGenerator['action_equip_disc_armor'] = function(b) {
  return makeEffect('equip_disc_armor', { amount: v(b, 'AMOUNT', '2') });
};
javascriptGenerator['action_equip_sponge'] = function() {
  return makeEffect('equip_sponge', {});
};
javascriptGenerator['action_equip_set_health'] = function(b) {
  return makeEffect('equip_set_health', { amount: v(b, 'AMOUNT', '60') });
};
javascriptGenerator['action_equip_reduce_own_draw'] = function(b) {
  return makeEffect('equip_reduce_own_draw', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_equip_reduce_own_e'] = function(b) {
  return makeEffect('equip_reduce_own_e', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_equip_on_destroy_remove_poison_damage'] = function(b) {
  return makeEffect('equip_on_destroy_remove_poison_damage', { multiplier: v(b, 'MULTIPLIER', '2') });
};
javascriptGenerator['action_activate_corruption'] = function(b) {
  return makeEffect('activate_corruption', { equipment: equipmentValue(b, 'EQUIPMENT', 'current_equipment') });
};
javascriptGenerator['action_equipment_prop_set'] = function(b) {
  return makeEffect('equipment_prop_set', {
    equipment: equipmentValue(b, 'EQUIPMENT', 'current_equipment'),
    property: field(b, 'PROPERTY') || 'turns_equipped',
    value: v(b, 'VALUE', '0'),
  });
};
javascriptGenerator['action_equipment_prop_add'] = function(b) {
  return makeEffect('equipment_prop_add', {
    equipment: equipmentValue(b, 'EQUIPMENT', 'current_equipment'),
    property: field(b, 'PROPERTY') || 'turns_equipped',
    amount: v(b, 'AMOUNT', '1'),
  });
};
javascriptGenerator['action_player_prop_set'] = function(b) {
  return makeEffect('player_prop_set', {
    target: v(b, 'TARGET', '"self"'),
    property: field(b, 'PROPERTY') || 'health',
    value: v(b, 'VALUE', '0'),
  });
};
javascriptGenerator['action_player_prop_add'] = function(b) {
  return makeEffect('player_prop_add', {
    target: v(b, 'TARGET', '"self"'),
    property: field(b, 'PROPERTY') || 'health',
    amount: v(b, 'AMOUNT', '1'),
  });
};
javascriptGenerator['action_magic_battery_gain_m'] = function(b) {
  return makeEffect('magic_battery_gain_m', { target: v(b, 'TARGET', '"self"'), amount: v(b, 'AMOUNT', '1'), limit: v(b, 'LIMIT', '3') });
};
javascriptGenerator['action_destroy_self_equipment'] = function(b) {
  return makeEffect('destroy_self_equipment', { equipment: equipmentValue(b, 'EQUIPMENT', 'current_equipment') });
};

javascriptGenerator['action_block_action'] = function(b) {
  return makeEffect('block_action', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_block_card_type'] = function(b) {
  return makeEffect('block_card_type', { target: v(b, 'TARGET', '"enemy"'), card_type: field(b, 'CARD_TYPE'), duration: v(b, 'DURATION', '1') });
};
javascriptGenerator['action_force_card_type'] = function(b) {
  return makeEffect('force_card_type', { target: v(b, 'TARGET', '"enemy"'), card_type: field(b, 'CARD_TYPE'), duration: v(b, 'DURATION', '1') });
};
javascriptGenerator['action_nullify_current_card'] = function(b) {
  return makeEffect('nullify_current_card', { target: v(b, 'TARGET', '"enemy"'), card_type: field(b, 'CARD_TYPE') });
};
javascriptGenerator['action_invincible'] = function(b) {
  return makeEffect('invincible', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_untargetable'] = function(b) {
  return makeEffect('untargetable', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_skip_turn'] = function(b) {
  return makeEffect('skip_turn', { target: v(b, 'TARGET', '"enemy"') });
};
javascriptGenerator['action_extra_turn'] = function(b) {
  return makeEffect('extra_turn', { target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_force_end_turn'] = function(b) {
  return makeEffect('force_end_turn', {});
};
javascriptGenerator['action_mark_self_damage_source'] = function(b) {
  return makeEffect('mark_self_damage_source', { target: v(b, 'TARGET', '"self"') });
};

javascriptGenerator['action_fission'] = function(b) {
  return makeEffect('fission', { card_type: field(b, 'CARD_TYPE'), times: v(b, 'TIMES', '1') });
};
javascriptGenerator['action_multiply_next_damage'] = function(b) {
  return makeEffect('multiply_next_damage', { multiplier: v(b, 'MULTIPLIER', '2') });
};
javascriptGenerator['action_reduce_next_cost'] = function(b) {
  return makeEffect('reduce_next_cost', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_increase_next_cost'] = function(b) {
  return makeEffect('increase_next_cost', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_fusion'] = function(b) {
  const minCount = v(b, 'MIN_COUNT', v(b, 'COUNT', '2'));
  const maxCount = v(b, 'MAX_COUNT', v(b, 'COUNT', '3'));
  return makeEffect('fusion', { min_count: minCount, max_count: maxCount, card_type: field(b, 'CARD_TYPE') });
};
javascriptGenerator['action_add_tag'] = function(b) {
  return makeEffect('add_tag', { card: cardValue(b, 'CARD', 'current_card'), tag: field(b, 'TAG') });
};
javascriptGenerator['action_remove_tag'] = function(b) {
  return makeEffect('remove_tag', { card: cardValue(b, 'CARD', 'current_card'), tag: field(b, 'TAG') });
};
javascriptGenerator['action_transform_card'] = function(b) {
  return makeEffect('transform_card', { card: cardValue(b, 'CARD', 'current_card') });
};

javascriptGenerator['action_gain_durability'] = function(b) {
  return makeEffect('gain_durability', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_lose_durability'] = function(b) {
  return makeEffect('lose_durability', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_set_durability'] = function(b) {
  return makeEffect('set_durability', { amount: v(b, 'AMOUNT', '3') });
};
javascriptGenerator['action_record_play_count'] = function(b) {
  return makeEffect('record_play_count', {});
};
javascriptGenerator['action_record_equip_turns'] = function(b) {
  return makeEffect('record_equip_turns', {});
};
javascriptGenerator['action_reset_counter'] = function(b) {
  return makeEffect('reset_counter', {});
};
javascriptGenerator['action_create_counter'] = function(b) {
  return makeEffect('create_counter', { amount: v(b, 'AMOUNT', '1'), name: field(b, 'NAME') });
};

javascriptGenerator['action_exile_this'] = function(b) {
  return makeEffect('exile_this', { card: cardValue(b, 'CARD', 'current_card') });
};
javascriptGenerator['action_move_to_discard'] = function(b) {
  return makeEffect('move_to_discard', { card: cardValue(b, 'CARD', 'current_card') });
};
javascriptGenerator['action_move_to_hand'] = function(b) {
  return makeEffect('move_to_hand', { card: cardValue(b, 'CARD', 'selected_card'), target: v(b, 'TARGET', '"self"') });
};
javascriptGenerator['action_move_to_deck'] = function(b) {
  return makeEffect('move_to_deck', { card: cardValue(b, 'CARD', 'current_card'), position: field(b, 'POSITION') });
};

javascriptGenerator['passive_fatal_set_health_exile'] = function(b) {
  return makeEffect('on_fatal_set_health_exile', { health: v(b, 'HEALTH', '5') });
};
javascriptGenerator['counter_dodge'] = function(b) {
  return makeEffect('counter_dodge', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['counter_nazar'] = function() {
  return makeEffect('counter_nazar', {});
};
javascriptGenerator['counter_equip_protect'] = function(b) {
  return makeEffect('counter_equip_protect', { amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['counter_negate_skill'] = function() {
  return makeEffect('counter_negate_skill', {});
};
javascriptGenerator['counter_block_enemy_attacks'] = function(b) {
  return makeEffect('counter_block_enemy_attacks', { duration: v(b, 'DURATION', '1') });
};
javascriptGenerator['counter_set_invincible_then_die'] = function() {
  return makeEffect('counter_set_invincible_then_die', {});
};
javascriptGenerator['raw_effect_json'] = function(b) {
  return field(b, 'JSON') || '{}';
};
javascriptGenerator['action_global_damage_mult'] = function(b) {
  return makeEffect('global_damage_mult', { multiplier: v(b, 'MULTIPLIER', '1') });
};
javascriptGenerator['action_global_heal_mult'] = function(b) {
  return makeEffect('global_heal_mult', { multiplier: v(b, 'MULTIPLIER', '1') });
};
javascriptGenerator['action_global_cost_mult'] = function(b) {
  return makeEffect('global_cost_mult', { multiplier: v(b, 'MULTIPLIER', '1') });
};
javascriptGenerator['action_swap_health'] = function(b) {
  return makeEffect('swap_health', { target1: v(b, 'TARGET1', '"self"'), target2: v(b, 'TARGET2', '"enemy"') });
};
javascriptGenerator['action_swap_hands'] = function(b) {
  return makeEffect('swap_hands', { target1: v(b, 'TARGET1', '"self"'), target2: v(b, 'TARGET2', '"enemy"') });
};

javascriptGenerator['action_broadcast_event'] = function(b) {
  return makeEffect('broadcast_event', { event_name: field(b, 'EVENT_NAME') });
};
javascriptGenerator['trigger_on_event'] = function(b) {
  return makeEffect('trigger_on_event', { event_name: field(b, 'EVENT_NAME') });
};

javascriptGenerator['control_if'] = function(b) {
  const cond = v(b, 'CONDITION', 'true');
  const branch = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('if', { condition: cond, then: __collectEffects(branch) });
};
javascriptGenerator['control_if_else'] = function(b) {
  const cond = v(b, 'CONDITION', 'true');
  const thenCode = javascriptGenerator.statementToCode(b, 'DO');
  const elseCode = javascriptGenerator.statementToCode(b, 'ELSE');
  return makeEffect('if_else', { condition: cond, then: __collectEffects(thenCode), else: __collectEffects(elseCode) });
};
javascriptGenerator['control_repeat'] = function(b) {
  const times = v(b, 'TIMES', '1');
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('repeat', { times, body: __collectEffects(body) });
};
javascriptGenerator['control_repeat_until'] = function(b) {
  const cond = v(b, 'CONDITION', 'true');
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('repeat_until', { condition: cond, body: __collectEffects(body) });
};
javascriptGenerator['control_for_each'] = function(b) {
  const targets = v(b, 'TARGET_LIST', '"both"');
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('for_each', { targets, body: __collectEffects(body) });
};
javascriptGenerator['control_for_each_selected_card'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('for_each_selected_card', { body: __collectEffects(body) });
};
javascriptGenerator['control_after_all'] = function(b) {
  const body = javascriptGenerator.statementToCode(b, 'DO');
  return makeEffect('after_all', { body: __collectEffects(body) });
};
javascriptGenerator['control_random'] = function(b) {
  const a = javascriptGenerator.statementToCode(b, 'BRANCH_A');
  const bCode = javascriptGenerator.statementToCode(b, 'BRANCH_B');
  return makeEffect('random', { a: __collectEffects(a), b: __collectEffects(bCode) });
};

function __collectEffects(code) {
  if (!code || !code.trim()) return [];
  const lines = code.trim().split('\n').filter(l => l.trim());
  const effects = [];
  for (const line of lines) {
    try { effects.push(JSON.parse(line.trim().replace(/,$/, ''))); } catch(e) {}
  }
  return effects;
}

javascriptGenerator['condition_compare'] = function(b) {
  return [JSON.stringify({ op: 'compare', a: v(b, 'A', '0'), operator: field(b, 'OP'), b: v(b, 'B', '0') }), O];
};
javascriptGenerator['condition_equip_turns'] = function(b) {
  return [JSON.stringify({ op: 'equip_turns', operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['condition_durability'] = function(b) {
  return [JSON.stringify({ op: 'durability', operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['condition_damage_value'] = function(b) {
  return [JSON.stringify({ op: 'damage_value', operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['condition_target_attribute'] = function(b) {
  return [JSON.stringify({ op: 'target_attribute', target: v(b, 'TARGET', '"self"'), attr: field(b, 'ATTR'), operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['condition_has_tag'] = function(b) {
  return [JSON.stringify({ op: 'has_tag', card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')), tag: field(b, 'TAG') }), O];
};
javascriptGenerator['condition_has_status'] = function(b) {
  return [JSON.stringify({ op: 'has_status', target: v(b, 'TARGET', '"self"'), status: field(b, 'STATUS') }), O];
};
javascriptGenerator['condition_hand_has_type'] = function(b) {
  return [JSON.stringify({ op: 'hand_has_type', target: v(b, 'TARGET', '"self"'), card_type: field(b, 'CARD_TYPE') }), O];
};
javascriptGenerator['condition_has_equip'] = function(b) {
  return [JSON.stringify({ op: 'has_equip', target: v(b, 'TARGET', '"self"') }), O];
};
javascriptGenerator['condition_event_card_type'] = function(b) {
  return [JSON.stringify({ op: 'event_card_type', card_type: field(b, 'CARD_TYPE') }), O];
};
javascriptGenerator['condition_turn_number'] = function(b) {
  return [JSON.stringify({ op: 'turn_number', operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['condition_and_or'] = function(b) {
  return [JSON.stringify({ op: field(b, 'OP'), a: v(b, 'A', 'true'), b: v(b, 'B', 'true') }), O];
};
javascriptGenerator['condition_not'] = function(b) {
  return [JSON.stringify({ op: 'not', value: v(b, 'BOOL', 'true') }), O];
};
javascriptGenerator['condition_hand_full'] = function(b) {
  return [JSON.stringify({ op: 'hand_full', target: v(b, 'TARGET', '"self"') }), O];
};
javascriptGenerator['condition_zone_contains'] = function(b) {
  return [JSON.stringify({ op: 'zone_contains', target: v(b, 'TARGET', '"self"'), zone: field(b, 'ZONE'), card: v(b, 'CARD', '""') }), O];
};

javascriptGenerator['value_number'] = function(b) {
  return [String(numField(b, 'NUM')), O];
};
javascriptGenerator['math_number'] = function(b) {
  return [String(numField(b, 'NUM')), O];
};
javascriptGenerator['value_target_attribute'] = function(b) {
  const target = normalizeGeneratedValue(v(b, 'TARGET', '"self"'));
  const attr = field(b, 'ATTR');
  const refByAttr = {
    hand_size: 'hand_size',
    deck_remaining: 'deck_remaining',
    discard_size: 'discard_size',
    exile_size: 'exile_size',
    equip_count: 'equip_count',
  };
  if (refByAttr[attr]) return [JSON.stringify({ ref: refByAttr[attr], target }), O];
  return [JSON.stringify({ ref: 'target_attribute', target, attr }), O];
};
javascriptGenerator['value_play_count'] = function(b) {
  return [JSON.stringify({ ref: 'play_count' }), O];
};
javascriptGenerator['value_equip_turns'] = function(b) {
  return [JSON.stringify({ ref: 'equip_turns' }), O];
};
javascriptGenerator['value_durability'] = function(b) {
  return [JSON.stringify({ ref: 'durability' }), O];
};
javascriptGenerator['value_incoming_damage'] = function(b) {
  return [JSON.stringify({ ref: 'incoming_damage' }), O];
};
javascriptGenerator['value_last_damage'] = function(b) {
  return [JSON.stringify({ ref: 'last_damage', target: normalizeGeneratedValue(v(b, 'TARGET', '"self"')) }), O];
};
javascriptGenerator['value_status_count'] = function(b) {
  return [JSON.stringify({ ref: 'status_count', target: normalizeGeneratedValue(v(b, 'TARGET', '"self"')), status: field(b, 'STATUS') }), O];
};
javascriptGenerator['value_equipment_count_named'] = function(b) {
  const card = normalizeGeneratedValue(v(b, 'CARD', '"Disc"'));
  const payload = { ref: 'equipment_count_named', target: normalizeGeneratedValue(v(b, 'TARGET', '"self"')) };
  if (typeof card === 'string') payload.card_id = card;
  else payload.card = card;
  return [JSON.stringify(payload), O];
};
javascriptGenerator['value_hand_size'] = function(b) {
  return [JSON.stringify({ ref: 'hand_size', target: targetParam(b, 'TARGET', 'self') }), O];
};
javascriptGenerator['value_discard_size'] = function(b) {
  return [JSON.stringify({ ref: 'discard_size', target: targetParam(b, 'TARGET', 'self') }), O];
};
javascriptGenerator['value_equip_count'] = function(b) {
  return [JSON.stringify({ ref: 'equip_count', target: targetParam(b, 'TARGET', 'self') }), O];
};
javascriptGenerator['value_exile_size'] = function(b) {
  return [JSON.stringify({ ref: 'exile_size', target: targetParam(b, 'TARGET', 'self') }), O];
};
javascriptGenerator['value_deck_remaining'] = function(b) {
  return [JSON.stringify({ ref: 'deck_remaining', target: targetParam(b, 'TARGET', 'self') }), O];
};
javascriptGenerator['value_turn_number'] = function(b) {
  return [JSON.stringify({ ref: 'turn_number' }), O];
};
javascriptGenerator['value_random'] = function(b) {
  return [JSON.stringify({ ref: 'random', min: v(b, 'MIN', '1'), max: v(b, 'MAX', '10') }), O];
};
javascriptGenerator['value_math_op'] = function(b) {
  return [JSON.stringify({ ref: 'math_op', a: v(b, 'A', '0'), op: field(b, 'OP'), b: v(b, 'B', '0') }), O];
};
javascriptGenerator['value_round'] = function(b) {
  return [JSON.stringify({ ref: 'round', mode: field(b, 'MODE'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['value_min_max'] = function(b) {
  return [JSON.stringify({ ref: 'min_max', a: v(b, 'A', '0'), b: v(b, 'B', '0'), mode: field(b, 'MODE') }), O];
};
javascriptGenerator['value_clamp'] = function(b) {
  return [JSON.stringify({ ref: 'clamp', value: v(b, 'VALUE', '0'), min: v(b, 'MIN', '0'), max: v(b, 'MAX', '99') }), O];
};
javascriptGenerator['value_var'] = function(b) {
  return [JSON.stringify({ ref: 'var', target: normalizeGeneratedValue(v(b, 'TARGET', '"self"')), name: field(b, 'NAME') }), O];
};
javascriptGenerator['value_damage_source'] = function() {
  return [JSON.stringify({ ref: 'damage_source' }), O];
};
javascriptGenerator['value_choice_target'] = function() {
  return [JSON.stringify({ ref: 'choice_target' }), O];
};
javascriptGenerator['value_choice_confirmed'] = function() {
  return [JSON.stringify({ ref: 'choice_confirmed' }), O];
};
javascriptGenerator['value_selected_card_index'] = function() {
  return [JSON.stringify({ ref: 'selected_card_index' }), O];
};
javascriptGenerator['value_selected_cards_count'] = function() {
  return [JSON.stringify({ ref: 'selected_cards_count' }), O];
};
javascriptGenerator['value_card_property'] = function(b) {
  return [JSON.stringify({
    ref: 'card_property',
    card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')),
    property: field(b, 'PROPERTY') || 'fusion_level',
  }), O];
};
javascriptGenerator['value_equipment_property'] = function(b) {
  return [JSON.stringify({
    ref: 'equipment_property',
    equipment: normalizeGeneratedValue(equipmentValue(b, 'EQUIPMENT', 'current_equipment')),
    property: field(b, 'PROPERTY') || 'turns_equipped',
  }), O];
};
javascriptGenerator['value_player_property'] = function(b) {
  return [JSON.stringify({
    ref: 'player_property',
    target: normalizeGeneratedValue(v(b, 'TARGET', '"self"')),
    property: field(b, 'PROPERTY') || 'health',
  }), O];
};
javascriptGenerator['action_var_set'] = function(b) {
  return makeEffect('var_set', { target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '0') });
};
javascriptGenerator['action_var_add'] = function(b) {
  return makeEffect('var_add', { target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '0') });
};
javascriptGenerator['action_var_sub'] = function(b) {
  return makeEffect('var_sub', { target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '0') });
};
javascriptGenerator['action_var_mul'] = function(b) {
  return makeEffect('var_mul', { target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '1') });
};
javascriptGenerator['action_var_div'] = function(b) {
  return makeEffect('var_div', { target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '1') });
};
javascriptGenerator['condition_var_compare'] = function(b) {
  return [JSON.stringify({ op: 'var_compare', target: v(b, 'TARGET', '"self"'), name: field(b, 'NAME'), operator: field(b, 'OP'), value: v(b, 'VALUE', '0') }), O];
};
javascriptGenerator['action_status_add_named'] = function(b) {
  return makeEffect('status_add_named', { target: v(b, 'TARGET', '"self"'), status: field(b, 'STATUS'), amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_status_remove_named'] = function(b) {
  return makeEffect('status_remove_named', { target: v(b, 'TARGET', '"self"'), status: field(b, 'STATUS') });
};
javascriptGenerator['action_tag_add_named'] = function(b) {
  return makeEffect('tag_add_named', { card: cardValue(b, 'CARD', 'current_card'), tag: field(b, 'TAG') });
};
javascriptGenerator['action_tag_remove_named'] = function(b) {
  return makeEffect('tag_remove_named', { card: cardValue(b, 'CARD', 'current_card'), tag: field(b, 'TAG') });
};
javascriptGenerator['condition_has_status_named'] = function(b) {
  return [JSON.stringify({ op: 'has_status_named', target: v(b, 'TARGET', '"self"'), status: field(b, 'STATUS') }), O];
};
javascriptGenerator['action_batch_var_add'] = function(b) {
  return makeEffect('batch_var_add', { targets: v(b, 'TARGETS', '"friendly"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '0') });
};
javascriptGenerator['action_batch_var_sub'] = function(b) {
  return makeEffect('batch_var_sub', { targets: v(b, 'TARGETS', '"friendly"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '0') });
};
javascriptGenerator['action_batch_var_mul'] = function(b) {
  return makeEffect('batch_var_mul', { targets: v(b, 'TARGETS', '"friendly"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '1') });
};
javascriptGenerator['action_batch_var_div'] = function(b) {
  return makeEffect('batch_var_div', { targets: v(b, 'TARGETS', '"friendly"'), name: field(b, 'NAME'), value: v(b, 'VALUE', '1') });
};
javascriptGenerator['action_batch_status_add'] = function(b) {
  return makeEffect('batch_status_add', { targets: v(b, 'TARGETS', '"friendly"'), status: field(b, 'STATUS'), amount: v(b, 'AMOUNT', '1') });
};
javascriptGenerator['action_batch_status_remove'] = function(b) {
  return makeEffect('batch_status_remove', { targets: v(b, 'TARGETS', '"friendly"'), status: field(b, 'STATUS') });
};
javascriptGenerator['action_batch_tag_add'] = function(b) {
  return makeEffect('batch_tag_add', { targets: v(b, 'TARGETS', '"friendly"'), tag: field(b, 'TAG') });
};
javascriptGenerator['action_batch_tag_remove'] = function(b) {
  return makeEffect('batch_tag_remove', { targets: v(b, 'TARGETS', '"friendly"'), tag: field(b, 'TAG') });
};

// Procedure blocks fallback: keep calls in exported effect graph as explicit markers.
javascriptGenerator['procedures_defnoreturn'] = function() { return ''; };
javascriptGenerator['procedures_defreturn'] = function() { return ''; };
javascriptGenerator['procedures_callnoreturn'] = function(b) {
  return makeEffect('call_procedure', { name: field(b, 'NAME') || field(b, 'PROCNAME') || 'procedure' });
};
javascriptGenerator['procedures_callreturn'] = function(b) {
  return [JSON.stringify({ ref: 'call_procedure', name: field(b, 'NAME') || field(b, 'PROCNAME') || 'procedure' }), O];
};

javascriptGenerator['target_self'] = function(b) { return ['"self"', O]; };
javascriptGenerator['target_teammate'] = function(b) { return ['"teammate"', O]; };
javascriptGenerator['target_friendly'] = function(b) { return ['"friendly"', O]; };
javascriptGenerator['target_enemy'] = function(b) { return ['"enemy"', O]; };
javascriptGenerator['target_all_enemies'] = function(b) { return ['"all_enemies"', O]; };
javascriptGenerator['target_both'] = function(b) { return ['"both"', O]; };
javascriptGenerator['target_random_friendly'] = function(b) { return ['"random_friendly"', O]; };
javascriptGenerator['target_random_enemy'] = function(b) { return ['"random_enemy"', O]; };
javascriptGenerator['target_random_player'] = function(b) { return ['"random_player"', O]; };
javascriptGenerator['target_random_side'] = function(b) { return ['"random_side"', O]; };
javascriptGenerator['target_event_target'] = function(b) { return ['"event_target"', O]; };
javascriptGenerator['target_event_source'] = function(b) { return ['"event_source"', O]; };
javascriptGenerator['target_damage_source'] = function(b) { return ['"damage_source"', O]; };
javascriptGenerator['target_last_actor'] = function(b) { return ['"last_actor"', O]; };
javascriptGenerator['target_choice'] = function(b) { return ['"choice_target"', O]; };
javascriptGenerator['target_team_var_scope'] = function(b) { return ['"team"', O]; };
javascriptGenerator['target_global_var_scope'] = function(b) { return ['"global"', O]; };
javascriptGenerator['target_card_owner'] = function(b) {
  return [JSON.stringify({ ref: 'card_owner', card: normalizeGeneratedValue(cardValue(b, 'CARD', 'current_card')) }), O];
};
javascriptGenerator['target_highest_health'] = function(b) { return ['"highest_health"', O]; };
javascriptGenerator['target_lowest_health'] = function(b) { return ['"lowest_health"', O]; };

javascriptGenerator['card_current'] = function(b) { return [JSON.stringify({ ref: 'current_card' }), O]; };
javascriptGenerator['card_selected'] = function(b) { return [JSON.stringify({ ref: 'selected_card' }), O]; };
javascriptGenerator['card_last_created'] = function() { return [JSON.stringify({ ref: 'last_created_card' }), O]; };
javascriptGenerator['card_by_id'] = function(b) { return [JSON.stringify(field(b, 'CARD_ID') || 'Basic'), O]; };
function cardZoneRef(block, zone) {
  return [JSON.stringify({
    ref: 'zone_card',
    target: normalizeGeneratedValue(v(block, 'TARGET', '"self"')),
    zone,
    index: normalizeGeneratedValue(v(block, 'INDEX', '1')),
  }), O];
}
javascriptGenerator['card_in_hand_at'] = function(b) { return cardZoneRef(b, 'hand'); };
javascriptGenerator['card_in_deck_at'] = function(b) { return cardZoneRef(b, 'deck'); };
javascriptGenerator['card_in_discard_at'] = function(b) { return cardZoneRef(b, 'discard'); };
javascriptGenerator['card_in_exile_at'] = function(b) { return cardZoneRef(b, 'exile'); };
javascriptGenerator['card_selected_at'] = function(b) {
  return [JSON.stringify({ ref: 'selected_card_at', index: normalizeGeneratedValue(v(b, 'INDEX', '1')) }), O];
};
javascriptGenerator['equipment_current'] = function(b) { return [JSON.stringify({ ref: 'current_equipment' }), O]; };
javascriptGenerator['equipment_selected'] = function(b) { return [JSON.stringify({ ref: 'selected_equipment' }), O]; };

javascriptGenerator['card_selector_by_id'] = function(b) {
  return [JSON.stringify({ selector: 'by_id', id: field(b, 'CARD_ID') }), O];
};
javascriptGenerator['card_selector_by_type'] = function(b) {
  return [JSON.stringify({ selector: 'by_type', card_type: field(b, 'CARD_TYPE') }), O];
};
javascriptGenerator['card_selector_by_quality'] = function(b) {
  return [JSON.stringify({ selector: 'by_quality', quality: field(b, 'QUALITY') }), O];
};
javascriptGenerator['card_selector_by_tag'] = function(b) {
  return [JSON.stringify({ selector: 'by_tag', tag: field(b, 'TAG') }), O];
};
javascriptGenerator['card_selector_random'] = function(b) {
  return [JSON.stringify({ selector: 'random', count: v(b, 'COUNT', '1'), condition: v(b, 'CONDITION', 'true') }), O];
};
javascriptGenerator['card_selector_all'] = function(b) {
  return [JSON.stringify({ selector: 'all', condition: v(b, 'CONDITION', 'true') }), O];
};

function ensureGeneratorBindings() {
  if (!javascriptGenerator.forBlock) javascriptGenerator.forBlock = {};
  for (const [type, generator] of Object.entries(javascriptGenerator)) {
    if (typeof generator === 'function' && type.includes('_') && !javascriptGenerator.forBlock[type]) {
      javascriptGenerator.forBlock[type] = generator;
    }
  }
}

ensureGeneratorBindings();

export function generateEffectsFromWorkspace(workspace) {
  ensureGeneratorBindings();
  if (typeof javascriptGenerator.init === 'function') javascriptGenerator.init(workspace);
  const effects = [];
  const topBlocks = workspace.getTopBlocks(true);
  try {
    for (const topBlock of topBlocks) {
      effects.push(...collectChainEffects(topBlock));
    }
  } finally {
    if (typeof javascriptGenerator.finish === 'function') javascriptGenerator.finish('');
  }
  return effects;
}

const EQUIPMENT_EVENT_HEADS = {
  equipment_any_turn_start: 'on_any_turn_start',
  equipment_owner_turn_start: 'on_owner_turn_start',
  equipment_enemy_turn_start: 'on_enemy_turn_start',
  equipment_damage_taken: 'on_damage_taken',
  trigger_on_destroy: 'on_equipment_destroy',
  trigger_hand_owner_turn_start: 'on_hand_owner_turn_start',
  trigger_discard_owner_turn_start: 'on_discard_owner_turn_start',
  trigger_deck_owner_turn_start: 'on_deck_owner_turn_start',
};

const SKIP_HEADS = new Set([
  'trigger_on_play',
  'trigger_event_apply',
  'trigger_status_exists',
  'trigger_tag_exists',
  'trigger_on_friendly_turn_start',
  'trigger_on_enemy_turn_start',
  'trigger_on_phys_damage',
  'trigger_on_any_damage',
]);

function damageSourcePrelude(block) {
  if (!block || !['trigger_on_phys_damage', 'trigger_on_any_damage', 'equipment_damage_taken'].includes(block.type)) return [];
  const name = field(block, 'SOURCE_VAR');
  if (!name || name === '先添加变量') return [];
  const target = block.type === 'equipment_damage_taken'
    ? 'self'
    : normalizeGeneratedValue(v(block, 'TARGET', '"self"'));
  return [{
    type: 'var_set',
    params: {
      target,
      name,
      value: { ref: 'damage_source' },
    },
  }];
}

function collectChainEffects(startBlock) {
  const effects = [];
  let block = startBlock;
  while (block) {
    const type = block.type;
    if (SKIP_HEADS.has(type)) {
      effects.push(...damageSourcePrelude(block));
      block = block.getNextBlock();
      continue;
    }
    if (type === 'equipment_owner_turn_ready') {
      const nested = collectChainEffects(block.getNextBlock());
      effects.push({
        type: 'on_owner_turn_start',
        params: {
          effects: [{
            type: 'if',
            params: {
              condition: {
                op: 'compare',
                a: { ref: 'equip_turns' },
                operator: '>=',
                b: normalizeGeneratedValue(v(block, 'MIN_TURNS', '1')),
              },
              then: nested,
            },
          }],
        },
      });
      break;
    }
    if (type === 'equipment_manual_trigger') {
      effects.push({
        type: 'on_equipment_trigger',
        params: {
          destroy_self: field(block, 'DESTROY') === 'TRUE' || field(block, 'DESTROY') === 'true',
          effects: collectChainEffects(block.getNextBlock()),
        },
      });
      break;
    }
    if (EQUIPMENT_EVENT_HEADS[type]) {
      const nested = [
        ...damageSourcePrelude(block),
        ...collectChainEffects(block.getNextBlock()),
      ];
      effects.push({
        type: EQUIPMENT_EVENT_HEADS[type],
        params: { effects: nested },
      });
      break;
    }
    const code = javascriptGenerator.blockToCode(block, true);
    if (typeof code === 'string' && code.trim()) {
      try {
        const parsed = JSON.parse(code.trim().replace(/,$/, ''));
        effects.push(parsed);
      } catch(e) {}
    }
    block = block.getNextBlock();
  }
  return effects;
}
