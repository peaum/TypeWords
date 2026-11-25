const { app, BrowserWindow, net, protocol, shell } = require('electron')
const { existsSync, statSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const appScheme = 'typewords'
const publicDir = path.resolve(__dirname, 'public')

protocol.registerSchemesAsPrivileged([
  {
    scheme: appScheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
])

function resolvePageFile(pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const requestedPath = path.resolve(publicDir, `.${decodedPath}`)
  const relativePath = path.relative(publicDir, requestedPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null

  const candidates = [
    requestedPath,
    `${requestedPath}.html`,
    path.join(requestedPath, 'index.html'),
  ]
  const existingFile = candidates.find(
    filePath => existsSync(filePath) && statSync(filePath).isFile()
  )
  if (existingFile) return existingFile

  if (path.extname(requestedPath)) return null

  const spaFallback = ['200.html', 'index.html']
    .map(fileName => path.join(publicDir, fileName))
    .find(filePath => existsSync(filePath))

  return spaFallback || null
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${appScheme}://app/`)) return

    event.preventDefault()
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
  })

  window.loadURL(`${appScheme}://app/`)
}

app.whenReady().then(() => {
  protocol.handle(appScheme, request => {
    const requestURL = new URL(request.url)
    if (requestURL.hostname !== 'app') {
      return new Response('Not found', { status: 404 })
    }

    const filePath = resolvePageFile(requestURL.pathname)
    if (!filePath) return new Response('Not found', { status: 404 })

    return net.fetch(pathToFileURL(filePath).href)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
