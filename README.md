# Garden of Thorn 模组编辑器

Garden of Thorn 模组编辑器是一个基于 Vite 和 Blockly 的可视化模组制作工具，用来编辑《荆棘花园》的卡牌、开局事件、状态、标签和变量，并导出游戏可读取的 JSON 模组文件。

编辑器支持在浏览器中开发调试，也可以通过 `pywebview` 作为本地桌面窗口运行。

## 功能

- 可视化编辑卡牌、开局事件、状态、标签和变量。
- 使用 Blockly 积木组合脚本效果，并实时生成 JSON 预览。
- 导入旧版或 v1 模组 JSON，导出兼容的 v1 模组 JSON。
- 支持常规效果、目标选择、变量、条件、循环、批量操作、自定义状态和自定义标签。
- 保存 Blockly XML 到 `scripts` 字段，便于后续重新打开继续编辑。

## 环境要求

- Node.js 18 或更高版本。
- Python 3.10 或更高版本。
- Windows 桌面运行建议安装 Microsoft Edge WebView2 Runtime。

前端依赖由 `package.json` 管理，Python 桌面壳依赖由 `requirements.txt` 管理。

## 安装

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

如果只需要在浏览器里开发和使用编辑器，可以只执行 `npm install`。

## 开发运行

```powershell
npm run dev
```

默认开发地址是 `http://localhost:3000`。Vite 会自动打开浏览器。

## 构建

```powershell
npm run build
```

构建输出会生成到 `dist/`。桌面版本会读取 `dist/index.html`，因此运行 `main.py` 前必须先完成构建。

## 桌面运行

```powershell
python main.py
```

桌面窗口标题为“荆棘花园 - 卡牌积木编辑器”。在 Windows 上，程序会优先使用 Edge Chromium 后端。

如果需要开启 pywebview 调试模式：

```powershell
python main.py --debug
```

## 可用命令

```powershell
npm run dev      # 启动 Vite 开发服务器
npm run build    # 构建静态资源到 dist/
npm run preview  # 预览 dist/ 构建结果
python main.py   # 启动桌面版编辑器
```

## 项目结构

```text
.
├── index.html              # 编辑器页面入口
├── style.css               # 编辑器样式
├── main.py                 # pywebview 桌面壳入口
├── package.json            # Node/Vite/Blockly 依赖和脚本
├── requirements.txt        # Python 桌面壳依赖
├── docs/
│   └── mod-format-v1.md    # 模组 JSON 格式说明
└── src/
    ├── main.js             # 前端入口，初始化 Blockly 和编辑器
    ├── app.js              # 模组编辑器状态、导入导出和属性面板
    ├── generator.js        # Blockly 脚本到效果 JSON 的生成逻辑
    ├── effectXml.js        # 效果 JSON 和 Blockly XML 的互转
    ├── toolbox.js          # Blockly 工具箱配置
    └── blocks/             # 自定义积木定义
```

## 模组格式

导出的模组 JSON 使用 `format_version: 1`。顶层结构包含：

- `info`：模组名称、版本、作者、描述和兼容游戏版本。
- `variables`：自定义变量。
- `cards`：自定义卡牌。
- `events`：自定义开局事件。
- `custom_statuses`：自定义状态。
- `custom_tags`：自定义标签。
- `scripts`：编辑器保存的 Blockly XML 和生成效果。

详细字段和兼容规则见 `docs/mod-format-v1.md`。

## 使用流程

1. 在左侧选择对象类型，例如卡牌、开局事件、状态、标签或变量。
2. 新增或选择一个对象，在右侧编辑基础属性。
3. 在中间 Blockly 画布中拖拽积木组合脚本。
4. 查看右侧 JSON 预览，确认生成效果。
5. 点击“导出 JSON”保存模组文件。
6. 下次可以用“导入 JSON”继续编辑。

## 常见问题

### 运行 `python main.py` 提示未找到构建输出

先执行：

```powershell
npm install
npm run build
python main.py
```

### 桌面窗口打不开或显示空白

确认已经安装 `requirements.txt` 中的 Python 依赖，并检查系统是否安装 Microsoft Edge WebView2 Runtime。

### 浏览器开发版能用，桌面版导入导出行为不同

浏览器版使用浏览器文件下载和 `<input type="file">` 导入。桌面壳预留了 pywebview 文件对话框 API，但当前前端主要走浏览器兼容的导入导出流程。

## 许可证

见 `LICENSE`。
