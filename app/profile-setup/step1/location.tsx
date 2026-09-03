// Step1 screen 7/9 — city + district ("where do you live" — grouped
// together since they're the same real-world question, per user request).
// Raya-style type-to-search autocomplete for both fields (2026-09-02):
// typing "is" suggests "Istanbul, Turkey", typing "kadi" suggests
// "Kadıköy" — picking from the list means "Kadikoy" and "Kadıköy" both
// resolve to the same canonical value, which is what makes the
// discovery_max_distance district filter (get_top_matches) reliable.
import { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { Chip } from '@/components/ui/Chip';
import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import {
  DISCOVERY_DISTANCE_OPTIONS,
  TOTAL_SCREENS,
  useStep1,
} from '@/lib/onboardingStep1Context';
import {
  CITY_OPTIONS,
  canonicalDistrict,
  formatCityLabel,
  formatDistrictLabel,
  normalizeTr,
  searchCities,
  searchDistricts,
  type CityOption,
} from '@/lib/turkishGeo';

export default function Step1Location() {
  const router = useRouter();
  const {
    city,
    setCity,
    district,
    setDistrict,
    discoveryDistance,
    setDiscoveryDistance,
    setLatLng,
  } = useStep1();
  const [locating, setLocating] = useState(false);
  const [cityQuery, setCityQuery] = useState(formatCityLabel(city));
  const [cityFocused, setCityFocused] = useState(false);
  const [districtQuery, setDistrictQuery] = useState(
    district ? formatDistrictLabel(district, city) : '',
  );
  const [districtFocused, setDistrictFocused] = useState(false);
  const canProceed = district.trim().length > 0;

  const cityMatches = useMemo(() => searchCities(cityQuery), [cityQuery]);
  const districtMatches = useMemo(
    () => searchDistricts(city, districtQuery),
    [city, districtQuery],
  );

  const pickCity = (opt: CityOption) => {
    setCity(opt);
    setCityQuery(formatCityLabel(opt));
    setCityFocused(false);
    if (canonicalDistrict(opt, district) === null) {
      setDistrict('');
      setDistrictQuery('');
    } else {
      // District wasn't touched, still valid for the new city — nothing
      // left to fill in, so dismiss like a district pick would.
      Keyboard.dismiss();
    }
  };

  const pickDistrict = (name: string) => {
    setDistrict(name);
    setDistrictQuery(formatDistrictLabel(name, city));
    setDistrictFocused(false);
    // Picking from the list means there's nothing left to type — dismiss
    // instead of leaving the keyboard up and forcing a manual return-key
    // tap to reach Next (user feedback, 2026-09-03).
    Keyboard.dismiss();
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Please allow location access to use this.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatLng(position.coords.latitude, position.coords.longitude);

      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (place) {
        const geocodedCity = place.city?.trim();
        const resolvedCity = geocodedCity
          ? CITY_OPTIONS.find((opt) => normalizeTr(opt) === normalizeTr(geocodedCity))
          : undefined;
        const finalCity = resolvedCity ?? city;
        if (resolvedCity) {
          setCity(resolvedCity);
          setCityQuery(formatCityLabel(resolvedCity));
        }

        const geocodedDistrict = place.district || place.subregion;
        if (geocodedDistrict) {
          const canonical = canonicalDistrict(finalCity, geocodedDistrict);
          const resolvedDistrict = canonical ?? geocodedDistrict;
          setDistrict(resolvedDistrict);
          setDistrictQuery(formatDistrictLabel(resolvedDistrict, finalCity));
        }
      }
    } catch (e: any) {
      Alert.alert('Location', e?.message ?? 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <QuestionScreen
      step={7}
      totalSteps={TOTAL_SCREENS}
      title="Where are you based?"
      onNext={() => router.push('/profile-setup/step1/gender')}
      nextDisabled={!canProceed}>
      <View style={[styles.block, styles.cityBlock]}>
        <ThemedText style={styles.label}>City</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Istanbul"
          placeholderTextColor="#AAAAAA"
          value={cityQuery}
          onChangeText={setCityQuery}
          onFocus={() => setCityFocused(true)}
          onBlur={() => setTimeout(() => setCityFocused(false), 150)}
        />
        {cityFocused && cityMatches.length > 0 ? (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {cityMatches.map((opt) => (
                <Pressable key={opt} style={styles.dropdownItem} onPress={() => pickCity(opt)}>
                  <ThemedText style={styles.dropdownItemText}>{formatCityLabel(opt)}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={[styles.block, styles.districtBlock]}>
        <ThemedText style={styles.label}>District / neighbourhood</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Kadıköy"
          placeholderTextColor="#AAAAAA"
          autoCapitalize="words"
          value={districtQuery}
          onChangeText={setDistrictQuery}
          onFocus={() => setDistrictFocused(true)}
          onBlur={() => setTimeout(() => setDistrictFocused(false), 150)}
        />
        {districtFocused && districtMatches.length > 0 ? (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {districtMatches.map((name) => (
                <Pressable key={name} style={styles.dropdownItem} onPress={() => pickDistrict(name)}>
                  <ThemedText style={styles.dropdownItemText}>{formatDistrictLabel(name, city)}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={[styles.block, styles.staticBlock]}>
        <ThemedText style={styles.label}>How far should we look for matches?</ThemedText>
        <View style={styles.chipRow}>
          {DISCOVERY_DISTANCE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={discoveryDistance === opt.value}
              onPress={() => setDiscoveryDistance(opt.value)}
              selectedColor="#1A1A1A"
            />
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.locationBtn}
        onPress={() => void useMyLocation()}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel="Use my location"
        accessibilityState={{ disabled: locating }}>
        <ThemedText style={styles.locationBtnText}>
          {locating ? 'Locating…' : 'Use my location'}
        </ThemedText>
      </TouchableOpacity>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20, position: 'relative' },
  // Dropdown-bearing blocks must stack above everything that follows them
  // in source order (RN paints later siblings on top by default) — city's
  // dropdown can spill over the district block, so it needs to win too.
  // The static block below (distance chips) never has a dropdown, so it's
  // safe to leave at the implicit base stacking level (2026-09-03, found
  // via device testing: the district dropdown was rendering *behind* the
  // "How far..." label instead of over it).
  cityBlock: { zIndex: 30 },
  districtBlock: { zIndex: 20 },
  staticBlock: { zIndex: 1 },
  label: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 200 },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  dropdownItemText: { color: colors.textPrimary, fontSize: 15 },
  locationBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  locationBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});
