// Constants
const STEP_LENGTH_M = 0.762; // meters per step
const STORAGE_KEY = 'walkToMordor';

// Global state
let state = {
    dailyEntries: [],
    journeyStartDate: null,
    lastSeenLandmarkDay: null, // tracks which landmark toast was last shown
    route: null,
    frodoDays: null,
    frodoDailyKm: [],
    panzoomInstance: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    loadStateFromStorage();
    await loadData();
    setupEventListeners();
    initializeZoom();
    updateUI();
    checkForLandmarkToast();
});

// Load route and Frodo data
async function loadData() {
    try {
        const [routeResponse, frodoDaysResponse] = await Promise.all([
            fetch('data/route.json'),
            fetch('data/frodo_days.json')
        ]);

        state.route = await routeResponse.json();
        state.frodoDays = await frodoDaysResponse.json();

        state.frodoDailyKm = buildFrodoDailyKm(state.frodoDays);

        updateFrodoDisplay();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading map data. Please ensure data files are present.');
    }
}

// Interpolate Frodo's cumulative km for every day 1–200
function buildFrodoDailyKm(landmarks) {
    const maxDay = landmarks[landmarks.length - 1].dayIndex;
    const daily = new Array(maxDay + 1);

    for (let day = 1; day <= maxDay; day++) {
        let before = landmarks[0];
        let after = landmarks[landmarks.length - 1];

        for (let i = 0; i < landmarks.length - 1; i++) {
            if (day >= landmarks[i].dayIndex && day <= landmarks[i + 1].dayIndex) {
                before = landmarks[i];
                after = landmarks[i + 1];
                break;
            }
        }

        if (day <= before.dayIndex) {
            daily[day] = before.frodoCumulativeKm;
        } else if (day >= after.dayIndex) {
            daily[day] = after.frodoCumulativeKm;
        } else {
            const span = after.dayIndex - before.dayIndex;
            const t = (day - before.dayIndex) / span;
            daily[day] = before.frodoCumulativeKm + t * (after.frodoCumulativeKm - before.frodoCumulativeKm);
        }
    }

    return daily;
}

// Get current Frodo day based on journey start date
function getCurrentFrodoDay() {
    if (!state.journeyStartDate) return null;

    const start = new Date(state.journeyStartDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const dayIndex = diffDays + 1;

    return Math.max(1, Math.min(dayIndex, 200));
}

// Get the nearest landmark label for a given day
function getLandmarkForDay(dayIndex) {
    if (!state.frodoDays) return '';

    let landmark = state.frodoDays[0];
    for (const lm of state.frodoDays) {
        if (lm.dayIndex <= dayIndex) {
            landmark = lm;
        } else {
            break;
        }
    }

    let next = null;
    for (const lm of state.frodoDays) {
        if (lm.dayIndex > dayIndex) {
            next = lm;
            break;
        }
    }

    if (landmark.dayIndex === dayIndex) {
        return landmark.label;
    } else if (next) {
        const daysUntil = next.dayIndex - dayIndex;
        return `${landmark.label} → ${next.label} (${daysUntil} day${daysUntil !== 1 ? 's' : ''} away)`;
    } else {
        return landmark.label;
    }
}

// Get the exact landmark if today IS a landmark day
function getExactLandmark(dayIndex) {
    if (!state.frodoDays) return null;
    return state.frodoDays.find(lm => lm.dayIndex === dayIndex) || null;
}

// Check if we should show a landmark toast
function checkForLandmarkToast() {
    const frodoDay = getCurrentFrodoDay();
    if (!frodoDay) return;

    const landmark = getExactLandmark(frodoDay);
    if (!landmark || !landmark.quote) return;

    // Only show if we haven't already shown this landmark
    if (state.lastSeenLandmarkDay === landmark.dayIndex) return;

    state.lastSeenLandmarkDay = landmark.dayIndex;
    saveStateToStorage();

    // Small delay so the page renders first
    setTimeout(() => {
        showLandmarkToast(landmark);
    }, 500);
}

// Show landmark toast notification
function showLandmarkToast(landmark) {
    // Remove any existing toast
    const existing = document.getElementById('landmarkToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'landmarkToast';
    toast.className = 'landmark-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title">Frodo has reached ${landmark.label}</div>
            <div class="toast-quote">"${landmark.quote}"</div>
            <div class="toast-day">Day ${landmark.dayIndex} of 200</div>
        </div>
        <button class="toast-close" onclick="dismissToast()">✕</button>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });
}

function dismissToast() {
    const toast = document.getElementById('landmarkToast');
    if (!toast) return;

    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');

    setTimeout(() => {
        toast.remove();
    }, 400);
}

// Save state to localStorage
function saveStateToStorage() {
    const toSave = {
        dailyEntries: state.dailyEntries,
        journeyStartDate: state.journeyStartDate,
        lastSeenLandmarkDay: state.lastSeenLandmarkDay
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// Load state from localStorage
function loadStateFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.dailyEntries = parsed.dailyEntries || [];
            state.journeyStartDate = parsed.journeyStartDate || null;
            state.lastSeenLandmarkDay = parsed.lastSeenLandmarkDay || null;
        } catch (error) {
            console.error('Error parsing saved data:', error);
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    const entryForm = document.getElementById('entryForm');
    if (entryForm) entryForm.addEventListener('submit', handleFormSubmit);

    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearForm);

    const mapWrapper = document.getElementById('mapWrapper');
    if (mapWrapper) mapWrapper.addEventListener('dragstart', (e) => e.preventDefault());

    const startDateBtn = document.getElementById('startDateBtn');
    if (startDateBtn) startDateBtn.addEventListener('click', openStartDateModal);

    const saveStartDate = document.getElementById('saveStartDate');
    if (saveStartDate) saveStartDate.addEventListener('click', handleSaveStartDate);

    const cancelStartDate = document.getElementById('cancelStartDate');
    if (cancelStartDate) cancelStartDate.addEventListener('click', closeStartDateModal);

    const modalOverlay = document.getElementById('startDateModal');
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeStartDateModal();
    });
}

// Start date modal
function openStartDateModal() {
    const input = document.getElementById('startDateInput');
    input.value = state.journeyStartDate || new Date().toISOString().split('T')[0];
    document.getElementById('startDateModal').hidden = false;
}

function closeStartDateModal() {
    document.getElementById('startDateModal').hidden = true;
}

function handleSaveStartDate() {
    const dateValue = document.getElementById('startDateInput').value;
    if (!dateValue) {
        alert('Please select a date.');
        return;
    }
    state.journeyStartDate = dateValue;
    state.lastSeenLandmarkDay = null; // Reset so landmarks can show again
    saveStateToStorage();
    closeStartDateModal();
    updateUI();
    checkForLandmarkToast();
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();

    const dateInput = document.getElementById('entryDate').value;
    const stepsInput = parseInt(document.getElementById('entrySteps').value);

    if (!dateInput || isNaN(stepsInput) || stepsInput < 0) {
        alert('Please enter valid date and steps.');
        return;
    }

    const existingIndex = state.dailyEntries.findIndex(entry => entry.dateISO === dateInput);

    if (existingIndex >= 0) {
        state.dailyEntries[existingIndex].steps = stepsInput;
    } else {
        state.dailyEntries.push({
            dateISO: dateInput,
            steps: stepsInput
        });
    }

    saveStateToStorage();
    updateUI();
    clearForm();
}

// Clear form
function clearForm() {
    document.getElementById('entryDate').valueAsDate = new Date();
    document.getElementById('entrySteps').value = '';
    document.getElementById('entrySteps').focus();
}

// Delete entry
function deleteEntry(dateISO) {
    if (confirm(`Delete entry for ${formatDate(dateISO)}?`)) {
        state.dailyEntries = state.dailyEntries.filter(entry => entry.dateISO !== dateISO);
        saveStateToStorage();
        updateUI();
    }
}

// Calculate cumulative distance
function calculateCumulativeDistance() {
    const sorted = [...state.dailyEntries].sort((a, b) => a.dateISO.localeCompare(b.dateISO));

    let totalSteps = 0;
    let totalKm = 0;

    sorted.forEach(entry => {
        totalSteps += entry.steps;
        totalKm += (entry.steps * STEP_LENGTH_M) / 1000;
    });

    return { totalSteps, totalKm };
}

// Update all UI elements
function updateUI() {
    updateSummary();
    updateEntryList();
    updateMap();
    updateFrodoDisplay();
}

// Update summary panel
function updateSummary() {
    const { totalSteps, totalKm } = calculateCumulativeDistance();

    document.getElementById('totalSteps').textContent = totalSteps.toLocaleString();
    document.getElementById('totalKm').textContent = totalKm.toFixed(2) + ' km';

    if (state.route) {
        const progress = (totalKm / state.route.totalKm) * 100;
        document.getElementById('routeProgress').textContent = Math.min(progress, 100).toFixed(1) + '%';
    }

    const frodoDay = getCurrentFrodoDay();
    if (frodoDay && state.frodoDailyKm.length > 0) {
        const frodoKm = state.frodoDailyKm[frodoDay] || 0;
        const diff = totalKm - frodoKm;
        const sign = diff >= 0 ? '+' : '';
        document.getElementById('vsFromo').textContent = sign + diff.toFixed(2) + ' km';
    } else {
        document.getElementById('vsFromo').textContent = '—';
    }
}

// Update entry list
function updateEntryList() {
    const container = document.getElementById('entryListContainer');

    if (state.dailyEntries.length === 0) {
        container.innerHTML = '<p class="empty-message">No entries yet. Start logging your steps!</p>';
        return;
    }

    const sorted = [...state.dailyEntries].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

    container.innerHTML = sorted.map(entry => {
        const km = (entry.steps * STEP_LENGTH_M / 1000).toFixed(2);
        return `
            <div class="entry-item">
                <div class="entry-info">
                    <div class="entry-date">${formatDate(entry.dateISO)}</div>
                    <div class="entry-steps">${entry.steps.toLocaleString()} steps</div>
                    <div class="entry-distance">${km} km</div>
                </div>
                <button class="btn btn-danger" onclick="deleteEntry('${entry.dateISO}')">Delete</button>
            </div>
        `;
    }).join('');
}

// Update map and markers
function updateMap() {
    if (!state.route) return;

    const routeLine = document.getElementById('routeLine');
    const points = state.route.points.map(p => `${p.x},${p.y}`).join(' ');
    routeLine.setAttribute('points', points);

    const { totalKm } = calculateCumulativeDistance();
    const myPos = interpolatePosition(state.route, totalKm);
    const myDot = document.getElementById('myDot');
    myDot.setAttribute('x', myPos.x - 50);
    myDot.setAttribute('y', myPos.y - 50);

    updateFrodoDisplay();
}

// Update Frodo display
function updateFrodoDisplay() {
    if (!state.frodoDailyKm || state.frodoDailyKm.length === 0 || !state.route) return;

    const frodoDay = getCurrentFrodoDay();
    const label = document.getElementById('frodoDayLabel');

    if (!frodoDay) {
        label.textContent = 'Set a start date to track Frodo';
        const frodoDot = document.getElementById('frodoDot');
        frodoDot.setAttribute('x', -200);
        frodoDot.setAttribute('y', -200);
        return;
    }

    const frodoKm = state.frodoDailyKm[frodoDay] || 0;
    const landmarkText = getLandmarkForDay(frodoDay);

    if (frodoDay >= 200) {
        label.textContent = `Day ${frodoDay}: ${landmarkText} (Journey complete!)`;
    } else {
        label.textContent = `Day ${frodoDay}: ${landmarkText}`;
    }

    const frodoPos = interpolatePosition(state.route, frodoKm);
    const frodoDot = document.getElementById('frodoDot');
    frodoDot.setAttribute('x', frodoPos.x - 50);
    frodoDot.setAttribute('y', frodoPos.y - 50);

    const { totalKm } = calculateCumulativeDistance();
    const diff = totalKm - frodoKm;
    const sign = diff >= 0 ? '+' : '';
    document.getElementById('vsFromo').textContent = sign + diff.toFixed(2) + ' km';
}

// Interpolate position along route based on distance
function interpolatePosition(route, targetKm) {
    const clampedKm = Math.max(0, Math.min(targetKm, route.totalKm));

    for (let i = 0; i < route.points.length - 1; i++) {
        const p1 = route.points[i];
        const p2 = route.points[i + 1];

        if (clampedKm >= p1.dKm && clampedKm <= p2.dKm) {
            const segmentDistance = p2.dKm - p1.dKm;
            const t = segmentDistance > 0 ? (clampedKm - p1.dKm) / segmentDistance : 0;
            return {
                x: lerp(p1.x, p2.x, t),
                y: lerp(p1.y, p2.y, t)
            };
        }
    }

    const lastPoint = route.points[route.points.length - 1];
    return { x: lastPoint.x, y: lastPoint.y };
}

// Linear interpolation
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Format date for display
function formatDate(dateISO) {
    const date = new Date(dateISO + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Initialize zoom and pan
function initializeZoom() {
    const mapContainer = document.getElementById('mapContainer');

    if (typeof Panzoom !== 'undefined') {
        state.panzoomInstance = Panzoom(mapContainer, {
            maxScale: 5,
            minScale: 1,
            bounds: true,
            boundsPadding: 0.1,
            animate: true,
            contain: 'outside'
        });

        const wrapper = document.getElementById('mapWrapper');
        wrapper.addEventListener('wheel', (e) => {
            if (state.panzoomInstance?.zoomWithWheel) state.panzoomInstance.zoomWithWheel(e);
        }, { passive: false });

        return;
    }

    console.warn('Panzoom library not loaded — using built-in pan/zoom fallback.');
    initializeBasicPanZoom();
}

function initializeBasicPanZoom() {
    const wrapper = document.getElementById('mapWrapper');
    const target = document.getElementById('mapContainer');

    const zoomState = {
        scale: 1,
        minScale: 1,
        maxScale: 5,
        x: 0,
        y: 0,
        panning: false,
        lastX: 0,
        lastY: 0,
        pointers: new Map(),
        lastPinchDist: null
    };

    function applyTransform() {
        target.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.scale})`;
    }

    function clampScale(s) {
        return Math.max(zoomState.minScale, Math.min(zoomState.maxScale, s));
    }

    function zoomAt(clientX, clientY, nextScale) {
        const rect = wrapper.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;

        const contentX = (px - zoomState.x) / zoomState.scale;
        const contentY = (py - zoomState.y) / zoomState.scale;

        const newScale = clampScale(nextScale);

        zoomState.x = px - contentX * newScale;
        zoomState.y = py - contentY * newScale;
        zoomState.scale = newScale;

        applyTransform();
    }

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 1 / 1.1;
        zoomAt(e.clientX, e.clientY, zoomState.scale * factor);
    }, { passive: false });

    wrapper.addEventListener('pointerdown', (e) => {
        wrapper.setPointerCapture(e.pointerId);
        zoomState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (zoomState.pointers.size === 1) {
            zoomState.panning = true;
            zoomState.lastX = e.clientX;
            zoomState.lastY = e.clientY;
        }
    });

    wrapper.addEventListener('pointermove', (e) => {
        if (!zoomState.pointers.has(e.pointerId)) return;

        zoomState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (zoomState.pointers.size === 2) {
            const pts = Array.from(zoomState.pointers.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const centerX = (pts[0].x + pts[1].x) / 2;
            const centerY = (pts[0].y + pts[1].y) / 2;

            if (zoomState.lastPinchDist != null) {
                zoomAt(centerX, centerY, zoomState.scale * (dist / zoomState.lastPinchDist));
            }

            zoomState.lastPinchDist = dist;
            zoomState.panning = false;
            return;
        }

        if (zoomState.panning && zoomState.pointers.size === 1) {
            zoomState.x += e.clientX - zoomState.lastX;
            zoomState.y += e.clientY - zoomState.lastY;
            zoomState.lastX = e.clientX;
            zoomState.lastY = e.clientY;
            applyTransform();
        }
    });

    function endPointer(e) {
        zoomState.pointers.delete(e.pointerId);
        if (zoomState.pointers.size < 2) zoomState.lastPinchDist = null;
        if (zoomState.pointers.size === 0) zoomState.panning = false;
    }

    wrapper.addEventListener('pointerup', endPointer);
    wrapper.addEventListener('pointercancel', endPointer);

    applyTransform();
}

// Make functions available globally
window.deleteEntry = deleteEntry;
window.dismissToast = dismissToast;
