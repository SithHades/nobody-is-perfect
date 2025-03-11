// Connect to the server
const socket = io('https://nip-backend.kncklab.com');

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('name');
const passwordInput = document.getElementById('password');
const playerNameDisplay = document.getElementById('playerName');
const gameMasterView = document.getElementById('gameMasterView');
const playerView = document.getElementById('playerView');
const playersList = document.getElementById('playersList');
const sentenceForm = document.getElementById('sentenceForm');
const sentenceInput = document.getElementById('sentence');
const sentenceSubmitted = document.getElementById('sentenceSubmitted');
const sentencesList = document.getElementById('sentencesList');
const waitingMessage = document.getElementById('waitingMessage');
const notification = document.getElementById('notification');
const gameStatusDisplay = document.getElementById('gameStatusDisplay');
const gameStateIndicator = document.getElementById('gameStateIndicator');

// Game Master Controls
const startCollectingBtn = document.getElementById('startCollectingBtn');
const stopGameBtn = document.getElementById('stopGameBtn');
const doneGameBtn = document.getElementById('doneGameBtn');
const resetGameBtn = document.getElementById('resetGameBtn');

// Game state variables
let currentUser = '';
let isGameMaster = false;
let gameState = 'waiting';
let users = [];
let currentGameMaster = '';

// Initialize UI based on current game state
function updateUIForGameState() {
    // Update game state indicator
    gameStateIndicator.textContent = gameState.charAt(0).toUpperCase() + gameState.slice(1);
    
    // Update color of game state indicator
    switch(gameState) {
        case 'waiting':
            gameStateIndicator.className = 'ml-auto text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700';
            break;
        case 'collecting':
            gameStateIndicator.className = 'ml-auto text-xs px-2 py-1 rounded-full bg-green-200 text-green-800';
            break;
        case 'reviewing':
            gameStateIndicator.className = 'ml-auto text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-800';
            break;
        case 'completed':
            gameStateIndicator.className = 'ml-auto text-xs px-2 py-1 rounded-full bg-blue-200 text-blue-800';
            break;
    }
    
    // Update game status message
    if (isGameMaster) {
        switch(gameState) {
            case 'waiting':
                gameStatusDisplay.textContent = 'Game is waiting to start. Click "Start Round" to begin.';
                break;
            case 'collecting':
                gameStatusDisplay.textContent = 'Players are submitting sentences. Click "Stop Submissions" when ready.';
                break;
            case 'reviewing':
                gameStatusDisplay.textContent = 'Review the sentences. Click "Next Master" when done.';
                break;
            case 'completed':
                gameStatusDisplay.textContent = 'Round complete. Click "Start Round" to begin a new round.';
                break;
        }
    } else {
        switch(gameState) {
            case 'waiting':
                gameStatusDisplay.textContent = 'Waiting for the game to start...';
                break;
            case 'collecting':
                gameStatusDisplay.textContent = 'Submit your sentence!';
                break;
            case 'reviewing':
                gameStatusDisplay.textContent = `${currentGameMaster} is reviewing the sentences.`;
                break;
            case 'completed':
                gameStatusDisplay.textContent = `Round complete. ${currentGameMaster} is the new Game Master.`;
                break;
        }
    }
    
    // Update Game Master controls visibility based on game state
    if (isGameMaster) {
        startCollectingBtn.disabled = gameState === 'collecting';
        stopGameBtn.disabled = gameState !== 'collecting';
        doneGameBtn.disabled = gameState !== 'reviewing';
        
        startCollectingBtn.classList.toggle('opacity-50', gameState === 'collecting');
        stopGameBtn.classList.toggle('opacity-50', gameState !== 'collecting');
        doneGameBtn.classList.toggle('opacity-50', gameState !== 'reviewing');
    }
    
    // Update Player view based on game state
    if (!isGameMaster) {
        waitingMessage.classList.toggle('hidden', gameState === 'collecting');
        sentenceForm.classList.toggle('hidden', gameState !== 'collecting');
        sentenceSubmitted.classList.toggle('hidden', true); // Always hide initially when state changes
    }
}

// Show notification message
function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.remove('hidden');
    notification.classList.add('opacity-100');
    
    setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 300);
    }, duration);
}

// Update the players list in the UI
function updatePlayersList() {
    playersList.innerHTML = '';
    
    users.forEach(user => {
        const isCurrentUser = user === currentUser;
        const isMaster = user === currentGameMaster;
        
        const playerItem = document.createElement('div');
        playerItem.className = 'py-2 flex items-center justify-between';
        
        const nameSection = document.createElement('div');
        nameSection.className = 'flex items-center';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user;
        nameSpan.className = isCurrentUser ? 'font-bold' : '';
        nameSection.appendChild(nameSpan);
        
        if (isCurrentUser) {
            const youBadge = document.createElement('span');
            youBadge.textContent = 'You';
            youBadge.className = 'ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full';
            nameSection.appendChild(youBadge);
        }
        
        playerItem.appendChild(nameSection);
        
        if (isMaster) {
            const masterBadge = document.createElement('span');
            masterBadge.textContent = 'Game Master';
            masterBadge.className = 'bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full';
            playerItem.appendChild(masterBadge);
        }
        
        playersList.appendChild(playerItem);
    });
}

// Login form submission
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    
    if (name) {
        socket.emit('login', { name, password });
    }
});

// Sentence form submission
sentenceForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const sentence = sentenceInput.value.trim();
    
    if (sentence) {
        socket.emit('submitSentence', sentence);
        sentenceInput.value = '';
        sentenceForm.classList.add('hidden');
        sentenceSubmitted.classList.remove('hidden');
    }
});

// Game Master Controls
startCollectingBtn.addEventListener('click', function() {
    socket.emit('startCollecting');
});

stopGameBtn.addEventListener('click', function() {
    socket.emit('stopGame');
});

doneGameBtn.addEventListener('click', function() {
    socket.emit('doneGame');
});

resetGameBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to reset the game? All players will be disconnected.')) {
        socket.emit('resetGame');
    }
});

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('initialState', (data) => {
    gameState = data.gameState;
});

socket.on('loginSuccess', (data) => {
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    currentUser = nameInput.value.trim();
    users = data.users;
    currentGameMaster = data.gameMaster;
    gameState = data.gameState;
    
    playerNameDisplay.textContent = currentUser;
    isGameMaster = currentUser === currentGameMaster;
    
    // Show the right view based on role
    gameMasterView.classList.toggle('hidden', !isGameMaster);
    playerView.classList.toggle('hidden', isGameMaster);
    
    updatePlayersList();
    updateUIForGameState();
    
    showNotification('Login successful!');
});

socket.on('loginFailed', (data) => {
    let message = 'Login failed. Please try again.';
    if (data && data.reason === 'nameInUse') {
        message = 'That name is already taken. Please choose another.';
    }
    showNotification(message);
});

socket.on('gameStateUpdate', (data) => {
    gameState = data.gameState;
    users = data.users;
    currentGameMaster = data.gameMaster;
    
    isGameMaster = currentUser === currentGameMaster;
    
    // Show the right view based on role
    gameMasterView.classList.toggle('hidden', !isGameMaster);
    playerView.classList.toggle('hidden', isGameMaster);
    
    updatePlayersList();
    updateUIForGameState();
});

socket.on('sentenceSubmitted', () => {
    showNotification('Sentence submitted successfully!');
});

socket.on('submissionRejected', (data) => {
    showNotification('Submission rejected: ' + (data.reason || 'unknown reason'));
    sentenceForm.classList.remove('hidden');
    sentenceSubmitted.classList.add('hidden');
});

socket.on('newSentence', (data) => {
    // For Game Master - add new sentence to the list
    const sentenceItem = document.createElement('div');
    sentenceItem.className = 'bg-gray-50 p-3 rounded-lg border border-gray-200';
    
    const playerName = document.createElement('div');
    playerName.className = 'font-medium text-sm text-purple-800 mb-1';
    playerName.textContent = data.name;
    
    const sentenceText = document.createElement('div');
    sentenceText.className = 'text-gray-700';
    sentenceText.textContent = data.sentence;
    
    sentenceItem.appendChild(playerName);
    sentenceItem.appendChild(sentenceText);
    sentencesList.appendChild(sentenceItem);
});

socket.on('masterUpdate', (data) => {
    // Clear existing sentences
    sentencesList.innerHTML = '';
    
    // Add all sentences
    if (data.sentences) {
        Object.entries(data.sentences).forEach(([name, sentence]) => {
            const sentenceItem = document.createElement('div');
            sentenceItem.className = 'bg-gray-50 p-3 rounded-lg border border-gray-200';
            
            const playerName = document.createElement('div');
            playerName.className = 'font-medium text-sm text-purple-800 mb-1';
            playerName.textContent = name;
            
            const sentenceText = document.createElement('div');
            sentenceText.className = 'text-gray-700';
            sentenceText.textContent = sentence;
            
            sentenceItem.appendChild(playerName);
            sentenceItem.appendChild(sentenceText);
            sentencesList.appendChild(sentenceItem);
        });
    }
});

socket.on('gameReset', () => {
    showNotification('Game has been reset');
    setTimeout(() => {
        window.location.reload();
    }, 2000);
});

// Handle disconnection
socket.on('disconnect', () => {
    showNotification('Disconnected from server. Trying to reconnect...');
});

// Auto-focus the name input when the page loads
window.addEventListener('load', () => {
    nameInput.focus();
});