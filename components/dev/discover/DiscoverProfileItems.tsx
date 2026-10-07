// DEV Discover preview — one profile, rendered top to bottom from
// buildDiscoverLayout(). Local only: hearts, "Add a comment" and Send call
// back into the preview reducer; nothing touches the backend.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  COMMENT_MAX,
  photoKey,
  type DiscoverItem,
  type DiscoverPerson,
  type Editor,
  type LabelledFact,
  type SentComment,
} from '@/lib/dev/discoverPreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PreviewFact, PreviewGroup, PreviewTaste } from '@/lib/onboardingV2/yourProfile';

/** Bundled placeholder photos ("DEV · SYNTHETIC" illustrations, not final). */
export const DISCOVER_PHOTOS: Record<string, number[]> = {
  defne: [
    require('../../../assets/dev/discover-preview/defne-1.png'),
    require('../../../assets/dev/discover-preview/defne-2.png'),
    require('../../../assets/dev/discover-preview/defne-3.png'),
    require('../../../assets/dev/discover-preview/defne-4.png'),
    require('../../../assets/dev/discover-preview/defne-5.png'),
    require('../../../assets/dev/discover-preview/defne-6.png'),
  ],
  mert: [
    require('../../../assets/dev/discover-preview/mert-1.png'),
    require('../../../assets/dev/discover-preview/mert-2.png'),
    require('../../../assets/dev/discover-preview/mert-3.png'),
  ],
  ece: [
    require('../../../assets/dev/discover-preview/ece-1.png'),
    require('../../../assets/dev/discover-preview/ece-2.png'),
    require('../../../assets/dev/discover-preview/ece-3.png'),
    require('../../../assets/dev/discover-preview/ece-4.png'),
  ],
};

// Smooth fade under the name: a bundled 4×256 alpha-ramp PNG (no gradient
// native module → no dev-client rebuild). Shared with the Matches preview.
const FADE = require('../../../assets/dev/matches-preview/fade.png');

const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';

export type ItemHandlers = {
  person: DiscoverPerson;
  heroHeight: number;
  editor: Editor | null;
  canLike: boolean;
  /** A like with a comment was sent to this profile: no more hearts or comments. */
  liked: boolean;
  sent: SentComment | null;
  onLike: (target: string) => void;
  onOpenComment: (target: string) => void;
  onEditComment: (text: string) => void;
  onCancelComment: () => void;
  onSendComment: () => void;
  onEditorResize: () => void;
  editorRef: (v: View | null) => void;
};

export function DiscoverProfileItems({ items, h }: { items: DiscoverItem[]; h: ItemHandlers }) {
  return (
    <View>
      {items.map((it) => {
        switch (it.type) {
          case 'hero':
          case 'photo':
            return <PhotoItem key={`photo-${it.photoIndex}`} item={it} h={h} />;
          case 'prompt':
            return <PromptItem key={it.key} item={it} h={h} />;
          case 'details':
            return <Details key="details" facts={it.facts} />;
          case 'groups':
            return <Groups key={`groups-${it.groups[0]?.title}`} groups={it.groups} />;
          case 'taste':
            return <Taste key="taste" groups={it.groups} />;
          case 'firstDate':
            return <FirstDate key="firstDate" facts={it.facts} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

// ─── Photos ────────────────────────────────────────────────────────────────

function PhotoItem({ item, h }: { item: Extract<DiscoverItem, { type: 'hero' | 'photo' }>; h: ItemHandlers }) {
  const i = item.photoIndex;
  const target = photoKey(i);
  const isHero = item.type === 'hero';
  const what = isHero ? 'main photo' : `photo ${i + 1}`;
  const editing = h.editor?.target === target;
  const sentHere = h.sent?.target === target ? h.sent : null;
  const source = DISCOVER_PHOTOS[h.person.id]?.[i];
  return (
    <View>
      <View style={isHero ? { height: h.heroHeight } : styles.photo4x5}>
        {source ? (
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityLabel={`${h.person.name}, ${what}`} />
        ) : null}
        {isHero ? (
          <>
            <Image source={FADE} style={styles.fade} contentFit="fill" accessible={false} />
            <View style={styles.heroText} pointerEvents="none">
              <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {item.name}
                {item.age !== null ? <Text style={styles.heroAge}>, {item.age}</Text> : null}
              </Text>
              {item.location ? (
                <View style={styles.heroLoc}>
                  <Ionicons name="location-outline" size={17} color="#FFFFFF" importantForAccessibility="no" />
                  <Text style={styles.heroLocText} numberOfLines={1} maxFontSizeMultiplier={1.4}>{item.location}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
        <View style={styles.photoActions} pointerEvents="box-none">
          {!editing && h.canLike ? (
            <TouchableOpacity
              onPress={() => h.onOpenComment(target)}
              style={styles.commentChip}
              accessibilityRole="button"
              accessibilityLabel={`Add a comment on ${h.person.name}’s ${what}`}>
              <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" importantForAccessibility="no" />
              <Text style={styles.commentChipText} maxFontSizeMultiplier={1.3}>Add a comment</Text>
            </TouchableOpacity>
          ) : null}
          <HeartButton onPhoto disabled={!h.canLike} label={`Like ${h.person.name}’s ${what}`} onPress={() => h.onLike(target)} />
        </View>
      </View>
      {editing ? (
        <View style={styles.photoEditorWrap}>
          <InlineEditor h={h} title={`Comment on ${h.person.name}’s ${what}`} />
        </View>
      ) : sentHere ? (
        <View style={styles.photoEditorWrap}>
          <SentNote comment={sentHere.comment} />
        </View>
      ) : null}
    </View>
  );
}

function HeartButton({ label, onPress, disabled, onPhoto }: { label: string; onPress: () => void; disabled: boolean; onPhoto?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.heart, onPhoto ? styles.heartOnPhoto : styles.heartOnCard, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}>
      <Ionicons name="heart-outline" size={onPhoto ? 28 : 24} color="#FFFFFF" importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

// ─── Prompts ───────────────────────────────────────────────────────────────

function PromptItem({ item, h }: { item: Extract<DiscoverItem, { type: 'prompt' }>; h: ItemHandlers }) {
  const editing = h.editor?.target === item.key;
  const sentHere = h.sent?.target === item.key ? h.sent : null;
  return (
    <View style={styles.promptCard}>
      <View style={styles.promptTop}>
        <View style={styles.promptText}>
          <Text style={styles.promptLabel} maxFontSizeMultiplier={1.6}>{item.label}</Text>
          <Text style={styles.promptAnswer} maxFontSizeMultiplier={1.6}>{item.answer}</Text>
        </View>
        <HeartButton disabled={!h.canLike} label={`Like ${h.person.name}’s answer: ${item.label}`} onPress={() => h.onLike(item.key)} />
      </View>
      {editing ? (
        <InlineEditor h={h} />
      ) : sentHere ? (
        <SentNote comment={sentHere.comment} />
      ) : !h.canLike ? null : (
        <TouchableOpacity
          onPress={() => h.onOpenComment(item.key)}
          style={styles.commentLink}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`Add a comment on ${h.person.name}’s answer: ${item.label}`}>
          <Ionicons name="chatbubble-outline" size={20} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.commentLinkText} maxFontSizeMultiplier={1.4}>Add a comment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Inline comment editor (no modal / sheet) ──────────────────────────────

function InlineEditor({ h, title }: { h: ItemHandlers; title?: string }) {
  const draft = h.editor?.draft ?? '';
  const canSend = h.canLike && draft.trim().length > 0;
  return (
    <View ref={h.editorRef} style={styles.editor} collapsable={false}>
      <Text style={styles.editorLabel} maxFontSizeMultiplier={1.6}>{title ?? 'Your comment'}</Text>
      <TextInput
        value={draft}
        onChangeText={h.onEditComment}
        autoFocus
        multiline
        maxLength={COMMENT_MAX}
        // "Done" closes the keyboard only: the draft stays, nothing is sent.
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onContentSizeChange={h.onEditorResize}
        placeholder="Add a comment"
        placeholderTextColor={obColors.textSecondary}
        style={styles.editorInput}
        accessibilityLabel="Your comment"
        accessibilityHint="Done closes the keyboard and keeps your comment"
      />
      <Text style={styles.counter}>{`${draft.length}/${COMMENT_MAX}`}</Text>
      <View style={styles.editorRow}>
        <TouchableOpacity onPress={h.onCancelComment} hitSlop={10} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel comment">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={h.onSendComment}
          disabled={!canSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send like with comment"
          accessibilityState={{ disabled: !canSend }}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Shown where the editor was, after Send: the note + a small status line.
 * No toast, modal or animation. */
function SentNote({ comment }: { comment: string }) {
  return (
    <View style={styles.sent} accessible accessibilityLabel={`Comment sent: ${comment}`} accessibilityLiveRegion="polite">
      <Text style={styles.sentComment} numberOfLines={3} maxFontSizeMultiplier={1.6}>{comment}</Text>
      <View style={styles.sentStatus}>
        <Ionicons name="checkmark" size={15} color={obColors.textSecondary} importantForAccessibility="no" />
        <Text style={styles.sentStatusText} maxFontSizeMultiplier={1.6}>Comment sent</Text>
      </View>
    </View>
  );
}

// ─── Information sections ──────────────────────────────────────────────────

function FactIcon({ icon, family }: { icon: string; family?: 'ion' | 'mci' }) {
  if (family === 'mci') {
    return <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={19} color={obColors.cta} importantForAccessibility="no" />;
  }
  return <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color={obColors.cta} importantForAccessibility="no" />;
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.6}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

/** Hometown / Height / Zodiac in a compact two-column grid; Job and School
 * each get a full-width row below, so long values wrap naturally instead of
 * stacking in a narrow column. Same type size and weight everywhere. */
function Details({ facts }: { facts: LabelledFact[] }) {
  const short = facts.filter((f) => !f.wide);
  const wide = facts.filter((f) => f.wide);
  return (
    <Section>
      {short.length ? (
        <View style={styles.detailsGrid}>
          {short.map((f) => (
            <DetailCell key={f.label} fact={f} style={styles.detailCell} />
          ))}
        </View>
      ) : null}
      {wide.map((f) => (
        <DetailCell key={f.label} fact={f} style={styles.detailWide} />
      ))}
    </Section>
  );
}

function DetailCell({ fact, style }: { fact: LabelledFact; style: object }) {
  return (
    <View style={style} accessible accessibilityLabel={`${fact.label}: ${fact.value}`}>
      <FactIcon icon={fact.icon} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel} maxFontSizeMultiplier={1.6}>{fact.label}</Text>
        <Text style={styles.detailValue} maxFontSizeMultiplier={1.6}>{fact.value}</Text>
      </View>
    </View>
  );
}

function FactLine({ fact }: { fact: PreviewFact }) {
  return (
    <View style={styles.factLine}>
      <FactIcon icon={fact.icon} family={fact.family} />
      <Text style={styles.factText} maxFontSizeMultiplier={1.6}>{fact.text}</Text>
    </View>
  );
}

function Groups({ groups }: { groups: PreviewGroup[] }) {
  return (
    <View style={styles.sectionStack}>
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <View style={styles.wrapFacts}>
            {g.items.map((f) => (
              <FactLine key={f.text} fact={f} />
            ))}
          </View>
        </Section>
      ))}
    </View>
  );
}

const TASTE_ICON = { artist: 'musical-notes-outline', book: 'book-outline', screen: 'film-outline' } as const;

/** Text-only rows: no artist / film images exist, so no empty image boxes. */
function Taste({ groups }: { groups: PreviewTaste[] }) {
  return (
    <View style={styles.sectionStack}>
      {groups.map((g) => (
        <Section key={g.label} title={g.label}>
          {g.items.map((it) => (
            <View key={it.id} style={styles.tasteRow}>
              <FactIcon icon={TASTE_ICON[g.kind]} />
              <View style={styles.detailText}>
                <Text style={styles.detailValue} maxFontSizeMultiplier={1.6}>{it.title}</Text>
                {it.subtitle ? <Text style={styles.tasteSub} maxFontSizeMultiplier={1.6}>{it.subtitle}</Text> : null}
              </View>
            </View>
          ))}
        </Section>
      ))}
    </View>
  );
}

/** Profile information only — no invite / plan button here. */
function FirstDate({ facts }: { facts: PreviewFact[] }) {
  return (
    <Section title="First dates">
      {facts.map((f) => (
        <FactLine key={f.text} fact={f} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  photo4x5: { width: '100%', aspectRatio: 4 / 5, backgroundColor: obColors.selectedFill },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  heroText: { position: 'absolute', left: obSpacing.lg + 4, right: obSpacing.lg + 4, bottom: 92, gap: 4 },
  heroName: {
    fontFamily: obFonts.heading,
    fontSize: 34,
    lineHeight: 41,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroAge: { fontFamily: obFonts.heading, color: '#FFFFFF' },
  heroLoc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLocText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 17, lineHeight: 22, color: '#FFFFFF' },
  // Heart + comment chip, bottom-right (× floats bottom-left).
  photoActions: { position: 'absolute', right: obSpacing.lg, bottom: obSpacing.lg, flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  commentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(28,27,24,0.55)',
  },
  commentChipText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: '#FFFFFF' },
  heart: { alignItems: 'center', justifyContent: 'center' },
  heartOnPhoto: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(28,27,24,0.18)' },
  heartOnCard: { width: 48, height: 48, borderRadius: 24, backgroundColor: obColors.cta },
  disabled: { opacity: 0.4 },
  photoEditorWrap: { paddingHorizontal: obSpacing.md, paddingTop: obSpacing.md },
  promptCard: {
    marginHorizontal: obSpacing.md,
    marginVertical: obSpacing.md,
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: obSpacing.lg + 2,
    gap: obSpacing.md,
  },
  promptTop: { flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.md },
  promptText: { flex: 1, gap: obSpacing.sm },
  promptLabel: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textSecondary },
  promptAnswer: { fontFamily: obFonts.heading, fontSize: 25, lineHeight: 32, color: obColors.textPrimary },
  commentLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  commentLinkText: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  editor: { gap: obSpacing.sm },
  editorLabel: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  // ~2 lines to start; grows to ~5 lines, then scrolls inside.
  editorInput: {
    minHeight: 64,
    maxHeight: 132,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: obSpacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: -4, fontFamily: obFonts.body, fontSize: 12, lineHeight: 16, color: obColors.textSecondary },
  editorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { minHeight: 44, justifyContent: 'center' },
  cancelText: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  send: { minHeight: 48, minWidth: 112, paddingHorizontal: obSpacing.xl, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: obColors.ctaDisabled },
  sendText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
  // Compact: small padding, 15 pt note (max 3 lines), status on one line.
  sent: { gap: 2, borderRadius: 10, backgroundColor: obColors.selectedFill, paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm },
  sentComment: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  sentStatus: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sentStatusText: { fontFamily: obFonts.bodyMedium, fontSize: 12, lineHeight: 16, color: obColors.textSecondary },
  section: { paddingHorizontal: obSpacing.lg + 4, paddingVertical: obSpacing.lg, gap: obSpacing.md },
  sectionStack: { paddingVertical: obSpacing.xs },
  sectionTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.5, textTransform: 'uppercase', color: obColors.textSecondary },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: obSpacing.lg },
  detailCell: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.sm, paddingRight: obSpacing.md },
  detailWide: { flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.sm },
  detailText: { flex: 1, gap: 1 },
  detailLabel: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  detailValue: { fontFamily: obFonts.bodyMedium, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  wrapFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: obSpacing.lg, rowGap: obSpacing.sm },
  factLine: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, maxWidth: '100%' },
  factText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  tasteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.sm },
  tasteSub: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
});
