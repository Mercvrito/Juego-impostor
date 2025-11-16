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

app.get('/favicon-32x32.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/favicon-16x16.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/apple-touch-icon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/apple-touch-icon-precomposed.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/android-chrome-192x192.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/android-chrome-512x512.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// ✅ RUTAS ADICIONALES PARA SEO Y FAVICONS
app.get('/browserconfig.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'public', 'browserconfig.xml'));
});

// Servir diferentes tamaños de favicon (puedes usar el mismo si no tienes diferentes tamaños)
app.get('/mstile-70x70.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/mstile-150x150.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/mstile-310x310.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/mstile-310x150.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// ✅ RUTA PARA OBTENER PALABRAS (PARA MODO LOCAL)
app.get('/palabras', (req, res) => {
    try {
        const palabras = cargarPalabras();
        res.json(palabras);
    } catch (error) {
        console.log('❌ Error enviando palabras:', error);
        res.json([]);
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

app.get('/icon-192.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/icon-512.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// ✅ Ruta de fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cargar palabras desde el archivo
function cargarPalabras() {
    try {
        const contenido = fs.readFileSync('sustantivos_unicos_esp.txt', 'utf8');
        const palabras = contenido.split('\n')
            .map(palabra => palabra.trim())
            .filter(palabra => palabra.length > 0)
            .filter(palabra => palabra.length >= 3 && palabra.length <= 20)
            .slice(0, 2000); // Limitar a 2000 palabras para modo local
        
        console.log(`✅ Cargadas ${palabras.length} palabras del diccionario`);
        return palabras;
    } catch (error) {
        console.log('❌ Error cargando palabras, usando lista por defecto');
        return [
            "Elefante", "Astronauta", "Helicóptero", "Biblioteca", "Chocolate",
            "Montaña", "Telescopio", "Mariposa", "Universo", "Pirámide",
            "Guitarra", "Paraguas", "Canguro", "Volcán", "Arcoíris",
            "Pizza", "Fútbol", "Computadora", "Música", "Viaje"
        ];
    }
}

const words = cargarPalabras();
const rooms = new Map();

// Generar código de sala único
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('✅ Usuario conectado:', socket.id);

    // Crear nueva sala
    socket.on('create-room', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true
            }],
            currentWord: null,
            impostorIndex: -1,
            roundNumber: 0,
            isGameActive: false
        };
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        
        socket.emit('room-created', roomCode);
        io.to(roomCode).emit('players-updated', room.players);
        
        console.log(`🎮 Sala creada: ${roomCode} por ${playerName}`);
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
        socket.emit('joined-room', roomCode);
        
        console.log(`👤 ${playerName} se unió a la sala ${roomCode}`);
    });

    // Iniciar partida
    socket.on('start-game', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && room.players.length >= 2) {
            room.isGameActive = true;
            startNewRound(room);
            console.log(`🎯 Partida iniciada en sala ${roomCode}`);
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

    // Función para iniciar nueva ronda
    function startNewRound(room) {
        room.currentWord = words[Math.floor(Math.random() * words.length)];
        room.impostorIndex = Math.floor(Math.random() * room.players.length);
        room.roundNumber++;
        
        console.log(`🔄 Ronda ${room.roundNumber} - Palabra: ${room.currentWord} - Impostor: ${room.impostorIndex}`);
        
        room.players.forEach((player, index) => {
            const isImpostor = index === room.impostorIndex;
            const word = isImpostor ? "IMPOSTOR" : room.currentWord;
            
            io.to(player.id).emit('round-started', {
                roundNumber: room.roundNumber,
                word: word,
                isImpostor: isImpostor,
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