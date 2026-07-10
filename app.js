// app.js

// --- 1. 정적 데이터 보안 / 수치 검증 유틸리티 ---
function clampInt(val, min, max, defaultVal) {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(Math.max(parsed, min), max);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv');
}

// --- 2. 테마 정보 정의 ---
const THEMES = {
  dark: {
    id: 'dark',
    name: '미드나잇 다크',
    bg: 'bg-slate-950 text-slate-100',
    card: 'bg-slate-900/60 border-slate-800',
    accent: 'text-rose-500',
    accentBg: 'bg-rose-500',
    accentHover: 'hover:bg-rose-600',
    accentRing: 'ring-rose-500/30',
    progressColor: '#f43f5e',
    trackColor: '#1e293b',
    tabActive: 'bg-slate-800 text-rose-400',
    input: 'bg-slate-900 border-slate-700 text-slate-100',
    btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200'
  },
  light: {
    id: 'light',
    name: '미니멀 라이트',
    bg: 'bg-slate-50 text-slate-900',
    card: 'bg-white border-slate-200/80 shadow-sm',
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-700',
    accentRing: 'ring-indigo-600/30',
    progressColor: '#4f46e5',
    trackColor: '#e2e8f0',
    tabActive: 'bg-slate-100 text-indigo-600 font-semibold',
    input: 'bg-slate-50 border-slate-200 text-slate-900',
    btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800'
  },
  forest: {
    id: 'forest',
    name: '차분한 포레스트',
    bg: 'bg-stone-950 text-emerald-100',
    card: 'bg-stone-900/60 border-stone-800',
    accent: 'text-emerald-500',
    accentBg: 'bg-emerald-600',
    accentHover: 'hover:bg-emerald-700',
    accentRing: 'ring-emerald-500/30',
    progressColor: '#10b981',
    trackColor: '#292524',
    tabActive: 'bg-stone-800 text-emerald-400',
    input: 'bg-stone-800 border-stone-700 text-stone-100',
    btnSecondary: 'bg-stone-800 hover:bg-stone-700 text-stone-200'
  },
  rose: {
    id: 'rose',
    name: '로즈 블라썸',
    bg: 'bg-zinc-950 text-rose-100',
    card: 'bg-zinc-900/60 border-zinc-800',
    accent: 'text-pink-500',
    accentBg: 'bg-pink-500',
    accentHover: 'hover:bg-pink-600',
    accentRing: 'ring-pink-500/30',
    progressColor: '#ec4899',
    trackColor: '#27272a',
    tabActive: 'bg-zinc-800 text-pink-400',
    input: 'bg-zinc-800 border-zinc-700 text-zinc-100',
    btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
  }
};

let settings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  soundEnabled: true,
  soundType: 'bell',
  volume: 0.5,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  dailyGoal: 4
};

let currentTheme = THEMES.dark;
let currentMode = 'pomodoro';
let isRunning = false;
let timeLeft = 25 * 60;
let totalSeconds = 25 * 60;
let timerInterval = null;
let expectedEndTime = null;
let toastTimeout = null;

let tasks = [
  { id: '1', text: '포모도로 웹앱 핵심 설계 완료하기', completed: true, estPomos: 1, actPomos: 1 },
  { id: '2', text: 'HTML 포팅 및 스타일 마감작업', completed: false, estPomos: 2, actPomos: 0 },
  { id: '3', text: '오디오 피드백 기능 정교화 검증하기', completed: false, estPomos: 1, actPomos: 0 }
];
let activeTaskId = '2';

let stats = {
  completedToday: 0,
  totalFocusMinutes: 0,
  streak: 0,
  lastActiveDate: ""
};

// --- 3. 비동기식 커스텀 컨펌 모달 제어 ---
let confirmResolver = null;
function showConfirm(title, message) {
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-message').innerText = message;
  document.getElementById('confirm-modal').classList.remove('hidden');
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function handleConfirmResult(value) {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (confirmResolver) {
    confirmResolver(value);
    confirmResolver = null;
  }
}

// --- 4. 오디오 및 모바일 기능 ---
let globalAudioCtx = null;
function getAudioContext() {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      globalAudioCtx = new AudioContext();
    }
  }
  return globalAudioCtx;
}

async function playAudioTone(type = settings.soundType) {
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const masterVolume = settings.volume !== undefined ? settings.volume : 0.5;

    if (type === 'bell') {
          const playNote = (freq, time, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.2 * masterVolume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + duration);
          };
          const now = ctx.currentTime;
          playNote(523.25, now, 0.4);
          playNote(659.25, now + 0.15, 0.4);
          playNote(783.99, now + 0.3, 0.6);
    } else if (type === 'digital') {
          const now = ctx.currentTime;
          for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now + i * 0.25);
            gain.gain.setValueAtTime(0.1 * masterVolume, now + i * 0.25);
            gain.gain.setValueAtTime(0.1 * masterVolume, now + i * 0.25 + 0.10);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.15);
          }
    } else if (type === 'wood') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, ctx.currentTime);
          gain.gain.setValueAtTime(0.3 * masterVolume, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.warn("오디오 재생 실패:", err);
  }
}

function triggerMobileVibration() {
  if ("vibrate" in navigator) {
    navigator.vibrate([500, 250, 500]);
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendBackgroundNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    try {
      new Notification(title, { body: message });
    } catch (e) {
      console.warn("백그라운드 시스템 노티 발송 실패:", e);
    }
  }
}

function toggleMute() {
  settings.soundEnabled = !settings.soundEnabled;
  const muteIcon = document.getElementById('mute-icon');
  if (settings.soundEnabled) {
    muteIcon.setAttribute('data-lucide', 'volume-2');
    showToast('🔊 알림 소리가 활성화되었습니다.');
    getAudioContext(); 
  } else {
    muteIcon.setAttribute('data-lucide', 'volume-x');
    showToast('🔇 알림 소리가 음소거되었습니다.');
  }
  saveSettingsToStorage();
  lucide.createIcons();
}

// --- 5. 테마 설정 및 렌더링 ---
function setTheme(themeId) {
  const selected = THEMES[themeId];
  if (!selected) return;
  currentTheme = selected;

  localStorage.setItem('focustimer_theme', themeId);

  Object.keys(THEMES).forEach(id => {
    const btn = document.getElementById(`theme-btn-${id}`);
    if (id === themeId) {
      btn.classList.add('ring-2', 'ring-white', 'scale-110');
      btn.classList.remove('opacity-50');
    } else {
      btn.classList.remove('ring-2', 'ring-white', 'scale-110');
      btn.classList.add('opacity-50');
    }
  });

  const body = document.getElementById('app-body');
  body.className = `min-h-screen flex flex-col justify-between p-4 md:p-8 font-sans transition-colors duration-500 ${selected.bg} overflow-x-hidden`;

  const ids = ['timer-container-card', 'stats-container-card', 'tasks-container-card'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.className = `p-6 rounded-3xl border transition-colors duration-500 ${selected.card}`;
    if (id === 'timer-container-card') el.classList.add('md:p-8', 'flex', 'flex-col', 'items-center', 'justify-center');
    if (id === 'stats-container-card') el.classList.add('grid', 'grid-cols-3', 'gap-2', 'text-center', 'text-xs');
    if (id === 'tasks-container-card') el.classList.add('flex', 'flex-col', 'h-[340px]');
  });

  const logo = document.getElementById('header-logo-container');
  logo.className = `p-2 rounded-xl text-white shadow-lg transition-all ${selected.accentBg}`;

  document.getElementById('progress-bar').setAttribute('stroke', selected.progressColor);
  document.getElementById('progress-track').setAttribute('stroke', selected.trackColor);

  const playBtn = document.getElementById('btn-play-pause');
  playBtn.className = `p-5 rounded-3xl text-white shadow-xl shadow-rose-500/10 hover:scale-105 active:scale-95 transition-all w-24 flex justify-center ${selected.accentBg} ${selected.accentHover} ${selected.accentRing} ring-4`;

  const addTaskBtn = document.getElementById('btn-add-task-icon');
  addTaskBtn.className = `p-2 rounded-xl text-white transition-all flex items-center justify-center ${selected.accentBg} ${selected.accentHover}`;

  const setSaveBtn = document.getElementById('btn-save-settings');
  setSaveBtn.className = `flex-1 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-lg ${selected.accentBg} ${selected.accentHover}`;

  const confirmOkBtn = document.getElementById('btn-confirm-ok');
  confirmOkBtn.className = `flex-1 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-lg ${selected.accentBg} ${selected.accentHover}`;

  document.getElementById('set-daily-goal').className = `flex-1 ${themeId === 'dark' ? 'accent-rose-500' : themeId === 'light' ? 'accent-indigo-600' : themeId === 'forest' ? 'accent-emerald-600' : 'accent-pink-500'}`;
  document.getElementById('set-volume').className = `flex-1 ${themeId === 'dark' ? 'accent-rose-500' : themeId === 'light' ? 'accent-indigo-600' : themeId === 'forest' ? 'accent-emerald-600' : 'accent-pink-500'}`;

  const taskInput = document.getElementById('input-task-text');
  taskInput.className = `flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all ${selected.input}`;

  updateTabStyles();
}

function updateTabStyles() {
  const modes = ['pomodoro', 'shortBreak', 'longBreak'];
  modes.forEach(m => {
    const tab = document.getElementById(`tab-${m}`);
    if (currentMode === m) {
      tab.className = `flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center ${currentTheme.tabActive}`;
    } else {
      tab.className = `flex-1 py-2 text-xs font-semibold rounded-xl transition-all text-center opacity-60 hover:opacity-100`;
    }
  });
}

// --- 6. 타이머 작동 핵심 엔진 ---
function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  document.getElementById('timer-time-display').innerText = `${minutes}:${seconds}`;

  const emoji = currentMode === 'pomodoro' ? '🎯' : currentMode === 'shortBreak' ? '☕' : '🌴';
  document.title = `${emoji} ${minutes}:${seconds} | 프리미엄 포모도로`;

  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / totalSeconds;
  const offset = circumference * (1 - progress);
  
  const bar = document.getElementById('progress-bar');
  bar.setAttribute('stroke-dasharray', circumference);
  bar.setAttribute('stroke-dashoffset', offset);
}

async function changeMode(mode, force = false) {
  if (isRunning && !force) {
    const ok = await showConfirm('모드 변경', '타이머가 가동 중입니다. 정말 변경하시겠습니까?');
    if (!ok) return;
  }

  currentMode = mode;
  isRunning = false;
  clearInterval(timerInterval);

  let durationMinutes = settings.pomodoro;
  if (mode === 'shortBreak') durationMinutes = settings.shortBreak;
  if (mode === 'longBreak') durationMinutes = settings.longBreak;

  timeLeft = durationMinutes * 60;
  totalSeconds = durationMinutes * 60;

  const subText = document.getElementById('timer-sub-text');
  subText.innerText = mode === 'pomodoro' ? 'Focusing' : 'Resting';

  updateTimerDisplay();
  updateTabStyles();
  updatePlayButtonUI();
}

function togglePlay() {
  getAudioContext();
  requestNotificationPermission();

  if (isRunning) {
    isRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-status-badge').innerText = '일시정지';
    document.getElementById('timer-status-badge').className = "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all bg-amber-500/10 text-amber-400";
  } else {
    isRunning = true;
    playAudioFeedbackClick();
    
    document.getElementById('timer-status-badge').innerText = '진행 중';
    document.getElementById('timer-status-badge').className = "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all bg-emerald-500/10 text-emerald-400 animate-pulse";
    
    expectedEndTime = Date.now() + timeLeft * 1000;

    timerInterval = setInterval(() => {
      const remaining = Math.round((expectedEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        timeLeft = 0;
        updateTimerDisplay();
        clearInterval(timerInterval);
        handleTimeComplete();
      } else {
        timeLeft = remaining;
        updateTimerDisplay();
      }
    }, 200);
  }
  updatePlayButtonUI();
}

function resetTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  
  let durationMinutes = settings.pomodoro;
  if (currentMode === 'shortBreak') durationMinutes = settings.shortBreak;
  if (currentMode === 'longBreak') durationMinutes = settings.longBreak;

  timeLeft = durationMinutes * 60;
  totalSeconds = durationMinutes * 60;

  document.getElementById('timer-status-badge').innerText = '대기 중';
  document.getElementById('timer-status-badge').className = "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all bg-amber-500/10 text-amber-400";
  
  updateTimerDisplay();
  updatePlayButtonUI();
}

async function skipTimer() {
  const ok = await showConfirm('건너뛰기', '현재 진행중인 타이머를 건너뛰시겠습니까? (완료 기록에는 가산되지 않습니다.)');
  if (ok) {
    if (currentMode === 'pomodoro') {
      changeMode('shortBreak', true);
    } else {
      changeMode('pomodoro', true);
    }
  }
}

function handleTimeComplete() {
  isRunning = false;
  updatePlayButtonUI();
  playAudioTone();
  triggerMobileVibration();

  if (currentMode === 'pomodoro') {
    showToast('👏 집중이 완료되었습니다! 잠시 머리를 비워 보세요.');
    sendBackgroundNotification('🎯 타이머 완료', '집중 세션이 마감되었습니다. 휴식을 취하세요!');
    
    if (stats.completedToday === 0) {
      stats.streak += 1;
    }
    stats.completedToday += 1;
    stats.totalFocusMinutes += settings.pomodoro;
    stats.lastActiveDate = new Date().toLocaleDateString('sv');
    
    saveStats();
    updateStatsPanel();

    if (activeTaskId) {
      tasks = tasks.map(t => t.id === activeTaskId ? { ...t, actPomos: t.actPomos + 1 } : t);
      saveTasksToStorage();
      renderTaskList();
    }

    const next = (stats.completedToday) % 4 === 0 ? 'longBreak' : 'shortBreak';
    
    if (settings.autoStartBreaks) {
      setTimeout(() => {
        changeMode(next, true);
        togglePlay();
      }, 1500);
    } else {
      changeMode(next, true);
    }
  } else {
    showToast('💪 휴식이 완료되었습니다! 다음 세션에 몰입하세요.');
    sendBackgroundNotification('☕ 휴식 종료', '휴식 세션이 끝났습니다. 다시 집중할 시간입니다!');
    
    if (settings.autoStartPomodoros) {
      setTimeout(() => {
        changeMode('pomodoro', true);
        togglePlay();
      }, 1500);
    } else {
      changeMode('pomodoro', true);
    }
  }
}

// --- 7. 태스크 관리 엔진 ---
function renderTaskList() {
  const listWrapper = document.getElementById('task-list-wrapper');
  listWrapper.innerHTML = '';

  if (tasks.length === 0) {
    listWrapper.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
        <p>등록된 할 일이 없습니다.</p>
        <p class="mt-1 opacity-80">새 할 일을 추가하고 집중을 시작하세요!</p>
      </div>
    `;
    document.getElementById('task-undone-count').innerText = '0개 남음';
    document.getElementById('active-task-badge').classList.add('hidden');
    return;
  }

  const undoneCount = tasks.filter(t => !t.completed).length;
  document.getElementById('task-undone-count').innerText = `${undoneCount}개 남음`;

  tasks.forEach((task) => {
    const isSelected = activeTaskId === task.id;
    const div = document.createElement('div');
    div.onclick = () => selectActiveTask(task.id);
    div.className = `p-3 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
      isSelected ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5 hover:bg-white/5'
    }`;

    const safeText = escapeHtml(task.text);

    div.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <button type="button" onclick="event.stopPropagation(); toggleTaskCompletion('${task.id}')" class="w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
          task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20 hover:border-white/40'
        }">${task.completed ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}</button>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold truncate ${task.completed ? 'line-through opacity-40' : ''}">${safeText}</p>
          <div class="flex items-center gap-1 mt-0.5">
            <span class="text-[10px] opacity-60">예상 ${task.estPomos}개</span>
            <span class="text-[10px] text-slate-500">•</span>
            <span class="text-[10px] font-bold text-rose-400">완료 ${task.actPomos}개</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1.5 ml-2">
        ${isSelected ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">선택됨</span>' : ''}
        <button onclick="event.stopPropagation(); deleteTask('${task.id}')" class="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-all" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>
    `;
    listWrapper.appendChild(div);
  });

  const activeTask = tasks.find(t => t.id === activeTaskId);
  if (activeTask) {
    document.getElementById('active-task-badge').classList.remove('hidden');
    document.getElementById('active-task-name').innerText = escapeHtml(activeTask.text);
  } else {
    document.getElementById('active-task-badge').classList.add('hidden');
  }

  lucide.createIcons();
}

function selectActiveTask(id) {
  activeTaskId = id;
  renderTaskList();
}

function handleAddTask() {
  const input = document.getElementById('input-task-text');
  const estInput = document.getElementById('input-task-est');
  const text = input.value.trim();
  const est = clampInt(estInput.value, 1, 10, 1);

  if (!text) return;

  const newTask = {
    id: Date.now().toString(),
    text: text,
    completed: false,
    estPomos: est,
    actPomos: 0
  };

  tasks.push(newTask);
  if (!activeTaskId) {
    activeTaskId = newTask.id;
  }

  input.value = '';
  estInput.value = '1';
  saveTasksToStorage();
  renderTaskList();
  showToast('📝 새로운 할 일이 정상적으로 추가되었습니다.');
}

function toggleTaskCompletion(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveTasksToStorage();
  renderTaskList();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (activeTaskId === id) {
    activeTaskId = tasks.length > 0 ? tasks[0].id : null;
  }
  saveTasksToStorage();
  renderTaskList();
}

// --- 8. 영속성 데이터 저장 / 초기화 엔진 ---
function loadStats() {
  const saved = localStorage.getItem('focustimer_stats');
  const today = new Date().toLocaleDateString('sv');
  const yesterday = getYesterdayString();
  
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      stats = { ...stats, ...parsed };
    } catch (e) {
      console.error("통계 데이터 수집 오류:", e);
    }
  }

  if (stats.lastActiveDate) {
    if (stats.lastActiveDate === today) {
      // 당일 데이터 수집상태 유지
    } else if (stats.lastActiveDate === yesterday) {
      stats.completedToday = 0;
    } else {
      stats.completedToday = 0;
      stats.streak = 0;
    }
  } else {
    stats.completedToday = 0;
    stats.streak = 0;
    stats.totalFocusMinutes = 0;
  }
  
  stats.lastActiveDate = today;
  saveStats();
}

function saveStats() {
  localStorage.setItem('focustimer_stats', JSON.stringify(stats));
}

function updateStatsPanel() {
  document.getElementById('stat-streak').innerText = `${stats.streak}일 연속`;
  document.getElementById('stat-today').innerText = `${stats.completedToday} / ${settings.dailyGoal} 🍅`;
  document.getElementById('stat-minutes').innerText = `${stats.totalFocusMinutes}분`;
}

async function resetStat(type) {
  getAudioContext();
  let title = '';
  let message = '';
  if (type === 'streak') {
    title = '연속 집중 초기화';
    message = '연속으로 몰입 달성하신 일수를 0일로 초기화하시겠습니까?';
  } else if (type === 'today') {
    title = '오늘의 뽀모 초기화';
    message = '오늘 마감한 뽀모도로 세션 달성량을 0으로 변경하시겠습니까?';
  } else if (type === 'minutes') {
    title = '누적 시간 초기화';
    message = '총 집중하신 누적 시간 기록을 모두 소거하시겠습니까?';
  }

  const ok = await showConfirm(title, message);
  if (ok) {
    if (type === 'streak') stats.streak = 0;
    else if (type === 'today') stats.completedToday = 0;
    else if (type === 'minutes') stats.totalFocusMinutes = 0;
    saveStats();
    updateStatsPanel();
    showToast('🔄 선택한 통계 이력이 성공적으로 초기화되었습니다.');
  }
}

// --- 9. 스토리지 제어 가이더 ---
function saveSettingsToStorage() {
  localStorage.setItem('focustimer_settings', JSON.stringify(settings));
}

// --- 10. 세팅 패널 제어 ---
function openSettings() {
  getAudioContext();

  document.getElementById('set-pomodoro').value = settings.pomodoro;
  document.getElementById('set-short-break').value = settings.shortBreak;
  document.getElementById('set-long-break').value = settings.longBreak;
  document.getElementById('set-daily-goal').value = settings.dailyGoal;
  document.getElementById('label-daily-goal').innerText = `🍅 ${settings.dailyGoal}회`;
  
  const volPercent = Math.round(settings.volume * 100);
  document.getElementById('set-volume').value = volPercent;
  document.getElementById('label-volume').innerText = `${volPercent}%`;

  document.getElementById('set-auto-break').value = settings.autoStartBreaks.toString();
  document.getElementById('set-auto-pomo').value = settings.autoStartPomodoros.toString();

  updateSoundSelectionUI();

  document.getElementById('settings-modal').classList.remove('hidden');
}

function updateSoundSelectionUI() {
  const types = ['bell', 'digital', 'wood'];
  types.forEach(t => {
    const btn = document.getElementById(`bell-type-${t}`);
    if (settings.soundType === t) {
      btn.className = "py-2 px-2 text-xs rounded-xl border border-rose-500/60 bg-rose-500/10 text-rose-300 font-bold";
    } else {
      btn.className = "py-2 px-2 text-xs rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400";
    }
  });
}

async function previewSoundType(type) {
  settings.soundType = type;
  updateSoundSelectionUI();
  const sliderVal = parseInt(document.getElementById('set-volume').value, 10) || 0;
  settings.volume = sliderVal / 100;
  await playAudioTone(type);
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  settings.pomodoro = clampInt(document.getElementById('set-pomodoro').value, 1, 120, 25);
  settings.shortBreak = clampInt(document.getElementById('set-short-break').value, 1, 60, 5);
  settings.longBreak = clampInt(document.getElementById('set-long-break').value, 1, 60, 15);
  settings.dailyGoal = clampInt(document.getElementById('set-daily-goal').value, 1, 12, 4);
  
  settings.volume = clampInt(document.getElementById('set-volume').value, 0, 100, 50) / 100;

  settings.autoStartBreaks = document.getElementById('set-auto-break').value === 'true';
  settings.autoStartPomodoros = document.getElementById('set-auto-pomo').value === 'true';

  saveSettingsToStorage();
  closeSettings();
  resetTimer();
  updateStatsPanel();
  showToast('⚙️ 설정 옵션이 최신 사양으로 적용되었습니다.');
}

// --- 11. 토스트 기법 ---
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  document.getElementById('toast-text').innerText = message;
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toast.classList.remove('scale-0', 'opacity-0');
  toast.classList.add('scale-100', 'opacity-100');

  toastTimeout = setTimeout(() => {
    hideToast();
  }, 4000);
}

function hideToast() {
  const toast = document.getElementById('toast-notification');
  toast.classList.remove('scale-100', 'opacity-100');
  toast.classList.add('scale-0', 'opacity-0');
}
