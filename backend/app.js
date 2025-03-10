const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://nip.kncklab.com', // Frontend domain
    methods: ['GET', 'POST']
  }
});

app.use(express.static('public'));

const PASSWORD = 'Ledi2025';
let users = [];
let currentGameMasterIndex = 0;
let sentences = {};
let gameState = 'waiting'; // waiting, playing, stopped

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id); // Debug log

  socket.on('login', (data) => {
    console.log('Login attempt:', data); // Debug log
    if (data.password === PASSWORD && data.name && !users.includes(data.name)) {
      users.push(data.name);
      socket.name = data.name;
      console.log('Login success for:', data.name); // Debug log
      socket.emit('loginSuccess', { users, gameMaster: users[currentGameMasterIndex] });
      io.emit('updateUsers', { users, gameMaster: users[currentGameMasterIndex] });
    } else {
      console.log('Login failed for:', data.name); // Debug log
      socket.emit('loginFailed');
    }
  });

  socket.on('submitSentence', (sentence) => {
    console.log('Sentence submitted:', { name: socket.name, sentence });
    if (gameState === 'playing' && socket.name !== users[currentGameMasterIndex]) {
      sentences[socket.name] = sentence;
      io.to(users[currentGameMasterIndex]).emit('newSentence', { name: socket.name, sentence });
    }
  });

  socket.on('stopGame', () => {
    console.log('Stop game requested by:', socket.name); // Debug log
    if (socket.name === users[currentGameMasterIndex] && gameState === 'playing') {
      gameState = 'stopped';
      io.emit('gameStopped');
    }
  });

  socket.on('doneGame', () => {
    console.log('Done game requested by:', socket.name); // Debug log
    if (socket.name === users[currentGameMasterIndex] && gameState === 'stopped') {
      currentGameMasterIndex = (currentGameMasterIndex + 1) % users.length;
      sentences = {};
      gameState = 'playing';
      io.emit('newGameMaster', { gameMaster: users[currentGameMasterIndex] });
    }
  });

  socket.on('resetGame', () => {
    console.log('Game reset requested by:', socket.name);
    users = [];
    sentences = {};
    currentGameMasterIndex = 0;
    gameState = 'waiting';
    io.emit('gameReset');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.name); // Debug log
    if (socket.name) {
      users = users.filter(u => u !== socket.name);
      if (users.length > 0) {
        currentGameMasterIndex = currentGameMasterIndex % users.length;
        io.emit('updateUsers', { users, gameMaster: users[currentGameMasterIndex] });
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