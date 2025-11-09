(function() {
  // View management
  const landingPage = document.getElementById('landing-page');
  const whiteboardPage = document.getElementById('whiteboard-page');
  
  function showLandingPage() {
    if (landingPage) landingPage.style.display = 'flex';
    if (whiteboardPage) whiteboardPage.style.display = 'none';
    document.body.className = 'landing-page';
  }
  
  function showWhiteboardPage() {
    if (landingPage) landingPage.style.display = 'none';
    if (whiteboardPage) whiteboardPage.style.display = 'block';
    document.body.className = 'whiteboard-page';
  }
  
  // Check if we should show whiteboard (from URL or direct access)
  const urlParams = new URLSearchParams(window.location.search);
  const roomNameFromUrl = urlParams.get('room');
  
  if (roomNameFromUrl) {
    showWhiteboardPage();
  } else {
    showLandingPage();
  }
  
  const roomName = roomNameFromUrl || 'ROOM1';
  
  const canvasEl = document.getElementById('canvas');
  if (!canvasEl) {
    // Landing page mode - handle room selection
    return;
  }

  const cm = new CanvasManager(canvasEl);
  const roomNameDisplay = document.getElementById('room-name');
  const userNameInput = document.getElementById('user-name-input');
  const addUserBtn = document.getElementById('add-user-btn');
  const activeUserSelect = document.getElementById('active-user-select');
  const colorPicker = document.getElementById('color-picker');
  const sizeSlider = document.getElementById('size-slider');
  const sizeValue = document.getElementById('size-value');
  const brushBtn = document.getElementById('brush-btn');
  const eraserBtn = document.getElementById('eraser-btn');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const clearBtn = document.getElementById('clear-btn');
  const backBtn = document.getElementById('back-btn');
  const connectedCount = document.getElementById('connected-count');
  const tooltip = document.getElementById('tooltip');
  const cursorsContainer = document.getElementById('cursors-container');
  const canvasOverlay = document.getElementById('canvas-overlay');
  const removeUserBtn = document.getElementById('remove-user-btn');

  roomNameDisplay.textContent = roomName;
  
  // Initialize remove button state
  if (removeUserBtn) {
    removeUserBtn.disabled = true;
  }

  const remoteCursors = new Map();
  let lastCursorSent = 0;
  const CURSOR_UPDATE_INTERVAL = 50;

  const localUsers = new Map(); // userId -> {socket, name, color}
  const allUsers = new Map(); // userId -> {name, color} (local + remote)
  let activeUser = null; // {socket, name, color, userId}
  let erasing = false;
  let drawing = false;
  let currentPoints = [];

  function getUniqueName(baseName) {
    const existingNames = new Set();
    
    // Check allUsers map
    allUsers.forEach((user) => {
      if (user.name) {
        existingNames.add(user.name);
      }
    });
    
    // Check localUsers map
    localUsers.forEach((user) => {
      if (user.name) {
        existingNames.add(user.name);
      }
    });
    
    // Check existing dropdown options to prevent duplicates
    Array.from(activeUserSelect.options).forEach((option) => {
      if (option.value && option.textContent) {
        existingNames.add(option.textContent);
      }
    });

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    let newName = baseName + '(' + counter + ')';
    while (existingNames.has(newName)) {
      counter++;
      newName = baseName + '(' + counter + ')';
    }
    return newName;
  }

  function getUserName(userId) {
    if (!userId) return 'User';
    
    // Check localUsers first (most reliable)
    if (localUsers.has(userId)) {
      const user = localUsers.get(userId);
      return user.name || 'User';
    }
    
    // Check allUsers map
    if (allUsers.has(userId)) {
      const user = allUsers.get(userId);
      return user.name || 'User';
    }
    
    // If not found, try to get from dropdown options as fallback
    const option = Array.from(activeUserSelect.options).find(opt => opt.value === userId);
    if (option && option.textContent && option.textContent !== 'Select user...') {
      return option.textContent;
    }
    
    return 'User';
  }

  function cleanupDropdown() {
    // Remove duplicate options from dropdown
    const seen = new Set();
    const options = Array.from(activeUserSelect.options);
    options.forEach((option, index) => {
      if (option.value === '') return; // Keep the "Select user..." option
      
      const key = option.value || option.textContent;
      if (seen.has(key)) {
        // Duplicate found, remove it
        option.remove();
      } else {
        seen.add(key);
      }
    });
  }

  addUserBtn.addEventListener('click', () => {
    const baseName = userNameInput.value.trim();
    if (!baseName) {
      alert('Please enter a name first');
      return;
    }
    
    const uniqueName = getUniqueName(baseName);
    const color = colorPicker.value;
    const userSocket = new WhiteboardSocket(roomName, {
      name: uniqueName,
      color: color,
      welcome: (data) => {
        const userId = data.userId;
        localUsers.set(userId, {
          socket: userSocket,
          name: uniqueName,
          color: color,
          userId: userId
        });
        allUsers.set(userId, {
          name: uniqueName,
          color: color
        });
        
        // Check if option already exists to prevent duplicates
        const existingOption = Array.from(activeUserSelect.options).find(
          opt => opt.value === userId || opt.textContent === uniqueName
        );
        
        if (!existingOption) {
          const option = document.createElement('option');
          option.value = userId;
          option.textContent = uniqueName;
          activeUserSelect.appendChild(option);
        } else {
          // Update existing option if userId matches but name is different
          if (existingOption.value === userId && existingOption.textContent !== uniqueName) {
            existingOption.textContent = uniqueName;
          }
        }
        
        // Clean up any duplicates that might have been created
        cleanupDropdown();
        
        if (!activeUser) {
          activeUserSelect.value = userId;
          selectActiveUser(userId);
        }
        
        // Enable remove button if a user is selected
        if (removeUserBtn) {
          removeUserBtn.disabled = !activeUserSelect.value || activeUserSelect.value === '';
        }
        
        canvasOverlay.classList.add('hidden');
        userNameInput.value = '';
      },
      fullState: (state) => {
        if (cm.history.length === 0) {
          cm.history = state.ops || [];
          cm.redoStack = state.redo || [];
          cm.redraw();
        }
        // Populate allUsers from initial state
        // This includes all users who have drawn on the canvas, even if they're not currently connected
        if (state.users) {
          Object.keys(state.users).forEach((userId) => {
            if (!localUsers.has(userId)) {
              allUsers.set(userId, {
                name: state.users[userId].name || null,
                color: state.users[userId].color || null
              });
            }
          });
        }
        
        // Extract unique userIds from operations to ensure we track all users who have drawn
        // This helps us show names for drawings even if the user has disconnected
        if (state.ops && Array.isArray(state.ops)) {
          const uniqueUserIds = new Set();
          state.ops.forEach((op) => {
            if (op.userId) {
              uniqueUserIds.add(op.userId);
            }
          });
          
          // For any userId in operations that we don't have info for,
          // check if it's in the users list (might be a currently connected user)
          uniqueUserIds.forEach((userId) => {
            if (!allUsers.has(userId) && !localUsers.has(userId)) {
              // Try to find in the users list from state
              if (state.users && state.users[userId]) {
                allUsers.set(userId, {
                  name: state.users[userId].name || null,
                  color: state.users[userId].color || null
                });
              }
            }
          });
        }
      },
      op: (op) => {
        if (!cm.history.find(o => o.id === op.id)) {
          // If we receive an operation from a user we don't know about,
          // we'll get their info from the next users event
          // For now, just apply the operation
          cm.applyOp(op);
          
          // If we don't have this user's info yet, we'll get it from the next users event
          // But we can't do anything here since we don't have the name
        }
      },
      opRemoved: (opId) => {
        cm.removeOpById(opId);
      },
      users: (users) => {
        // Update allUsers map with remote users
        Object.keys(users).forEach((userId) => {
          if (!localUsers.has(userId)) {
            // Store user info with name and color
            allUsers.set(userId, {
              name: users[userId].name || null,
              color: users[userId].color || null
            });
          }
        });
        
        // Also update local users in allUsers if they're in the users list
        Object.keys(users).forEach((userId) => {
          if (localUsers.has(userId)) {
            // Make sure local user info is also in allUsers
            const localUser = localUsers.get(userId);
            allUsers.set(userId, {
              name: localUser.name,
              color: localUser.color
            });
          }
        });
        
        // Remove users that are no longer in the room
        const currentUserIds = new Set(Object.keys(users));
        localUsers.forEach((user, userId) => {
          currentUserIds.add(userId);
        });
        
        allUsers.forEach((user, userId) => {
          if (!currentUserIds.has(userId) && !localUsers.has(userId)) {
            allUsers.delete(userId);
          }
        });
        
        const allUserIds = new Set(Object.keys(users));
        localUsers.forEach((user, userId) => {
          allUserIds.add(userId);
        });
        connectedCount.textContent = `${allUserIds.size} user${allUserIds.size !== 1 ? 's' : ''}`;
        
        const userIds = new Set(Object.keys(users));
        remoteCursors.forEach((cursorEl, userId) => {
          if (!userIds.has(userId) && !localUsers.has(userId)) {
            cursorEl.remove();
            remoteCursors.delete(userId);
          } else {
            // Update cursor label with name
            const label = cursorEl.querySelector('.cursor-label');
            if (label) {
              const userName = getUserName(userId);
              const userIdShort = userId ? userId.slice(0, 8) : 'unknown';
              label.textContent = userName + ':' + userIdShort;
            }
          }
        });
      },
      clear: () => {
        cm.clear();
      },
      cursor: (cursorData) => {
        updateRemoteCursor(cursorData);
      }
    });
  });

  userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addUserBtn.click();
    }
  });

  activeUserSelect.addEventListener('change', (e) => {
    const userId = e.target.value;
    if (userId) {
      selectActiveUser(userId);
    }
    // Enable/disable remove button based on selection
    if (removeUserBtn) {
      removeUserBtn.disabled = !userId || userId === '';
    }
  });

  function selectActiveUser(userId) {
    const user = localUsers.get(userId);
    if (!user) return;
    
    activeUser = user;
    colorPicker.value = user.color;
  }

  function removeUser(userId) {
    if (!userId || !localUsers.has(userId)) return;
    
    const user = localUsers.get(userId);
    
    // Remove all drawings by this user from the canvas (local removal)
    if (cm && cm.history && Array.isArray(cm.history)) {
      // Remove operations from canvas history
      if (typeof cm.removeOpsByUserId === 'function') {
        cm.removeOpsByUserId(userId);
      } else {
        // Fallback: manually filter and redraw
        cm.history = cm.history.filter(o => {
          return o.userId !== userId && o.userId != userId;
        });
        cm.redraw();
      }
    }
    
    // Notify server to remove this user's operations from server state
    // This will also broadcast to all other clients in the room
    if (user.socket && user.socket.socket && user.socket.socket.connected) {
      try {
        user.socket.sendRemoveUserOps(userId);
      } catch (e) {
        // Silently handle error
      }
    }
    
    // Disconnect the socket for this user
    if (user.socket && user.socket.socket) {
      user.socket.disconnect();
    }
    
    // Remove from localUsers
    localUsers.delete(userId);
    
    // Remove from allUsers
    allUsers.delete(userId);
    
    // Remove from dropdown
    const option = Array.from(activeUserSelect.options).find(opt => opt.value === userId);
    if (option) {
      option.remove();
    }
    
    // If this was the active user, select another user or clear
    if (activeUser && activeUser.userId === userId) {
      activeUser = null;
      
      // Try to select the first available user
      const remainingOptions = Array.from(activeUserSelect.options).filter(opt => opt.value && opt.value !== '');
      if (remainingOptions.length > 0) {
        activeUserSelect.value = remainingOptions[0].value;
        selectActiveUser(remainingOptions[0].value);
      } else {
        activeUserSelect.value = '';
        // Show overlay if no users remain
        canvasOverlay.classList.remove('hidden');
      }
    }
    
    // Update remove button state
    if (removeUserBtn) {
      removeUserBtn.disabled = !activeUserSelect.value || activeUserSelect.value === '';
    }
    
    // Update user count
    const allUserIds = new Set();
    localUsers.forEach((user, userId) => {
      allUserIds.add(userId);
    });
    connectedCount.textContent = `${allUserIds.size} user${allUserIds.size !== 1 ? 's' : ''}`;
  }

  if (removeUserBtn) {
    removeUserBtn.addEventListener('click', () => {
      const selectedUserId = activeUserSelect.value;
      if (!selectedUserId || selectedUserId === '') {
        alert('Please select a user to remove');
        return;
      }
      
      const user = localUsers.get(selectedUserId);
      if (!user) {
        alert('User not found');
        return;
      }
      
      if (confirm(`Are you sure you want to remove user "${user.name}"?`)) {
        removeUser(selectedUserId);
      }
    });
  }


  colorPicker.addEventListener('input', (e) => {
    if (activeUser) {
      activeUser.color = e.target.value;
      if (activeUser.socket.socket && activeUser.socket.socket.connected) {
        activeUser.socket.joinRoom(roomName, activeUser.name, activeUser.color);
      }
    }
  });

  sizeSlider.addEventListener('input', (e) => {
    sizeValue.textContent = e.target.value;
  });

  brushBtn.addEventListener('click', () => {
    erasing = false;
    brushBtn.classList.add('active');
    eraserBtn.classList.remove('active');
    canvasEl.style.cursor = 'crosshair';
    canvasEl.classList.remove('eraser-mode');
  });

  eraserBtn.addEventListener('click', () => {
    erasing = true;
    eraserBtn.classList.add('active');
    brushBtn.classList.remove('active');
    canvasEl.style.cursor = 'grab';
    canvasEl.classList.add('eraser-mode');
  });

  undoBtn.addEventListener('click', () => {
    if (!activeUser) return;
    if (activeUser.socket.socket && activeUser.socket.socket.connected) {
      activeUser.socket.sendUndo();
    }
  });

  redoBtn.addEventListener('click', () => {
    if (!activeUser) return;
    if (activeUser.socket.socket && activeUser.socket.socket.connected) {
      activeUser.socket.sendRedo();
    }
  });

  clearBtn.addEventListener('click', () => {
    if (!activeUser) return;
    if (confirm('Are you sure you want to clear the entire whiteboard?')) {
      if (activeUser.socket.socket && activeUser.socket.socket.connected) {
        activeUser.socket.sendClear();
      }
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Navigate back to landing page
      window.location.href = window.location.pathname;
    });
  }

  function getPointerPos(e) {
    const rect = canvasEl.getBoundingClientRect();
    const x = (e.clientX ?? (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY ?? (e.touches && e.touches[0].clientY)) - rect.top;
    return { x, y };
  }

  function generateId() {
    return 'op_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
  }

  function startDraw(e) {
    if (!activeUser) {
      alert('Please add a user first by entering a name and clicking "Add User"');
      return;
    }
    drawing = true;
    currentPoints = [];
    const p = getPointerPos(e);
    currentPoints.push(p);
  }

  function moveDraw(e) {
    const p = getPointerPos(e);
    const rect = canvasEl.getBoundingClientRect();
    
    const now = Date.now();
    if (now - lastCursorSent > CURSOR_UPDATE_INTERVAL) {
      sendCursorPosition(p, rect);
      lastCursorSent = now;
    }
    
    if (!drawing) {
      const hit = cm.hitTest(p.x, p.y, 8);
      if (hit) {
        cm.setHovered(hit.id);
        showTooltipForOp(hit, p);
      } else {
        cm.setHovered(null);
        tooltip.style.display = 'none';
      }
      return;
    }

    currentPoints.push(p);
    
    const previewOp = {
      id: 'preview_' + generateId(),
      userId: activeUser.userId,
      type: erasing ? 'erase' : 'stroke',
      color: activeUser.color,
      size: parseInt(sizeSlider.value),
      points: [...currentPoints]
    };
    
    cm.redraw();
    cm.drawStroke(previewOp);
    throttledSend();
    e.preventDefault();
  }

  function endDraw(e) {
    if (!drawing) return;
    drawing = false;
    
    if (currentPoints.length < 2) {
      currentPoints = [];
      cm.redraw();
      return;
    }

    const op = {
      id: generateId(),
      userId: activeUser.userId,
      type: erasing ? 'erase' : 'stroke',
      color: activeUser.color,
      size: parseInt(sizeSlider.value),
      points: simplifyPoints(currentPoints)
    };

    cm.applyOp(op);
    if (activeUser.socket.socket && activeUser.socket.socket.connected) {
      activeUser.socket.sendOp(op);
    }
    currentPoints = [];
  }

  function simplifyPoints(points) {
    if (points.length <= 50) return points;
    const out = [];
    const step = Math.ceil(points.length / 40);
    for (let i = 0; i < points.length; i += step) {
      out.push(points[i]);
    }
    return out;
  }

  function throttle(fn, wait) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last > wait) {
        last = now;
        fn(...args);
      }
    };
  }

  const throttledSend = throttle(() => {
    if (currentPoints.length >= 2 && activeUser && activeUser.socket.socket && activeUser.socket.socket.connected) {
      const op = {
        id: generateId(),
        userId: activeUser.userId,
        type: erasing ? 'erase' : 'stroke',
        color: activeUser.color,
        size: parseInt(sizeSlider.value),
        points: currentPoints.slice()
      };
      activeUser.socket.sendOp(op);
    }
  }, 80);

  function showTooltipForOp(op, pos) {
    tooltip.style.left = (pos.x + 12) + 'px';
    tooltip.style.top = (pos.y + 12) + 'px';
    const userName = op.userId ? getUserName(op.userId) : 'User';
    const userId = op.userId ? op.userId.slice(0, 8) : 'unknown';
    tooltip.textContent = userName + ':' + userId;
    tooltip.style.display = 'block';
  }

  function sendCursorPosition(pos, rect) {
    if (activeUser && activeUser.socket.socket && activeUser.socket.socket.connected) {
      activeUser.socket.sendCursor({
        x: pos.x / rect.width,
        y: pos.y / rect.height
      });
    }
  }

  function updateRemoteCursor(cursorData) {
    if (!cursorData || !activeUser || cursorData.userId === activeUser.userId) return;
    
    const isLocalUser = localUsers.has(cursorData.userId);
    if (isLocalUser) return;
    
    const rect = canvasEl.getBoundingClientRect();
    const x = cursorData.x * rect.width;
    const y = cursorData.y * rect.height;
    const color = cursorData.color || '#000000';
    
    let cursorEl = remoteCursors.get(cursorData.userId);
    
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.className = 'user-cursor';
      cursorEl.dataset.userId = cursorData.userId;
      
      const dot = document.createElement('div');
      dot.className = 'cursor-dot';
      dot.style.backgroundColor = color;
      cursorEl.appendChild(dot);
      
      const label = document.createElement('div');
      label.className = 'cursor-label';
      const userName = getUserName(cursorData.userId);
      const userId = cursorData.userId ? cursorData.userId.slice(0, 8) : 'unknown';
      label.textContent = userName + ':' + userId;
      cursorEl.appendChild(label);
      
      cursorsContainer.appendChild(cursorEl);
      remoteCursors.set(cursorData.userId, cursorEl);
    }
    
    cursorEl.style.left = x + 'px';
    cursorEl.style.top = y + 'px';
    cursorEl.querySelector('.cursor-dot').style.backgroundColor = color;
    
    // Update cursor label with name
    const label = cursorEl.querySelector('.cursor-label');
    if (label) {
      const userName = getUserName(cursorData.userId);
      const userId = cursorData.userId ? cursorData.userId.slice(0, 8) : 'unknown';
      label.textContent = userName + ':' + userId;
    }
    
    clearTimeout(cursorEl.timeout);
    cursorEl.timeout = setTimeout(() => {
      cursorEl.remove();
      remoteCursors.delete(cursorData.userId);
    }, 2000);
  }

  canvasEl.addEventListener('pointerdown', (e) => {
    canvasEl.setPointerCapture(e.pointerId);
    startDraw(e);
  });
  canvasEl.addEventListener('pointermove', moveDraw);
  window.addEventListener('pointerup', endDraw);

  canvasEl.addEventListener('touchstart', (e) => {
    startDraw(e);
  }, { passive: false });
  canvasEl.addEventListener('touchmove', (e) => {
    moveDraw(e);
  }, { passive: false });
  canvasEl.addEventListener('touchend', (e) => {
    endDraw(e);
  });

})();

(function() {
  const roomCards = document.querySelectorAll('.room-card');
  const customRoomInput = document.getElementById('custom-room-name');
  const createRoomBtn = document.getElementById('create-room-btn');
  
  // View management functions (make them available globally)
  function showLandingPage() {
    const landingPage = document.getElementById('landing-page');
    const whiteboardPage = document.getElementById('whiteboard-page');
    if (landingPage) landingPage.style.display = 'flex';
    if (whiteboardPage) whiteboardPage.style.display = 'none';
    document.body.className = 'landing-page';
  }
  
  function showWhiteboardPage(roomName) {
    const landingPage = document.getElementById('landing-page');
    const whiteboardPage = document.getElementById('whiteboard-page');
    if (landingPage) landingPage.style.display = 'none';
    if (whiteboardPage) whiteboardPage.style.display = 'block';
    document.body.className = 'whiteboard-page';
    
    // Update URL without reload
    window.history.pushState({}, '', `?room=${encodeURIComponent(roomName)}`);
    
    // Reload the page to initialize whiteboard with new room
    window.location.reload();
  }

  if (!roomCards.length) return;

  roomCards.forEach(card => {
    card.addEventListener('click', () => {
      const roomName = card.dataset.room;
      showWhiteboardPage(roomName);
    });
  });

  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
      const roomName = customRoomInput.value.trim();
      if (roomName) {
        showWhiteboardPage(roomName.toUpperCase());
      } else {
        alert('Please enter a room name');
      }
    });

    customRoomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createRoomBtn.click();
      }
    });
  }
})();
