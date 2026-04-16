const { app, BrowserWindow, screen, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_ID = 'com.afterwork.calculator';
const APP_ICON_PATH = path.join(__dirname, 'logo2.ico');
const PROFILE_FILE = 'afterwork-profile.json';
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/dad56d1d-a099-43e8-8a5e-29890b15a9b2';

const TEXT = {
  appTitle: '\u4e0b\u73ed\u65f6\u95f4\u8ba1\u7b97\u5668',
  trayTip: '\u4e0b\u73ed\u65f6\u95f4\u8ba1\u7b97\u5668',
  trayOpen: '\u6253\u5f00',
  trayMinimize: '\u6700\u5c0f\u5316\u5230\u6258\u76d8',
  trayExit: '\u9000\u51fa',
  notifyTitle: '\u4e0b\u73ed\u63d0\u9192',
  notifyBodyDefault: '\u4f60\u8be5\u53bb\u73a9\u6d1b\u514b\u738b\u56fd\u4e86'
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;
let reminderStartTime = null;
let userProfile = { userName: '' };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAdaptiveWindowSize() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const width = clamp(Math.round(sw * 0.36), 520, 760);
  const height = clamp(Math.round(sh * 1.0), 560, 900);
  return { width, height };
}

function getProfilePath() {
  return path.join(app.getPath('userData'), PROFILE_FILE);
}

function loadProfile() {
  const filePath = getProfilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    userProfile.userName = typeof parsed.userName === 'string' ? parsed.userName.trim() : '';
  } catch (_) {
    userProfile.userName = '';
  }
}

function saveProfile() {
  const filePath = getProfilePath();
  fs.writeFileSync(filePath, JSON.stringify(userProfile, null, 2), 'utf8');
}

function createTrayIcon() {
  const icoPath = APP_ICON_PATH;
  if (fs.existsSync(icoPath)) {
    const icoImage = nativeImage.createFromPath(icoPath);
    if (!icoImage.isEmpty()) {
      return icoImage.resize({ width: 18, height: 18 });
    }
  }

  const webpPath = path.join(__dirname, 'logo2.webp');
  if (fs.existsSync(webpPath)) {
    const webpImage = nativeImage.createFromPath(webpPath);
    if (!webpImage.isEmpty()) {
      return webpImage.resize({ width: 18, height: 18 });
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <circle cx="32" cy="32" r="30" fill="#b73c2f"/>
      <circle cx="32" cy="32" r="18" fill="#ffd39a"/>
    </svg>
  `;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.setSkipTaskbar(false);
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow) {
    return;
  }
  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip(TEXT.trayTip);
  tray.on('double-click', showWindow);

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: TEXT.trayOpen, click: showWindow },
      { label: TEXT.trayMinimize, click: hideToTray },
      { type: 'separator' },
      {
        label: TEXT.trayExit,
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function clearReminder() {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
  reminderStartTime = null;
}

async function sendFeishuOffWorkMessage() {
  const name = userProfile.userName || '\u4f60';
  const text = `${name}\u4f60\u53ef\u4ee5\u4e0b\u73ed\u73a9\u6d1b\u514b\u738b\u56fd\u4e86`;

  try {
    await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text }
      })
    });
  } catch (_) {
    // Do not block local reminder on network failure.
  }
}

function notifyOffWork() {
  const body = TEXT.notifyBodyDefault;

  [0, 2000, 4000].forEach((delayMs) => {
    setTimeout(() => {
      new Notification({ title: TEXT.notifyTitle, body }).show();
    }, delayMs);
  });

  void sendFeishuOffWorkMessage();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reminder:fired');
  }
  clearReminder();
}

function scheduleReminder(targetTs, startTime) {
  clearReminder();

  if (!Number.isFinite(targetTs) || targetTs <= Date.now()) {
    return { scheduled: false };
  }

  reminderStartTime = startTime || null;
  reminderTimer = setTimeout(notifyOffWork, targetTs - Date.now());

  return { scheduled: true, fireAt: targetTs };
}

function createWindow() {
  const { width, height } = getAdaptiveWindowSize();

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 520,
    minHeight: 560,
    resizable: true,
    title: TEXT.appTitle,
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    hideToTray();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideToTray();
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-user-name', () => userProfile.userName || '');

  ipcMain.handle('app:save-user-name', (_event, userName) => {
    const name = typeof userName === 'string' ? userName.trim() : '';
    userProfile.userName = name;
    saveProfile();
    return userProfile.userName;
  });

  ipcMain.handle('app:schedule-reminder', (_event, payload) => {
    const targetTs = Number(payload?.targetTs);
    const startTime = typeof payload?.startTime === 'string' ? payload.startTime : null;
    return scheduleReminder(targetTs, startTime);
  });

  ipcMain.handle('app:minimize-to-tray', () => {
    hideToTray();
    return true;
  });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.setAppUserModelId(APP_ID);
  registerIpcHandlers();

  app.whenReady().then(() => {
    loadProfile();
    createTray();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        showWindow();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    clearReminder();
  });

  app.on('window-all-closed', (event) => {
    event.preventDefault();
  });
}
