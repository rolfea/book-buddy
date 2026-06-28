import fs from 'fs';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
const auth0Domain = process.env.AUTH0_DOMAIN || 'dev-dpr7adyud2sewfbo.us.auth0.com';
const auth0ClientID = process.env.AUTH0_CLIENT_ID || 'sxAckgOU1BtWidrVdkvIqptbK3srOa7a';

const content = `window.API_BASE_URL = "${apiBaseUrl}";
window.AUTH0_DOMAIN = "${auth0Domain}";
window.AUTH0_CLIENT_ID = "${auth0ClientID}";
`;

fs.writeFileSync('config.js', content);
console.log(`config.js generated with API_BASE_URL=${apiBaseUrl}, AUTH0_DOMAIN=${auth0Domain}, AUTH0_CLIENT_ID=${auth0ClientID}`);
