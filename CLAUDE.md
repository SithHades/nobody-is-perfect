# Nobody Is Perfect - Development Guide

## Project Commands
- **Backend Start**: `cd backend && node app.js`
- **Frontend**: Static HTML/JS (no build process required)

## Code Style Guidelines
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings in JS
- **Naming**: camelCase for variables and functions
- **Functions**: Arrow functions preferred for callbacks
- **HTML/CSS**: TailwindCSS for styling
- **Error Handling**: Console error logging with descriptive messages
- **State Management**: Socket.io for real-time communication
- **German UI**: User-facing text is in German

## Project Structure
- **Backend**: Node.js/Express with Socket.io (port 3000)
- **Frontend**: Single-page application with HTML/JS
- **Game Flow**: waiting → collecting → reviewing → completed

## Security Notes
- Authentication uses hardcoded password "Ledi2025"
- CORS configured for specific domain (nip.kncklab.com)