const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PASSWORD = 'Ledi2025';
let users = [];
let currentGameMasterIndex = 0;
let sentences = {};
let gameState = 'waiting'; // waiting, playing, stopped

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    if (data.password === PASSWORD && data.name && !users.includes(data.name)) {
      users.push(data.name);
      socket.name = data.name;
      socket.emit('loginSuccess', { users, gameMaster: users[currentGameMasterIndex] });
      io.emit('updateUsers', { users, gameMaster: users[currentGameMasterIndex] });
    } else {
      socket.emit('loginFailed');
    }
  });

  socket.on('submitSentence', (sentence) => {
    if (gameState === 'playing' && socket.name !== users[currentGameMasterIndex]) {
      sentences[socket.name] = sentence;
      io.to(users[currentGameMasterIndex]).emit('newSentence', { name: socket.name, sentence });
    }
  });

  socket.on('stopGame', () => {
    if (socket.name === users[currentGameMasterIndex] && gameState === 'playing') {
      gameState = 'stopped';
      io.emit('gameStopped');
    }
  });

  socket.on('doneGame', () => {
    if (socket.name === users[currentGameMasterIndex] && gameState === 'stopped') {
      currentGameMasterIndex = (currentGameMasterIndex + 1) % users.length;
      sentences = {};
      gameState = 'playing';
      io.emit('newGameMaster', { gameMaster: users[currentGameMasterIndex] });
    }
  });

  socket.on('disconnect', () => {
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