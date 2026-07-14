const html = require('fs').readFileSync('af-html-2.txt', 'utf8');
const urls = html.match(/https?:\/\/[^\s"'<>]*?(?:lightspeedst\.net|mp4_temp)[^\s"'<>]*/gi) || [];
console.log(urls);
