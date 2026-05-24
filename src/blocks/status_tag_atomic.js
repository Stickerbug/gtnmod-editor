import * as Blockly from 'blockly';
import { ENUMS, COLORS } from './enums.js';

const C = COLORS.ACTION;

Blockly.defineBlocksWithJsonArray([
  { type: 'action_status_add_named', message0: '为 %1 添加状态 %2 层数 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }, { type: 'input_value', name: 'AMOUNT', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_status_remove_named', message0: '为 %1 移除状态 %2', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_tag_add_named', message0: '为当前牌添加标签 %1', args0: [{ type: 'field_input', name: 'TAG', text: '放逐' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_tag_remove_named', message0: '为当前牌移除标签 %1', args0: [{ type: 'field_input', name: 'TAG', text: '放逐' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'condition_has_status_named', message0: '%1 拥有状态 %2', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }], output: 'Boolean', colour: COLORS.CONDITION },
]);
