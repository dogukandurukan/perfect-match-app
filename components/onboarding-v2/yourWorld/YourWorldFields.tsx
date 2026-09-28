// Section 5 Your World — per-step content (P05). Presentational only; the
// draft lives in PreviewFlow. Search is a DEVELOPMENT SAMPLE catalog (see
// lib/onboardingV2/tasteSearch.ts) — not live search.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { SelectedList, Typeahead } from '@/components/onboarding-v2/yourWorld/Typeahead';
import { LIVE_ATTRIBUTION } from '@/lib/onboardingV2/liveCatalog';
import {
  searchArtists,
  searchBooks,
  searchHometowns,
  searchSchools,
  searchScreen,
  type SearchFn,
} from '@/lib/onboardingV2/tasteSearch';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  INTERESTS,
  MAX_INTERESTS,
  MAX_TASTE,
  WORK_OPTIONS,
  addTaste,
  removeTaste,
  toggleInterest,
  type TasteItem,
  type TasteKind,
  type WorldDraft,
} from '@/lib/onboardingV2/yourWorld';

type Props = {
  draft: WorldDraft;
  update: (patch: Partial<WorldDraft>) => void;
};

function PreviewNote() {
  return (
    <Text style={styles.previewNote} maxFontSizeMultiplier={1.6}>
      Preview search uses a small sample list, not live results.
    </Text>
  );
}

function LiveNote() {
  return (
    <Text style={styles.previewNote} maxFontSizeMultiplier={1.6}>
      Suggestions come from public catalogs and need an internet connection.
    </Text>
  );
}

// 1 — What do you do? (optional as a whole)
export function WorkFields({ draft, update }: Props) {
  return (
    <View style={styles.stack}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {WORK_OPTIONS.map((o) => (
          <OnboardingOptionCard
            key={o.key}
            label={o.title}
            mode="single"
            selectedFill
            selected={draft.workStatus === o.key}
            onPress={() => update({ workStatus: draft.workStatus === o.key ? null : o.key })}
          />
        ))}
      </View>
      <OnboardingTextField
        label="Job title (optional)"
        placeholder="e.g. Designer"
        value={draft.jobTitle}
        onChangeText={(v) => update({ jobTitle: v })}
        autoCapitalize="sentences"
        autoCorrect={false}
        textContentType="jobTitle"
        returnKeyType="done"
      />
    </View>
  );
}

// 2 / 3 — single search-or-enter value (school, hometown)
function SingleSearch({
  kind,
  label,
  placeholder,
  search,
  value,
  onChange,
}: {
  kind: TasteKind;
  label: string;
  placeholder: string;
  search: SearchFn;
  value: TasteItem | null;
  onChange: (v: TasteItem | null) => void;
}) {
  return (
    <View style={styles.stack}>
      {value ? (
        <SelectedList items={[value]} onRemove={() => onChange(null)} />
      ) : (
        <Typeahead
          kind={kind}
          label={label}
          placeholder={placeholder}
          search={search}
          pickedIds={[]}
          onPick={(it) => onChange(it)}
        />
      )}
      <PreviewNote />
    </View>
  );
}

export function SchoolFields({ draft, update }: Props) {
  return (
    <SingleSearch
      kind="school"
      label="School"
      placeholder="Search or enter your school"
      search={searchSchools}
      value={draft.school}
      onChange={(school) => update({ school })}
    />
  );
}

export function HometownFields({ draft, update }: Props) {
  return (
    <SingleSearch
      kind="hometown"
      label="Hometown"
      placeholder="Search or enter a city"
      search={searchHometowns}
      value={draft.hometown}
      onChange={(hometown) => update({ hometown })}
    />
  );
}

// 4 — What are you into? (required 1–10, P07 R1)
export function InterestsFields({ draft, update }: Props) {
  const full = draft.interests.length >= MAX_INTERESTS;
  return (
    <View style={styles.stack}>
      <View style={styles.chips}>
        {INTERESTS.map((i) => {
          const selected = draft.interests.includes(i.key);
          const blocked = full && !selected;
          return (
            <TouchableOpacity
              key={i.key}
              onPress={() => update({ interests: toggleInterest(draft.interests, i.key) })}
              disabled={blocked}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityLabel={i.label}
              accessibilityState={{ checked: selected, disabled: blocked }}
              accessibilityHint={blocked ? 'Ten interests already chosen. Deselect one to change.' : undefined}
              style={[styles.chip, selected && styles.chipSelected, blocked && styles.chipBlocked]}>
              <Ionicons
                name={i.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={obColors.cta}
                importantForAccessibility="no"
              />
              <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>
                {i.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {draft.interests.length} of {MAX_INTERESTS} selected
        {full ? ' — deselect one to change' : ''}
      </Text>
    </View>
  );
}

// 0–3 list with search + removable selections
function TasteGroup({
  kind,
  title,
  label,
  placeholder,
  search,
  items,
  onChange,
  attribution,
}: {
  kind: TasteKind;
  title?: string;
  label: string;
  placeholder: string;
  search: SearchFn;
  items: TasteItem[];
  onChange: (list: TasteItem[]) => void;
  attribution?: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const full = items.length >= MAX_TASTE;
  return (
    <View style={styles.stack}>
      {title ? (
        <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
          {title} · {items.length} of {MAX_TASTE}
        </Text>
      ) : null}
      <Typeahead
        kind={kind}
        label={label}
        placeholder={placeholder}
        search={search}
        pickedIds={items.map((i) => i.id)}
        full={full}
        fullMessage={`You've added ${MAX_TASTE}. Remove one to add another.`}
        notice={notice}
        attribution={attribution}
        onPick={(it) => {
          const r = addTaste(items, it);
          setNotice(r.rejected === 'duplicate' ? `“${it.title}” is already added.` : null);
          if (!r.rejected) onChange(r.list);
        }}
      />
      <SelectedList
        items={items}
        onRemove={(id) => {
          setNotice(null);
          onChange(removeTaste(items, id));
        }}
      />
      {!title ? (
        <Text style={styles.count} maxFontSizeMultiplier={1.6}>
          {items.length} of {MAX_TASTE} added
        </Text>
      ) : null}
    </View>
  );
}

// 5 — Who do you listen to? (artists only, 0–3)
export function ArtistsFields({ draft, update }: Props) {
  return (
    <View style={styles.stack}>
      <TasteGroup
        kind="artist"
        label="Artists"
        placeholder="Search artists"
        search={searchArtists}
        items={draft.artists}
        onChange={(artists) => update({ artists })}
        attribution={LIVE_ATTRIBUTION.artist}
      />
      <LiveNote />
    </View>
  );
}

// 6 — Books & movies (independent 0–3 each)
export function MediaFields({ draft, update }: Props) {
  return (
    <View style={styles.mediaStack}>
      <TasteGroup
        kind="book"
        title="Books"
        label="Books"
        placeholder="Search books"
        search={searchBooks}
        items={draft.books}
        onChange={(books) => update({ books })}
        attribution={LIVE_ATTRIBUTION.book}
      />
      <TasteGroup
        kind="screen"
        title="Movies & series"
        label="Movies & series"
        placeholder="Search movies or series"
        search={searchScreen}
        items={draft.screen}
        onChange={(screen) => update({ screen })}
        attribution={LIVE_ATTRIBUTION.screen}
      />
      <LiveNote />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: obSpacing.md,
  },
  mediaStack: {
    gap: obSpacing.xxl,
  },
  options: {
    gap: obSpacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: obSpacing.sm,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 22,
  },
  chipSelected: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  chipBlocked: {
    opacity: 0.45,
  },
  chipText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  count: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  groupTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  previewNote: {
    fontFamily: obFonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: obColors.textSecondary,
  },
});
