const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf-8');

// Inject apiFetch after imports
const injectCode = `\nconst BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';\nconst apiFetch = (url, options) => fetch(BACKEND_URL + url, options);\n`;
content = content.replace(/(import .*;\n)+/, match => match + injectCode);

// Replace fetch('/api/
content = content.replace(/fetch\('\/api\//g, "apiFetch('/api/");
content = content.replace(/fetch\(\`\/api\//g, "apiFetch(`/api/");

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx updated!');
