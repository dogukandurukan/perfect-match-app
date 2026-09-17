import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// `reasons` from `get_top_matches` are plain, already-written sentences from
// a fixed, known set of templates (see the RPC's `reasons` CASE list) — not
// a typed category, but the templates themselves ARE effectively the type,
// so this matches by template (prefix/exact), never by guessing off an
// arbitrary word inside the sentence. That distinction matters concretely:
// the previous version matched any reason containing "love" to a music-note
// icon, which was wrong for e.g. "You both love Fitness & Gaming" — hobbies
// are unbounded free text from the algorithm, so shared-interest reasons
// always get one consistent generic icon regardless of which hobby it is.
function reasonIcon(reason: string): IconName {
  if (reason === 'Looking for the same thing' || reason.startsWith('Same relationship intention'))
    return 'heart-outline';
  if (reason.startsWith('You both love ')) return 'link-outline'; // shared interests, any topic
  if (reason === 'Nearby') return 'location-outline';
  if (reason === 'Same favorite spot') return 'pin-outline';
  if (reason === 'Similar drinking habits') return 'wine-outline';
  if (reason === 'Similar smoking habits') return 'ban-outline';
  if (reason === 'Same idea of a first date') return 'cafe-outline';
  if (reason === 'Great zodiac match') return 'sparkles-outline';
  return 'sparkles-outline';
}

// The RPC's intent-match reason ("Looking for the same thing") doesn't say
// WHAT'S the same — the brief asked for the real intent value spelled out
// (e.g. "You're both looking for a serious relationship") where available.
// That needs the VIEWER's own intent, which Home doesn't currently fetch
// anywhere (only `myCity` is — no request/data-flow change was in scope
// here), so per the brief's own explicit fallback instruction for exactly
// this "data not available" case, this reformats to a clearer but still
// honest generic line instead of inventing/fetching new data.
function reasonText(reason: string): string {
  if (reason === 'Looking for the same thing') return 'Same relationship intention';
  return reason;
}

/**
 * The product's core differentiator card — real algorithmic reasons, never
 * invented copy. Shows at most 3 (the RPC itself already caps `reasons` at
 * 3, in priority order), and renders nothing if there are none rather than
 * showing an empty card.
 */
export function WhyYouMatchCard({ reasons }: { reasons: string[] | null | undefined }) {
  const list = (reasons ?? []).filter((r) => r.trim().length > 0).slice(0, 3);
  if (list.length === 0) return null;

  return (
    <View style={styles.card}>
      <ThemedText style={styles.heading}>Why you match</ThemedText>
      {list.map((reason, i) => (
        <View key={reason} style={[styles.row, i === list.length - 1 && styles.rowLast]}>
          <View style={styles.iconWrap}>
            <Ionicons name={reasonIcon(reason)} size={17} color={homeColors.accent} />
          </View>
          <ThemedText style={styles.reasonText}>{reasonText(reason)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    padding: homeSpacing.lg,
    borderRadius: homeRadius.card,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    ...homeShadow,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: homeColors.textPrimary,
    marginBottom: homeSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.md,
    paddingVertical: homeSpacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeColors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeColors.accentSoft,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: homeColors.textPrimary,
  },
});
