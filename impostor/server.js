const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Configuración de Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ RUTAS PARA FAVICON Y ICONOS PWA
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// ✅ RUTA PARA OBTENER PALABRAS (MEJORADA)
app.get('/palabras', (req, res) => {
    try {
        const palabras = cargarPalabras();
        console.log(`📚 Enviando ${palabras.length} palabras al cliente`);
        res.json(palabras);
    } catch (error) {
        console.log('❌ Error enviando palabras:', error);
        // En caso de error, enviar palabras por defecto
        const palabrasPorDefecto = [
            "Elefante", "Astronauta", "Helicóptero", "Biblioteca", "Chocolate",
            "Montaña", "Telescopio", "Mariposa", "Universo", "Pirámide",
            "Guitarra", "Paraguas", "Canguro", "Volcán", "Arcoíris"
        ];
        res.json(palabrasPorDefecto);
    }
});

// ✅ RUTAS PARA PWA
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

// ✅ Ruta de fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cargar palabras desde el archivo (FUNCIÓN MEJORADA)
function cargarPalabras() {
    try {
        const contenido = fs.readFileSync('sustantivos_unicos_esp.txt', 'utf8');
        const palabras = contenido.split('\n')
            .map(palabra => palabra.trim())
            .filter(palabra => palabra.length > 0)
            .filter(palabra => {
                // Filtrar palabras adecuadas para el juego
                const longitud = palabra.length;
                return longitud >= 3 && longitud <= 20 && 
                       !palabra.includes(' ') && // Excluir frases
                       !palabra.includes('/') && // Excluir paths
                       !palabra.includes('\\'); // Excluir paths
            })
            .slice(0, 5000); // Limitar a 5000 palabras para mejor rendimiento
        
        console.log(`✅ Cargadas ${palabras.length} palabras del diccionario`);
        return palabras;
    } catch (error) {
        console.log('❌ Error cargando palabras, usando lista por defecto');
        return [
            "Elefante", "Astronauta", "Helicóptero", "Biblioteca", "Chocolate",
            "Montaña", "Telescopio", "Mariposa", "Universo", "Pirámide",
            "Guitarra", "Paraguas", "Canguro", "Volcán", "Arcoíris"
        ];
    }
}

const words = cargarPalabras();
const rooms = new Map();

// Sistema para evitar repeticiones de palabras
const usedWords = new Map(); // roomCode -> Set de palabras usadas

// Generar código de sala único
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

// Obtener palabra aleatoria que no se haya usado en la sala
function getRandomWord(roomCode) {
    const used = usedWords.get(roomCode) || new Set();
    
    // Si se han usado muchas palabras, limpiar algunas para evitar memoria infinita
    if (used.size > words.length * 0.8) {
        // Mantener solo las últimas 10 palabras usadas
        const arrayUsed = Array.from(used);
        used.clear();
        arrayUsed.slice(-10).forEach(word => used.add(word));
    }
    
    // Buscar una palabra no usada
    let availableWords = words.filter(word => !used.has(word));
    
    // Si no hay palabras disponibles, reiniciar el conjunto de usadas
    if (availableWords.length === 0) {
        used.clear();
        availableWords = words;
    }
    
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    used.add(randomWord);
    usedWords.set(roomCode, used);
    
    return randomWord;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('✅ Usuario conectado:', socket.id);

    // Crear nueva sala con configuración
    socket.on('create-room', (data) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            players: [{
                id: socket.id,
                name: data.playerName,
                isHost: true
            }],
            currentWord: null,
            impostorIndexes: [],
            impostorCount: data.impostorCount || 1, // Usar configuración del host
            roundNumber: 0,
            isGameActive: false
        };
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        
        socket.emit('room-created', roomCode);
        io.to(roomCode).emit('players-updated', room.players);
        
        console.log(`🎮 Sala creada: ${roomCode} por ${data.playerName} (${room.impostorCount} impostor(es))`);
    });

    // Unirse a sala existente
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', '❌ Sala no encontrada');
            return;
        }
        
        if (room.isGameActive) {
            socket.emit('error', '🚫 La partida ya ha comenzado');
            return;
        }
        
        // Verificar nombre duplicado
        if (room.players.some(player => player.name === playerName)) {
            socket.emit('error', '⚠️ Ya existe un jugador con ese nombre');
            return;
        }
        
        room.players.push({
            id: socket.id,
            name: playerName,
            isHost: false
        });
        
        socket.join(roomCode);
        io.to(roomCode).emit('players-updated', room.players);
        
        // Enviar configuración de la sala al jugador que se une
        socket.emit('joined-room', { 
            roomCode: roomCode,
            impostorCount: room.impostorCount
        });
        
        console.log(`👤 ${playerName} se unió a la sala ${roomCode} (${room.impostorCount} impostor(es))`);
    });

    // Iniciar partida
    socket.on('start-game', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && room.players.length >= 2) {
            // Verificar que haya suficientes jugadores para los impostores configurados
            if (room.impostorCount >= room.players.length) {
                socket.emit('error', `⚠️ Demasiados impostores para ${room.players.length} jugadores`);
                return;
            }
            
            room.isGameActive = true;
            startNewRound(room);
            console.log(`🎯 Partida iniciada en sala ${roomCode} (${room.impostorCount} impostor(es))`);
        } else {
            socket.emit('error', '👥 Se necesitan al menos 2 jugadores para comenzar');
        }
    });

    // SOLO EL HOST puede cambiar la palabra
    socket.on('request-new-word', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.isHost) {
                startNewRound(room);
                io.to(roomCode).emit('new-word-changed', { 
                    message: '🔄 El host ha cambiado la palabra',
                    roundNumber: room.roundNumber 
                });
                console.log(`🔤 Nueva palabra en sala ${roomCode}`);
            } else {
                socket.emit('error', '👑 Solo el host puede cambiar la palabra');
            }
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('❌ Usuario desconectado:', socket.id);
        
        for (let [roomCode, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                    usedWords.delete(roomCode); // Limpiar palabras usadas
                    console.log(`🗑️ Sala ${roomCode} eliminada por estar vacía`);
                } else {
                    // Asignar nuevo host si el anterior se fue
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                        io.to(roomCode).emit('players-updated', room.players);
                        io.to(roomCode).emit('new-word-changed', {
                            message: `👑 ${room.players[0].name} es ahora el host`,
                            roundNumber: room.roundNumber
                        });
                    }
                    
                    io.to(roomCode).emit('players-updated', room.players);
                    io.to(roomCode).emit('player-left', `${playerName} ha abandonado la sala`);
                }
                break;
            }
        }
    });

    // Función para iniciar nueva ronda con múltiples impostores
    function startNewRound(room) {
        room.currentWord = getRandomWord(room.code);
        room.impostorIndexes = [];
        
        // Seleccionar múltiples impostores únicos
        while (room.impostorIndexes.length < room.impostorCount) {
            const randomIndex = Math.floor(Math.random() * room.players.length);
            if (!room.impostorIndexes.includes(randomIndex)) {
                room.impostorIndexes.push(randomIndex);
            }
        }
        
        room.roundNumber++;
        
        console.log(`🔄 Ronda ${room.roundNumber} - Palabra: ${room.currentWord} - Impostores: ${room.impostorIndexes.join(', ')}`);
        
        room.players.forEach((player, index) => {
            const isImpostor = room.impostorIndexes.includes(index);
            const word = isImpostor ? "IMPOSTOR" : room.currentWord;
            
            io.to(player.id).emit('round-started', {
                roundNumber: room.roundNumber,
                word: word,
                isImpostor: isImpostor,
                impostorCount: room.impostorCount, // Enviar número de impostores
                players: room.players.map(p => ({
                    name: p.name,
                    isHost: p.isHost
                }))
            });
        });
    }
});

// Puerto para Railway
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
    console.log(`📚 Diccionario cargado: ${words.length} palabras disponibles`);
    console.log(`🔤 Modo local habilitado: /palabras`);
    console.log(`📱 PWA habilitada: /manifest.json`);
    console.log(`⚙️ Service Worker: /service-worker.js`);
    console.log(`🎯 Favicon disponible: /favicon.png`);
    console.log(`📁 Archivos estáticos en: ${path.join(__dirname, 'public')}`);
});