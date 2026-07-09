// Copies index.html into www/ (Capacitor's webDir) and rebuilds the native plugin bridge,
// then runs `cap sync` to push both into the native android/ios projects.
// Kept as a plain Node script (not shell commands in package.json) so it runs the same
// on Windows as on Mac/Linux.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

fs.copyFileSync(path.join(root, 'index.html'), path.join(root, 'www', 'index.html'));
console.log('Copied index.html -> www/index.html');

execSync('npx esbuild src/native-bridge.js --bundle --format=iife --outfile=native-bridge.js', { cwd: root, stdio: 'inherit' });
fs.copyFileSync(path.join(root, 'native-bridge.js'), path.join(root, 'www', 'native-bridge.js'));
console.log('Built native-bridge.js -> www/native-bridge.js');

execSync('npx cap sync', { cwd: root, stdio: 'inherit' });
