// Typeahead search (P05): results appear directly under the input only after
// typing ≥ 2 characters (no suggestions on an empty query), plus an explicit
// "Use “typed text”" custom entry. Selected items are shown separately (see
// SelectedList). The query is local UI state — never part of the draft, never
// logged — so it is dismissed when leaving the screen.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useRevealInScroll } from '@/components/onboarding-v2/OnboardingScrollContext';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import type { SearchFn } from '@/lib/onboardingV2/tasteSearch';
import { makeTypeahead, type TypeaheadState } from '@/lib/onboardingV2/typeahead';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { customItem, type TasteItem, type TasteKind } from '@/lib/onboardingV2/yourWorld';

type Props = {
  kind: TasteKind;
  label: string;
  placeholder: string;
  search: SearchFn;
  onPick: (item: TasteItem) => void;
  /** IDs already selected — shown as "Added", not pickable again. */
  pickedIds: string[];
  /** When full, the input is disabled with a clear message. */
  full?: boolean;
  fullMessage?: string;
  /** Feedback for the last rejected pick (e.g. duplicate). */
  notice?: string | null;
  /** Source line shown under live results, e.g. "Suggestions from MusicBrainz". */
  attribution?: string;
};

export function Typeahead({
  kind,
  label,
  placeholder,
  search,
  onPick,
  pickedIds,
  full = false,
  fullMessage,
  notice,
  attribution,
}: Props) {
  const [text, setText] = useState('');
  const [state, setState] = useState<TypeaheadState>({ status: 'idle', query: '', results: [] });
  const ctrl = useMemo(() => makeTypeahead(search, setState), [search]);
  useEffect(() => () => ctrl.dispose(), [ctrl]);
  const wrapRef = useRef<View>(null);
  const reveal = useRevealInScroll();
  // When suggestions first appear, keep the field + results in view.
  useEffect(() => {
    if (state.status === 'done' || state.status === 'error') reveal(wrapRef);
  }, [state.status, reveal]);

  const onChange = (v: string) => {
    setText(v);
    ctrl.setQuery(v);
  };

  const pick = (item: TasteItem) => {
    onPick(item);
    setText('');
    ctrl.setQuery('');
    Keyboard.dismiss();
  };

  const custom = customItem(kind, text);
  const active = state.status !== 'idle' && !full;

  return (
    <View ref={wrapRef} style={styles.wrap}>
      <OnboardingTextField
        label={label}
        placeholder={placeholder}
        value={text}
        onChangeText={onChange}
        editable={!full}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        returnKeyType="search"
      />
      {full && fullMessage ? <Text style={styles.meta}>{fullMessage}</Text> : null}
      {notice ? (
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {active ? (
        <View style={styles.results} accessibilityRole="list">
          {state.status === 'loading' ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={obColors.cta} />
              <Text style={styles.meta}>Searching…</Text>
            </View>
          ) : null}
          {state.status === 'error' ? (
            <Text style={styles.meta} accessibilityLiveRegion="polite">
              Search isn&apos;t available right now. You can add it as typed below.
            </Text>
          ) : null}
          {state.status === 'done' && state.results.length === 0 ? (
            <Text style={styles.meta} accessibilityLiveRegion="polite">
              No matches in the preview list.
            </Text>
          ) : null}
          {state.status === 'done'
            ? state.results.map((r) => {
                const added = pickedIds.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => pick(r)}
                    disabled={added}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title}${r.subtitle ? `, ${r.subtitle}` : ''}${added ? ', already added' : ''}`}
                    style={[styles.row, added && styles.rowAdded]}>
                    <Thumb item={r} small />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} maxFontSizeMultiplier={1.6}>
                        {r.title}
                      </Text>
                      {r.subtitle ? (
                        <Text style={styles.rowSub} maxFontSizeMultiplier={1.6}>
                          {r.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {added ? <Text style={styles.addedTag}>Added</Text> : null}
                  </TouchableOpacity>
                );
              })
            : null}
          {state.status === 'done' && state.results.length > 0 && attribution ? (
            <Text style={styles.attribution}>{attribution}</Text>
          ) : null}
          {custom && state.status !== 'loading' ? (
            <TouchableOpacity
              onPress={() => pick(custom)}
              disabled={pickedIds.includes(custom.id)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${custom.title} as typed`}
              style={[styles.row, styles.customRow]}>
              <Ionicons name="add" size={18} color={obColors.cta} />
              <Text style={styles.customText} maxFontSizeMultiplier={1.6}>
                Use “{custom.title}”
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const TASTE_ICON: Record<TasteKind, keyof typeof Ionicons.glyphMap> = {
  school: 'school-outline',
  hometown: 'location-outline',
  artist: 'person-outline',
  book: 'book-outline',
  screen: 'film-outline',
};

/** Provider image only when supplied and permitted (Open Library covers);
 * otherwise a neutral placeholder glyph. Decorative for screen readers. */
function Thumb({ item, small = false }: { item: TasteItem; small?: boolean }) {
  const tall = item.kind === 'book' || item.kind === 'screen';
  return (
    <View
      style={[styles.thumb, tall && styles.thumbTall, small && (tall ? styles.thumbTallSmall : styles.thumbSmall)]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Ionicons name={TASTE_ICON[item.kind]} size={small ? 15 : 18} color={obColors.cta} />
      )}
    </View>
  );
}

/** Selected items — visually distinct from search results (filled rows with
 * a neutral placeholder thumbnail and a remove button). No images are shown:
 * none are verified in the preview catalog. */
export function SelectedList({
  items,
  onRemove,
}: {
  items: TasteItem[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.selected}>
      {items.map((it) => (
        <View key={it.id} style={styles.selRow}>
          <Thumb item={it} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} maxFontSizeMultiplier={1.6}>
              {it.title}
            </Text>
            {it.source === 'custom' || it.subtitle ? (
              <Text style={styles.rowSub} maxFontSizeMultiplier={1.6}>
                {it.source === 'custom' ? 'Added as typed' : it.subtitle}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => onRemove(it.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${it.title}`}
            style={styles.remove}>
            <Ionicons name="close" size={18} color={obColors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.sm,
  },
  results: {
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    padding: obSpacing.md,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: obColors.border,
  },
  rowAdded: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    color: obColors.textPrimary,
  },
  rowSub: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  addedTag: {
    fontFamily: obFonts.body,
    fontSize: 13,
    color: obColors.textSecondary,
  },
  customText: {
    flex: 1,
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.cta,
  },
  meta: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm,
  },
  selected: {
    gap: obSpacing.sm,
  },
  selRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: obColors.cta,
    backgroundColor: obColors.selectedFill,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: obColors.background,
    borderWidth: 1,
    borderColor: obColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTall: {
    width: 32,
    height: 44,
    borderRadius: 4,
  },
  thumbSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  thumbTallSmall: {
    width: 24,
    height: 34,
    borderRadius: 3,
  },
  customRow: {
    backgroundColor: obColors.notice,
  },
  attribution: {
    fontFamily: obFonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: obColors.textSecondary,
    paddingHorizontal: obSpacing.md,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: obColors.border,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
