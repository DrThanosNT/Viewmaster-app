// Run from the app folder (safe to run twice). Your BASE_URL is not touched.
const fs = require('fs');
const file = 'src/api/client.ts';
let src = fs.readFileSync(file, 'utf8');
const notes = [];

// 1. imports can carry a return date
if (!src.includes('expectedReturnAt')) {
  const old = 'temporary?: boolean }[];';
  if (src.includes(old)) { src = src.replace(old, 'temporary?: boolean; expectedReturnAt?: string | null }[];'); notes.push('return date type'); }
  else { console.log("ERROR: couldn't find the moveStockBatch lines type in " + file + ' - tell me'); process.exit(1); }
}

// 2. getMe, so the app can ask for its current role
if (!src.includes('getMe:')) {
  const lines = src.split('\n');
  const at = lines.findIndex((l) => l.includes('updateMyPhoto:'));
  if (at === -1) { console.log("ERROR: couldn't find updateMyPhoto in " + file + ' - tell me'); process.exit(1); }
  lines.splice(at + 1, 0, "  getMe: () => request('/auth/me'),");
  src = lines.join('\n');
  notes.push('getMe');
}

if (notes.length) { fs.writeFileSync(file, src); console.log('patched  ' + file + ' (' + notes.join(', ') + ')'); }
else console.log('skipped  ' + file + ' (already done)');
