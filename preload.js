const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  getPetConfig: () => {
    return ipcRenderer.invoke("get-pet-config");
  },

  setMouseIgnore: (ignore) => {
    ipcRenderer.send("set-mouse-ignore", ignore);
  },

  onSetPetWidth: (callback) => {
    ipcRenderer.on("set-pet-width", (_event, width) => {
      callback(width);
    });
  },

  onGlobalCursorMove: (callback) => {
    ipcRenderer.on("global-cursor-move", (_event, data) => {
      callback(data);
    });
  },

  onPetAction: (callback) => {
    ipcRenderer.on("pet-action", (_event, actionName) => {
      callback(actionName);
    });
  }
});