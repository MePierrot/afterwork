const FIXED_WORK_MINUTES = 8 * 60 + 45;

const nameInput = document.getElementById('nameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const cancelNameBtn = document.getElementById('cancelNameBtn');
const editNameBtn = document.getElementById('editNameBtn');
const nameStatusText = document.getElementById('nameStatusText');
const nameModalMask = document.getElementById('nameModalMask');
const nameModalTitle = document.getElementById('nameModalTitle');

const startTimeInput = document.getElementById('startTimeInput');
const selectedStartText = document.getElementById('selectedStartText');
const reminderText = document.getElementById('reminderText');
const calcBtn = document.getElementById('calcBtn');
const resetBtn = document.getElementById('resetBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const offworkText = document.getElementById('offworkText');
const countdownText = document.getElementById('countdownText');
const resultCard = document.getElementById('resultCard');

let offWorkDate = null;
let reminderDebounceTimer = null;
let currentUserName = '';

function pad2(v) {
  return String(v).padStart(2, '0');
}

function parseTime(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    throw new Error('时间格式错误，请输入 HH:MM');
  }

  const hour = Number(m[1]);
  const minute = Number(m[2]);

  if (hour > 23 || minute > 59) {
    throw new Error('时间超出范围');
  }

  return { hour, minute };
}

function formatDate(date) {
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function formatCountdown(ms) {
  const prefix = ms < 0 ? '已超时 ' : '剩余 ';
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = pad2(Math.floor(totalSeconds / 3600));
  const minutes = pad2(Math.floor((totalSeconds % 3600) / 60));
  const seconds = pad2(totalSeconds % 60);
  return `${prefix}${hours}:${minutes}:${seconds}`;
}

function updateReminderText(targetTs) {
  if (!targetTs || targetTs <= Date.now()) {
    reminderText.textContent = '提醒状态：未设置';
    return;
  }
  reminderText.textContent = `提醒状态：已设置（${formatDate(new Date(targetTs))}）`;
}

function updateNameStatus(name) {
  nameStatusText.textContent = name ? `当前姓名：${name}` : '当前姓名：未设置';
}

function openNameModal({ force = false, presetName = '' } = {}) {
  nameModalMask.hidden = false;
  nameModalMask.dataset.force = force ? '1' : '0';
  nameModalTitle.textContent = force ? '请先填写姓名' : '修改姓名';
  nameInput.value = presetName || '';
  cancelNameBtn.style.display = force ? 'none' : 'inline-block';
  nameInput.focus();
}

function closeNameModal() {
  nameModalMask.hidden = true;
}

async function initUserName() {
  const name = (await window.appBridge.getUserName()) || '';
  currentUserName = name;
  updateNameStatus(currentUserName);

  if (!currentUserName) {
    openNameModal({ force: true });
  }
}

async function saveUserName() {
  const name = nameInput.value.trim();
  if (!name) {
    window.alert('请先输入姓名');
    return;
  }
  const saved = await window.appBridge.saveUserName(name);
  currentUserName = saved;
  updateNameStatus(currentUserName);
  closeNameModal();
}

async function scheduleReminderDebounced(startTime, targetTs) {
  if (reminderDebounceTimer) {
    clearTimeout(reminderDebounceTimer);
  }

  reminderDebounceTimer = setTimeout(async () => {
    const reminder = await window.appBridge.scheduleReminder({
      targetTs,
      startTime
    });
    updateReminderText(reminder?.fireAt || null);
  }, 220);
}

function calculateOffWork({ showError = false } = {}) {
  try {
    const { hour, minute } = parseTime(startTimeInput.value);
    const startTime = `${pad2(hour)}:${pad2(minute)}`;
    selectedStartText.textContent = startTime;

    const now = new Date();
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);

    offWorkDate = new Date(start.getTime() + FIXED_WORK_MINUTES * 60 * 1000);
    offworkText.textContent = `下班时间：${formatDate(offWorkDate)}`;
    updateCountdown();

    scheduleReminderDebounced(startTime, offWorkDate.getTime());
    return true;
  } catch (err) {
    if (showError) {
      window.alert(err.message || '计算失败');
    }
    return false;
  }
}

function updateCountdown() {
  if (!offWorkDate) {
    countdownText.textContent = '下班倒计时：--:--:--';
    resultCard.classList.remove('overtime');
    return;
  }

  const diff = offWorkDate.getTime() - Date.now();
  countdownText.textContent = `下班倒计时：${formatCountdown(diff)}`;
  resultCard.classList.toggle('overtime', diff < 0);
}

function resetForm() {
  startTimeInput.value = '09:00';
  selectedStartText.textContent = '09:00';
  calculateOffWork();
}

window.appBridge.onReminderFired(() => {
  reminderText.textContent = '提醒状态：已触发';
});

saveNameBtn.addEventListener('click', saveUserName);
cancelNameBtn.addEventListener('click', () => closeNameModal());
editNameBtn.addEventListener('click', () => openNameModal({ force: false, presetName: currentUserName }));

nameModalMask.addEventListener('click', (event) => {
  if (event.target !== nameModalMask) {
    return;
  }
  if (nameModalMask.dataset.force === '1') {
    return;
  }
  closeNameModal();
});

startTimeInput.addEventListener('input', () => calculateOffWork());
startTimeInput.addEventListener('change', () => calculateOffWork({ showError: true }));
calcBtn.addEventListener('click', () => calculateOffWork({ showError: true }));
resetBtn.addEventListener('click', resetForm);
minimizeBtn.addEventListener('click', () => window.appBridge.minimizeToTray());

(async () => {
  await initUserName();
  calculateOffWork();
  setInterval(updateCountdown, 1000);
})();
