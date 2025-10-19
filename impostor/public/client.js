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

// ===========================================
// MANEJO DE CAMBIOS DE ORIENTACIÓN
// ===========================================

let orientationTimer;

function handleOrientationChange() {
    // Aplicar clase temporal para la transición
    document.body.classList.add('orientation-change');
    
    // Ajustar layout después de un breve delay
    clearTimeout(orientationTimer);
    orientationTimer = setTimeout(() => {
        adjustLayoutNoScroll();
        document.body.classList.remove('orientation-change');
    }, 300);
}

// Función mejorada para ajustar el layout sin scroll
function adjustLayoutNoScroll() {
    const container = document.querySelector('.container');
    const currentScreen = document.querySelector('.screen.active');
    
    if (container && currentScreen) {
        // Forzar el recálculo de alturas
        container.style.display = 'none';
        container.offsetHeight; // Trigger reflow
        container.style.display = 'flex';
        
        // Ajustar específicamente la lista de jugadores
        const playerList = currentScreen.querySelector('.player-list');
        if (playerList) {
            const availableHeight = container.offsetHeight - playerList.offsetTop - 100;
            playerList.style.maxHeight = Math.max(150, availableHeight) + 'px';
        }
    }
}

// Detectar cambios de orientación
window.addEventListener('orientationchange', handleOrientationChange);
window.addEventListener('resize', handleOrientationChange);

// Sistema de notificaciones retro
function showRetroAlert(message, isError = true) {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    
    // Crear alerta
    const alert = document.createElement('div');
    alert.className = 'retro-alert';
    
    alert.innerHTML = `
        <div class="retro-alert-message">${message}</div>
        <button class="retro-alert-btn">CONTINUAR</button>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(alert);
    
    // Animación de entrada
    setTimeout(() => {
        alert.style.opacity = '1';
        alert.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
    
    // Botón de cierre
    const closeBtn = alert.querySelector('.retro-alert-btn');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(alert);
    });
    
    // Cerrar al hacer clic en el overlay
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(alert);
    });
}

// Inicializar socket
function initializeSocket() {
    socket = io();
    
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
        
        hostControls.style.display = isHost ? 'flex' : 'none';
        console.log(`¡Ronda ${roundNumber} iniciada!`);
        
        // Ajustar layout después de cambiar a pantalla de juego
        setTimeout(adjustLayoutNoScroll, 100);
    });
    
    socket.on('new-word-changed', (data) => {
        console.log(data.message);
    });
    
    socket.on('player-left', (playerName) => {
        console.log(`${playerName} ha abandonado la sala`);
    });
    
    socket.on('error', (message) => {
        showRetroAlert(message);
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
    // Ajustar layout inicial
    adjustLayoutNoScroll();
    window.addEventListener('resize', handleOrientationChange);

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

    // Ocultar botón de pantalla completa si está en modo PWA
    if (isStandalone()) {
        document.body.classList.add('standalone');
    }

    resetGame();
});

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

function isStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches) || 
           (window.navigator.standalone) || 
           (document.referrer.includes('android-app://'));
}

function toggleFullscreen() {
    if (isIOS()) {
        iosModal.style.display = 'flex';
        return;
    }

    if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('msfullscreenchange', updateFullscreenButton);

function updateFullscreenButton() {
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement) {
        fullscreenBtn.innerHTML = '<span class="fullscreen-icon">⛶</span>';
        fullscreenBtn.title = 'Salir de pantalla completa';
    } else {
        fullscreenBtn.innerHTML = '<span class="fullscreen-icon">⛶</span>';
        fullscreenBtn.title = 'Pantalla completa';
    }
}

// Funciones principales del juego
function showScreen(screenId) {
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
    
    // Ajustar layout después de cambiar de pantalla
    setTimeout(adjustLayoutNoScroll, 100);
}

function createGame() {
    const hostName = document.getElementById('host-name').value.trim();
    if (!hostName) {
        showRetroAlert('POR FAVOR, INGRESA TU NOMBRE');
        return;
    }
    
    if (!socket) initializeSocket();
    socket.emit('create-room', hostName);
}

function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim();
    
    if (!playerName) {
        showRetroAlert('POR FAVOR, INGRESA TU NOMBRE');
        return;
    }
    
    if (!code || code.length !== 4 || isNaN(code)) {
        showRetroAlert('CÓDIGO DE SALA INVÁLIDO<br>DEBE SER 4 DÍGITOS');
        return;
    }
    
    if (!socket) initializeSocket();
    socket.emit('join-room', { roomCode: code, playerName: playerName });
}

function startGame() {
    if (players.length < 2) {
        showRetroAlert('SE NECESITAN AL MENOS<br>2 JUGADORES');
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
    wordDisplay.textContent = 'ESPERANDO PALABRA...';
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

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('ServiceWorker registrado con éxito: ', registration.scope);
            })
            .catch(function(error) {
                console.log('Error registrando ServiceWorker: ', error);
            });
    });
}