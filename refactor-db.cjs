const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

// 1. Remove local definitions of loadIndex, saveIndex, loadUsers, saveUsers
serverCode = serverCode.replace(/function loadIndex\(\) \{[\s\S]*?return JSON\.parse\(zlib\.gunzipSync\(fs\.readFileSync\(DB_FILE\)\)\);\n\}/, '');
serverCode = serverCode.replace(/function saveIndex\(data\) \{[\s\S]*?fs\.writeFileSync\(DB_FILE, zlib\.gzipSync\(JSON\.stringify\(data\)\)\);\n\}/, '');
serverCode = serverCode.replace(/function loadUsers\(\) \{[\s\S]*?return JSON\.parse\(zlib\.gunzipSync\(fs\.readFileSync\(USERS_FILE\)\)\);\n\}/, '');
serverCode = serverCode.replace(/function saveUsers\(data\) \{[\s\S]*?fs\.writeFileSync\(USERS_FILE, zlib\.gzipSync\(JSON\.stringify\(data\)\)\);\n\}/, '');

// 2. Add import for db.js
serverCode = serverCode.replace(/import zlib from 'zlib';/, `import zlib from 'zlib';\nimport { loadIndex, saveIndex, loadUsers, saveUsers, connectDB } from './db.js';`);

// 3. Replace all loadIndex() with await loadIndex()
serverCode = serverCode.replace(/loadIndex\(\)/g, 'await loadIndex()');
serverCode = serverCode.replace(/saveIndex\((.*?)\)/g, 'await saveIndex($1)');
serverCode = serverCode.replace(/loadUsers\(\)/g, 'await loadUsers()');
serverCode = serverCode.replace(/saveUsers\((.*?)\)/g, 'await saveUsers($1)');

fs.writeFileSync('server.js', serverCode);
console.log('server.js refactored');

let extractorCode = fs.readFileSync('extractor.js', 'utf8');

// 1. Remove local definitions
extractorCode = extractorCode.replace(/function loadIndex\(\) \{[\s\S]*?return JSON\.parse\(zlib\.gunzipSync\(fs\.readFileSync\(DB_FILE\)\)\);\n\}/, '');
extractorCode = extractorCode.replace(/function saveIndex\(data\) \{[\s\S]*?fs\.writeFileSync\(DB_FILE, zlib\.gzipSync\(JSON\.stringify\(data\)\)\);\n\}/, '');

// 2. Add import
extractorCode = extractorCode.replace(/import zlib from 'zlib';/, `import zlib from 'zlib';\nimport { loadIndex, saveIndex } from './db.js';`);

// 3. Replace loadIndex / saveIndex
extractorCode = extractorCode.replace(/loadIndex\(\)/g, 'await loadIndex()');
extractorCode = extractorCode.replace(/saveIndex\((.*?)\)/g, 'await saveIndex($1)');

// 4. Remove exports of loadIndex and saveIndex at the bottom of extractor.js
extractorCode = extractorCode.replace(/loadIndex,\n  saveIndex,\n/, '');

fs.writeFileSync('extractor.js', extractorCode);
console.log('extractor.js refactored');
