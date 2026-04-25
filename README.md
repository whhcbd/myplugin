# AhaTutor Plugin Framework

独立运行的 AhaTutor 学科插件框架，前端后端完全自包含，不依赖外部项目。

使用 **pnpm workspace** 管理依赖，所有插件共享一个 `node_modules`，磁盘占用 ~70MB。

---

## 目录结构

```
hereisplugin/
├── .gitignore
├── .npmrc                         # pnpm 配置
├── package.json                   # workspace 根 package.json
├── pnpm-workspace.yaml            # pnpm workspace 定义
├── pnpm-lock.yaml                 # 统一锁文件
├── cleanup-old-node-modules.ps1   # 清理残留 node_modules 的脚本
├── plugin-development-guide.md    # 插件开发指南
│
├── node_modules/                  # pnpm 共享依赖（唯一的 node_modules）
│
├── plugins/                       # 所有插件存放目录
│   ├── _template/                 # 插件脚手架（复制即用，后端会跳过 _ 开头的目录）
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── manifest.json
│   │   ├── manifest-prompt.md
│   │   └── src/index.ts
│   ├── physics-high-school/       # 高中物理：简谐运动模拟器
│   ├── genetics-dna/              # DNA 双链碱基配对可视化
│   ├── genetics-punnett/          # 孟德尔方格图
│   ├── genetics-phenotype/        # 表型分布柱状图
│   ├── genetics-centraldogma/     # 中心法则动画
│   ├── genetics-flashcard/        # 翻转记忆卡片
│   ├── genetics-pedigree/         # 家系图
│   ├── genetics-expression/       # 基因表达水平可视化
│   ├── genetics-mendel/           # 孟德尔实验模拟器
│   ├── genetics-naturalselection/ # 自然选择模拟器
│   └── genetics-crossover/        # 染色体交叉互换图谱
│
├── backend/                       # FastAPI 后端
│   ├── main.py                    # 入口（lifespan 启动，扫描 plugins/ 目录）
│   ├── requirements.txt
│   └── routes/plugins.py          # REST API
│
└── frontend/                      # React + Vite 前端
    ├── index.html
    ├── package.json
    ├── vite.config.ts             # @plugins alias + API 代理 + watch 排除
    ├── tsconfig.json              # TypeScript 配置，含 @plugins 路径映射
    └── src/
        ├── main.tsx
        ├── App.tsx                # Gallery + Simulate Chat 双 Tab
        ├── types.ts               # 类型定义（A2UINode, PluginManifest, Capability 等）
        ├── CatalogRegistry.ts     # 兼容导出
        ├── PluginLoader.ts        # 从后端拉 manifest，注册组件
        └── a2ui-engine/
            └── CatalogRegistry.ts # 插件注册中心（11 个插件的动态 import）
```

每个插件的标准结构：

```
plugins/<plugin-id>/
├── manifest.json       # 插件描述（后端读取，告诉 LLM 这个插件能做什么）
├── package.json        # 构建配置
├── vite.config.ts      # Vite ESM 构建，React external
├── tsconfig.json
├── src/
│   ├── index.ts        # 入口：export default { components: { ... } }
│   └── MyComponent.tsx # React 组件，接收 { node: A2UINode } prop
└── dist/               # 构建产物（npm run build 生成）
    └── index.esm.js
```

---

## 快速启动

### 前置条件

- **Node.js** 18+ 和 **pnpm**（`npm install -g pnpm`）
- **Python** 3.10+

### 1. 安装依赖

```powershell
pnpm install
```

所有插件和前端的依赖统一安装到根目录 `node_modules`，约 70MB。

### 2. 构建插件

```powershell
# 构建所有插件
pnpm run build:plugins

# 或单独构建某个插件
pnpm --filter genetics-punnett run build
```

### 3. 启动后端（端口 8000）

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

后端使用 `lifespan` 在启动时自动扫描 `plugins/` 下所有含 `manifest.json` 的子目录。下划线开头的目录（如 `_template`）会被跳过。

启动成功日志：
```
INFO: Loaded plugin 'physics-high-school' (高中物理插件)
INFO: Loaded plugin 'genetics-dna' (DNA结构可视化插件)
...
INFO: Plugin backend started — 11 plugin(s) found in ...
INFO: Uvicorn running on http://127.0.0.1:8000
```

### 4. 启动前端（端口 5173）

```powershell
pnpm run dev:frontend
```

前端 dev server 自动将 `/api` 请求代理到后端 `http://127.0.0.1:8000`。

### 5. 访问

| 页面 | URL | 说明 |
|------|-----|------|
| Gallery + Chat | http://localhost:5173 | 两个 Tab 切换 |
| 纯 Gallery | http://localhost:5173/?gallery=1 | 只展示组件预览 |
| 后端健康检查 | http://localhost:8000/api/v1/health | 返回 `{"status":"ok"}` |
| 插件列表 API | http://localhost:8000/api/v1/plugins | 返回所有 manifest |

---

## 已有插件一览（共 11 个）

| 插件 ID | 学科 | 组件 | 说明 |
|---------|------|------|------|
| `physics-high-school` | 物理 | `PhysicsOscillator` | 简谐运动波形模拟器，Canvas 动画 + 振幅/频率/相位滑块 |
| `genetics-dna` | 遗传 | `DNAStructure` | DNA 双链碱基配对可视化，点击查看氢键详情，GC 含量统计 |
| `genetics-punnett` | 遗传 | `PunnettSquare` | 孟德尔方格图，支持单/多因子杂交，表型比例分析，模拟实验 |
| `genetics-phenotype` | 遗传 | `PhenotypeDistribution` | 表型分布水平柱状图，带动画条、筛选控件和点击详情 |
| `genetics-centraldogma` | 遗传 | `CentralDogma` | 中心法则动画演示（DNA复制→转录→翻译），碱基着色+密码子表 |
| `genetics-flashcard` | 遗传 | `Flashcard` | 翻转记忆卡片，CSS 3D 翻转动画，正面问题/背面答案 |
| `genetics-pedigree` | 遗传 | `PedigreeChart` | 标准遗传学家系图，方形/圆形符号，SVG连线，缩放平移，点击详情 |
| `genetics-expression` | 遗传 | `GeneExpression` | 基因表达水平可视化，条形图/折线图切换，交互滑块，lac操纵子模拟 |
| `genetics-mendel` | 遗传 | `MendelSimulator` | 孟德尔实验模拟器，随机受精模拟，实际vs理论分组柱状图，卡方检验 |
| `genetics-naturalselection` | 遗传 | `NaturalSelectionSimulator` | 自然选择模拟器，2D种群分布Canvas，等位基因频率折线图，选择压力调节 |
| `genetics-crossover` | 遗传 | `CrossoverMap` | 染色体交叉互换图谱，基因位点标注，着丝粒/带型显示，重组频率计算 |

---

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/plugins` | 列出所有插件的完整 manifest |
| GET | `/api/v1/plugins/{plugin_id}` | 获取单个插件 manifest |
| GET | `/api/v1/plugins/{plugin_id}/capabilities` | 获取插件的 capabilities 数组 |

---

## 前端架构

### 工作流程

```
用户输入 JSON（Simulate Chat）或自动加载（Gallery）
    ↓
前端从后端 GET /api/v1/plugins 获取所有 manifest
    ↓
调用 registerPluginsFromManifests() 注册插件
    ↓
动态 import：import("@plugins/<plugin-id>/src/index")
    ↓
获取组件：module.default.components[componentId]
    ↓
React 渲染：<MyComponent node={{ properties: {...} }} />
```

### Gallery 模式

遍历所有已注册插件的 `props_schema`，用每个参数的 `default` 值生成预览节点，渲染出组件实例。

### Simulate Chat 模式

提供 JSON 输入框，模拟 LLM 通过 A2UI 调用插件组件。输入格式示例：

```json
{
  "pluginId": "genetics-punnett",
  "componentId": "PunnettSquare",
  "properties": {
    "parent1Genotype": "Aa",
    "parent2Genotype": "Aa",
    "trait": "豌豆颜色",
    "showPhenotype": true,
    "interactive": true
  }
}
```

---

## 创建新插件

1. **复制脚手架**：

```powershell
Copy-Item -Recurse plugins/_template plugins/my-new-plugin
```

2. **编辑 `manifest.json`** — 填写 `id`、`subject`、`name`、`keywords`、`capabilities`

3. **在 `src/` 下编写 React 组件**，接口必须为：

```tsx
interface A2UINode { properties?: Record<string, unknown> }

export default function MyComponent({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
}
```

4. **编辑 `src/index.ts` 导出**：

```ts
import { MyComponent } from "./MyComponent";
export default { components: { MyComponent } };
```

5. **构建**：

```powershell
pnpm --filter my-new-plugin run build
```

6. **注册到前端** — 编辑 `frontend/src/a2ui-engine/CatalogRegistry.ts`：

```ts
"my-new-plugin": () =>
  import("@plugins/my-new-plugin/src/index").then(m => m as unknown as PluginModule),
```

7. 重启前后端即可看到新插件。

---

## 常用命令速查

```powershell
# 安装所有依赖
pnpm install

# 构建所有插件
pnpm run build:plugins

# 构建前端
pnpm run build:frontend

# 全部构建
pnpm run build:all

# 启动前端开发服务器
pnpm run dev:frontend

# 启动后端（另一个终端）
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 清理所有 node_modules
pnpm run clean:node_modules

# 清理所有 dist
pnpm run clean:dist
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.10+ / FastAPI / Uvicorn |
| 前端 | React 18 / TypeScript / Vite 5 |
| 插件 | React 组件 / Vite ESM 构建 / 无外部依赖（React 除外） |
| 包管理 | pnpm workspace（共享依赖，约 70MB） |

## 设计规范

插件组件样式应遵循以下规范：

| 项目 | 值 |
|------|-----|
| 背景色 | `#faf9f5` |
| 文字色 | `#1b1c1a` |
| 主色 | `#182544` |
| 强调色 | `#775a19` |
| 圆角 | `12px` |
| 字体 | Manrope, sans-serif |

---

## 常见问题

**Q: 前端显示空白？**
- 检查后端是否启动（访问 http://localhost:8000/api/v1/health）
- 检查浏览器控制台是否有错误
- 确认所有插件都已构建（各插件 `dist/index.esm.js` 存在）

**Q: 组件不显示？**
- 检查 JSON 格式是否正确（Simulate Chat 模式）
- 检查 `pluginId` 和 `componentId` 是否与 manifest 一致
- 查看浏览器 F12 控制台错误信息

**Q: LLM 不调用我的组件？**
- 检查 `manifest.json` 的 `tags` 是否包含相关学科关键词
- 检查 `a2ui_hint` 是否清晰说明了组件的适用场景
- 确认前端 `CatalogRegistry.ts` 中已注册

**Q: 磁盘占用太大？**
- 确保已运行 `.\cleanup-old-node-modules.ps1` 清理残留的独立 `node_modules`
- 项目只应有一个根目录 `node_modules`（pnpm 共享），插件目录下不应有 `node_modules`

**Q: 如何从旧版本迁移？**
```powershell
.\cleanup-old-node-modules.ps1
pnpm install
```
