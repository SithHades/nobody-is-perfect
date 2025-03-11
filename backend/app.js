const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'https://nip.kncklab.com', methods: ['GET', 'POST'] }
});

app.use(express.static('public'));

const PASSWORD = 'Ledi2025';
let users = [];
let currentGameMasterIndex = 0;
let sentences = {};
// Add more specific game states
let gameState = 'waiting'; // 'waiting', 'collecting', 'reviewing', 'completed'
let userSocketMap = {}; // Map usernames to socket IDs

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
    if (data.password === PASSWORD && data.name && !users.includes(data.name)) {
      users.push(data.name);
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
      console.log('Login failed for:', data.name);
      socket.emit('loginFailed', {
        reason: users.includes(data.name) ? 'nameInUse' : 'invalidPassword'
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

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.name);
    if (socket.name) {
      const wasGameMaster = socket.name === users[currentGameMasterIndex];
      const userIndex = users.indexOf(socket.name);
      
      // Remove the user
      users = users.filter(u => u !== socket.name);
      delete userSocketMap[socket.name];
      delete sentences[socket.name];
      
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
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});