const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'https://nip.kncklab.com', methods: ['GET', 'POST'] },
  // Increase ping timeout to 5 minutes (300000ms) to handle mobile devices with screen off
  pingTimeout: 300000,
  pingInterval: 25000,
  // Disable automatic disconnection on connection errors
  connectTimeout: 60000
});

app.use(express.static('public'));

const PASSWORD = 'Ledi2025';
let users = [];
let currentGameMasterIndex = 0;
let sentences = {};
// Add more specific game states
let gameState = 'waiting'; // 'waiting', 'collecting', 'reviewing', 'completed'
let userSocketMap = {}; // Map usernames to socket IDs
let disconnectedUsers = {}; // Store info about temporarily disconnected users
let inactiveTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to broadcast game state to all connected clients
function broadcastGameState() {
  io.emit('gameStateUpdate', {
    gameState: gameState,
    users: users,
    gameMaster: users[currentGameMasterIndex] || null
  });
}

// Helper function to send sentences to game master
function updateGameMaster() {
  const gmSocketId = userSocketMap[users[currentGameMasterIndex]];
  if (gmSocketId) {
    io.to(gmSocketId).emit('masterUpdate', {
      gameState: gameState,
      sentences: sentences
    });
  }
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send current game state to new connection
  socket.emit('initialState', {
    gameState: gameState
  });

  socket.on('login', (data) => {
    console.log('Login attempt:', data);
    
    // Check if this is a user who was temporarily disconnected
    const isReturningUser = disconnectedUsers[data.name] !== undefined;

    if (data.password === PASSWORD && data.name) {
      if (!users.includes(data.name) || isReturningUser) {
        // If this is a returning user, remove them from disconnected users
        if (isReturningUser) {
          console.log('Reconnection for previously disconnected user:', data.name);
          clearTimeout(disconnectedUsers[data.name].timeoutId);
          delete disconnectedUsers[data.name];
        } else {
          // If they're a completely new user, add them to the list
          users.push(data.name);
        }
        
        socket.name = data.name;
        userSocketMap[data.name] = socket.id; // Store socket ID
        console.log('Login success for:', data.name);
        
        // Send current game state including sentences to the new user
        socket.emit('loginSuccess', { 
          users: users, 
          gameMaster: users[currentGameMasterIndex],
          gameState: gameState
        });
        
        // Update all users about the new player
        broadcastGameState();
        
        // If this user is the game master, send them the sentences
        if (socket.name === users[currentGameMasterIndex]) {
          updateGameMaster();
        }
      } else {
        console.log('Login failed for:', data.name, '- name already in use');
        socket.emit('loginFailed', {
          reason: 'nameInUse'
        });
      }
    } else {
      console.log('Login failed for:', data.name, '- invalid password');
      socket.emit('loginFailed', {
        reason: 'invalidPassword'
      });
    }
  });
  
  // Handle reconnection requests
  socket.on('reconnect', (data) => {
    console.log('Reconnection attempt:', data);
    if (data.password === PASSWORD && data.name) {
      // Check if this user was previously disconnected
      if (disconnectedUsers[data.name]) {
        // Clear the timeout that would remove them
        clearTimeout(disconnectedUsers[data.name].timeoutId);
        delete disconnectedUsers[data.name];
        
        // If they're not in the users list, add them back
        if (!users.includes(data.name)) {
          users.push(data.name);
        }
        
        // Update socket information
        socket.name = data.name;
        userSocketMap[data.name] = socket.id;
        
        console.log('Reconnection successful for:', data.name);
        
        // Send success response
        socket.emit('loginSuccess', { 
          users: users, 
          gameMaster: users[currentGameMasterIndex],
          gameState: gameState
        });
        
        // Update all users
        broadcastGameState();
        
        // If they're the game master, update them with sentences
        if (socket.name === users[currentGameMasterIndex]) {
          updateGameMaster();
        }
      } 
      // If they weren't disconnected but are a valid user
      else if (users.includes(data.name)) {
        socket.name = data.name;
        userSocketMap[data.name] = socket.id;
        
        console.log('Reconnection (socket update) for existing user:', data.name);
        
        // Send success response
        socket.emit('loginSuccess', { 
          users: users, 
          gameMaster: users[currentGameMasterIndex],
          gameState: gameState
        });
        
        // If they're the game master, update them with sentences
        if (socket.name === users[currentGameMasterIndex]) {
          updateGameMaster();
        }
      } 
      // If they weren't disconnected and are not in the users list (rare case)
      else {
        // Treat this as a new login
        users.push(data.name);
        socket.name = data.name;
        userSocketMap[data.name] = socket.id;
        
        console.log('Reconnection treated as new login for:', data.name);
        
        socket.emit('loginSuccess', { 
          users: users, 
          gameMaster: users[currentGameMasterIndex],
          gameState: gameState
        });
        
        broadcastGameState();
      }
    } else {
      console.log('Reconnection failed due to invalid credentials');
      socket.emit('loginFailed', {
        reason: 'invalidPassword'
      });
    }
  });

  socket.on('submitSentence', (sentence) => {
    if (!socket.name) return;
    
    // Only accept sentences if the game is in the collecting state
    if (gameState !== 'collecting') {
      socket.emit('submissionRejected', { reason: 'gameNotCollecting' });
      return;
    }
    
    console.log('Sentence submitted:', { name: socket.name, sentence });
    
    // Players can't be the game master
    if (socket.name !== users[currentGameMasterIndex]) {
      sentences[socket.name] = sentence;
      
      // Confirm to the player their sentence was received
      socket.emit('sentenceSubmitted');
      
      // Update the game master with the new sentence
      const gmSocketId = userSocketMap[users[currentGameMasterIndex]];
      if (gmSocketId) {
        console.log('Emitting to GM:', users[currentGameMasterIndex], 'Socket ID:', gmSocketId);
        io.to(gmSocketId).emit('newSentence', { name: socket.name, sentence });
      } else {
        console.error('Game master socket ID not found:', users[currentGameMasterIndex]);
      }
    }
  });

  socket.on('startCollecting', () => {
    console.log('Start collecting requested by:', socket.name);
    if (socket.name !== users[currentGameMasterIndex]) return;
    
    // Clear previous sentences and start collecting new ones
    sentences = {};
    gameState = 'collecting';
    
    // Notify all clients
    broadcastGameState();
  });

  socket.on('stopGame', () => {
    console.log('Stop game requested by:', socket.name);
    if (socket.name !== users[currentGameMasterIndex]) return;
    
    // Change state to reviewing - players can no longer submit
    gameState = 'reviewing';
    
    // Notify all clients
    broadcastGameState();
  });

  socket.on('doneGame', () => {
    console.log('Done game requested by:', socket.name);
    if (socket.name !== users[currentGameMasterIndex]) return;
    
    // Change game master to next player
    currentGameMasterIndex = (currentGameMasterIndex + 1) % users.length;
    
    // Mark round as completed
    gameState = 'completed';

    // Reset sentences
    sentences = {}
    
    // Notify all clients about the new game master
    broadcastGameState();
    
    // Update the new game master with a clean slate
    updateGameMaster();
  });

  socket.on('resetGame', () => {
    console.log('Game reset requested by:', socket.name);
    if (socket.name !== users[currentGameMasterIndex]) return;
    
    users = [];
    sentences = {};
    userSocketMap = {};
    currentGameMasterIndex = 0;
    gameState = 'waiting';
    
    // Notify all clients about the reset
    io.emit('gameReset');
  });

  // Handle keepAlive pings from clients
  socket.on('keepAlive', (data) => {
    if (data.name && socket.name === data.name) {
      // If this user was in the disconnected list, remove them
      if (disconnectedUsers[data.name]) {
        clearTimeout(disconnectedUsers[data.name].timeoutId);
        delete disconnectedUsers[data.name];
        console.log('Keep-alive received from user:', data.name);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.name);
    if (socket.name) {
      const username = socket.name;
      const wasGameMaster = username === users[currentGameMasterIndex];
      const userIndex = users.indexOf(username);
      
      // Don't immediately remove the user; put them in disconnected status
      // and set a timeout to remove them if they don't reconnect
      const timeoutId = setTimeout(() => {
        console.log('User timed out after disconnection:', username);
        
        // Now actually remove the user
        users = users.filter(u => u !== username);
        delete userSocketMap[username];
        delete sentences[username];
        delete disconnectedUsers[username];
        
        if (users.length > 0) {
          // If the game master disconnected, choose a new one
          if (wasGameMaster) {
            // Keep the same relative position in the rotation
            currentGameMasterIndex = currentGameMasterIndex % users.length;
            // If we were in the middle of a game, set to completed state
            if (gameState === 'collecting' || gameState === 'reviewing') {
              gameState = 'completed';
            }
            
            // Update the new game master
            updateGameMaster();
          } else if (userIndex < currentGameMasterIndex) {
            // If a user before the GM in the list left, adjust the index
            currentGameMasterIndex--;
          }
          
          // Broadcast updated user list and game state
          broadcastGameState();
        } else {
          // No users left, reset game
          currentGameMasterIndex = 0;
          sentences = {};
          gameState = 'waiting';
        }
      }, inactiveTimeout);
      
      // Store the disconnected user
      disconnectedUsers[username] = {
        timeoutId,
        wasGameMaster,
        userIndex,
        disconnectedAt: Date.now()
      };
      
      // Only update the socket mapping
      delete userSocketMap[username];
      
      // Broadcast that someone temporarily disconnected, but don't remove them yet
      // This helps other users know someone might be reconnecting
      io.emit('userTemporarilyDisconnected', {
        username,
        message: `${username} temporär getrennt...`
      });
    }
  });
});

// Set up a heartbeat to periodically update all clients
// This ensures clients have the latest state even if they missed updates
const heartbeatInterval = setInterval(() => {
  if (Object.keys(userSocketMap).length > 0) {
    broadcastGameState();
  }
}, 60000); // Every minute

server.listen(3000, () => {
  console.log('Server running on port 3000');
});