class WhiteboardSocket {
  constructor(roomName, onEvents) {
    this.roomName = roomName;
    this.socket = io();
    this.userId = null;
    this.onEvents = onEvents || {};
    this._bind();
  }

  _bind() {
    this.socket.on('connect', () => {
      this.userId = this.socket.id;
      this.socket.emit('join-room', { 
        room: this.roomName, 
        name: this.onEvents.name || '', 
        color: this.onEvents.color || '#ff0000' 
      });
      if (this.onEvents.connect) this.onEvents.connect();
    });

    this.socket.on('welcome', (data) => {
      this.userId = data.userId;
      if (this.onEvents.welcome) this.onEvents.welcome(data);
    });

    this.socket.on('full-state', (state) => {
      if (this.onEvents.fullState) this.onEvents.fullState(state);
    });

    this.socket.on('op', (op) => {
      if (this.onEvents.op) this.onEvents.op(op);
    });

    this.socket.on('op-removed', (opId) => {
      if (this.onEvents.opRemoved) this.onEvents.opRemoved(opId);
    });

    this.socket.on('users', (users) => {
      if (this.onEvents.users) this.onEvents.users(users);
    });

    this.socket.on('cursor', (cursorData) => {
      if (this.onEvents.cursor) this.onEvents.cursor(cursorData);
    });

    this.socket.on('clear', () => {
      if (this.onEvents.clear) this.onEvents.clear();
    });

    this.socket.on('disconnect', () => {
      if (this.onEvents.disconnect) this.onEvents.disconnect();
    });
  }

  joinRoom(roomName, name, color) {
    this.roomName = roomName;
    this.socket.emit('join-room', { room: roomName, name, color });
  }

  sendOp(op) {
    this.socket.emit('op', { room: this.roomName, op });
  }

  sendUndo() {
    this.socket.emit('undo', { room: this.roomName });
  }

  sendRedo() {
    this.socket.emit('redo', { room: this.roomName });
  }

  sendClear() {
    this.socket.emit('clear', { room: this.roomName });
  }

  sendCursor(cursor) {
    this.socket.emit('cursor', cursor);
  }

  sendRemoveUserOps(userId) {
    this.socket.emit('remove-user-ops', { userId });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

window.WhiteboardSocket = WhiteboardSocket;
