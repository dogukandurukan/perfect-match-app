// Runs every onboarding V2 logic check: `node scripts/onboarding-v2-checks/run.js`
// Exit code 1 if any check fails.
const fs = require('fs');
const path = require('path');

let failures = 0;
for (const f of fs.readdirSync(__dirname).filter((x) => x.endsWith('.check.js')).sort()) {
  failures += require(path.join(__dirname, f));
}
process.exit(failures ? 1 : 0);
