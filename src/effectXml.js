const XML_NS = 'https://developers.google.com/blockly/xml';
const TRIANGLE_STACK_VAR = '三角形层数';
const COFFEE_FIRST_VAR = '咖啡首次使用';
const MAGIC_BATTERY_TURN_VAR = '魔法电池本回合回魔';

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
  damage_source: 'target_damage_source',
  last_actor: 'target_last_actor',
  choice_target: 'target_choice',
  team: 'target_team_var_scope',
  global: 'target_global_var_scope',
  highest_health: 'target_highest_health',
  lowest_health: 'target_lowest_health',
};

const CARD_REF_BLOCKS = {
  current_card: 'card_current',
  selected_card: 'card_selected',
  event_card: 'card_event_card',
  last_created_card: 'card_last_created',
  created_card: 'card_last_created',
  last_copied_card: 'card_last_created',
};

const EQUIPMENT_REF_BLOCKS = {
  current_equipment: 'equipment_current',
  selected_equipment: 'equipment_selected',
  event_equipment: 'equipment_event_equipment',
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
  const clean = blocks.flat().filter(Boolean);
  if (!clean.length) return '';
  return attachNext(clean[0], chain(clean.slice(1)));
}

function hasTriggerHead(xml, triggerType) {
  if (!xml || !xml.includes('<block')) return false;
  const triggerPattern = /<block\b[^>]*\btype="(?:trigger_|event_|response_|passive_|counter_|equipment_(?:any_turn_start|owner_turn_start|owner_turn_ready|enemy_turn_start|damage_taken|manual_trigger))[^"]*"/;
  return xml.includes(`type="${triggerType}"`) || triggerPattern.test(xml);
}

function wrapWithTrigger(blocks, triggerType) {
  if (!triggerType) return blocks;
  return attachNext(blockXml(triggerType), blocks);
}

function headWithNext(type, next, options = {}) {
  return attachNext(blockXml(type, options), next);
}

function wrapRawXmlWithTrigger(xml, triggerType) {
  if (!triggerType || !xml || hasTriggerHead(xml, triggerType)) return xml;
  const inner = xml
    .replace(/^\s*<xml\b[^>]*>/, '')
    .replace(/<\/xml>\s*$/, '')
    .trim();
  if (!inner) return effectsToXml([], { triggerType });
  const root = wrapWithTrigger(inner, triggerType).replace('<block ', '<block x="36" y="36" ');
  return `<xml xmlns="${XML_NS}">${root}</xml>`;
}

function targetBlock(target = 'self') {
  if (target && typeof target === 'object' && target.ref === 'card_owner') {
    return blockXml('target_card_owner', { values: { CARD: cardBlock(target.card || { ref: 'current_card' }) } });
  }
  return blockXml(TARGET_BLOCKS[target] || 'target_self');
}

function targetValue(params, name = 'TARGET', fallback = 'self') {
  return { [name]: targetBlock(params?.target || fallback) };
}

function cardBlock(value = { ref: 'current_card' }) {
  if (typeof value === 'string') return blockXml('card_by_id', { fields: { CARD_ID: value || 'Basic' } });
  const ref = value && typeof value === 'object' ? value.ref : '';
  if (CARD_REF_BLOCKS[ref]) return blockXml(CARD_REF_BLOCKS[ref]);
  if (ref === 'card_by_id') return blockXml('card_by_id', { fields: { CARD_ID: value.id || 'Basic' } });
  if (ref === 'var') {
    return blockXml('card_from_var', {
      fields: { NAME: value.name || '' },
      values: { TARGET: targetBlock(value.target || 'self') },
    });
  }
  if (ref === 'list_item') return expressionToBlock(value, 0);
  if (ref === 'selected_card_at') {
    return blockXml('card_selected_at', { values: { INDEX: expressionToBlock(value.index ?? 1, 1) } });
  }
  if (ref === 'zone_card') {
    const byZone = {
      hand: 'card_in_hand_at',
      deck: 'card_in_deck_at',
      discard: 'card_in_discard_at',
      exile: 'card_in_exile_at',
    };
    return blockXml(byZone[value.zone] || 'card_in_hand_at', {
      values: {
        TARGET: targetBlock(value.target || 'self'),
        INDEX: expressionToBlock(value.index ?? 1, 1),
      },
    });
  }
  return blockXml('card_current');
}

function equipmentBlock(value = { ref: 'current_equipment' }) {
  const ref = value && typeof value === 'object' ? value.ref : '';
  if (EQUIPMENT_REF_BLOCKS[ref]) return blockXml(EQUIPMENT_REF_BLOCKS[ref]);
  return blockXml('equipment_current');
}

function numberBlock(value, fallback = 0) {
  if (value && typeof value === 'object') return expressionToBlock(value, fallback);
  return blockXml('math_number', { fields: { NUM: scalar(value, fallback) } });
}

function expression(ref, extra = {}) {
  return { ref, ...extra };
}

function mathExpr(a, op, b) {
  return expression('math_op', { a, op, b });
}

function varExpr(name, target = 'self') {
  return expression('var', { name, target });
}

function expressionToBlock(expr, fallback = 0) {
  if (Array.isArray(expr)) {
    const canInline = expr.length <= 3 && expr.every(item => typeof item !== 'string' || /^-?\d+(\.\d+)?$/.test(item));
    if (!canInline) {
      return blockXml('value_list_literal', { fields: { JSON: JSON.stringify(expr) } });
    }
    return blockXml('value_list_create', {
      values: {
        A: expressionToBlock(expr[0] ?? 0, 0),
        B: expressionToBlock(expr[1] ?? 0, 0),
        C: expressionToBlock(expr[2] ?? 0, 0),
      },
    });
  }
  if (typeof expr === 'number' || typeof expr === 'string') return numberBlock(expr, fallback);
  if (!expr || typeof expr !== 'object') return numberBlock(fallback, fallback);
  const ref = expr.ref || '';
  if (ref === 'var') {
    return blockXml('value_var', {
      fields: { NAME: expr.name || '' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'list_var') {
    return blockXml('value_list_var', {
      fields: { NAME: expr.name || '' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'list') {
    const items = Array.isArray(expr.items) ? expr.items : [];
    const canInline = items.length <= 3 && items.every(item => typeof item !== 'string' || /^-?\d+(\.\d+)?$/.test(item));
    if (!canInline) return blockXml('value_list_literal', { fields: { JSON: JSON.stringify(items) } });
    return blockXml('value_list_create', {
      values: {
        A: expressionToBlock(items[0] ?? 0, 0),
        B: expressionToBlock(items[1] ?? 0, 0),
        C: expressionToBlock(items[2] ?? 0, 0),
      },
    });
  }
  if (ref === 'zone_list') {
    return blockXml('value_zone_list', {
      fields: { ZONE: expr.zone || 'hand' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'list_length') {
    return blockXml('value_list_length', {
      values: { LIST: expressionToBlock(expr.list || [], 0) },
    });
  }
  if (ref === 'list_item') {
    return blockXml('value_list_item', {
      values: {
        LIST: expressionToBlock(expr.list || [], 0),
        INDEX: expressionToBlock(expr.index ?? 1, 1),
      },
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
    hand_limit: 'hand_limit',
    deck_remaining: 'deck_remaining',
    discard_size: 'discard_size',
    exile_size: 'exile_size',
    equip_count: 'equip_count',
    turn_damage_taken: 'turn_damage_taken',
    turn_damage_dealt: 'turn_damage_dealt',
    total_damage_taken: 'total_damage_taken',
    total_damage_dealt: 'total_damage_dealt',
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
  if (ref === 'damage_amount') return blockXml('value_damage_amount');
  if (ref === 'zone_count') {
    return blockXml('value_zone_count', {
      fields: { ZONE: expr.zone || 'hand' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'equipment_count_named') {
    return blockXml('value_equipment_count_named', {
      values: {
        TARGET: targetBlock(expr.target || 'self'),
        CARD: cardBlock(expr.card || expr.card_id || 'Disc'),
      },
    });
  }
  if (ref === 'incoming_damage') return blockXml('value_incoming_damage');
  if (ref === 'damage_source') return blockXml('value_damage_source');
  if (ref === 'choice_target') return blockXml('value_choice_target');
  if (ref === 'choice_confirmed') return blockXml('value_choice_confirmed');
  if (ref === 'timer_remaining') return blockXml('value_timer_remaining');
  if (ref === 'selected_card_index') return blockXml('value_selected_card_index');
  if (ref === 'loop_index') return blockXml('value_loop_index');
  if (ref === 'selected_cards_count') return blockXml('value_selected_cards_count');
  if (ref === 'card_property') {
    return blockXml('value_card_property', {
      fields: { PROPERTY: expr.property || 'fusion_level' },
      values: { CARD: cardBlock(expr.card || { ref: 'current_card' }) },
    });
  }
  if (ref === 'card_tag_count') {
    return blockXml('value_card_tag_count', {
      values: { CARD: cardBlock(expr.card || { ref: 'current_card' }) },
    });
  }
  if (ref === 'card_def_property') {
    return blockXml('value_card_def_property', {
      fields: { PROPERTY: expr.property || 'cost_e' },
      values: { CARD: cardBlock(expr.card || 'Basic') },
    });
  }
  if (ref === 'card_def_tags') {
    return blockXml('value_card_def_tags', {
      values: { CARD: cardBlock(expr.card || 'Basic') },
    });
  }
  if (ref === 'equipment_property') {
    return blockXml('value_equipment_property', {
      fields: { PROPERTY: expr.property || 'turns_equipped' },
      values: { EQUIPMENT: equipmentBlock(expr.equipment || { ref: 'current_equipment' }) },
    });
  }
  if (ref === 'player_property') {
    return blockXml('value_player_property', {
      fields: { PROPERTY: expr.property || 'health' },
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
  if (ref === 'last_damage') {
    return blockXml('value_last_damage', {
      values: { TARGET: targetBlock(expr.target || 'self') },
    });
  }
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

function conditionToBlock(condition) {
  if (condition === true || condition === 'true') return blockXml('condition_compare', {
    values: { A: numberBlock(1), B: numberBlock(1) },
    fields: { OP: '=' },
  });
  if (condition === false || condition === 'false') return blockXml('condition_compare', {
    values: { A: numberBlock(1), B: numberBlock(0) },
    fields: { OP: '=' },
  });
  if (!condition || typeof condition !== 'object') return '';
  const op = condition.op || '';
  if (op === 'compare') {
    return blockXml('condition_compare', {
      fields: { OP: condition.operator || '=' },
      values: { A: expressionToBlock(condition.a, 0), B: expressionToBlock(condition.b, 0) },
    });
  }
  if (op === 'var_compare') {
    return blockXml('condition_var_compare', {
      fields: { NAME: condition.name || '', OP: condition.operator || '=' },
      values: {
        TARGET: targetBlock(condition.target || 'self'),
        VALUE: expressionToBlock(condition.value, 0),
      },
    });
  }
  if (op === 'list_contains') {
    return blockXml('condition_list_contains', {
      values: {
        LIST: expressionToBlock(condition.list || [], 0),
        ITEM: expressionToBlock(condition.item ?? 0, 0),
      },
    });
  }
  if (op === 'target_attribute') {
    return blockXml('condition_target_attribute', {
      fields: { ATTR: condition.attr || 'health', OP: condition.operator || '=' },
      values: {
        TARGET: targetBlock(condition.target || 'self'),
        VALUE: expressionToBlock(condition.value, 0),
      },
    });
  }
  if (op === 'has_status_named') {
    return blockXml('condition_has_status_named', {
      fields: { STATUS: condition.status || '' },
      values: { TARGET: targetBlock(condition.target || 'self') },
    });
  }
  if (op === 'has_status') {
    return blockXml('condition_has_status', {
      fields: { STATUS: condition.status || 'poison' },
      values: { TARGET: targetBlock(condition.target || 'self') },
    });
  }
  if (op === 'has_tag') {
    return blockXml('condition_has_tag', {
      fields: { TAG: condition.tag || 'exile' },
      values: { CARD: cardBlock(condition.card || { ref: 'current_card' }) },
    });
  }
  if (op === 'damage_source_relation') {
    return blockXml('condition_damage_source_relation', {
      fields: { RELATION: condition.relation || 'any' },
    });
  }
  if (op === 'and' || op === 'or') {
    return blockXml('condition_and_or', {
      fields: { OP: op },
      values: { A: conditionToBlock(condition.a), B: conditionToBlock(condition.b) },
    });
  }
  if (op === 'not') {
    return blockXml('condition_not', {
      values: { BOOL: conditionToBlock(condition.value) },
    });
  }
  return blockXml('raw_effect_json', { fields: { JSON: JSON.stringify(condition) } });
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
    case 'if':
      return blockXml('control_if', {
        values: { CONDITION: conditionToBlock(params.condition) },
        statements: { DO: chain((params.then || params.body || []).map(effectToBlock)) },
      });
    case 'if_else':
      return blockXml('control_if_else', {
        values: { CONDITION: conditionToBlock(params.condition) },
        statements: {
          DO: chain((params.then || []).map(effectToBlock)),
          ELSE: chain((params.else || []).map(effectToBlock)),
        },
      });
    case 'repeat':
      return blockXml('control_repeat', {
        values: { TIMES: expressionToBlock(params.times, 1) },
        statements: { DO: chain((params.body || []).map(effectToBlock)) },
      });
    case 'repeat_until':
      return blockXml('control_repeat_until', {
        values: { CONDITION: conditionToBlock(params.condition) },
        statements: { DO: chain((params.body || params.effects || []).map(effectToBlock)) },
      });
    case 'for_each_selected_card':
      return blockXml('control_for_each_selected_card', {
        statements: { DO: chain((params.body || []).map(effectToBlock)) },
      });
    case 'for_each_list':
      return blockXml('control_for_each_list', {
        fields: { NAME: params.name || '' },
        values: { LIST: expressionToBlock(params.list || [], 0) },
        statements: { DO: chain((params.body || []).map(effectToBlock)) },
      });
    case 'for_each_equipment':
      return blockXml('control_for_each_equipment', {
        fields: { FILTER: params.filter || 'all' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          CARD: cardBlock(params.card || params.card_id || 'Leaf'),
        },
        statements: { DO: chain((params.body || []).map(effectToBlock)) },
      });
    case 'timed_effect':
      return blockXml('control_timed_effect', {
        fields: { TRIGGER: params.trigger || 'target_turn_start' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          DURATION: expressionToBlock(params.duration ?? params.turns ?? 1, 1),
        },
        statements: { DO: chain((params.effects || params.body || []).map(effectToBlock)) },
      });
    case 'for_each':
      return blockXml('control_for_each', {
        values: { TARGET_LIST: targetBlock(params.targets || 'both') },
        statements: { DO: chain((params.body || []).map(effectToBlock)) },
      });
    case 'break':
      return blockXml('control_break');
    case 'continue':
      return blockXml('control_continue');
    case 'var_set':
    case 'var_add':
    case 'var_sub':
    case 'var_mul':
    case 'var_div': {
      const blockType = {
        var_set: 'action_var_set',
        var_add: 'action_var_add',
        var_sub: 'action_var_sub',
        var_mul: 'action_var_mul',
        var_div: 'action_var_div',
      }[type];
      return blockXml(blockType, {
        fields: { NAME: params.name || '' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          VALUE: expressionToBlock(params.value, type === 'var_mul' || type === 'var_div' ? 1 : 0),
        },
      });
    }
    case 'list_set':
      return blockXml('action_list_set', {
        fields: { NAME: params.name || '' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          LIST: expressionToBlock(params.list || [], 0),
        },
      });
    case 'list_append':
      return blockXml('action_list_append', {
        fields: { NAME: params.name || '' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          ITEM: expressionToBlock(params.item ?? 0, 0),
        },
      });
    case 'list_insert':
      return blockXml('action_list_insert', {
        fields: { NAME: params.name || '' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          INDEX: expressionToBlock(params.index ?? 1, 1),
          ITEM: expressionToBlock(params.item ?? 0, 0),
        },
      });
    case 'list_delete':
      return blockXml('action_list_delete', {
        fields: { NAME: params.name || '' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          INDEX: expressionToBlock(params.index ?? 1, 1),
        },
      });
    case 'list_clear':
      return blockXml('action_list_clear', {
        fields: { NAME: params.name || '' },
        values: { TARGET: targetBlock(params.target || 'self') },
      });
    case 'countdown_var':
      return blockXml('action_countdown_var', {
        fields: { NAME: params.name || '', TRIGGER: params.trigger || 'target_turn_start' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          DURATION: expressionToBlock(params.duration ?? params.turns ?? 1, 1),
        },
      });
    case 'damage':
    case 'deal_damage': {
      const hits = Number(params.hits || 1);
      const blockType = hits > 1 ? 'action_damage_multi' : 'action_damage';
      const fields = { IS_PRECISION: params.is_precision ? 'TRUE' : 'FALSE' };
      const values = { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 6) };
      if (hits > 1) values.TIMES = numberBlock(hits, 1);
      return blockXml(blockType, { fields, values });
    }
    case 'request_target':
      return blockXml('action_request_target', {
        fields: {
          TITLE: params.title || '选择目标',
          CONTENT: params.content || '',
          CANCELLABLE: params.cancellable === false ? 'FALSE' : 'TRUE',
        },
        values: { TARGETS: targetBlock(params.candidates || params.target || 'enemy') },
      });
    case 'request_card':
      if (params.multi || params.choice_type === 'choose_cards_from_hand') {
        return blockXml('action_request_cards', {
          fields: {
            TITLE: params.title || '选择卡牌',
            CONTENT: params.content || '',
            CARD_TYPE: params.card_type || 'any',
            SAME_NAME: params.same_name === false ? 'FALSE' : 'TRUE',
            CANCELLABLE: params.cancellable === false ? 'FALSE' : 'TRUE',
          },
          values: {
            TARGET: targetBlock(params.target || 'self'),
            MIN_COUNT: expressionToBlock(params.min_count ?? 1, 1),
            MAX_COUNT: expressionToBlock(params.max_count ?? 1, 1),
          },
        });
      }
      if (params.continue_on_cancel) {
        return blockXml('action_request_optional_card', {
          fields: {
            TITLE: params.title || '选择卡牌',
            CONTENT: params.content || '',
            ZONE: params.zone || 'hand',
          },
          values: { TARGET: targetBlock(params.target || 'self') },
        });
      }
      return blockXml('action_request_card', {
        fields: {
          TITLE: params.title || '选择卡牌',
          CONTENT: params.content || '',
          ZONE: params.zone || 'hand',
          CANCELLABLE: params.cancellable === false ? 'FALSE' : 'TRUE',
        },
        values: { TARGET: targetBlock(params.target || 'self') },
      });
    case 'request_confirm':
      return blockXml('action_request_confirm', {
        fields: {
          TITLE: params.title || '确认',
          CONTENT: params.content || '',
          OK_TEXT: params.ok_text || '确认',
          CANCEL_TEXT: params.cancel_text || '取消',
          CANCELLABLE: params.cancellable === false ? 'FALSE' : 'TRUE',
        },
      });
    case 'response_declare':
      return blockXml('response_declare', {
        fields: {
          TIMING: params.timing || 'thorn',
          COST_E: params.cost_e ?? 0,
          COST_M: params.cost_m ?? 0,
          TITLE: params.title || '',
          CONTENT: params.content || '',
        },
      });
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
      return chain([
        blockXml('action_damage', {
          fields: { IS_PRECISION: params.is_precision ? 'TRUE' : 'FALSE' },
          values: {
            ...targetValue(params, 'TARGET', 'enemy'),
            AMOUNT: expressionToBlock(mathExpr(params.base ?? 6, '+', mathExpr(params.per_stack ?? 3, '*', varExpr(TRIANGLE_STACK_VAR))), 6),
          },
        }),
        blockXml('control_if', {
          values: {
            CONDITION: conditionToBlock({
              op: 'compare',
              a: expression('last_damage', { target: params.target || 'enemy' }),
              operator: '>',
              b: 0,
            }),
          },
          statements: {
            DO: blockXml('action_var_set', {
              fields: { NAME: TRIANGLE_STACK_VAR },
              values: {
                TARGET: targetBlock('self'),
                VALUE: expressionToBlock(expression('min_max', {
                  mode: 'min',
                  a: params.max_stacks ?? 4,
                  b: mathExpr(varExpr(TRIANGLE_STACK_VAR), '+', 1),
                }), 1),
              },
            }),
          },
        }),
      ]);
    case 'heal':
      return blockXml('action_heal', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 4) } });
    case 'set_health':
      return blockXml('action_set_health', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 20) } });
    case 'gain_e':
      return blockXml('action_gain_e', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'gain_m':
      return blockXml('action_gain_m', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'cost_e':
      return blockXml('action_cost_e', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'cost_m':
      return blockXml('action_cost_m', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'poison':
    case 'apply_poison':
      return blockXml('action_poison', { values: { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'burn':
    case 'apply_burn':
      return blockXml('action_burn', { values: { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'vulnus':
    case 'apply_vulnerable':
      return blockXml('action_vulnus', { values: { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'toxic':
    case 'apply_toxic':
      return blockXml('action_toxic', { values: { ...targetValue(params, 'TARGET', 'enemy'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'draw':
      return blockXml('action_draw', { values: { ...targetValue(params, 'TARGET', 'self'), AMOUNT: numberBlock(params.amount, 1) } });
    case 'discard':
      return blockXml('action_discard', { values: { AMOUNT: numberBlock(params.amount, 1) } });
    case 'discard_choice_then_draw':
      return blockXml('action_discard_choice_then_draw');
    case 'coffee_gain_e':
      return chain([
        blockXml('action_gain_e', {
          values: {
            TARGET: targetBlock(params.target || 'self'),
            AMOUNT: expressionToBlock(mathExpr(params.amount ?? 1, '+', mathExpr(varExpr(COFFEE_FIRST_VAR), '*', params.first_bonus ?? 1)), 1),
          },
        }),
        blockXml('action_var_set', {
          fields: { NAME: COFFEE_FIRST_VAR },
          values: { TARGET: targetBlock('self'), VALUE: numberBlock(0) },
        }),
      ]);
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
    case 'place_as_equip':
    case 'equip_this_card':
      return blockXml('action_equip_this_card', { values: { CARD: cardBlock(params.card || { ref: 'current_card' }) } });
    case 'add_equipment_to_zone':
      return blockXml('action_add_equipment_to_zone', {
        values: {
          CARD: cardBlock(params.card || 'Leaf'),
          TARGET: targetBlock(params.target || 'self'),
        },
      });
    case 'equip_disc_armor':
      return blockXml('control_if', {
        values: {
          CONDITION: conditionToBlock({
            op: 'compare',
            a: expression('equipment_count_named', { target: 'self', card_id: params.card_id || 'Disc' }),
            operator: '=',
            b: 0,
          }),
        },
        statements: {
          DO: blockXml('action_add_armor', {
            values: { TARGET: targetBlock('self'), AMOUNT: numberBlock(params.amount, 2) },
          }),
        },
      });
    case 'equip_sponge':
      return blockXml('action_equip_sponge');
    case 'equip_set_health':
      return blockXml('action_equip_set_health', { values: { AMOUNT: numberBlock(params.amount, 60) } });
    case 'equip_reduce_own_draw':
      return blockXml('action_equip_reduce_own_draw', { values: { AMOUNT: numberBlock(params.amount, 1) } });
    case 'equip_reduce_own_e':
      return blockXml('action_equip_reduce_own_e', { values: { AMOUNT: numberBlock(params.amount, 1) } });
    case 'equip_on_destroy_remove_poison_damage':
      return blockXml('action_equip_on_destroy_remove_poison_damage', { values: { MULTIPLIER: numberBlock(params.multiplier, 2) } });
    case 'activate_corruption':
      return blockXml('action_equipment_prop_set', {
        fields: { PROPERTY: 'corruption_active' },
        values: {
          EQUIPMENT: equipmentBlock(params.equipment || { ref: 'current_equipment' }),
          VALUE: numberBlock(1),
        },
      });
    case 'equipment_prop_set':
      return blockXml('action_equipment_prop_set', {
        fields: { PROPERTY: params.property || 'turns_equipped' },
        values: {
          EQUIPMENT: equipmentBlock(params.equipment || { ref: 'current_equipment' }),
          VALUE: expressionToBlock(params.value ?? 0, 0),
        },
      });
    case 'equipment_prop_add':
      return blockXml('action_equipment_prop_add', {
        fields: { PROPERTY: params.property || 'turns_equipped' },
        values: {
          EQUIPMENT: equipmentBlock(params.equipment || { ref: 'current_equipment' }),
          AMOUNT: expressionToBlock(params.amount ?? 1, 1),
        },
      });
    case 'player_prop_set':
      return blockXml('action_player_prop_set', {
        fields: { PROPERTY: params.property || 'health' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          VALUE: expressionToBlock(params.value ?? 0, 0),
        },
      });
    case 'player_prop_add':
      if (params.property === 'max_health') {
        return blockXml('action_max_health_add', {
          values: {
            TARGET: targetBlock(params.target || 'self'),
            AMOUNT: expressionToBlock(params.amount ?? 1, 1),
          },
        });
      }
      if (params.property === 'max_elixir') {
        return blockXml('action_max_elixir_add', {
          values: {
            TARGET: targetBlock(params.target || 'self'),
            AMOUNT: expressionToBlock(params.amount ?? 1, 1),
          },
        });
      }
      if (params.property === 'max_magic') {
        return blockXml('action_max_magic_add', {
          values: {
            TARGET: targetBlock(params.target || 'self'),
            AMOUNT: expressionToBlock(params.amount ?? 1, 1),
          },
        });
      }
      return blockXml('action_player_prop_add', {
        fields: { PROPERTY: params.property || 'health' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          AMOUNT: expressionToBlock(params.amount ?? 1, 1),
        },
      });
    case 'magic_battery_gain_m':
      return [
        headWithNext('equipment_any_turn_start', blockXml('action_var_set', {
          fields: { NAME: MAGIC_BATTERY_TURN_VAR },
          values: { TARGET: targetBlock('self'), VALUE: numberBlock(0) },
        })),
        headWithNext('equipment_damage_taken', blockXml('control_if', {
          values: {
            CONDITION: conditionToBlock({
              op: 'compare',
              a: varExpr(MAGIC_BATTERY_TURN_VAR),
              operator: '<',
              b: params.limit ?? 3,
            }),
          },
          statements: {
            DO: chain([
              blockXml('action_gain_m', {
                values: { TARGET: targetBlock(params.target || 'self'), AMOUNT: numberBlock(params.amount, 1) },
              }),
              blockXml('action_var_add', {
                fields: { NAME: MAGIC_BATTERY_TURN_VAR },
                values: { TARGET: targetBlock('self'), VALUE: numberBlock(params.amount, 1) },
              }),
            ]),
          },
        })),
      ];
    case 'skip_turn':
      return blockXml('action_skip_turn', { values: targetValue(params, 'TARGET', 'enemy') });
    case 'block_enemy_attacks':
    case 'block_card_type':
      return blockXml('action_block_card_type', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: { ...targetValue(params, 'TARGET', 'enemy'), DURATION: numberBlock(params.duration, 1) },
      });
    case 'force_enemy_attacks_only':
    case 'force_card_type':
      return blockXml('action_force_card_type', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: { ...targetValue(params, 'TARGET', 'enemy'), DURATION: numberBlock(params.duration, 1) },
      });
    case 'set_untargetable':
    case 'untargetable':
      return blockXml('action_untargetable', { values: targetValue(params, 'TARGET', 'self') });
    case 'block_own_actions':
    case 'block_action':
      return blockXml('action_block_action', { values: targetValue(params, 'TARGET', 'self') });
    case 'fission':
      return blockXml('action_fission', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: { TIMES: numberBlock(params.times, 2) },
      });
    case 'fusion':
      return blockXml('action_fusion', {
        fields: { CARD_TYPE: params.card_type || 'thorn' },
        values: {
          MIN_COUNT: numberBlock(params.min_count ?? params.count, 2),
          MAX_COUNT: numberBlock(params.max_count ?? params.count, 3),
        },
      });
    case 'copy_card':
      return blockXml('action_copy_card', { values: { CARD: cardBlock(params.card || { ref: 'current_card' }) } });
    case 'copy_choice_with_discount':
      return blockXml('action_copy_choice_with_discount', {
        values: {
          CARD: cardBlock(params.card || { ref: 'selected_card' }),
          DISCOUNT: numberBlock(params.discount_e, 1),
        },
      });
    case 'card_prop_add': {
      const prop = params.property || 'fusion_level';
      const blockType = prop === 'fission_level' ? 'action_card_fission_add'
        : prop === 'fusion_level' ? 'action_card_fusion_add'
        : prop === 'mimic_discount' ? 'action_card_discount_set'
        : 'action_card_prop_add';
      const values = {
        CARD: cardBlock(params.card || { ref: 'current_card' }),
        AMOUNT: expressionToBlock(params.amount ?? params.value ?? 1, 1),
      };
      if (blockType !== 'action_card_prop_add') return blockXml(blockType, { values });
      return blockXml(blockType, { fields: { PROPERTY: prop }, values });
    }
    case 'card_prop_mul':
      return blockXml('action_card_prop_mul', {
        fields: { PROPERTY: params.property || 'fusion_level' },
        values: {
          CARD: cardBlock(params.card || { ref: 'current_card' }),
          MULTIPLIER: expressionToBlock(params.multiplier ?? params.amount ?? 2, 2),
        },
      });
    case 'card_damage_multiply':
      return blockXml('action_card_damage_multiply', {
        values: {
          CARD: cardBlock(params.card || { ref: 'current_card' }),
          MULTIPLIER: expressionToBlock(params.multiplier ?? 2, 2),
        },
      });
    case 'card_prop_set': {
      const prop = params.property || 'fusion_level';
      const blockType = prop === 'fission_level' ? 'action_card_fission_set'
        : prop === 'fusion_level' ? 'action_card_fusion_set'
        : prop === 'mimic_discount' ? 'action_card_discount_set'
        : 'action_card_prop_set';
      const valueBlock = expressionToBlock(params.value ?? params.amount ?? 1, 1);
      const values = {
        CARD: cardBlock(params.card || { ref: 'current_card' }),
        AMOUNT: valueBlock,
      };
      if (blockType !== 'action_card_prop_set') return blockXml(blockType, { values });
      return blockXml(blockType, {
        fields: { PROPERTY: prop },
        values: {
          CARD: values.CARD,
          VALUE: valueBlock,
        },
      });
    }
    case 'on_owner_turn_start':
      return headWithNext('equipment_owner_turn_start', effectsToStatement(params));
    case 'on_enemy_turn_start':
      return headWithNext('equipment_enemy_turn_start', effectsToStatement(params));
    case 'on_any_turn_start':
      return headWithNext('equipment_any_turn_start', effectsToStatement(params));
    case 'on_damage_taken':
      return headWithNext('equipment_damage_taken', effectsToStatement(params));
    case 'on_equipment_destroy':
      return headWithNext('trigger_on_destroy', effectsToStatement(params));
    case 'on_hand_owner_turn_start':
      return headWithNext('trigger_hand_owner_turn_start', effectsToStatement(params));
    case 'on_enter_hand':
      return headWithNext('trigger_enter_hand', effectsToStatement(params));
    case 'on_discard_owner_turn_start':
      return headWithNext('trigger_discard_owner_turn_start', effectsToStatement(params));
    case 'on_deck_owner_turn_start':
      return headWithNext('trigger_deck_owner_turn_start', effectsToStatement(params));
    case 'on_card_used':
      return headWithNext('trigger_on_card_used', effectsToStatement(params), {
        fields: {
          RELATION: params.relation || 'any',
          CARD_TYPE: params.card_type || 'any',
        },
      });
    case 'on_equipment_triggered':
      return headWithNext('trigger_on_equipment_triggered', effectsToStatement(params), {
        fields: { RELATION: params.relation || 'any' },
      });
    case 'on_equipment_destroyed':
      return headWithNext('trigger_on_equipment_destroyed', effectsToStatement(params), {
        fields: { RELATION: params.relation || 'any' },
      });
    case 'on_resource_spent':
      return headWithNext('trigger_on_resource_spent', effectsToStatement(params), {
        fields: {
          RELATION: params.relation || 'any',
          RESOURCE: params.resource || 'elixir',
        },
        values: { AMOUNT: expressionToBlock(params.amount ?? 1, 1) },
      });
    case 'on_player_stat_changed':
      return headWithNext('trigger_on_player_stat_changed', effectsToStatement(params), {
        fields: {
          RELATION: params.relation || 'any',
          PROPERTY: params.property || 'health',
          DIRECTION: params.direction || 'change',
        },
      });
    case 'on_equipment_trigger':
      return headWithNext('equipment_manual_trigger', effectsToStatement(params), {
        fields: { DESTROY: params.destroy_self ? 'TRUE' : 'FALSE' },
        values: { MAX_USES: expressionToBlock(params.max_uses_per_turn ?? 0, 0) },
      });
    case 'aura_enemy_elixir_recovery':
      return blockXml('aura_enemy_elixir_recovery', { values: { AMOUNT: numberBlock(params.amount, -1) } });
    case 'on_fatal_set_health_exile':
      return blockXml('passive_fatal_set_health_exile', { values: { HEALTH: numberBlock(params.health, 5) } });
    case 'counter_dodge':
      return blockXml('counter_dodge', { values: { AMOUNT: numberBlock(params.amount, 1) } });
    case 'counter_nazar':
      return blockXml('counter_nazar');
    case 'counter_equip_protect':
      return blockXml('counter_equip_protect', { values: { AMOUNT: numberBlock(params.amount, 1) } });
    case 'counter_negate_skill':
      return blockXml('counter_negate_skill');
    case 'counter_block_enemy_attacks':
      return blockXml('counter_block_enemy_attacks', { values: { DURATION: numberBlock(params.duration, 1) } });
    case 'counter_set_invincible_then_die':
      return blockXml('counter_set_invincible_then_die');
    case 'add_tag':
      return blockXml('action_add_tag', {
        fields: { TAG: params.tag || 'exile' },
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'remove_tag':
      return blockXml('action_remove_tag', {
        fields: { TAG: params.tag || 'exile' },
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'tag_add_named':
      return blockXml('action_tag_add_id', {
        fields: { TAG: params.tag || 'custom_tag' },
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'tag_remove_named':
      return blockXml('action_tag_remove_id', {
        fields: { TAG: params.tag || 'custom_tag' },
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'clear_tags':
      return blockXml('action_clear_card_tags', {
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'transform_card':
      return blockXml('action_transform_card', { values: { CARD: cardBlock(params.card || { ref: 'current_card' }) } });
    case 'exile_this':
      return blockXml('action_exile_this', { values: { CARD: cardBlock(params.card || { ref: 'current_card' }) } });
    case 'move_to_discard':
      return blockXml('action_move_to_discard', { values: { CARD: cardBlock(params.card || { ref: 'current_card' }) } });
    case 'move_to_hand':
      return blockXml('action_move_to_hand', {
        values: {
          CARD: cardBlock(params.card || { ref: 'selected_card' }),
          TARGET: targetBlock(params.target || 'self'),
        },
      });
    case 'move_to_deck':
      return blockXml('action_move_to_deck', {
        fields: { POSITION: params.position || 'top' },
        values: { CARD: cardBlock(params.card || { ref: 'current_card' }) },
      });
    case 'destroy_self_equipment':
      return blockXml('action_destroy_self_equipment', { values: { EQUIPMENT: equipmentBlock(params.equipment || { ref: 'current_equipment' }) } });
    case 'equip_protection':
      return blockXml('action_equip_protection', { values: { EQUIPMENT: equipmentBlock(params.equipment || { ref: 'current_equipment' }) } });
    case 'give_card_to_hand':
      return blockXml('action_give_card_to_hand', {
        values: {
          TARGET: targetBlock(params.target || 'self'),
          CARD: cardBlock(params.card || 'Basic'),
        },
      });
    case 'give_card_to_deck':
      return blockXml('action_give_card_to_deck', {
        fields: { POSITION: params.position || 'top' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          CARD: cardBlock(params.card || 'Basic'),
        },
      });
    case 'give_card_to_discard':
      return blockXml('action_give_card_to_discard', {
        values: {
          TARGET: targetBlock(params.target || 'self'),
          CARD: cardBlock(params.card || 'Basic'),
        },
      });
    case 'remove_specific_card':
      return blockXml('action_remove_specific_card', {
        fields: { ZONE: params.zone || 'hand' },
        values: {
          TARGET: targetBlock(params.target || 'self'),
          CARD: cardBlock(params.card || 'Basic'),
        },
      });
    default:
      return blockXml('raw_effect_json', { fields: { JSON: JSON.stringify(effect) } });
  }
}

function isEquipmentEventEffect(effect) {
  const type = typeof effect === 'string' ? effect : effect?.type || '';
  return type === 'on_owner_turn_start'
    || type === 'on_enemy_turn_start'
    || type === 'on_any_turn_start'
    || type === 'on_damage_taken'
    || type === 'on_equipment_trigger'
    || type === 'on_equipment_destroy'
    || type === 'on_hand_owner_turn_start'
    || type === 'on_enter_hand'
    || type === 'on_discard_owner_turn_start'
    || type === 'on_deck_owner_turn_start'
    || type === 'on_card_used'
    || type === 'on_equipment_triggered'
    || type === 'on_equipment_destroyed'
    || type === 'on_resource_spent'
    || type === 'on_player_stat_changed'
    || type === 'magic_battery_gain_m';
}

function withPosition(blockXmlText, index) {
  const x = 36 + (index % 2) * 360;
  const y = 36 + Math.floor(index / 2) * 150;
  return blockXmlText.replace('<block ', `<block x="${x}" y="${y}" `);
}

export function effectsToXml(effects, options = {}) {
  const normalized = Array.isArray(effects) ? effects : [];
  if (!normalized.length && !options.triggerType) return '';
  const playEffects = normalized.filter(effect => !isEquipmentEventEffect(effect));
  const eventEffects = normalized.filter(isEquipmentEventEffect);
  const playBlocks = playEffects.map(effectToBlock).flat();
  const hasEquipBlock = normalized.some(effect => ['place_as_equip', 'equip_this_card'].includes(typeof effect === 'string' ? effect : effect?.type));
  if (options.equipOnPlay && !hasEquipBlock) playBlocks.unshift(blockXml('action_equip_this_card'));
  const roots = [];
  const playBody = chain(playBlocks);
  if (options.triggerType && (playBody || options.equipOnPlay)) roots.push(wrapWithTrigger(playBody, options.triggerType));
  else if (playBody) roots.push(playBody);
  for (const eventEffect of eventEffects) roots.push(...[effectToBlock(eventEffect)].flat());
  const positioned = roots.filter(Boolean).map((root, index) => withPosition(root, index)).join('');
  return positioned ? `<xml xmlns="${XML_NS}">${positioned}</xml>` : '';
}

export function scriptFromEffects(effects = [], options = {}) {
  const normalized = Array.isArray(effects) ? effects : [];
  return { xml: effectsToXml(normalized, options), effects: normalized };
}

export function ensureScriptXml(script, fallbackEffects = [], options = {}) {
  const scriptEffects = Array.isArray(script?.effects) ? script.effects : [];
  const fallback = Array.isArray(fallbackEffects) ? fallbackEffects : [];
  const effects = scriptEffects.length ? scriptEffects : fallback;
  const rawXml = script?.xml && script.xml.includes('<block') ? script.xml : '';
  const xml = rawXml && hasTriggerHead(rawXml, options.triggerType)
    ? rawXml
    : effects.length || !rawXml
      ? effectsToXml(effects, options)
      : wrapRawXmlWithTrigger(rawXml, options.triggerType);
  return { ...(script || {}), xml, effects };
}
