const { spawn } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('🚀 STARTING BOOKNEST MARKETPLACE LOCAL ENVIRONMENT');
console.log('====================================================');
console.log('Backend Port:  http://localhost:5000');
console.log('Frontend Port: http://localhost:5173');
console.log('====================================================\n');

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const clientDir = path.join(rootDir, 'client');

// 1. Spawn Backend Process
console.log('[Runner] Starting Node.js Backend Server on http://localhost:5000...');
const serverProcess = spawn('node', ['index.js'], {
  cwd: serverDir,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, PORT: '5000', NODE_ENV: 'development' }
});

// 2. Spawn Frontend Process
console.log('[Runner] Starting Vite Frontend Dev Server on http://localhost:5173...');
const clientProcess = spawn('npx', ['vite', '--host', 'localhost', '--port', '5173'], {
  cwd: clientDir,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env }
});

function cleanup() {
  console.log('\n[Runner] Shutting down BookNest local services...');
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  if (clientProcess && !clientProcess.killed) clientProcess.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
