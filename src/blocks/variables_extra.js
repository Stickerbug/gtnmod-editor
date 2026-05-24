import * as Blockly from 'blockly';
import { ENUMS, COLORS } from './enums.js';

const C = COLORS.VARIABLE;

Blockly.defineBlocksWithJsonArray([
  { type: 'condition_var_compare', message0: '%1 的变量 %2 %3 %4', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'field_dropdown', name: 'OP', options: ENUMS.COMPARE }, { type: 'input_value', name: 'VALUE', check: 'Number' }], output: 'Boolean', colour: C },
  { type: 'action_var_sub', message0: '将 %1 的变量 %2 减少 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_var_mul', message0: '将 %1 的变量 %2 乘以 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_var_div', message0: '将 %1 的变量 %2 除以 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
]);
