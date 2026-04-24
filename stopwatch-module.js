// stopwatch-module.js
export function initStopwatch(root) {
  let startTime = 0;
  let elapsedTime = 0;
  let timerInterval = null;
  let isRunning = false;
  let pipWindowRef = null;

  // DOM elements (namespaced IDs)
  const mainTimeDisplay = root.querySelector('#sw-mainTimeDisplay');
  const pipTimeDisplay = document.getElementById('sw-timeDisplay');
  const startStopBtn = root.querySelector('#sw-startStopBtn');
  const resetBtn = root.querySelector('#sw-resetBtn');
  const lapBtn = root.querySelector('#sw-lapBtn');
  const lapList = root.querySelector('#sw-lapList');
  const popOutBtn = root.querySelector('#sw-popOutBtn');

  const popup = document.getElementById('sw-popup');
  const pipStartStopBtn = document.getElementById('sw-pipStartStopBtn');
  const pipResetBtn = document.getElementById('sw-pipResetBtn');
  const closePopupBtn = document.getElementById('sw-closePopup');

  // Initial style for main display (like original)
  mainTimeDisplay.style.fontFamily = "'Share Tech Mono', monospace";
  mainTimeDisplay.style.fontSize = "clamp(30px, 6vw, 42px)";
  mainTimeDisplay.style.letterSpacing = "2px";
  mainTimeDisplay.style.margin = "12px 0 16px";
  mainTimeDisplay.style.textAlign = "center";
  mainTimeDisplay.style.fontWeight = "700";

  function formatTime(ms) {
    const date = new Date(ms);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateDisplays() {
    const formatted = formatTime(elapsedTime);
    mainTimeDisplay.textContent = formatted;
    if (pipTimeDisplay) pipTimeDisplay.textContent = formatted;
  }

  function toggleStopwatch() {
    if (isRunning) {
      clearInterval(timerInterval);
      startStopBtn.textContent = "Start";
      startStopBtn.style.background = "var(--primary)";
      pipStartStopBtn.textContent = "▶";
      lapBtn.disabled = true;
    } else {
      startTime = Date.now() - elapsedTime;
      timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        updateDisplays();
      }, 100);
      startStopBtn.textContent = "Stop";
      startStopBtn.style.background = "#ff4d4d";
      pipStartStopBtn.textContent = "⏸";
      lapBtn.disabled = false;
    }
    isRunning = !isRunning;
  }

  function resetStopwatch() {
    clearInterval(timerInterval);
    isRunning = false;
    elapsedTime = 0;
    updateDisplays();
    lapList.innerHTML = "";

    startStopBtn.textContent = "Start";
    startStopBtn.style.background = "var(--primary)";
    pipStartStopBtn.textContent = "▶";
    lapBtn.disabled = true;
  }

  // Button listeners
  startStopBtn.addEventListener("click", toggleStopwatch);
  pipStartStopBtn.addEventListener("click", toggleStopwatch);

  resetBtn.addEventListener("click", resetStopwatch);
  pipResetBtn.addEventListener("click", resetStopwatch);

  lapBtn.addEventListener("click", () => {
    if (isRunning) {
      const li = document.createElement("li");
      li.textContent = `Lap ${lapList.children.length + 1}: ${formatTime(elapsedTime)}`;
      li.style.padding = "5px 0";
      li.style.borderBottom = "1px solid var(--input-border)";
      lapList.prepend(li);
    }
  });

  // PiP logic (unchanged, just using namespaced elements)
  popOutBtn.onclick = async () => {
    if (!("documentPictureInPicture" in window)) {
      console.warn("Document PiP not supported.");
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

    } catch (err) {
      console.error("PiP failed:", err);
    }
  };

  closePopupBtn.onclick = () => {
    if (pipWindowRef) {
      pipWindowRef.close();
    } else {
      popup.classList.add("hidden");
    }
  };

  // Initial state
  resetStopwatch();
  updateDisplays();
}