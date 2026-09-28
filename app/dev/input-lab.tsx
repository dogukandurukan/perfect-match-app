// DEV-ONLY, TEMPORARY (P05 R2): side-by-side iOS text-input variants to
// isolate the placeholder clipping. One phone screenshot of this screen
// shows which factor matters (padding vs font vs border location vs height).
// No backend, no draft, nothing saved. Redirects in production. Remove once
// the cause is confirmed on device.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingTextField, fieldHeight, INPUT_FONT_SIZE } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors, obFonts, useOnboardingFonts } from '@/lib/onboardingV2/theme';

const TYPED = 'Designer gjpqy Şğ';

type Variant = {
  id: string;
  what: string;
  font?: string;
  padTop: number;
  padBottom: number;
  borderOn: 'input' | 'wrapper';
  explicitHeight: boolean;
  lineHeight?: number;
  multiline?: boolean;
};

const VARIANTS: Variant[] = [
  { id: 'B', what: 'R1 previous: DM Sans · pad 4/8 · border on input · height', font: obFonts.body, padTop: 4, padBottom: 8, borderOn: 'input', explicitHeight: true },
  { id: 'C', what: 'B with SYSTEM font', padTop: 4, padBottom: 8, borderOn: 'input', explicitHeight: true },
  { id: 'D', what: 'DM Sans · pad 0 · border on input · height', font: obFonts.body, padTop: 0, padBottom: 0, borderOn: 'input', explicitHeight: true },
  { id: 'E', what: 'DM Sans · pad 4/8 · border in WRAPPER · height', font: obFonts.body, padTop: 4, padBottom: 8, borderOn: 'wrapper', explicitHeight: true },
  { id: 'F', what: 'DM Sans · pad 4/8 · border on input · NO height (intrinsic)', font: obFonts.body, padTop: 4, padBottom: 8, borderOn: 'input', explicitHeight: false },
  { id: 'G', what: 'DM Sans · pad 0 · explicit lineHeight 25', font: obFonts.body, padTop: 0, padBottom: 0, borderOn: 'input', explicitHeight: true, lineHeight: 25 },
  { id: 'H', what: 'DM Sans · MULTILINE (UITextView, RN-drawn native placeholder) · pad 10/10', font: obFonts.body, padTop: 10, padBottom: 10, borderOn: 'input', explicitHeight: false, multiline: true },
];

function Raw({ v, placeholder, value, h }: { v: Variant; placeholder?: string; value?: string; h: number }) {
  const [text, setText] = useState(value ?? '');
  const [measured, setMeasured] = useState<number | null>(null);
  const input = (
    <TextInput
      value={text}
      onChangeText={setText}
      placeholder={placeholder}
      placeholderTextColor={obColors.textSecondary}
      multiline={v.multiline}
      scrollEnabled={v.multiline ? false : undefined}
      submitBehavior={v.multiline ? 'blurAndSubmit' : undefined}
      onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.height))}
      style={[
        {
          fontSize: INPUT_FONT_SIZE,
          color: obColors.textPrimary,
          paddingHorizontal: 0,
          paddingTop: v.padTop,
          paddingBottom: v.padBottom,
        },
        v.font ? { fontFamily: v.font } : null,
        v.lineHeight ? { lineHeight: v.lineHeight } : null,
        v.explicitHeight ? { height: h } : { minHeight: 44 },
        v.multiline ? { textAlignVertical: 'center' as const } : null,
        v.borderOn === 'input' ? styles.border : null,
      ]}
    />
  );
  return (
    <View>
      {v.borderOn === 'wrapper' ? <View style={styles.border}>{input}</View> : input}
      <Text style={styles.meta}>frame h = {measured ?? '…'}</Text>
    </View>
  );
}

export default function InputLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const ready = useOnboardingFonts();
  if (!__DEV__) return <Redirect href="/" />;
  const h = fieldHeight(fontScale);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 200, gap: 22 }}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Input lab (DEV)</Text>
        <TouchableOpacity onPress={() => router.push('/dev/input-lab-2' as never)}>
          <Text style={styles.back}>Open Input lab 2 (inside the flow container) ›</Text>
        </TouchableOpacity>
        <Text style={styles.meta}>
          fontScale {fontScale.toFixed(2)} · fonts {ready ? 'loaded' : 'NOT loaded'} · computed height {h}
        </Text>
        <View style={styles.block}>
          <Text style={styles.vTitle}>A · CURRENT (R2) — real OnboardingTextField</Text>
          <OnboardingTextField label="Job title (optional)" placeholder="e.g. Designer" />
          <OnboardingTextField label="Typed" defaultValue={TYPED} />
        </View>
        {VARIANTS.map((v) => (
          <View key={v.id} style={styles.block}>
            <Text style={styles.vTitle}>
              {v.id} · {v.what}
            </Text>
            <Raw v={v} placeholder="e.g. Designer" h={h} />
            <Raw v={v} value={TYPED} h={h} />
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  back: { fontSize: 16, color: obColors.cta },
  title: { fontSize: 24, fontWeight: '700', color: obColors.textPrimary },
  block: { gap: 8 },
  vTitle: { fontSize: 13, fontWeight: '600', color: obColors.textPrimary },
  meta: { fontSize: 11, color: obColors.textSecondary },
  border: { borderBottomWidth: 1, borderBottomColor: obColors.border },
});
