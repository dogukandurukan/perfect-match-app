// V2 chat: the likes between the two people, shown as CONTEXT above the
// conversation (never as messages): which photo or answer was liked, by whom,
// and the optional note. Comes from get_chat_v2 (`likes`); older servers
// don't send it and nothing is shown.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LikeContext as LikeItem } from '@/lib/matchChatV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

/** Pure: the line for one like ("You liked Ece's photo"). */
export function likeContextLine(l: Pick<LikeItem, 'from_me' | 'target_type'>, otherName: string): string {
  const what = l.target_type === 'photo' ? 'photo' : l.target_type === 'prompt' ? 'answer' : 'profile';
  const name = otherName.trim() || 'them';
  return l.from_me ? `You liked ${name}’s ${what}` : `${name} liked your ${what}`;
}

function Row({ item, otherName }: { item: LikeItem; otherName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (item.photo_path) void resolveProfilePhotoUrl(item.photo_path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [item.photo_path]);
  const label = item.prompt_id ? promptLabel(item.prompt_id) : '';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${likeContextLine(item, otherName)}${item.note ? `: ${item.note}` : ''}`}>
      {url ? <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" accessible={false} /> : null}
      <View style={styles.text}>
        <Text style={styles.line}>{likeContextLine(item, otherName)}</Text>
        {item.answer ? (
          <Text style={styles.answer} numberOfLines={2}>
            {label ? `${label} ` : ''}
            {item.answer}
          </Text>
        ) : null}
        {item.note ? <Text style={styles.note}>{`“${item.note}”`}</Text> : null}
      </View>
    </View>
  );
}

export function LikeContextHeader({ likes, otherName }: { likes: LikeItem[] | undefined; otherName: string }) {
  const shown = (likes ?? []).filter((l) => l.target_type !== 'profile' || !!l.note);
  if (shown.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {shown.map((l, i) => (
        <Row key={`${l.created_at}-${i}`} item={l} otherName={otherName} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: obSpacing.sm, marginBottom: obSpacing.md },
  row: {
    flexDirection: 'row',
    gap: obSpacing.md,
    padding: obSpacing.md,
    borderRadius: 14,
    backgroundColor: obColors.selectedFill,
  },
  thumb: { width: 44, height: 56, borderRadius: 8, backgroundColor: obColors.notice },
  text: { flex: 1, gap: 2 },
  line: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  answer: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  note: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
});
