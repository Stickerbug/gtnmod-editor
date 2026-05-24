export const ENUMS = {
  CARD_TYPE: [['攻击', 'thorn'], ['技能', 'bloom'], ['反制', 'guard'], ['装备', 'root'], ['任意', 'any']],
  QUALITY: [['Common', 'Common'], ['Unusual', 'Unusual'], ['Epic', 'Epic'], ['Ultra', 'Ultra'], ['Super', 'Super']],
  TAG: [['放逐', 'exile'], ['不可叠加', 'non_stackable'], ['精准', 'precision'], ['不可摧毁', 'indestructible'], ['萌芽', 'sprout'], ['共生', 'symbiosis']],
  STATUS: [['中毒', 'poison'], ['灼烧', 'burn'], ['易伤', 'vulnus'], ['淬毒', 'toxic'], ['闪避', 'dodge'], ['无敌', 'invincible'], ['不可选中', 'untargetable']],
  ATTRIBUTE: [['生命', 'health'], ['能量', 'energy'], ['魔力', 'magic'], ['护甲', 'armor'], ['手牌数量', 'hand_size']],
  COMPARE: [['=', '='], ['!=', '!='], ['<', '<'], ['>', '>'], ['<=', '<='], ['>=', '>=']],
  MATH_OP: [['+', '+'], ['-', '-'], ['*', '*'], ['/', '/'], ['%', '%']],
  ROUND_MODE: [['向上取整', 'ceil'], ['向下取整', 'floor'], ['四舍五入', 'round']],
  AND_OR: [['且', 'and'], ['或', 'or']],
};

export const COLORS = {
  TRIGGER: 20, MANUAL_TRIGGER: 25, RESPONSE: 290, ACTION: 330, CONTROL: 120, CONDITION: 210, VALUE: 160, TARGET: 60, VARIABLE: 15
};
