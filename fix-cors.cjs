const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Reset respond function to simple version
code = code.replace(/function respond\(res, status, data, contentType = 'application\\/json', req = null\) \{[\s\S]*?res\.end\(body\);\n\}/, 
`function respond(res, status, data, contentType = 'application/json') {
  const body = contentType === 'application/json' ? JSON.stringify(data) : data;
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}`);

// Add global CORS headers to every request
code = code.replace(/const server = http\.createServer\(async \(req, res\) => \{/, 
`const server = http.createServer(async (req, res) => {
  // Global CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user');
`);

// Also fix OPTIONS block
code = code.replace(/if \(method === 'OPTIONS'\) \{[\s\S]*?res\.end\(\);\n    return;\n  \}/, 
`if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }`);

// Also fix EventSource SSE block
code = code.replace(/res\.writeHead\(200, \{\n      'Content-Type':                'text\/event-stream',\n      'Cache-Control':               'no-cache',\n      'Connection':                  'keep-alive',\n      'Access-Control-Allow-Origin': req\.headers\.origin \|\| '\*',\n      'Access-Control-Allow-Credentials': 'true'\n    \}\);/, 
`res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });`);

fs.writeFileSync('server.js', code);
console.log('Fixed server.js CORS!');
