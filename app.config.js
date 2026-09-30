// Extends app.json with DEV-only build diagnostics (P07 R2): the package
// name and the short git commit of the worktree Metro is serving, read when
// the Expo CLI evaluates the config (Metro start / manifest). Nothing is
// invented: if git is unavailable the values are 'unavailable'. Omitted for
// EAS production builds; the app only renders it under __DEV__.
const { execSync } = require('child_process');
const path = require('path');

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

module.exports = ({ config }) => {
  // Backend is chosen explicitly (lib/backendConfig.ts); production pins live.
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    return { ...config, extra: { ...config.extra, backend: { env: 'live' } } };
  }
  const commit = git('rev-parse --short HEAD');
  return {
    ...config,
    extra: {
      ...config.extra,
      backend: {
        env: process.env.TEMPA_BACKEND ?? null,
        testUrl: process.env.TEMPA_TEST_SUPABASE_URL ?? null,
        // anon / publishable key only (public by design); never a secret key
        testAnonKey: process.env.TEMPA_TEST_SUPABASE_ANON_KEY ?? null,
        // DEV test sign-in: the one synthetic account the start script
        // allows (an address only — no password, key or code).
        devTestEmail: process.env.TEMPA_DEV_TEST_EMAIL ?? null,
      },
      devBuildInfo: {
        packageName: require('./package.json').name ?? 'unavailable',
        commit: commit ?? 'unavailable',
        dirty: commit ? git('status --porcelain') !== '' : null,
        worktree: path.basename(__dirname),
      },
    },
  };
};
