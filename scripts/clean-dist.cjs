const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

fs.rmSync(distDir, {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100,
});
