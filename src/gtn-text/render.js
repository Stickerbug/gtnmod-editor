/* 卡面文本渲染：[[icon:D]] → 内联图标，关键词 → 带颜色的 card-token，
   [[card:DefId]] → 内联卡牌 chip。与游戏的 colorizeCardText() 同源规则。 */

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createCardTextRenderer(rules = {}, terms) {
  const compiled = (rules.tokenRules || []).map((rule) => ({
    cls: rule.cls,
    re: new RegExp(rule.source, rule.flags),
  }));
  /* 图标资源与生成数据同目录（src/generated/assets/...） */
  const assetBase = new URL(`../generated/${rules.assetBase || 'assets/'}`, import.meta.url).href;
  const cardIndex = rules.cardIndex || {};
  const chipFallbacks = {
    ManaOrb: { name_cn: '魔法球', name_en: 'Mana Orb', type: 'bloom' },
    Light: { name_cn: '轻', name_en: 'Light', type: 'thorn' },
    Dust: { name_cn: '灰尘', name_en: 'Dust', type: 'thorn' },
    Yggdrasil: { name_cn: '世界树之叶', name_en: 'Yggdrasil', type: 'bloom' },
  };

  const iconUrl = (key) => {
    const ui = (rules.uiIcons || {})[key];
    if (ui) return `${assetBase}ui-icons/${ui}.svg`;
    const status = (rules.statusIcons || {})[key];
    if (status) return `${assetBase}status-icons/${status}.svg`;
    return (rules.inlineIcons || {})[key] || '';
  };

  const renderIcon = (iconKey, label) => {
    const url = iconUrl(iconKey);
    const safeLabel = String(label || iconKey || '').trim();
    if (!url) return safeLabel ? `<span class="inline-token-icon-fallback">${escapeHtml(safeLabel)}</span>` : '';
    const title = safeLabel ? ` title="${escapeHtml(safeLabel)}"` : '';
    return `<span class="inline-token-icon-wrap"><img class="inline-token-icon" src="${url}" alt=""`
      + ` aria-hidden="true"${title} data-image-fallback="inline-token">`
      + `<span class="inline-token-icon-fallback">${escapeHtml(safeLabel)}</span></span>`;
  };

  const tokenIconKey = (cls, text) => {
    if (cls === 'damage') return String(text || '').includes('电伤') ? 'electric_damage' : 'damage';
    if (cls === 'heal' || cls === 'health') return 'H';
    if (cls === 'elixir') return 'E';
    if (cls === 'magic') return 'M';
    if (cls === 'armor') return 'armor';
    return (rules.tokenIconKeys || {})[cls] || '';
  };

  const resolveCard = (defId) => {
    const key = String(defId || '').trim();
    return cardIndex[key] || cardIndex[key.split(':').pop()] || chipFallbacks[key] || null;
  };

  const cardChipHtml = (defId, lang = 'zh') => {
    const entry = resolveCard(defId);
    const type = entry ? entry.type : '';
    const name = entry
      ? (lang === 'zh' ? (entry.name_cn || entry.name_en) : (entry.name_en || entry.name_cn))
      : defId;
    const color = type ? `var(--${type})` : 'var(--text-primary)';
    return `<span class="choice-card-token inline-card-chip inline-card-chip-compact">`
      + `<span class="choice-card-name" style="color:${color};border-color:${color}">`
      + `${escapeHtml(name)}</span></span>`;
  };

  /** 效果文本 → HTML（与游戏 colorizeCardText 相同的处理顺序）。 */
  const colorize = (value, lang = 'zh') => {
    const text = String(value || '');
    let html = '';
    let index = 0;
    while (index < text.length) {
      const rest = text.slice(index);
      const iconMarker = rest.match(/^\[\[icon:([A-Za-z0-9_:-]+)\]\]/i);
      if (iconMarker) {
        const cls = (rules.iconClasses || {})[iconMarker[1]] || '';
        html += `<span class="card-token inline-icon-token${cls ? ` ${escapeHtml(cls)}` : ''}">`
          + `${renderIcon(iconMarker[1], iconMarker[1])}</span>`;
        index += iconMarker[0].length;
        continue;
      }
      const cardMarker = rest.match(/^\[\[card:([A-Za-z0-9_:-]+)(?:\|([^\]]*))?\]\]/i);
      if (cardMarker) {
        html += cardChipHtml(cardMarker[1], lang);
        index += cardMarker[0].length;
        continue;
      }
      let matched = null;
      for (const rule of compiled) {
        const m = rest.match(rule.re);
        if (m && m[0]) { matched = { cls: rule.cls, text: m[0] }; break; }
      }
      if (matched) {
        html += `<span class="card-token ${matched.cls}">${escapeHtml(matched.text)}`
          + `${renderIcon(tokenIconKey(matched.cls, matched.text), matched.text)}</span>`;
        index += matched.text.length;
        continue;
      }
      html += escapeHtml(text[index]);
      index += 1;
    }
    return html;
  };

  return { colorize, cardChipHtml, iconUrl, resolveCard, escapeHtml };
}
