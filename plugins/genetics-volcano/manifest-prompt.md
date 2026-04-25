# AI 生成 manifest.json 提示词

将你的组件源码粘贴到下方，然后发送给 AI，让它帮你生成完整的 manifest.json。

---

帮我为这个 AhaTutor 插件组件生成 manifest.json 的 capabilities 部分。

## 组件代码

---
【粘贴你的 .tsx 文件内容】
---

## 它是做什么的

【用大白话描述，比如"高中物理课用的简谐运动模拟器，学生可以拖动滑块调振幅和频率看波形变化"】

请输出完整的 capabilities 数组，每个 capability 包含：
- component_id（PascalCase，与 React 组件名一致）
- name（中文名称）
- tags（3-6 个学科关键词）
- props_schema（每个参数的 type、default、min、max、description）
- a2ui_hint（告诉 LLM 如何正确使用组件，是否已内置控件）
- expresses（3-5 个能力描述）
- educational_use（教学场景描述）
- cannot_express（2-4 个局限性）
