// DEV design preview (branding round 1): three screens, synthetic data only,
// DEV-only route, no backend access, and the live screens share the copy the
// preview shows (no detached copy of the design system).
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const P = require(path.join(ROOT, 'lib/dev/designPreview.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

ok(P.DESIGN_SCREENS.map((s) => s.id).join(',') === 'welcome,question,received', 'exactly the three round-1 screens, in order');
const ids = P.DESIGN_SCREENS.flatMap((s) => s.states.map((x) => x.id));
ok(new Set(ids).size === ids.length && P.DESIGN_SCREENS.every((s) => s.states.length >= 2), 'state ids unique, each screen has several states');
ok(ids.includes('email-error') && ids.includes('question-save-error') && ids.includes('status-error'), 'an error state on every screen');
ok(P.screenOfState('code').id === 'welcome' && P.screenOfState('rejected').id === 'received', 'state → screen lookup');
ok(/@example\.com$/.test(P.SYNTHETIC.email) && /^\d{6}$/.test(P.SYNTHETIC.code), 'synthetic email on the RFC 2606 example domain');
ok(P.WELCOME_PROPOSALS[0].headline === P.SPEC_WELCOME.headline, 'first welcome proposal is the spec copy');
const flow = read('docs/tempa/ONBOARDING_FLOW.md');
ok(flow.includes(P.SPEC_WELCOME.headline) && flow.includes(P.SPEC_WELCOME.body), 'spec welcome copy matches ONBOARDING_FLOW.md §1');
for (const s of P.DESIGN_SCREENS) {
  const files = s.liveSource.split(/\s\+\s|\s→\s|\s·\s/).map((x) => x.replace(/^copy in /, '').trim()).filter((x) => /\.(tsx?|md)$/.test(x));
  ok(files.length > 0 && files.every((f) => fs.existsSync(path.join(ROOT, f))), `${s.id}: live source files exist (${files.join(', ')})`);
}

const route = read('app/dev/design-preview.tsx');
ok(/if \(!__DEV__\) return <Redirect href="\/" \/>/.test(route), 'route redirects in production builds');
const comp = read('components/dev/design/DesignPreview.tsx');
const lib = read('lib/dev/designPreview.ts');
ok(![comp, lib, route].some((t) => /supabaseClient|onboardingV2\/remote|\.rpc\(|\.from\(|storage/.test(t)), 'preview never imports Supabase / remote helpers');
ok(/SINGLE_QUESTIONS\[1\]/.test(comp) && P.DESIGN_SCREENS[1].title.includes('2 of 7'), 'representative question is 3.2 (still live; 3.1 is hidden under D104b)');
ok(/OnboardingScreen/.test(comp) && /SingleChoiceFields/.test(comp) && /ReceivedFields/.test(comp) && /ConsentRow/.test(comp), 'preview renders the real onboarding components');

const welcome = read('app/v2/welcome.tsx');
ok(/ACCOUNT_COPY\.emailTitle/.test(welcome) && /<ConsentRow /.test(welcome) && !/accessibilityRole="checkbox"/.test(welcome), 'live welcome uses the shared copy + consent row');
const status = read('app/v2/status.tsx');
ok(/STATUS_COPY\.rejected/.test(status), 'live status uses the shared copy');
ok(/DEV · Design preview/.test(read('app/(tabs)/index.tsx')), 'signed-out landing has the DEV entry');

const sp = read('scripts/collab/start-preview.sh');
ok(/127\.0\.0\.1:59999/.test(sp) && /sb_publishable_/.test(sp) && !/55421/.test(sp), 'offline preview never points at a real backend');
const fsx = read('scripts/collab/first-setup.sh');
ok(fsx.indexOf('already exists') < fsx.indexOf('setup.mjs'), 'first-setup refuses an existing backend before setup.mjs (reset) can run');

module.exports = done('design_preview');
