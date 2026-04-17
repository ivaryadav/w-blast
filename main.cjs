const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800
  });

  // ✅ load built UI (NO localhost dependency)
  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(createWindow);