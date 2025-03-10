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
let gameState = 'waiting';
let userSocketMap = {}; // Map usernames to socket IDs

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('login', (data) => {
    console.log('Login attempt:', data);
    if (data.password === PASSWORD && data.name && !users.includes(data.name)) {
      users.push(data.name);
      socket.name = data.name;
      userSocketMap[data.name] = socket.id; // Store socket ID
      console.log('Login success for:', data.name);
      
      // Send current game state including sentences to the new user
      socket.emit('loginSuccess', { 
        users, 
        gameMaster: users[currentGameMasterIndex],
        sentences: socket.name === users[currentGameMasterIndex] ? sentences : null
      });
      
      // Update all users about the new player
      io.emit('updateUsers', { 
        users, 
        gameMaster: users[currentGameMasterIndex] 
      });
    } else {
      console.log('Login failed for:', data.name);
      socket.emit('loginFailed');
    }
  });

  socket.on('submitSentence', (sentence) => {
    if (!socket.name) return;
    
    console.log('Sentence submitted:', { name: socket.name, sentence });
    if (socket.name !== users[currentGameMasterIndex]) {
      sentences[socket.name] = sentence;
      
      // Confirm to the player their sentence was received
      socket.emit('sentenceSubmitted');
      
      // Send to the game master
      const gmSocketId = userSocketMap[users[currentGameMasterIndex]];
      if (gmSocketId) {
        console.log('Emitting to GM:', users[currentGameMasterIndex], 'Socket ID:', gmSocketId);
        io.to(gmSocketId).emit('newSentence', { name: socket.name, sentence });
      } else {
        console.error('Game master socket ID not found:', users[currentGameMasterIndex]);
      }
    }
  });

  socket.on('stopGame', () => {
    console.log('Stop game requested by:', socket.name);
    if (socket.name === users[currentGameMasterIndex]) {
      gameState = 'stopped';
      io.emit('gameStopped');
    }
  });

  socket.on('doneGame', () => {
    console.log('Done game requested by:', socket.name);
    if (socket.name === users[currentGameMasterIndex]) {
      currentGameMasterIndex = (currentGameMasterIndex + 1) % users.length;
      sentences = {};
      gameState = 'playing';
      io.emit('newGameMaster', { 
        users,
        gameMaster: users[currentGameMasterIndex] 
      });
    }
  });

  socket.on('resetGame', () => {
    console.log('Game reset requested by:', socket.name);
    users = [];
    sentences = {};
    userSocketMap = {};
    currentGameMasterIndex = 0;
    gameState = 'waiting';
    io.emit('gameReset');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.name);
    if (socket.name) {
      const wasGameMaster = socket.name === users[currentGameMasterIndex];
      users = users.filter(u => u !== socket.name);
      delete userSocketMap[socket.name];
      delete sentences[socket.name];
      
      if (users.length > 0) {
        // If the game master disconnected, choose a new one
        if (wasGameMaster || currentGameMasterIndex >= users.length) {
          currentGameMasterIndex = currentGameMasterIndex % users.length;
        }
        
        io.emit('updateUsers', { 
          users, 
          gameMaster: users[currentGameMasterIndex],
          sentences: wasGameMaster ? sentences : null
        });
      } else {
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