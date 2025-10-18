// Variables globales
let currentScreen = 'main-screen';
let players = [];
let isHost = false;
let roomCode = '';
let currentWord = '';
let impostorIndex = -1;
let roundNumber = 1;
let socket = null;

// Elementos DOM
const screens = document.querySelectorAll('.screen');
const mainScreen = document.getElementById('main-screen');
const createScreen = document.getElementById('create-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const joinScreen = document.getElementById('join-screen');
const gameScreen = document.getElementById('game-screen');

const roomCodeDisplay = document.getElementById('room-code');
const playersCountDisplay = document.getElementById('players-count');
const playerList = document.getElementById('player-list');
const gamePlayerList = document.getElementById('game-player-list');
const wordDisplay = document.getElementById('word-display');
const roundNumberDisplay = document.getElementById('round-number');
const gameRoomCodeDisplay = document.getElementById('game-room-code');

const hostControls = document.getElementById('host-controls');

// Elementos para pantalla completa
const fullscreenBtn = document.getElementById('fullscreen-btn');
const iosModal = document.getElementById('ios-fullscreen-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

// Inicializar socket
function initializeSocket() {
    socket = io();
    
    // Event listeners del socket
    socket.on('connect', () => {
        console.log('Conectado al servidor');
    });
    
    socket.on('room-created', (code) => {
        roomCode = code;
        roomCodeDisplay.textContent = code;
        gameRoomCodeDisplay.textContent = code;
        isHost = true;
        showScreen('lobby-screen');
        console.log('Sala creada exitosamente');
    });
    
    socket.on('joined-room', (code) => {
        roomCode = code;
        roomCodeDisplay.textContent = code;
        gameRoomCodeDisplay.textContent = code;
        isHost = false;
        showScreen('lobby-screen');
        console.log('Te has unido a la sala exitosamente');
    });
    
    socket.on('players-updated', (playersList) => {
        players = playersList;
        updatePlayerList();
        playersCountDisplay.textContent = players.length;
    });
    
    socket.on('round-started', (data) => {
        roundNumber = data.roundNumber;
        currentWord = data.word;
        
        wordDisplay.textContent = currentWord;
        if (data.isImpostor) {
            wordDisplay.classList.add('impostor');
        } else {
            wordDisplay.classList.remove('impostor');
        }
        
        roundNumberDisplay.textContent = roundNumber;
        updateGamePlayerList(data.players);
        showScreen('game-screen');
        
        // Mostrar controles solo al host
        hostControls.style.display = isHost ? 'flex' : 'none';
        
        console.log(`¡Ronda ${roundNumber} iniciada!`);
    });
    
    socket.on('new-word-changed', (data) => {
        console.log(data.message);
    });
    
    socket.on('player-left', (playerName) => {
        console.log(`${playerName} ha abandonado la sala`);
    });
    
    socket.on('error', (message) => {
        alert(message);
    });
    
    socket.on('disconnect', () => {
        console.log('Desconectado del servidor. Recargando...');
        setTimeout(() => {
            location.reload();
        }, 3000);
    });
}

// Event Listeners del DOM
document.addEventListener('DOMContentLoaded', function() {
    // Botones principales
    document.getElementById('create-btn').addEventListener('click', () => showScreen('create-screen'));
    document.getElementById('join-btn').addEventListener('click', () => showScreen('join-screen'));

    // Botones de crear/unirse
    document.getElementById('create-game-btn').addEventListener('click', createGame);
    document.getElementById('join-game-btn').addEventListener('click', joinGame);

    // Botones de juego
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('new-word-btn').addEventListener('click', requestNewWord);

    // Botones de navegación
    document.getElementById('back-to-main-btn-1').addEventListener('click', () => showScreen('main-screen'));
    document.getElementById('back-to-main-btn-2').addEventListener('click', () => showScreen('main-screen'));
    document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);
    document.getElementById('leave-game-btn').addEventListener('click', leaveGame);

    // Pantalla completa
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    closeModalBtn.addEventListener('click', () => {
        iosModal.style.display = 'none';
    });

    // Permitir enviar formularios con Enter
    document.getElementById('host-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGame();
    });
    
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });

    // Inicializar elementos
    resetGame();
});

// Detectar si es iOS
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform) || 
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

// Función para pantalla completa
function toggleFullscreen() {
    if (isIOS()) {
        // Mostrar modal con instrucciones para iOS
        iosModal.style.display = 'flex';
        return;
    }

    if (!document.fullscreenElement) {
        // Entrar en pantalla completa
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
    } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Funciones principales del juego
function showScreen(screenId) {
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
}

function createGame() {
    const hostName = document.getElementById('host-name').value.trim();
    if (!hostName) {
        alert('Por favor, ingresa tu nombre');
        return;
    }
    
    if (!socket) initializeSocket();
    socket.emit('create-room', hostName);
}

function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim();
    
    if (!playerName) {
        alert('Por favor, ingresa tu nombre');
        return;
    }
    
    if (!code || code.length !== 4 || isNaN(code)) {
        alert('Por favor, ingresa un código de sala válido (4 dígitos)');
        return;
    }
    
    if (!socket) initializeSocket();
    socket.emit('join-room', { roomCode: code, playerName: playerName });
}

function startGame() {
    if (players.length < 2) {
        alert('Se necesitan al menos 2 jugadores para comenzar');
        return;
    }
    
    socket.emit('start-game', roomCode);
}

function requestNewWord() {
    socket.emit('request-new-word', roomCode);
}

function leaveLobby() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showScreen('main-screen');
    resetGame();
}

function leaveGame() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showScreen('main-screen');
    resetGame();
}

function resetGame() {
    players = [];
    roomCode = '';
    currentWord = '';
    impostorIndex = -1;
    roundNumber = 1;
    isHost = false;
    
    playerList.innerHTML = '';
    gamePlayerList.innerHTML = '';
    wordDisplay.textContent = 'Esperando palabra...';
    wordDisplay.classList.remove('impostor');
    roundNumberDisplay.textContent = '1';
    roomCodeDisplay.textContent = '0000';
    gameRoomCodeDisplay.textContent = '0000';
    playersCountDisplay.textContent = '0';
    hostControls.style.display = 'none';
}

function updatePlayerList() {
    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <span class="player-name">${player.name} ${player.isHost ? '<span class="host-badge">Host</span>' : ''}</span>
            <span class="player-status">${player.isHost ? 'Anfitrión' : 'Jugador'}</span>
        `;
        playerList.appendChild(li);
    });
    
    // Actualizar estado del botón de iniciar
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.disabled = players.length < 2;
    }
}

function updateGamePlayerList(playersList) {
    gamePlayerList.innerHTML = '';
    playersList.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <span class="player-name">${player.name} ${player.isHost ? '<span class="host-badge">Host</span>' : ''}</span>
            <span class="player-status">${player.isHost ? 'Anfitrión' : 'Jugador'}</span>
        `;
        gamePlayerList.appendChild(li);
    });
}