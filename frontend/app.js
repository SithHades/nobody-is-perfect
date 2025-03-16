// Connect to the server with reconnection options
const socket = io('https://nip-backend.kncklab.com', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true
});

// Hard-coded password to match backend
const PASSWORD = 'Ledi2025';

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
const connectionStatus = document.getElementById('connectionStatus');
const connectionDot = document.getElementById('connectionDot');
const connectionText = document.getElementById('connectionText');

// Game Master Controls
const startCollectingBtn = document.getElementById('startCollectingBtn');
const stopGameBtn = document.getElementById('stopGameBtn');
const doneGameBtn = document.getElementById('doneGameBtn');
const resetGameBtn = document.getElementById('resetGameBtn');

// Game state variables
let currentUser = localStorage.getItem('nip_username') || '';
let isGameMaster = false;
let gameState = 'waiting';
let users = [];
let currentGameMaster = '';
let reconnecting = false;
let hasSubmittedSentence = false;
let disconnectedUsers = []; // Track disconnected users

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
                gameStatusDisplay.textContent = 'Das spiel ist bereit zu beginnen. Klicke "Starte Runde" um zu beginnen.';
                break;
            case 'collecting':
                gameStatusDisplay.textContent = 'Die Spieler schreiben ihre Sätze. Klicke "Stop!" wenn du diesen Zug stoppen möchtest.';
                break;
            case 'reviewing':
                gameStatusDisplay.textContent = 'Prüfe die Sätze und lese sie vor. Klicke "Nächster Game Master" wenn du fertig bist.';
                break;
            case 'completed':
                gameStatusDisplay.textContent = 'Runde zuende. Klicke "Starte Runde" um eine neue zu beginnen.';
                break;
        }
    } else {
        switch(gameState) {
            case 'waiting':
                gameStatusDisplay.textContent = 'Warten bis das Spiel beginnt...';
                break;
            case 'collecting':
                gameStatusDisplay.textContent = 'Schreibe deinen Satz!';
                break;
            case 'reviewing':
                gameStatusDisplay.textContent = `${currentGameMaster} sammelt die Sätze.`;
                break;
            case 'completed':
                gameStatusDisplay.textContent = `Runde zuende. ${currentGameMaster} ist der neue Game Master.`;
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

// Handle reconnection
function handleReconnection() {
    if (currentUser) {
        reconnecting = true;
        // Auto-login with saved credentials
        socket.emit('reconnect', { 
            name: currentUser,
            password: PASSWORD
        });
        showNotification('Verbindung wiederhergestellt. Versuche erneut anzumelden...', 5000);
        
        // If we were already in the game
        if (gameScreen.classList.contains('hidden') === false) {
            // If we had submitted a sentence before, make sure it's still there
            const savedSentence = localStorage.getItem('nip_sentence');
            if (savedSentence && gameState === 'collecting' && !isGameMaster && !hasSubmittedSentence) {
                // Try to resubmit the sentence after reconnection
                setTimeout(() => {
                    socket.emit('submitSentence', savedSentence);
                    sentenceForm.classList.add('hidden');
                    sentenceSubmitted.classList.remove('hidden');
                }, 2000);
            }
        }
    }
}

// Update the players list in the UI
function updatePlayersList() {
    playersList.innerHTML = '';
    
    users.forEach(user => {
        const isCurrentUser = user === currentUser;
        const isMaster = user === currentGameMaster;
        const isDisconnected = disconnectedUsers && disconnectedUsers.includes(user);
        
        const playerItem = document.createElement('div');
        playerItem.className = 'py-2 flex items-center justify-between';
        
        const nameSection = document.createElement('div');
        nameSection.className = 'flex items-center';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user;
        nameSpan.className = isCurrentUser ? 'font-bold' : '';
        
        // Add strikethrough or opacity for disconnected users
        if (isDisconnected) {
            nameSpan.classList.add('opacity-50');
        }
        
        nameSection.appendChild(nameSpan);
        
        if (isCurrentUser) {
            const youBadge = document.createElement('span');
            youBadge.textContent = 'You';
            youBadge.className = 'ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full';
            nameSection.appendChild(youBadge);
        }
        
        if (isDisconnected) {
            const disconnectedBadge = document.createElement('span');
            disconnectedBadge.textContent = 'Getrennt';
            disconnectedBadge.className = 'ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full';
            nameSection.appendChild(disconnectedBadge);
        }
        
        playerItem.appendChild(nameSection);
        
        const badgesSection = document.createElement('div');
        badgesSection.className = 'flex items-center gap-2';
        
        if (isMaster) {
            const masterBadge = document.createElement('span');
            masterBadge.textContent = 'Game Master';
            masterBadge.className = 'bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full';
            badgesSection.appendChild(masterBadge);
        }
        
        // Add remove button for game master to remove other players
        if (isGameMaster && !isCurrentUser && !isMaster) {
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.className = 'text-red-500 hover:text-red-700 p-1';
            removeBtn.title = 'Spieler entfernen';
            removeBtn.onclick = (e) => {
                e.preventDefault();
                if (confirm(`Bist du sicher, dass du "${user}" aus dem Spiel entfernen möchtest?`)) {
                    socket.emit('removePlayer', { playerName: user });
                }
            };
            badgesSection.appendChild(removeBtn);
        }
        
        if (badgesSection.children.length > 0) {
            playerItem.appendChild(badgesSection);
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
        // Save username in localStorage for reconnection
        localStorage.setItem('nip_username', name);
        socket.emit('login', { name, password });
    }
});

// Sentence form submission
sentenceForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const sentence = sentenceInput.value.trim();
    
    if (sentence) {
        // Store the sentence locally in case of disconnection
        localStorage.setItem('nip_sentence', sentence);
        hasSubmittedSentence = true;
        
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
    // Clear any saved sentence when moving to the next game master
    localStorage.removeItem('nip_sentence');
    hasSubmittedSentence = false;
    socket.emit('doneGame');
});

resetGameBtn.addEventListener('click', function() {
    if (confirm('Bist du dir sicher, dass du das Spiel zurücksetzen möchtest? Alle Spieler und Sätze werden zurückgesetzt.')) {
        socket.emit('resetGame');
    }
});

// Update connection status UI
function updateConnectionStatus(connected, message) {
    connectionStatus.classList.remove('hidden');
    
    if (connected) {
        connectionDot.className = 'w-2 h-2 bg-green-400 rounded-full mr-2';
        connectionText.textContent = message || 'Verbunden';
        connectionStatus.classList.remove('bg-red-800', 'bg-amber-800');
        connectionStatus.classList.add('bg-gray-800');
    } else {
        connectionDot.className = 'w-2 h-2 bg-red-400 rounded-full mr-2';
        connectionText.textContent = message || 'Getrennt';
        connectionStatus.classList.remove('bg-gray-800', 'bg-amber-800');
        connectionStatus.classList.add('bg-red-800');
    }
    
    // Hide after 5 seconds if connected
    if (connected) {
        setTimeout(() => {
            connectionStatus.classList.add('hidden');
        }, 5000);
    }
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
    
    // If we were reconnecting, try to rejoin automatically
    if (reconnecting && currentUser) {
        handleReconnection();
    }
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

// Get references to force reconnect modal elements
const reconnectModal = document.getElementById('reconnectModal');
const reconnectUsername = document.getElementById('reconnectUsername');
const cancelReconnectBtn = document.getElementById('cancelReconnectBtn');
const forceReconnectBtn = document.getElementById('forceReconnectBtn');

// Adding modal event handlers
cancelReconnectBtn.addEventListener('click', () => {
    reconnectModal.classList.add('hidden');
});

forceReconnectBtn.addEventListener('click', () => {
    const username = reconnectUsername.textContent;
    if (username) {
        socket.emit('forceReconnect', { 
            name: username, 
            password: PASSWORD 
        });
        reconnectModal.classList.add('hidden');
        showNotification('Versuche erneut zu verbinden...', 3000);
    }
});

socket.on('loginFailed', (data) => {
    let message = 'Login failed. Please try again.';
    
    if (data && data.reason === 'nameInUse') {
        // Show the force reconnect dialog if the name is what we have in local storage
        if (data.name === localStorage.getItem('nip_username')) {
            reconnectUsername.textContent = data.name;
            reconnectModal.classList.remove('hidden');
            return;
        } else {
            message = 'That name is already taken. Please choose another.';
        }
    }
    
    showNotification(message);
});

socket.on('gameStateUpdate', (data) => {
    gameState = data.gameState;
    users = data.users;
    currentGameMaster = data.gameMaster;
    disconnectedUsers = data.disconnectedUsers || [];
    
    // Make sure reconnected users can see the game
    if (reconnecting && gameScreen.classList.contains('hidden')) {
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        reconnecting = false;
    }
    
    // Check if we exist in the users list, if not and we have a username, try to rejoin
    if (currentUser && !users.includes(currentUser)) {
        socket.emit('reconnect', { 
            name: currentUser,
            password: PASSWORD
        });
    }
    
    isGameMaster = currentUser === currentGameMaster;
    
    // Show the right view based on role
    gameMasterView.classList.toggle('hidden', !isGameMaster);
    playerView.classList.toggle('hidden', isGameMaster);
    
    // Reset hasSubmittedSentence when game state changes to collecting
    if (gameState === 'collecting' && !isGameMaster) {
        hasSubmittedSentence = false;
        // Check if we have a saved sentence to submit
        const savedSentence = localStorage.getItem('nip_sentence');
        if (savedSentence && !sentenceSubmitted.classList.contains('hidden')) {
            hasSubmittedSentence = true;
        }
    }
    
    updatePlayersList();
    updateUIForGameState();
});

socket.on('sentenceSubmitted', () => {
    hasSubmittedSentence = true;
    showNotification('Satz erfolgreich eingereicht!');
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
    showNotification('Spiel zurückgesetzt');
    setTimeout(() => {
        window.location.reload();
    }, 2000);
});

// Handle being kicked from the game
socket.on('kickedFromGame', (data) => {
    showNotification(data.message || 'Du wurdest aus dem Spiel entfernt', 5000);
    
    // Clear local storage
    localStorage.removeItem('nip_username');
    localStorage.removeItem('nip_sentence');
    
    // Redirect to login screen after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 3000);
});

// Handle operation success/failure
socket.on('operationSuccess', (data) => {
    showNotification(data.message || 'Operation erfolgreich', 3000);
});

socket.on('operationFailed', (data) => {
    showNotification(data.message || 'Operation fehlgeschlagen', 3000);
});

// Handle disconnection
socket.on('disconnect', () => {
    showNotification('Verbindung zum Server verloren. Versuche erneut zu verbinden...', 10000);
    updateConnectionStatus(false, 'Verbinde...');
    reconnecting = true;
    // We don't need to do anything else - socket.io will try to reconnect automatically
});

// Reconnection events
socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
    updateConnectionStatus(false, `Versuch ${attemptNumber}...`);
    if (attemptNumber % 3 === 0) { // Only show notification every 3 attempts to avoid spam
        showNotification(`Verbindungsversuch ${attemptNumber}...`, 2000);
    }
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
    updateConnectionStatus(true, 'Wieder verbunden!');
    handleReconnection();
});

// Handle temporary disconnections of other users
socket.on('userTemporarilyDisconnected', (data) => {
    if (data.username && data.username !== currentUser) {
        showNotification(data.message, 3000);
    }
});

// Handle connection errors
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateConnectionStatus(false, 'Verbindungsfehler');
    showNotification('Verbindungsfehler: ' + error.message, 5000);
});

// Add a ping event to keep the connection alive
setInterval(() => {
    if (socket.connected && currentUser) {
        socket.emit('keepAlive', { name: currentUser });
    }
}, 30000); // Every 30 seconds

// Auto-focus the name input or attempt auto-login when the page loads
window.addEventListener('load', () => {
    // Try to auto-login if we have a username stored
    const savedUsername = localStorage.getItem('nip_username');
    if (savedUsername) {
        nameInput.value = savedUsername;
        passwordInput.value = PASSWORD;
        
        // Only attempt auto-login if the socket is connected
        if (socket.connected) {
            socket.emit('login', { 
                name: savedUsername, 
                password: PASSWORD 
            });
            showNotification('Versuche automatisch anzumelden...', 2000);
        } else {
            nameInput.focus();
        }
    } else {
        nameInput.focus();
    }
});