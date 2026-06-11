# 流萤桌宠

一个基于 Electron 的 Windows 桌面宠物项目。当前版本会在透明置顶窗口中显示流萤立绘，支持点击互动、拖拽、右键菜单、表情切换、提醒台词和可选的 DeepSeek 聊天面板。

## 功能

- 透明、无边框、置顶桌宠窗口
- 流萤立绘显示和多表情切换
- 左键点击触发台词和动作
- 左键拖拽移动桌宠位置
- 右键菜单切换尺寸、表情和互动功能
- 气泡台词和定时提醒
- DeepSeek 聊天面板，支持本地 `.env` 配置 API Key
- 可通过 `config/persona.md` 调整流萤聊天人格设定
- DeepSeek 请求日志写入 `logs/`，该目录不会提交到 Git
- 聊天面板支持 `思考` 模式切换、`长期记忆` 和 `余额查询`
- 每轮聊天会显示缓存命中和预估成本

## 环境要求

- Windows
- Node.js
- npm

## 安装和启动

安装依赖：

```powershell
npm install
```

启动桌宠：

```powershell
npm start
```

也可以直接运行：

```powershell
.\start.cmd
```

## DeepSeek 聊天配置

聊天功能是可选的。需要使用时，在项目根目录创建 `.env`：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

仓库中只保留 `.env.example`，不要提交真实密钥。

当前聊天配置位于 `config/pet.json` 的 `api` 字段：

```json
{
  "model": "deepseek-v4-flash",
  "mode": "flash",
  "timeoutMs": 30000,
  "maxHistoryTurns": 6
}
```

如果要补充本地上下文，可以在 `config/pet.json` 里增加：

```json
{
  "context": {
    "location": "中国"
  }
}
```

`location` 会作为本地上下文传给聊天后端，默认值是 `中国`。

聊天输入支持临时切换模型：

- `/flash 你好`：使用 flash 模型
- `/pro 帮我想一句提醒`：使用 pro 模型
- `/new` 或 `/clear`：清空当前对话
- `/save`：把当前对话保存到长期记忆
- `/help`：查看可用指令

聊天面板里也可以直接切换：

- `思考`：使用 pro 模式
- `长期记忆`：会载入已保存的记忆，并在发送时把当前对话保存到本机用户数据目录，供后续聊天继续参考
- `余额`：刷新 DeepSeek 余额信息

流萤的聊天人格提示词位于：

```text
config/persona.md
```

如果该文件读取失败，程序会使用 `main.js` 中的备用人格提示词。

聊天请求会自动带上当前会话的历史摘要，避免上下文太长时被截断得太快。
启用长期记忆时，聊天历史会持久化到本机用户数据目录下的 `long-term-memory.json`。

## 使用方式

- 鼠标移到流萤可见像素区域后，窗口会接收点击。
- 左键点击：随机说一句话。
- 左键拖拽：移动流萤。
- 右键点击：打开菜单。
- 右键菜单中的“和流萤聊天”：打开聊天面板。

## 项目结构

```text
main.js                 Electron 主进程，窗口、菜单、配置读取和 DeepSeek 请求
preload.js              安全 IPC 桥接
renderer/index.html     渲染层结构
renderer/style.css      桌宠、气泡和聊天面板样式
renderer/renderer.js    桌宠交互、动画、提醒和聊天 UI
assets/                 立绘和动作资源
config/pet.json         桌宠台词、提醒、尺寸和 API 配置
config/persona.md       DeepSeek 聊天人格提示词
start.cmd               Windows 快速启动脚本
```

## 常见排查

如果左键或右键无反应，先检查渲染脚本语法：

```powershell
node --check renderer\renderer.js
```

如果聊天失败：

- 确认 `.env` 中存在 `DEEPSEEK_API_KEY`
- 确认网络可访问 DeepSeek API
- 查看 `logs/deepseek-YYYY-MM-DD.jsonl`

## 开发检查

```powershell
node --check main.js
node --check preload.js
node --check renderer\renderer.js
```
