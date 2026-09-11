/* GTN 卡面文本模块：内部标识 → 中文、效果行句型、步骤树 → 效果行。
   规则来源：Python联机版/docs/卡牌描述规范.md；数据来源：src/generated/card-text-rules.js。
   线框图（prototype/）和正式编辑器都从这里取，避免两份实现漂移。 */

import rules from '../generated/card-text-rules.js';
import { createTermTranslator, createExpressionDescriber } from './terms.js';
import { createTemplates, describeRow, describeRows, TEMPLATE_PRESETS } from './templates.js';
import { stepsToRows } from './steps.js';
import { createCardTextRenderer, escapeHtml } from './render.js';

export const cardTextRules = rules;

export const terms = createTermTranslator(rules);
export const expr = createExpressionDescriber(terms);
export const templates = createTemplates(terms);
export const renderer = createCardTextRenderer(rules, terms);

export {
  createTermTranslator, createExpressionDescriber, createTemplates, createCardTextRenderer,
  describeRow, describeRows, stepsToRows, escapeHtml,
  TEMPLATE_PRESETS,
};

/** 便捷入口：卡事件 → { rows, text }。 */
export function describeCard(events) {
  const rows = stepsToRows(events || {}, { templates, terms, expr });
  return { rows, text: describeRows(rows, templates, expr) };
}
