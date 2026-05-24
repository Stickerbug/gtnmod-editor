import * as Blockly from 'blockly';
import { COLORS } from './enums.js';

const C = COLORS.TARGET;

Blockly.defineBlocksWithJsonArray([
  { type: 'target_self', message0: '自己', output: 'Target', colour: C },
  { type: 'target_teammate', message0: '队友', output: 'Target', colour: C },
  { type: 'target_friendly', message0: '己方', output: 'Target', colour: C },
  { type: 'target_enemy', message0: '敌方', output: 'Target', colour: C },
  { type: 'target_both', message0: '双方', output: 'Target', colour: C },
  { type: 'target_random_friendly', message0: '随机己方玩家', output: 'Target', colour: C },
  { type: 'target_random_enemy', message0: '随机敌方玩家', output: 'Target', colour: C },
  { type: 'target_random_player', message0: '随机玩家', output: 'Target', colour: C },
  { type: 'target_random_side', message0: '随机一方', output: 'Target', colour: C },
  { type: 'target_event_target', message0: '当前事件目标', output: 'Target', colour: C },
  { type: 'target_event_source', message0: '当前事件来源', output: 'Target', colour: C },
  { type: 'target_last_actor', message0: '上一次行动方', output: 'Target', colour: C },
  { type: 'target_highest_health', message0: '生命值最高', output: 'Target', colour: C },
  { type: 'target_lowest_health', message0: '生命值最低', output: 'Target', colour: C },
]);
