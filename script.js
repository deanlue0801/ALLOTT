// Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// --- Global variables ---
let people = [];
let app, database;
let isDragging = false;
let dragPerson = null;
let dragOffset = {x: 0, y: 0};
let isUpdatingFromFirebase = false;

// Touch-related variables
let touchStartTime = 0;
let longPressTimer = null;
let currentTouchTarget = null;

// --- DOM Elements ---
const mapContainer = document.getElementById('mapContainer');
const peopleCountEl = document.getElementById('peopleCount');
const coordsEl = document.getElementById('coords');
const newItemNameInput = document.getElementById('newItemName');
const itemTypeSelect = document.getElementById('itemType');
const itemColorSelect = document.getElementById('itemColor');
const connectionStatusEl = document.getElementById('connectionStatus');
const debugOverlay = document.getElementById('debugOverlay');
const touchHint = document.getElementById('touchHint');

// --- Constants ---
const MAP_WIDTH = 15000;
const MAP_HEIGHT = 12000;
const GRID_ORIGIN_X = MAP_WIDTH / 2;
const GRID_ORIGIN_Y = MAP_HEIGHT / 2;

const defaultPeople = [
    {name: '熊窩', gridX: 0, gridY: 0, type: 'center', color: 'red', locked: true},
    {name: '急先鋒', gridX: 0, gridY: -3, type: 'person', color: 'green', locked: false},
    {name: 'Patato Q', gridX: 3, gridY: -1, type: 'person', color: 'blue', locked: false},
    {name: 'Potato Sue', gridX: 3, gridY: 1, type: 'person', color: 'purple', locked: false}
];

// --- Password Verification ---
function checkPassword() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayPassword = `bear${year}${month}${day}`;
    
    const password = prompt('🔐 請輸入編輯密碼：');
    if (password !== todayPassword) {
        alert('❌ 密碼錯誤！');
        window.location.href = 'view.html';
        return false;
    }
    return true;
}

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyC_onVT6MHR0fU3SgKKM0VH951gwBC5PB0",
    authDomain: "allott-16d7d.firebaseapp.com",
    projectId: "allott-16d7d",
    storageBucket: "allott-16d7d.firebasestorage.app",
    messagingSenderId: "987230174619",
    appId: "1:987230174619:web:7176d4f4e4ced5b9e2353e"
};

function setupFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        connectionStatusEl.textContent = '已連接';
        connectionStatusEl.className = 'status connected';
        setupFirebaseListener();
    } catch (error) {
        console.warn('Firebase 連接失敗:', error);
        connectionStatusEl.textContent = '離線模式';
        people = [...defaultPeople];
        renderPeople();
    }
}

function saveToFirebase() {
    if (!database || isUpdatingFromFirebase) return;
    try {
        const layoutRef = ref(database, 'bearDenLayout');
        set(layoutRef, { people: people, lastUpdated: Date.now() });
    } catch (error) {
        console.warn('Firebase 儲存失敗:', error);
    }
}

function setupFirebaseListener() {
    const layoutRef = ref(database, 'bearDenLayout');
    onValue(layoutRef, (snapshot) => {
        const data = snapshot.val();
        isUpdatingFromFirebase = true;
        
        if (data && data.people) {
            people = data.people;
        } else {
            people = [...defaultPeople];
            setTimeout(() => {
                isUpdatingFromFirebase = false;
                saveToFirebase();
            }, 100);
        }
        
        renderPeople();
        isUpdatingFromFirebase = false;
    });
}


// --- Coordinate Transformation ---
function gridToPixel(gridX, gridY) {
    const gridStep = 40;
    const rotatedX = (gridX - gridY) * gridStep / 2;
    const rotatedY = (gridX + gridY) * gridStep / 2;
    return { x: GRID_ORIGIN_X + rotatedX, y: GRID_ORIGIN_Y + rotatedY };
}

function pixelToGrid(pixelX, pixelY) {
    const deltaX = pixelX - GRID_ORIGIN_X;
    const deltaY = pixelY - GRID_ORIGIN_Y;
    const gridStep = 40;
    const gridX = Math.round((deltaX + deltaY) / gridStep);
    const gridY = Math.round((deltaY - deltaX) / gridStep);
    return {gridX, gridY};
}

// --- Core Functions ---

function toggleLock(index) {
    if (!people[index]) return;
    people[index].locked = !people[index].locked;
    renderPeople();
}

function renderPeople() {
    mapContainer.innerHTML = '';
    peopleCountEl.textContent = people.length;

    people.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `person ${item.color || 'green'}`;
        div.dataset.index = index;

        if (item.locked) {
            div.classList.add('locked');
        }

        const lockBtn = document.createElement('div');
        lockBtn.className = 'lock-btn';
        lockBtn.innerHTML = item.locked ? '🔒' : '🔓';
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLock(index);
        };
        div.appendChild(lockBtn);

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = item.name;
        div.appendChild(textDiv);

        const gridSpacing = 40;
        let size;
        switch(item.type) {
            case 'small': size = gridSpacing * Math.sqrt(2); break;
            case 'person': size = gridSpacing * 2 * Math.sqrt(2); break;
            case 'center': size = gridSpacing * 3 * Math.sqrt(2); break;
            case 'large': size = gridSpacing * 4 * Math.sqrt(2); break;
            default: size = gridSpacing * 2 * Math.sqrt(2);
        }

        const centerPos = gridToPixel(item.gridX, item.gridY);
        div.style.width = `${size}px`;
        div.style.height = `${size}px`;
        div.style.left = `${centerPos.x - size/2}px`;
        div.style.top = `${centerPos.y - size/2}px`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteItem(index);
        };
        div.appendChild(deleteBtn);

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            changeColor(index);
        });

        setupTouchEvents(div, index);
        mapContainer.appendChild(div);
    });

    if (!isUpdatingFromFirebase) saveToFirebase();
}

// --- Event Handling and Drag Logic ---

function setupTouchEvents(element, index) {
    let touchStarted = false;
    let isDraggingThis = false;

    element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        touchStarted = true;
        currentTouchTarget = element;
        touchStartTime = Date.now();
        showTouchFeedback(element, true);
        
        setTimeout(() => {
            startDragMode(e, index);
            isDraggingThis = true;
        }, 50);
        
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
        if (!isDraggingThis || !isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = mapContainer.getBoundingClientRect();
        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;
        
        const newCenterX = clientX - dragOffset.x;
        const newCenterY = clientY - dragOffset.y;
        
        const containerX = newCenterX - rect.left;
        const containerY = newCenterY - rect.top;
        const newGrid = pixelToGrid(containerX, containerY);
        
        people[dragPerson].gridX = newGrid.gridX;
        people[dragPerson].gridY = newGrid.gridY;
        
        renderPeople();
        createDragTrail(containerX, containerY);
        coordsEl.textContent = `🎯 拖拽中: 格線(${newGrid.gridX}, ${newGrid.gridY})`;
        updateDebugInfo(`拖拽移動: (${newGrid.gridX}, ${newGrid.gridY})`);
    }, { passive: false });

    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        touchStarted = false;
        isDraggingThis = false;
        
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        
        showTouchFeedback(element, false);
        
        if (isDragging) endDrag();
        currentTouchTarget = null;
    });

    element.addEventListener('touchcancel', (e) => {
        touchStarted = false;
        isDraggingThis = false;
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        showTouchFeedback(element, false);
        if (isDragging) endDrag();
    });

    element.addEventListener('mousedown', (e) => {
        startDragMode(e, index);
    });
}

function startDragMode(e, index) {
    if (people[index] && people[index].locked) {
        updateDebugInfo('🔒 此項目已被鎖定');
        const element = mapContainer.querySelector(`[data-index="${index}"]`);
        if (element) {
            element.style.animation = 'shake 0.5s';
            setTimeout(() => { element.style.animation = ''; }, 500);
        }
        return;
    }

    if (isDragging) return;
    if (e.target.classList.contains('delete-btn') || e.target.classList.contains('lock-btn')) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    isDragging = true;
    dragPerson = index;
    
    const element = mapContainer.querySelector(`[data-index="${index}"]`);
    const rect = element.getBoundingClientRect();
    
    dragOffset.x = clientX - (rect.left + rect.width / 2);
    dragOffset.y = clientY - (rect.top + rect.height / 2);
    
    element.classList.add('dragging');
    showDragHint(true);
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    
    e.preventDefault();
    e.stopPropagation();
}

function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    showDragHint(false);
    
    mapContainer.querySelectorAll('.person').forEach(p => {
        p.classList.remove('dragging');
    });
    
    dragPerson = null;
    
    if (debugOverlay) {
        setTimeout(() => {
            debugOverlay.classList.remove('show');
        }, 2000);
    }
}

function setupGlobalEventListeners() {
    document.addEventListener('touchend', (e) => {
        if (isAndroid() && isDragging && dragPerson !== null) {
            setTimeout(endDrag, 50);
        }
    }, { passive: false });

    const handleMove = (e) => {
        const rect = mapContainer.getBoundingClientRect();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const pixelX = clientX - rect.left;
        const pixelY = clientY - rect.top;
        const grid = pixelToGrid(pixelX, pixelY);
        
        if (!isDragging) {
            coordsEl.textContent = `座標: ${Math.round(pixelX)}, ${Math.round(pixelY)} | 格線: (${grid.gridX}, ${grid.gridY})`;
        } else if (dragPerson !== null) {
            const newPixelX = clientX - dragOffset.x;
            const newPixelY = clientY - dragOffset.y;
            const newGrid = pixelToGrid(newPixelX - rect.left, newPixelY - rect.top);
            
            people[dragPerson].gridX = newGrid.gridX;
            people[dragPerson].gridY = newGrid.gridY;
            
            renderPeople();
            createDragTrail(newPixelX, newPixelY);
        }
    };

    const handleEnd = () => {
        if (isDragging) setTimeout(endDrag, 10);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && newItemNameInput === document.activeElement) {
            addItem();
        }
    });
}

// --- UI-interactive Functions (globally accessible) ---
window.addItem = function() {
    const name = newItemNameInput.value.trim();
    if (name) {
        people.push({
            name: name,
            gridX: 6, gridY: 6,
            type: itemTypeSelect.value,
            color: itemColorSelect.value,
            locked: false
        });
        newItemNameInput.value = '';
        renderPeople();
    }
}

function deleteItem(index) {
    if (people[index] && people[index].locked) {
        alert('❌ 無法刪除，此項目已被鎖定！');
        return;
    }
    if (confirm(`確定要刪除 "${people[index].name}" 嗎？`)) {
        people.splice(index, 1);
        renderPeople();
    }
}

function changeColor(index) {
    if (people[index] && people[index].locked) {
        alert('❌ 無法變更顏色，此項目已被鎖定！');
        return;
    }
    const colors = ['green', 'blue', 'purple', 'orange', 'pink', 'yellow', 'cyan', 'red'];
    const currentColor = people[index].color || 'green';
    const currentIndex = colors.indexOf(currentColor);
    const nextIndex = (currentIndex + 1) % colors.length;
    people[index].color = colors[nextIndex];
    renderPeople();
}

window.exportLayout = function() {
    const layout = people.map(p => `${p.name}: 格線(${p.gridX}, ${p.gridY}) 顏色:${p.color} 鎖定:${p.locked}`).join('\n');
    const blob = new Blob([layout], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '熊窩座位表.txt';
    a.click();
    URL.revokeObjectURL(url);
}

window.clearAll = function() {
    const adminPassword = "SKY1147dean";
    const passwordInput = prompt('🔐 請輸入管理員密碼：');
    if (passwordInput !== adminPassword) {
        alert('❌ 密碼錯誤');
        return;
    }
    if (confirm('確定要清空所有項目嗎？(已鎖定的項目不會被清除)')) {
        people = people.filter(p => p.locked);
        renderPeople();
    }
}

// --- Utility & Debug Functions ---
function isAndroid() { return /Android/i.test(navigator.userAgent); }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent); }

function updateDebugInfo(message) {
    if (isAndroid()) {
        coordsEl.style.background = 'rgba(231, 76, 60, 0.9)';
        coordsEl.style.color = 'white';
        coordsEl.innerHTML = `🤖 ${message}`;
    } else if (isIOS() && debugOverlay) {
        debugOverlay.innerHTML = `🍎 ${message}`;
        debugOverlay.classList.add('show');
        setTimeout(() => {
            if (!isDragging) debugOverlay.classList.remove('show');
        }, 3000);
    }
}

function showTouchFeedback(element, show = true) {
    if (show) {
        element.classList.add('touch-active');
        if (navigator.vibrate) navigator.vibrate(50);
    } else {
        element.classList.remove('touch-active');
    }
}

function showDragHint(show = true) {
    if (touchHint) touchHint.classList.toggle('show', show);
}

function createDragTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'drag-trail';
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;
    mapContainer.appendChild(trail);
    setTimeout(() => {
        if (trail.parentNode) trail.parentNode.removeChild(trail);
    }, 1000);
}


// --- Initialization ---
function initialize() {
    if (!checkPassword()) {
        return; // Stop execution if password fails
    }

    const centerX = MAP_WIDTH / 2 - window.innerWidth / 2;
    const centerY = MAP_HEIGHT / 2 - window.innerHeight / 2;
    window.scrollTo(centerX, centerY);
    
    setupFirebase();
    setupGlobalEventListeners();
}

// Start the application
initialize();
