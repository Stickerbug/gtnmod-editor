/* GTN 卡面文本模块：内部标识 → 中文、效果行句型、步骤树 → 效果行。
   规则来源：Python联机版/docs/卡牌描述规范.md；数据来源：src/generated/card-text-rules.js。
   线框图（prototype/）和正式编辑器都从这里取，避免两份实现漂移。 */

import rules from '../generated/card-text-rules.js';
import { createTermTranslator, createExpressionDescriber } from './terms.js';
import { createTemplates, describeRow, describeRows, TEMPLATE_PRESETS } from './templates.js';
import { stepsToRows } from './steps.js';

/* 卡面渲染已交给游戏本体（preview/card-host.html 的 iframe 引游戏 game.js），
   这里只保留界面做 HTML 转义用的小工具。 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const cardTextRules = rules;

export const terms = createTermTranslator(rules);
export const expr = createExpressionDescriber(terms);
export const templates = createTemplates(terms);

export {
  createTermTranslator, createExpressionDescriber, createTemplates,
  describeRow, describeRows, stepsToRows,
  TEMPLATE_PRESETS,
};

/** 便捷入口：卡事件 → { rows, text }。 */
export function describeCard(events) {
  const rows = stepsToRows(events || {}, { templates, terms, expr });
  return { rows, text: describeRows(rows, templates, expr) };
}
