// pomodoro-module.js
export function initPomodoro(root) {
  const TIMES = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  let currentMode = 'pomodoro';
  let timeLeft = TIMES.pomodoro;
  let timerInterval = null;
  let isRunning = false;
  let pipWindowRef = null;
  let currentAudio = null;

  // Task management
  let tasks = [];
  let currentTaskIndex = 0;
  let totalCompletedPomos = 0;
  let editingTaskIndex = null;

  const audioMap = {
    soft2: 'sounds/soft2.mp3',
    alarm: 'sounds/alarm.wav',
    'timer-off': 'sounds/timer-off.wav',
    loud: 'sounds/loud.mp3',
    timer: 'sounds/timer-beep.mp3',
    normal: 'sounds/normal.mp3',
    soft1: 'sounds/soft1.mp3'
  };

  // DOM elements (namespaced)
  const mainTimeDisplay = root.querySelector('#pomo-mainTimeDisplay');
  const pipTimeDisplay = document.getElementById('pomo-timeDisplay');

  const startStopBtn = root.querySelector('#pomo-startStopBtn');
  const popOutBtn = root.querySelector('#pomo-popOutBtn');
  const pipStartStopBtn = document.getElementById('pomo-pipStartStopBtn');
  const pipSkipBtn = document.getElementById('pomo-pipSkipBtn');
  const closePopupBtn = document.getElementById('pomo-closePopup');
  const popup = document.getElementById('pomo-popup');

  const btnPomo = root.querySelector('#pomo-btnPomo');
  const btnShort = root.querySelector('#pomo-btnShort');
  const btnLong = root.querySelector('#pomo-btnLong');

  const taskList = root.querySelector('#pomo-taskList');
  const showTaskFormBtn = root.querySelector('#pomo-showTaskFormBtn');
  const taskForm = root.querySelector('#pomo-taskForm');
  const cancelTaskBtn = root.querySelector('#pomo-cancelTaskBtn');
  const saveTaskBtn = root.querySelector('#pomo-saveTaskBtn');
  const taskNameInput = root.querySelector('#pomo-taskNameInput');
  const taskPomosInput = root.querySelector('#pomo-taskPomosInput');

  const pomoCountDisplay = root.querySelector('#pomo-pomoCountDisplay');
  const finishTimeDisplay = root.querySelector('#pomo-finishTimeDisplay');
  const advancedToggleBtn = root.querySelector('#pomo-advancedToggleBtn');
  const advancedIcon = root.querySelector('#pomo-advancedIcon');
  const advancedSettings = root.querySelector('#pomo-advancedSettings');
  const soundSelect = root.querySelector('#pomo-soundSelect');
  const volumeControl = root.querySelector('#pomo-volumeControl');

  let currentVolume = parseFloat(volumeControl.value);

  volumeControl.addEventListener('input', () => {
    currentVolume = parseFloat(volumeControl.value);
  });

  advancedToggleBtn.onclick = () => {
    if (advancedSettings.style.display === 'none' || advancedSettings.style.display === '') {
      advancedSettings.style.display = 'block';
      advancedIcon.style.transform = 'rotate(90deg)';
    } else {
      advancedSettings.style.display = 'none';
      advancedIcon.style.transform = 'rotate(0deg)';
    }
  };

  function stopSound() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }

  function playPhaseCompleteAlarm() {
    stopSound(); // Kills any overlapping sounds
    const type = soundSelect.value;
    const src = audioMap[type] || audioMap.soft2;
    currentAudio = new Audio(src);
    currentAudio.volume = currentVolume;
    currentAudio.play().catch(err => console.warn('Audio autoplay blocked by browser.', err));
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateDisplays() {
    const formatted = formatTime(timeLeft);
    mainTimeDisplay.textContent = formatted;
    if (pipTimeDisplay) pipTimeDisplay.textContent = formatted;
    document.title = `${formatted} - Pomodoro`;
  }

  function setMode(mode) {
    currentMode = mode;
    timeLeft = TIMES[mode];

    btnPomo.classList.remove('active');
    btnShort.classList.remove('active');
    btnLong.classList.remove('active');

    if (mode === 'pomodoro') btnPomo.classList.add('active');
    if (mode === 'shortBreak') btnShort.classList.add('active');
    if (mode === 'longBreak') btnLong.classList.add('active');

    if (isRunning) toggleTimer();
    updateDisplays();
    updateDashboard();
  }

  btnPomo.onclick = () => setMode('pomodoro');
  btnShort.onclick = () => setMode('shortBreak');
  btnLong.onclick = () => setMode('longBreak');

  function toggleTimer() {
    if (isRunning) {
      clearInterval(timerInterval);
      startStopBtn.textContent = 'Start';
      startStopBtn.style.background = 'var(--primary)';
      pipStartStopBtn.textContent = '▶';
    } else {
      timerInterval = setInterval(tick, 1000);
      startStopBtn.textContent = 'Pause';
      startStopBtn.style.background = '#ff4d4d';
      pipStartStopBtn.textContent = '⏸';
    }
    isRunning = !isRunning;
    updateDashboard();
  }

  function tick() {
    if (timeLeft > 0) {
      timeLeft--;
      updateDisplays();
    } else {
      playPhaseCompleteAlarm();
      handlePhaseComplete();
    }
  }

  function handlePhaseComplete() {
    if (currentMode === 'pomodoro') {
      totalCompletedPomos++;

      // 1. Update Task Progress (independent of breaks)
      if (tasks.length > 0 && currentTaskIndex < tasks.length) {
        tasks[currentTaskIndex].completed++;
        // Auto-advance to the next task if this one is finished
        if (tasks[currentTaskIndex].completed >= tasks[currentTaskIndex].target) {
          currentTaskIndex++;
        }
      }

      // 2. The True Pomodoro Logic: Every 4th work session triggers a long break
      if (totalCompletedPomos > 0 && totalCompletedPomos % 4 === 0) {
        setMode('longBreak');
      } else {
        setMode('shortBreak');
      }
    } else {
      // Break is over, back to work
      setMode('pomodoro');
    }
    renderTasks();
  }

  pipSkipBtn.onclick = () => {
    if (isRunning) toggleTimer();
    handlePhaseComplete();
  };

  startStopBtn.onclick = toggleTimer;
  pipStartStopBtn.onclick = toggleTimer;

  // ----- Task Management -----
  showTaskFormBtn.onclick = () => {
    editingTaskIndex = null;
    taskNameInput.value = '';
    taskPomosInput.value = 1;
    showTaskFormBtn.style.display = 'none';
    taskForm.style.display = 'block';
    taskNameInput.focus();
  };

  cancelTaskBtn.onclick = () => {
    editingTaskIndex = null;
    taskForm.style.display = 'none';
    showTaskFormBtn.style.display = 'inline-flex';
  };

  saveTaskBtn.onclick = () => {
    const name = taskNameInput.value.trim();
    let target = parseInt(taskPomosInput.value);
    if (name && target > 0) {
      if (editingTaskIndex !== null) {
        if (target < tasks[editingTaskIndex].completed) {
          target = tasks[editingTaskIndex].completed;
        }
        tasks[editingTaskIndex].name = name;
        tasks[editingTaskIndex].target = target;
      } else {
        tasks.push({ name, target, completed: 0 });
      }
      cancelTaskBtn.click();
      renderTasks();
      updateDashboard();
    }
  };

  function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.className = `task-item ${index === currentTaskIndex ? 'active' : ''}`;
      li.style.padding = '12px 16px';
      li.style.borderRadius = '12px';
      li.style.marginBottom = '8px';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.background = 'var(--button-bg)';
      li.style.borderLeft = index === currentTaskIndex ? '4px solid var(--primary)' : '4px solid transparent';

      li.innerHTML = `
        <div class="task-info" style="display:flex; flex-direction:column; gap:4px;">
          <span class="task-name" style="font-weight:600;">${task.name}</span>
          <span class="task-pomos" style="color:var(--muted); font-size:13px; font-weight:bold;">
            ${task.completed}/${task.target} Pomodoros
          </span>
        </div>
        <div class="task-actions" style="display:flex; gap:8px;">
          <button class="edit-btn" data-index="${index}" style="
            background:transparent;
            border:1px solid var(--input-border);
            color:var(--muted);
            border-radius:6px;
            padding:4px 8px;
            font-size:12px;
            font-weight:600;
            cursor:pointer;
          ">
            Edit
          </button>
          <button class="delete-btn" data-index="${index}" style="
            background:transparent;
            border:1px solid var(--input-border);
            color:var(--muted);
            border-radius:6px;
            padding:4px 8px;
            font-size:12px;
            font-weight:600;
            cursor:pointer;
          ">
            Del
          </button>
        </div>
      `;
      taskList.appendChild(li);
    });

    root.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        editingTaskIndex = index;
        taskNameInput.value = tasks[index].name;
        taskPomosInput.value = tasks[index].target;
        showTaskFormBtn.style.display = 'none';
        taskForm.style.display = 'block';
        taskNameInput.focus();
      };
    });

    root.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        tasks.splice(index, 1);
        if (index <= currentTaskIndex && currentTaskIndex > 0) {
          currentTaskIndex--;
        }
        if (tasks.length === 0) currentTaskIndex = 0;
        renderTasks();
        updateDashboard();
      };
    });
  }

  function updateDashboard() {
    let totalTargetPomos = 0;
    tasks.forEach(t => { totalTargetPomos += t.target; });
    pomoCountDisplay.textContent = `${totalCompletedPomos}/${totalTargetPomos}`;

    // Calculate total uncompleted Pomodoros across all tasks
    let remainingPomos = 0;
    for (let i = currentTaskIndex; i < tasks.length; i++) {
      let uncompleted = tasks[i].target - tasks[i].completed;
      if (uncompleted > 0) remainingPomos += uncompleted;
    }

    if (remainingPomos === 0) {
      finishTimeDisplay.textContent = '--:--';
      return;
    }

    // Mathematical simulation of the true Pomodoro cycle
    let remainingSeconds = timeLeft;
    let pomosLeftToWork = remainingPomos;

    if (currentMode === 'pomodoro') {
      pomosLeftToWork -= 1; // The active timer covers 1 work session
      let virtualCount = totalCompletedPomos + 1;
      
      // Add the break that follows this current active session
      if (pomosLeftToWork > 0) {
        remainingSeconds += (virtualCount % 4 === 0) ? TIMES.longBreak : TIMES.shortBreak;
      }
      
      // Simulate the rest of the queue
      for (let i = 0; i < pomosLeftToWork; i++) {
        remainingSeconds += TIMES.pomodoro;
        virtualCount++;
        // Add trailing breaks unless it's the absolute last task
        if (i < pomosLeftToWork - 1) {
          remainingSeconds += (virtualCount % 4 === 0) ? TIMES.longBreak : TIMES.shortBreak;
        }
      }
    } else {
      // If currently on a break, all remaining pomodoros are strictly in the future
      let virtualCount = totalCompletedPomos;
      for (let i = 0; i < pomosLeftToWork; i++) {
        remainingSeconds += TIMES.pomodoro;
        virtualCount++;
        // Add trailing breaks unless it's the absolute last task
        if (i < pomosLeftToWork - 1) {
          remainingSeconds += (virtualCount % 4 === 0) ? TIMES.longBreak : TIMES.shortBreak;
        }
      }
    }

    const finishDate = new Date(Date.now() + remainingSeconds * 1000);
    let hours = finishDate.getHours();
    const minutes = String(finishDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    finishTimeDisplay.textContent = `${hours}:${minutes} ${ampm}`;
  }

  // ----- PiP logic -----
  popOutBtn.onclick = async () => {
    if (!('documentPictureInPicture' in window)) {
      alert('Your browser does not support PiP.');
      return;
    }
    if (pipWindowRef) return;

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
        document.body.append(popup);
        popup.classList.add('hidden');
        pipWindowRef = null;
      });
    } catch (err) {
      console.error('PiP failed:', err);
    }
  };

  closePopupBtn.onclick = () => {
    stopSound();
    if (pipWindowRef) {
      pipWindowRef.close();
    } else {
      popup.classList.add('hidden');
    }
  };

  // Initialize
  setMode('pomodoro');
  renderTasks();
  updateDashboard();
  updateDisplays();
}