const { spawnSync } = require('node:child_process')
const { cp, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function buildElectronApp() {
  const projectDir = path.resolve(__dirname, '..')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'typewords-electron-'))
  const appDir = path.join(tempDir, 'app')
  const configPath = path.join(tempDir, 'electron-builder.json')
  const packageJson = JSON.parse(
    await readFile(path.join(projectDir, 'package.json'), 'utf8')
  )

  try {
    await mkdir(path.join(appDir, 'public'), { recursive: true })
    await cp(path.join(projectDir, 'electron', 'main.cjs'), path.join(appDir, 'main.cjs'))
    await cp(
      path.join(projectDir, '.output', 'public'),
      path.join(appDir, 'public'),
      { recursive: true }
    )
    await writeFile(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({
        name: packageJson.name,
        version: packageJson.version,
        private: true,
        main: 'main.cjs',
      }, null, 2)}\n`
    )
    await writeFile(
      configPath,
      `${JSON.stringify({
        appId: 'cc.typewords.desktop',
        productName: 'TypeWords',
        electronVersion: require('electron/package.json').version,
        directories: {
          output: path.join(projectDir, 'release'),
        },
        win: {
          icon: path.join(projectDir, 'electron', 'icon.ico'),
          target: ['msi'],
        },
      }, null, 2)}\n`
    )

    const builderCli = path.resolve(
      path.dirname(require.resolve('electron-builder')),
      '..',
      'cli.js'
    )
    const result = spawnSync(
      process.execPath,
      [builderCli, '--projectDir', appDir, '--config', configPath, ...process.argv.slice(2)],
      { cwd: appDir, stdio: 'inherit' }
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
      process.exitCode = result.status || 1
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

buildElectronApp().catch(error => {
  console.error('Failed to build the Electron app:', error)
  process.exitCode = 1
})
