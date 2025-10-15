const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map();
const words = [
  "Elefante", "Astronauta", "Helicoptero", "Biblioteca", "Chocolate",
  "Montana", "Telescopio", "Mariposa", "Universo", "Piramide"
];

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

  console.log('Usuario conectado:', socket.id);

    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      players: [{
        id: socket.id,
        name: playerName,
        isHost: true
      }],
      isGameActive: false
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
    io.to(roomCode).emit('players-updated', room.players);
  });

    const { roomCode, playerName } = data;
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', 'Sala no encontrada');
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
  });

    const room = rooms.get(roomCode);
    if (room 
      room.isGameActive = true;
      const word = words[Math.floor(Math.random() * words.length)];
      const impostorIndex = Math.floor(Math.random() * room.players.length);
        const isImpostor = index === impostorIndex;
        io.to(player.id).emit('round-started', {
          word: isImpostor ? "IMPOSTOR" : word,
          isImpostor: isImpostor,
          players: room.players
        });
      });
    }
  });
});

const PORT = 3001;
  console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
});
