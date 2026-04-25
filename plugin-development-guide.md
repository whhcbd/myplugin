按这个文档重建你们的学科组件（注意：只要组件，先不要知识库，纯前端实现），重点看文档的11和14，最终重建完要给我的是11里面显示的那个文件结构，这作为一个完整的插件，添加到插件里组件要求是流程跑通，功能能完善的。先给我含有一两个组件的插件就行，不要一次性把你之前实现过的组件全部重建到插件里，我这边要测试插件的移植性

# AhaTutor 插件开发指南

> 本指南覆盖为 AhaTutor 创建学科插件的完整流程。提供两条路径：
>
> - **路径 A**（第 3-10 节）：从零创建插件
> - **路径 B**（第 14 节）：从已有实现（GitHub 项目、CodePen、D3 图表等）改造为插件
>
> 即使你是前端新手，按照步骤操作 + 借助 AI 提示词模板也能完成。

---

## 目录

**两条路径**：

- **路径 A**（第 3-10 节）：从零创建插件
- **路径 B**（第 14 节）：从已有实现改造为插件

1. [插件是什么](#1-插件是什么)
2. [前置准备](#2-前置准备)
3. [Step 1：从脚手架创建插件目录](#3-step-1从脚手架创建插件目录)
4. [Step 2：开发 React 组件](#4-step-2开发-react-组件)
5. [Step 3：配置入口文件](#5-step-3配置入口文件)
6. [Step 4：编写 manifest.json](#6-step-4编写-manifestjson)
7. [Step 5：构建插件](#7-step-5构建插件)
8. [Step 6：注册到前端](#8-step-6注册到前端)
9. [Step 7：准备知识库（可选）](#9-step-7准备知识库可选)
10. [Step 8：端到端验证](#10-step-8端到端验证)
11. [完整示例参考：physics-high-school](#11-完整示例参考physics-high-school)
12. [AI 辅助提示词模板（路径 A：从零创建）](#12-ai-辅助提示词模板路径-a从零创建)
13. [常见问题](#13-常见问题)
14. [路径 B：从已有实现创建插件](#14-路径-b从已有实现创建插件)

---

## 1. 插件是什么

AhaTutor 的插件是一个**可交互的 React 组件**，由 LLM 在对话中按需调用。例如：

- 学生问「给我展示一个振幅为 3 的简谐运动」
- LLM 识别到需要 `PhysicsOscillator` 组件
- LLM 输出 A2UI JSONL 消息，前端渲染出波形动画

插件的核心组成：

```
plugins/<plugin-id>/
├── manifest.json          # 插件描述文件（后端读取，告诉 LLM 这个插件能做什么）
├── package.json           # 构建配置
├── vite.config.ts         # Vite 构建配置（ESM 输出）
├── tsconfig.json          # TypeScript 配置
├── src/
│   ├── index.ts           # 入口：导出 { components: { ... } }
│   └── MyComponent.tsx    # 你的 React 组件
├── dist/                  # 构建产物（npm run build 生成）
│   └── index.esm.js
└── knowledge/             # 知识库（可选）
    └── vector.db
```

### 关键概念

| 概念            | 说明                                                |
| --------------- | --------------------------------------------------- |
| `plugin-id`     | 插件唯一标识，如 `chemistry-high-school`            |
| `component_id`  | 组件标识，PascalCase，如 `ChemistryMolecule`        |
| `manifest.json` | 告诉后端和 LLM 这个插件的存在和能力                 |
| `props`         | LLM 传给组件的参数，通过 `node.properties` 接收     |
| `capabilities`  | manifest 中描述组件能力的字段，LLM 据此决定是否调用 |

---

## 2. 前置准备

确保你已安装：

- **Node.js** 18+ 和 **npm**
- 项目已克隆到本地，`plugins/` 目录存在

无需额外安装依赖——插件的依赖在插件自己的 `package.json` 中管理。

---

## 3. Step 1：从脚手架创建插件目录

项目提供了 `_template` 脚手架，复制它即可开始：

```bash
# 将 _template 复制为你的插件目录
cp -r plugins/_template plugins/chemistry-high-school
cd plugins/chemistry-high-school
```

脚手架已包含预配置的：

- `vite.config.ts` — ESM 输出，React external
- `package.json` — 构建脚本
- `tsconfig.json` — TypeScript 配置
- `src/index.ts` — 入口模板
- `manifest.json` — 空 manifest 模板
- `manifest-prompt.md` — AI 生成 manifest 的提示词

### 安装依赖

```bash
cd plugins/chemistry-high-school
npm install
```

---

## 4. Step 2：开发 React 组件

### 4.1 理解组件接口

你的组件会通过 A2UI 渲染管线加载，接收一个固定的 `node` prop：

```typescript
interface A2UINode {
  properties?: Record<string, unknown>;
}

function MyComponent({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  // props 中包含 LLM 传入的参数
}
```

**重要规则**：

1. 组件**必须**接受 `{ node }` 作为 prop
2. 参数通过 `node.properties` 获取（不是直接 props）
3. 所有数值参数都应提供默认值（LLM 可能不传）
4. 样式写在组件内部（inline style 或内联 `<style>`），不要用 CSS Modules

### 4.2 编写组件

创建 `src/MyComponent.tsx`，例如一个化学分子可视化组件：

```tsx
import { useEffect, useRef, useState } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function ChemistryMolecule({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  // 从 LLM 传入的 properties 中获取参数，带默认值
  const initTemp = parseNum(props.temperature, 25);
  const initPressure = parseNum(props.pressure, 1);

  const [temperature, setTemperature] = useState(initTemp);
  const [pressure, setPressure] = useState(initPressure);

  // 当 LLM 发送新消息更新 props 时同步
  useEffect(() => {
    setTemperature(initTemp);
  }, [initTemp]);
  useEffect(() => {
    setPressure(initPressure);
  }, [initPressure]);

  // ... 你的渲染逻辑 ...

  return (
    <div style={{ background: "#faf9f5", borderRadius: 12, padding: 12 }}>
      {/* 你的组件内容 */}
    </div>
  );
}
```

### 4.3 组件编写要点

| 要点                 | 说明                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| 接收 `node` prop     | 这是 A2UI 的标准接口，不能改                                           |
| `parseNum` 辅助函数  | 安全地将 properties 值转为数字                                         |
| `useEffect` 同步     | 当 LLM 在新消息中更新参数时，组件需要响应                              |
| 内置控件 vs 外部控件 | 如果组件自带滑动条/按钮，在 `a2ui_hint` 中告知 LLM 不要重复创建        |
| 样式使用项目设计规范 | 背景色 `#faf9f5`，文字色 `#1b1c1a`，圆角 12px，字体 Manrope/Newsreader |

---

## 5. Step 3：配置入口文件

编辑 `src/index.ts`，导出你的组件：

```typescript
import { ChemistryMolecule } from "./ChemistryMolecule";

export default {
  components: {
    ChemistryMolecule,
  },
};
```

**规则**：

- `export default` 一个对象，包含 `components` 字段
- `components` 的 key 必须与组件名（`component_id`）完全一致
- 一个插件可以有多个组件

如果插件有多个组件：

```typescript
import { ChemistryMolecule } from "./ChemistryMolecule";
import { PeriodicTable } from "./PeriodicTable";

export default {
  components: {
    ChemistryMolecule,
    PeriodicTable,
  },
};
```

---

## 6. Step 4：编写 manifest.json

manifest.json 是插件的核心描述文件，告诉后端和 LLM 这个插件的存在和能力。

### 4.1 基本结构

```json
{
  "id": "chemistry-high-school",
  "version": "1.0.0",
  "subject": "chemistry",
  "name": "高中化学插件",
  "keywords": ["化学", "分子", "化学键", "反应", "元素周期表"],
  "entry": {
    "js": "dist/index.esm.js",
    "vector_db": "knowledge/vector.db"
  },
  "capabilities": []
}
```

| 字段              | 说明                                                |
| ----------------- | --------------------------------------------------- |
| `id`              | 插件唯一标识，与目录名一致，kebab-case              |
| `version`         | 语义化版本号                                        |
| `subject`         | 学科分类（physics / chemistry / math / biology 等） |
| `name`            | 中文显示名称                                        |
| `keywords`        | 关键词数组，用于意图路由匹配                        |
| `entry.js`        | 构建产物路径（固定为 `dist/index.esm.js`）          |
| `entry.vector_db` | 知识库路径（可选）                                  |
| `capabilities`    | 组件能力描述数组（见下文）                          |

### 4.2 capabilities 字段

每个组件对应一个 capability 对象：

```json
{
  "component_id": "ChemistryMolecule",
  "name": "分子结构可视化",
  "tags": ["分子", "化学键", "结构", "3D"],
  "props_schema": {
    "temperature": {
      "type": "number",
      "default": 25,
      "min": -50,
      "max": 500,
      "description": "温度（°C），影响分子运动速率"
    }
  },
  "a2ui_hint": "ChemistryMolecule 组件已内置温度控制滑块，不需要额外生成 Slider。只需通过 properties 传入初始 temperature 值即可。",
  "expresses": ["分子结构", "化学键类型", "分子运动"],
  "educational_use": "可视化分子结构，理解共价键和离子键的区别",
  "cannot_express": ["化学反应过程", "电子轨道", "量子力学模型"]
}
```

各字段详解：

| 字段              | 用途         | 写作要点                                                 |
| ----------------- | ------------ | -------------------------------------------------------- |
| `component_id`    | 组件标识     | PascalCase，与 React 组件名一致                          |
| `name`            | 中文名称     | 简洁，描述组件功能                                       |
| `tags`            | 匹配标签     | 3-6 个学科关键词，LLM 据此判断何时调用                   |
| `props_schema`    | 参数规格     | 每个参数需 type、default、min/max（数值型）、description |
| `a2ui_hint`       | LLM 使用指导 | **最关键的字段**——告诉 LLM 如何正确使用你的组件          |
| `expresses`       | 能力清单     | 3-5 个，描述组件能表达的可视化/交互维度                  |
| `educational_use` | 教学场景     | 一句话描述教学应用                                       |
| `cannot_express`  | 局限性       | 2-4 个，帮助 LLM 避免误用                                |

### 4.3 用 AI 生成 capabilities

项目提供了 AI 提示词模板（`plugins/_template/manifest-prompt.md`），将你的组件源码粘贴进去即可生成。详见 [第 12 节：AI 辅助提示词模板](#12-ai-辅助提示词模板)。

---

## 7. Step 5：构建插件

```bash
cd plugins/chemistry-high-school
npm run build
```

这会生成 `dist/index.esm.js`。确保构建成功且无报错。

开发时可用 watch 模式：

```bash
npm run dev
```

---

## 8. Step 6：注册到前端

插件需要在前端的 `CatalogRegistry.ts` 中注册，才能被 A2UI 渲染管线发现。

编辑 `frontend/src/a2ui-engine/CatalogRegistry.ts`，在 `pluginModules` 对象中添加你的插件：

```typescript
const pluginModules: Record<string, { default: ComponentType }> = {
  "physics-high-school":
    await import("@plugins/physics-high-school/src/PhysicsOscillator"),
  // ↓ 添加你的插件
  "chemistry-high-school":
    await import("@plugins/chemistry-high-school/src/index"),
};
```

**注意**：import 路径指向 `src/index.ts`（开发时），Vite 会自动处理编译。`@plugins` 是前端 vite.config.ts 中配置的别名，指向 `../plugins/`。

---

## 9. Step 7：准备知识库（可选）

如果插件需要学科知识库来增强 RAG 检索，准备 `.md` 或 `.txt` 文档放在 `knowledge/` 目录下，然后使用构建工具生成向量数据库：

```bash
python tools/build-knowledge.py --input plugins/chemistry-high-school/knowledge/raw --output plugins/chemistry-high-school/knowledge/vector.db
```

工具会将文档分块（每块约 500 字，50 字重叠）存入 SQLite，支持 FTS5 全文检索。

如果不需要知识库，可以删除 `entry.vector_db` 字段或保持 `knowledge/` 目录为空。

---

## 10. Step 8：端到端验证

### 10.1 后端验证

启动后端，确认插件被正确加载：

```bash
# 查看日志，应看到：
# INFO: Loaded plugin 'chemistry-high-school' (高中化学插件)
```

调用 API 确认：

```bash
curl http://localhost:8000/api/v1/plugins
# 应返回包含 chemistry-high-school 的 JSON 数组
```

### 10.2 前端验证

启动前端，在插件管理面板中启用你的插件。

### 10.3 Gallery 验证

访问 `http://localhost:5173/?gallery=1`，确认组件预览正常显示。

### 10.4 对话验证

发起对话测试，例如：「给我展示一个 25°C 的水分子结构」，确认 LLM 输出包含你组件的 A2UI 消息且前端正确渲染。

---

## 11. 完整示例参考：physics-high-school

项目已包含一个完整的示例插件 `plugins/physics-high-school/`，可作为仿照对象。

### 文件结构

```
plugins/physics-high-school/
├── manifest.json              # 完整的 manifest，含 capabilities
├── package.json               # 标准插件 package.json
├── vite.config.ts             # ESM 构建，React external
├── tsconfig.json
├── src/
│   ├── PhysicsOscillator.tsx  # Canvas 波形动画组件
│   └── index.ts               # 导出 { components: { PhysicsOscillator } }
└── knowledge/
    └── vector.db              # 物理知识库
```

### manifest.json 关键片段

```json
{
  "id": "physics-high-school",
  "version": "1.0.0",
  "subject": "physics",
  "name": "高中物理插件",
  "keywords": [
    "振动",
    "简谐运动",
    "波",
    "力学",
    "电磁",
    "光学",
    "周期",
    "频率",
    "振幅"
  ],
  "capabilities": [
    {
      "component_id": "PhysicsOscillator",
      "name": "简谐运动模拟器",
      "tags": ["振动", "简谐运动", "波形", "周期运动"],
      "props_schema": {
        "amplitude": {
          "type": "number",
          "default": 1,
          "min": 0,
          "max": 10,
          "description": "振幅（m）"
        },
        "freq": {
          "type": "number",
          "default": 1,
          "min": 0.1,
          "max": 5,
          "description": "频率（Hz）"
        },
        "phase": {
          "type": "number",
          "default": 0,
          "min": 0,
          "max": 6.28,
          "description": "初相位（rad）"
        }
      },
      "a2ui_hint": "PhysicsOscillator 组件已内置参数滑动条（振幅、频率、相位），不需要额外生成 Slider 组件。只需通过 properties 传入初始参数即可...",
      "expresses": [
        "简谐运动波形",
        "振幅变化",
        "频率变化",
        "相位偏移",
        "周期性运动"
      ],
      "educational_use": "探索简谐运动参数对波形的影响；验证周期与频率的倒数关系",
      "cannot_express": [
        "多质点系统",
        "阻尼振动衰减",
        "共振现象",
        "驻波",
        "声波传播"
      ]
    }
  ]
}
```

### 组件关键模式

PhysicsOscillator 展示了以下核心模式：

1. **参数解析**：`parseNum()` 安全转换 properties 值
2. **A2UI 同步**：`useEffect` 监听 props 变化并更新内部 state
3. **Canvas 渲染**：使用 `useRef` + `requestAnimationFrame` 实现动画
4. **内置控件**：组件自带振幅/频率/相位滑动条，无需外部 A2UI 控件
5. **设计规范**：背景 `#faf9f5`，圆角 12px，Manrope 字体

---

## 12. AI 辅助提示词模板（路径 A：从零创建）

以下提示词可直接复制给 AI（Claude、GPT、DeepSeek 等）使用。你只需要用**大白话描述你想要什么**，AI 会帮你决定参数、范围等技术细节。

### 12.1 从描述生成完整插件（推荐）

你只需要描述需求，AI 会完成全部工作：分析参数、生成组件、编写 manifest、给出注册代码。

````
我想为 AhaTutor 教学平台做一个插件。

## 它是什么
【用大白话描述，比如"一个高中化学用的分子结构可视化工具，学生可以看到不同分子的 3D 模型，还能旋转查看"】

## 给谁用
【比如"高中化学老师上课演示，或者学生自学时探索分子结构"】

## 大概的样子
【随便描述，不需要很专业，比如"中间是一个分子的图，下面有几个按钮可以切换不同的分子（水、二氧化碳、甲烷），旁边有个温度滑块，拖动后分子运动会变快"】

请帮我完成以下全部工作：

## 第一步：设计方案
先告诉我你的方案：
1. 建议的插件 ID 和组件名
2. 你认为需要哪些可调参数（LLM 可以通过对话控制）
3. 用什么技术实现（Canvas / SVG / DOM）

## 第二步：输出代码

### 文件 1：src/MyComponent.tsx
要求：
- 函数签名：`export default function ComponentName({ node }: { node: A2UINode })`
- 从 `node.properties` 提取参数，用 `parseNum` 辅助函数安全转换
- 使用 `useState` + `useEffect` 管理内部状态并响应 props 更新
- 样式 inline style：背景 #faf9f5，文字 #1b1c1a，主色 #182544，强调 #775a19，圆角 12px，字体 Manrope
- 不引入任何外部依赖（除 react）

### 文件 2：src/index.ts
```typescript
import { ComponentName } from './ComponentName'
export default { components: { ComponentName } }
````

### 文件 3：manifest.json

完整的 manifest，包含 id, version, subject, name, keywords, entry, capabilities。

### 文件 4：CatalogRegistry.ts 注册行

```typescript
'plugin-id': await import('@plugins/plugin-id/src/index'),
```

## 参考：一个已完成的插件组件（了解目标接口格式）

import { useEffect, useRef, useState } from 'react'

interface A2UINode { properties?: Record<string, unknown> }

function parseNum(val: unknown, fallback: number): number {
const n = Number(val)
return Number.isFinite(n) ? n : fallback
}

export default function PhysicsOscillator({ node }: { node: A2UINode }) {
const props = node.properties ?? {}
const initAmp = parseNum(props.amplitude, 1)
const [amplitude, setAmplitude] = useState(initAmp)
useEffect(() => { setAmplitude(initAmp) }, [initAmp])
// ... Canvas 渲染 + 内置滑块
return (

<div style={{ background: '#faf9f5', borderRadius: 12, padding: 12, display: 'inline-block' }}>
<canvas ref={canvasRef} width={320} height={120} />
<input type="range" value={amplitude}
onChange={(e) => setAmplitude(Number(e.target.value))} />
</div>
)
}

```

> **使用方法**：复制上面的提示词，把三个 `【...】` 替换成你的描述，发给 AI 即可。不需要填任何技术参数。

---

### 12.2 组件已写好，只需生成 manifest

如果你已经有一个写好的组件代码，只需要生成 manifest.json：

```

帮我为这个 AhaTutor 插件组件生成 manifest.json。

## 组件代码

---

## 【粘贴你的 .tsx 文件内容】

## 它是做什么的

【用大白话描述，比如"高中物理课用的简谐运动模拟器，学生可以拖动滑块调振幅和频率看波形变化"】

请输出完整的 manifest.json，包含 id, version, subject, name, keywords, entry, capabilities。
每个 capability 的 a2ui_hint 要明确说明：

- 如果组件已内置控件，告知 LLM 不要重复创建
- 如果需要外部控件，说明用哪些 A2UI 标准组件绑定哪些 props

```

---

### 12.3 遇到问题时的排查提示词

```

我的 AhaTutor 插件组件有问题，请帮我排查。

## 问题表现

【描述你看到的现象，比如"页面上什么都没有"、"对话中 AI 没有调用我的组件"】

## 组件代码

---

## 【粘贴你的 .tsx 文件】

## manifest.json

---

## 【粘贴你的 manifest.json】

## 错误信息（如果有）

【粘贴浏览器 F12 控制台里的错误文字，或截图】

## 正常情况应该怎样

【描述预期效果，比如"学生说'展示一个振幅为 5 的简谐运动'，AI 应该输出包含 PhysicsOscillator 的消息，页面上应该显示波形动画"】

```

---

## 13. 常见问题

### Q: LLM 不调用我的组件？

检查以下几点：
1. `manifest.json` 的 `tags` 是否包含相关学科关键词
2. `a2ui_hint` 是否清晰说明了组件的适用场景
3. `expresses` 是否准确描述了组件能力
4. 确认插件已在管理面板中**启用**
5. 确认前端 `CatalogRegistry.ts` 中已注册

### Q: 组件渲染出来是空白？

1. 检查组件是否正确接受 `{ node }` prop
2. 检查 `node.properties` 是否为 `undefined`（加 `?? {}` 防护）
3. 打开浏览器 DevTools Console，查看是否有 React 报错
4. 确认 `index.ts` 的 export 格式正确：`export default { components: { ... } }`

### Q: 构建报错？

1. 确认 `npm install` 已执行
2. 确认 `vite.config.ts` 的 `entry` 路径正确
3. 确认没有引入未安装的依赖

### Q: 组件的 props 没有被 LLM 正确传入？

检查 `props_schema` 中参数名是否与组件中使用的属性名完全一致。LLM 根据 `props_schema` 决定传什么参数。

### Q: Gallery 页面看不到我的组件？

1. 确认插件已启用
2. 确认 `buildPluginGalleryExamples` 被调用（在 `CatalogRegistry.ts` 的 `loadPluginComponents` 中）
3. 检查 `props_schema` 中的 `default` 值是否合理（Gallery 用这些值生成预览）

### Q: 组件样式在 Gallery 和聊天页面不一致？

样式覆盖必须写在全局 CSS（`frontend/src/index.css`）中，不要写在组件局部作用域。详见 CLAUDE.md 中的说明。

---

## 14. 路径 B：从已有实现创建插件

如果你已经有一个可用的可视化/交互实现（GitHub 上的 React 组件、CodePen demo、D3 图表、Canvas 动画等），可以将其改造为 AhaTutor 插件，而无需从零开发。

核心工作只有一件事：**让你的代码适配 A2UI 的 `{ node }` prop 接口**。

### 14.1 改造流程总览

```

已有代码
│
├─ Step A：识别参数（哪些值需要 LLM 控制？）
├─ Step B：包装为 React 函数组件（如果不是）
├─ Step C：接入 { node } prop 接口
├─ Step D：生成 manifest.json
└─ Step E：构建、注册、验证（与路径 A 相同）

````

Step A-C 是改造的核心，Step D-E 复用路径 A 的步骤。

### 14.2 Step A：让 AI 分析你的代码（你不需要手动识别参数）

你**不需要**自己搞清楚代码有哪些参数、类型是什么、范围多少——把这些全部交给 AI。

你只需要准备好两样东西：

1. **原始代码**（从 GitHub、CodePen 或本地项目复制）
2. **一句话说明用途**（用中文大白话即可，比如「这是一个高中物理用的简谐运动波形动画」）

然后直接使用 [14.6 的一步到位提示词](#146-一步到位提示词粘贴代码即可)，AI 会帮你完成：
- 识别代码中哪些值适合暴露为 LLM 可控参数
- 确定参数名、类型、默认值、取值范围
- 将代码改造为 A2UI 插件组件
- 生成 manifest.json、index.ts、注册代码
- 输出改造说明

> **什么时候需要自己分析参数？** 只有当你对「哪些参数该暴露给 LLM」有明确想法时，才需要手动做。绝大多数情况下，让 AI 分析就够了。

#### AI 如何决定哪些参数暴露给 LLM

AI 会根据以下标准自动判断：

| 判断标准 | 示例 |
|---------|------|
| 这个值改变后，可视化会变化吗？ | 振幅改了波形会变 → 暴露 |
| 学生在对话中可能要求改变它吗？ | 「把频率调到 3」→ 暴露 |
| 它是纯内部实现细节吗？ | canvas 宽高、动画帧 ID → 不暴露 |

你不需要告诉 AI 这些规则，它已经知道。

### 14.3 Step B：包装为 React 函数组件

根据你已有代码的类型，选择对应的包装策略。

#### 场景 1：已有 React 函数组件（最简单）

你的代码已经是 `function MyComponent(props)` 形式，只需要改 prop 接口。

**改造前**（原始代码）：
```tsx
// 原始组件：直接接收 props
function WaveChart({ amplitude = 1, frequency = 1 }) {
  // ... 渲染逻辑
}
````

**改造后**：

```tsx
// A2UI 插件组件：从 node.properties 获取参数
interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function WaveChart({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const amplitude = parseNum(props.amplitude, 1);
  const frequency = parseNum(props.frequency, 1);
  // ... 原有渲染逻辑不变
}
```

**变化清单**：

1. 函数签名改为 `({ node }: { node: A2UINode })`
2. 添加 `parseNum` 辅助函数
3. 从 `node.properties` 提取参数并给默认值
4. 添加 `export default`
5. 如果原组件用 `useState` 管理这些参数，改为用 `useEffect` 同步（见下方场景 3）

#### 场景 2：已有 React 类组件

**改造前**：

```tsx
class PendulumSimulator extends React.Component {
  state = { length: 1, gravity: 9.8 };
  // ...
}
```

**改造后**：重写为函数组件 + hooks。

```tsx
interface A2UINode {
  properties?: Record<string, unknown>;
}
function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function PendulumSimulator({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const initLength = parseNum(props.length, 1);
  const initGravity = parseNum(props.gravity, 9.8);

  const [length, setLength] = useState(initLength);
  const [gravity, setGravity] = useState(initGravity);

  useEffect(() => {
    setLength(initLength);
  }, [initLength]);
  useEffect(() => {
    setGravity(initGravity);
  }, [initGravity]);

  // 将原 class 中的 componentDidMount → useEffect
  // 将原 class 中的 componentDidUpdate → useEffect with deps
  // 将原 class 中的 this.state → 对应的 state 变量
  // 将原 class 中的 this.setState → 对应的 setter

  // ... 渲染逻辑
}
```

> 类组件到函数组件的转换是纯机械操作，直接把代码丢给 AI 即可。见 [14.6 提示词模板](#146-从已有代码改造的提示词模板)。

#### 场景 3：已有可交互的 React 组件（用户可调参数）

如果原组件已有内置的滑动条/输入框让用户调参，需要让 LLM 也能控制这些参数。

**关键**：原组件内部的 `useState` 不能丢（用户交互需要），但要加一个 `useEffect` 让 LLM 的 props 也能更新它们。

```tsx
export default function WaveChart({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const initAmp = parseNum(props.amplitude, 1);

  // 保留内部 state（用户通过滑动条交互）
  const [amplitude, setAmplitude] = useState(initAmp);

  // 新增：LLM 通过 properties 更新时同步
  useEffect(() => {
    setAmplitude(initAmp);
  }, [initAmp]);

  // 原有的渲染逻辑和控件完全保留
  return (
    <div>
      <canvas ref={canvasRef} />
      <input
        type="range"
        value={amplitude}
        onChange={(e) => setAmplitude(Number(e.target.value))}
      />
    </div>
  );
}
```

这样实现了**双通道控制**：

- 用户通过组件内置滑动条调节 → 直接 `setAmplitude`
- LLM 通过新对话消息传入参数 → `useEffect` 触发 `setAmplitude`

#### 场景 4：原生 JS / Canvas / DOM 操作

代码不是 React，而是纯 JavaScript。

**改造前**：

```javascript
// 原始代码：一个立即执行函数
(function () {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let amplitude = 1;
  // ... 绑定事件、动画循环
})();
```

**改造后**：将 DOM 操作迁移到 React 生命周期中。

```tsx
import { useEffect, useRef, useState } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}
function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function MyVisualization({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const initAmp = parseNum(props.amplitude, 1);
  const [amplitude, setAmplitude] = useState(initAmp);

  useEffect(() => {
    setAmplitude(initAmp);
  }, [initAmp]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 将原来操作 document.getElementById 的代码
    // 改为操作 container
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 120;
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // 原有的动画循环、事件绑定等逻辑照搬
    let animId = 0;
    function draw() {
      // ... 原有绘制逻辑，用 amplitude 变量
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);

    // 清理函数：卸载时移除 DOM、取消动画
    return () => {
      cancelAnimationFrame(animId);
      container.removeChild(canvas);
    };
  }, [amplitude]); // amplitude 变化时重新执行

  return (
    <div
      ref={containerRef}
      style={{ background: "#faf9f5", borderRadius: 12, padding: 12 }}
    />
  );
}
```

**迁移要点**：

| 原始 JS 写法                       | React 改造                                                    |
| ---------------------------------- | ------------------------------------------------------------- |
| `document.getElementById('xxx')`   | `useRef` + `ref={xxxRef}`                                     |
| `element.addEventListener(...)`    | `useEffect` 中绑定，清理函数中移除                            |
| `setInterval / setTimeout`         | `useEffect` 中设置，清理函数中 `clearInterval / clearTimeout` |
| `requestAnimationFrame` 循环       | `useEffect` 中启动，清理函数中 `cancelAnimationFrame`         |
| 直接修改 DOM                       | `useEffect` 中操作 `ref.current`                              |
| 立即执行函数 `(function(){...})()` | 函数组件的 `useEffect(() => {...}, [])`                       |

#### 场景 5：依赖第三方库（D3.js、Chart.js 等）

AhaTutor 插件**不能引入外部依赖**（React 除外）。如果你的实现依赖 D3、Chart.js 等库，有两种处理方式：

**方式 A（推荐）：用原生 Canvas/SVG 重写**

将第三方库的渲染逻辑替换为原生实现。D3 的数据处理可以保留（它是纯 JS），但 DOM 绑定和渲染部分需要替换。

```tsx
// D3 的数据处理可以保留
import { scaleLinear } from "d3-scale"; // ❌ 不行，不能引入外部依赖

// 改为手动实现（这些公式很简单）
function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (x: number) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0);
}
```

**方式 B：内联精简版**

将第三方库的核心功能（你用到的部分）提取出来，内联到组件文件中。

```tsx
// 不 import 整个 d3，而是内联你需要的那个函数
function interpolateColor(a: string, b: string, t: number): string {
  // 内联 d3-interpolate 的核心逻辑（通常只有几行）
  // ...
}
```

> 大多数教育场景的可视化（函数图像、波形、几何图形）用原生 Canvas 就够了，不需要第三方库。如果确实需要复杂库的功能，直接让 AI 用原生实现重写。

### 14.4 Step C：接入 { node } prop 接口（改造清单）

无论哪种场景，改造完成后对照以下清单确认：

```markdown
## 改造完成检查清单

- [ ] 函数签名为 `export default function ComponentName({ node }: { node: A2UINode })`
- [ ] 定义了 `A2UINode` 接口：`{ properties?: Record<string, unknown> }`
- [ ] 定义了 `parseNum` 辅助函数
- [ ] 所有 LLM 可控参数从 `node.properties` 提取（带默认值）
- [ ] 如果组件有内部 state 管理这些参数，添加了 `useEffect` 同步
- [ ] 原有交互逻辑（滑动条、按钮等）保留完好
- [ ] DOM 操作通过 `useRef`，清理函数中释放资源
- [ ] 无外部依赖（除 react）
- [ ] 样式为 inline style，符合设计规范（#faf9f5 背景、#1b1c1a 文字、12px 圆角）
```

### 14.5 Step D-E：生成 manifest 并完成集成

改造完组件后，接下来的步骤与路径 A 相同：

1. 编写 `src/index.ts`（导出 `{ components: { ... } }`）
2. 用 AI 生成 `manifest.json` 的 `capabilities`（见 [12.2 节](#122-生成-manifestjson-capabilities)）
3. `npm run build` 构建
4. 在 `CatalogRegistry.ts` 的 `pluginModules` 中注册
5. 端到端验证

### 14.6 提示词模板

#### 14.6.1 一步到位提示词（推荐，粘贴代码即可）

这是最简单的方式。你只需要：

1. 粘贴你的原始代码
2. 用一句话说这是什么、给谁用

AI 会自动分析代码类型、提取参数、完成全部改造，并输出所有需要的文件。

````
我想把下面这段代码改造成 AhaTutor 教学平台的插件。

它是一个【用大白话描述，比如"高中物理课用的简谐运动波形动画，学生可以拖动滑块调振幅和频率"】。

下面是原始代码：

---
【粘贴你的完整代码——React 组件、JS 文件、HTML 文件、CodePen 截图都行】
---

请帮我完成以下全部工作，直接输出可用的代码：

## 第一步：分析代码
告诉我你从代码中识别出了哪些信息：
1. 代码类型（React 函数组件 / React 类组件 / 原生 JS / HTML+JS / 使用了第三方库）
2. 适合暴露给 AI 助手（LLM）控制的参数列表（参数名、类型、默认值、范围）
3. 这个组件有哪些第三方依赖，打算如何处理（用原生 API 重写 or 内联精简版）
4. 建议的插件 ID、学科分类、组件名

## 第二步：输出改造后的文件

### 文件 1：src/MyComponent.tsx
将原始代码改造为 A2UI 插件组件，要求：
- 函数签名：`export default function ComponentName({ node }: { node: A2UINode })`
- 从 `node.properties` 提取参数，使用 `parseNum` 辅助函数安全转换
- 如果原代码有内部可调状态（如滑块），保留它们，同时用 `useEffect` 让 LLM 也能控制
- 如果原代码用了第三方库（d3/chart.js 等），用原生 Canvas/SVG/DOM 重写
- DOM 操作用 `useRef`，事件绑定和动画循环在 `useEffect` 中管理并正确清理
- 样式用 inline style：背景 #faf9f5，文字 #1b1c1a，主色 #182544，强调 #775a19，圆角 12px，字体 Manrope
- 不引入任何外部依赖（除 react）

### 文件 2：src/index.ts
导出组件：
```typescript
import { ComponentName } from './ComponentName'
export default { components: { ComponentName } }
````

### 文件 3：manifest.json

完整的 manifest，包含 id、version、subject、name、keywords、entry、capabilities。每个 capability 包含 component_id、name、tags、props_schema、a2ui_hint、expresses、educational_use、cannot_express。

### 文件 4：CatalogRegistry.ts 注册行

```typescript
'plugin-id': await import('@plugins/plugin-id/src/index'),
```

## 第三步：改造说明

用简单的话告诉我你做了哪些改造，为什么这样做。如果原始代码有问题（比如有 bug、不兼容 React），也在这里指出。

## 参考：一个已完成的插件组件（了解目标接口格式）

import { useEffect, useRef, useState } from 'react'

interface A2UINode { properties?: Record<string, unknown> }

function parseNum(val: unknown, fallback: number): number {
const n = Number(val)
return Number.isFinite(n) ? n : fallback
}

export default function PhysicsOscillator({ node }: { node: A2UINode }) {
const props = node.properties ?? {}
const initAmp = parseNum(props.amplitude, 1)
const [amplitude, setAmplitude] = useState(initAmp)
useEffect(() => { setAmplitude(initAmp) }, [initAmp])
// ... Canvas 渲染 + 内置滑块
return (

<div style={{ background: '#faf9f5', borderRadius: 12, padding: 12, display: 'inline-block' }}>
<canvas ref={canvasRef} width={320} height={120} />
<input type="range" value={amplitude}
onChange={(e) => setAmplitude(Number(e.target.value))} />
</div>
)
}

```

> **使用方法**：把上面的提示词完整复制，把 `【...】` 替换成你的代码和描述，发给 AI（Claude / GPT / DeepSeek 都行）。

---

#### 14.6.2 分步提示词（如果你想逐步控制每一步）

如果你更倾向于一步一步来，而不是一次出全部结果，可以用以下分步提示词。

##### 分步 1：让 AI 分析你的代码

你只需要粘贴代码和一句描述，AI 会帮你搞清楚所有技术细节。

```

帮我分析下面这段代码，我打算把它改造成 AhaTutor 教学平台的插件组件。

它是一个【用大白话描述用途，比如"高中数学课用的函数图像绘制器，学生可以输入函数表达式来画图"】。

下面是原始代码：

---

## 【粘贴你的代码】

请分析并回答：

1. **代码类型**：这是 React 函数组件、React 类组件、原生 JS、还是 HTML+JS？
2. **可调参数**：代码中有哪些值改变后会影响显示效果？列出每个参数的：
   - 参数名（英文 camelCase）
   - 数据类型（数字/字符串/布尔）
   - 当前默认值
   - 合理的取值范围
   - 用大白话解释这个参数控制什么
3. **依赖问题**：代码用到了哪些第三方库？能去掉吗？
4. **建议**：推荐用什么作为插件 ID（如 math-function-plotter）和组件名（如 FunctionPlotter）？
5. **风险**：改造时有哪些需要注意的地方？

```

AI 返回的分析结果大概长这样：

```

1. 代码类型：原生 JS（在 HTML 中通过 script 标签引入）
2. 可调参数：
   - funcExpr (string) 默认 "sin(x)" 范围：任意数学表达式
     控制绘制哪个函数
   - xMin (number) 默认 -10 范围：-100~0
     X 轴最小值
   - xMax (number) 默认 10 范围：0~100
     X 轴最大值
     ...
3. 依赖问题：用了 Math.js 来解析表达式。可以内联一个简化的表达式解析器。
4. 建议：插件 ID math-function-plotter，组件名 FunctionPlotter
5. 风险：表达式解析部分较复杂，需要仔细处理边界情况

```

拿到分析结果后，你可以：
- 检查参数是否合理（AI 可能遗漏或误判）
- 调整参数范围（比如 AI 建议 xMax 范围 0~100，但你觉得 0~50 就够了）
- 然后进入分步 2

##### 分步 2：让 AI 改造组件代码

把分步 1 的分析结果连同原始代码一起发给 AI：

```

根据上面的分析，请把原始代码改造为 A2UI 插件组件。

要求：

- 函数签名：`export default function FunctionPlotter({ node }: { node: A2UINode })`
- 从 node.properties 提取参数，用 parseNum / parseStr 辅助函数安全转换
- 保留原有交互（如内置的输入框），同时让 LLM 也能通过 properties 控制参数
- 第三方依赖用原生 API 重写
- 样式 inline style，背景 #faf9f5，文字 #1b1c1a，圆角 12px，字体 Manrope
- 不引入外部依赖（除 react）
- DOM 操作用 useRef，动画/事件在 useEffect 中管理并正确清理

## 参考接口格式

interface A2UINode { properties?: Record<string, unknown> }
function parseNum(val: unknown, fallback: number): number {
const n = Number(val)
return Number.isFinite(n) ? n : fallback
}
// 字符串参数用这个：
function parseStr(val: unknown, fallback: string): string {
return typeof val === 'string' ? val : fallback
}

```

##### 分步 3：让 AI 生成 manifest 和注册代码

组件改造完成后，把改造后的组件代码发给 AI：

```

根据下面的插件组件代码，生成 manifest.json 和前端注册代码。

插件信息：

- 插件 ID：math-function-plotter
- 学科：高中数学
- 教学场景：【用大白话描述，比如"帮助学生可视化各种函数图像，理解函数参数对图像的影响"】

组件代码：

---

## 【粘贴改造后的 .tsx 文件】

请输出：

### 1. 完整的 manifest.json

包含 id, version, subject, name, keywords, entry, capabilities。
每个 capability 的 a2ui_hint 要明确说明：

- 如果组件已内置控件，告知 LLM 不要重复创建
- 如果需要外部控件，说明用哪些 A2UI 标准组件绑定哪些 props

### 2. src/index.ts 导出文件

### 3. 前端注册代码（CatalogRegistry.ts 中需要添加的一行）

```

---

#### 14.6.3 遇到问题时的提示词

如果改造后的组件不工作，把代码和错误信息一起发给 AI：

```

我改造的 AhaTutor 插件组件有问题，请帮我排查。

## 问题表现

【描述你看到的现象，比如"页面上什么都没有"、"报了一个红色的错误"】

## 组件代码

【粘贴你的 .tsx 文件】

## 错误信息（如果有）

【粘贴浏览器 F12 控制台里的错误，或截图】

## 正常情况应该怎样

【描述预期效果，比如"应该显示一个波形动画，学生可以拖动滑块调振幅"】

```

---

#### 14.6.4 提示词使用流程图

```

你手上有代码
│
▼
使用 14.6.1 一步到位提示词
│
├── 输出完美，直接用 → 完成
│
└── 输出有问题
│
▼
使用 14.6.3 排查提示词
│
├── 小问题，AI 修好了 → 完成
│
└── 大问题，重新来
│
▼
使用 14.6.2 分步提示词
（分步 1 分析 → 分步 2 改造 → 分步 3 manifest）
│
▼
完成

````

### 14.7 完整改造示例

以一个原始的简谐运动 Canvas 动画为例，展示从「网上找到的代码」到「AhaTutor 插件」的完整改造过程。

#### 原始代码（网上找到的 JS demo）

```javascript
// 原始代码：一个简单的 Canvas 波形动画
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
canvas.width = 400
canvas.height = 150

let amp = 1, freq = 1, phase = 0

document.getElementById('ampSlider').addEventListener('input', (e) => {
  amp = e.target.value
})
document.getElementById('freqSlider').addEventListener('input', (e) => {
  freq = e.target.value
})

function animate() {
  ctx.clearRect(0, 0, 400, 150)
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = 0; x < 400; x++) {
    const y = 75 - amp * 30 * Math.sin(freq * x * 0.02 + phase)
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  requestAnimationFrame(animate)
}
animate()
````

#### 改造后的插件组件

```tsx
import { useEffect, useRef, useState } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function WaveAnimation({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  // 从 A2UI properties 获取参数（LLM 控制）
  const initAmp = parseNum(props.amplitude, 1);
  const initFreq = parseNum(props.freq, 1);

  const [amplitude, setAmplitude] = useState(initAmp);
  const [freq, setFreq] = useState(initFreq);

  // LLM 新消息时同步参数
  useEffect(() => {
    setAmplitude(initAmp);
  }, [initAmp]);
  useEffect(() => {
    setFreq(initFreq);
  }, [initFreq]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // 动画循环（从原始代码迁移）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width,
      H = canvas.height;
    const omega = 2 * Math.PI * freq;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "#182544"; // ← 改为项目主色
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const y =
          H / 2 -
          (Math.min(amplitude, 10) / 10) *
            (H / 2) *
            0.8 *
            Math.sin(((omega * x) / W) * 4);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current); // ← 新增清理
  }, [amplitude, freq]);

  return (
    // ← 新增：项目设计规范的外层容器
    <div
      style={{
        background: "#faf9f5",
        borderRadius: 12,
        padding: 12,
        display: "inline-block",
      }}
    >
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        style={{ display: "block", borderRadius: 8 }}
      />
      {/* ← 保留原有滑动条，但改为 React 受控组件 */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          color: "#1b1c1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ minWidth: 60 }}>振幅</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={amplitude}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: "rgba(24,37,68,0.1)",
              appearance: "none",
            }}
          />
          <span
            style={{
              minWidth: 40,
              textAlign: "right",
              color: "rgba(24,37,68,0.6)",
            }}
          >
            {amplitude.toFixed(1)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ minWidth: 60 }}>频率</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: "rgba(24,37,68,0.1)",
              appearance: "none",
            }}
          />
          <span
            style={{
              minWidth: 40,
              textAlign: "right",
              color: "rgba(24,37,68,0.6)",
            }}
          >
            {freq.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

#### 改造对照表

| 原始代码                                                     | 改造后                                                                    | 原因                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------- |
| `document.getElementById('canvas')`                          | `const canvasRef = useRef()` + `<canvas ref={canvasRef}>`                 | React 不直接操作 DOM |
| `document.getElementById('ampSlider').addEventListener(...)` | `<input onChange={(e) => setAmplitude(...)}>`                             | React 声明式事件处理 |
| 全局变量 `let amp = 1`                                       | `const [amplitude, setAmplitude] = useState(initAmp)`                     | React 状态管理       |
| 直接调用 `animate()`                                         | `useEffect(() => { ... requestAnimationFrame(draw) }, [amplitude, freq])` | 参数变化时重启动画   |
| 无清理逻辑                                                   | `return () => cancelAnimationFrame(animRef.current)`                      | 防止内存泄漏         |
| 硬编码颜色 `#333`                                            | `#182544`（项目主色）                                                     | 设计规范             |
| 无外层容器                                                   | `<div style={{ background: '#faf9f5', borderRadius: 12, padding: 12 }}>`  | 设计规范             |
| 无 LLM 参数接口                                              | `node.properties` + `parseNum` + `useEffect` 同步                         | A2UI 插件接口        |
