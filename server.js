const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let gameData = { categories: [], rooms: {} };

io.on('connection', (socket) => {
    console.log('✅ جهاز متصل');

    socket.emit('sync-data', gameData.categories);

    socket.on('update-categories', (categories) => {
        gameData.categories = categories;
        socket.broadcast.emit('sync-data', categories);
    });

    socket.on('create-room', (callback) => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        gameData.rooms[code] = { players: [socket.id], created: Date.now() };
        socket.join(code);
        callback({ success: true, roomCode: code });
    });

    socket.on('join-room', (code, callback) => {
        const room = gameData.rooms[code];
        if (!room) return callback({ success: false, error: 'الغرفة غير موجودة' });
        if (room.players.length >= 2) return callback({ success: false, error: 'الغرفة ممتلئة' });
        room.players.push(socket.id);
        socket.join(code);
        callback({ success: true });
        io.to(code).emit('player-joined');
    });

    socket.on('share-characters', (code, chars) => {
        socket.to(code).emit('characters-shared', chars);
    });

    socket.on('game-update', (code, data) => {
        socket.to(code).emit('game-update', data);
    });

    socket.on('disconnect', () => {
        Object.keys(gameData.rooms).forEach(code => {
            if (gameData.rooms[code]) {
                gameData.rooms[code].players = gameData.rooms[code].players.filter(id => id !== socket.id);
                if (gameData.rooms[code].players.length === 0) delete gameData.rooms[code];
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('🎮 السيرفر شغال على المنفذ ' + PORT);
});
