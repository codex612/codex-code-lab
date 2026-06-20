const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const http = require('http');

let syncCode = "-- No script synced yet from Codex Code Lab";
let syncServerInstance = null;

function startSyncServer() {
  if (syncServerInstance) return;
  
  syncServerInstance = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/get-script') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(syncCode);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  syncServerInstance.listen(50535, '127.0.0.1', () => {
    console.log('[Codex Sync Server] Running on http://127.0.0.1:50535');
  });

  syncServerInstance.on('error', (err) => {
    console.error('[Codex Sync Server] Error:', err);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: "Codex"
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  startSyncServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler to update synced Roblox code
ipcMain.on('update-sync-code', (event, code) => {
  syncCode = code;
});

// IPC Handler for App Version
ipcMain.handle('get-app-version', () => app.getVersion());

// Helper for download redirection handling
function downloadFile(url, dest, onProgress, onComplete, onError) {
  const request = https.get(url, (response) => {
    const statusCode = response.statusCode;

    // Follow redirects
    if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
      downloadFile(response.headers.location, dest, onProgress, onComplete, onError);
      return;
    }

    if (statusCode !== 200) {
      onError(new Error(`Download failed: Status Code ${statusCode}`));
      return;
    }

    const totalBytes = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;

    const fileStream = fs.createWriteStream(dest);
    response.pipe(fileStream);

    response.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const progress = Math.round((downloadedBytes / totalBytes) * 100);
        onProgress(progress);
      }
    });

    fileStream.on('finish', () => {
      fileStream.close();
      onComplete();
    });

    fileStream.on('error', (err) => {
      fs.unlink(dest, () => {});
      onError(err);
    });
  });

  request.on('error', (err) => {
    onError(err);
  });
}

// IPC Handler for Update Installation
ipcMain.on('start-update', (event, { url, filename }) => {
  const tempPath = path.join(app.getPath('temp'), filename);
  
  downloadFile(
    url,
    tempPath,
    (progress) => {
      event.sender.send('update-progress', progress);
    },
    () => {
      event.sender.send('update-complete');
      setTimeout(() => {
        const platform = process.platform;
        if (platform === 'darwin') {
          exec(`open "${tempPath}"`, () => {
            app.quit();
          });
        } else if (platform === 'win32') {
          const child = spawn(tempPath, [], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
          app.quit();
        } else {
          // Linux
          exec(`chmod +x "${tempPath}" && "${tempPath}"`, { detached: true }, () => {
            app.quit();
          });
        }
      }, 1000);
    },
    (err) => {
      event.sender.send('update-error', err.message);
    }
  );
});

// IPC Handler to Open URL in External Browser
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});
