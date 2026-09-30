// DEV-only build label (P07 R2): "dating-app · abc1234 · tempa-p07-r2".
// Values come from app.config.js at config-evaluation time — never made up.
import Constants from 'expo-constants';

import { backend } from './supabaseClient';

type DevBuildInfo = { packageName?: string; commit?: string; dirty?: boolean | null; worktree?: string };

export function devBuildLabel(): string {
  const info = (Constants.expoConfig?.extra as { devBuildInfo?: DevBuildInfo } | undefined)?.devBuildInfo;
  if (!info) return 'build info unavailable';
  const commit = `${info.commit ?? 'unavailable'}${info.dirty ? '+local changes' : ''}`;
  return [info.packageName ?? 'unavailable', commit, info.worktree ?? 'unavailable'].join(' · ');
}

/** DEV-only backend line: "backend: TEST · <project ref>" / "backend: LIVE · <ref>". */
export function devBackendLabel(): string {
  return `backend: ${backend.env.toUpperCase()} · ${backend.projectRef}`;
}
