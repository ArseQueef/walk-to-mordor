// Constants
const STEP_LENGTH_M = 0.762; // meters per step
const STORAGE_KEY = 'walkToMordor';

// Global state
let state = {
    dailyEntries: [],
    frodoSelectedDayIndex: 0,
    route: null,
    frodoDays: null,
    panzoomInstance: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    loadStateFromStorage();
    setupEventListeners();
    initializeZoom();
    updateUI();
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
        
        // Setup Frodo day slider
        const slider = document.getElementById('frodoDaySlider');
        slider.max = state.frodoDays.length - 1;
        slider.value = state.frodoSelectedDayIndex;
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading map data. Please ensure data files are present.');
    }
}

// Load state from localStorage
function loadStateFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.dailyEntries = parsed.dailyEntries || [];
            state.frodoSelectedDayIndex = parsed.frodoSelectedDayIndex || 0;
        } catch (error) {
            console.error('Error parsing saved data:', error);
        }
    }
}

// Save state to localStorage
function saveStateToStorage() {
    const toSave = {
        dailyEntries: state.dailyEntries,
        frodoSelectedDayIndex: state.frodoSelectedDayIndex
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    const entryForm = document.getElementById('entryForm');
    if (entryForm) entryForm.addEventListener('submit', handleFormSubmit);

    // Clear form button
    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearForm);

    // Frodo day slider
    const slider = document.getElementById('frodoDaySlider');
    if (slider) slider.addEventListener('input', handleFrodoDayChange);

    // Prevent native dragging inside the map area (keeps panning smooth)
    const mapWrapper = document.getElementById('mapWrapper');
    if (mapWrapper) mapWrapper.addEventListener('dragstart', (e) => e.preventDefault());
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
    
    // Check if entry already exists for this date
    const existingIndex = state.dailyEntries.findIndex(entry => entry.dateISO === dateInput);
    
    if (existingIndex >= 0) {
        // Update existing entry
        state.dailyEntries[existingIndex].steps = stepsInput;
    } else {
        // Add new entry
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

// Handle Frodo day slider change
function handleFrodoDayChange(e) {
    state.frodoSelectedDayIndex = parseInt(e.target.value);
    saveStateToStorage();
    updateFrodoDisplay();
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
    // Sort entries by date
    const sorted = [...state.dailyEntries].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    
    let totalSteps = 0;
    let totalKm = 0;
    
    sorted.forEach(entry => {
        totalSteps += entry.steps;
        const kmForDay = (entry.steps * STEP_LENGTH_M) / 1000;
        totalKm += kmForDay;
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
    
    if (state.frodoDays && state.frodoDays.length > 0) {
        const frodoDay = state.frodoDays[state.frodoSelectedDayIndex];
        const diff = totalKm - frodoDay.frodoCumulativeKm;
        const sign = diff >= 0 ? '+' : '';
        document.getElementById('vsFromo').textContent = sign + diff.toFixed(2) + ' km';
    }
}

// Update entry list
function updateEntryList() {
    const container = document.getElementById('entryListContainer');
    
    if (state.dailyEntries.length === 0) {
        container.innerHTML = '<p class="empty-message">No entries yet. Start logging your steps!</p>';
        return;
    }
    
    // Sort by date descending
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
    
    // Draw route polyline
    const routeLine = document.getElementById('routeLine');
    const points = state.route.points.map(p => `${p.x},${p.y}`).join(' ');
    routeLine.setAttribute('points', points);
    
    // Update my dot position
    const { totalKm } = calculateCumulativeDistance();
    const myPos = interpolatePosition(state.route, totalKm);
    const myDot = document.getElementById('myDot');
    myDot.setAttribute('cx', myPos.x);
    myDot.setAttribute('cy', myPos.y);
}

// Update Frodo display
function updateFrodoDisplay() {
    if (!state.frodoDays || !state.route) return;
    
    const frodoDay = state.frodoDays[state.frodoSelectedDayIndex];
    
    // Update label
    document.getElementById('frodoDayLabel').textContent = 
        `Day ${frodoDay.dayIndex}: ${frodoDay.label}`;
    
    // Update Frodo dot position
    const frodoPos = interpolatePosition(state.route, frodoDay.frodoCumulativeKm);
    const frodoDot = document.getElementById('frodoDot');
    frodoDot.setAttribute('cx', frodoPos.x);
    frodoDot.setAttribute('cy', frodoPos.y);
    
    // Update vs Frodo stat
    const { totalKm } = calculateCumulativeDistance();
    const diff = totalKm - frodoDay.frodoCumulativeKm;
    const sign = diff >= 0 ? '+' : '';
    document.getElementById('vsFromo').textContent = sign + diff.toFixed(2) + ' km';
}

// Interpolate position along route based on distance
function interpolatePosition(route, targetKm) {
    // Clamp to route bounds
    const clampedKm = Math.max(0, Math.min(targetKm, route.totalKm));
    
    // Find the segment
    for (let i = 0; i < route.points.length - 1; i++) {
        const p1 = route.points[i];
        const p2 = route.points[i + 1];
        
        if (clampedKm >= p1.dKm && clampedKm <= p2.dKm) {
            // Interpolate within this segment
            const segmentDistance = p2.dKm - p1.dKm;
            const t = segmentDistance > 0 ? (clampedKm - p1.dKm) / segmentDistance : 0;
            
            return {
                x: lerp(p1.x, p2.x, t),
                y: lerp(p1.y, p2.y, t)
            };
        }
    }
    
    // If we're beyond the last point, return the last point
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

// Auto-update build version
const now = new Date();
const version = `${now.getFullYear()}.${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getDate().toString().padStart(2,'0')}.${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
document.getElementById('buildVersion').textContent = version;

// Initialize zoom and pan
function initializeZoom() {
    const mapContainer = document.getElementById('mapContainer');

    // Prefer Panzoom if it exists (online / CDN working)
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

    // Fallback: built-in pan/zoom (works offline)
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

        // Convert screen point to "content" point before zoom
        const contentX = (px - zoomState.x) / zoomState.scale;
        const contentY = (py - zoomState.y) / zoomState.scale;

        const newScale = clampScale(nextScale);

        // Adjust translate so the content point stays under cursor
        zoomState.x = px - contentX * newScale;
        zoomState.y = py - contentY * newScale;
        zoomState.scale = newScale;

        applyTransform();
    }

    // Wheel zoom (desktop)
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 1 / 1.1;
        zoomAt(e.clientX, e.clientY, zoomState.scale * factor);
    }, { passive: false });

    // Pointer / touch pan + pinch
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

        const prev = zoomState.pointers.get(e.pointerId);
        zoomState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Pinch zoom if two pointers
        if (zoomState.pointers.size === 2) {
            const pts = Array.from(zoomState.pointers.values());
            const dx = pts[0].x - pts[1].x;
            const dy = pts[0].y - pts[1].y;
            const dist = Math.hypot(dx, dy);

            const centerX = (pts[0].x + pts[1].x) / 2;
            const centerY = (pts[0].y + pts[1].y) / 2;

            if (zoomState.lastPinchDist != null) {
                const ratio = dist / zoomState.lastPinchDist;
                zoomAt(centerX, centerY, zoomState.scale * ratio);
            }

            zoomState.lastPinchDist = dist;
            zoomState.panning = false;
            return;
        }

        // Single pointer pan
        if (zoomState.panning && zoomState.pointers.size === 1) {
            const dx = e.clientX - zoomState.lastX;
            const dy = e.clientY - zoomState.lastY;
            zoomState.lastX = e.clientX;
            zoomState.lastY = e.clientY;

            zoomState.x += dx;
            zoomState.y += dy;
            applyTransform();
        }
    });

    function endPointer(e) {
        zoomState.pointers.delete(e.pointerId);
        if (zoomState.pointers.size < 2) {
            zoomState.lastPinchDist = null;
        }
        if (zoomState.pointers.size === 0) {
            zoomState.panning = false;
        }
    }

    wrapper.addEventListener('pointerup', endPointer);
    wrapper.addEventListener('pointercancel', endPointer);

    // Initial transform
    applyTransform();
}



// Make deleteEntry available globally
window.deleteEntry = deleteEntry;