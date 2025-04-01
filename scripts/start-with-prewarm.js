// Script to start Next.js dev server and run pre-warming
const { spawn } = require('child_process');
const path = require('path');

// Start Next.js dev server
console.log('Starting Next.js development server...');
const nextProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Handle server process events
nextProcess.on('error', (error) => {
  console.error('Failed to start Next.js server:', error);
  process.exit(1);
});

// Wait a bit before running pre-warming to ensure server has started
setTimeout(() => {
  console.log('Launching pre-warming script...');
  const prewarmProcess = spawn('node', [path.join(__dirname, 'pre-warm.js')], {
    stdio: 'inherit',
    shell: true
  });

  prewarmProcess.on('error', (error) => {
    console.error('Failed to run pre-warming script:', error);
  });

  prewarmProcess.on('exit', (code) => {
    console.log(`Pre-warming script exited with code ${code}`);
  });
}, 10000); // Wait 10 seconds before starting pre-warming

// Handle main process exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  nextProcess.kill();
  process.exit(0);
}); 