// timer-module.js
export function initTimer(root) {
  // State
  let timer = null;
  let blinkTimer = null;
  let totalSeconds = 0;
  let remaining = 0;
  let isRunning = false;

  let currentAudio = null;
  let audioStopTimeout = null;
  let alertActive = false;
  let currentVolume = 0.5;
  let pipWindowRef = null;
  let sessionActive = false;

  // Persistent shift variables
  let totalWorkSeconds = parseInt(localStorage.getItem('totalWorkSeconds'), 10) || 0;
  let taskCount = parseInt(localStorage.getItem('taskCount'), 10) || 0;
  let overtimeSeconds = 0;
  let glowTriggered = totalWorkSeconds >= 25500;
  
  let recentTasks = [];
  try {
    recentTasks = JSON.parse(localStorage.getItem('recentTasks')) || [];
  } catch (e) {
    recentTasks = [];
  }

  // Scoped DOM lookups (root + namespaced IDs)
  const popup = document.getElementById('timer-popup');
  const timeDisplay = document.getElementById('timer-timeDisplay');

  const soundSelect = root.querySelector('#timer-soundSelect');
  const volumeControl = root.querySelector('#timer-volumeControl');
  const pauseBtn = document.getElementById('timer-pauseBtn');
  const startBtn = document.getElementById('timer-startBtn');
  const previewBtn = root.querySelector('#timer-previewBtn');

  const hoursInput = root.querySelector('#timer-hours');
  const minutesInput = root.querySelector('#timer-minutes');
  const secondsInput = root.querySelector('#timer-seconds');

  const restartBtn = document.getElementById('timer-restartBtn');
  const closePopupBtn = document.getElementById('timer-closePopup');

  // Dashboard DOM lookups
  const utPercentDisplay = root.querySelector('#timer-dashboard-utPercent');
  const taskCountDisplay = root.querySelector('#timer-dashboard-taskCount');
  const workTimeDisplay = root.querySelector('#timer-dashboard-workTime');
  const progressPercentDisplay = root.querySelector('#timer-dashboard-progressPercent');
  const progressFill = root.querySelector('#timer-dashboard-progressFill');
  const resetStatsBtn = root.querySelector('#timer-dashboard-resetBtn');
  
  const avgTimeDisplay = root.querySelector('#timer-dashboard-avgTime');
  const eta85Display = root.querySelector('#timer-dashboard-eta85');
  const eta100Display = root.querySelector('#timer-dashboard-eta100');
  const recentList = root.querySelector('#timer-dashboard-recentList');
  const volumeTestBtn = root.querySelector('#timer-volumeTestBtn');
  const dashboardCard = root.querySelector('#dashboardCard');
  const revertBtn = root.querySelector('#timer-revertBtn');

  const audioMap = {
    soft2: 'sounds/soft2.mp3',
    alarm: 'sounds/alarm.wav',
    'timer-off': 'sounds/timer-off.wav',
    loud: 'sounds/loud.mp3',
    timer: 'sounds/timer-beep.mp3',
    normal: 'sounds/normal.mp3',
    soft1: 'sounds/soft1.mp3'
  };

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function saveStats() {
    localStorage.setItem('totalWorkSeconds', totalWorkSeconds);
    localStorage.setItem('taskCount', taskCount);
  }

  function updateDashboard() {
    const utPercent = totalWorkSeconds / 300;
    if (utPercentDisplay) utPercentDisplay.textContent = `${utPercent.toFixed(2)}%`;
    if (taskCountDisplay) taskCountDisplay.textContent = taskCount;
    if (workTimeDisplay) workTimeDisplay.textContent = formatTime(totalWorkSeconds);
    if (progressPercentDisplay) progressPercentDisplay.textContent = `${utPercent.toFixed(2)}%`;
    if (progressFill) {
      progressFill.style.width = `${Math.min(utPercent, 100)}%`;
      if (totalWorkSeconds >= 30000) {
        progressFill.classList.add('rainbow-fill');
      } else {
        progressFill.classList.remove('rainbow-fill');
      }
    }

    // Avg Time / Task
    let avgTaskTimeText = '--:--';
    if (taskCount > 0) {
      const avgSecs = Math.floor(totalWorkSeconds / taskCount);
      const m = Math.floor(avgSecs / 60);
      const s = avgSecs % 60;
      avgTaskTimeText = `${pad(m)}:${pad(s)}`;
    }
    if (avgTimeDisplay) avgTimeDisplay.textContent = avgTaskTimeText;

    // Projections
    const eta85Seconds = Math.max(0, 25500 - totalWorkSeconds);
    const eta100Seconds = Math.max(0, 30000 - totalWorkSeconds);

    if (eta85Display) eta85Display.textContent = formatTime(eta85Seconds);
    if (eta100Display) eta100Display.textContent = formatTime(eta100Seconds);

    // 85% Milestone Glow Animation
    if (!glowTriggered && totalWorkSeconds >= 25500) {
      glowTriggered = true;
      if (dashboardCard) {
        dashboardCard.classList.remove('milestone-glow');
        void dashboardCard.offsetWidth; // force reflow
        dashboardCard.classList.add('milestone-glow');
        setTimeout(() => {
          dashboardCard.classList.remove('milestone-glow');
        }, 3000);
      }
    }
  }

  function clearBlink() {
    if (blinkTimer) {
      clearInterval(blinkTimer);
      blinkTimer = null;
    }
    timeDisplay.classList.remove('blink');
  }

  function updateDisplay() {
    if (remaining > 0 || (remaining === 0 && overtimeSeconds === 0)) {
      timeDisplay.textContent = formatTime(remaining);
    } else {
      timeDisplay.textContent = `+ ${formatTime(overtimeSeconds)}`;
    }
  }

  function getInputSeconds() {
    const h = parseInt(hoursInput.value, 10) || 0;
    const m = parseInt(minutesInput.value, 10) || 0;
    const s = parseInt(secondsInput.value, 10) || 0;
    return h * 3600 + m * 60 + s;
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isRunning = false;
    updatePauseIcon();
  }

  function stopSound() {
    alertActive = false;
    if (audioStopTimeout) {
      clearTimeout(audioStopTimeout);
      audioStopTimeout = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }

  function playAlarmLocally() {
    stopSound();

    const type = soundSelect.value;
    const src = audioMap[type] || audioMap.timer;
    const vol = currentVolume;

    alertActive = true;
    const startedAt = Date.now();

    function playCycle() {
      if (!alertActive) return;

      currentAudio = new Audio(src);
      currentAudio.volume = vol;
      currentAudio.currentTime = 0;

      currentAudio.onended = () => {
        const elapsed = Date.now() - startedAt;
        if (alertActive && elapsed < 15000) {
          playCycle();
        } else {
          stopSound();
        }
      };

      currentAudio.play().catch(() => {
        console.warn('Audio autoplay blocked.');
      });
    }

    playCycle();

    audioStopTimeout = setTimeout(() => {
      stopSound();
    }, 15000);
  }

  function updatePauseIcon() {
    pauseBtn.textContent = isRunning ? '⏸' : '▶';
  }

  function startTimer() {
    stopTimer();
    clearBlink();

    timeDisplay.classList.remove('pulse-pause');
    if (remaining === 0 && overtimeSeconds > 0) {
      timeDisplay.classList.add('overtime-active');
    } else {
      timeDisplay.classList.remove('overtime-active');
    }

    timer = setInterval(() => {
      // Increment totalWorkSeconds every second
      totalWorkSeconds += 1;
      saveStats();
      updateDashboard();

      if (remaining > 0) {
        remaining -= 1;
        updateDisplay();

        if (remaining === 0) {
          playAlarmLocally();
          timeDisplay.classList.add('overtime-active');

          let count = 0;
          blinkTimer = setInterval(() => {
            timeDisplay.classList.toggle('blink');
            count++;
            if (count >= 8) {
              clearBlink();
            }
          }, 350);
        }
      } else {
        // Overtime mode: remaining is 0, count upward!
        overtimeSeconds += 1;
        updateDisplay();
      }
    }, 1000);

    isRunning = true;
    updatePauseIcon();
  }

  async function openPiPWindow() {
    if (!('documentPictureInPicture' in window)) {
      console.warn('Document PiP not supported.');
      return false;
    }

    if (pipWindowRef) return true;

    try {
      pipWindowRef = await window.documentPictureInPicture.requestWindow({
        width: 140,
        height: 120
      });

      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((r) => r.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pipWindowRef.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          pipWindowRef.document.head.appendChild(link);
        }
      });

      pipWindowRef.document.body.classList.add('popup-mode');
      if (document.body.classList.contains('light-mode')) {
        pipWindowRef.document.body.classList.add('light-mode');
      } else {
        pipWindowRef.document.body.style.backgroundColor = '#101216';
      }

      popup.classList.remove('hidden');
      pipWindowRef.document.body.append(popup);

      pipWindowRef.addEventListener('pagehide', () => {
        stopSound(); 
        stopTimer(); // PiP Safety Sync: prevent "Phantom UT" leak!
        document.body.append(popup);
        popup.classList.add('hidden');
        pipWindowRef = null;
      });

      return true;
    } catch (err) {
      console.error('PiP failed:', err);
      return false;
    }
  }

  // Event wiring (same logic, just using scoped elements)
  startBtn.onclick = async () => {
    totalSeconds = getInputSeconds();
    if (totalSeconds <= 0) return;

    remaining = totalSeconds;
    overtimeSeconds = 0; // Reset overtime!

    await openPiPWindow();

    updateDisplay();
    startTimer();

    // Arm the revert button for this new session
    sessionActive = true;
    if (revertBtn) revertBtn.disabled = false;
  };

  // --- Sound Preview Logic ---
  let previewTimeout = null;

  function playPreview() {
    // Stop any currently playing alarm or previous preview
    stopSound(); 
    if (previewTimeout) clearTimeout(previewTimeout);

    // Get the selected sound and current volume
    const type = soundSelect.value;
    const src = audioMap[type] || audioMap.timer;
    
    // Create and play the audio snippet
    currentAudio = new Audio(src);
    currentAudio.volume = currentVolume;
    
    currentAudio.play().catch(err => {
      console.warn('Audio preview blocked by browser.', err);
    });

    // Automatically stop the preview after 3 seconds
    previewTimeout = setTimeout(() => {
      stopSound();
    }, 3000);
  }

  previewBtn.onclick = playPreview;
  if (volumeTestBtn) {
    volumeTestBtn.onclick = playPreview;
  }

  pauseBtn.onclick = () => {
    stopSound();
    if (isRunning) {
      stopTimer();
      timeDisplay.classList.add('pulse-pause');
    } else if (remaining > 0 || (remaining === 0 && overtimeSeconds > 0)) {
      startTimer();
    }
    updatePauseIcon();
  };

  restartBtn.onclick = () => {
    stopSound();
    if (totalSeconds <= 0) return;

    // 3-Second Minimum Task Duration Guard:
    // Elapsed = seconds consumed from the set duration + any overtime accumulated.
    // This correctly handles both mid-countdown restarts and post-alarm restarts.
    const elapsedSeconds = (totalSeconds - remaining) + overtimeSeconds;

    if (elapsedSeconds >= 3) {
      // Valid task: increment count and log it.
      taskCount += 1;

      recentTasks.unshift({
        taskNum: taskCount,
        original: totalSeconds,
        overtime: overtimeSeconds,
        timestamp: Date.now()
      });
      recentTasks = recentTasks.slice(0, 10);
      localStorage.setItem('recentTasks', JSON.stringify(recentTasks));

      saveStats();
      updateDashboard();
    }
    // If elapsedSeconds < 3: silently discard the task count increment.
    // Note: totalWorkSeconds is already updated live inside setInterval,
    // so those 1-2 seconds are preserved in the UT% automatically.

    stopTimer();
    clearBlink();
    remaining = totalSeconds;
    overtimeSeconds = 0; // Reset overtime!
    updateDisplay();
    startTimer();

    // Re-arm the revert button for the new session
    sessionActive = true;
    if (revertBtn) revertBtn.disabled = false;
  };

  closePopupBtn.onclick = () => {
    stopSound();
    stopTimer();
    clearBlink();

    // Disarm revert — session is being deliberately closed
    sessionActive = false;
    if (revertBtn) revertBtn.disabled = true;

    if (pipWindowRef) {
      pipWindowRef.close();
    } else {
      popup.classList.add('hidden');
    }
  };

  // --- Revert Current Session ---
  if (revertBtn) {
    revertBtn.onclick = () => {
      if (!sessionActive) return;

      // Calculate how many seconds this session has contributed
      const sessionTime = (totalSeconds - remaining) + overtimeSeconds;

      // Subtract only this session's time from the global tracker
      totalWorkSeconds = Math.max(0, totalWorkSeconds - sessionTime);

      // Stop everything and reset to the current preset
      stopSound();
      stopTimer();
      clearBlink();
      remaining = totalSeconds;
      overtimeSeconds = 0;
      updateDisplay();

      // Persist and refresh the dashboard instantly
      glowTriggered = totalWorkSeconds >= 25500;
      saveStats();
      updateDashboard();

      // Disarm — no double-undo
      sessionActive = false;
      revertBtn.disabled = true;

      // Close PiP if open
      if (pipWindowRef) {
        pipWindowRef.close();
      } else {
        popup.classList.add('hidden');
      }
    };
  }

  popup.addEventListener('mousedown', () => {
    stopSound();
  });

  // Presets inside this root
  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = parseInt(btn.getAttribute('data-preset'), 10);
      hoursInput.value = Math.floor(sec / 3600);
      minutesInput.value = Math.floor((sec % 3600) / 60);
      secondsInput.value = sec % 60;
    });
  });

  // Volume handling
  currentVolume = parseFloat(volumeControl.value);
  volumeControl.addEventListener('input', () => {
    currentVolume = parseFloat(volumeControl.value);
    if (currentAudio) {
      currentAudio.volume = currentVolume;
    }
  });

  // Reset Daily Stats button integration
  if (resetStatsBtn) {
    resetStatsBtn.onclick = () => {
      if (window.confirm("Are you sure you want to reset all daily utilization stats? This will clear your task count, total work time, and recent tasks.")) {
        totalWorkSeconds = 0;
        taskCount = 0;
        recentTasks = [];
        localStorage.removeItem('recentTasks');
        glowTriggered = false;
        saveStats();
        updateDashboard();
      }
    };
  }

  // Initial state
  updateDisplay();
  updatePauseIcon();
  updateDashboard();
}