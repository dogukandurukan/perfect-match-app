// Shared loader for the onboarding V2 logic checks: resolves the '@/…'
// alias to the repo root and compiles TS on the fly with sucrase (already in
// node_modules via Expo). No app code runs here — pure modules only.
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) {
  if (req.startsWith('@/')) req = path.join(ROOT, req.slice(2));
  return orig.call(this, req, ...a);
};
require(path.join(ROOT, 'node_modules/sucrase/register/ts'));

let n = 0;
let fail = 0;
const ok = (c, m) => {
  n += 1;
  if (!c) {
    fail += 1;
    console.log('FAIL', m);
  }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lib = (p) => require(path.join(ROOT, 'lib/onboardingV2', p));
// Prints this file's result and resets the counters for the next file.
const done = (name) => {
  console.log(`${name}: ${n - fail}/${n} passed`);
  const failed = fail;
  n = 0;
  fail = 0;
  return failed;
};
module.exports = { ok, eq, lib, done, ROOT };
