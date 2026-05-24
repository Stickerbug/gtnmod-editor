# Garden of Thorn Mod Format v1

格式版本 1 的目标是：旧模组仍能读取，新编辑器可以保存更原子化的脚本信息，游戏运行时只使用已经实现的效果，未知效果不会破坏原版卡牌。

## 顶层结构

```json
{
  "format_version": 1,
  "info": {
    "name": "ModName",
    "version": "1.0.0",
    "author": "Author",
    "description": "",
    "game_version": "*"
  },
  "variables": [],
  "cards": [],
  "events": [],
  "custom_statuses": [],
  "custom_tags": [],
  "scripts": {}
}
```

## 对象

- `variables`：变量定义。推荐字段：`id`、`name`、`scope`、`initial`、`desc`。
- `cards`：自定义卡牌。兼容旧格式字段：`id`、`name_cn`、`name_en`、`cost_e`、`cost_m`、`card_type`、`count`、`quality`、`description`、`effect_text`、`flags`、`effects`。
- `events`：自定义开局事件。兼容旧格式字段：`id`、`name_cn`、`name_en`、`desc`、`position`、`effects`、`params`。
- `custom_statuses`：自定义状态定义。
- `custom_tags`：自定义标签定义。
- `scripts`：编辑器保存的 Blockly XML 和生成效果，键为 `card:<id>`、`event:<id>`、`status:<id>`、`tag:<id>`。

## 目标语义

- `self`：自己。
- `teammate`：队友。1v1 中退化为自己。
- `friendly`：己方。1v1 中退化为自己，2v2 中表示己方集合。
- `enemy`：敌方。1v1 是对手，2v2 中默认取一个有效敌方目标。
- `all_enemies`：所有敌方玩家，主要用于 2v2。
- `both`：双方所有玩家。
- `random_friendly`、`random_enemy`、`random_player`、`random_side`：随机目标。

## 已支持的原子效果

- 控制：`if`、`if_else`、`repeat`、`repeat_until`、`for_each`、`random`。
- 变量：`var_set`、`var_add`、`var_sub`、`var_mul`、`var_div`。
- 批量变量：`batch_var_add`、`batch_var_sub`、`batch_var_mul`、`batch_var_div`。
- 状态和标签：`status_add_named`、`status_remove_named`、`tag_add_named`、`tag_remove_named`。
- 批量状态和标签：`batch_status_add`、`batch_status_remove`、`batch_tag_add`、`batch_tag_remove`。
- 常规效果：沿用游戏已有 `effects`，例如 `damage`、`heal`、`gain_e`、`draw`、`destroy_random_equip`、`fusion`、`fission` 等。

## 兼容规则

- 没有 `format_version` 的旧模组会在读取时按 v1 归一化。
- 旧的 `cards`、`events` 和 `effects` 字段保持可读。
- 自定义标签不会被验证器拒绝。
- 未知效果只作为兼容警告，不会导致模组被跳过。
