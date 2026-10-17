// V2 chat: a compact "How it started" card at the top of the conversation
// (inside the message list, so it scrolls away with the chat). Collapsed: a
// small thumbnail for a liked photo — or an icon for an answer / the whole
// profile, never a photo that wasn't liked — the real like line ("Defne liked
// your answer") and a one-line preview of the comment or answer. Tapping it
// expands every like with the full answer and comment. Context only: it is
// never a message (D70 / D79). Data: get_chat_v2 `likes`.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { likeContextLine } from '@/components/chat/LikeContext';
import { likePreview } from '@/lib/chat/howItStarted';
import type { LikeContext as LikeItem } from '@/lib/matchChatV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

const THUMB = 40;
// Text still follows the accessibility size, but this compact card grows less than the messages.
const SCALE = 1.3;

function Thumb({ item }: { item: LikeItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (item.target_type === 'photo' && item.photo_path) {
      void resolveProfilePhotoUrl(item.photo_path).then((u) => live && setUrl(u));
    }
    return () => {
      live = false;
    };
  }, [item.photo_path, item.target_type]);
  if (item.target_type === 'photo' && url) {
    return <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" accessible={false} />;
  }
  const icon = item.target_type === 'photo' ? 'image-outline' : item.target_type === 'prompt' ? 'chatbox-ellipses-outline' : 'heart-outline';
  return (
    <View style={[styles.thumb, styles.iconThumb]}>
      <Ionicons name={icon} size={18} color={obColors.cta} />
    </View>
  );
}

export function HowItStartedCard({ likes, otherName }: { likes: LikeItem[] | undefined; otherName: string }) {
  const [open, setOpen] = useState(false);
  const shown = likes ?? [];
  if (shown.length === 0) return null;
  const first = shown[0];
  const preview = likePreview(first);
  const promptOf = (l: LikeItem) => (l.prompt_id ? promptLabel(l.prompt_id) : '');
  // Something more to show when expanded: another like, the prompt question,
  // or a comment next to an answer.
  const expandable = shown.length > 1 || !!first.prompt_id || (!!first.note && !!first.answer) || !!preview;
  const summary = `${likeContextLine(first, otherName)}${preview ? `. ${preview}` : ''}`;

  return (
    <Pressable
      onPress={expandable ? () => setOpen((v) => !v) : undefined}
      disabled={!expandable}
      style={({ pressed }) => [styles.card, pressed && expandable && styles.pressed]}
      accessibilityRole={expandable ? 'button' : undefined}
      accessibilityLabel={`How it started. ${summary}${shown.length > 1 ? `. ${shown.length} likes` : ''}`}
      accessibilityState={expandable ? { expanded: open } : undefined}
      accessibilityHint={expandable ? (open ? 'Collapses the details' : 'Shows the details') : undefined}>
      {!open ? (
        <View style={styles.row}>
          <Thumb item={first} />
          <View style={styles.text}>
            <Text style={styles.line} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
              {likeContextLine(first, otherName)}
              {shown.length > 1 ? <Text style={styles.more}>{`  +${shown.length - 1}`}</Text> : null}
            </Text>
            {preview ? (
              <Text style={styles.preview} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
                {preview}
              </Text>
            ) : null}
          </View>
          {expandable ? <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} /> : null}
        </View>
      ) : (
        <View style={styles.expanded}>
          <View style={styles.expandedHead}>
            <Text style={styles.title} maxFontSizeMultiplier={SCALE}>How it started</Text>
            <Ionicons name="chevron-up" size={18} color={obColors.textSecondary} />
          </View>
          {shown.map((l, i) => (
            <View key={`${l.created_at}-${i}`} style={styles.row}>
              <Thumb item={l} />
              <View style={styles.text}>
                <Text style={styles.line} maxFontSizeMultiplier={SCALE}>{likeContextLine(l, otherName)}</Text>
                {l.answer ? (
                  <Text style={styles.answer} maxFontSizeMultiplier={SCALE}>
                    {promptOf(l) ? <Text style={styles.prompt}>{`${promptOf(l)} `}</Text> : null}
                    {l.answer}
                  </Text>
                ) : null}
                {l.note ? <Text style={styles.note} maxFontSizeMultiplier={SCALE}>{`“${l.note}”`}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: obSpacing.sm,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: obColors.selectedFill,
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 8, backgroundColor: obColors.notice },
  iconThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  line: { fontFamily: obFonts.bodySemiBold, fontSize: 13.5, lineHeight: 18, color: obColors.textPrimary },
  more: { fontFamily: obFonts.bodyMedium, fontSize: 12.5, color: obColors.textSecondary },
  preview: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 17, color: obColors.textSecondary },
  expanded: { gap: 10 },
  expandedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  answer: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  prompt: { fontFamily: obFonts.bodyMedium, color: obColors.textPrimary },
  note: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
});
