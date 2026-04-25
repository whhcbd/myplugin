# AhaTutor Plugin Framework

独立运行的 AhaTutor 学科插件框架，前端后端完全自包含，不依赖外部项目。

## 目录结构

```
hereisplugin/
├── plugins/                          # 所有插件存放目录
│   ├── _template/                    # 插件脚手架（复制即用）
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── manifest.json             # 空 manifest 模板
│   │   ├── manifest-prompt.md        # AI 生成 manifest 的提示词
│   │   └── src/index.ts              # 入口模板
│   ├── physics-high-school/          # 示例插件：高中物理
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # 导出 { components: { PhysicsOscillator } }
│   │   │   └── PhysicsOscillator.tsx  # 简谐运动模拟器（Canvas + 滑块）
│   │   ├── dist/
│   │   └── knowledge/
│   ├── genetics-dna/                 # 遗传学插件：DNA 结构可视化
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # 导出 { components: { DNAStructure } }
│   │   │   └── DNAStructure.tsx      # DNA 双链碱基配对可视化
│   │   └── dist/
│   └── genetics-punnett/             # 遗传学插件：孟德尔方格图
│       ├── manifest.json
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts              # 导出 { components: { PunnettSquare } }
│       │   └── PunnettSquare.tsx     # 孟德尔方格图（杂交后代基因型/表型）
│       └── dist/
│   ├── genetics-phenotype/           # 遗传学插件：表型分布柱状图
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # 导出 { components: { PhenotypeDistribution } }
│   │   │   └── PhenotypeDistribution.tsx  # 表型分布水平柱状图
│   │   └── dist/
│   ├── genetics-centraldogma/        # 遗传学插件：中心法则动画
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # 导出 { components: { CentralDogma } }
│   │   │   └── CentralDogma.tsx      # 中心法则（DNA复制→转录→翻译）动画
│   │   └── dist/
│       ├── genetics-flashcard/           # 遗传学插件：翻转记忆卡片
│       ├── manifest.json
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts              # 导出 { components: { Flashcard } }
│       │   └── Flashcard.tsx         # 点击翻转的记忆卡片（问题/答案）
│       └── dist/
│   └── genetics-crossover/           # 遗传学插件：交叉互换图谱
│       ├── manifest.json
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts              # 导出 { components: { CrossoverMap } }
│       │   └── CrossoverMap.tsx      # 染色体交叉互换图谱可视化
│       └── dist/
│
├── backend/                          # FastAPI 后端
│   ├── main.py                       # 入口，启动时扫描 plugins/ 目录
│   ├── requirements.txt
│   └── routes/
│       └── plugins.py                # REST API
│
└── frontend/                         # React + Vite 前端
    ├── index.html
    ├── package.json
    ├── vite.config.ts                # @plugins alias → ../plugins，代理 /api → 后端
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx                   # Gallery + Simulate Chat
        ├── types.ts                  # 类型定义
        ├── CatalogRegistry.ts        # 兼容导出
        ├── a2ui-engine/
        │   └── CatalogRegistry.ts    # 插件注册中心
        └── PluginLoader.ts           # 从后端拉 manifest，动态 import 组件
```

## 快速启动

### 0. 安装依赖（首次需要）

本项目使用 **pnpm workspace** 管理依赖，所有插件共享一个 node_modules，大幅提升性能和节省空间。

#### 安装 pnpm（如果还没有）

```powershell
npm install -g pnpm
```

#### 安装所有依赖

```powershell
# 在项目根目录运行
pnpm install
```

这会自动安装：
- 前端依赖
- 所有 11 个插件的依赖（共享）
- 总大小约 70MB（而不是 693MB）

#### 如果从旧版本迁移

如果你之前已经安装过依赖（每个插件都有独立的 node_modules），需要先清理：

```powershell
# 运行清理脚本
.\cleanup-old-node-modules.ps1

# 然后重新安装
pnpm install
```

### 1. 启动后端（端口 8000）

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

后端启动时会自动扫描 `plugins/` 下所有含 `manifest.json` 的子目录并加载。
以下划线开头的目录（如 `plugins/_template`）会被忽略，不会当作真实插件加载。

**启动成功标志**：
```
INFO: Loaded plugin 'physics-high-school' (高中物理插件)
INFO: Loaded plugin 'genetics-dna' (DNA结构可视化插件)
INFO: Loaded plugin 'genetics-punnett' (孟德尔方格图插件)
... (共11个插件)
INFO: Plugin backend started — 11 plugin(s) found in ...
INFO: Uvicorn running on http://127.0.0.1:8000
```

### 2. 构建插件（首次需要）

使用 pnpm workspace，一条命令构建所有插件：

```powershell
# 在项目根目录运行
pnpm run build:plugins
```

这会自动构建所有 11 个插件，生成 `dist/index.esm.js`。

如果需要单独构建某个插件：

```powershell
# 构建单个插件
pnpm --filter genetics-punnett run build

# 或者进入插件目录
cd plugins/genetics-punnett
pnpm run build
```

### 3. 启动前端（端口 5173）

```powershell
# 在项目根目录运行
pnpm run dev:frontend

# 或者使用传统方式
cd frontend
pnpm run dev
```

前端 dev server 会自动将 `/api` 请求代理到后端 `http://127.0.0.1:8000`。

**启动成功标志**：
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4. 访问

| 页面 | URL | 说明 |
|------|-----|------|
| Gallery + Chat | http://localhost:5173 | 两个 Tab 切换 |
| 纯 Gallery | http://localhost:5173/?gallery=1 | 只展示组件预览 |
| 后端健康检查 | http://localhost:8000/api/v1/health | 返回 `{"status":"ok"}` |
| 插件列表 API | http://localhost:8000/api/v1/plugins | 返回所有 manifest |

## 创建新插件

1. 复制脚手架：

```powershell
Copy-Item -Recurse plugins/_template plugins/my-new-plugin
```

2. 编辑 `manifest.json` — 填写 `id`、`subject`、`name`、`keywords`、`capabilities`

3. 在 `src/` 下编写 React 组件，接口必须为：

```tsx
interface A2UINode { properties?: Record<string, unknown> }

export default function MyComponent({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  // ...
}
```

4. 在 `src/index.ts` 中导出：

```ts
import { MyComponent } from "./MyComponent";
export default { components: { MyComponent } };
```

5. 构建并注册：

```powershell
# 构建新插件（在项目根目录）
pnpm --filter my-new-plugin run build

# 或者构建所有插件
pnpm run build:plugins
```

然后在前端 `src/a2ui-engine/CatalogRegistry.ts` 的 `pluginModules` 中添加一行：

```ts
const pluginModules: Record<string, () => Promise<PluginModule>> = {
  "physics-high-school": () =>
    import("@plugins/physics-high-school/src/index").then(m => m as unknown as PluginModule),
  "genetics-dna": () =>
    import("@plugins/genetics-dna/src/index").then(m => m as unknown as PluginModule),
  "genetics-punnett": () =>
    import("@plugins/genetics-punnett/src/index").then(m => m as unknown as PluginModule),
  "my-new-plugin": () =>
    import("@plugins/my-new-plugin/src/index").then(m => m as unknown as PluginModule),
};
```

重启前后端即可看到新插件。

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/plugins` | 列出所有插件的完整 manifest |
| GET | `/api/v1/plugins/{plugin_id}` | 获取单个插件 manifest |
| GET | `/api/v1/plugins/{plugin_id}/capabilities` | 获取插件的 capabilities 数组 |

## 前端页面说明

### Gallery 页面

遍历所有已注册插件的 `props_schema`，用每个参数的 `default` 值生成预览节点，渲染出组件实例。

### Simulate Chat 页面

提供一个 JSON 输入框，模拟 LLM 通过 A2UI 调用插件组件的过程。输入格式：

```json
{
  "pluginId": "physics-high-school",
  "componentId": "PhysicsOscillator",
  "properties": {
    "amplitude": 3,
    "freq": 2,
    "phase": 0
  }
}
```

点击 Render 后，前端会动态加载对应组件并渲染。

## 已有插件一览

| 插件 ID | 学科 | 组件 | 说明 |
|---------|------|------|------|
| `physics-high-school` | 物理 | `PhysicsOscillator` | 简谐运动波形模拟器，Canvas 动画 + 振幅/频率/相位滑块 |
| `genetics-dna` | 遗传 | `DNAStructure` | DNA 双链碱基配对可视化，点击查看氢键详情，GC 含量统计 |
| `genetics-punnett` | 遗传 | `PunnettSquare` | 孟德尔方格图，支持单/多因子杂交，表型比例分析，模拟实验 |
| `genetics-phenotype` | 遗传 | `PhenotypeDistribution` | 表型分布水平柱状图，带动画条、筛选控件和点击详情 |
| `genetics-centraldogma` | 遗传 | `CentralDogma` | 中心法则动画演示（DNA复制→转录→翻译），碱基着色+密码子表 |
| `genetics-flashcard` | 遗传 | `Flashcard` | 翻转记忆卡片，CSS 3D 翻转动画，正面问题/背面答案 |
| `genetics-pedigree` | 遗传 | `PedigreeChart` | 标准遗传学家系图，方形/圆形符号，SVG连线，缩放平移，点击查看详情 |
| `genetics-expression` | 遗传 | `GeneExpression` | 基因表达水平可视化，条形图/折线图切换，交互滑块，lac操纵子模拟 |
| `genetics-mendel` | 遗传 | `MendelSimulator` | 孟德尔实验模拟器，随机受精模拟，实际vs理论分组柱状图，卡方检验 |
| `genetics-naturalselection` | 遗传 | `NaturalSelectionSimulator` | 自然选择模拟器，2D种群分布Canvas，等位基因频率折线图，选择压力调节 |
| `genetics-crossover` | 遗传 | `CrossoverMap` | 染色体交叉互换图谱，基因位点标注，着丝粒/带型显示，重组频率计算，点击查看详情 |

### Simulate Chat 示例

```json
{
  "pluginId": "genetics-dna",
  "componentId": "DNAStructure",
  "properties": {
    "sequence": "ATCGATCGAATT",
    "showLabels": true,
    "interactive": true
  }
}
```

```json
{
  "pluginId": "genetics-punnett",
  "componentId": "PunnettSquare",
  "properties": {
    "parent1Genotype": "AaBb",
    "parent2Genotype": "AaBb",
    "trait": "豌豆颜色和形状",
    "showPhenotype": true,
    "interactive": true
  }
}
```

## 技术栈

- **后端**: Python 3.10+ / FastAPI / Uvicorn
- **前端**: React 18 / TypeScript / Vite 5
- **插件**: React 组件 / Vite ESM 构建 / 无外部依赖（React 除外）
- **包管理**: pnpm workspace（共享依赖，节省空间和提升性能）

## 性能优化

本项目使用 **pnpm workspace** 架构：

| 对比项 | 传统方式（每个插件独立 node_modules） | pnpm workspace |
|--------|-----------------------------------|----------------|
| 磁盘占用 | ~693MB（11个插件 × 63MB） | ~70MB |
| 安装速度 | 慢（需要安装11次） | 快（只安装一次） |
| 启动速度 | 慢（Vite扫描多个node_modules） | 快（只扫描一个） |
| 热更新 | 慢 | 快 |

**空间节省**: 90% ↓  
**速度提升**: 5-10x ↑

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

## 📖 完整使用指南

### 使用方式

系统提供了 **2 种使用方式**：

#### 方式 A：Gallery 模式（组件预览）

**访问**：http://localhost:5173/?gallery=1

**功能**：
- 自动展示所有 11 个插件的组件预览
- 每个组件使用 manifest.json 中定义的默认参数渲染
- 可以直观看到所有组件的外观和交互效果

**适合场景**：
- 快速浏览所有可用组件
- 测试组件是否正常工作
- 展示给用户看有哪些可视化工具

---

#### 方式 B：Simulate Chat 模式（模拟 LLM 调用）

**访问**：http://localhost:5173（默认页面，切换到 "Simulate Chat" Tab）

**功能**：
- 模拟 LLM 通过 A2UI 协议调用插件
- 输入 JSON 格式的调用指令
- 动态渲染指定的组件

**使用步骤**：

1. **在输入框中输入 JSON 指令**：

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

2. **点击 "Render" 按钮**

3. **组件会立即渲染在下方**，显示 Aa × Aa 杂交的孟德尔方格图

---

### 插件触发机制

#### 🔄 完整工作流程

```
用户输入 JSON
    ↓
前端解析 JSON
    ↓
前端调用 CatalogRegistry.loadComponent(pluginId, componentId)
    ↓
动态 import 插件代码：import("@plugins/genetics-punnett/src/index")
    ↓
获取组件：module.default.components[componentId]
    ↓
React 渲染组件：<PunnettSquare node={{ properties: {...} }} />
    ↓
组件从 node.properties 读取参数
    ↓
组件渲染可视化内容
```

#### 📡 后端的作用

后端主要提供 **插件元数据 API**：

| API 端点 | 作用 |
|---------|------|
| `GET /api/v1/plugins` | 返回所有插件的 manifest.json |
| `GET /api/v1/plugins/{plugin_id}` | 返回单个插件的 manifest.json |
| `GET /api/v1/plugins/{plugin_id}/capabilities` | 返回插件的能力描述 |

**在真实的 LLM 对话系统中**：
1. LLM 启动时调用 `/api/v1/plugins` 获取所有插件信息
2. LLM 根据 manifest.json 中的 `keywords`、`tags`、`a2ui_hint` 决定何时调用哪个插件
3. LLM 输出 A2UI JSONL 格式的消息，包含 pluginId、componentId 和 properties
4. 前端解析 A2UI 消息，动态加载并渲染组件

---

### 实际操作示例

#### 示例 1：展示 DNA 结构

**JSON 输入**：
```json
{
  "pluginId": "genetics-dna",
  "componentId": "DNAStructure",
  "properties": {
    "sequence": "ATCGATCGAATT",
    "showLabels": true,
    "interactive": true
  }
}
```

**效果**：
- 显示 DNA 双链结构
- 上链：A-T-C-G-A-T-C-G-A-A-T-T
- 下链：T-A-G-C-T-A-G-C-T-T-A-A（自动互补配对）
- 点击碱基可以查看氢键数量
- 显示 GC 含量统计

---

#### 示例 2：孟德尔双因子杂交

**JSON 输入**：
```json
{
  "pluginId": "genetics-punnett",
  "componentId": "PunnettSquare",
  "properties": {
    "parent1Genotype": "AaBb",
    "parent2Genotype": "AaBb",
    "trait": "豌豆颜色和形状",
    "showPhenotype": true,
    "interactive": true
  }
}
```

**效果**：
- 显示 4×4 的孟德尔方格图
- 自动计算 16 种后代基因型
- 显示表型比例：9:3:3:1
- 点击格子查看详细基因型
- 可以运行模拟实验验证比例

---

#### 示例 3：简谐运动模拟

**JSON 输入**：
```json
{
  "pluginId": "physics-high-school",
  "componentId": "PhysicsOscillator",
  "properties": {
    "amplitude": 5,
    "freq": 2,
    "phase": 0,
    "interactive": true
  }
}
```

**效果**：
- 显示振幅为 5、频率为 2 Hz 的简谐运动波形
- Canvas 动画实时绘制
- 内置滑块可以调节振幅、频率、相位
- 显示弹簧-质点系统动画

---

#### 示例 4：中心法则动画

**JSON 输入**：
```json
{
  "pluginId": "genetics-centraldogma",
  "componentId": "CentralDogma",
  "properties": {
    "dnaSequence": "ATGATCGAT",
    "animationSpeed": 800
  }
}
```

**效果**：
- 演示 DNA 复制过程
- 演示转录（DNA → mRNA）
- 演示翻译（mRNA → 蛋白质）
- 显示密码子到氨基酸的对应关系
- 可以切换阶段、播放/暂停/重置

---

### 所有可用插件速查表

| 插件 ID | 组件 ID | 用途 | 关键参数 |
|---------|---------|------|---------|
| `physics-high-school` | `PhysicsOscillator` | 简谐运动 | amplitude, freq, phase |
| `genetics-dna` | `DNAStructure` | DNA结构 | sequence, showLabels |
| `genetics-punnett` | `PunnettSquare` | 孟德尔方格图 | parent1Genotype, parent2Genotype |
| `genetics-centraldogma` | `CentralDogma` | 中心法则 | dnaSequence, animationSpeed |
| `genetics-crossover` | `CrossoverMap` | 交叉互换 | chromosomeId, genes, crossoverPoints |
| `genetics-expression` | `GeneExpression` | 基因表达 | genes (数组) |
| `genetics-flashcard` | `Flashcard` | 翻转卡片 | front, back |
| `genetics-mendel` | `MendelSimulator` | 孟德尔实验 | parent1, parent2, sampleSize |
| `genetics-naturalselection` | `NaturalSelectionSimulator` | 自然选择 | populationSize, selectionPressure |
| `genetics-pedigree` | `PedigreeChart` | 家系图 | individuals (数组) |
| `genetics-phenotype` | `PhenotypeDistribution` | 表型分布 | phenotypes (数组) |

---

### 快速测试命令

```powershell
# 测试后端是否正常
curl http://localhost:8000/api/v1/health
# 应返回：{"status":"ok"}

# 获取所有插件列表
curl http://localhost:8000/api/v1/plugins
# 应返回：包含 11 个插件的 JSON 数组

# 获取单个插件信息
curl http://localhost:8000/api/v1/plugins/genetics-punnett
# 应返回：genetics-punnett 的完整 manifest.json
```

---

### 常见问题

**Q: 前端显示空白？**
- 检查后端是否启动（访问 http://localhost:8000/api/v1/health）
- 检查浏览器控制台是否有错误
- 确认所有插件都已构建（dist/index.esm.js 存在）

**Q: 组件不显示？**
- 检查 JSON 格式是否正确
- 检查 pluginId 和 componentId 是否匹配
- 查看浏览器控制台错误信息

**Q: 如何添加新插件？**
- 参考下方"创建新插件"章节
- 复制 `_template` 目录
- 编写组件、构建、注册到 CatalogRegistry.ts

---
