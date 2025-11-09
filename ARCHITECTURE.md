# Architecture Documentation

## Overview

This is a real-time collaborative whiteboard application. Multiple users can draw on the same canvas simultaneously, and all changes are synchronized in real-time using WebSockets.

## Data Flow Diagram

### How Drawing Events Flow from User to Canvas

```
User draws on canvas (mouse/touch)
    ↓
Client captures drawing points
    ↓
Local preview shown immediately (for instant feedback)
    ↓
Drawing operation created (with unique ID)
    ↓
Sent to server via WebSocket
    ↓
Server stores operation in room state
    ↓
Server broadcasts to all other clients in the room
    ↓
Other clients receive operation
    ↓
Operation applied to their canvas
    ↓
All users see the same drawing
```

**Key Point**: The user who draws sees their drawing immediately (local preview), while others see it after it's broadcast from the server. This makes the app feel fast and responsive.

## WebSocket Protocol

### Messages Sent from Client to Server

**`join-room`** - When a user joins a room
```javascript
{
  room: "ROOM1",        // Room name
  name: "Alice",        // User's name
  color: "#ff0000"      // User's color
}
```

**`op`** - When a user draws something
```javascript
{
  room: "ROOM1",
  op: {
    id: "op_abc123",           // Unique operation ID
    userId: "socket_id_123",    // Who drew it
    type: "stroke",             // "stroke" or "erase"
    color: "#ff0000",           // Color
    size: 5,                    // Brush size
    points: [{x: 10, y: 20}, {x: 15, y: 25}, ...]  // Drawing points
  }
}
```

**`undo`** - Request to undo last operation
```javascript
{
  room: "ROOM1"
}
```

**`redo`** - Request to redo last undone operation
```javascript
{
  room: "ROOM1"
}
```

**`clear`** - Request to clear entire canvas
```javascript
{
  room: "ROOM1"
}
```

**`cursor`** - Send cursor position (updated frequently)
```javascript
{
  x: 0.5,    // X position (0-1, normalized)
  y: 0.3     // Y position (0-1, normalized)
}
```

**`remove-user-ops`** - Remove all drawings by a specific user
```javascript
{
  userId: "socket_id_123"
}
```

### Messages Sent from Server to Client

**`welcome`** - Sent when user successfully joins
```javascript
{
  userId: "socket_id_123"  // Your unique user ID
}
```

**`full-state`** - Complete canvas state when joining
```javascript
{
  ops: [...],        // All drawing operations
  redo: [...],       // Redo stack
  users: {...}       // All users in room
}
```

**`op`** - A drawing operation from another user
```javascript
{
  id: "op_abc123",
  userId: "socket_id_456",
  type: "stroke",
  color: "#00ff00",
  size: 5,
  points: [...]
}
```

**`op-removed`** - An operation was removed (undo)
```javascript
"op_abc123"  // Just the operation ID
```

**`users`** - Updated list of users in room
```javascript
{
  "socket_id_123": { name: "Alice", color: "#ff0000" },
  "socket_id_456": { name: "Bob", color: "#00ff00" }
}
```

**`clear`** - Canvas was cleared
(no data, just the event)

**`cursor`** - Another user's cursor position
```javascript
{
  userId: "socket_id_456",
  x: 0.5,
  y: 0.3,
  color: "#00ff00"
}
```

## Undo/Redo Strategy

### How Global Undo/Redo Works

The server keeps track of all operations in a list (like a stack). When someone clicks undo:

1. **Server removes** the last operation from the list
2. **Server moves it** to a "redo stack" (so it can be redone)
3. **Server broadcasts** "op-removed" to everyone with the operation ID
4. **All clients remove** that operation from their canvas
5. **Canvas redraws** without that operation

When someone clicks redo:
1. **Server takes** the last operation from the redo stack
2. **Server adds it back** to the main operations list
3. **Server broadcasts** the operation to everyone
4. **All clients add** it back to their canvas

### Important Points

- **Server is the boss**: The server decides what gets undone/redone, not the clients
- **Global operations**: Undo affects everyone, not just the person who clicked it
- **Simple approach**: Last operation in = first operation out (like a stack)
- **Redo gets cleared**: If someone draws after an undo, the redo stack is cleared (can't redo anymore)

## Performance Decisions

### 1. Client-Side Preview (Local Drawing)
**What**: Show drawing immediately on the user's screen before server confirms
**Why**: Makes the app feel instant and responsive
**Trade-off**: Very rarely, if the server rejects it, there might be a tiny visual glitch (almost never happens)

### 2. Throttling (Slowing Down Updates)
**What**: Don't send every single mouse movement to the server
**Why**: Reduces network traffic and server load
**How**: 
- Drawing operations: Send every 80ms (not every millisecond)
- Cursor positions: Send every 50ms
**Trade-off**: Slight delay in updates, but users don't notice

### 3. Point Simplification
**What**: If a stroke has more than 50 points, reduce it to about 40 points
**Why**: Smaller data = faster transmission = better performance
**How**: Take every Nth point instead of all points
**Trade-off**: Very slight visual quality loss, but barely noticeable

### 4. Full Canvas Redraw
**What**: When something changes, redraw the entire canvas from scratch
**Why**: Simpler and more reliable than trying to update just parts
**Alternative considered**: Incremental updates (only redraw what changed)
**Decision**: Full redraw is simpler and works well for typical use cases

### 5. Cursor Cleanup
**What**: Remove cursor indicators after 2 seconds of no movement
**Why**: Prevents showing cursors for users who disconnected
**Trade-off**: Cursors disappear if user is idle (acceptable behavior)

### 6. Operation Deduplication
**What**: Check if we already have an operation before adding it
**Why**: Prevents duplicate drawings from network retries or glitches
**How**: Compare operation IDs before applying

## Conflict Resolution

### How We Handle Simultaneous Drawing

**No conflicts needed!** Here's why:

1. **Server is authoritative**: The server decides the order of operations
2. **Operations are independent**: Each drawing is a separate operation with a unique ID
3. **Layering by time**: Later operations just draw on top of earlier ones (like layers)
4. **Deduplication**: If the same operation arrives twice, we ignore the duplicate

### Specific Scenarios

**Two users draw at the same time:**
- Both operations get unique IDs
- Server receives them in some order
- Both are broadcast to everyone
- Everyone sees both drawings (one on top of the other)

**Two users undo at the same time:**
- Server processes them one at a time
- First undo removes the last operation
- Second undo removes the next-to-last operation
- Everyone sees both undos happen

**Network delay:**
- User sees their drawing immediately (local preview)
- Other users see it when it arrives from server
- Eventually everyone sees the same thing (eventual consistency)

**Erasing over someone's drawing:**
- Erase operations use special canvas mode that removes pixels
- Works regardless of what layer the drawing is on
- No conflicts, just removes the pixels

### State Synchronization

**When a new user joins:**
- Server sends them the complete canvas state (`full-state` event)
- They see everything that was drawn before they joined
- After that, they get incremental updates like everyone else

**If someone disconnects:**
- Their cursor disappears
- Their drawings stay (unless explicitly removed)
- They're removed from the user list
