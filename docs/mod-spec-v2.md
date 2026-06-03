# GTN Mod Spec v2

GTN Mod Spec v2 是 Garden of Thorn 荆棘花园 的正式模组包格式。

## 顶层结构

```json
{
  "format_version": 2,
  "manifest": {},
  "registries": {
    "cards": [],
    "tags": [],
    "statuses": [],
    "opening_events": [],
    "ui_components": []
  },
  "patches": [],
  "compatibility": [],
  "event_hooks": [],
  "editor": {
    "workspaces": {},
    "ui_layouts": {},
    "version": 1
  }
}
```

## Manifest

`manifest.id` 是模组命名空间。社区模组不能使用 `gtn`、`core`、`system`。

资源 ID 必须是：

```text
namespace:path
```

模组内部可以写短 ID，加载时会自动规范化为 `manifest.id:短ID`。

## Registry

支持注册：

- `cards`
- `tags`
- `statuses`
- `opening_events`
- `ui_components`

每个资源必须有 `id`，同一个模组内不能重复。

## Logic DSL

卡牌、状态、开局事件和事件钩子使用声明式 steps。

常用 op：

- `deal_damage`
- `heal`
- `draw_cards`
- `gain_e`
- `gain_m`
- `add_status`
- `remove_status`
- `set_status`
- `move_card`
- `create_card`
- `destroy_equipment`
- `if`
- `for_each`
- `request_ui`
- `log`

高级原子操作通过 v2 runtime 受控调用游戏引擎，不允许任意脚本执行。

## UI Schema

模组可以通过 `request_ui` 请求受控窗口。允许组件：

- `modal`
- `confirm`
- `select`
- `slider`
- `number`
- `card_picker`
- `equipment_picker`
- `player_picker`
- `text`

不允许模组提供任意 HTML、CSS 或 JavaScript。

## 社区模组限制

- 必须是 `format_version: 2`
- 必须通过 v2 校验器
- 不允许 `scripts`
- 不允许保留旧 v1 `effects/scripts` 运行逻辑
- 大小和资源数量受服务器限制
