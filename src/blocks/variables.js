import * as Blockly from 'blockly';
import { COLORS } from './enums.js';

const C = COLORS.VARIABLE;

Blockly.defineBlocksWithJsonArray([
  { type: 'value_var', message0: '%1 的变量 %2', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }], output: 'Number', colour: C },
  { type: 'action_var_set', message0: '将 %1 的变量 %2 设为 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_var_add', message0: '将 %1 的变量 %2 增加 %3', args0: [{ type: 'input_value', name: 'TARGET', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
]);
