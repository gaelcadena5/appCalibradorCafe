// BrewFlow Coffee Pouring Calibrator Script
document.addEventListener("DOMContentLoaded", () => {
    // --- Login Security Layer ---
    const CORRECT_USER = 'barista';
    const CORRECT_PASS_HASH = '3102859ebaa2353c02b91c7783b32ef43820318a7d547e049ae2356d2728ab2b'; // SHA-256 hash of "cafe123"

    const loginOverlay = document.getElementById("login-overlay");
    const loginForm = document.getElementById("login-form");
    const loginUser = document.getElementById("login-username");
    const loginPass = document.getElementById("login-password");
    const loginError = document.getElementById("login-error-msg");
    const appContainer = document.getElementById("app-container");

    async function getSHA256Hash(string) {
        const utf8 = new TextEncoder().encode(string);
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(bytes => bytes.toString(16).padStart(2, '0')).join('');
    }

    const checkSession = () => {
        const session = localStorage.getItem("brewflow_session");
        if (session === "authorized") {
            if (loginOverlay) loginOverlay.classList.add("hidden");
            if (appContainer) appContainer.classList.remove("hidden");
        }
    };

    // Check if user is already authenticated
    checkSession();

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = loginUser.value.trim();
            const password = loginPass.value;

            const passHash = await getSHA256Hash(password);

            if (username === CORRECT_USER && passHash === CORRECT_PASS_HASH) {
                localStorage.setItem("brewflow_session", "authorized");
                if (loginOverlay) loginOverlay.classList.add("hidden");
                if (appContainer) appContainer.classList.remove("hidden");
                // Resume audio context
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
            } else {
                // Shake card on error
                const card = document.querySelector(".login-card");
                if (card) {
                    card.classList.remove("shake");
                    void card.offsetWidth; // Trigger reflow
                    card.classList.add("shake");
                }

                if (loginError) loginError.classList.remove("hidden");
                loginPass.value = "";
            }
        });
    }

    // --- State Definition ---
    const state = {
        dosis: 15,
        ratio: 15,
        totalLiquid: 225,
        cantVertidos: 5,
        bloomEnabled: true,
        pours: [], // Array of { value: float, locked: boolean }
        
        // Timer State
        timer: {
            intervalId: null,
            isPlaying: false,
            timePour: 30, // seconds
            timeWait: 15, // seconds
            currentPourIndex: 0,
            phase: 'idle', // 'pour', 'wait', 'completed', 'idle'
            secondsRemaining: 0,
            totalElapsed: 0
        }
    };

    // --- DOM Elements ---
    const inputDosis = document.getElementById("input-dosis");
    const inputRatio = document.getElementById("input-ratio");
    const inputVertidos = document.getElementById("input-vertidos");
    const checkboxBloom = document.getElementById("checkbox-bloom");
    const btnResetPours = document.getElementById("btn-reset-pours");
    
    const labelTotalWaterHeader = document.getElementById("header-total-liquid");
    const labelTotalWaterResult = document.getElementById("result-total-water");
    
    const poursContainer = document.getElementById("pours-container");
    const poursStatusBadge = document.getElementById("pours-status-badge");
    
    const sumProgressBar = document.getElementById("sum-progress-bar");
    const currentSumVal = document.getElementById("current-sum-val");
    const targetSumVal = document.getElementById("target-sum-val");
    const errorMessage = document.getElementById("error-message");
    
    // Timer DOM
    const timerClock = document.getElementById("timer-clock");
    const timerStatus = document.getElementById("timer-status");
    const timerProgressRing = document.getElementById("timer-progress-ring");
    const timerActiveStep = document.getElementById("timer-active-step");
    const stepBadgeNum = document.getElementById("step-badge-num");
    const stepTargetWeight = document.getElementById("step-target-weight");
    const stepInstruction = document.getElementById("step-instruction");
    
    const btnTimerStart = document.getElementById("btn-timer-start");
    const btnTimerPause = document.getElementById("btn-timer-pause");
    const btnTimerReset = document.getElementById("btn-timer-reset");
    
    const timePourInput = document.getElementById("time-pour");
    const timeWaitInput = document.getElementById("time-wait");

    // Web Audio Context for synthesized sound alerts
    let audioCtx = null;

    // --- Sound Helper ---
    function playBeep(frequency, duration, type = 'sine') {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            // Smooth release to prevent clicks
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.warn("Audio Context not allowed or failed to initialize", e);
        }
    }

    function playStartBeeps() {
        // 3 quick high-pitched beeps
        playBeep(880, 0.1);
        setTimeout(() => playBeep(880, 0.1), 200);
        setTimeout(() => playBeep(1200, 0.2), 400);
    }

    function playWaitBeep() {
        // A single deeper warning beep
        playBeep(440, 0.4, 'triangle');
    }

    function playCompletionBeeps() {
        // Success melody
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => playBeep(freq, 0.3), i * 150);
        });
    }

    // --- Mathematical Logic ---

    // Initializes all pours to initial state
    function initializePours() {
        state.totalLiquid = state.dosis * state.ratio;
        state.pours = [];

        // Check if bloom is checked and there's more than 1 pour
        if (state.bloomEnabled && state.cantVertidos > 1) {
            // Bloom is usually 3 times the dose
            const bloomVal = Math.min(state.dosis * 3, state.totalLiquid);
            state.pours.push({ value: parseFloat(bloomVal.toFixed(1)), locked: true });

            const remainingWater = state.totalLiquid - bloomVal;
            const remainingPoursCount = state.cantVertidos - 1;
            const valPerPour = Math.max(0, remainingWater / remainingPoursCount);

            for (let i = 1; i < state.cantVertidos; i++) {
                state.pours.push({ value: parseFloat(valPerPour.toFixed(1)), locked: false });
            }
        } else {
            // Equal distribution
            const valPerPour = state.totalLiquid / state.cantVertidos;
            for (let i = 0; i < state.cantVertidos; i++) {
                state.pours.push({ value: parseFloat(valPerPour.toFixed(1)), locked: false });
            }
        }

        renderUI();
    }

    // Cascade adjustment algorithm
    function recalculatePours(editedIndex, newValue) {
        if (newValue < 0 || isNaN(newValue)) newValue = 0;
        
        state.pours[editedIndex].value = parseFloat(newValue.toFixed(1));
        
        // Lock all pours up to the edited one
        for (let i = 0; i <= editedIndex; i++) {
            state.pours[i].locked = true;
        }

        // Calculate sum of all locked pours
        let sumLocked = 0;
        for (let i = 0; i <= editedIndex; i++) {
            sumLocked += state.pours[i].value;
        }

        const remainingPours = state.cantVertidos - (editedIndex + 1);
        
        if (remainingPours > 0) {
            const remainingWater = state.totalLiquid - sumLocked;
            const valPerPour = Math.max(0, remainingWater / remainingPours);
            
            for (let i = editedIndex + 1; i < state.cantVertidos; i++) {
                state.pours[i].value = parseFloat(valPerPour.toFixed(1));
                state.pours[i].locked = false;
            }
        }

        renderUI();
    }

    // --- UI Render ---

    function renderUI() {
        // Update basic numeric labels
        labelTotalWaterHeader.textContent = state.totalLiquid.toFixed(1);
        labelTotalWaterResult.textContent = `${state.totalLiquid.toFixed(1)} ml`;
        targetSumVal.textContent = state.totalLiquid.toFixed(1);

        // Sum pours to verify match
        const actualSum = state.pours.reduce((acc, p) => acc + p.value, 0);
        currentSumVal.textContent = actualSum.toFixed(1);

        // Update progress bar
        const percent = Math.min(100, (actualSum / state.totalLiquid) * 100);
        sumProgressBar.style.width = `${percent}%`;

        // Check if there is an error in total sum
        if (Math.abs(actualSum - state.totalLiquid) > 0.5) {
            sumProgressBar.classList.add("exceeded");
            poursStatusBadge.textContent = "Desequilibrado";
            poursStatusBadge.className = "badge warning";
            if (actualSum > state.totalLiquid) {
                errorMessage.classList.remove("hidden");
            } else {
                errorMessage.classList.add("hidden");
            }
        } else {
            sumProgressBar.classList.remove("exceeded");
            poursStatusBadge.textContent = "Equilibrado";
            poursStatusBadge.className = "badge";
            errorMessage.classList.add("hidden");
        }

        // Clear and rebuild pours HTML
        poursContainer.innerHTML = "";
        state.pours.forEach((pour, idx) => {
            const isBloom = idx === 0 && state.bloomEnabled;
            const itemDiv = document.createElement("div");
            itemDiv.className = `pour-item ${pour.locked ? 'locked' : ''}`;
            
            const pct = state.totalLiquid > 0 ? (pour.value / state.totalLiquid) * 100 : 0;

            itemDiv.innerHTML = `
                <div class="pour-header">
                    <span class="pour-title">
                        ${isBloom ? '🌱 ' : ''}Vertido ${idx + 1}
                    </span>
                    <span class="pour-badge">
                        ${pour.locked ? 'Manual/Fijado' : 'Automático'}
                    </span>
                </div>
                <div class="pour-controls">
                    <input type="range" class="pour-slider" min="0" max="${Math.ceil(state.totalLiquid)}" step="0.5" value="${pour.value}">
                    <input type="number" class="pour-val-input" min="0" max="${Math.ceil(state.totalLiquid)}" step="0.1" value="${pour.value}">
                </div>
                <div class="pour-percentage-bar">
                    <div class="pour-percentage-fill" style="width: ${pct}%"></div>
                </div>
            `;

            // Event Listeners for inputs
            const slider = itemDiv.querySelector(".pour-slider");
            const numInput = itemDiv.querySelector(".pour-val-input");

            const updateValue = (val) => {
                recalculatePours(idx, val);
            };

            slider.addEventListener("input", (e) => {
                updateValue(parseFloat(e.target.value));
            });

            numInput.addEventListener("change", (e) => {
                updateValue(parseFloat(e.target.value));
            });

            poursContainer.appendChild(itemDiv);
        });

        // Update timer helper active step description if running
        updateTimerStepCard();
    }

    // --- Timer Controller ---

    function updateTimerProgress(percentage) {
        const circle = timerProgressRing;
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        
        // Calculate offset (90deg rotation is handled in CSS)
        const offset = circumference - (percentage / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    function formatTime(secs) {
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
    }

    function updateTimerStepCard() {
        if (state.timer.phase === 'idle' || state.timer.phase === 'completed') {
            timerActiveStep.classList.add("hidden");
            return;
        }

        timerActiveStep.classList.remove("hidden");
        const currIdx = state.timer.currentPourIndex;
        const isBloom = currIdx === 0 && state.bloomEnabled;
        const currentPourVal = state.pours[currIdx] ? state.pours[currIdx].value : 0;
        
        stepBadgeNum.textContent = `Vertido ${currIdx + 1} / ${state.cantVertidos}`;
        
        if (state.timer.phase === 'pour') {
            stepTargetWeight.textContent = `Vierta: ${currentPourVal.toFixed(1)} ml`;
            stepInstruction.innerHTML = isBloom 
                ? "<strong>Fase de Preinfusión (Bloom).</strong> Vierta suavemente humedeciendo todo el café y deje reposar."
                : "Vierta el agua en espiral lenta desde el centro hacia afuera, evitando tocar el filtro de papel.";
            timerStatus.textContent = "Vertiendo";
            timerProgressRing.style.stroke = "var(--c-primary)";
        } else if (state.timer.phase === 'wait') {
            stepTargetWeight.textContent = "Deje filtrar...";
            stepInstruction.textContent = "Espere a que el agua se filtre completamente a través de la cama de café antes del siguiente vertido.";
            timerStatus.textContent = "Esperando";
            timerProgressRing.style.stroke = "var(--c-gold)";
        }
    }

    function tick() {
        if (!state.timer.isPlaying) return;

        state.timer.secondsRemaining--;
        state.timer.totalElapsed++;
        
        timerClock.textContent = formatTime(state.timer.secondsRemaining);

        // Calculate percentage for progress circle
        const totalDuration = state.timer.phase === 'pour' ? state.timer.timePour : state.timer.timeWait;
        const progressPct = ((totalDuration - state.timer.secondsRemaining) / totalDuration) * 100;
        updateTimerProgress(progressPct);

        if (state.timer.secondsRemaining <= 0) {
            // Phase transition
            if (state.timer.phase === 'pour') {
                // Pouring complete, go to wait phase unless there is no wait time configured
                if (state.timer.timeWait > 0) {
                    state.timer.phase = 'wait';
                    state.timer.secondsRemaining = state.timer.timeWait;
                    playWaitBeep();
                } else {
                    goToNextPour();
                }
            } else if (state.timer.phase === 'wait') {
                // Wait phase complete, move to next pour
                goToNextPour();
            }
            updateTimerStepCard();
        }
    }

    function goToNextPour() {
        state.timer.currentPourIndex++;
        
        if (state.timer.currentPourIndex < state.cantVertidos) {
            // Setup next pour
            state.timer.phase = 'pour';
            state.timer.secondsRemaining = state.timer.timePour;
            playStartBeeps();
        } else {
            // Completed!
            state.timer.isPlaying = false;
            clearInterval(state.timer.intervalId);
            state.timer.phase = 'completed';
            timerStatus.textContent = "¡Listo!";
            timerClock.textContent = "00:00";
            updateTimerProgress(100);
            playCompletionBeeps();
            
            btnTimerStart.classList.remove("hidden");
            btnTimerPause.classList.add("hidden");
        }
    }

    function startTimer() {
        // Resume AudioContext on user interaction
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        state.timer.timePour = parseInt(timePourInput.value) || 30;
        state.timer.timeWait = parseInt(timeWaitInput.value) || 15;

        if (state.timer.phase === 'idle') {
            // Initializing timer
            state.timer.currentPourIndex = 0;
            state.timer.phase = 'pour';
            state.timer.secondsRemaining = state.timer.timePour;
            state.timer.totalElapsed = 0;
            playStartBeeps();
        }

        state.timer.isPlaying = true;
        btnTimerStart.classList.add("hidden");
        btnTimerPause.classList.remove("hidden");

        updateTimerStepCard();
        timerClock.textContent = formatTime(state.timer.secondsRemaining);

        clearInterval(state.timer.intervalId);
        state.timer.intervalId = setInterval(tick, 1000);
    }

    function pauseTimer() {
        state.timer.isPlaying = false;
        btnTimerStart.classList.remove("hidden");
        btnTimerPause.classList.add("hidden");
        timerStatus.textContent = "Pausado";
    }

    function resetTimer() {
        state.timer.isPlaying = false;
        clearInterval(state.timer.intervalId);
        state.timer.phase = 'idle';
        state.timer.currentPourIndex = 0;
        state.timer.secondsRemaining = 0;
        state.timer.totalElapsed = 0;
        
        timerClock.textContent = "00:00";
        timerStatus.textContent = "Listo";
        updateTimerProgress(0);
        updateTimerStepCard();

        btnTimerStart.classList.remove("hidden");
        btnTimerPause.classList.add("hidden");
    }

    // --- Basic Config Event Listeners ---

    const syncStateFromInputs = () => {
        state.dosis = Math.max(1, parseFloat(inputDosis.value) || 15);
        state.ratio = Math.max(1, parseFloat(inputRatio.value) || 15);
        state.cantVertidos = Math.max(1, parseInt(inputVertidos.value) || 5);
        state.bloomEnabled = checkboxBloom.checked;
        initializePours();
    };

    inputDosis.addEventListener("input", syncStateFromInputs);
    inputRatio.addEventListener("input", syncStateFromInputs);
    inputVertidos.addEventListener("input", syncStateFromInputs);
    checkboxBloom.addEventListener("change", syncStateFromInputs);

    btnResetPours.addEventListener("click", () => {
        initializePours();
    });

    // Timer buttons event listeners
    btnTimerStart.addEventListener("click", startTimer);
    btnTimerPause.addEventListener("click", pauseTimer);
    btnTimerReset.addEventListener("click", resetTimer);

    // --- App Init ---
    syncStateFromInputs();

    // --- Service Worker Registration for PWA ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
                .catch(err => console.error('Error al registrar el Service Worker:', err));
        });
    }
});
