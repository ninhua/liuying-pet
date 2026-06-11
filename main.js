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