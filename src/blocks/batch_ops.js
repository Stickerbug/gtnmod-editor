import * as Blockly from 'blockly';
import { COLORS } from './enums.js';

const C = COLORS.ACTION;

Blockly.defineBlocksWithJsonArray([
  { type: 'action_batch_var_add', message0: '对 %1 的每个目标 变量 %2 增加 %3', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_var_sub', message0: '对 %1 的每个目标 变量 %2 减少 %3', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_var_mul', message0: '对 %1 的每个目标 变量 %2 乘以 %3', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_var_div', message0: '对 %1 的每个目标 变量 %2 除以 %3', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'NAME', text: '邪眼层数' }, { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_status_add', message0: '对 %1 的每个目标 添加状态 %2 层数 %3', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }, { type: 'input_value', name: 'AMOUNT', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_status_remove', message0: '对 %1 的每个目标 移除状态 %2', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'STATUS', text: '邪眼' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_tag_add', message0: '对 %1 的每个目标当前牌 添加标签 %2', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'TAG', text: '放逐' }], previousStatement: null, nextStatement: null, colour: C },
  { type: 'action_batch_tag_remove', message0: '对 %1 的每个目标当前牌 移除标签 %2', args0: [{ type: 'input_value', name: 'TARGETS', check: 'Target' }, { type: 'field_input', name: 'TAG', text: '放逐' }], previousStatement: null, nextStatement: null, colour: C },
]);
