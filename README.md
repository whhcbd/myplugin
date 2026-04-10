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

### 1. 启动后端（端口 8000）

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

后端启动时会自动扫描 `plugins/` 下所有含 `manifest.json` 的子目录并加载。
以下划线开头的目录（如 `plugins/_template`）会被忽略，不会当作真实插件加载。

### 2. 构建插件（首次需要）

所有插件需要分别构建：

```powershell
# 物理插件
cd plugins/physics-high-school
npm install
npm run build

# DNA 结构插件
cd plugins/genetics-dna
npm install
npm run build

# 孟德尔方格图插件
cd plugins/genetics-punnett
npm install
npm run build

# 表型分布插件
cd plugins/genetics-phenotype
npm install
npm run build

# 中心法则插件
cd plugins/genetics-centraldogma
npm install
npm run build

# 翻转卡片插件
cd plugins/genetics-flashcard
npm install
npm run build

# 家系图插件
cd plugins/genetics-pedigree
npm install
npm run build

# 基因表达水平插件
cd plugins/genetics-expression
npm install
npm run build

# 孟德尔实验模拟器插件
cd plugins/genetics-mendel
npm install
npm run build

# 自然选择模拟器插件
cd plugins/genetics-naturalselection
npm install
npm run build

# 交叉互换图谱插件
cd plugins/genetics-crossover
npm install
npm run build
```

### 3. 启动前端（端口 5173）

```powershell
cd frontend
npm install
npm run dev
```

前端 dev server 会自动将 `/api` 请求代理到后端 `http://127.0.0.1:8000`。

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
cd plugins/my-new-plugin
npm install
npm run build
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
