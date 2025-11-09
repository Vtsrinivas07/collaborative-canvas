// Express + Socket.io server with multi-room support
const express = require('express');
const http = require('http');
const { setupRooms } = require('./rooms');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(express.static('client'));

const rooms = setupRooms(io);

io.on('connection', socket => {
  const userId = socket.id;
  let currentRoom = null;

  socket.on('join-room', (data) => {
    const roomId = data.room || 'ROOM1';
    
    if (currentRoom) {
      socket.leave(currentRoom);
      const prevRoom = rooms.getRoom(currentRoom);
      prevRoom.removeUser(userId);
      io.to(currentRoom).emit('users', prevRoom.getUsers());
    }

    currentRoom = roomId;
    socket.join(roomId);
    
    const room = rooms.getRoom(roomId);
    room.addUser(userId, {
      name: data.name || null,
      color: data.color || randomColor()
    });

    socket.emit('welcome', { userId });
    socket.emit('full-state', room.getState());
    io.to(roomId).emit('users', room.getUsers());
  });

  socket.on('op', (data) => {
    if (!data || !data.op || !data.op.id) return;
    if (!currentRoom) return;
    
    const room = rooms.getRoom(currentRoom);
    room.pushOp(data.op);
    socket.broadcast.to(currentRoom).emit('op', data.op);
  });

  socket.on('undo', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    const removed = room.undo();
    if (removed) {
      io.to(currentRoom).emit('op-removed', removed.id);
    }
    io.to(currentRoom).emit('users', room.getUsers());
  });

  socket.on('redo', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    const op = room.redo();
    if (op) {
      io.to(currentRoom).emit('op', op);
    }
  });

  socket.on('clear', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    room.clear();
    io.to(currentRoom).emit('clear');
    io.to(currentRoom).emit('users', room.getUsers());
  });

  socket.on('cursor', (c) => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    c.userId = userId;
    c.color = room.getUserColor(userId);
    socket.broadcast.to(currentRoom).emit('cursor', c);
  });

  socket.on('remove-user-ops', (data) => {
    if (!currentRoom) return;
    const targetUserId = data.userId;
    if (!targetUserId) return;
    
    const room = rooms.getRoom(currentRoom);
    const removedOps = room.removeOpsByUserId(targetUserId);
    
    // Broadcast removal of each operation to all clients
    removedOps.forEach(op => {
      io.to(currentRoom).emit('op-removed', op.id);
    });
    
    // Update users list
    io.to(currentRoom).emit('users', room.getUsers());
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const room = rooms.getRoom(currentRoom);
      room.removeUser(userId);
      io.to(currentRoom).emit('users', room.getUsers());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));

function randomColor() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}
