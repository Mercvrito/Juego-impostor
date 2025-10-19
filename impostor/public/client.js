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
    document.body.classList.add('orientation-change');
    clearTimeout(orientationTimer);
    orientationTimer = setTimeout(() => {
        adjustLayoutNoScroll();
        document.body.classList.remove('orientation-change');
    }, 300);
}

// Función mejorada para ajustar el layout - TODO en una pantalla
function adjustLayoutNoScroll() {
    const container = document.querySelector('.container');
    const currentScreen = document.querySelector('.screen.active');
    
    if (container && currentScreen) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - headerHeight - 15;
        
        container.style.maxHeight = availableHeight + 'px';
        container.style.height = availableHeight + 'px';
        
        const playerList = currentScreen.querySelector('.player-list');
        if (playerList) {
            let availableListHeight;
            
            if (currentScreen.id === 'lobby-screen') {
                const lobbyHeader = currentScreen.querySelector('.lobby-header');
                const h3 = currentScreen.querySelector('h3');
                const btnContainer = currentScreen.querySelector('.btn-container');
                
                const usedHeight = lobbyHeader.offsetHeight + h3.offsetHeight + 
                                 btnContainer.offsetHeight + 40;
                availableListHeight = availableHeight - usedHeight;
            } else if (currentScreen.id === 'game-screen') {
                const gameHeader = currentScreen.querySelector('.game-header');
                const wordDisplay = currentScreen.querySelector('.word-display');
                const h3 = currentScreen.querySelector('h3');
                const hostControls = currentScreen.querySelector('#host-controls');
                const btnContainer = currentScreen.querySelector('.btn-container');
                
                let usedHeight = gameHeader.offsetHeight + wordDisplay.offsetHeight + 
                               h3.offsetHeight + btnContainer.offsetHeight + 30;
                
                if (hostControls.style.display !== 'none') {
                    usedHeight += hostControls.offsetHeight;
                }
                
                availableListHeight = availableHeight - usedHeight;
            } else {
                availableListHeight = Math.min(120, availableHeight * 0.3);
            }
            
            playerList.style.maxHeight = Math.max(60, availableListHeight) + 'px';
            playerList.style.minHeight = '60px';
        }
    }
}

// Detectar cambios de orientación
window.addEventListener('orientationchange', handleOrientationChange);
window.addEventListener('resize', handleOrientationChange);

// Sistema de notificaciones retro
function showRetroAlert(message, isError = true) {
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    
    const alert = document.createElement('div');
    alert.className = 'retro-alert';
    
    alert.innerHTML = `
        <div class="retro-alert-message">${message}</div>
        <button class="retro-alert-btn">CONTINUAR</button>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.style.opacity = '1';
        alert.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
    
    const closeBtn = alert.querySelector('.retro-alert-btn');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(alert);
    });
    
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(alert);
    });
}

// Inicializar socket
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor');
    });
    
    socket.on('room-created', (code) => {
        roomCode = code;
        roomCodeDisplay.textContent = code;
        gameRoomCodeDisplay.textContent = code;
        isHost = true;
        showScreen('lobby-screen');
        console.log('🎮 Sala creada exitosamente:', code);
        
        setTimeout(adjustLayoutNoScroll, 100);
    });
    
    socket.on('joined-room', (code) => {
        roomCode = code;
        roomCodeDisplay.textContent = code;
        gameRoomCodeDisplay.textContent = code;
        isHost = false;
        showScreen('lobby-screen');
        console.log('👤 Te has unido a la sala:', code);
        
        setTimeout(adjustLayoutNoScroll, 100);
    });
    
    socket.on('players-updated', (playersList) => {
        players = playersList;
        updatePlayerList();
        playersCountDisplay.textContent = players.length;
        console.log('📊 Jugadores actualizados:', players.length);
        
        setTimeout(adjustLayoutNoScroll, 50);
    });
    
    socket.on('round-started', (data) => {
        roundNumber = data.roundNumber;
        currentWord = data.word;
        
        wordDisplay.textContent = currentWord;
        if (data.isImpostor) {
            wordDisplay.classList.add('impostor');
            console.log('🕵️ Eres el IMPOSTOR!');
        } else {
            wordDisplay.classList.remove('impostor');
            console.log('🎯 Tu palabra es:', currentWord);
        }
        
        roundNumberDisplay.textContent = roundNumber;
        updateGamePlayerList(data.players);
        showScreen('game-screen');
        
        hostControls.style.display = isHost ? 'flex' : 'none';
        console.log(`🔄 Ronda ${roundNumber} iniciada!`);
        
        setTimeout(adjustLayoutNoScroll, 100);
    });
    
    socket.on('new-word-changed', (data) => {
        console.log('🔤 Nueva palabra:', data.message);
        showRetroAlert('🔄 PALABRA CAMBIADA<br>RONDA ' + data.roundNumber, false);
    });
    
    socket.on('player-left', (playerName) => {
        console.log('🚪 Jugador abandonó:', playerName);
        showRetroAlert(`🚪 ${playerName}<br>HA ABANDONADO LA SALA`, false);
    });
    
    socket.on('error', (message) => {
        console.log('❌ Error del servidor:', message);
        showRetroAlert(message);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor');
        showRetroAlert('🔌 DESCONECTADO DEL SERVIDOR<br>RECONECTANDO...');
        setTimeout(() => {
            location.reload();
        }, 3000);
    });
}

// Event Listeners del DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 UNDERCOVER 88 - Inicializando...');
    
    // Ajustar layout inicial
    setTimeout(adjustLayoutNoScroll, 100);
    window.addEventListener('resize', handleOrientationChange);

    // ===========================================
    // BOTONES PRINCIPALES - CORREGIDOS
    // ===========================================
    
    // Botones de pantalla principal
    const createBtn = document.getElementById('create-btn');
    const joinBtn = document.getElementById('join-btn');
    
    if (createBtn) {
        createBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎮 Botón CREAR PARTIDA clickeado');
            showScreen('create-screen');
        });
    } else {
        console.error('❌ Botón crear-btn no encontrado');
    }
    
    if (joinBtn) {
        joinBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔗 Botón UNIRSE A PARTIDA clickeado');
            showScreen('join-screen');
        });
    } else {
        console.error('❌ Botón join-btn no encontrado');
    }

    // Botones de crear/unirse
    const createGameBtn = document.getElementById('create-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    
    if (createGameBtn) {
        createGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔄 Botón CREAR SALA clickeado');
            createGame();
        });
    } else {
        console.error('❌ Botón create-game-btn no encontrado');
    }
    
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔗 Botón UNIRSE clickeado');
            joinGame();
        });
    } else {
        console.error('❌ Botón join-game-btn no encontrado');
    }

    // Botones de juego
    const startGameBtn = document.getElementById('start-game-btn');
    const newWordBtn = document.getElementById('new-word-btn');
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎯 Botón INICIAR PARTIDA clickeado');
            startGame();
        });
    } else {
        console.error('❌ Botón start-game-btn no encontrado');
    }
    
    if (newWordBtn) {
        newWordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔤 Botón NUEVA PALABRA clickeado');
            requestNewWord();
        });
    } else {
        console.error('❌ Botón new-word-btn no encontrado');
    }

    // Botones de navegación
    const backToMain1 = document.getElementById('back-to-main-btn-1');
    const backToMain2 = document.getElementById('back-to-main-btn-2');
    const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
    const leaveGameBtn = document.getElementById('leave-game-btn');
    
    if (backToMain1) {
        backToMain1.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔙 Botón VOLVER 1 clickeado');
            showScreen('main-screen');
        });
    }
    
    if (backToMain2) {
        backToMain2.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔙 Botón VOLVER 2 clickeado');
            showScreen('main-screen');
        });
    }
    
    if (leaveLobbyBtn) {
        leaveLobbyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚪 Botón SALIR del lobby clickeado');
            leaveLobby();
        });
    }
    
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚪 Botón ABANDONAR PARTIDA clickeado');
            leaveGame();
        });
    }

    // Pantalla completa
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📱 Botón PANTALLA COMPLETA clickeado');
            toggleFullscreen();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('❌ Botón CERRAR MODAL clickeado');
            iosModal.style.display = 'none';
        });
    }

    // Permitir enviar formularios con Enter
    const hostNameInput = document.getElementById('host-name');
    const playerNameInput = document.getElementById('player-name');
    const roomCodeInput = document.getElementById('room-code-input');
    
    if (hostNameInput) {
        hostNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('↵ Enter en nombre de host');
                createGame();
            }
        });
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('↵ Enter en nombre de jugador');
                joinGame();
            }
        });
    }
    
    if (roomCodeInput) {
        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('↵ Enter en código de sala');
                joinGame();
            }
        });
    }

    // Ocultar botón de pantalla completa si está en modo PWA
    if (isStandalone()) {
        document.body.classList.add('standalone');
        console.log('📱 Modo PWA detectado');
    }

    resetGame();
    console.log('✅ Todos los event listeners configurados');
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
    console.log('🔄 Cambiando a pantalla:', screenId);
    
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenId;
        
        // Ajustar layout después de cambiar de pantalla
        setTimeout(adjustLayoutNoScroll, 100);
        
        // Limpiar inputs al cambiar de pantalla
        if (screenId === 'create-screen') {
            document.getElementById('host-name').value = '';
            setTimeout(() => {
                document.getElementById('host-name').focus();
            }, 300);
        } else if (screenId === 'join-screen') {
            document.getElementById('player-name').value = '';
            document.getElementById('room-code-input').value = '';
            setTimeout(() => {
                document.getElementById('player-name').focus();
            }, 300);
        }
        
        console.log('✅ Pantalla cambiada a:', screenId);
    } else {
        console.error('❌ Pantalla no encontrada:', screenId);
    }
}

function createGame() {
    const hostName = document.getElementById('host-name').value.trim();
    console.log('🎮 Intentando crear juego con nombre:', hostName);
    
    if (!hostName) {
        console.log('❌ Nombre vacío');
        showRetroAlert('POR FAVOR, INGRESA TU NOMBRE');
        return;
    }
    
    if (hostName.length > 15) {
        console.log('❌ Nombre demasiado largo');
        showRetroAlert('NOMBRE DEMASIADO LARGO<br>MÁXIMO 15 CARACTERES');
        return;
    }
    
    console.log('✅ Nombre válido, creando sala...');
    
    if (!socket) {
        console.log('🔌 Inicializando socket...');
        initializeSocket();
    }
    
    // Pequeño delay para asegurar que el socket esté listo
    setTimeout(() => {
        if (socket && socket.connected) {
            socket.emit('create-room', hostName);
            console.log('📤 Emitido create-room con nombre:', hostName);
        } else {
            console.error('❌ Socket no conectado');
            showRetroAlert('ERROR DE CONEXIÓN<br>INTENTA DE NUEVO');
        }
    }, 100);
}

function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim();
    
    console.log('🔗 Intentando unirse a sala:', code, 'con nombre:', playerName);
    
    if (!playerName) {
        console.log('❌ Nombre vacío');
        showRetroAlert('POR FAVOR, INGRESA TU NOMBRE');
        return;
    }
    
    if (playerName.length > 15) {
        console.log('❌ Nombre demasiado largo');
        showRetroAlert('NOMBRE DEMASIADO LARGO<br>MÁXIMO 15 CARACTERES');
        return;
    }
    
    if (!code || code.length !== 4 || isNaN(code)) {
        console.log('❌ Código inválido:', code);
        showRetroAlert('CÓDIGO DE SALA INVÁLIDO<br>DEBE SER 4 DÍGITOS');
        return;
    }
    
    console.log('✅ Datos válidos, uniéndose a sala...');
    
    if (!socket) {
        console.log('🔌 Inicializando socket...');
        initializeSocket();
    }
    
    // Pequeño delay para asegurar que el socket esté listo
    setTimeout(() => {
        if (socket && socket.connected) {
            socket.emit('join-room', { roomCode: code, playerName: playerName });
            console.log('📤 Emitido join-room con código:', code, 'y nombre:', playerName);
        } else {
            console.error('❌ Socket no conectado');
            showRetroAlert('ERROR DE CONEXIÓN<br>INTENTA DE NUEVO');
        }
    }, 100);
}

function startGame() {
    console.log('🎯 Intentando iniciar partida en sala:', roomCode);
    
    if (players.length < 2) {
        console.log('❌ Jugadores insuficientes:', players.length);
        showRetroAlert('SE NECESITAN AL MENOS<br>2 JUGADORES');
        return;
    }
    
    if (!socket || !socket.connected) {
        console.error('❌ Socket no conectado');
        showRetroAlert('ERROR DE CONEXIÓN');
        return;
    }
    
    console.log('✅ Iniciando partida...');
    socket.emit('start-game', roomCode);
}

function requestNewWord() {
    console.log('🔤 Solicitando nueva palabra en sala:', roomCode);
    
    if (!socket || !socket.connected) {
        console.error('❌ Socket no conectado');
        showRetroAlert('ERROR DE CONEXIÓN');
        return;
    }
    
    if (!isHost) {
        console.log('❌ No eres el host');
        showRetroAlert('SOLO EL HOST PUEDE<br>CAMBIAR LA PALABRA');
        return;
    }
    
    console.log('✅ Solicitando nueva palabra...');
    socket.emit('request-new-word', roomCode);
}

function leaveLobby() {
    console.log('🚪 Saliendo del lobby...');
    
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('🔌 Socket desconectado');
    }
    
    showScreen('main-screen');
    resetGame();
}

function leaveGame() {
    console.log('🚪 Abandonando partida...');
    
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('🔌 Socket desconectado');
    }
    
    showScreen('main-screen');
    resetGame();
}

function resetGame() {
    console.log('🔄 Reiniciando juego...');
    
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
    
    // Limpiar inputs
    document.getElementById('host-name').value = '';
    document.getElementById('player-name').value = '';
    document.getElementById('room-code-input').value = '';
    
    console.log('✅ Juego reiniciado');
}

function updatePlayerList() {
    console.log('📊 Actualizando lista de jugadores:', players.length);
    
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
        if (startBtn.disabled) {
            startBtn.title = 'Se necesitan al menos 2 jugadores';
            startBtn.style.opacity = '0.6';
        } else {
            startBtn.title = 'Iniciar partida';
            startBtn.style.opacity = '1';
        }
    }
    
    setTimeout(adjustLayoutNoScroll, 50);
}

function updateGamePlayerList(playersList) {
    console.log('🎮 Actualizando lista de juego:', playersList.length);
    
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
    
    setTimeout(adjustLayoutNoScroll, 50);
}

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('✅ ServiceWorker registrado:', registration.scope);
            })
            .catch(function(error) {
                console.log('❌ Error registrando ServiceWorker:', error);
            });
    });
}

// Prevenir acciones no deseadas en móviles
document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    if (e.target.classList.contains('retro-btn')) {
        e.preventDefault();
    }
}, { passive: false });

// Manejar el evento antes de que la página se descargue
window.addEventListener('beforeunload', function(e) {
    if (socket && socket.connected) {
        socket.disconnect();
        console.log('🔌 Socket desconectado antes de abandonar la página');
    }
});

// Inicialización final cuando todo está cargado
window.addEventListener('load', function() {
    console.log('🎉 UNDERCOVER 88 - Juego completamente cargado');
    
    // Ajuste final del layout
    setTimeout(adjustLayoutNoScroll, 200);
    
    // Forzar un reflow para asegurar que todo se renderice correctamente
    document.body.offsetHeight;
    
    console.log('✅ Todo listo para jugar!');
});

// Debug: Verificar que todos los elementos existen
console.log('🔍 Verificando elementos DOM:');
console.log('- create-btn:', document.getElementById('create-btn') ? '✅' : '❌');
console.log('- join-btn:', document.getElementById('join-btn') ? '✅' : '❌');
console.log('- create-game-btn:', document.getElementById('create-game-btn') ? '✅' : '❌');
console.log('- join-game-btn:', document.getElementById('join-game-btn') ? '✅' : '❌');
console.log('- start-game-btn:', document.getElementById('start-game-btn') ? '✅' : '❌');
console.log('- new-word-btn:', document.getElementById('new-word-btn') ? '✅' : '❌');