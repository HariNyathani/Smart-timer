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

const popup = document.getElementById("popup");
const timeDisplay = document.getElementById("timeDisplay");
const themeToggle = document.getElementById("themeToggle");
const toggleCircle = document.getElementById("toggleCircle");
const soundSelect = document.getElementById("soundSelect");
const volumeControl = document.getElementById("volumeControl");
const pauseBtn = document.getElementById("pauseBtn");
const startBtn = document.getElementById("startBtn");

const audioMap = {
  loud: "sounds/loud.mp3",
  timer: "sounds/timer-beep.mp3",
  normal: "sounds/normal.mp3",
  soft1: "sounds/soft1.mp3",
  soft2: "sounds/soft2.mp3"
};

function pad(num) {
  return String(num).padStart(2, "0");
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function clearBlink() {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
  timeDisplay.classList.remove("blink");
}

function updateDisplay() {
  timeDisplay.textContent = formatTime(remaining);
}

function getInputSeconds() {
  const h = parseInt(document.getElementById("hours").value, 10) || 0;
  const m = parseInt(document.getElementById("minutes").value, 10) || 0;
  const s = parseInt(document.getElementById("seconds").value, 10) || 0;
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
        console.warn("Audio autoplay blocked.");
    });
  }

  playCycle();

  audioStopTimeout = setTimeout(() => {
    stopSound();
  }, 15000);
}

function updatePauseIcon() {
  pauseBtn.textContent = isRunning ? "⏸" : "▶";
}

function startTimer() {
  stopTimer();
  clearBlink();

  timeDisplay.classList.remove("pulse-pause");

  timer = setInterval(() => {
    if (remaining <= 0) {
      stopTimer();
      playAlarmLocally();

      let count = 0;
      blinkTimer = setInterval(() => {
        timeDisplay.classList.toggle("blink");
        count++;
        if (count >= 8) {
          clearBlink();
        }
      }, 350);

      return;
    }

    remaining -= 1;
    updateDisplay();
  }, 1000);

  isRunning = true;
  updatePauseIcon();
}

async function openPiPWindow() {
  if (!("documentPictureInPicture" in window)) {
    console.warn("Document PiP not supported.");
    return false;
  }

  if (pipWindowRef) return true;

  try {
    // Increased window size for a more spacious feel
    pipWindowRef = await window.documentPictureInPicture.requestWindow({
      width: 180,
      height: 120
    });

    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules].map((r) => r.cssText).join("");
        const style = document.createElement("style");
        style.textContent = cssRules;
        pipWindowRef.document.head.appendChild(style);
      } catch (e) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = styleSheet.href;
        pipWindowRef.document.head.appendChild(link);
      }
    });

    pipWindowRef.document.body.classList.add("popup-mode");
    if (document.body.classList.contains("light-mode")) {
      pipWindowRef.document.body.classList.add("light-mode");
    } else {
      pipWindowRef.document.body.style.backgroundColor = "#101216"; 
    }

    popup.classList.remove("hidden");
    pipWindowRef.document.body.append(popup);

    pipWindowRef.addEventListener("pagehide", () => {
      document.body.append(popup);
      popup.classList.add("hidden");
      pipWindowRef = null;
    });

    return true;
  } catch (err) {
    console.error("PiP failed:", err);
    return false;
  }
}

startBtn.onclick = async () => {
  totalSeconds = getInputSeconds();
  if (totalSeconds <= 0) return;

  remaining = totalSeconds;
  
  await openPiPWindow();

  updateDisplay();
  startTimer();
};

pauseBtn.onclick = () => {
  stopSound();
  if (isRunning) {
    stopTimer();
    timeDisplay.classList.add("pulse-pause");
  } else if (remaining > 0) {
    startTimer();
  }
  updatePauseIcon();
};

document.getElementById("restartBtn").onclick = () => {
  stopSound();
  if (totalSeconds <= 0) return;

  stopTimer();
  clearBlink();
  remaining = totalSeconds;
  updateDisplay();
  startTimer();
};

document.getElementById("closePopup").onclick = () => {
  stopSound();
  stopTimer();
  clearBlink();
  
  if (pipWindowRef) {
    pipWindowRef.close();
  } else {
    popup.classList.add("hidden");
  }
};

popup.addEventListener("mousedown", () => {
  stopSound();
});

function setPreset(sec) {
  document.getElementById("hours").value = Math.floor(sec / 3600);
  document.getElementById("minutes").value = Math.floor((sec % 3600) / 60);
  document.getElementById("seconds").value = sec % 60;
}
window.setPreset = setPreset;

currentVolume = parseFloat(volumeControl.value);
volumeControl.addEventListener("input", () => {
  currentVolume = parseFloat(volumeControl.value);
  if (currentAudio) {
    currentAudio.volume = currentVolume;
  }
});

function updateThemeIcon() {
  toggleCircle.textContent = document.body.classList.contains("light-mode") ? "☀" : "🌙";
}

themeToggle.onclick = () => {
  document.body.classList.toggle("light-mode");
  updateThemeIcon();
};

updateThemeIcon();
updatePauseIcon();