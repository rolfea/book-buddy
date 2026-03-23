import fs from 'fs';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
const content = `window.API_BASE_URL = "${apiBaseUrl}";\n`;

fs.writeFileSync('config.js', content);
console.log(`config.js generated with API_BASE_URL=${apiBaseUrl}`);
