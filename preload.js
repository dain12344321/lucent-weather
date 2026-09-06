const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("weather", {
  toggle: () => ipcRenderer.invoke("toggle"),
  hide: () => ipcRenderer.invoke("hide"),
  menu: () => ipcRenderer.invoke("menu"),
  onTick: (fn) => ipcRenderer.on("tick", fn),
  settings: () => ipcRenderer.invoke("settings"),
  search: (q) => ipcRenderer.invoke("search", q),
  select: (p, u) => ipcRenderer.invoke("select", p, u),
  refresh: () => ipcRenderer.invoke("refresh"),
  onUpdate: (fn) => ipcRenderer.on("weather", (_, data) => fn(data)),
});
