const { app, BrowserWindow, Menu, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let cursorWatchTimer = null;

const SIZE_PRESETS = {
  tiny: {
    label: "迷你",
    petWidth: 140
  },
  small: {
    label: "小",
    petWidth: 180
  },
  normal: {
    label: "正常",
    petWidth: 220
  },
  big: {
    label: "大",
    petWidth: 280
  }
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const PRO_DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEFAULT_CHAT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_HISTORY_TURNS = 6;
const CHAT_USER_ID = "liuying-desktop-local";
const DEEPSEEK_LOG_DIR = path.join(__dirname, "logs");
const PERSONA_PROMPT_PATH = path.join(__dirname, "config", "persona.md");

const FALLBACK_SYSTEM_PROMPT = [
  "你是用户的 Windows 桌面宠物“流萤”。",
  "你的性格温柔、可爱、会陪用户学习和写论文，但偶尔会轻轻吐槽。",
  "请始终使用简体中文回复。",
  "回复要短，适合显示在桌宠聊天框和气泡里。",
  "除非用户明确要求详细解释，否则每次回复控制在 80 个中文字符以内。",
  "不要编造你无法知道的本机状态、时间、窗口位置或提醒倒计时。"
].join("\n");

loadLocalEnvFile();

let chatHistory = [];

function readPersonaPrompt() {
  try {
    const prompt = fs.readFileSync(PERSONA_PROMPT_PATH, "utf-8").trim();

    if (prompt) {
      return prompt;
    }
  } catch (error) {
    console.error("Failed to read persona.md, using fallback persona:", error);
  }

  return FALLBACK_SYSTEM_PROMPT;
}

function loadLocalEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(envPath, "utf-8");
    const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex <= 0) {
        return;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      let value = trimmedLine.slice(separatorIndex + 1).trim();

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return;
      }

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.error("读取 .env 失败：", error);
  }
}

function readPetConfig() {
  const configPath = path.join(__dirname, "config", "pet.json");

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("读取 pet.json 失败：", error);

    return {
      name: "流萤",
      defaultSize: "small",
      lines: [
        "配置文件读取失败啦。",
        "不过我还是会陪着你的。"
      ],
      reminders: {
        enabled: false,
        items: []
      },
      edgeSnap: {
        enabled: false
      }
    };
  }
}

function getChatSettings() {
  const config = readPetConfig();
  const apiConfig = config.api || {};
  const timeoutMs = Number(apiConfig.timeoutMs || DEFAULT_CHAT_TIMEOUT_MS);
  const maxHistoryTurns = Number(
    apiConfig.maxHistoryTurns || DEFAULT_MAX_HISTORY_TURNS
  );

  return {
    model: apiConfig.model || DEFAULT_DEEPSEEK_MODEL,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_CHAT_TIMEOUT_MS,
    maxHistoryTurns: Number.isFinite(maxHistoryTurns)
      ? maxHistoryTurns
      : DEFAULT_MAX_HISTORY_TURNS
  };
}

function normalizeChatInput(input) {
  if (typeof input === "string") {
    return input.trim();
  }

  if (input && typeof input.message === "string") {
    return input.message.trim();
  }

  return "";
}

function resolveModel(message, defaultModel) {
  if (message.startsWith("/pro ")) {
    return {
      model: PRO_DEEPSEEK_MODEL,
      message: message.slice(5).trim()
    };
  }

  if (message.startsWith("/flash ")) {
    return {
      model: DEFAULT_DEEPSEEK_MODEL,
      message: message.slice(7).trim()
    };
  }

  return {
    model: defaultModel,
    message
  };
}

function compactChatHistoryIfNeeded(maxHistoryTurns) {
  const maxMessages = Math.max(1, maxHistoryTurns) * 2;

  if (chatHistory.length <= maxMessages) {
    return;
  }

  const recentMessages = chatHistory.slice(-maxMessages);
  const summarySource = chatHistory
    .slice(0, -maxMessages)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(-1200);

  chatHistory = [
    {
      role: "user",
      content: `前情提要：上一段较长对话已归档，主要内容如下。\n${summarySource}`
    },
    {
      role: "assistant",
      content: "我会记住这段前情，继续陪你推进当前任务。"
    },
    ...recentMessages
  ];

  console.log("DeepSeek 会话过长，已开启新的摘要前缀。");
}

function logDeepSeekCacheUsage(usage) {
  if (!usage) return;

  const hitTokens = Number(usage.prompt_cache_hit_tokens || 0);
  const missTokens = Number(usage.prompt_cache_miss_tokens || 0);
  const totalCacheTokens = hitTokens + missTokens;
  const hitRate =
    totalCacheTokens > 0
      ? `${((hitTokens / totalCacheTokens) * 100).toFixed(1)}%`
      : "0.0%";

  console.log(
    `DeepSeek KVCache: hit=${hitTokens}, miss=${missTokens}, hitRate=${hitRate}`
  );
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function writeDeepSeekApiLog(entry) {
  try {
    fs.mkdirSync(DEEPSEEK_LOG_DIR, {
      recursive: true
    });

    const logDate = getLocalDateString();
    const logPath = path.join(DEEPSEEK_LOG_DIR, `deepseek-${logDate}.jsonl`);
    const payload = {
      loggedAt: new Date().toISOString(),
      ...entry
    };

    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf-8");
  } catch (error) {
    console.error("Failed to write DeepSeek API log:", error);
  }
}

async function sendDeepSeekChat(rawInput) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY。请先在 PowerShell 中设置环境变量。");
  }

  const inputMessage = normalizeChatInput(rawInput);

  if (!inputMessage) {
    throw new Error("请输入要和流萤说的话。");
  }

  const settings = getChatSettings();
  const modelResult = resolveModel(inputMessage, settings.model);
  const message = modelResult.message;

  if (!message) {
    throw new Error("请输入要和流萤说的话。");
  }

  compactChatHistoryIfNeeded(settings.maxHistoryTurns);

  const nextUserMessage = {
    role: "user",
    content: message
  };

  const messages = [
    {
      role: "system",
      content: readPersonaPrompt()
    },
    ...chatHistory,
    nextUserMessage
  ];

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => {
    controller.abort();
  }, settings.timeoutMs);
  const requestBody = {
    model: modelResult.model,
    messages,
    thinking: {
      type: "disabled"
    },
    temperature: 0.7,
    max_tokens: 240,
    user_id: CHAT_USER_ID
  };

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    const durationMs = Date.now() - startedAt;

    writeDeepSeekApiLog({
      type: "deepseek-chat",
      ok: response.ok,
      durationMs,
      request: {
        url: DEEPSEEK_API_URL,
        method: "POST",
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        body: data
      }
    });

    if (!response.ok) {
      const messageFromApi =
        data?.error?.message || data?.message || `HTTP ${response.status}`;
      const apiError = new Error(`DeepSeek 请求失败：${messageFromApi}`);
      apiError.deepSeekResponseLogged = true;
      throw apiError;
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("DeepSeek 返回为空。");
    }

    chatHistory.push(nextUserMessage);
    chatHistory.push({
      role: "assistant",
      content: reply
    });

    logDeepSeekCacheUsage(data.usage);

    return {
      reply,
      model: modelResult.model,
      usage: {
        promptCacheHitTokens: Number(data.usage?.prompt_cache_hit_tokens || 0),
        promptCacheMissTokens: Number(data.usage?.prompt_cache_miss_tokens || 0)
      }
    };
  } catch (error) {
    if (!error.deepSeekResponseLogged) {
      writeDeepSeekApiLog({
        type: "deepseek-chat",
        ok: false,
        durationMs: Date.now() - startedAt,
        request: {
          url: DEEPSEEK_API_URL,
          method: "POST",
          body: requestBody
        },
        error: {
          name: error.name,
          message: error.message
        }
      });
    }

    if (error.name === "AbortError") {
      throw new Error("DeepSeek 请求超时，请稍后再试。");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getDefaultSizeName() {
  const config = readPetConfig();
  const sizeName = config.defaultSize || "small";

  if (SIZE_PRESETS[sizeName]) {
    return sizeName;
  }

  return "small";
}

function createWindow() {
  const defaultSizeName = getDefaultSizeName();
  const defaultSize = SIZE_PRESETS[defaultSizeName];

  const workArea = screen.getPrimaryDisplay().workArea;

  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,

    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.setIgnoreMouseEvents(true, {
    forward: true
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("set-pet-width", defaultSize.petWidth);
    startCursorWatch();
  });

  mainWindow.webContents.on("context-menu", () => {
    if (!mainWindow) return;

    mainWindow.setIgnoreMouseEvents(false);
    showContextMenu();
  });
}

function showContextMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "大小切换",
      submenu: [
        {
          label: "迷你",
          click: () => resizePet("tiny")
        },
        {
          label: "小",
          click: () => resizePet("small")
        },
        {
          label: "正常",
          click: () => resizePet("normal")
        },
        {
          label: "大",
          click: () => resizePet("big")
        }
      ]
    },
    {
      label: "表情切换",
      submenu: [
        {
          label: "普通",
          click: () => sendPetAction("expression-normal")
        },
        {
          label: "开心",
          click: () => sendPetAction("expression-happy")
        },
        {
          label: "思考",
          click: () => sendPetAction("expression-thinking")
        },
        {
          label: "困困",
          click: () => sendPetAction("expression-sleepy")
        }
      ]
    },
    {
      type: "separator"
    },
    {
      label: "互动功能",
      submenu: [
        {
          label: "说一句话",
          click: () => sendPetAction("talk")
        },
        {
          label: "和流萤聊天",
          click: () => sendOpenChat()
        }
      ]
    },
    {
      type: "separator"
    },
    {
      label: "退出桌宠",
      click: () => {
        app.quit();
      }
    }
  ]);

  menu.popup({
    window: mainWindow,
    callback: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setIgnoreMouseEvents(true, {
          forward: true
        });
      }
    }
  });
}

function sendPetAction(actionName) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send("pet-action", actionName);
}

function sendOpenChat() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send("open-chat");
}

function startCursorWatch() {
  if (cursorWatchTimer) {
    clearInterval(cursorWatchTimer);
    cursorWatchTimer = null;
  }

  cursorWatchTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();

    const localX = cursor.x - bounds.x;
    const localY = cursor.y - bounds.y;

    const insideWindow =
      localX >= 0 &&
      localX <= bounds.width &&
      localY >= 0 &&
      localY <= bounds.height;

    mainWindow.webContents.send("global-cursor-move", {
      x: localX,
      y: localY,
      insideWindow
    });
  }, 30);
}

function resizePet(sizeName) {
  if (!mainWindow) return;

  const size = SIZE_PRESETS[sizeName];

  if (!size) return;

  mainWindow.webContents.send("set-pet-width", size.petWidth);
}

ipcMain.handle("get-pet-config", () => {
  return readPetConfig();
});

ipcMain.handle("deepseek-chat", async (_event, message) => {
  return sendDeepSeekChat(message);
});

ipcMain.on("set-mouse-ignore", (_event, ignore) => {
  if (!mainWindow) return;

  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, {
      forward: true
    });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on("show-context-menu", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.setIgnoreMouseEvents(false);
  showContextMenu();
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (cursorWatchTimer) {
    clearInterval(cursorWatchTimer);
    cursorWatchTimer = null;
  }

  app.quit();
});
