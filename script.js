// Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// --- Global variables ---
let people = [];
let app, database;
let isDragging = false;
let dragPerson = null;
let dragOffset = {x: 0, y: 0, calculated: false};
let isUpdatingFromFirebase = false;

// Multi-select & Marquee variables
let isMultiSelectMode = false;
let selectedIndices = new Set();
let isMarqueeSelecting = false;
let selectionBox = null;
let marqueeStartPos = { x: 0, y: 0 };

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
const multiSelectBtn = document.getElementById('multiSelectBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

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

window.toggleMultiSelectMode = function() {
    isMultiSelectMode = !isMultiSelectMode;
    mapContainer.classList.toggle('multi-select-mode', isMultiSelectMode);
    multiSelectBtn.classList.toggle('active', isMultiSelectMode);

    if (!isMultiSelectMode) {
        selectedIndices.clear();
        deleteSelectedBtn.style.display = 'none';
        renderPeople();
    }
}

function toggleItemSelection(index) {
    if (people[index].locked) return;

    if (selectedIndices.has(index)) {
        selectedIndices.delete(index);
    } else {
        selectedIndices.add(index);
    }

    deleteSelectedBtn.style.display = selectedIndices.size > 0 ? 'inline-block' : 'none';
    renderPeople();
}

window.deleteSelected = function() {
    if (selectedIndices.size === 0) return;
    if (confirm(`確定要刪除選取的 ${selectedIndices.size} 個項目嗎？`)) {
        const sortedIndices = Array.from(selectedIndices).sort((a, b) => b - a);
        sortedIndices.forEach(index => {
            people.splice(index, 1);
        });
        
        selectedIndices.clear();
        deleteSelectedBtn.style.display = 'none';
        renderPeople();
    }
}

function renameItem(index) {
    if (!people[index]) return;
    if (people[index].locked) {
        alert('❌ 無法改名，此項目已被鎖定！');
        return;
    }
    const newName = prompt('請輸入新的名稱：', people[index].name);
    if (newName && newName.trim() !== '') {
        people[index].name = newName.trim();
        renderPeople();
    }
}

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

        if (selectedIndices.has(index)) {
            div.classList.add('selected');
        }
        if (item.locked) {
            div.classList.add('locked');
        }
        if (item.type === 'alliance-flag' && item.locked) {
            div.classList.add('send-to-back');
        }

        const lockBtn = document.createElement('div');
        lockBtn.className = 'lock-btn';
        lockBtn.innerHTML = '🔒';
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLock(index);
        };
        div.appendChild(lockBtn);

        const renameBtn = document.createElement('div');
        renameBtn.className = 'rename-btn';
        renameBtn.innerHTML = '✏️';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameItem(index);
        };
        div.appendChild(renameBtn);

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = item.name;
        div.appendChild(textDiv);

        const gridSpacing = 40;
        let width, height;

        switch(item.type) {
            case 'small': width = height = gridSpacing * Math.sqrt(2); break;
            case 'person': width = height = gridSpacing * 2 * Math.sqrt(2); break;
            case 'center': width = height = gridSpacing * 3 * Math.sqrt(2); break;
            case 'large': width = height = gridSpacing * 4 * Math.sqrt(2); break;
            case 'flag': width = gridSpacing * 1 * Math.sqrt(2); height = gridSpacing * 2 * Math.sqrt(2); break;
            case 'alliance-flag': div.classList.add('alliance-flag-container'); width = height = gridSpacing * 7 * Math.sqrt(2); break;
            default: width = height = gridSpacing * 2 * Math.sqrt(2);
        }

        const centerPos = gridToPixel(item.gridX, item.gridY);
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.left = `${centerPos.x - width / 2}px`;
        div.style.top = `${centerPos.y - height / 2}px`;

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

        // 移除舊的 mousedown 監聽器，統一由 mapContainer 處理
        // element.addEventListener('mousedown', (e) => { startDragMode(e, index); });
        
        mapContainer.appendChild(div);
    });

    if (!isUpdatingFromFirebase) saveToFirebase();
}

// --- Event Handling and Drag Logic ---

function checkIntersection(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
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
    
    isDragging = true;
    dragPerson = index;
    
    if (!selectedIndices.has(index)) {
        selectedIndices.clear();
        selectedIndices.add(index);
        renderPeople();
    }
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const element = mapContainer.querySelector(`[data-index="${index}"]`);
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
    const handleMouseDown = (e) => {
        // 忽略右鍵
        if (e.button !== 0) return;

        const target = e.target;
        
        if (target.classList.contains('person')) {
            const index = parseInt(target.dataset.index, 10);
            if (isMultiSelectMode) {
                toggleItemSelection(index);
            } else {
                startDragMode(e, index);
            }
        } else if (target.classList.contains('lock-btn') || target.classList.contains('rename-btn') || target.classList.contains('delete-btn')) {
            // 點擊按鈕時，事件已在按鈕的 onclick 中處理，此處不執行任何操作
            return;
        } else if (isMultiSelectMode && target === mapContainer) {
            // 開始畫框選取
            isMarqueeSelecting = true;
            if (!e.shiftKey) { // 如果沒有按住 shift，則清空之前的選取
                selectedIndices.clear();
            }

            const rect = mapContainer.getBoundingClientRect();
            marqueeStartPos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.left = `${marqueeStartPos.x}px`;
            selectionBox.style.top = `${marqueeStartPos.y}px`;
            mapContainer.appendChild(selectionBox);
        }
    };

    const handleMouseMove = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = mapContainer.getBoundingClientRect();

        if (isMarqueeSelecting) {
            const currentX = clientX - rect.left;
            const currentY = clientY - rect.top;

            const newX = Math.min(marqueeStartPos.x, currentX);
            const newY = Math.min(marqueeStartPos.y, currentY);
            const width = Math.abs(marqueeStartPos.x - currentX);
            const height = Math.abs(marqueeStartPos.y - currentY);
            
            selectionBox.style.left = `${newX}px`;
            selectionBox.style.top = `${newY}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;

        } else if (isDragging && selectedIndices.size > 0) {
            if (!dragOffset.calculated) {
                const firstItem = people[dragPerson];
                const firstItemPos = gridToPixel(firstItem.gridX, firstItem.gridY);
                dragOffset.x = clientX - (firstItemPos.x + rect.left);
                dragOffset.y = clientY - (firstItemPos.y + rect.top);
                dragOffset.calculated = true;

                selectedIndices.forEach(idx => {
                    people[idx].initialGridX = people[idx].gridX;
                    people[idx].initialGridY = people[idx].gridY;
                });
            }
            
            const newBasePixelX = clientX - dragOffset.x - rect.left;
            const newBasePixelY = clientY - dragOffset.y - rect.top;
            const newBaseGrid = pixelToGrid(newBasePixelX, newBasePixelY);

            const gridDeltaX = newBaseGrid.gridX - people[dragPerson].initialGridX;
            const gridDeltaY = newBaseGrid.gridY - people[dragPerson].initialGridY;
            
            selectedIndices.forEach(idx => {
                if (!people[idx].locked) {
                    people[idx].gridX = people[idx].initialGridX + gridDeltaX;
                    people[idx].gridY = people[idx].initialGridY + gridDeltaY;
                }
            });
            renderPeople();
        } else {
            const pixelX = clientX - rect.left;
            const pixelY = clientY - rect.top;
            const grid = pixelToGrid(pixelX, pixelY);
            coordsEl.textContent = `座標: ${Math.round(pixelX)}, ${Math.round(pixelY)} | 格線: (${grid.gridX}, ${grid.gridY})`;
        }
    };

    const handleMouseUp = (e) => {
        if (isMarqueeSelecting) {
            const boxRect = selectionBox.getBoundingClientRect();
            mapContainer.querySelectorAll('.person').forEach(p => {
                const personRect = p.getBoundingClientRect();
                if (checkIntersection(boxRect, personRect)) {
                    const index = parseInt(p.dataset.index, 10);
                    if (!people[index].locked) {
                        selectedIndices.add(index);
                    }
                }
            });

            mapContainer.removeChild(selectionBox);
            selectionBox = null;
            isMarqueeSelecting = false;
            deleteSelectedBtn.style.display = selectedIndices.size > 0 ? 'inline-block' : 'none';
            renderPeople();
        }

        if (isDragging) {
            dragOffset.calculated = false;
            endDrag();
        }
    };
    
    mapContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && newItemNameInput === document.activeElement) {
            addItem();
        }
    });
}

// --- UI-interactive Functions (globally accessible) ---
window.addItem = function() {
    const type = itemTypeSelect.value;
    let name = '';

    if (type === 'alliance-flag') {
        name = '旗子';
    } else {
        name = newItemNameInput.value.trim();
        if (!name) {
            alert('請輸入名稱！');
            return;
        }
    }

    const newItem = {
        name: name,
        gridX: 6, 
        gridY: 6,
        type: type,
        color: itemColorSelect.value,
        locked: false
    };

    people.push(newItem);
    
    if (type !== 'alliance-flag') {
        newItemNameInput.value = '';
    }
    
    renderPeople();
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
    if (isAndroid() && coordsEl) {
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
