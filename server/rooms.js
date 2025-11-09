const { DrawingState } = require('./drawing-state');

function setupRooms(io) {
  const rooms = new Map();

  return {
    getRoom(id) {
      if (!rooms.has(id)) {
        rooms.set(id, new DrawingState(id));
      }
      return rooms.get(id);
    },
    getAllRooms() {
      return Array.from(rooms.keys());
    }
  };
}

module.exports = { setupRooms };
