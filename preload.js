const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appBridge', {
  getUserName: () => ipcRenderer.invoke('app:get-user-name'),
  saveUserName: (userName) => ipcRenderer.invoke('app:save-user-name', userName),
  scheduleReminder: (payload) => ipcRenderer.invoke('app:schedule-reminder', payload),
  minimizeToTray: () => ipcRenderer.invoke('app:minimize-to-tray'),
  onReminderFired: (callback) => {
    ipcRenderer.on('reminder:fired', callback);
  }
});
