# 流萤桌宠后续功能计划表

## 当前结论

当前项目已经完成了桌宠 MVP 到本地聊天阶段的大部分能力：透明置顶窗口、角色立绘、拖动、右键菜单、尺寸切换、气泡台词、配置读取、多状态图片、提醒、聊天面板、DeepSeek API 聊天、长期记忆雏形和简单 sprite 动作。

暂不做 `electron-builder` 打包 `.exe`。后续优先继续完善桌宠本体能力、配置化、状态系统、记忆管理和 Live2D 预研。

## 参考仓库定位

| 参考项目 | 主要价值 | 对本项目的用法 | 不直接照搬的原因 |
| --- | --- | --- | --- |
| [BDFFZI/Alife](https://github.com/BDFFZI/Alife) | AI 桌宠高级架构参考：插件化、长期记忆、主动活动、视觉、语音、浏览器、脚本执行、多开互联 | 学习功能拆分、插件化思想、AI 能力边界、长期陪伴系统设计 | 技术栈是 .NET 9、Python、WPF、Blazor Hybrid，不符合当前 Electron + JavaScript 路线 |
| [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) | Live2D 模型资源结构参考：模型目录、`model.json` / `model3.json`、贴图、动作、表情 | 后续做 Live2D 实验分支时参考模型组织和排查方式 | 它是模型集合，不是桌宠框架；模型配置和授权需要逐个确认 |

## 当前功能进度

| 功能 | 当前状态 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 透明置顶窗口 | 已完成 | `main.js` | 已使用透明、无边框、置顶窗口 |
| 显示角色图 | 已完成 | `renderer/index.html`、`assets/` | 已支持基础立绘 |
| 拖动 | 已完成 | `renderer/renderer.js` | 已支持鼠标拖动桌宠位置 |
| 右键菜单 | 已完成 | `main.js` | 已支持大小、表情、互动和退出 |
| 大小调整 | 已完成 | `main.js`、`renderer/renderer.js` | 已有迷你、小、正常、大尺寸 |
| 气泡台词 | 已完成 | `renderer/style.css`、`renderer/renderer.js` | 已支持动态气泡和台词截断 |
| 读取配置文件 | 已完成 | `config/pet.json`、`main.js` | 已读取台词、提醒、API 配置等 |
| 多状态图片 | 已完成 | `assets/character*.png`、`renderer/renderer.js` | 已有普通、开心、思考、困困 |
| 提醒功能 | 已完成 | `config/pet.json`、`renderer/renderer.js` | 已支持多个定时提醒 |
| 本地聊天窗口 | 已完成 | `renderer/index.html`、`renderer/style.css`、`renderer/renderer.js` | 已有聊天面板 |
| 可选 API 聊天 | 已完成 | `main.js`、`preload.js`、`.env.example` | Key 从 `.env` 进入主进程，未暴露给前端 |
| 长期记忆 | 初版完成 | `main.js`、`renderer/renderer.js` | 已有保存和读取雏形，后续需要管理 UI |
| 动作 sprite | 初版完成 | `assets/sprites/`、`renderer/renderer.js` | 已有挥手动作，后续可配置化 |
| 打包 exe | 暂不做 | `package.json` | 当前明确不作为后续优先事项 |

## 后续功能优先级

| 优先级 | 功能方向 | 修改重点 | 预期产物 | 参考来源 |
| --- | --- | --- | --- | --- |
| P0 | 配置驱动增强 | 扩展 `config/pet.json`，把表情图片、sprite 动作、默认位置、台词分组、提醒开关配置化 | 换角色或改动作时尽量不改代码 | Live2D 模型配置思想 |
| P0 | 状态机整理 | 把 `normal / happy / thinking / sleepy` 扩展为 `idle / talking / thinking / dragging / sleepy / reminding / chatting` | 行为更稳定，后续接动作和 Live2D 更容易 | Alife 的模块化状态思路 |
| P1 | 记忆管理 UI | 在聊天面板增加查看记忆、保存摘要、清空记忆、导出记忆 | 用户可控的长期记忆系统 | Alife 的长期记忆方向 |
| P1 | 主动陪伴事件 | 根据时间、久未互动、聊天状态、提醒状态触发主动气泡 | 更像“陪伴型桌宠”，不是被动工具 | Alife 的自主活动方向 |
| P1 | 动作系统配置化 | 将 `SPRITE_CONFIG` 从代码移动到配置，支持多个动作 | 可配置挥手、待机、困困、说话动作 | Live2D 动作/表情组织方式 |
| P2 | 聊天能力分层 | 拆出 `services/chat.js`、`services/memory.js` 等模块 | 降低 `main.js` 复杂度 | Alife 的功能模块拆分 |
| P2 | 本地工具能力 | 增加安全的本地小工具，例如待办、番茄钟、今日计划 | 桌宠能辅助学习和写论文 | Alife 的工具服务方向 |
| P2 | Live2D 实验分支 | 新建独立 demo 页面加载合法 Live2D 模型 | 验证模型加载、动作、表情，不影响主桌宠 | Eikanya/Live2d-model |
| P3 | 语音预研 | 先做按钮式语音输入或朗读，不做全自动监听 | 轻量语音交互 demo | Alife 的语音交互方向 |
| P3 | 视觉预研 | 仅在用户主动触发时截图/识别，不默认监控屏幕 | 可控、安全的视觉实验 | Alife 的视觉能力方向 |

## 建议拆分步骤

| 阶段 | 目标 | 具体任务 | 验收标准 |
| --- | --- | --- | --- |
| 第 1 阶段 | 先稳住现有功能 | 做配置驱动增强；补充配置读取失败 fallback；整理 README 中配置说明 | 修改配置即可换图片、台词和提醒；现有功能不坏 |
| 第 2 阶段 | 建立状态机 | 新增统一状态对象；集中处理表情、动作、气泡、拖动、聊天状态 | 点击、拖动、提醒、聊天不会互相抢状态 |
| 第 3 阶段 | 完善记忆 | 增加记忆管理 UI；支持保存摘要、查看最近记忆、清空记忆 | 用户能知道桌宠记住了什么，并能删除 |
| 第 4 阶段 | 增强陪伴感 | 增加主动事件调度器；支持久未互动、学习提醒、休息提醒 | 桌宠能在合适时间主动说话，但不打扰 |
| 第 5 阶段 | 动作系统升级 | 多 sprite 动作配置化；为不同状态绑定动作 | 不同状态有不同动作表现 |
| 第 6 阶段 | Live2D 预研 | 独立实验，不接入主桌宠；验证模型、动作、表情和授权 | demo 能显示模型并切换动作，确认可行后再决定是否接入 |

## 暂不做事项

| 事项 | 原因 |
| --- | --- |
| 打包 `.exe` | 当前明确不做，先继续完善功能和架构 |
| 直接迁移到 .NET/WPF | 与当前 Electron + JavaScript 路线冲突 |
| 一次性接入完整 Live2D | 风险较高，容易破坏现有立绘桌宠 |
| 默认开启屏幕视觉/麦克风监听 | 涉及隐私和权限，必须等用户明确触发 |
| 把 API Key 写进前端或配置文件 | 安全风险，继续只从 `.env` 或安全运行时来源读取 |

## 下一步推荐

优先做 **配置驱动增强**：

1. 在 `config/pet.json` 增加 `expressions` 和 `motions` 配置。
2. 让 `renderer/renderer.js` 从配置读取图片和 sprite 路径。
3. 保留当前硬编码路径作为 fallback。
4. 测试点击、右键切表情、挥手动作、提醒和聊天是否仍正常。
