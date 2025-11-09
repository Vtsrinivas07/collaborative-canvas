# Collaborative Whiteboard

A real-time collaborative drawing application where multiple users can draw together on the same canvas. Built with Node.js, Express, Socket.io, and vanilla JavaScript.

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   - Navigate to `http://localhost:3000`
   - You'll see the room selection page

That's it! The application should be running.

## How to Test with Multiple Users

### Method 1: Multiple Browser Windows (Easiest)
1. Start the server: `npm start`
2. Open `http://localhost:3000` in your first browser window
3. Select a room (e.g., ROOM1)
4. Enter a name (e.g., "Alice") and click "Add User"
5. Open another browser window/tab
6. Go to `http://localhost:3000` again
7. Select the **SAME room** (ROOM1)
8. Enter a different name (e.g., "Bob") and click "Add User"
9. Now both users can draw and see each other's drawings in real-time!

### Method 2: Different Devices (Same Network)
1. Find your computer's IP address:
   - Windows: Run `ipconfig` in Command Prompt (look for IPv4 Address)
   - Mac/Linux: Run `ifconfig` or `ip addr` in Terminal
2. Start server: `npm start`
3. On your computer: Open `http://localhost:3000`
4. On another device: Open `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
5. Both devices join the same room and start collaborating!

### Method 3: Incognito/Private Window
1. Open normal browser window → Join room as "User1"
2. Open incognito/private window → Join same room as "User2"
3. Test real-time collaboration!

## Known Limitations & Bugs

1. **No Data Persistence**: All drawings are stored in memory only. If the server restarts, all drawings are lost.

2. **Global Undo/Redo**: When you undo, it removes the last operation from anyone (not just yours). There's no per-user undo.

3. **No User Authentication**: Anyone can join any room with any name. There's no login system or user verification.

4. **Hit Detection**: When hovering over drawings to see who created them, the detection might not be perfect for very complex curves.

5. **Browser Requirements**: Needs a modern browser with Canvas and WebSocket support (Chrome, Firefox, Safari, Edge).

6. **Network Required**: Needs a stable internet connection. If the connection drops, drawings won't sync.

7. **Name Duplicates**: If multiple users have the same name, the system automatically adds numbers (e.g., "John", "John(1)", "John(2)").

## Time Spent on Project

- **Initial Setup & Project Structure**: 2 hours
- **Core Drawing Logic (Canvas Management)**: 4 hours
- **WebSocket Integration & Real-time Sync**: 3 hours
- **Multi-Room Support**: 2 hours
- **Cursor Tracking & User Management**: 2 hours
- **UI/UX Polish & Styling**: 3 hours
- **Testing & Bug Fixes**: 1 hour
- **Documentation**: 1 hour

**Total Time**: ~18 hours

## Features

- **Real-time Drawing**: See other users' strokes as they draw
- **Multiple Rooms**: Create or join different rooms
- **User Management**: Add/remove users, see active users
- **Drawing Tools**: Brush, eraser, color picker, size slider
- **Undo/Redo**: Global undo/redo for all users
- **Cursor Tracking**: See where other users are drawing
- **Touch Support**: Works on mobile devices

## Troubleshooting

**Server won't start?**
- Make sure port 3000 is not already in use
- Check that Node.js is installed: `node --version`
- Try running `npm install` again

**Drawings not syncing?**
- Check browser console for errors (F12)
- Make sure all users are in the same room
- Verify the server is running (should see "Server listening on 3000")

**Cursors not showing?**
- Cursors only appear when users are actively moving their mouse
- They disappear after 2 seconds of inactivity
- Make sure WebSocket connection is active
