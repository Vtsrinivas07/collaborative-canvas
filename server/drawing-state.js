class DrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    this.ops = [];
    this.redoStack = [];
    this.users = {};
  }

  addUser(userId, info) {
    this.users[userId] = info || {};
  }

  removeUser(userId) {
    delete this.users[userId];
  }

  getUsers() {
    return this.users;
  }

  getUserColor(userId) {
    return (this.users[userId] && this.users[userId].color) || '#000';
  }

  getState() {
    return {
      ops: this.ops,
      redo: this.redoStack,
      users: this.users
    };
  }

  pushOp(op) {
    if (!this.ops.find(o => o.id === op.id)) {
      this.ops.push(op);
      this.redoStack = [];
    }
  }

  undo() {
    const op = this.ops.pop();
    if (op) {
      this.redoStack.push(op);
    }
    return op;
  }

  redo() {
    const op = this.redoStack.pop();
    if (op) {
      this.ops.push(op);
    }
    return op;
  }

  clear() {
    this.ops = [];
    this.redoStack = [];
  }

  removeOpById(opId) {
    this.ops = this.ops.filter(o => o.id !== opId);
  }

  removeOpsByUserId(userId) {
    const removedOps = this.ops.filter(o => o.userId === userId);
    this.ops = this.ops.filter(o => o.userId !== userId);
    this.redoStack = this.redoStack.filter(o => o.userId !== userId);
    return removedOps;
  }
}

module.exports = { DrawingState };
