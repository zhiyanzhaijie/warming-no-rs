import { chmodSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryDir = resolve(frontendDir, '..')
const backendDir = join(repositoryDir, 'backend')
const tauriDir = join(frontendDir, 'src-tauri')
const buildDir = join(tauriDir, 'target', 'python-sidecar')

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.error) {
    throw new Error(`failed to start ${command}: ${result.error.message}`, {
      cause: result.error,
    })
  }
  if (result.status !== 0) {
    const details = result.stderr.trim() || result.stdout.trim() || 'no output'
    throw new Error(`${command} exited with status ${result.status}:\n${details}`)
  }
  return result.stdout.trim()
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const rustHost = run('rustc', ['-vV'])
  .split('\n')
  .find((line) => line.startsWith('host: '))
  ?.slice('host: '.length)
const targetTriple = process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET || rustHost
if (!targetTriple) throw new Error('could not determine the Rust target triple')

const targetArchitecture = targetTriple.startsWith('aarch64-')
  ? 'arm64'
  : targetTriple.startsWith('x86_64-')
    ? 'x64'
    : null
if (targetArchitecture && targetArchitecture !== process.arch) {
  throw new Error(
    `PyInstaller cannot cross-compile from ${process.arch} to ${targetArchitecture}; ` +
      `run this build on a ${targetArchitecture} host`,
  )
}

const suffix = process.platform === 'win32' ? '.exe' : ''
const output = join(tauriDir, 'binaries', `warming-backend-${targetTriple}${suffix}`)
const inputs = [
  join(backendDir, 'pyproject.toml'),
  join(backendDir, 'uv.lock'),
  ...filesUnder(join(backendDir, 'core')).filter((path) => path.endsWith('.py')),
]

let current = false
try {
  const outputTime = statSync(output).mtimeMs
  current = inputs.every((input) => statSync(input).mtimeMs <= outputTime)
} catch {
  // A missing output is the normal first-build case.
}

if (!current) {
  const uv = process.env.UV || 'uv'
  run(uv, [
    'run', '--project', backendDir, '--extra', 'dev',
    'pyinstaller', '--noconfirm', '--clean', '--onefile',
    '--name', 'warming-backend', '--paths', backendDir,
    '--distpath', join(buildDir, 'dist'),
    '--workpath', join(buildDir, 'work'),
    '--specpath', join(buildDir, 'spec'),
    join(backendDir, 'core', 'rpc.py'),
  ])
  mkdirSync(dirname(output), { recursive: true })
  copyFileSync(join(buildDir, 'dist', `warming-backend${suffix}`), output)
  if (process.platform !== 'win32') chmodSync(output, 0o755)
}

console.log(`Python sidecar ready: ${output}`)
