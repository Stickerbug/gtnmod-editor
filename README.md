# GTN Mod Studio

GTN Mod Studio 是 Garden of Thorn 荆棘花园 的可视化模组编辑器。

当前编辑器只导出 GTN Mod Spec v2：

- `format_version: 2`
- `manifest`
- `registries.cards`
- `registries.tags`
- `registries.statuses`
- `registries.opening_events`
- `registries.ui_components`
- `event_hooks`
- `patches`
- `compatibility`
- `editor.workspaces`

旧 v1 `effects/scripts` 格式已废弃。社区模组不得包含任意 JS/Python/HTML/CSS 脚本，只能使用声明式 v2 DSL 和受控 UI schema。

## 开发

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://127.0.0.1:3000/
```

## 构建

```bash
npm run build
```

构建结果输出到 `dist/`。

## 本地缓存

编辑器每 30 秒自动保存一次草稿到浏览器 `localStorage`，键名为：

```text
gtn_mod_studio_autosave_v2
```

## 示例

`examples/VanillaCards.json` 是 v2 原版卡包示例。

## 规则文档

见 `docs/mod-spec-v2.md`。
