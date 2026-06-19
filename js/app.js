// Main application controller for Codex Interactive Code Lab

document.addEventListener('DOMContentLoaded', () => {
  // 1. App State
  let state = {
    xp: 0,
    streak: 0,
    completedLessons: [], // list of completed lesson IDs
    currentTrack: null,
    currentChapterIdx: 0,
    currentLessonIdx: 0,
    editorContent: {}, // stores modified code so user doesn't lose drafts
    hintsUsedToday: 0,
    lastHintTimestamp: 0,
    currentTheme: 'obsidian',
    soundSettings: {
      soundEnabled: true,
      clickPreset: 'duo-ping',
      typePreset: 'mech-click',
      customClick: null,
      customType: null
    },
    isAdmin: false,
    donationLinks: {
      paypal: 'https://paypal.me/ollieirwin',
      buyMeACoffee: 'https://buymeacoffee.com/ollieirwin'
    },
    hostedAppLinks: {
      mac: '',
      win: '',
      linux: ''
    }
  };
  let hintsUsedInCurrentLesson = 0;

  // Save the original Quiz View HTML template for seamless SPA resets
  const quizView = document.getElementById('quiz-view');
  const quizTemplateHTML = quizView.innerHTML;

  // 1.5 Sound Synthesizer & Controller
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSynthSound(presetName) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;

      if (presetName === 'duo-ping') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (presetName === 'retro-beep') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(650, now);
        gainNode.gain.setValueAtTime(0.06, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (presetName === 'mech-click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (presetName === 'typewriter') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, now);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {
      console.warn("Synth play failed", e);
    }
  }

  function playSound(isType) {
    if (!state.soundSettings || state.soundSettings.soundEnabled === false) return;
    
    const preset = isType ? state.soundSettings.typePreset : state.soundSettings.clickPreset;
    const customData = isType ? state.soundSettings.customType : state.soundSettings.customClick;

    if (preset === 'custom' && customData) {
      const audio = new Audio(customData);
      audio.volume = 0.6;
      audio.play().catch(e => {
        console.warn("Custom audio play failed, falling back to synth", e);
        playSynthSound(isType ? 'mech-click' : 'duo-ping');
      });
    } else {
      playSynthSound(preset);
    }
  }

  function playClickSound() {
    playSound(false);
  }

  function playTypeSound() {
    playSound(true);
  }

  function playCompleteSound() {
    if (!state.soundSettings || state.soundSettings.soundEnabled === false) return;
    try {
      const ctx = getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(1046.50, now + 0.15); // C6
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(1318.51, now + 0.15); // E6
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.start(now);
      osc1.stop(now + 0.35);
      osc2.start(now);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn("Complete sound failed", e);
    }
  }

  // 1.6 Custom App Themes Controller
  const themes = {
    obsidian: {
      '--bg-primary': '#08090d',
      '--bg-secondary': '#11141c',
      '--bg-tertiary': '#1b1f2b',
      '--duo-dark-bg': '#131f24',
      '--duo-card-bg': '#1f2e35',
      '--duo-border': '#37464f',
      '--text-primary': '#f3f4f6',
      '--duo-text-muted': '#afbbbf',
      '--border-color': 'rgba(255, 255, 255, 0.08)'
    },
    duoLight: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f7f7f7',
      '--bg-tertiary': '#e5e5e5',
      '--duo-dark-bg': '#ffffff',
      '--duo-card-bg': '#ffffff',
      '--duo-border': '#e5e5e5',
      '--text-primary': '#3c3c3c',
      '--duo-text-muted': '#777777',
      '--border-color': '#e5e5e5'
    },
    cyberpunk: {
      '--bg-primary': '#0c0714',
      '--bg-secondary': '#150d22',
      '--bg-tertiary': '#241539',
      '--duo-dark-bg': '#150d22',
      '--duo-card-bg': '#241539',
      '--duo-border': '#ff007f',
      '--text-primary': '#00f5d4',
      '--duo-text-muted': '#ff9f43',
      '--border-color': 'rgba(255, 0, 127, 0.3)'
    },
    terminal: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#050505',
      '--bg-tertiary': '#0a0a0a',
      '--duo-dark-bg': '#050505',
      '--duo-card-bg': '#0a0a0a',
      '--duo-border': '#33ff33',
      '--text-primary': '#33ff33',
      '--duo-text-muted': '#00aa00',
      '--border-color': '#33ff33'
    },
    emerald: {
      '--bg-primary': '#0a1c15',
      '--bg-secondary': '#0d281e',
      '--bg-tertiary': '#143d2e',
      '--duo-dark-bg': '#0d281e',
      '--duo-card-bg': '#143d2e',
      '--duo-border': '#20604a',
      '--text-primary': '#e8f5e9',
      '--duo-text-muted': '#a5d6a7',
      '--border-color': 'rgba(32, 96, 74, 0.3)'
    }
  };

  function applyTheme(themeKey) {
    const variables = themes[themeKey] || themes.obsidian;
    Object.keys(variables).forEach(name => {
      document.documentElement.style.setProperty(name, variables[name]);
    });
    state.currentTheme = themeKey;
  }

  // Load progress
  function loadState() {
    const username = localStorage.getItem('codex_current_user');
    if (!username) {
      state.currentUser = null;
      state.isAdmin = false;
      document.body.classList.add('auth-mode');
      showView('signin-view');
      return;
    }

    state.currentUser = username;
    state.isAdmin = (username === 'admin');
    document.body.classList.remove('auth-mode');

    const saved = localStorage.getItem(`codex_user_${username}`);
    if (saved) {
      try {
        state = { ...state, ...JSON.parse(saved) };
        // Check 24 hour elapsed time for hints reset
        const now = Date.now();
        const lastHintTime = state.lastHintTimestamp || 0;
        const dayInMs = 24 * 60 * 60 * 1000;
        if (now - lastHintTime > dayInMs) {
          state.hintsUsedToday = 0;
          state.lastHintTimestamp = now;
        }
      } catch (e) {
        console.error("Failed to load user state", e);
      }
    } else {
      // Setup fresh user state
      state.xp = state.isAdmin ? 999999 : 0;
      state.streak = 0;
      state.completedLessons = [];
      state.editorContent = {};
      state.hintsUsedToday = 0;
      state.lastHintTimestamp = 0;
      state.currentTheme = 'obsidian';
      state.soundSettings = {
        soundEnabled: true,
        clickPreset: 'duo-ping',
        typePreset: 'mech-click',
        customClick: null,
        customType: null
      };
    }

    // HEAL soundSettings deep structure
    if (!state.soundSettings) {
      state.soundSettings = {
        soundEnabled: true,
        clickPreset: 'duo-ping',
        typePreset: 'mech-click',
        customClick: null,
        customType: null
      };
    } else {
      if (state.soundSettings.soundEnabled === undefined) state.soundSettings.soundEnabled = true;
      if (!state.soundSettings.clickPreset) state.soundSettings.clickPreset = 'duo-ping';
      if (!state.soundSettings.typePreset) state.soundSettings.typePreset = 'mech-click';
    }

    // Load and heal global configuration settings (apply to all users)
    const globalConfigSaved = localStorage.getItem('codex_global_config');
    let globalConfig = {
      donationLinks: {
        paypal: 'https://paypal.me/ollieirwin',
        buyMeACoffee: 'https://buymeacoffee.com/ollieirwin'
      },
      hostedAppLinks: {
        mac: '',
        win: '',
        linux: ''
      }
    };
    if (globalConfigSaved) {
      try {
        globalConfig = { ...globalConfig, ...JSON.parse(globalConfigSaved) };
      } catch (e) {
        console.error("Failed to parse global config", e);
      }
    }
    state.donationLinks = globalConfig.donationLinks;
    state.hostedAppLinks = globalConfig.hostedAppLinks;

    updateNavStats();
    
    // Apply loaded theme
    applyTheme(state.currentTheme || 'obsidian');

    // Sync admin sidebar and donation links UI
    updateSidebarAdminTab();
    updateDonationLinksUI();
    updateDownloadPageLinks();
    updateProfileViewUI();
    updateLeaderboardUserUI();
    renderLeaderboard();
  }

  // Save progress
  function saveState() {
    const username = state.currentUser;
    if (!username) return;

    localStorage.setItem(`codex_user_${username}`, JSON.stringify(state));
    updateNavStats();
    updateProfileViewUI();
    updateLeaderboardUserUI();
    renderLeaderboard();
  }

  function saveGlobalConfig() {
    const globalConfig = {
      donationLinks: state.donationLinks,
      hostedAppLinks: state.hostedAppLinks
    };
    localStorage.setItem('codex_global_config', JSON.stringify(globalConfig));
  }

  function updateNavStats() {
    if (state.xp === 999999) {
      document.querySelector('.xp-badge span:not(.badge-icon)').innerText = `♾️ XP`;
    } else {
      document.querySelector('.xp-badge span:not(.badge-icon)').innerText = `${state.xp.toLocaleString()} XP`;
    }
    if (state.streak === 0 && state.xp > 0) state.streak = 1;
    document.querySelector('.streak-badge span:not(.badge-icon)').innerText = `${state.streak} Days`;
  }

  function updateProfileViewUI() {
    const username = state.currentUser || 'Scholar';
    const xpText = state.xp === 999999 ? '♾️' : state.xp.toLocaleString();
    const streakText = state.streak === 1 ? '1 Day' : `${state.streak} Days`;
    
    const nameEl = document.querySelector('#profile-view h2');
    if (nameEl) nameEl.innerText = username;

    const xpValEl = document.querySelector('#profile-view .explanation-step:nth-child(1) div');
    if (xpValEl) xpValEl.innerText = `👑 ${xpText}`;

    const streakValEl = document.querySelector('#profile-view .explanation-step:nth-child(2) div');
    if (streakValEl) streakValEl.innerText = `🔥 ${streakText}`;
  }

  function updateLeaderboardUserUI() {
    const username = state.currentUser || 'You';
    const xpText = state.xp === 999999 ? '♾️' : state.xp.toLocaleString();
    
    const nameEl = document.getElementById('leaderboard-user-name');
    if (nameEl) nameEl.innerText = `${username} (You)`;

    const xpEl = document.getElementById('leaderboard-user-xp');
    if (xpEl) xpEl.innerText = `${xpText} XP`;
  }
  function renderLeaderboard() {
    const listEl = document.querySelector('.leaderboard-list');
    if (!listEl) return;

    const accounts = JSON.parse(localStorage.getItem('codex_accounts') || '{}');
    const usersList = [];

    Object.keys(accounts).forEach(uname => {
      const userSaved = localStorage.getItem(`codex_user_${uname}`);
      let userXP = 0;
      if (userSaved) {
        try {
          userXP = JSON.parse(userSaved).xp || 0;
        } catch (e) {
          console.error(e);
        }
      }
      usersList.push({
        username: uname,
        xp: userXP,
        avatar: uname === 'admin' ? '👑' : '👤',
        isUser: (uname === state.currentUser)
      });
    });

    if (state.currentUser && !usersList.some(u => u.username === state.currentUser)) {
      usersList.push({
        username: state.currentUser,
        xp: state.xp,
        avatar: state.isAdmin ? '👑' : '👤',
        isUser: true
      });
    }

    const bots = [
      { username: 'Builderman', xp: 2450, avatar: '🥇', isUser: false },
      { username: 'CodeNinja', xp: 1890, avatar: '🥈', isUser: false },
      { username: 'Robloxian99', xp: 1200, avatar: '🥉', isUser: false },
      { username: 'PythonCoder', xp: 950, avatar: '🐱', isUser: false }
    ];

    bots.forEach(bot => {
      if (!usersList.some(u => u.username.toLowerCase() === bot.username.toLowerCase())) {
        usersList.push(bot);
      }
    });

    usersList.sort((a, b) => b.xp - a.xp);

    listEl.innerHTML = '';
    usersList.forEach((u, index) => {
      const rank = index + 1;
      let rankClass = '';
      let rankBadge = rank;
      
      if (rank === 1) {
        rankClass = 'rank-1';
        rankBadge = '🥇';
      } else if (rank === 2) {
        rankClass = 'rank-2';
        rankBadge = '🥈';
      } else if (rank === 3) {
        rankClass = 'rank-3';
        rankBadge = '🥉';
      }

      if (u.isUser) {
        rankClass += ' user-row';
      }

      const xpText = u.xp === 999999 ? '♾️ XP' : `${u.xp.toLocaleString()} XP`;

      const row = document.createElement('div');
      row.className = `leaderboard-row ${rankClass}`;
      row.innerHTML = `
        <div class="leaderboard-rank-container">
          <span class="leaderboard-rank-num">${rank}</span>
          <span class="leaderboard-avatar">${u.avatar || rankBadge}</span>
          <span class="leaderboard-username">${u.username}${u.isUser ? ' (You)' : ''}</span>
        </div>
        <span class="leaderboard-xp-val">${xpText}</span>
      `;
      listEl.appendChild(row);
    });
  }

  // App download installer popup helper
  window.handleAppDownload = function(e, filename, buildCommand) {
    const linkEl = e.currentTarget;
    let isHosted = false;
    if (linkEl && linkEl.href) {
      const href = linkEl.getAttribute('href') || '';
      isHosted = href.startsWith('http://') || href.startsWith('https://');
    }

    if (isHosted) {
      showInstallGuideModal(filename);
    } else {
      showDownloadModal(filename, buildCommand);
    }
    return true; // Let browser download trigger
  };

  function showDownloadModal(filename, buildCommand) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.id = 'download-instructions-modal';

    modal.innerHTML = `
      <div class="chapter-container" style="max-width: 500px; padding: 2rem; border: 2px solid var(--duo-border); background: var(--duo-card-bg); border-radius: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);">
        <h2 style="font-size: 1.5rem; color: #fff; margin-bottom: 0.5rem; text-align: center;">📥 Downloading ${filename}</h2>
        <p style="color: var(--duo-text-muted); font-size: 0.85rem; line-height: 1.5; margin-bottom: 1.5rem; text-align: center;">
          The local server has triggered the file transfer. If the file is not yet built, you can compile it instantly on your Macbook!
        </p>
        
        <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 1.25rem; border: 1px solid var(--duo-border); margin-bottom: 1.5rem; font-family: var(--font-code); font-size: 0.8rem;">
          <div style="color: var(--duo-blue); font-weight: 700; margin-bottom: 0.5rem;">📋 Terminal Commands:</div>
          <span style="color: var(--text-secondary);"># 1. Go to project directory</span><br>
          <span style="color: #fff; display: block; background: rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 4px; margin: 0.25rem 0 0.5rem 0; white-space: pre-wrap; word-break: break-all;">cd /Users/ollieirwin/.gemini/antigravity/scratch/codex-code-lab</span>
          
          <span style="color: var(--text-secondary);"># 2. Build the app</span><br>
          <span style="color: #fff; display: block; background: rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 4px; margin: 0.25rem 0 0.5rem 0;">${buildCommand}</span>
        </div>

        <button class="quiz-btn" style="width: 100%; background: var(--duo-green) !important; box-shadow: 0 4px 0 var(--duo-green-shadow) !important;" onclick="document.getElementById('download-instructions-modal').remove()">Got It!</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showInstallGuideModal(filename) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.id = 'download-instructions-modal';

    let guideHTML = '';
    const fileLower = filename.toLowerCase();

    if (fileLower.endsWith('.dmg')) {
      guideHTML = `
        <div style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-blue); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">1</span>
            <span>Once the <strong>.dmg</strong> download completes, double-click to open and mount it.</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-blue); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">2</span>
            <span>Drag the <strong>Codex</strong> icon into your <strong>Applications</strong> folder.</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-blue); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">3</span>
            <span>Launch it from Applications. If macOS displays an <em>"unidentified developer"</em> warning:
              <br><small style="color: var(--duo-text-muted);">Go to <strong>System Settings &gt; Privacy &amp; Security</strong>, scroll down, and click <strong>"Open Anyway"</strong>.</small>
            </span>
          </div>
        </div>
      `;
    } else if (fileLower.endsWith('.exe')) {
      guideHTML = `
        <div style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-green); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">1</span>
            <span>Double-click the downloaded <strong>Codex Setup.exe</strong> to start the installer.</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-green); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">2</span>
            <span>If Windows Defender SmartScreen warns about an unrecognized app:
              <br><small style="color: var(--duo-text-muted);">Click <strong>"More Info"</strong> and select <strong>"Run Anyway"</strong>.</small>
            </span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--duo-green); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">3</span>
            <span>Codex will install and create a desktop shortcut automatically.</span>
          </div>
        </div>
      `;
    } else {
      guideHTML = `
        <div style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--accent-purple); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">1</span>
            <span>Right-click the downloaded <strong>.AppImage</strong> and open its <strong>Properties</strong>.</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--accent-purple); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">2</span>
            <span>Enable the checkbox to <strong>"Allow executing file as program"</strong> (or run <code>chmod +x</code> in terminal).</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; text-align: left;">
            <span style="background: var(--accent-purple); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 0.8rem;">3</span>
            <span>Double-click the AppImage file to run Codex instantly.</span>
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="chapter-container" style="max-width: 500px; padding: 2rem; border: 2px solid var(--duo-border); background: var(--duo-card-bg); border-radius: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);">
        <h2 style="font-size: 1.5rem; color: #fff; margin-bottom: 0.5rem; text-align: center;">📦 Installation Guide</h2>
        <p style="color: var(--duo-text-muted); font-size: 0.85rem; line-height: 1.5; margin-bottom: 1.5rem; text-align: center;">
          Follow these quick steps to launch the app:
        </p>
        
        <div class="explanation-step" style="background: rgba(0,0,0,0.2); margin-bottom: 1.5rem; padding: 1.25rem;">
          ${guideHTML}
        </div>

        <button class="quiz-btn" style="width: 100%; background: var(--duo-green) !important; box-shadow: 0 4px 0 var(--duo-green-shadow) !important;" onclick="document.getElementById('download-instructions-modal').remove()">Got It!</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  function updateSidebarAdminTab() {
    const tab = document.getElementById('menu-signin');
    if (!tab) return;
    const iconEl = tab.querySelector('.menu-icon');
    const textEl = tab.querySelector('.menu-text');
    if (state.isAdmin) {
      tab.style.display = '';
      if (iconEl) iconEl.innerText = '👑';
      if (textEl) textEl.innerText = 'Admin Panel';
    } else {
      tab.style.display = 'none';
    }
  }

  function updateDonationLinksUI() {
    const paypalLink = document.getElementById('donate-paypal-link');
    const coffeeLink = document.getElementById('donate-coffee-link');
    if (state.donationLinks) {
      if (paypalLink) paypalLink.href = state.donationLinks.paypal || '#';
      if (coffeeLink) coffeeLink.href = state.donationLinks.buyMeACoffee || '#';
    }
  }

  function updateDownloadPageLinks() {
    const macBtn = document.querySelector('#download-view .track-card.luau a');
    const winBtn = document.querySelector('#download-view .track-card.python a');
    const linuxBtn = document.querySelector('#download-view .track-card.js a');

    if (state.hostedAppLinks) {
      if (macBtn && state.hostedAppLinks.mac) macBtn.href = state.hostedAppLinks.mac;
      if (winBtn && state.hostedAppLinks.win) winBtn.href = state.hostedAppLinks.win;
      if (linuxBtn && state.hostedAppLinks.linux) linuxBtn.href = state.hostedAppLinks.linux;
    }
  }

  // 2. View Routing
  function syncActiveTab(viewId) {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    let tabId = 'menu-learn';
    if (viewId === 'leaderboard-view') {
      tabId = 'menu-leaderboard';
    } else if (viewId === 'quests-view') {
      tabId = 'menu-quests';
    } else if (viewId === 'profile-view') {
      tabId = 'menu-profile';
    } else if (viewId === 'download-view') {
      tabId = 'menu-download';
    } else if (viewId === 'settings-view') {
      tabId = 'menu-settings';
    } else if (viewId === 'donate-view') {
      tabId = 'menu-donate';
    } else if (viewId === 'signin-view' || viewId === 'admin-view') {
      tabId = 'menu-signin';
    }
    const target = document.getElementById(tabId);
    if (target) {
      target.classList.add('active');
    }
  }

  function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(view => {
      view.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    syncActiveTab(viewId);

    // Stop simulator physics when leaving learning view
    if (viewId !== 'learning-view' && window.simulatorInstance) {
      window.simulatorInstance.stopPhysics();
    }
  }

  // 3. Render Dashboard Track Cards
  function renderDashboard() {
    const tracksGrid = document.querySelector('.tracks-grid');
    tracksGrid.innerHTML = '';

    Object.keys(window.CodexCurriculum).forEach(key => {
      const track = window.CodexCurriculum[key];
      
      // Calculate progress
      let totalLessons = 0;
      let completedCount = 0;
      track.chapters.forEach(ch => {
        ch.lessons.forEach(l => {
          totalLessons++;
          if (state.completedLessons.includes(l.id)) {
            completedCount++;
          }
        });
      });
      const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      const card = document.createElement('div');
      card.className = `track-card ${key}`;
      card.innerHTML = `
        <div class="track-header">
          <div class="track-badge">${track.icon}</div>
          <span class="lesson-xp">${totalLessons} Lessons</span>
        </div>
        <div class="track-info">
          <h3>${track.title}</h3>
          <p>${track.description}</p>
        </div>
        <div class="track-progress-container">
          <div class="track-progress-label">
            <span>Progress</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        playClickSound();
        state.currentTrack = key;
        renderPath(key);
        showView('path-view');
      });

      tracksGrid.appendChild(card);
    });
  }

  // 4. Render Course Path (Endless snaking levels flow like Duolingo)
  function renderPath(trackKey) {
    const track = window.CodexCurriculum[trackKey];
    document.querySelector('.path-title-info h2').innerText = track.title;
    
    const chaptersContainer = document.getElementById('chapters-container');
    chaptersContainer.innerHTML = '';

    // Create the unified nodes flow container
    const pathFlow = document.createElement('div');
    pathFlow.className = 'path-nodes-flow';
    chaptersContainer.appendChild(pathFlow);

    // Flat map of all lessons in this track to compute locking order
    const flatLessons = [];
    track.chapters.forEach((chapter, chIdx) => {
      chapter.lessons.forEach((lesson, lIdx) => {
        flatLessons.push({ lesson, chIdx, lIdx, chapterName: chapter.name });
      });
    });

    // Find the first index that is NOT completed (this will be the active/unlocked node)
    let unlockedIdx = 0;
    let foundActive = false;
    for (let i = 0; i < flatLessons.length; i++) {
      if (!state.completedLessons.includes(flatLessons[i].lesson.id)) {
        unlockedIdx = i;
        foundActive = true;
        break;
      }
    }
    if (!foundActive) {
      unlockedIdx = flatLessons.length; // all completed
    }

    // Create tooltip element
    let tooltipEl = document.getElementById('skill-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'skill-tooltip';
      tooltipEl.className = 'skill-tooltip';
      tooltipEl.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Loop through flatLessons and render them in the unified flow!
    flatLessons.forEach((item, flatIdx) => {
      const lesson = item.lesson;
      const chIdx = item.chIdx;
      const lIdx = item.lIdx;

      // Add a milestone section divider when a new chapter starts
      const isNewChapter = flatIdx === 0 || flatLessons[flatIdx - 1].chIdx !== chIdx;
      if (isNewChapter) {
        const milestoneBanner = document.createElement('div');
        milestoneBanner.className = 'chapter-header';
        milestoneBanner.style.width = '100%';
        milestoneBanner.style.margin = '2rem 0 1rem 0';
        milestoneBanner.style.textAlign = 'center';
        milestoneBanner.innerHTML = `
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--accent-purple); text-transform: uppercase; letter-spacing: 1px;">
            ${item.chapterName}
          </h3>
        `;
        pathFlow.appendChild(milestoneBanner);
      }

      const isCompleted = flatIdx < unlockedIdx;
      const isActive = flatIdx === unlockedIdx;
      const isLocked = flatIdx > unlockedIdx;

      let statusClass = 'locked';
      let icon = '🔒';
      if (isCompleted) {
        statusClass = 'completed';
        icon = lesson.type === 'quiz' ? '👑' : '✓';
      } else if (isActive) {
        statusClass = 'active';
        icon = lesson.type === 'quiz' ? '📝' : '⭐';
      }

      let extraHTML = '';
      if (isActive) {
        extraHTML += `<div class="skill-node-pulse"></div>`;
      }

      if (isCompleted || isActive) {
        const ringColor = isCompleted ? 'green' : 'blue';
        const offset = isCompleted ? 0 : 264;
        extraHTML += `
          <svg class="progress-svg">
            <circle class="progress-ring-bg" cx="49" cy="49" r="42"></circle>
            <circle class="progress-ring-fill ${ringColor}" cx="49" cy="49" r="42" style="stroke-dashoffset: ${offset};"></circle>
          </svg>
        `;
      }

      // Snaking pattern: Center, Left, Center, Right
      const staggers = ['stagger-center', 'stagger-left', 'stagger-center', 'stagger-right'];
      const staggerClass = staggers[flatIdx % 4];

      const nodeRow = document.createElement('div');
      nodeRow.className = `node-row ${staggerClass}`;
      nodeRow.innerHTML = `
        <div class="skill-node-wrapper" data-ch="${chIdx}" data-l="${lIdx}">
          ${extraHTML}
          <button class="skill-node ${statusClass}">
            ${icon}
          </button>
        </div>
      `;

      // Wire click popover
      const wrapper = nodeRow.querySelector('.skill-node-wrapper');
      if (!isLocked) {
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          playClickSound();

          if (tooltipEl.parentElement === wrapper && tooltipEl.classList.contains('visible')) {
            tooltipEl.classList.remove('visible');
            return;
          }

          tooltipEl.classList.remove('visible');

          const btnText = isCompleted ? 'Review' : 'Start';
          const btnClass = isCompleted ? 'review' : 'start';

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = lesson.instructions || '';
          let descText = tempDiv.textContent.trim();
          if (descText.length > 90) {
            descText = descText.substring(0, 85) + '...';
          }
          if (lesson.type === 'quiz') {
            descText = "Test your knowledge of Section " + (chIdx + 1) + " concepts!";
          }

          tooltipEl.innerHTML = `
            <h4 class="tooltip-title">${lesson.name}</h4>
            <p class="tooltip-desc">${descText}</p>
            <div class="tooltip-xp">👑 +${lesson.xp} XP</div>
            <button class="tooltip-btn ${btnClass}">${btnText}</button>
          `;

          const btn = tooltipEl.querySelector('.tooltip-btn');
          btn.addEventListener('click', (btnEvent) => {
            btnEvent.stopPropagation();
            playClickSound();
            tooltipEl.classList.remove('visible');
            startLesson(trackKey, chIdx, lIdx);
          });

          wrapper.appendChild(tooltipEl);

          setTimeout(() => {
            tooltipEl.classList.add('visible');
          }, 10);
        });
      }

      pathFlow.appendChild(nodeRow);
    });
  }

  // 5. Start/Load Lesson
  function startLesson(trackKey, chIdx, lIdx) {
    state.currentTrack = trackKey;
    state.currentChapterIdx = chIdx;
    state.currentLessonIdx = lIdx;

    const lesson = window.CodexCurriculum[trackKey].chapters[chIdx].lessons[lIdx];
    
    if (lesson.type === 'quiz') {
      startQuiz(lesson);
      return;
    }

    showView('learning-view');

    // Update headers and texts
    document.querySelector('.lesson-title-meta').innerText = `Lesson ${chIdx + 1}.${lIdx + 1}`;
    document.querySelector('.lesson-title-main').innerText = lesson.name;
    document.getElementById('lesson-desc').innerHTML = lesson.instructions;

    // Load editor code
    const draftKey = `${trackKey}_${lesson.id}`;
    const codeToLoad = state.editorContent[draftKey] !== undefined ? state.editorContent[draftKey] : lesson.starterCode;
    
    const textarea = document.getElementById('code-input');
    textarea.value = codeToLoad;
    syncEditor(codeToLoad, trackKey);

    // Setup Checkpoints
    const checkpointList = document.getElementById('checkpoint-list');
    checkpointList.innerHTML = '';
    lesson.checkpoints.forEach((cp, idx) => {
      const item = document.createElement('div');
      item.className = 'checkpoint-item';
      item.id = `cp-${cp.id}`;
      item.innerHTML = `
        <div class="checkpoint-bullet">${idx + 1}</div>
        <div class="checkpoint-desc">${cp.desc}</div>
      `;
      checkpointList.appendChild(item);
    });

    // Reset console output
    const consoleOutput = document.getElementById('console-output-pane');
    consoleOutput.innerHTML = '<div class="console-log-row info">> Output window ready. Press Run Code to execute.</div>';

    // Show/hide Roblox simulator viewport depending on language track
    const robloxTab = document.getElementById('tab-roblox');
    const robloxPane = document.getElementById('roblox-sim-pane');
    
    if (trackKey === 'luau') {
      robloxTab.style.display = 'flex';
      robloxTab.click(); // Switch to roblox simulator tab
      if (!window.simulatorInstance) {
        window.simulatorInstance = new RobloxSimulator('simulator-canvas');
      } else {
        window.simulatorInstance.reset();
        window.simulatorInstance.resizeCanvas();
      }
    } else {
      robloxTab.style.display = 'none';
      document.getElementById('tab-console').click(); // Switch to console output tab
    }

    // Next Lesson Button Setup
    const nextBtn = document.getElementById('next-lesson-btn');
    nextBtn.disabled = true;
    
    const isCompleted = state.completedLessons.includes(lesson.id);
    if (isCompleted) {
      nextBtn.disabled = false;
      lesson.checkpoints.forEach(cp => {
        const item = document.getElementById(`cp-${cp.id}`);
        if (item) item.classList.add('completed');
      });
    }

    // Update Hint button label and status
    const hintBtn = document.getElementById('get-hint-btn');
    const solveBtn = document.getElementById('solve-level-btn');
    if (lesson.solution) {
      hintBtn.style.display = 'flex';
      solveBtn.style.display = 'flex';
      const cost = (state.hintsUsedToday + 1) * 10;
      if (state.hintsUsedToday >= 1000) {
        hintBtn.innerText = `✨ Hint (Maxed)`;
        hintBtn.disabled = true;
      } else {
        hintBtn.innerText = `✨ Hint (${cost} XP)`;
        hintBtn.disabled = false;
      }
    } else {
      hintBtn.style.display = 'none';
      solveBtn.style.display = 'none';
    }
  }

  // 6. Custom Editor Syntax Highlighting & Sync
  const textarea = document.getElementById('code-input');
  const highlightEl = document.getElementById('code-highlight-box');
  const lineNumbersEl = document.getElementById('line-numbers-box');

  function syncEditor(code, lang) {
    highlightEl.innerHTML = highlightCode(code, lang) + "\n";
    
    const lineCount = code.split('\n').length;
    let lineNumbersHTML = '';
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHTML += `<div>${i}</div>`;
    }
    lineNumbersEl.innerHTML = lineNumbersHTML;

    if (state.currentTrack) {
      const lesson = window.CodexCurriculum[state.currentTrack].chapters[state.currentChapterIdx].lessons[state.currentLessonIdx];
      const draftKey = `${state.currentTrack}_${lesson.id}`;
      state.editorContent[draftKey] = code;
    }
  }

  function highlightCode(code, lang) {
    let escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (lang === 'luau') {
      const keywords = ['local', 'function', 'end', 'if', 'then', 'else', 'elseif', 'for', 'in', 'do', 'while', 'repeat', 'until', 'return', 'and', 'or', 'not', 'true', 'false', 'nil'];
      const builtins = ['print', 'Instance', 'Vector3', 'Color3', 'Workspace', 'game', 'task', 'table'];
      
      escaped = escaped.replace(/(['"])(.*?)\1/g, '<span class="code-string">"$2"</span>');
      escaped = escaped.replace(/(--.*)/g, '<span class="code-comment">$1</span>');
      keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-keyword">${kw}</span>`);
      });
      builtins.forEach(bi => {
        const regex = new RegExp(`\\b${bi}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-function">${bi}</span>`);
      });
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');

    } else if (lang === 'python') {
      const keywords = ['def', 'if', 'elif', 'else', 'for', 'in', 'while', 'return', 'and', 'or', 'not', 'True', 'False', 'None', 'import', 'as', 'from'];
      const builtins = ['print', 'len', 'range', 'str', 'int', 'float'];

      escaped = escaped.replace(/(['"])(.*?)\1/g, '<span class="code-string">"$2"</span>');
      escaped = escaped.replace(/(#.*)/g, '<span class="code-comment">$1</span>');
      keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-keyword">${kw}</span>`);
      });
      builtins.forEach(bi => {
        const regex = new RegExp(`\\b${bi}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-function">${bi}</span>`);
      });
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');

    } else if (lang === 'js') {
      const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'true', 'false', 'null', 'import', 'export', 'class', 'new'];
      const builtins = ['console', 'log', 'Math', 'JSON'];

      escaped = escaped.replace(/(['"])(.*?)\1/g, '<span class="code-string">"$2"</span>');
      escaped = escaped.replace(/(\/\/.*)/g, '<span class="code-comment">$1</span>');
      keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-keyword">${kw}</span>`);
      });
      builtins.forEach(bi => {
        const regex = new RegExp(`\\b${bi}\\b`, 'g');
        escaped = escaped.replace(regex, `<span class="code-function">${bi}</span>`);
      });
      escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
    }

    return escaped;
  }

  // Handle Input events on Editor
  // 6. Caret & Autocomplete Logic
  const autocompleteBox = document.getElementById('autocomplete-box');
  let activeSuggestionIdx = 0;
  let currentSuggestions = [];
  let suggestionStartPos = 0;
  let suggestionEndPos = 0;
  let currentQuery = "";

  const autocompleteVocab = {
    luau: [
      { display: "local", insertText: "local", hint: "keyword" },
      { display: "function", insertText: "function", hint: "keyword" },
      { display: "print", insertText: "print()", hint: "function" },
      { display: "Instance", insertText: "Instance", hint: "global" },
      { display: "Vector3", insertText: "Vector3", hint: "global" },
      { display: "Color3", insertText: "Color3", hint: "global" },
      { display: "Workspace", insertText: "Workspace", hint: "global" },
      { display: "game", insertText: "game", hint: "global" },
      { display: "task.wait", insertText: "task.wait(1)", hint: "time" },
      { display: "table.insert", insertText: "table.insert(t, val)", hint: "table" },
      
      { display: "new(\"Part\")", insertText: "new(\"Part\")", hint: "constructor", memberOf: "Instance" },
      { display: "new(x, y, z)", insertText: "new(0, 10, 0)", hint: "vector", memberOf: "Vector3" },
      { display: "fromRGB(r, g, b)", insertText: "fromRGB(255, 0, 0)", hint: "color", memberOf: "Color3" },
      { display: "Parent", insertText: "Parent", hint: "property", memberOf: "part" },
      { display: "Color", insertText: "Color", hint: "property", memberOf: "part" },
      { display: "BrickColor", insertText: "BrickColor", hint: "property", memberOf: "part" },
      { display: "Size", insertText: "Size", hint: "property", memberOf: "part" },
      { display: "Position", insertText: "Position", hint: "property", memberOf: "part" },
      { display: "Anchored", insertText: "Anchored", hint: "property", memberOf: "part" },
      { display: "Transparency", insertText: "Transparency", hint: "property", memberOf: "part" },
      { display: "Touched:Connect", insertText: "Touched:Connect", hint: "event", memberOf: "part" }
    ],
    python: [
      { display: "print", insertText: "print()", hint: "function" },
      { display: "def", insertText: "def ", hint: "keyword" },
      { display: "range", insertText: "range()", hint: "function" },
      { display: "len", insertText: "len()", hint: "function" },
      { display: "while", insertText: "while ", hint: "keyword" },
      { display: "True", insertText: "True", hint: "boolean" },
      { display: "False", insertText: "False", hint: "boolean" },
      { display: "None", insertText: "None", hint: "null" },
      { display: "append()", insertText: "append()", hint: "list method", memberOf: "bag" },
      { display: "append()", insertText: "append()", hint: "list method", memberOf: "inventory" },
      { display: "append()", insertText: "append()", hint: "list method", memberOf: "list" }
    ],
    js: [
      { display: "console.log", insertText: "console.log()", hint: "method" },
      { display: "const", insertText: "const ", hint: "keyword" },
      { display: "let", insertText: "let ", hint: "keyword" },
      { display: "function", insertText: "function ", hint: "keyword" },
      { display: "Math", insertText: "Math", hint: "global" },
      { display: "JSON", insertText: "JSON", hint: "global" },
      { display: "log()", insertText: "log()", hint: "console method", memberOf: "console" },
      { display: "map()", insertText: "map()", hint: "array method", memberOf: "array" },
      { display: "filter()", insertText: "filter()", hint: "array method", memberOf: "array" }
    ]
  };

  // Get caret pixel coordinates relative to textarea container
  function getCaretCoordinates(element, position) {
    const properties = [
      'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
      'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
      'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
    ];

    const div = document.createElement('div');
    div.id = 'input-textarea-caret-position-mirror-div';
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle(element);

    style.whiteSpace = 'pre-wrap';
    style.wordWrap = 'break-word';
    style.position = 'absolute';
    style.visibility = 'hidden';

    properties.forEach(prop => {
      style[prop] = computed[prop];
    });

    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const coordinates = {
      top: span.offsetTop + (parseInt(computed['borderTopWidth']) || 0),
      left: span.offsetLeft + (parseInt(computed['borderLeftWidth']) || 0),
      height: parseInt(computed['lineHeight']) || (parseInt(computed['fontSize']) * 1.5) || 20
    };

    document.body.removeChild(div);
    return coordinates;
  }

  function hideAutocomplete() {
    autocompleteBox.style.display = 'none';
    currentSuggestions = [];
  }

  function repositionAutocomplete() {
    if (autocompleteBox.style.display !== 'block' && currentSuggestions.length === 0) return;
    if (currentSuggestions.length === 0) return;
    
    const pos = currentSuggestions[0] && currentSuggestions[0].hint === "AI Solution Hint" ? textarea.selectionStart : suggestionStartPos;
    const coords = getCaretCoordinates(textarea, pos);
    
    const relativeTop = coords.top - textarea.scrollTop;
    const relativeLeft = coords.left - textarea.scrollLeft;

    autocompleteBox.style.display = 'block';
    const boxHeight = autocompleteBox.offsetHeight || 120;
    const editorHeight = textarea.clientHeight;

    if (relativeTop + coords.height + 6 + boxHeight > editorHeight && relativeTop - boxHeight - 6 > 0) {
      autocompleteBox.style.top = `${relativeTop - boxHeight - 6}px`;
    } else {
      autocompleteBox.style.top = `${relativeTop + coords.height + 6}px`;
    }
    autocompleteBox.style.left = `${relativeLeft}px`;
  }

  function renderSuggestions() {
    if (currentSuggestions.length === 0) {
      hideAutocomplete();
      return;
    }

    autocompleteBox.innerHTML = '';
    currentSuggestions.forEach((suggestion, idx) => {
      const item = document.createElement('div');
      item.className = `autocomplete-item ${idx === activeSuggestionIdx ? 'active' : ''}`;
      item.innerHTML = `
        <span style="font-weight:600;">✨ ${suggestion.display}</span>
        <span class="autocomplete-hint">${suggestion.hint}</span>
      `;
      
      item.addEventListener('click', () => {
        activeSuggestionIdx = idx;
        acceptSuggestion();
      });

      autocompleteBox.appendChild(item);
    });
  }

  function acceptSuggestion() {
    if (currentSuggestions.length === 0) return;
    const suggestion = currentSuggestions[activeSuggestionIdx];
    const val = textarea.value;

    let replacement = "";
    if (suggestion.hint === "AI Solution Hint") {
      // Replace the entire line without prefixing (from hint button)
      replacement = suggestion.insertText;
    } else if (currentQuery.includes('.') || currentQuery.includes(':')) {
      const lastDot = currentQuery.lastIndexOf('.');
      const lastColon = currentQuery.lastIndexOf(':');
      const splitIdx = Math.max(lastDot, lastColon);
      const prefix = currentQuery.substring(0, splitIdx + 1);
      replacement = prefix + suggestion.insertText;
    } else {
      replacement = suggestion.insertText;
    }

    textarea.value = val.substring(0, suggestionStartPos) + replacement + val.substring(suggestionEndPos);
    
    const newCursorPos = suggestionStartPos + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    
    hideAutocomplete();
    syncEditor(textarea.value, state.currentTrack);
    textarea.focus();
  }

  function checkAutocomplete() {
    const cursor = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursor);
    
    const match = textBefore.match(/[\w.:]+$/);
    if (!match) {
      hideAutocomplete();
      return;
    }

    const query = match[0];
    
    if (query.length < 2 && !query.includes('.') && !query.includes(':')) {
      hideAutocomplete();
      return;
    }

    currentQuery = query;
    suggestionStartPos = cursor - query.length;
    suggestionEndPos = cursor;

    const vocab = autocompleteVocab[state.currentTrack] || [];
    
    if (query.includes('.') || query.includes(':')) {
      const parts = query.split(/[.:]/);
      const parentObj = parts[parts.length - 2];
      const searchField = parts[parts.length - 1].toLowerCase();
      
      currentSuggestions = vocab.filter(item => {
        return item.memberOf && 
               item.memberOf.toLowerCase() === parentObj.toLowerCase() && 
               item.display.toLowerCase().startsWith(searchField);
      });
    } else {
      currentSuggestions = vocab.filter(item => {
        return !item.memberOf && 
               item.display.toLowerCase().startsWith(query.toLowerCase());
      });
    }

    if (currentSuggestions.length > 0) {
      activeSuggestionIdx = 0;
      renderSuggestions();
      
      repositionAutocomplete();
    } else {
      hideAutocomplete();
    }
  }

  textarea.addEventListener('input', (e) => {
    syncEditor(e.target.value, state.currentTrack);
    checkAutocomplete();
  });

  textarea.addEventListener('scroll', () => {
    highlightEl.scrollTop = textarea.scrollTop;
    highlightEl.scrollLeft = textarea.scrollLeft;
    lineNumbersEl.scrollTop = textarea.scrollTop;
    repositionAutocomplete();
  });

  textarea.addEventListener('keydown', (e) => {
    // Play sound on typing
    playTypeSound();

    const pairs = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'"
    };

    // 1. Handle Backspace on matched pairs
    if (e.key === 'Backspace') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start === end && start > 0 && start < val.length) {
        const charBefore = val[start - 1];
        const charAfter = val[start];
        if (pairs[charBefore] === charAfter) {
          e.preventDefault();
          textarea.value = val.substring(0, start - 1) + val.substring(start + 1);
          textarea.selectionStart = textarea.selectionEnd = start - 1;
          syncEditor(textarea.value, state.currentTrack);
          return;
        }
      }
    }

    // 2. Handle over-typing of closing characters
    const closingChars = [')', ']', '}', '"', "'"];
    if (closingChars.includes(e.key)) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start === end && start < val.length && val[start] === e.key) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        return;
      }
    }

    // 3. Handle auto-closing of opening characters and selection wrapping
    if (pairs[e.key] !== undefined) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const closingChar = pairs[e.key];

      if (start !== end) {
        const selectionText = val.substring(start, end);
        textarea.value = val.substring(0, start) + e.key + selectionText + closingChar + val.substring(end);
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = end + 1;
      } else {
        textarea.value = val.substring(0, start) + e.key + closingChar + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }
      
      syncEditor(textarea.value, state.currentTrack);
      checkAutocomplete();
      return;
    }

    if (autocompleteBox.style.display === 'block' && currentSuggestions.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIdx = (activeSuggestionIdx + 1) % currentSuggestions.length;
        renderSuggestions();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIdx = (activeSuggestionIdx - 1 + currentSuggestions.length) % currentSuggestions.length;
        renderSuggestions();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
      }
    } else {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        
        textarea.value = val.substring(0, start) + "    " + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
        
        syncEditor(textarea.value, state.currentTrack);
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target !== textarea && !autocompleteBox.contains(e.target)) {
      hideAutocomplete();
    }
  });

  // 7. Tab Toggling (Output vs Roblox viewport)
  document.querySelectorAll('.output-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.output-content-pane').forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const paneId = tab.getAttribute('data-pane');
      document.getElementById(paneId).classList.add('active');

      if (paneId === 'roblox-sim-pane' && window.simulatorInstance) {
        window.simulatorInstance.resizeCanvas();
      }
    });
  });

  // 8. Run Code & Validation Checkpoints
  document.getElementById('run-code-btn').addEventListener('click', () => {
    const code = textarea.value;
    const track = state.currentTrack;
    const lesson = window.CodexCurriculum[track].chapters[state.currentChapterIdx].lessons[state.currentLessonIdx];

    let result;
    if (track === 'luau') {
      result = window.CodexInterpreter.runLuau(code, window.simulatorInstance);
    } else if (track === 'python') {
      result = window.CodexInterpreter.runPython(code);
    } else if (track === 'js') {
      result = window.CodexInterpreter.runJS(code);
    }

    // Display outputs
    const consoleOutput = document.getElementById('console-output-pane');
    consoleOutput.innerHTML = '';

    if (result.success) {
      if (result.logs.length === 0) {
        consoleOutput.innerHTML = '<div class="console-log-row info">> Code completed with no output.</div>';
      } else {
        result.logs.forEach(log => {
          const row = document.createElement('div');
          row.className = `console-log-row ${log.type}`;
          row.innerText = `> ${log.text}`;
          consoleOutput.appendChild(row);
        });
      }
    } else {
      const errRow = document.createElement('div');
      errRow.className = 'console-log-row error';
      errRow.innerText = `> ${result.error}`;
      consoleOutput.appendChild(errRow);
    }

    // Validate Checkpoints
    let allPassed = true;
    const simState = track === 'luau' && window.simulatorInstance ? { parts: window.simulatorInstance.parts } : null;
    const cleanLogs = result.logs || [];

    lesson.checkpoints.forEach(cp => {
      const item = document.getElementById(`cp-${cp.id}`);
      let passed = false;
      try {
        passed = cp.check(code, cleanLogs, simState);
      } catch (err) {
        console.error("Checkpoint check error", err);
      }

      if (passed) {
        item.classList.add('completed');
      } else {
        item.classList.remove('completed');
        allPassed = false;
      }
    });

    if (allPassed && result.success) {
      const isFirstTime = !state.completedLessons.includes(lesson.id);
      if (isFirstTime) {
        state.completedLessons.push(lesson.id);
        state.xp += lesson.xp;
        saveState();
      }
      
      const successRow = document.createElement('div');
      successRow.className = 'console-log-row success';
      successRow.innerText = `🎉 Correct! +${lesson.xp} XP earned.`;
      consoleOutput.appendChild(successRow);

      spawnConfetti();
      playCompleteSound();
      document.getElementById('next-lesson-btn').disabled = false;
    }
  });

  // 9. Next Lesson Navigator
  document.getElementById('next-lesson-btn').addEventListener('click', () => {
    playClickSound();
    const track = window.CodexCurriculum[state.currentTrack];
    const chapter = track.chapters[state.currentChapterIdx];
    
    if (state.currentLessonIdx < chapter.lessons.length - 1) {
      startLesson(state.currentTrack, state.currentChapterIdx, state.currentLessonIdx + 1);
    } else if (state.currentChapterIdx < track.chapters.length - 1) {
      startLesson(state.currentTrack, state.currentChapterIdx + 1, 0);
    } else {
      alert(`Congratulations! You have completed the entire ${track.title} course!`);
      showView('dashboard-view');
      renderDashboard();
    }
  });

  // 10. Quizzes Implementation (SPA Clean Resets)
  let activeQuiz = null;
  let quizQuestionIdx = 0;
  let quizScore = 0;
  let tempSelectedIdx = null;

  function startQuiz(quizLesson) {
    activeQuiz = quizLesson;
    quizQuestionIdx = 0;
    quizScore = 0;
    tempSelectedIdx = null;
    
    // Restore the clean quiz template HTML in the DOM
    quizView.innerHTML = quizTemplateHTML;
    
    showView('quiz-view');
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const q = activeQuiz.questions[quizQuestionIdx];
    const progressPercent = Math.round((quizQuestionIdx / activeQuiz.questions.length) * 100);
    
    document.getElementById('quiz-progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('quiz-progress-lbl').innerText = `Question ${quizQuestionIdx + 1} of ${activeQuiz.questions.length}`;
    document.getElementById('quiz-question-title').innerText = q.question;
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, idx) => {
      const div = document.createElement('div');
      div.className = 'quiz-option';
      div.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div class="quiz-option-letter">${letters[idx]}</div>
          <span>${opt}</span>
        </div>
      `;
      div.addEventListener('click', () => selectQuizOption(idx));
      optionsContainer.appendChild(div);
    });

    const feedback = document.getElementById('quiz-feedback-box');
    feedback.style.display = 'none';
    feedback.className = 'quiz-feedback';

    const submitBtn = document.getElementById('quiz-submit-btn');
    submitBtn.innerText = "Check Answer";
    submitBtn.disabled = true;
    submitBtn.onclick = checkQuizAnswer;
  }

  function selectQuizOption(idx) {
    document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
    const options = document.querySelectorAll('.quiz-option');
    if (options[idx]) {
      options[idx].classList.add('selected');
      tempSelectedIdx = idx;
      document.getElementById('quiz-submit-btn').disabled = false;
    }
  }

  function checkQuizAnswer() {
    const q = activeQuiz.questions[quizQuestionIdx];
    const isCorrect = tempSelectedIdx === q.correctIndex;
    
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(o => o.style.pointerEvents = 'none'); // Disable clicking

    const feedback = document.getElementById('quiz-feedback-box');
    feedback.style.display = 'block';

    if (isCorrect) {
      options[tempSelectedIdx].classList.add('correct');
      feedback.className = 'quiz-feedback';
      feedback.innerText = `Correct! ${q.explanation}`;
      quizScore++;
    } else {
      options[tempSelectedIdx].classList.add('wrong');
      options[q.correctIndex].classList.add('correct');
      feedback.className = 'quiz-feedback show-error';
      feedback.innerText = `Incorrect. ${q.explanation}`;
    }

    const submitBtn = document.getElementById('quiz-submit-btn');
    submitBtn.innerText = quizQuestionIdx === activeQuiz.questions.length - 1 ? "Finish Quiz" : "Next Question";
    submitBtn.onclick = advanceQuiz;
  }

  function advanceQuiz() {
    if (quizQuestionIdx < activeQuiz.questions.length - 1) {
      quizQuestionIdx++;
      renderQuizQuestion();
    } else {
      renderQuizResults();
    }
  }

  function renderQuizResults() {
    const container = quizView.querySelector('.quiz-container');
    const rewardXP = quizScore === activeQuiz.questions.length ? activeQuiz.xp : Math.round(activeQuiz.xp * (quizScore / activeQuiz.questions.length));

    // Award XP
    const isFirstTime = !state.completedLessons.includes(activeQuiz.id);
    if (isFirstTime && rewardXP > 0) {
      state.completedLessons.push(activeQuiz.id);
      state.xp += rewardXP;
      saveState();
    }

    // Render results cards and SPA back button
    container.innerHTML = `
      <div class="quiz-results">
        <div class="results-icon">🏆</div>
        <h2 class="results-title">Quiz Completed!</h2>
        <p class="results-desc">You completed the quiz for this chapter. Excellent job keeping up your streak!</p>
        
        <div class="results-score-card">
          <div class="results-score-value">${quizScore} / ${activeQuiz.questions.length}</div>
          <div class="results-score-label">Correct Answers</div>
        </div>

        <div style="font-weight: 700; color: var(--accent-gold); margin-bottom: 2rem;">+${rewardXP} XP Earned</div>

        <button class="quiz-btn" id="quiz-close-btn">Return to Path</button>
      </div>
    `;

    // Seamless SPA routing back to Path View (fixes page reload issue)
    document.getElementById('quiz-close-btn').addEventListener('click', () => {
      showView('path-view');
      renderPath(state.currentTrack);
    });

    spawnConfetti();
    playCompleteSound();
  }

  // 11. Confetti helper
  function spawnConfetti() {
    const parent = document.body;
    const colors = ['#00d2d3', '#ffbe0b', '#ff007f', '#8338ec', '#00f5d4'];
    
    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      parent.appendChild(piece);
      
      setTimeout(() => piece.remove(), 2500);
    }
  }

  // 12. Setup navigation and sidebar routing
  document.getElementById('back-to-dashboard').addEventListener('click', () => {
    playClickSound();
    state.currentTrack = null;
    showView('dashboard-view');
    renderDashboard();
  });

  document.getElementById('back-to-path').addEventListener('click', () => {
    playClickSound();
    showView('path-view');
    renderPath(state.currentTrack);
  });

  document.querySelector('.logo-container').addEventListener('click', () => {
    playClickSound();
    state.currentTrack = null;
    showView('dashboard-view');
    renderDashboard();
  });

  // Sidebar Menu Tab Event Listeners
  document.getElementById('menu-learn').addEventListener('click', () => {
    playClickSound();
    if (state.currentTrack) {
      showView('path-view');
      renderPath(state.currentTrack);
    } else {
      showView('dashboard-view');
      renderDashboard();
    }
  });

  document.getElementById('menu-leaderboard').addEventListener('click', () => {
    playClickSound();
    renderLeaderboard();
    showView('leaderboard-view');
  });

  document.getElementById('menu-quests').addEventListener('click', () => {
    playClickSound();
    showView('quests-view');
  });

  document.getElementById('menu-profile').addEventListener('click', () => {
    playClickSound();
    showView('profile-view');
  });

  document.getElementById('menu-download').addEventListener('click', () => {
    playClickSound();
    showView('download-view');
  });

  document.getElementById('menu-settings').addEventListener('click', () => {
    playClickSound();
    showView('settings-view');
  });

  // Donate Tab Event Listener
  document.getElementById('menu-donate').addEventListener('click', () => {
    playClickSound();
    showView('donate-view');
    updateDonationLinksUI();
  });

  // Sign In / Admin Tab Event Listener
  document.getElementById('menu-signin').addEventListener('click', () => {
    playClickSound();
    if (state.isAdmin) {
      showView('admin-view');
      // Populate admin fields with current stats and donation links
      document.getElementById('admin-xp-input').value = state.xp === 999999 ? '' : state.xp;
      document.getElementById('admin-streak-input').value = state.streak;
      document.getElementById('admin-paypal-input').value = state.donationLinks ? (state.donationLinks.paypal || '') : '';
      document.getElementById('admin-coffee-input').value = state.donationLinks ? (state.donationLinks.buyMeACoffee || '') : '';
      document.getElementById('admin-mac-link-input').value = state.hostedAppLinks ? (state.hostedAppLinks.mac || '') : '';
      document.getElementById('admin-win-link-input').value = state.hostedAppLinks ? (state.hostedAppLinks.win || '') : '';
      document.getElementById('admin-linux-link-input').value = state.hostedAppLinks ? (state.hostedAppLinks.linux || '') : '';
    } else {
      showView('signin-view');
      // Reset to login mode
      authMode = 'login';
      document.getElementById('auth-title').innerText = 'Log In';
      document.getElementById('btn-submit-signin').innerText = 'Log In';
      document.getElementById('auth-toggle-link').innerText = "Don't have an account? Sign Up";
      document.getElementById('confirm-password-wrapper').style.display = 'none';
      document.getElementById('signin-username').value = '';
      document.getElementById('signin-password').value = '';
      document.getElementById('signin-confirm-password').value = '';
      document.getElementById('signin-error').style.display = 'none';
    }
  });

  // Track auth modes: 'login' vs 'register'
  let authMode = 'login';

  const authToggleLink = document.getElementById('auth-toggle-link');
  if (authToggleLink) {
    authToggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      playClickSound();
      const confirmPasswordWrapper = document.getElementById('confirm-password-wrapper');
      const authTitle = document.getElementById('auth-title');
      const submitBtn = document.getElementById('btn-submit-signin');
      const errorDiv = document.getElementById('signin-error');
      errorDiv.style.display = 'none';
      
      if (authMode === 'login') {
        authMode = 'register';
        authTitle.innerText = 'Sign Up';
        submitBtn.innerText = 'Create Account';
        authToggleLink.innerText = 'Already have an account? Log In';
        confirmPasswordWrapper.style.display = 'block';
      } else {
        authMode = 'login';
        authTitle.innerText = 'Log In';
        submitBtn.innerText = 'Log In';
        authToggleLink.innerText = "Don't have an account? Sign Up";
        confirmPasswordWrapper.style.display = 'none';
      }
    });
  }

  // Authentication Submission
  document.getElementById('btn-submit-signin').addEventListener('click', () => {
    playClickSound();
    const user = document.getElementById('signin-username').value.trim();
    const pass = document.getElementById('signin-password').value.trim();
    const confirmPass = document.getElementById('signin-confirm-password').value.trim();
    const errorDiv = document.getElementById('signin-error');

    if (!user || !pass) {
      errorDiv.innerText = 'Please enter both a username and password.';
      errorDiv.style.display = 'block';
      return;
    }

    if (authMode === 'register') {
      if (pass !== confirmPass) {
        errorDiv.innerText = 'Passwords do not match!';
        errorDiv.style.display = 'block';
        return;
      }

      if (user.toLowerCase() === 'admin') {
        errorDiv.innerText = 'Username is reserved.';
        errorDiv.style.display = 'block';
        return;
      }

      // Check if user already exists
      const existingAccounts = JSON.parse(localStorage.getItem('codex_accounts') || '{}');
      if (existingAccounts[user]) {
        errorDiv.innerText = 'Username already exists.';
        errorDiv.style.display = 'block';
        return;
      }

      // Register new user
      existingAccounts[user] = pass;
      localStorage.setItem('codex_accounts', JSON.stringify(existingAccounts));

      // Setup fresh user state
      const newUserState = {
        currentUser: user,
        xp: 0,
        streak: 0,
        completedLessons: [],
        currentTrack: null,
        currentChapterIdx: 0,
        currentLessonIdx: 0,
        editorContent: {},
        hintsUsedToday: 0,
        lastHintTimestamp: 0,
        currentTheme: 'obsidian',
        soundSettings: {
          soundEnabled: true,
          clickPreset: 'duo-ping',
          typePreset: 'mech-click',
          customClick: null,
          customType: null
        },
        isAdmin: false
      };
      
      localStorage.setItem(`codex_user_${user}`, JSON.stringify(newUserState));
      localStorage.setItem('codex_current_user', user);

      // Load state and route to dashboard
      loadState();
      showView('dashboard-view');
      renderDashboard();
    } else {
      // Login mode
      // First check admin credentials
      if (user === 'admin' && (pass === 'admin' || pass === 'secretadmin' || pass === 'admin123')) {
        localStorage.setItem('codex_current_user', 'admin');
        
        // Setup admin account profile if it doesn't exist
        const adminSaved = localStorage.getItem('codex_user_admin');
        if (!adminSaved) {
          const adminState = {
            currentUser: 'admin',
            xp: 999999,
            streak: 0,
            completedLessons: [],
            currentTrack: null,
            currentChapterIdx: 0,
            currentLessonIdx: 0,
            editorContent: {},
            hintsUsedToday: 0,
            lastHintTimestamp: 0,
            currentTheme: 'obsidian',
            soundSettings: {
              soundEnabled: true,
              clickPreset: 'duo-ping',
              typePreset: 'mech-click',
              customClick: null,
              customType: null
            },
            isAdmin: true
          };
          localStorage.setItem('codex_user_admin', JSON.stringify(adminState));
        }

        loadState();
        showView('admin-view');
        return;
      }

      // Check standard accounts
      const existingAccounts = JSON.parse(localStorage.getItem('codex_accounts') || '{}');
      if (existingAccounts[user] && existingAccounts[user] === pass) {
        localStorage.setItem('codex_current_user', user);
        loadState();
        showView('dashboard-view');
        renderDashboard();
      } else {
        errorDiv.innerText = 'Invalid username or password.';
        errorDiv.style.display = 'block';
      }
    }
  });

  // Admin Stats Modification
  document.getElementById('btn-admin-apply-stats').addEventListener('click', () => {
    playClickSound();
    const xpVal = parseInt(document.getElementById('admin-xp-input').value, 10);
    const streakVal = parseInt(document.getElementById('admin-streak-input').value, 10);
    
    if (!isNaN(xpVal)) {
      state.xp = xpVal;
    }
    if (!isNaN(streakVal)) {
      state.streak = streakVal;
    }
    
    saveState();
    updateNavStats();
    playCompleteSound(); // Play level completion sound to indicate success!
    
    const btn = document.getElementById('btn-admin-apply-stats');
    const originalText = btn.innerText;
    btn.innerText = '✅ Stats Applied!';
    btn.style.background = 'var(--duo-green)';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = '';
    }, 2000);
  });

  // Admin Donation Links Editor
  document.getElementById('btn-admin-apply-links').addEventListener('click', () => {
    playClickSound();
    const paypalVal = document.getElementById('admin-paypal-input').value.trim();
    const coffeeVal = document.getElementById('admin-coffee-input').value.trim();

    if (!state.donationLinks) {
      state.donationLinks = {};
    }
    state.donationLinks.paypal = paypalVal;
    state.donationLinks.buyMeACoffee = coffeeVal;

    saveGlobalConfig();
    saveState();
    updateDonationLinksUI();
    playCompleteSound(); // Play level completion sound to indicate success!

    const btn = document.getElementById('btn-admin-apply-links');
    const originalText = btn.innerText;
    btn.innerText = '✅ Links Saved!';
    btn.style.background = 'var(--duo-green)';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = '';
    }, 2000);
  });

  // Admin App Installer Links Editor
  document.getElementById('btn-admin-apply-app-links').addEventListener('click', () => {
    playClickSound();
    const macVal = document.getElementById('admin-mac-link-input').value.trim();
    const winVal = document.getElementById('admin-win-link-input').value.trim();
    const linuxVal = document.getElementById('admin-linux-link-input').value.trim();

    if (!state.hostedAppLinks) {
      state.hostedAppLinks = {};
    }
    state.hostedAppLinks.mac = macVal;
    state.hostedAppLinks.win = winVal;
    state.hostedAppLinks.linux = linuxVal;

    saveGlobalConfig();
    saveState();
    updateDownloadPageLinks();
    playCompleteSound();

    const btn = document.getElementById('btn-admin-apply-app-links');
    const originalText = btn.innerText;
    btn.innerText = '✅ Links Saved!';
    btn.style.background = 'var(--duo-green)';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = '';
    }, 2000);
  });

  // Admin Sign Out
  document.getElementById('btn-admin-signout').addEventListener('click', () => {
    playClickSound();
    localStorage.removeItem('codex_current_user');
    state.currentUser = null;
    state.isAdmin = false;
    loadState();
  });

  // User Profile Sign Out & Navigation Redirects
  const profileSettingsBtn = document.getElementById('btn-profile-settings');
  if (profileSettingsBtn) {
    profileSettingsBtn.addEventListener('click', () => {
      playClickSound();
      showView('settings-view');
    });
  }

  const profileDonateBtn = document.getElementById('btn-profile-donate');
  if (profileDonateBtn) {
    profileDonateBtn.addEventListener('click', () => {
      playClickSound();
      showView('donate-view');
      updateDonationLinksUI();
    });
  }

  const profileSignoutBtn = document.getElementById('btn-profile-signout');
  if (profileSignoutBtn) {
    profileSignoutBtn.addEventListener('click', () => {
      playClickSound();
      localStorage.removeItem('codex_current_user');
      state.currentUser = null;
      state.isAdmin = false;
      loadState();
    });
  }

  // Settings Panel Initialization & Controller
  function initSettingsUI() {
    const cb = document.getElementById('sound-enabled-checkbox');
    const clickSelect = document.getElementById('click-sound-select');
    const typeSelect = document.getElementById('type-sound-select');

    if (cb) {
      cb.checked = state.soundSettings.soundEnabled;
      cb.addEventListener('change', () => {
        state.soundSettings.soundEnabled = cb.checked;
        saveState();
        playClickSound();
      });
    }

    if (clickSelect) {
      clickSelect.value = state.soundSettings.clickPreset;
      clickSelect.addEventListener('change', () => {
        state.soundSettings.clickPreset = clickSelect.value;
        saveState();
        playClickSound();
      });
    }

    if (typeSelect) {
      typeSelect.value = state.soundSettings.typePreset;
      typeSelect.addEventListener('change', () => {
        state.soundSettings.typePreset = typeSelect.value;
        saveState();
        playTypeSound();
      });
    }

    // Custom sound file uploaders
    const clickFile = document.getElementById('click-sound-file');
    const clickStatus = document.getElementById('click-sound-status');
    if (clickFile) {
      clickFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert("File is too large! Please choose an audio file under 2MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          state.soundSettings.customClick = event.target.result;
          state.soundSettings.clickPreset = 'custom';
          if (clickSelect) clickSelect.value = 'custom';
          saveState();
          if (clickStatus) clickStatus.innerText = file.name;
          playClickSound();
        };
        reader.readAsDataURL(file);
      });
    }

    const typeFile = document.getElementById('type-sound-file');
    const typeStatus = document.getElementById('type-sound-status');
    if (typeFile) {
      typeFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert("File is too large! Please choose an audio file under 2MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          state.soundSettings.customType = event.target.result;
          state.soundSettings.typePreset = 'custom';
          if (typeSelect) typeSelect.value = 'custom';
          saveState();
          if (typeStatus) typeStatus.innerText = file.name;
          playTypeSound();
        };
        reader.readAsDataURL(file);
      });
    }

    if (state.soundSettings.customClick && clickStatus) {
      clickStatus.innerText = "Custom click sound loaded";
    }
    if (state.soundSettings.customType && typeStatus) {
      typeStatus.innerText = "Custom typing sound loaded";
    }

    const themeKeys = ['obsidian', 'duoLight', 'cyberpunk', 'terminal', 'emerald'];
    themeKeys.forEach(tKey => {
      const btn = document.getElementById(`theme-btn-${tKey}`);
      if (btn) {
        btn.addEventListener('click', () => {
          applyTheme(tKey);
          updateThemeButtons();
          saveState();
          playClickSound();
        });
      }
    });

    updateThemeButtons();
  }

  function updateThemeButtons() {
    const themeKeys = ['obsidian', 'duoLight', 'cyberpunk', 'terminal', 'emerald'];
    themeKeys.forEach(tKey => {
      const btn = document.getElementById(`theme-btn-${tKey}`);
      if (btn) {
        if (state.currentTheme === tKey) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      }
    });
  }

  // Reset Progress Handler
  const resetBtn = document.getElementById('btn-reset-save');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      playClickSound();
      if (confirm("Are you sure you want to reset your learning progress? This will clear all completed lessons.")) {
        localStorage.removeItem('codex_save_data');
        state.xp = 0;
        state.streak = 0;
        state.completedLessons = [];
        state.editorContent = {};
        state.hintsUsedToday = 0;
        state.lastHintTimestamp = 0;
        state.currentTrack = null;
        state.currentChapterIdx = 0;
        state.currentLessonIdx = 0;
        state.currentTheme = 'obsidian';
        state.soundSettings = {
          soundEnabled: true,
          clickPreset: 'duo-ping',
          typePreset: 'mech-click',
          customClick: null,
          customType: null
        };
        saveState();
        applyTheme('obsidian');
        showView('dashboard-view');
        renderDashboard();
      }
    });
  }

  // Document Click to Close Tooltips
  document.addEventListener('click', () => {
    const tooltipEl = document.getElementById('skill-tooltip');
    if (tooltipEl && tooltipEl.classList.contains('visible')) {
      tooltipEl.classList.remove('visible');
    }
  });

  // Hint Button Event Listener (Launches AI floating suggestion copilot)
  document.getElementById('get-hint-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click from immediately hiding the popup
    
    // 1. Double check daily reset
    const now = Date.now();
    const lastHintTime = state.lastHintTimestamp || 0;
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - lastHintTime > dayInMs) {
      state.hintsUsedToday = 0;
      state.lastHintTimestamp = now;
    }

    if (state.hintsUsedToday >= 1000) {
      alert("Daily hint limit reached!");
      return;
    }

    // 2. Calculate scaling XP cost
    const cost = (state.hintsUsedToday + 1) * 10;

    // 3. Enforce XP requirement
    if (state.xp < cost) {
      alert(`Not enough XP! You need ${cost} XP, but only have ${state.xp} XP.`);
      return;
    }

    // 4. Extract solution lines
    const lesson = window.CodexCurriculum[state.currentTrack].chapters[state.currentChapterIdx].lessons[state.currentLessonIdx];
    if (!lesson || !lesson.solution) return;

    const solutionLines = lesson.solution.split('\n');

    // 5. Determine correct solution line based on first uncompleted task (checkpoint)
    const checkpointElements = document.querySelectorAll('#checkpoint-list .checkpoint-item');
    let activeTaskIdx = 0;
    for (let i = 0; i < checkpointElements.length; i++) {
      if (!checkpointElements[i].classList.contains('completed')) {
        activeTaskIdx = i;
        break;
      }
    }

    const editorLines = textarea.value.split('\n');
    const cleanEditorLines = editorLines.map(line => line.toLowerCase().replace(/\s+/g, ''));

    // Find the first solution line starting from activeTaskIdx that is not yet fully written in the editor
    let suggestedLine = "";
    for (let i = activeTaskIdx; i < solutionLines.length; i++) {
      const solLine = solutionLines[i];
      const cleanSol = solLine.toLowerCase().replace(/\s+/g, '');
      if (!cleanSol) continue;

      // Count occurrences of cleanSol in solutionLines up to index i
      let solutionCount = 0;
      for (let j = 0; j <= i; j++) {
        if (solutionLines[j].toLowerCase().replace(/\s+/g, '') === cleanSol) {
          solutionCount++;
        }
      }

      // Count occurrences of cleanSol in cleanEditorLines
      let editorCount = 0;
      for (let j = 0; j < cleanEditorLines.length; j++) {
        if (cleanEditorLines[j] === cleanSol) {
          editorCount++;
        }
      }

      // If the editor has fewer occurrences than required up to this index, suggest it
      if (editorCount < solutionCount) {
        suggestedLine = solLine;
        break;
      }
    }

    // Fallback if all solution lines seem to be written
    if (!suggestedLine) {
      suggestedLine = solutionLines[activeTaskIdx] || solutionLines[solutionLines.length - 1] || "";
    }

    if (!suggestedLine.trim()) {
      alert("No code solution line available for this task!");
      return;
    }

    // Check if the current line is already identical to the suggestion
    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursor);
    const currentLineIdx = textBeforeCursor.split('\n').length - 1;
    const currentLineText = (editorLines[currentLineIdx] || "").trim();

    if (suggestedLine.trim() === currentLineText) {
      alert("This line is already correct!");
      return;
    }

    // 6. Deduct XP and save state (only if there is actually a change to apply)
    state.xp -= cost;
    state.hintsUsedToday++;
    state.lastHintTimestamp = now;
    saveState();

    // 7. Calculate bounds of the current active line to replace it completely
    const startOfCurrentLine = textBeforeCursor.lastIndexOf('\n') + 1;
    const textAfterCursor = textarea.value.substring(cursor);
    const nextNewlineIdx = textAfterCursor.indexOf('\n');
    const endOfCurrentLine = nextNewlineIdx === -1 ? textarea.value.length : cursor + nextNewlineIdx;

    suggestionStartPos = startOfCurrentLine;
    suggestionEndPos = endOfCurrentLine;
    currentQuery = textarea.value.substring(startOfCurrentLine, endOfCurrentLine);

    // 8. Feed as a single-item suggestion list
    currentSuggestions = [{
      display: suggestedLine,
      insertText: suggestedLine,
      hint: "AI Solution Hint"
    }];

    activeSuggestionIdx = 0;
    renderSuggestions();

    // 9. Position autocomplete box with overflow prevention using shared helper
    repositionAutocomplete();

    // 10. Update button label
    const nextCost = (state.hintsUsedToday + 1) * 10;
    const hintBtn = document.getElementById('get-hint-btn');
    if (state.hintsUsedToday >= 1000) {
      hintBtn.innerText = `✨ Hint (Maxed)`;
      hintBtn.disabled = true;
    } else {
      hintBtn.innerText = `✨ Hint (${nextCost} XP)`;
    }
    textarea.focus();
  });

  // Solve Level Click Listener
  document.getElementById('solve-level-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.xp < 10000) {
      alert(`Not enough XP! Solving a level costs 10,000 XP, but you only have ${state.xp} XP.`);
      return;
    }
    
    const lesson = window.CodexCurriculum[state.currentTrack].chapters[state.currentChapterIdx].lessons[state.currentLessonIdx];
    if (!lesson || !lesson.solution) return;
    
    // Deduct XP
    state.xp -= 10000;
    saveState();
    
    // Open the Solve & Explain modal
    showSolveLevelModal(lesson.solution, state.currentTrack);
  });

  // Generate line-by-line explanation for a solution
  function generateExplanations(solution, lang) {
    const lines = solution.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const trimmed = line.trim();
      let desc = "Executes operations.";
      
      if (trimmed.startsWith('--') || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        desc = "A code comment explaining the logic.";
      } else if (trimmed.includes('local ') && trimmed.includes('Instance.new')) {
        desc = "Creates a new object instance in Roblox Luau.";
      } else if (trimmed.includes('.Parent = Workspace')) {
        desc = "Spawns the part in the game world by parenting it to the Workspace.";
      } else if (trimmed.includes('.Position =')) {
        desc = "Sets the X, Y, Z coordinates of the part in 3D space.";
      } else if (trimmed.includes('.Size =')) {
        desc = "Sets the width, height, and depth size of the part.";
      } else if (trimmed.includes('.Color =')) {
        desc = "Applies a custom RGB color to the part.";
      } else if (trimmed.includes('.Anchored =')) {
        desc = "Determines whether the part is locked in place or affected by physics/gravity.";
      } else if (trimmed.includes('.Transparency =')) {
        desc = "Sets the opacity of the part (0.0 is solid, 1.0 is invisible).";
      } else if (trimmed.includes('Touched:Connect')) {
        desc = "Connects a function that fires when an object touches this part.";
      } else if (trimmed.startsWith('local ')) {
        desc = "Declares a local variable to store data efficiently.";
      } else if (trimmed.startsWith('print(')) {
        desc = "Prints a message or value to the console log.";
      } else if (trimmed.includes('for ') && (trimmed.includes('do') || trimmed.includes('in'))) {
        desc = "Starts a loop that repeats code for a sequence of values.";
      } else if (trimmed.includes('if ') && (trimmed.includes('then') || trimmed.includes(':'))) {
        desc = "Starts a conditional block that runs code if the condition is met.";
      } else if (trimmed.startsWith('def ')) {
        desc = "Defines a reusable function in Python.";
      } else if (trimmed.startsWith('const ')) {
        desc = "Declares a read-only constant variable in JavaScript.";
      } else if (trimmed.startsWith('let ')) {
        desc = "Declares a block-scoped variable in JavaScript.";
      } else if (trimmed.startsWith('function ')) {
        desc = "Defines a reusable function.";
      } else if (trimmed.startsWith('return ')) {
        desc = "Returns a result value from a function.";
      } else if (trimmed.includes('=')) {
        desc = "Assigns a value to a variable or property.";
      } else if (trimmed.includes('append(')) {
        desc = "Appends an element to the end of a list/array.";
      } else if (trimmed.includes('map(')) {
        desc = "Creates a new array by transforming each element in the array.";
      } else if (trimmed.includes('filter(')) {
        desc = "Creates a new array containing elements that pass a test.";
      } else if (trimmed.includes('console.log(')) {
        desc = "Logs a message to the browser or Node console.";
      }

      return { code: trimmed, desc: desc };
    });
  }

  // Display Solve Level Modal
  function showSolveLevelModal(solution, lang) {
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'solve-level-modal';
    modal.className = 'solve-modal-overlay';
    
    // Line-by-line explanation generator
    const explanations = generateExplanations(solution, lang);
    const explanationHTML = explanations.map(exp => `
      <div class="explanation-step">
        <div class="explanation-code"><code>${exp.code}</code></div>
        <div class="explanation-desc">${exp.desc}</div>
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="solve-modal-content">
        <div class="solve-modal-header">
          <h2>👑 Solve & Explain Level (10,000 XP Spent)</h2>
          <p>Read the explanation below, then re-write the code exactly to complete the level.</p>
        </div>
        
        <div class="solve-modal-body">
          <!-- Left side: Explanations -->
          <div class="solve-modal-left">
            <h3>Code Explanation</h3>
            <div class="explanations-list">
              ${explanationHTML}
            </div>
          </div>
          
          <!-- Right side: Re-write Practice -->
          <div class="solve-modal-right">
            <h3>Re-write Practice</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
              Type the code exactly as shown below:
            </p>
            <pre class="target-code-block"><code>${highlightCode(solution, lang)}</code></pre>
            
            <textarea class="rewrite-textarea" placeholder="Start typing the solution here..."></textarea>
            
            <div class="rewrite-status">
              <span class="status-badge error" id="rewrite-status-badge">Pending Match</span>
            </div>
            
            <button class="quiz-btn" id="confirm-solve-btn" style="width: 100%; margin-top: 1rem;" disabled>
              Complete Level
            </button>
          </div>
        </div>
        
        <button class="solve-modal-close-btn">&times;</button>
      </div>
    `;

    document.body.appendChild(modal);

    const textarea = modal.querySelector('.rewrite-textarea');
    const statusBadge = modal.querySelector('#rewrite-status-badge');
    const confirmBtn = modal.querySelector('#confirm-solve-btn');
    const closeBtn = modal.querySelector('.solve-modal-close-btn');

    // Handle typing match
    textarea.addEventListener('input', () => {
      const typed = textarea.value.trim().replace(/\r\n/g, '\n');
      const target = solution.trim().replace(/\r\n/g, '\n');
      
      const cleanTyped = typed.replace(/\s+/g, ' ');
      const cleanTarget = target.replace(/\s+/g, ' ');

      if (cleanTyped === cleanTarget) {
        statusBadge.className = 'status-badge success';
        statusBadge.innerText = '✅ Code Matches!';
        confirmBtn.disabled = false;
      } else {
        statusBadge.className = 'status-badge error';
        statusBadge.innerText = 'Pending Match';
        confirmBtn.disabled = true;
      }
    });

    // Close Modal
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Complete Level Action
    confirmBtn.addEventListener('click', () => {
      // 1. Fill code into main editor
      const mainTextarea = document.getElementById('code-input');
      mainTextarea.value = solution;
      syncEditor(solution, state.currentTrack);
      
      // 2. Mark lesson completed and save
      const lesson = window.CodexCurriculum[state.currentTrack].chapters[state.currentChapterIdx].lessons[state.currentLessonIdx];
      const isFirstTime = !state.completedLessons.includes(lesson.id);
      if (isFirstTime) {
        state.completedLessons.push(lesson.id);
        saveState();
      }
      
      // 3. Mark all checkpoints in the DOM completed
      document.querySelectorAll('#checkpoint-list .checkpoint-item').forEach(item => {
        item.classList.add('completed');
      });

      // 4. Enable next lesson button
      document.getElementById('next-lesson-btn').disabled = false;

      // 5. Success effect & Close Modal
      spawnConfetti();
      playCompleteSound();
      modal.remove();
    });
  }

  // Auto-update checker for Electron desktop app
  async function checkAppUpdates() {
    if (!window.electronAPI) return; // Only run inside Electron desktop client

    try {
      const currentVersion = await window.electronAPI.getCurrentVersion();
      const response = await fetch('https://api.github.com/repos/codex612/codex-code-lab/releases/latest');
      if (!response.ok) return;

      const data = await response.json();
      const latestVersion = data.tag_name.replace(/^v/, ''); // Remove leading 'v'

      // Compare versions
      if (isNewerVersion(latestVersion, currentVersion)) {
        // Find correct installer URL for platform
        const platform = window.electronAPI.getPlatform();
        let targetAsset = null;
        let filename = '';

        if (platform === 'darwin') {
          targetAsset = data.assets.find(asset => asset.name.endsWith('.dmg'));
          filename = `Codex-${latestVersion}-arm64.dmg`;
        } else if (platform === 'win32') {
          targetAsset = data.assets.find(asset => asset.name.endsWith('.exe'));
          filename = `Codex.Setup.${latestVersion}.exe`;
        } else {
          // Linux
          targetAsset = data.assets.find(asset => asset.name.endsWith('.AppImage'));
          filename = `Codex-${latestVersion}.AppImage`;
        }

        if (targetAsset) {
          showUpdatePromptModal(latestVersion, targetAsset.browser_download_url, filename);
        }
      }
    } catch (e) {
      console.error("Failed to check for updates:", e);
    }
  }

  // Version comparator helper (returns true if v1 > v2)
  function isNewerVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }
    return false;
  }

  function showUpdatePromptModal(latestVersion, downloadUrl, filename) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'update-prompt-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="chapter-container" style="max-width: 450px; padding: 2.5rem; text-align: center; display: flex; flex-direction: column; gap: 1.5rem;">
        <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 0.5rem; font-weight: 800;">📥 Update Required</h2>
        <p style="color: var(--duo-text-muted); font-size: 0.95rem; line-height: 1.5;">
          A new version of Codex is available: <strong style="color: var(--accent-gold);">v${latestVersion}</strong>.<br>
          An update is needed to continue using the application.
        </p>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button class="quiz-btn" id="btn-update-now" style="flex: 1; padding: 0.85rem !important; background: var(--duo-green) !important; box-shadow: 0 4px 0 var(--duo-green-shadow) !important;">Install Now</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-update-now').addEventListener('click', () => {
      modal.remove();
      showUpdateDownloadingModal(downloadUrl, filename);
    });
  }

  function showUpdateDownloadingModal(downloadUrl, filename) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'update-downloading-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="chapter-container" style="max-width: 450px; padding: 2.5rem; text-align: center; display: flex; flex-direction: column; gap: 1.5rem; width: 90%;">
        <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 0.5rem; font-weight: 800;">📥 Downloading Update...</h2>
        <p id="update-download-status" style="color: var(--duo-text-muted); font-size: 0.9rem;">Connecting to server...</p>
        <div style="width: 100%; height: 12px; background: var(--duo-border); border-radius: 6px; overflow: hidden; margin: 0.5rem 0;">
          <div id="update-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--duo-blue), var(--accent-purple)); transition: width 0.1s ease; border-radius: 6px;"></div>
        </div>
        <p id="update-percent-text" style="color: #fff; font-weight: 800; font-size: 1.1rem;">0%</p>
      </div>
    `;

    document.body.appendChild(modal);

    window.electronAPI.startUpdate(downloadUrl, filename);

    window.electronAPI.onUpdateProgress((progress) => {
      document.getElementById('update-progress-bar').style.width = `${progress}%`;
      document.getElementById('update-percent-text').innerText = `${progress}%`;
      document.getElementById('update-download-status').innerText = `Downloading installation package...`;
    });

    window.electronAPI.onUpdateError((message) => {
      modal.innerHTML = `
        <div class="chapter-container" style="max-width: 450px; padding: 2.5rem; text-align: center; display: flex; flex-direction: column; gap: 1.5rem;">
          <h2 style="font-size: 1.6rem; color: #ff4c4c; margin-bottom: 0.5rem; font-weight: 800;">❌ Update Failed</h2>
          <p style="color: var(--duo-text-muted); font-size: 0.95rem; line-height: 1.5;">
            An error occurred while downloading the update:<br>
            <span style="color: #ff8888; font-family: monospace; display: block; margin-top: 0.5rem;">${message}</span>
          </p>
          <button class="quiz-btn" onclick="document.getElementById('update-downloading-modal').remove()" style="padding: 0.85rem !important; background: #ff4c4c !important; box-shadow: 0 4px 0 #cc3c3c !important;">Close</button>
        </div>
      `;
    });

    window.electronAPI.onUpdateComplete(() => {
      document.getElementById('update-download-status').innerText = `Download complete! Running installer and restarting...`;
      document.getElementById('update-progress-bar').style.width = `100%`;
      document.getElementById('update-percent-text').innerText = `100%`;
    });
  }

  // Initialization
  loadState();
  renderDashboard();
  initSettingsUI();
  if (state.currentUser) {
    showView('dashboard-view');
  } else {
    showView('signin-view');
  }
  checkAppUpdates();
});
