// Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// --- DOM Elements ---
const mapContainer = document.getElementById('mapContainer');
const peopleCountEl = document.getElementById('peopleCount');
const coordsEl = document.getElementById('coords');
const connectionStatusEl = document.getElementById('connectionStatus');

// --- Constants ---
const MAP_WIDTH = 15000;
const MAP_HEIGHT = 12000;
const GRID_ORIGIN_X = MAP_WIDTH / 2;
const GRID_ORIGIN_Y = MAP_HEIGHT / 2;

let people = [];
let app, database;

const defaultPeople = [
    {name: '熊窩', gridX: 0, gridY: 0, type: 'center', color: 'red', locked: true},
    {name: '急先鋒', gridX: 0, gridY: -3, type: 'person', color: 'green', locked: false},
    {name: 'Patato Q', gridX: 3, gridY: -1, type: 'person', color: 'blue', locked: false},
    {name: 'Potato Sue', gridX: 3, gridY: 1, type: 'person', color: 'purple', locked: false}
];

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

function setupFirebaseListener() {
    const layoutRef = ref(database, 'bearDenLayout');
    onValue(layoutRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.people) {
            people = data.people;
        } else {
            people = [...defaultPeople];
        }
        renderPeople();
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

// --- Rendering Function ---
function renderPeople() {
    mapContainer.innerHTML = '';
    peopleCountEl.textContent = people.length;

    people.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `person ${item.color || 'green'}`;

        if (item.locked) {
            div.classList.add('locked');
        }
        if (item.type === 'alliance-flag' && item.locked) {
            div.classList.add('send-to-back');
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = item.name;
        div.appendChild(textDiv);

        const gridSpacing = 40;
        let width, height;

        switch(item.type) {
            case 'small': // 1x1
                width = height = gridSpacing * Math.sqrt(2);
                break;
            case 'person': // 2x2
                width = height = gridSpacing * 2 * Math.sqrt(2);
                break;
            case 'center': // 3x3
                width = height = gridSpacing * 3 * Math.sqrt(2);
                break;
            case 'large': // 4x4
                width = height = gridSpacing * 4 * Math.sqrt(2);
                break;
            case 'flag': // 1x2
                width = gridSpacing * 1 * Math.sqrt(2); 
                height = gridSpacing * 2 * Math.sqrt(2); 
                break;
            case 'alliance-flag': // 7x7
                div.classList.add('alliance-flag-container');
                width = height = gridSpacing * 7 * Math.sqrt(2);
                break;
            default: // 預設為 2x2
                width = height = gridSpacing * 2 * Math.sqrt(2);
        }

        const centerPos = gridToPixel(item.gridX, item.gridY);
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.left = `${centerPos.x - width / 2}px`;
        div.style.top = `${centerPos.y - height / 2}px`;

        mapContainer.appendChild(div);
    });
}

// --- Event Listeners & Initialization ---
function setupEventListeners() {
    document.addEventListener('mousemove', (e) => {
        const rect = mapContainer.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        const grid = pixelToGrid(pixelX, pixelY);
        
        coordsEl.textContent = `座標: ${Math.round(pixelX)}, ${Math.round(pixelY)} | 格線: (${grid.gridX}, ${grid.gridY})`;
    });
}

function initialize() {
    const centerX = MAP_WIDTH / 2 - window.innerWidth / 2;
    const centerY = MAP_HEIGHT / 2 - window.innerHeight / 2;
    window.scrollTo(centerX, centerY);
    
    setupFirebase();
    setupEventListeners();
}

// Start the application
initialize();
