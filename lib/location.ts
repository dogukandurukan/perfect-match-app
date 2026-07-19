import * as Location from 'expo-location';

import { supabase } from './supabaseClient';

/** Saves GPS coordinates only — never overwrites user-selected city/district. */
export async function requestAndSaveLocation(userId: string) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = location.coords;

  await supabase.from('profiles').update({ lat: latitude, lng: longitude }).eq('id', userId);

  return { lat: latitude, lng: longitude };
}
