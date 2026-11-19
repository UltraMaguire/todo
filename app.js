/**
 * AURA // Next-Gen Productivity & Focus OS
 * Production-ready Web Application Logic
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DATA MODELS & INITIAL STATE
  // ==========================================================================

  const STORAGE_KEY_TASKS = 'aura_tasks_v2';
  const STORAGE_KEY_USER = 'aura_user_v2';
  const STORAGE_KEY_THEME = 'aura_theme_v2';
  const STORAGE_KEY_SFX = 'aura_sfx_v2';

  // Initial Seed Data for new users to demonstrate the rich UI immediately
  const DEMO_TASKS = [
    {
      id: 'task-1',
      title: 'Architect Next-Gen API Pipeline #engineering !high ~45m ⚡deep',
      completed: false,
      priority: 'high',
      energy: 'deep',
      status: 'in-progress',
      quadrant: 'q1',
      dueDate: getRelativeDate(0), // Today
      tag: 'Engineering',
      estimate: 45,
      focusTimeLogged: 25,
      notes: 'Design streaming response pipeline and evaluate latency with WebSockets.',
      subtasks: [
        { id: 'sub-1', text: 'Define protobuf contract schemas', done: true },
        { id: 'sub-2', text: 'Implement worker thread pool', done: false },
        { id: 'sub-3', text: 'Benchmarking and stress tests', done: false }
      ],
      starred: true,
      createdAt: Date.now() - 86400000
    },
    {
      id: 'task-2',
      title: 'Review Design System Figma Tokens #design !med ~25m ⚡high',
      completed: false,
      priority: 'medium',
      energy: 'high',
      status: 'review',
      quadrant: 'q2',
      dueDate: getRelativeDate(1), // Tomorrow
      tag: 'Design',
      estimate: 25,
      focusTimeLogged: 0,
      notes: 'Verify contrast ratios and micro-interaction curves across dark palettes.',
      subtasks: [
        { id: 'sub-4', text: 'Inspect glassmorphism borders', done: true },
        { id: 'sub-5', text: 'Check mobile responsive breakpoints', done: true }
      ],
      starred: false,
      createdAt: Date.now() - 36000000
    },
    {
      id: 'task-3',
      title: 'Clear email inbox & triage customer queries #ops !low ~15m ☕low',
      completed: false,
      priority: 'low',
      energy: 'low',
      status: 'backlog',
      quadrant: 'q3',
      dueDate: getRelativeDate(2),
      tag: 'Ops',
      estimate: 15,
      focusTimeLogged: 0,
      notes: 'Quick low-friction task for when energy dips in the late afternoon.',
      subtasks: [],
      starred: false,
      createdAt: Date.now() - 10000000
    },
    {
      id: 'task-4',
      title: 'Refactor state persistence sync #core !urgent ~30m ⚡deep',
      completed: true,
      priority: 'urgent',
      energy: 'deep',
      status: 'completed',
      quadrant: 'q1',
      dueDate: getRelativeDate(-1),
      tag: 'Core',
      estimate: 30,
      focusTimeLogged: 30,
      notes: 'Ensure instant LocalStorage updates without frame hitching.',
      subtasks: [
        { id: 'sub-6', text: 'Implement event debounce', done: true }
      ],
      starred: true,
      createdAt: Date.now() - 120000000,
      completedAt: Date.now() - 3600000
    }
  ];

  const INITIAL_USER = {
    xp: 420,
    level: 1,
    streak: 0,
    lastActiveDate: getRelativeDate(0),
    focusMinutes: 0,
    completedCount: 8
  };

  const RANKS = [
    { level: 1, minXp: 0, title: 'Novice Seeker' },
    { level: 2, minXp: 200, title: 'Flow Initiate' },
    { level: 3, minXp: 400, title: 'Flow Adept' },
    { level: 4, minXp: 750, title: 'Focus Architect' },
    { level: 5, minXp: 1200, title: 'Grandmaster of Orbit' }
  ];

  // Helper date utility
  function getRelativeDate(offsetDays) {
    // Use local calendar dates; toISOString() can shift the date across time zones.
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ==========================================================================
  // 2. STATE REPOSITORY
  // ==========================================================================

  let tasks = loadTasks();
  let user = loadUser();
  let activeView = 'list'; // 'list' | 'kanban' | 'matrix'
  let activeFilter = 'all'; // 'all' | 'today' | 'upcoming' | 'starred'
  let activeEnergy = 'all'; // 'all' | 'deep' | 'high' | 'low'
  let searchQuery = '';
  let activeSort = 'due-asc';
  let activeEditingTaskId = null;
  let activeFocusTaskId = null;
  let sfxEnabled = localStorage.getItem(STORAGE_KEY_SFX) !== 'false';

  function normalizeTask(task, index = 0) {
    const source = task && typeof task === 'object' && !Array.isArray(task) ? task : {};
    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    const validEnergy = ['deep', 'high', 'medium', 'low'];
    const validStatuses = ['backlog', 'in-progress', 'review', 'completed'];
    const subtasks = Array.isArray(source.subtasks) ? source.subtasks : [];

    return {
      ...source,
      id: String(source.id || `task-restored-${Date.now()}-${index}`),
      title: typeof source.title === 'string' ? source.title : '',
      completed: Boolean(source.completed),
      priority: validPriorities.includes(source.priority) ? source.priority : 'medium',
      energy: validEnergy.includes(source.energy) ? source.energy : 'medium',
      status: source.completed ? 'completed' : (validStatuses.includes(source.status) && source.status !== 'completed' ? source.status : 'in-progress'),
      quadrant: ['q1', 'q2', 'q3', 'q4'].includes(source.quadrant) ? source.quadrant : 'q2',
      dueDate: typeof source.dueDate === 'string' ? source.dueDate : '',
      tag: typeof source.tag === 'string' ? source.tag : '',
      estimate: Number.isFinite(Number(source.estimate)) && Number(source.estimate) > 0 ? Number(source.estimate) : 25,
      focusTimeLogged: Number.isFinite(Number(source.focusTimeLogged)) && Number(source.focusTimeLogged) >= 0 ? Number(source.focusTimeLogged) : 0,
      notes: typeof source.notes === 'string' ? source.notes : '',
      subtasks: subtasks.filter(sub => sub && typeof sub === 'object' && typeof sub.text === 'string').map((sub, subIndex) => ({
        ...sub,
        id: String(sub.id || `sub-restored-${Date.now()}-${index}-${subIndex}`),
        text: sub.text,
        done: Boolean(sub.done)
      })),
      starred: Boolean(source.starred),
      createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now()
    };
  }

  function normalizeUser(profile) {
    const source = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
    const numberOr = (value, fallback) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
    return {
      ...INITIAL_USER,
      ...source,
      xp: numberOr(source.xp, INITIAL_USER.xp),
      level: Math.max(1, Math.floor(numberOr(source.level, INITIAL_USER.level))),
      streak: numberOr(source.streak, INITIAL_USER.streak),
      focusMinutes: numberOr(source.focusMinutes, INITIAL_USER.focusMinutes),
      completedCount: numberOr(source.completedCount, INITIAL_USER.completedCount),
      lastActiveDate: typeof source.lastActiveDate === 'string' ? source.lastActiveDate : INITIAL_USER.lastActiveDate
    };
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TASKS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(normalizeTask);
        console.warn('Saved task data was not an array; loading demo tasks instead.');
      }
    } catch (e) {
      console.warn('Could not read tasks from localStorage', e);
    }
    return DEMO_TASKS.map(normalizeTask);
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
    updateStatsBanner();
  }

  function loadUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (raw) {
        const parsed = normalizeUser(JSON.parse(raw));
        // Check daily streak using the same local-date convention as task due dates.
        const today = getRelativeDate(0);
        if (parsed.lastActiveDate !== today) {
          const yesterday = getRelativeDate(-1);
          if (parsed.lastActiveDate === yesterday) parsed.streak += 1;
          parsed.lastActiveDate = today;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read user profile', e);
    }
    return { ...INITIAL_USER };
  }

  function saveUser() {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user', e);
    }
    renderUserStats();
  }

  function gainXP(amount, reason = '') {
    user.xp += amount;
    const oldLevel = user.level;
    let newLevel = 1;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (user.xp >= RANKS[i].minXp) {
        newLevel = RANKS[i].level;
        break;
      }
    }
    if (newLevel > oldLevel) {
      user.level = newLevel;
      soundManager.playLevelUp();
      showToast(`⚡ LEVEL UP! You are now Level ${newLevel}: ${getRankTitle(newLevel)}!`);
    } else if (reason) {
      showToast(`+${amount} XP: ${reason}`);
    }
    saveUser();
  }

  function getRankTitle(lvl) {
    const found = RANKS.find(r => r.level === lvl);
    return found ? found.title : 'Flow Architect';
  }

  // ==========================================================================
  // 3. SYNTHESIZED AUDIO & AMBIENT ENGINE (Web Audio API)
  // ==========================================================================
  // 100% Offline, no external mp3 or CDN files needed.
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.ambientGainNode = null;
      this.ambientSourceNode = null;
      this.currentAmbientTrack = 'off';
    }

    initCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClick() {
      if (!sfxEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.045);
      } catch (e) {}
    }

    playSuccess() {
      if (!sfxEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + idx * 0.05);
          gain.gain.setValueAtTime(0.08, t + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.05 + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + idx * 0.05);
          osc.stop(t + idx * 0.05 + 0.36);
        });
      } catch (e) {}
    }

    playLevelUp() {
      if (!sfxEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880, 1108.73];
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + i * 0.08);
          gain.gain.setValueAtTime(0.15, t + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + i * 0.08);
          osc.stop(t + i * 0.08 + 0.45);
        });
      } catch (e) {}
    }

    playChime() {
      if (!sfxEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t); // D5
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.15); // A5
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      } catch (e) {}
    }

    setAmbientTrack(trackType, volume = 0.3) {
      this.initCtx();
      if (!this.ctx) return;

      this.stopAmbient();
      if (trackType === 'off') {
        this.currentAmbientTrack = 'off';
        updateAmbientUI(false);
        return;
      }

      this.currentAmbientTrack = trackType;
      this.ambientGainNode = this.ctx.createGain();
      this.ambientGainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      this.ambientGainNode.connect(this.ctx.destination);

      if (trackType === 'whitenoise') {
        // Synthesize White Noise Buffer
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Lowpass filter for smooth soft noise
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1400;

        whiteNoise.connect(filter);
        filter.connect(this.ambientGainNode);
        whiteNoise.start(0);
        this.ambientSourceNode = whiteNoise;
      } else if (trackType === 'rain') {
        // Synthesize Rain: Bandpassed Noise with subtle random modulation
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const rainSource = this.ctx.createBufferSource();
        rainSource.buffer = noiseBuffer;
        rainSource.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 950;
        bandpass.Q.value = 1.2;

        rainSource.connect(bandpass);
        bandpass.connect(this.ambientGainNode);
        rainSource.start(0);
        this.ambientSourceNode = rainSource;
      } else if (trackType === 'binaural') {
        // Synthesize 432Hz Binaural Harmonic Drone
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 216; // Sub-harmonic
        osc2.frequency.value = 220; // 4Hz Theta beat difference

        osc1.connect(this.ambientGainNode);
        osc2.connect(this.ambientGainNode);
        osc1.start();
        osc2.start();
        this.ambientSourceNode = {
          stop: () => {
            try { osc1.stop(); osc2.stop(); } catch(e) {}
          }
        };
      }

      updateAmbientUI(true);
    }

    setAmbientVolume(vol) {
      if (this.ambientGainNode && this.ctx) {
        this.ambientGainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
      }
    }

    stopAmbient() {
      if (this.ambientSourceNode) {
        try {
          this.ambientSourceNode.stop();
        } catch (e) {}
        this.ambientSourceNode = null;
      }
    }
  }

  const soundManager = new SoundManager();

  function updateAmbientUI(isPlaying) {
    const headerBtn = document.getElementById('ambient-sound-btn');
    if (headerBtn) {
      headerBtn.classList.toggle('active-audio', isPlaying);
    }
  }

  // ==========================================================================
  // 4. CONFETTI BURST (Canvas Particle Engine)
  // ==========================================================================
  const confettiCanvas = document.getElementById('confetti-canvas');
  const ctxConfetti = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  let particles = [];
  let confettiAnimationId = null;

  function resizeCanvas() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function triggerConfetti(originX, originY) {
    if (!ctxConfetti) return;
    resizeCanvas();
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#ffffff'];
    const count = 55;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const velocity = 4 + Math.random() * 8;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 3,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1,
        life: 0.98
      });
    }

    if (!confettiAnimationId) {
      animateConfetti();
    }
  }

  function animateConfetti() {
    if (!ctxConfetti) return;
    ctxConfetti.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.rotSpeed;
      p.alpha *= p.life;

      if (p.alpha <= 0.02 || p.y > confettiCanvas.height) {
        particles.splice(i, 1);
        continue;
      }

      ctxConfetti.save();
      ctxConfetti.globalAlpha = p.alpha;
      ctxConfetti.translate(p.x, p.y);
      ctxConfetti.rotate((p.rotation * Math.PI) / 180);
      ctxConfetti.fillStyle = p.color;
      ctxConfetti.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctxConfetti.restore();
    }

    if (particles.length > 0) {
      confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
      confettiAnimationId = null;
      ctxConfetti.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // ==========================================================================
  // 5. NATURAL LANGUAGE PROCESSOR (Smart Input Parsing)
  // ==========================================================================
  function parseNaturalLanguage(inputStr) {
    let title = inputStr;
    const extracted = {
      tag: null,
      priority: null,
      energy: null,
      dueDate: null,
      estimate: null
    };

    // 1. Tags: #work, #engineering, #personal
    const tagMatch = title.match(/#([\w-]+)/i);
    if (tagMatch) {
      extracted.tag = tagMatch[1];
      title = title.replace(tagMatch[0], '');
    }

    // 2. Priority: !urgent, !high, !med, !low, !p1, !p2, !p3
    const prioMatch = title.match(/!(urgent|high|med|medium|low|p1|p2|p3)/i);
    if (prioMatch) {
      const token = prioMatch[1].toLowerCase();
      if (token === 'urgent' || token === 'p1') extracted.priority = 'urgent';
      else if (token === 'high' || token === 'p2') extracted.priority = 'high';
      else if (token === 'med' || token === 'medium' || token === 'p3') extracted.priority = 'medium';
      else if (token === 'low') extracted.priority = 'low';
      title = title.replace(prioMatch[0], '');
    }

    // 3. Energy tokens must have an explicit icon so ordinary title words are untouched.
    const energyMatch = title.match(/(?:⚡|☕|🧘)\s*(deep|high|medium|low)\b/i);
    if (energyMatch) {
      extracted.energy = energyMatch[1].toLowerCase();
      title = title.replace(energyMatch[0], '');
    }

    // 4. Dates: @today, @tomorrow, @YYYY-MM-DD
    const dateMatch = title.match(/@(today|tomorrow|\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      const token = dateMatch[1].toLowerCase();
      if (token === 'today') extracted.dueDate = getRelativeDate(0);
      else if (token === 'tomorrow') extracted.dueDate = getRelativeDate(1);
      else extracted.dueDate = token;
      title = title.replace(dateMatch[0], '');
    }

    // 5. Estimate: ~25m, ~15m, ~45m, ~60m, ~1h
    const estMatch = title.match(/~(\d+)(m|h)?/i);
    if (estMatch) {
      const num = parseInt(estMatch[1], 10);
      const unit = (estMatch[2] || 'm').toLowerCase();
      extracted.estimate = unit === 'h' ? num * 60 : num;
      title = title.replace(estMatch[0], '');
    }

    return {
      cleanTitle: title.trim().replace(/\s+/g, ' '),
      extracted
    };
  }

  // ==========================================================================
  // 6. RENDERERS & VIEW MANAGEMENT
  // ==========================================================================

  function renderApp() {
    renderUserStats();
    updateStatsBanner();

    if (activeView === 'list') {
      renderListView();
    } else if (activeView === 'kanban') {
      renderKanbanView();
    } else if (activeView === 'matrix') {
      renderMatrixView();
    }
  }

  function renderUserStats() {
    const streakEl = document.getElementById('streak-count');
    const levelTitleEl = document.getElementById('level-title');
    const rankNameEl = document.getElementById('rank-name');
    const xpFillEl = document.getElementById('xp-bar-fill');

    if (streakEl) streakEl.textContent = user.streak || 1;
    if (levelTitleEl) levelTitleEl.textContent = `Lv. ${user.level}`;
    if (rankNameEl) rankNameEl.textContent = getRankTitle(user.level);

    // Calculate level percentage progress
    const currentRank = RANKS.find(r => r.level === user.level) || RANKS[0];
    const nextRank = RANKS.find(r => r.level === user.level + 1);
    if (nextRank) {
      const needed = nextRank.minXp - currentRank.minXp;
      const progress = user.xp - currentRank.minXp;
      const pct = Math.min(100, Math.max(5, Math.round((progress / needed) * 100)));
      if (xpFillEl) xpFillEl.style.width = `${pct}%`;
    } else {
      if (xpFillEl) xpFillEl.style.width = '100%';
    }
  }

  function updateStatsBanner() {
    const totalEl = document.getElementById('stat-total');
    const pendingEl = document.getElementById('stat-pending');
    const completedEl = document.getElementById('stat-completed');
    const pomoTimeEl = document.getElementById('stat-pomo-time');
    const pctEl = document.getElementById('stat-completion-pct');
    const progressFillEl = document.getElementById('stat-progress-fill');

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    // user.focusMinutes is the app-wide total; task.focusTimeLogged is a per-task breakdown.
    // Adding both counts the same focus sessions twice.
    const totalPomoMinutes = Number.isFinite(Number(user.focusMinutes))
      ? Number(user.focusMinutes)
      : tasks.reduce((acc, t) => acc + (Number(t.focusTimeLogged) || 0), 0);

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (completedEl) completedEl.textContent = completed;
    if (pomoTimeEl) pomoTimeEl.textContent = `${totalPomoMinutes}m`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  }

  function getFilteredAndSortedTasks() {
    return tasks.filter(task => {
      // 1. Search Query Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesTag = task.tag && task.tag.toLowerCase().includes(q);
        const matchesNotes = task.notes && task.notes.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTag && !matchesNotes) return false;
      }

      // 2. Active Tab Filter
      const todayStr = getRelativeDate(0);
      if (activeFilter === 'today') {
        if (task.completed) return false;
        if (task.dueDate !== todayStr) return false;
      } else if (activeFilter === 'upcoming') {
        if (task.completed) return false;
        if (!task.dueDate || task.dueDate <= todayStr) return false;
      } else if (activeFilter === 'starred') {
        if (!task.starred) return false;
      }

      // 3. Energy Level Filter
      if (activeEnergy !== 'all') {
        if (task.energy !== activeEnergy) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting
      if (activeSort === 'due-asc') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (activeSort === 'priority-desc') {
        const order = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (order[b.priority] || 2) - (order[a.priority] || 2);
      } else if (activeSort === 'created-desc') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      } else if (activeSort === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }

  // ==========================================================================
  // VIEW 1: LIST VIEW BUILDER
  // ==========================================================================
  function renderListView() {
    const listToday = document.getElementById('tasks-today-list');
    const listUpcoming = document.getElementById('tasks-upcoming-list');
    const listBacklog = document.getElementById('tasks-backlog-list');
    const listCompleted = document.getElementById('tasks-completed-list');
    const emptyState = document.getElementById('list-empty-state');

    if (!listToday || !listUpcoming || !listBacklog || !listCompleted) return;

    listToday.innerHTML = '';
    listUpcoming.innerHTML = '';
    listBacklog.innerHTML = '';
    listCompleted.innerHTML = '';

    const filtered = getFilteredAndSortedTasks();
    const todayStr = getRelativeDate(0);

    let countToday = 0;
    let countUpcoming = 0;
    let countBacklog = 0;
    let countCompleted = 0;

    filtered.forEach(task => {
      const card = createTaskCardElement(task);
      if (task.completed) {
        listCompleted.appendChild(card);
        countCompleted++;
      } else if (task.dueDate && task.dueDate <= todayStr) {
        listToday.appendChild(card);
        countToday++;
      } else if (task.dueDate && task.dueDate > todayStr) {
        listUpcoming.appendChild(card);
        countUpcoming++;
      } else {
        listBacklog.appendChild(card);
        countBacklog++;
      }
    });

    document.getElementById('count-today').textContent = countToday;
    document.getElementById('count-upcoming').textContent = countUpcoming;
    document.getElementById('count-backlog').textContent = countBacklog;
    document.getElementById('count-completed').textContent = countCompleted;

    // Toggle empty state
    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  }

  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'is-completed' : ''}`;
    card.dataset.id = task.id;
    card.dataset.priority = task.priority || 'medium';

    // Subtasks tally
    const totalSub = task.subtasks ? task.subtasks.length : 0;
    const doneSub = task.subtasks ? task.subtasks.filter(s => s.done).length : 0;

    // Due date label
    let dueHtml = '';
    if (task.dueDate) {
      const todayStr = getRelativeDate(0);
      const tomorrowStr = getRelativeDate(1);
      let dueText = task.dueDate;
      let dueClass = 'chip-due';
      if (task.dueDate === todayStr) {
        dueText = 'Today';
        dueClass += ' due-today';
      } else if (task.dueDate === tomorrowStr) {
        dueText = 'Tomorrow';
      } else if (task.dueDate < todayStr && !task.completed) {
        dueText = `Overdue (${task.dueDate})`;
        dueClass += ' due-overdue';
      }
      dueHtml = `<span class="meta-chip ${dueClass}">📅 ${dueText}</span>`;
    }

    // Energy label
    let energyHtml = '';
    if (task.energy) {
      const icon = task.energy === 'deep' ? '🧘' : task.energy === 'low' ? '☕' : '⚡';
      energyHtml = `<span class="meta-chip chip-energy-${task.energy}">${icon} ${task.energy.toUpperCase()}</span>`;
    }

    // Tag label
    let tagHtml = task.tag ? `<span class="meta-chip chip-tag">#${escapeHtml(task.tag)}</span>` : '';

    // Subtask chip
    let subHtml = totalSub > 0 ? `<span class="meta-chip chip-subtasks">✓ ${doneSub}/${totalSub}</span>` : '';

    // Focus logged chip
    let pomoHtml = (task.focusTimeLogged && task.focusTimeLogged > 0)
      ? `<span class="meta-chip chip-due">⏱️ ${task.focusTimeLogged}m</span>`
      : '';

    card.innerHTML = `
      <div class="task-left">
        <label class="task-checkbox-wrap" title="${task.completed ? 'Mark pending' : 'Complete task (+25 XP)'}">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        </label>
        <div class="task-content-block">
          <div class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
          <div class="task-meta-line">
            ${tagHtml}
            ${energyHtml}
            ${dueHtml}
            ${subHtml}
            ${pomoHtml}
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn-sm ${task.starred ? 'active-star' : ''}" data-action="star" title="Star Task">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${task.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
        <button class="action-btn-sm" data-action="focus" title="Focus Mode / Pomodoro (F)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
        </button>
        <button class="action-btn-sm" data-action="edit" title="Edit Mission Details">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="action-btn-sm" data-action="delete" title="Delete Mission">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    // Bind event handlers on the card
    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('change', (e) => {
      toggleTaskCompletion(task.id, checkbox.checked, e);
    });

    const contentBlock = card.querySelector('.task-content-block');
    contentBlock.addEventListener('click', () => {
      openTaskDetailModal(task.id);
    });

    const starBtn = card.querySelector('[data-action="star"]');
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskStar(task.id);
    });

    const focusBtn = card.querySelector('[data-action="focus"]');
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFocusModal(task.id);
    });

    const editBtn = card.querySelector('[data-action="edit"]');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDetailModal(task.id);
    });

    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    return card;
  }

  // ==========================================================================
  // VIEW 2: KANBAN BOARD
  // ==========================================================================
  function renderKanbanView() {
    const statuses = ['backlog', 'in-progress', 'review', 'completed'];
    const filtered = getFilteredAndSortedTasks();

    statuses.forEach(status => {
      const dropzone = document.getElementById(`kzone-${status}`);
      const countEl = document.getElementById(`kcount-${status}`);
      if (!dropzone) return;

      dropzone.innerHTML = '';
      const columnTasks = filtered.filter(t => (t.status || 'backlog') === status);
      if (countEl) countEl.textContent = columnTasks.length;

      columnTasks.forEach(task => {
        const card = createKanbanCardElement(task);
        dropzone.appendChild(card);
      });
    });

    initKanbanDragAndDrop();
  }

  function createKanbanCardElement(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = task.id;

    const totalSub = task.subtasks ? task.subtasks.length : 0;
    const doneSub = task.subtasks ? task.subtasks.filter(s => s.done).length : 0;
    const subTally = totalSub > 0 ? `<span class="meta-chip chip-subtasks">✓ ${doneSub}/${totalSub}</span>` : '';

    const prioColor = task.priority === 'urgent' ? 'var(--accent-rose)' :
                      task.priority === 'high' ? 'var(--accent-amber)' : 'var(--accent-primary)';

    card.innerHTML = `
      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
      <div class="kanban-card-footer">
        <span class="preview-chip" style="background: rgba(255,255,255,0.06); border-left: 2px solid ${prioColor}; font-size: 0.7rem;">
          ${(task.priority || 'med').toUpperCase()}
        </span>
        <div style="display: flex; gap: 4px; align-items: center;">
          ${subTally}
          ${task.tag ? `<span class="meta-chip chip-tag">#${escapeHtml(task.tag)}</span>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openTaskDetailModal(task.id);
    });

    return card;
  }

  function initKanbanDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const dropzones = document.querySelectorAll('.kanban-dropzone');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });
    });

    dropzones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = zone.dataset.status;
        if (taskId && newStatus) {
          updateTaskStatus(taskId, newStatus);
        }
      });
    });
  }

  function setTaskCompletion(task, isDone, incompleteStatus = 'in-progress') {
    const wasCompleted = Boolean(task.completed);
    task.completed = Boolean(isDone);

    if (task.completed) {
      task.status = 'completed';
      if (!wasCompleted) task.completedAt = Date.now();
      if (!wasCompleted && !task.completionRewarded) {
        task.completionRewarded = true;
        user.completedCount = (user.completedCount || 0) + 1;
        gainXP(25, 'Task Completed');
        soundManager.playSuccess();
      }
    } else {
      // Once a task has been completed, undoing it must not make it rewardable again.
      if (wasCompleted) task.completionRewarded = true;
      task.status = incompleteStatus;
    }
  }

  function updateTaskStatus(taskId, newStatus) {
    const task = tasks.find(x => x.id === taskId);
    if (!task || !['backlog', 'in-progress', 'review', 'completed'].includes(newStatus)) return;
    setTaskCompletion(task, newStatus === 'completed', newStatus);
    saveUser();
    saveTasks();
    renderApp();
    soundManager.playClick();
  }

  // ==========================================================================
  // VIEW 3: EISENHOWER MATRIX
  // ==========================================================================
  function renderMatrixView() {
    const quadrants = ['q1', 'q2', 'q3', 'q4'];
    const filtered = getFilteredAndSortedTasks();

    quadrants.forEach(q => {
      const zone = document.getElementById(`matrix-zone-${q}`);
      const countEl = document.getElementById(`${q}-count`);
      if (!zone) return;

      zone.innerHTML = '';
      const qTasks = filtered.filter(t => (t.quadrant || 'q2') === q && !t.completed);
      if (countEl) countEl.textContent = qTasks.length;

      qTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.id = task.id;
        card.innerHTML = `
          <div class="kanban-card-title">${escapeHtml(task.title)}</div>
          <div class="kanban-card-footer">
            <span class="meta-chip chip-tag">#${escapeHtml(task.tag || 'Focus')}</span>
            <span class="meta-chip chip-energy-${task.energy || 'high'}">⚡ ${task.energy || 'high'}</span>
          </div>
        `;
        card.addEventListener('click', () => {
          openTaskDetailModal(task.id);
        });
        zone.appendChild(card);
      });
    });

    initMatrixDragAndDrop();
  }

  function initMatrixDragAndDrop() {
    const zones = document.querySelectorAll('.matrix-dropzone');
    const cards = document.querySelectorAll('.matrix-dropzone .kanban-card');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });
    });

    zones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newQuad = zone.dataset.quadrant;
        if (taskId && newQuad) {
          const t = tasks.find(x => x.id === taskId);
          if (t) {
            t.quadrant = newQuad;
            saveTasks();
            renderApp();
            soundManager.playClick();
          }
        }
      });
    });
  }

  // ==========================================================================
  // 7. TASK ACTIONS & COMPLETION
  // ==========================================================================

  function toggleTaskCompletion(taskId, isDone, event) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const wasCompleted = Boolean(task.completed);
    setTaskCompletion(task, isDone, 'in-progress');
    if (isDone && !wasCompleted) {
      // Trigger confetti only on the transition from pending to completed.
      if (event && event.target) {
        const rect = event.target.getBoundingClientRect();
        triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else {
        triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
      }
    } else if (!isDone) {
      soundManager.playClick();
    }

    saveUser();
    saveTasks();
    renderApp();
  }

  function toggleTaskStar(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.starred = !task.starred;
    soundManager.playClick();
    saveTasks();
    renderApp();
  }

  function deleteTask(taskId) {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks.splice(idx, 1);
    soundManager.playClick();
    saveTasks();
    renderApp();
    showToast('Mission deleted');
  }

  // Add Task Logic
  function handleAddTaskFromInput() {
    const input = document.getElementById('task-quick-input');
    const rawVal = input.value.trim();
    if (!rawVal) return;

    const parsed = parseNaturalLanguage(rawVal);
    const finalTitle = parsed.cleanTitle || rawVal;

    // Fallbacks from quick selectors
    const selPriority = document.getElementById('quick-priority-select').value;
    const selEnergy = document.getElementById('quick-energy-select').value;
    const selDue = document.getElementById('quick-due-date').value;
    const selTag = document.getElementById('quick-tag-input').value.trim();
    const selEst = parseInt(document.getElementById('quick-est-select').value, 10);

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      title: finalTitle,
      completed: false,
      priority: parsed.extracted.priority || selPriority || 'medium',
      energy: parsed.extracted.energy || selEnergy || 'medium',
      status: 'in-progress',
      quadrant: (parsed.extracted.priority === 'urgent' || parsed.extracted.priority === 'high') ? 'q1' : 'q2',
      dueDate: parsed.extracted.dueDate || selDue || getRelativeDate(0),
      tag: parsed.extracted.tag || selTag || 'General',
      estimate: parsed.extracted.estimate || selEst || 25,
      focusTimeLogged: 0,
      notes: '',
      subtasks: [],
      starred: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    soundManager.playClick();
    gainXP(10, 'Mission Captured');

    // Reset input fields
    input.value = '';
    document.getElementById('quick-tag-input').value = '';
    document.getElementById('nlp-preview-tags').innerHTML = '';

    renderApp();
  }

  // Live NLP Tag Previews
  function updateNlpLivePreview() {
    const input = document.getElementById('task-quick-input');
    const previewContainer = document.getElementById('nlp-preview-tags');
    if (!input || !previewContainer) return;

    const parsed = parseNaturalLanguage(input.value);
    previewContainer.innerHTML = '';

    if (parsed.extracted.tag) {
      previewContainer.innerHTML += `<span class="preview-chip preview-tag">#${escapeHtml(parsed.extracted.tag)}</span>`;
    }
    if (parsed.extracted.priority) {
      previewContainer.innerHTML += `<span class="preview-chip preview-prio">!${parsed.extracted.priority.toUpperCase()}</span>`;
    }
    if (parsed.extracted.energy) {
      previewContainer.innerHTML += `<span class="preview-chip preview-energy">⚡${parsed.extracted.energy}</span>`;
    }
    if (parsed.extracted.dueDate) {
      previewContainer.innerHTML += `<span class="preview-chip preview-date">📅${parsed.extracted.dueDate}</span>`;
    }
    if (parsed.extracted.estimate) {
      previewContainer.innerHTML += `<span class="preview-chip preview-tag">⏱️${parsed.extracted.estimate}m</span>`;
    }
  }

  // ==========================================================================
  // 8. FOCUS / POMODORO TIMER ENGINE
  // ==========================================================================
  let timerInterval = null;
  let timerTotalSeconds = 25 * 60;
  let timerRemainingSeconds = 25 * 60;
  let timerElapsedSeconds = 0;
  let timerRunStartedAt = null;
  let isTimerRunning = false;
  let activeTimerMode = 'Pomodoro';

  function openFocusModal(taskId = null) {
    const modal = document.getElementById('focus-modal');
    modal.classList.remove('hidden');

    activeFocusTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);

    const titleEl = document.getElementById('focus-task-title');
    const tagEl = document.getElementById('focus-task-tag');

    if (task) {
      titleEl.textContent = task.title;
      tagEl.textContent = `Target: #${task.tag || 'Work'} • Estimated: ${task.estimate || 25}m`;
      if (task.estimate) {
        setTimerPreset(task.estimate, 'Custom');
      }
    } else {
      titleEl.textContent = 'General Deep Work Session';
      tagEl.textContent = 'Zero in on high-impact priority targets';
    }

    updateTimerDisplay();
  }

  function closeFocusModal() {
    // Keep an in-progress session paused in memory; closing the modal must not discard it.
    if (isTimerRunning) pauseTimer();
    document.getElementById('focus-modal').classList.add('hidden');
  }

  function setTimerPreset(minutes, modeName) {
    pauseTimer();
    timerTotalSeconds = Math.max(1, Number(minutes) || 25) * 60;
    timerElapsedSeconds = 0;
    timerRemainingSeconds = timerTotalSeconds;
    activeTimerMode = modeName;
    document.getElementById('focus-mode-label').textContent = modeName.toUpperCase();
    updateTimerDisplay();
  }

  function toggleTimer() {
    soundManager.initCtx();
    if (isTimerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function startTimer() {
    if (isTimerRunning || timerRemainingSeconds <= 0) return;

    isTimerRunning = true;
    timerRunStartedAt = Date.now();
    soundManager.playClick();
    document.getElementById('timer-play-icon').classList.add('hidden');
    document.getElementById('timer-pause-icon').classList.remove('hidden');
    document.getElementById('timer-btn-text').textContent = 'Pause Focus';

    // Use wall-clock elapsed time rather than counting interval callbacks. This
    // avoids losing time when the browser throttles background tabs.
    timerInterval = setInterval(() => {
      const elapsed = timerElapsedSeconds + (Date.now() - timerRunStartedAt) / 1000;
      timerRemainingSeconds = Math.max(0, Math.ceil(timerTotalSeconds - elapsed));
      updateTimerDisplay();

      if (elapsed >= timerTotalSeconds) completeTimerSession();
    }, 250);
  }

  function pauseTimer() {
    if (isTimerRunning && timerRunStartedAt !== null) {
      timerElapsedSeconds += Math.max(0, (Date.now() - timerRunStartedAt) / 1000);
    }
    isTimerRunning = false;
    timerRunStartedAt = null;
    clearInterval(timerInterval);
    timerInterval = null;
    timerRemainingSeconds = Math.max(0, Math.ceil(timerTotalSeconds - timerElapsedSeconds));

    const playIcon = document.getElementById('timer-play-icon');
    const pauseIcon = document.getElementById('timer-pause-icon');
    const buttonText = document.getElementById('timer-btn-text');
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (buttonText) buttonText.textContent = timerElapsedSeconds > 0 ? 'Resume Focus' : 'Start Focus Session';
    updateTimerDisplay();
  }

  function resetTimer() {
    // Reset intentionally discards the current unsaved session. Use Save Session
    // to record a partial session before resetting.
    pauseTimer();
    timerElapsedSeconds = 0;
    timerRemainingSeconds = timerTotalSeconds;
    document.getElementById('timer-btn-text').textContent = 'Start Focus Session';
    updateTimerDisplay();
    soundManager.playClick();
  }

  function savePartialTimerSession() {
    if (isTimerRunning) pauseTimer();
    finishTimerSession(false);
  }

  function completeTimerSession() {
    if (isTimerRunning) pauseTimer();
    soundManager.playChime();
    finishTimerSession(true);
  }

  function finishTimerSession(completed) {
    const elapsedSeconds = Math.min(timerTotalSeconds, Math.max(0, timerElapsedSeconds));
    const isBreak = /break|recharge/i.test(activeTimerMode);
    const loggedMinutes = Math.floor(elapsedSeconds / 60);

    if (!isBreak && loggedMinutes > 0) {
      user.focusMinutes = (Number(user.focusMinutes) || 0) + loggedMinutes;
      if (activeFocusTaskId) {
        const task = tasks.find(t => t.id === activeFocusTaskId);
        if (task) {
          task.focusTimeLogged = (Number(task.focusTimeLogged) || 0) + loggedMinutes;
          saveTasks();
        }
      }
      gainXP(loggedMinutes * 2, `${loggedMinutes}m Focus Logged`);
      showToast(completed
        ? `🏆 Focus session finished! Logged ${loggedMinutes}m & earned XP!`
        : `Focus session saved: ${loggedMinutes}m logged.`);
    } else if (!isBreak && elapsedSeconds > 0) {
      saveUser();
      showToast('Session was under one minute, so no whole focus minutes were added.');
    } else if (isBreak && completed) {
      showToast('Break completed!');
    } else if (!completed) {
      showToast('No focus time to save yet.');
    }

    timerElapsedSeconds = 0;
    timerRemainingSeconds = timerTotalSeconds;
    timerRunStartedAt = null;
    isTimerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('timer-btn-text').textContent = 'Start Focus Session';
    updateTimerDisplay();
    renderApp();
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timerRemainingSeconds / 60);
    const secs = timerRemainingSeconds % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const displayEl = document.getElementById('focus-time-display');
    if (displayEl) displayEl.textContent = timeFormatted;

    // SVG Ring update (circumference = 2 * PI * 105 = ~660)
    const ring = document.getElementById('timer-ring');
    if (ring && timerTotalSeconds > 0) {
      const fraction = timerRemainingSeconds / timerTotalSeconds;
      const offset = 660 * (1 - fraction);
      ring.style.strokeDashoffset = offset;
    }
  }

  // ==========================================================================
  // 9. TASK DETAIL & SUBTASKS MODAL
  // ==========================================================================
  function openTaskDetailModal(taskId) {
    activeEditingTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('task-detail-modal');
    modal.classList.remove('hidden');

    document.getElementById('detail-task-title').value = task.title || '';
    document.getElementById('detail-task-notes').value = task.notes || '';
    document.getElementById('detail-priority-select').value = task.priority || 'medium';
    document.getElementById('detail-energy-select').value = task.energy || 'medium';
    document.getElementById('detail-status-select').value = task.status || 'in-progress';
    document.getElementById('detail-quadrant-select').value = task.quadrant || 'q2';
    document.getElementById('detail-due-date').value = task.dueDate || '';
    document.getElementById('detail-tag-input').value = task.tag || '';

    renderSubtasksInModal(task);
  }

  function renderSubtasksInModal(task) {
    const list = document.getElementById('detail-subtasks-container');
    const ratioEl = document.getElementById('subtasks-ratio');
    const fillEl = document.getElementById('subtask-bar-fill');
    if (!list) return;

    list.innerHTML = '';
    const subtasks = task.subtasks || [];
    const doneCount = subtasks.filter(s => s.done).length;

    ratioEl.textContent = `${doneCount}/${subtasks.length}`;
    const pct = subtasks.length === 0 ? 0 : Math.round((doneCount / subtasks.length) * 100);
    fillEl.style.width = `${pct}%`;

    subtasks.forEach(sub => {
      const row = document.createElement('div');
      row.className = 'subtask-row';
      row.innerHTML = `
        <input type="checkbox" class="subtask-check" ${sub.done ? 'checked' : ''}>
        <span class="subtask-text ${sub.done ? 'done' : ''}">${escapeHtml(sub.text)}</span>
        <button class="subtask-delete-btn" title="Remove subtask">✕</button>
      `;

      row.querySelector('.subtask-check').addEventListener('change', (e) => {
        const wasDone = Boolean(sub.done);
        sub.done = e.target.checked;
        soundManager.playClick();
        if (wasDone && !sub.done) sub.xpRewarded = true;
        if (sub.done && !wasDone && !sub.xpRewarded) {
          sub.xpRewarded = true;
          gainXP(5, 'Subtask Completed');
        }
        saveTasks();
        renderSubtasksInModal(task);
        renderApp();
      });

      row.querySelector('.subtask-delete-btn').addEventListener('click', () => {
        task.subtasks = task.subtasks.filter(s => s.id !== sub.id);
        saveTasks();
        renderSubtasksInModal(task);
        renderApp();
      });

      list.appendChild(row);
    });
  }

  function handleSaveTaskDetail() {
    if (!activeEditingTaskId) return;
    const task = tasks.find(t => t.id === activeEditingTaskId);
    if (!task) return;

    task.title = document.getElementById('detail-task-title').value.trim() || task.title;
    task.notes = document.getElementById('detail-task-notes').value;
    task.priority = document.getElementById('detail-priority-select').value;
    task.energy = document.getElementById('detail-energy-select').value;
    task.status = document.getElementById('detail-status-select').value;
    task.quadrant = document.getElementById('detail-quadrant-select').value;
    task.dueDate = document.getElementById('detail-due-date').value;
    task.tag = document.getElementById('detail-tag-input').value.trim();

    setTaskCompletion(task, task.status === 'completed', task.status);

    saveUser();
    saveTasks();
    renderApp();
    document.getElementById('task-detail-modal').classList.add('hidden');
    showToast('Mission updated');
  }

  function handleAddSubtask() {
    if (!activeEditingTaskId) return;
    const task = tasks.find(t => t.id === activeEditingTaskId);
    if (!task) return;

    const input = document.getElementById('new-subtask-input');
    const text = input.value.trim();
    if (!text) return;

    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({
      id: 'sub-' + Date.now(),
      text,
      done: false
    });

    input.value = '';
    saveTasks();
    soundManager.playClick();
    renderSubtasksInModal(task);
    renderApp();
  }

  // ==========================================================================
  // 10. COMMAND PALETTE (Ctrl+K)
  // ==========================================================================
  const COMMANDS = [
    { id: 'new', label: 'Create New Task', icon: '✨', action: () => document.getElementById('task-quick-input').focus() },
    { id: 'view-list', label: 'Switch to List View', icon: '📋', action: () => switchView('list') },
    { id: 'view-kanban', label: 'Switch to Kanban Board', icon: '📊', action: () => switchView('kanban') },
    { id: 'view-matrix', label: 'Switch to Eisenhower Matrix', icon: '🔲', action: () => switchView('matrix') },
    { id: 'focus', label: 'Open Focus & Pomodoro Timer', icon: '⏱️', action: () => openFocusModal() },
    { id: 'rain', label: 'Toggle Ambient Rain Soundscape', icon: '🌧️', action: () => soundManager.setAmbientTrack('rain') },
    { id: 'whitenoise', label: 'Toggle Ambient White Noise', icon: '💨', action: () => soundManager.setAmbientTrack('whitenoise') },
    { id: 'drone', label: 'Toggle 432Hz Binaural Focus Drone', icon: '🧘', action: () => soundManager.setAmbientTrack('binaural') },
    { id: 'clean', label: 'Clean Completed Tasks', icon: '🧹', action: cleanCompletedTasks },
    { id: 'theme-mid', label: 'Set Theme: Midnight Obsidian', icon: '🌌', action: () => setTheme('midnight') },
    { id: 'theme-cyber', label: 'Set Theme: Cyber Neon', icon: '🌆', action: () => setTheme('cyberpunk') },
    { id: 'theme-aurora', label: 'Set Theme: Violet Aurora', icon: '🔮', action: () => setTheme('aurora') },
    { id: 'backup', label: 'Export or Restore Backup (JSON)', icon: '💾', action: () => openBackupModal() },
    { id: 'shortcuts', label: 'Keyboard Shortcuts Cheat Sheet', icon: '⌨️', action: () => openShortcutsModal() }
  ];

  function openCommandPalette() {
    const modal = document.getElementById('cmd-palette-modal');
    const input = document.getElementById('cmd-palette-input');
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderCommandResults('');
    soundManager.playClick();
  }

  function closeCommandPalette() {
    document.getElementById('cmd-palette-modal').classList.add('hidden');
  }

  function renderCommandResults(query) {
    const list = document.getElementById('cmd-results-list');
    list.innerHTML = '';
    const q = query.toLowerCase().trim();

    // 1. Filtered Built-in Commands
    const matchedCmds = COMMANDS.filter(c => c.label.toLowerCase().includes(q));
    matchedCmds.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `cmd-item ${idx === 0 ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="cmd-item-left">
          <span class="cmd-icon">${cmd.icon}</span>
          <span>${escapeHtml(cmd.label)}</span>
        </div>
        <kbd class="shortcut-pill">Command</kbd>
      `;
      item.addEventListener('click', () => {
        closeCommandPalette();
        cmd.action();
      });
      list.appendChild(item);
    });

    // 2. Filtered Tasks (Jump to task)
    if (q) {
      const matchedTasks = tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 5);
      matchedTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'cmd-item';
        item.innerHTML = `
          <div class="cmd-item-left">
            <span class="cmd-icon">${task.completed ? '✅' : '🎯'}</span>
            <span>Jump to: ${escapeHtml(task.title)}</span>
          </div>
          <kbd class="shortcut-pill">Task</kbd>
        `;
        item.addEventListener('click', () => {
          closeCommandPalette();
          openTaskDetailModal(task.id);
        });
        list.appendChild(item);
      });
    }
  }

  // ==========================================================================
  // 11. THEMES, BACKUP & NOTIFICATIONS
  // ==========================================================================

  function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(STORAGE_KEY_THEME, themeName);
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
    soundManager.playClick();
    showToast(`Atmosphere set to ${themeName.toUpperCase()}`);
  }

  function cleanCompletedTasks() {
    const before = tasks.length;
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    renderApp();
    soundManager.playClick();
    showToast(`Cleaned ${before - tasks.length} completed quests!`);
  }

  function switchView(viewName) {
    activeView = viewName;
    document.querySelectorAll('.view-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === viewName);
    });
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${viewName}`);
    });
    soundManager.playClick();
    renderApp();
  }

  function openShortcutsModal() {
    document.getElementById('shortcuts-modal').classList.remove('hidden');
    soundManager.playClick();
  }

  function openBackupModal() {
    document.getElementById('backup-modal').classList.remove('hidden');
    soundManager.playClick();
  }

  function exportData() {
    const payload = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      user,
      tasks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura_vault_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    // Give the browser time to begin the download before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Vault backup exported successfully!');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const validBackup = parsed && Array.isArray(parsed.tasks) &&
          parsed.tasks.every(task => task && typeof task === 'object' && !Array.isArray(task) &&
            typeof task.title === 'string' && task.title.trim().length > 0);
        if (!validBackup) {
          showToast('Invalid backup file format');
          return;
        }

        // Validate and normalize everything before replacing the current in-memory data.
        const restoredTasks = parsed.tasks.map(normalizeTask);
        const restoredUser = normalizeUser(parsed.user);
        tasks = restoredTasks;
        user = restoredUser;
        saveTasks();
        saveUser();
        renderApp();
        showToast('Vault restored cleanly from file!');
        document.getElementById('backup-modal').classList.add('hidden');
      } catch (err) {
        showToast('Error reading JSON file');
      }
    };
    reader.readAsText(file);
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>⚡</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // 12. EVENT LISTENERS INITIALIZATION
  // ==========================================================================

  function bindEvents() {
    // 1. View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // 2. Command Palette trigger
    document.getElementById('cmd-palette-btn').addEventListener('click', openCommandPalette);
    document.getElementById('cmd-palette-input').addEventListener('input', (e) => {
      renderCommandResults(e.target.value);
    });

    // 3. Quick Capture input
    const quickInput = document.getElementById('task-quick-input');
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAddTaskFromInput();
      }
    });
    quickInput.addEventListener('input', updateNlpLivePreview);
    document.getElementById('add-task-btn').addEventListener('click', handleAddTaskFromInput);

    // 4. Search & Filter Bar
    const searchInput = document.getElementById('filter-search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.classList.toggle('hidden', !searchQuery);
      renderApp();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderApp();
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip:not(.energy-filter)').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip:not(.energy-filter)').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        renderApp();
        soundManager.playClick();
      });
    });

    // Energy Chips
    document.querySelectorAll('.energy-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.energy-filter').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeEnergy = chip.dataset.energy;
        renderApp();
        soundManager.playClick();
      });
    });

    // Sort select
    document.getElementById('sort-select').addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderApp();
      soundManager.playClick();
    });

    // Clean completed button
    document.getElementById('clear-completed-btn').addEventListener('click', cleanCompletedTasks);

    // Toggle completed collapsible
    const completedHeader = document.getElementById('toggle-completed-group');
    if (completedHeader) {
      completedHeader.addEventListener('click', () => {
        document.getElementById('group-completed-wrapper').classList.toggle('collapsed');
      });
    }

    // 5. Pomodoro / Focus Modal controls
    document.getElementById('focus-modal-btn').addEventListener('click', () => openFocusModal());
    document.getElementById('focus-close-btn').addEventListener('click', closeFocusModal);
    document.getElementById('timer-toggle-btn').addEventListener('click', toggleTimer);
    document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);
    document.getElementById('timer-save-btn').addEventListener('click', savePartialTimerSession);

    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = parseInt(btn.dataset.time, 10);
        setTimerPreset(mins, btn.dataset.mode);
        soundManager.playClick();
      });
    });

    // Modal ambient sounds
    document.querySelectorAll('.ambient-track-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ambient-track-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        soundManager.setAmbientTrack(btn.dataset.track);
      });
    });

    document.getElementById('ambient-volume').addEventListener('input', (e) => {
      soundManager.setAmbientVolume(parseFloat(e.target.value));
    });

    document.getElementById('ambient-sound-btn').addEventListener('click', () => {
      if (soundManager.currentAmbientTrack === 'off') {
        soundManager.setAmbientTrack('rain', 0.25);
        showToast('🌧️ Ambient Rain started');
      } else {
        soundManager.setAmbientTrack('off');
        showToast('Ambient Sound muted');
      }
    });

    // 6. Sound Effects Toggle (SFX)
    const sfxBtn = document.getElementById('sound-effects-btn');
    const sfxOn = document.getElementById('sfx-icon-on');
    const sfxOff = document.getElementById('sfx-icon-off');

    function updateSfxIcons() {
      sfxOn.classList.toggle('hidden', !sfxEnabled);
      sfxOff.classList.toggle('hidden', sfxEnabled);
    }
    updateSfxIcons();

    sfxBtn.addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      localStorage.setItem(STORAGE_KEY_SFX, String(sfxEnabled));
      updateSfxIcons();
      showToast(sfxEnabled ? '🔊 UI Audio FX enabled' : '🔇 Audio FX muted');
      if (sfxEnabled) soundManager.playClick();
    });

    // 7. Theme Menu
    const themeBtn = document.getElementById('theme-btn');
    const themeMenu = document.getElementById('theme-menu');
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeMenu.classList.toggle('hidden');
    });
    window.addEventListener('click', () => {
      themeMenu.classList.add('hidden');
    });

    document.querySelectorAll('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        setTheme(opt.dataset.theme);
        themeMenu.classList.add('hidden');
      });
    });

    // 8. Shortcuts & Help
    document.getElementById('help-btn').addEventListener('click', openShortcutsModal);
    document.getElementById('shortcuts-close-btn').addEventListener('click', () => {
      document.getElementById('shortcuts-modal').classList.add('hidden');
    });

    // 9. Backup Modal
    document.getElementById('backup-btn').addEventListener('click', openBackupModal);
    document.getElementById('backup-close-btn').addEventListener('click', () => {
      document.getElementById('backup-modal').classList.add('hidden');
    });
    document.getElementById('export-json-btn').addEventListener('click', exportData);
    document.getElementById('import-json-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
        e.target.value = '';
      }
    });
    document.getElementById('reset-demo-btn').addEventListener('click', () => {
      if (confirm('Load sample missions? This resets current list to demo data.')) {
        tasks = JSON.parse(JSON.stringify(DEMO_TASKS));
        saveTasks();
        renderApp();
        showToast('Demo missions restored!');
        document.getElementById('backup-modal').classList.add('hidden');
      }
    });

    // 10. Detail Modal Events
    document.getElementById('detail-close-btn').addEventListener('click', () => {
      document.getElementById('task-detail-modal').classList.add('hidden');
    });
    document.getElementById('detail-done-btn').addEventListener('click', handleSaveTaskDetail);
    document.getElementById('add-subtask-btn').addEventListener('click', handleAddSubtask);
    document.getElementById('new-subtask-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddSubtask();
    });
    document.getElementById('detail-delete-btn').addEventListener('click', () => {
      if (activeEditingTaskId) {
        deleteTask(activeEditingTaskId);
        document.getElementById('task-detail-modal').classList.add('hidden');
      }
    });
    document.getElementById('detail-start-focus-btn').addEventListener('click', () => {
      if (activeEditingTaskId) {
        document.getElementById('task-detail-modal').classList.add('hidden');
        openFocusModal(activeEditingTaskId);
      }
    });

    // 11. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Escape closes open modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
        return;
      }

      // If active in an input/textarea, only allow Escape or specific shortcuts
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          openCommandPalette();
        }
        return;
      }

      // Ctrl + K -> Command Palette
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // N -> Quick Capture
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        quickInput.focus();
        return;
      }

      // / -> Search
      if (e.key === '/') {
        e.preventDefault();
        searchInput.focus();
        return;
      }

      // F -> Focus Mode
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFocusModal();
        return;
      }

      // M -> Toggle SFX
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        sfxBtn.click();
        return;
      }

      // ? -> Shortcuts Modal
      if (e.key === '?') {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // Alt + 1, 2, 3 -> Switch Views
      if (e.altKey && e.key === '1') switchView('list');
      if (e.altKey && e.key === '2') switchView('kanban');
      if (e.altKey && e.key === '3') switchView('matrix');
    });
  }

  // ==========================================================================
  // 13. BOOTSTRAP APPLICATION
  // ==========================================================================
  function init() {
    // Load persisted theme
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'midnight';
    setTheme(savedTheme);

    // Bind event listeners
    bindEvents();

    // Render initial state
    renderApp();

    console.log('%c AURA Focus OS ⚡ Loaded successfully. Press Ctrl+K for commands.', 'background: #6366f1; color: #fff; padding: 4px 8px; border-radius: 4px;');
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
