const fs = require('fs');
const text = fs.readFileSync('C:/Users/denise/.gemini/antigravity-cli/brain/57e17bce-4251-4b99-b686-288497163583/.system_generated/steps/2279/content.md', 'utf8');
const locRegex = /<loc>(https:\/\/animesonlinecc\.to\/anime\/([^/]+)\/)<\/loc>/g;
let match;
let count = 0;
while ((match = locRegex.exec(text)) !== null) {
  count++;
  if(match[2].includes('kamui')) console.log(match[2]);
}
console.log('Total matches:', count);
