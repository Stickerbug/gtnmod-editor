/* [[icon:X]] 的显示层工具。

   卡牌描述规范里，伤害/资源/状态是用 `[[icon:H]]`、`[[icon:D]]` 这类标记写的
   （见 Python联机版/docs/卡牌描述规范.md），游戏渲染时替换成图标。
   编辑器里**不该把这些中括号标记暴露给用户**：能放图片的地方放卡面同款图标，
   只能放文字的控件（<option>、title）退化成中文短名。 */

import rules from '../generated/card-text-rules.js';

export const ICON_TOKEN_RE = /\[\[icon:([A-Za-z0-9_]+)\]\]/g;

const ICONS = rules.inlineIcons || {};

/* 同义词 → 图标表中的规范键 */
const ICON_ALIAS = {
  health: 'H',
  heal: 'H',
  elixir: 'E',
  magic: 'M',
  damage: 'D',
  poison: 'P',
  fire: 'F',
  armor: 'A',
};

/* 没有图片时的兜底文字；<option> 也用它（option 里放不了图片） */
const ICON_LABELS = {
  H: '生命',
  health: '生命',
  heal: '生命',
  E: '体力',
  elixir: '体力',
  M: '魔力',
  magic: '魔力',
  D: '伤害',
  damage: '伤害',
  electric_damage: '电伤',
  P: '中毒',
  poison: '中毒',
  F: '灼烧',
  fire: '灼烧',
  A: '护甲',
  armor: '护甲',
};

function canonicalIconKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return '';
  if (ICONS[raw]) return raw;
  const alias = ICON_ALIAS[raw.toLowerCase()];
  if (alias && ICONS[alias]) return alias;
  return ICONS[raw.toLowerCase()] ? raw.toLowerCase() : '';
}

/** `[[icon:D]]` 的图形（data URL）；没有对应图标时返回 ''。 */
export function inlineIconSrc(key) {
  const canonical = canonicalIconKey(key);
  return canonical ? ICONS[canonical] : '';
}

/** `[[icon:D]]` 的中文短名，用于放不了图片的地方。 */
export function inlineIconLabel(key) {
  const raw = String(key || '').trim();
  return ICON_LABELS[raw] || ICON_LABELS[raw.toLowerCase()] || raw;
}

/** 把文本里的图标标记换成中文短名（纯文本场合）。 */
export function tokenText(value) {
  return String(value == null ? '' : value).replace(ICON_TOKEN_RE, (_, key) => inlineIconLabel(key));
}

/** 文本里是否含图标标记。 */
export function hasIconToken(value) {
  ICON_TOKEN_RE.lastIndex = 0;
  return ICON_TOKEN_RE.test(String(value == null ? '' : value));
}

/**
 * 把一段可能含 `[[icon:X]]` 的文本追加到 DOM：图标位置插入 <img>，
 * 找不到图片就退回中文短名。文字部分保持原样。
 */
export function appendTokenText(parent, value) {
  const text = String(value == null ? '' : value);
  if (!text) return parent;
  let last = 0;
  ICON_TOKEN_RE.lastIndex = 0;
  let match = ICON_TOKEN_RE.exec(text);
  while (match) {
    if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
    const key = match[1];
    const src = inlineIconSrc(key);
    const label = inlineIconLabel(key);
    if (src) {
      const img = document.createElement('img');
      img.className = 'gee-icon';
      img.src = src;
      img.alt = label;
      img.title = label;
      parent.appendChild(img);
    } else {
      parent.appendChild(document.createTextNode(label));
    }
    last = match.index + match[0].length;
    match = ICON_TOKEN_RE.exec(text);
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  return parent;
}
