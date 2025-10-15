const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Configuración para producción
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

// Cargar palabras desde el archivo
function cargarPalabras() {
    try {
        const contenido = fs.readFileSync('sustantivos_unicos_esp.txt', 'utf8');
        const palabras = contenido.split('\n')
            .map(palabra => palabra.trim())
            .filter(palabra => palabra.length > 0)
            .filter(palabra => palabra.length >= 3 && palabra.length <= 12)
            .filter(palabra => !palabra.includes('aje') && !palabra.includes('ción') && !palabra.includes('ología'))
            .slice(0, 3000);
        
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

// Datos del juego
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
    console.log('Usuario conectado:', socket.id);

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
        
        console.log(`Sala creada: ${roomCode} por ${playerName}`);
    });

    // Unirse a sala existente
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', 'Sala no encontrada');
            return;
        }
        
        if (room.isGameActive) {
            socket.emit('error', 'La partida ya ha comenzado');
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
        
        console.log(`${playerName} se unió a la sala ${roomCode}`);
    });

    // Iniciar partida
    socket.on('start-game', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && room.players.length >= 2) {
            room.isGameActive = true;
            startNewRound(room);
        } else {
            socket.emit('error', 'Se necesitan al menos 2 jugadores para comenzar');
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
                    message: 'El host ha cambiado la palabra',
                    roundNumber: room.roundNumber 
                });
            } else {
                socket.emit('error', 'Solo el host puede cambiar la palabra');
            }
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        
        for (let [roomCode, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                    console.log(`Sala ${roomCode} eliminada por estar vacía`);
                } else {
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }
                    
                    io.to(roomCode).emit('players-updated', room.players);
                    io.to(roomCode).emit('player-left', playerName);
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
        
        console.log(`Ronda ${room.roundNumber} - Palabra: ${room.currentWord} - Impostor: ${room.impostorIndex}`);
        
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

// PUERTO PARA RAILWAY (IMPORTANTE)
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
    console.log(`📚 Diccionario cargado: ${words.length} palabras disponibles`);
});