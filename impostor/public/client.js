// Variables globales
let currentScreen = 'main-screen';
let players = [];
let isHost = false;
let roomCode = '';
let currentWord = '';
let impostorIndex = -1;
let roundNumber = 1;
let socket = null;

// Variables para modo local
let localPlayers = [];
let currentLocalPlayerIndex = 0;
let localCurrentWord = '';
let localImpostorIndexes = [];
let localRoundNumber = 1;
let localWords = [];
let localUsedWords = [];

// Configuración
let settings = {
    impostorCount: 1
};

// Elementos DOM
const screens = document.querySelectorAll('.screen');

// ===========================================
// FUNCIONES BÁSICAS DEL JUEGO
// ===========================================

function showScreen(screenId) {
    console.log('🔄 Cambiando a pantalla:', screenId);
    
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenId;
        
        setTimeout(adjustLayout, 100);
        
        // Limpiar inputs al cambiar de pantalla
        if (screenId === 'create-screen') {
            document.getElementById('host-name').value = '';
        } else if (screenId === 'join-screen') {
            document.getElementById('player-name').value = '';
            document.getElementById('room-code-input').value = '';
        } else if (screenId === 'local-setup-screen') {
            document.getElementById('local-player-name').value = '';
            loadSavedPlayers();
        }
    }
}

function adjustLayout() {
    const container = document.querySelector('.container');
    if (container) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - headerHeight - 20;
        container.style.maxHeight = availableHeight + 'px';
    }
}

// ===========================================
// CONFIGURACIÓN
// ===========================================

function loadSettings() {
    const savedSettings = localStorage.getItem('undercover88_settings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        updateImpostorUI();
    }
    console.log('⚙️ Configuración cargada:', settings);
}

function saveSettings() {
    localStorage.setItem('undercover88_settings', JSON.stringify(settings));
    console.log('💾 Configuración guardada:', settings);
    showAlert('✅ Configuración guardada', 1500);
}

function updateImpostorUI() {
    document.getElementById('impostor-count').textContent = settings.impostorCount;
    updateImpostorHint();
    updateButtonStates();
}

function updateImpostorHint() {
    const hint = document.getElementById('impostor-hint');
    const count = settings.impostorCount;
    hint.textContent = `${count} impostor${count > 1 ? 'es' : ''} por partida`;
}

function updateButtonStates() {
    const minusBtn = document.getElementById('minus-btn');
    const plusBtn = document.getElementById('plus-btn');
    
    minusBtn.disabled = settings.impostorCount <= 1;
    plusBtn.disabled = settings.impostorCount >= 3;
}

function showSettings() {
    loadSettings();
    showScreen('settings-screen');
}

function applySettings() {
    saveSettings();
    showScreen('main-screen');
}

// ===========================================
// MODO ONLINE
// ===========================================

function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor');
    });
    
    socket.on('room-created', (code) => {
        roomCode = code;
        document.getElementById('room-code').textContent = code;
        document.getElementById('game-room-code').textContent = code;
        isHost = true;
        showScreen('lobby-screen');
    });
    
    socket.on('joined-room', (data) => {
        roomCode = data.roomCode;
        document.getElementById('room-code').textContent = data.roomCode;
        document.getElementById('game-room-code').textContent = data.roomCode;
        isHost = false;
        
        if (data.impostorCount) {
            showAlert(`🎯 Esta sala tiene ${data.impostorCount} impostor(es) por ronda`, 3000);
        }
        
        showScreen('lobby-screen');
    });
    
    socket.on('players-updated', (playersList) => {
        players = playersList;
        updatePlayerList();
        document.getElementById('players-count').textContent = players.length;
    });
    
    socket.on('round-started', (data) => {
        roundNumber = data.roundNumber;
        currentWord = data.word;
        
        const wordDisplay = document.getElementById('word-display');
        wordDisplay.textContent = currentWord;
        if (data.isImpostor) {
            wordDisplay.classList.add('impostor');
        } else {
            wordDisplay.classList.remove('impostor');
        }
        
        document.getElementById('round-number').textContent = roundNumber;
        updateGamePlayerList(data.players);
        showScreen('game-screen');
        
        document.getElementById('host-controls').style.display = isHost ? 'flex' : 'none';
        
        if (data.impostorCount) {
            showAlert(`🎯 Esta ronda tiene ${data.impostorCount} impostor(es)`, 3000);
        }
    });
    
    socket.on('error', (message) => {
        showAlert(message, 3000);
    });
    
    socket.on('player-left', (message) => {
        showAlert(message, 2000);
    });
    
    socket.on('new-word-changed', (data) => {
        showAlert(data.message, 2000);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor');
        showAlert('🔌 Desconectado del servidor', 2000);
    });
}

function createGame() {
    const hostName = document.getElementById('host-name').value.trim();
    if (!hostName) {
        showAlert('⚠️ Ingresa tu nombre', 2000);
        return;
    }
    
    if (!socket) {
        initializeSocket();
    }
    
    setTimeout(() => {
        if (socket && socket.connected) {
            socket.emit('create-room', { 
                playerName: hostName, 
                impostorCount: settings.impostorCount 
            });
        }
    }, 100);
}

function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim();
    
    if (!playerName) {
        showAlert('⚠️ Ingresa tu nombre', 2000);
        return;
    }
    
    if (!code || code.length !== 4) {
        showAlert('⚠️ Ingresa un código de 4 dígitos', 2000);
        return;
    }
    
    if (!socket) {
        initializeSocket();
    }
    
    setTimeout(() => {
        if (socket && socket.connected) {
            socket.emit('join-room', { roomCode: code, playerName: playerName });
        }
    }, 100);
}

function startGame() {
    if (!isHost || players.length < 2) {
        showAlert('👥 Se necesitan al menos 2 jugadores para comenzar', 2000);
        return;
    }
    if (socket && socket.connected) {
        socket.emit('start-game', roomCode);
    }
}

function requestNewWord() {
    if (!isHost || !socket || !socket.connected) return;
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
    
    const playerList = document.getElementById('player-list');
    const gamePlayerList = document.getElementById('game-player-list');
    const wordDisplay = document.getElementById('word-display');
    
    if (playerList) playerList.innerHTML = '';
    if (gamePlayerList) gamePlayerList.innerHTML = '';
    if (wordDisplay) {
        wordDisplay.textContent = 'ESPERANDO PALABRA...';
        wordDisplay.classList.remove('impostor');
    }
    
    document.getElementById('round-number').textContent = '1';
    document.getElementById('room-code').textContent = '0000';
    document.getElementById('game-room-code').textContent = '0000';
    document.getElementById('players-count').textContent = '0';
    document.getElementById('host-controls').style.display = 'none';
}

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    if (!playerList) return;
    
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
}

function updateGamePlayerList(playersList) {
    const gamePlayerList = document.getElementById('game-player-list');
    if (!gamePlayerList) return;
    
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

// ===========================================
// MODO LOCAL
// ===========================================

function loadLocalWords() {
    console.log('📥 Cargando palabras del servidor...');
    
    fetch('/palabras')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(words => {
            if (words && Array.isArray(words) && words.length > 0) {
                localWords = words;
                console.log(`✅ ${localWords.length} palabras cargadas del servidor`);
            } else {
                throw new Error('No se recibieron palabras válidas');
            }
        })
        .catch(error => {
            console.log('❌ Error cargando palabras del servidor:', error);
            localWords = [
                "Elefante", "Astronauta", "Helicóptero", "Biblioteca", "Chocolate",
                "Montaña", "Telescopio", "Mariposa", "Universo", "Pirámide",
                "Guitarra", "Paraguas", "Canguro", "Volcán", "Arcoíris",
                "Pizza", "Fútbol", "Computadora", "Música", "Viaje"
            ];
            console.log('🔄 Usando palabras por defecto:', localWords.length);
        });
}

function saveLocalPlayers() {
    localStorage.setItem('undercover88_localPlayers', JSON.stringify(localPlayers));
    console.log('💾 Jugadores guardados:', localPlayers);
}

function loadSavedPlayers() {
    const savedPlayers = localStorage.getItem('undercover88_localPlayers');
    if (savedPlayers) {
        localPlayers = JSON.parse(savedPlayers);
        updateLocalPlayerList();
        console.log('📂 Jugadores cargados:', localPlayers);
    }
}

function getLocalRandomWord() {
    if (localWords.length === 0) {
        return "PalabraSecreta";
    }
    
    if (localUsedWords.length > localWords.length * 0.7) {
        localUsedWords = localUsedWords.slice(-10);
    }
    
    let availableWords = localWords.filter(word => !localUsedWords.includes(word));
    
    if (availableWords.length === 0) {
        availableWords = localWords;
        localUsedWords = [];
    }
    
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    localUsedWords.push(randomWord);
    
    console.log(`🔤 Palabra seleccionada: ${randomWord} (${availableWords.length} disponibles)`);
    return randomWord;
}

function addLocalPlayer() {
    const playerNameInput = document.getElementById('local-player-name');
    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        return;
    }

    if (playerName.length > 15) {
        return;
    }

    if (localPlayers.includes(playerName)) {
        return;
    }

    localPlayers.push(playerName);
    playerNameInput.value = '';
    updateLocalPlayerList();
    saveLocalPlayers();
    playerNameInput.focus();
}

function updateLocalPlayerList() {
    const localPlayerList = document.getElementById('local-player-list');
    if (!localPlayerList) return;

    localPlayerList.innerHTML = '';

    localPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <span class="player-name">${player}</span>
            <button class="remove-player-btn" onclick="removeLocalPlayer(${index})">✕</button>
        `;
        localPlayerList.appendChild(li);
    });

    const startLocalGameBtn = document.getElementById('start-local-game-btn');
    if (startLocalGameBtn) {
        startLocalGameBtn.disabled = localPlayers.length < 2;
    }
}

function removeLocalPlayer(index) {
    localPlayers.splice(index, 1);
    updateLocalPlayerList();
    saveLocalPlayers();
}

function startLocalGame() {
    if (localPlayers.length < 2) {
        showAlert('⚠️ Se necesitan al menos 2 jugadores', 2000);
        return;
    }
    
    if (settings.impostorCount >= localPlayers.length) {
        showAlert(`⚠️ Demasiados impostores para ${localPlayers.length} jugadores`, 2000);
        return;
    }

    localUsedWords = [];
    localRoundNumber = 1;
    currentLocalPlayerIndex = 0;
    generateLocalWord();
    showScreen('local-game-screen');
    displayLocalPlayer();
    
    showAlert(`🎯 Esta ronda tiene ${settings.impostorCount} impostor(es)`, 3000);
}

function generateLocalWord() {
    localCurrentWord = getLocalRandomWord();
    localImpostorIndexes = [];
    
    while (localImpostorIndexes.length < settings.impostorCount) {
        const randomIndex = Math.floor(Math.random() * localPlayers.length);
        if (!localImpostorIndexes.includes(randomIndex)) {
            localImpostorIndexes.push(randomIndex);
        }
    }
    
    console.log(`🎮 Ronda ${localRoundNumber} - Palabra: ${localCurrentWord} - Impostores: ${localImpostorIndexes}`);
}

function displayLocalPlayer() {
    document.getElementById('local-round-number').textContent = localRoundNumber;

    document.getElementById('leave-local-game-btn').style.display = 'none';

    if (currentLocalPlayerIndex < localPlayers.length) {
        const playerName = localPlayers[currentLocalPlayerIndex];
        document.getElementById('local-current-player').textContent = playerName;
        document.getElementById('local-word-display').textContent = 'TOCA PARA VER PALABRA';
        document.getElementById('local-word-display').className = 'word-display local-normal';
        document.getElementById('local-word-display').style.cursor = 'pointer';
        document.getElementById('local-word-display').onclick = revealLocalWord;

        document.getElementById('next-player-btn').style.display = 'none';
        document.getElementById('new-word-local-btn').style.display = 'none';
    } else {
        document.getElementById('local-current-player').textContent = 'RONDA TERMINADA';
        document.getElementById('local-word-display').textContent = 'TODOS HAN VISTO SUS PALABRAS';
        document.getElementById('local-word-display').className = 'word-display local-normal';
        document.getElementById('local-word-display').style.cursor = 'default';
        document.getElementById('local-word-display').onclick = null;
        
        document.getElementById('next-player-btn').style.display = 'none';
        document.getElementById('new-word-local-btn').style.display = 'block';
        document.getElementById('leave-local-game-btn').style.display = 'block';
    }
}

function revealLocalWord() {
    const isImpostor = localImpostorIndexes.includes(currentLocalPlayerIndex);
    const word = isImpostor ? "IMPOSTOR" : localCurrentWord;

    const wordDisplay = document.getElementById('local-word-display');
    wordDisplay.textContent = word;
    wordDisplay.className = isImpostor ? 'word-display local-impostor' : 'word-display local-normal';
    wordDisplay.style.cursor = 'default';
    wordDisplay.onclick = null;

    document.getElementById('next-player-btn').style.display = 'block';
}

function nextLocalPlayer() {
    currentLocalPlayerIndex++;
    displayLocalPlayer();
}

function newLocalWord() {
    localRoundNumber++;
    currentLocalPlayerIndex = 0;
    generateLocalWord();
    displayLocalPlayer();
}

function leaveLocalGame() {
    showScreen('local-setup-screen');
}

function resetLocalGame() {
    currentLocalPlayerIndex = 0;
    localCurrentWord = '';
    localImpostorIndexes = [];
    localRoundNumber = 1;
}

// ===========================================
// UTILIDADES
// ===========================================

function showAlert(message, duration = 3000) {
    const existingAlert = document.querySelector('.retro-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = 'retro-alert';
    alert.innerHTML = `
        <div class="retro-alert-message">${message}</div>
        <button class="retro-alert-btn" onclick="this.parentElement.remove()">OK</button>
    `;
    
    document.body.appendChild(alert);
    
    if (duration > 0) {
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, duration);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    overlay.onclick = () => {
        alert.remove();
        overlay.remove();
    };
    document.body.appendChild(overlay);
}

// ===========================================
// DETECCIÓN DE PWA
// ===========================================

function isStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches) ||
           (window.navigator.standalone === true) ||
           (document.referrer.includes('android-app://'));
}

function applyPWAstyles() {
    if (isStandalone()) {
        document.body.classList.add('standalone');
        console.log('📱 Modo PWA detectado - Aplicando estilos especiales');
        
        document.body.offsetHeight;
        
        setTimeout(() => {
            adjustLayout();
            const container = document.querySelector('.container');
            if (container) {
                container.style.height = '100vh';
                container.style.maxHeight = '100vh';
            }
        }, 100);
    }
}

// ===========================================
// PANTALLA COMPLETA
// ===========================================

function toggleFullscreen() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        document.getElementById('ios-fullscreen-modal').style.display = 'flex';
        return;
    }

    if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// ===========================================
// INICIALIZACIÓN
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 UNDERCOVER 88 - Inicializando...');
    
    loadSettings();
    applyPWAstyles();
    loadLocalWords();
    setupEventListeners();
    
    setTimeout(() => {
        adjustLayout();
        if (isStandalone()) {
            const container = document.querySelector('.container');
            if (container) {
                container.style.height = '100vh';
                container.style.maxHeight = '100vh';
            }
        }
    }, 100);
    
    window.addEventListener('resize', adjustLayout);
    
    console.log('✅ Juego inicializado correctamente');
});

function setupEventListeners() {
    // Botón de ajustes
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    
    // Botones de ajuste de impostores
    document.getElementById('minus-btn').addEventListener('click', () => {
        if (settings.impostorCount > 1) {
            settings.impostorCount--;
            updateImpostorUI();
        }
    });
    
    document.getElementById('plus-btn').addEventListener('click', () => {
        if (settings.impostorCount < 3) {
            settings.impostorCount++;
            updateImpostorUI();
        }
    });
    
    // Pantalla de ajustes
    document.getElementById('save-settings-btn').addEventListener('click', applySettings);
    document.getElementById('cancel-settings-btn').addEventListener('click', () => {
        loadSettings();
        showScreen('main-screen');
    });
    
    // Botones principales
    document.getElementById('create-btn').addEventListener('click', () => showScreen('create-screen'));
    document.getElementById('join-btn').addEventListener('click', () => showScreen('join-screen'));
    document.getElementById('local-btn').addEventListener('click', () => showScreen('local-setup-screen'));

    // Pantalla crear partida
    document.getElementById('create-game-btn').addEventListener('click', createGame);
    document.getElementById('back-to-main-1').addEventListener('click', () => showScreen('main-screen'));

    // Pantalla unirse
    document.getElementById('join-game-btn').addEventListener('click', joinGame);
    document.getElementById('back-to-main-2').addEventListener('click', () => showScreen('main-screen'));

    // Pantalla lobby
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);

    // Pantalla juego online
    document.getElementById('new-word-btn').addEventListener('click', requestNewWord);
    document.getElementById('leave-game-btn').addEventListener('click', leaveGame);

    // Pantalla modo local - configuración
    document.getElementById('add-player-btn').addEventListener('click', addLocalPlayer);
    document.getElementById('start-local-game-btn').addEventListener('click', startLocalGame);
    document.getElementById('back-to-main-3').addEventListener('click', () => showScreen('main-screen'));

    // Pantalla juego local
    document.getElementById('next-player-btn').addEventListener('click', nextLocalPlayer);
    document.getElementById('new-word-local-btn').addEventListener('click', newLocalWord);
    document.getElementById('leave-local-game-btn').addEventListener('click', leaveLocalGame);

    // Pantalla completa
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('ios-fullscreen-modal').style.display = 'none';
        });
    }

    // Enter en inputs
    document.getElementById('host-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGame();
    });
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    document.getElementById('local-player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addLocalPlayer();
    });
}

// Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('✅ ServiceWorker registrado');
            })
            .catch(function(error) {
                console.log('❌ Error registrando ServiceWorker:', error);
            });
    });
}