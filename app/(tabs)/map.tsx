// Screen: Harita sekmesi | Status: test | Last updated: Mayıs 2026
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { getDistrictCenter } from '@/lib/districtCenters';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ISTANBUL = { latitude: 41.0082, longitude: 28.9784 };
const REGION_DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_H_PADDING = 12;
const GRID_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP) / 2;
const PHOTO_HEIGHT = 200;

type MapUser = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  photos: string[] | null;
  district: string | null;
};

type DistrictCluster = {
  district: string;
  lat: number;
  lng: number;
  users: MapUser[];
};

function safeAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

async function getInitialLocation(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return ISTANBUL;

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  } catch {
    return ISTANBUL;
  }
}

function ClusterUserCard({
  user,
  photoUrl,
  photoLoading,
  onDismiss,
  onReport,
  onCardPress,
}: {
  user: MapUser;
  photoUrl: string | null;
  photoLoading: boolean;
  onDismiss: (userId: string) => void;
  onReport: (userId: string) => void;
  onCardPress: (userId: string) => void;
}) {
  const age = safeAge(user.date_of_birth);
  const nameLine = [user.first_name ?? 'Kullanıcı', age != null ? String(age) : null]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      style={styles.gridCard}
      activeOpacity={0.85}
      onPress={() => onCardPress(user.id)}>
      <View style={styles.photoWrap}>
        {photoLoading ? (
          <View style={styles.photoPlaceholder}>
            <ActivityIndicator color="#888" size="small" />
          </View>
        ) : photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder} />
        )}

        <TouchableOpacity
          style={styles.dismissBtn}
          activeOpacity={0.8}
          onPress={(e) => {
            e.stopPropagation();
            onDismiss(user.id);
          }}>
          <ThemedText style={styles.dismissBtnText}>×</ThemedText>
        </TouchableOpacity>

        <View style={styles.nowBadge} pointerEvents="none">
          <ThemedText style={styles.nowBadgeText}>Now</ThemedText>
        </View>

        <TouchableOpacity
          style={styles.reportBtn}
          activeOpacity={0.8}
          onPress={(e) => {
            e.stopPropagation();
            onReport(user.id);
          }}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.userMeta}>{nameLine}</ThemedText>
    </TouchableOpacity>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<MapUser[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<DistrictCluster | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [photosLoading, setPhotosLoading] = useState(false);
  const [region, setRegion] = useState({
    ...ISTANBUL,
    ...REGION_DELTA,
  });

  const clusters = useMemo(() => {
    const map = new Map<string, DistrictCluster>();
    for (const user of users) {
      if (!user.district) continue;
      const center = getDistrictCenter(user.district);
      if (!center) continue;
      if (!map.has(user.district)) {
        map.set(user.district, {
          district: user.district,
          lat: center.lat,
          lng: center.lng,
          users: [],
        });
      }
      map.get(user.district)!.users.push(user);
    }
    return Array.from(map.values());
  }, [users]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const initial = await getInitialLocation();

      let query = supabase
        .from('profiles')
        .select('id, first_name, date_of_birth, photos, district')
        .not('district', 'is', null)
        .eq('is_hidden', false)
        .eq('hide_location', false);

      if (user?.id) {
        query = query.neq('id', user.id);
      }

      const { data, error } = await query;

      if (!mounted) return;

      if (!error && data) {
        const withDistrict = data
          .map((row) => {
            if (!getDistrictCenter(row.district)) return null;
            return {
              id: row.id,
              first_name: row.first_name,
              date_of_birth: row.date_of_birth,
              photos: row.photos,
              district: row.district,
            };
          })
          .filter((row): row is MapUser => row !== null);
        setUsers(withDistrict);
      }

      setRegion({
        latitude: initial.latitude,
        longitude: initial.longitude,
        ...REGION_DELTA,
      });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCluster) {
      setPhotoUrls({});
      setPhotosLoading(false);
      return;
    }

    let mounted = true;
    setPhotosLoading(true);
    setPhotoUrls({});

    (async () => {
      const entries = await Promise.all(
        selectedCluster.users.map(async (u) => {
          const path = u.photos?.[0];
          if (!path) return [u.id, null] as const;
          const url = await resolveProfilePhotoUrl(path, 3600);
          return [u.id, url] as const;
        }),
      );
      if (!mounted) return;
      setPhotoUrls(Object.fromEntries(entries));
      setPhotosLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [selectedCluster]);

  function handleDismissUser(userId: string) {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedCluster((prev) => {
      if (!prev) return null;
      const nextUsers = prev.users.filter((u) => u.id !== userId);
      if (nextUsers.length === 0) return null;
      return { ...prev, users: nextUsers };
    });
  }

  function handleReportUser(userId: string) {
    Alert.alert('Report user', 'Do you want to report this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from('reports').insert({
            reporter_id: user.id,
            reported_id: userId,
            reason: 'Reported from map',
          });
          Alert.alert('Report submitted', 'Thank you for your feedback.');
        },
      },
    ]);
  }

  function handleCardPress(userId: string) {
    setSelectedCluster(null);
    setTimeout(() => {
      router.push({
        pathname: '/user-profile',
        params: { userId },
      } as any);
    }, 300);
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <ThemedText style={styles.loadingText}>Harita yükleniyor...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation showsMyLocationButton>
        {clusters.map((cluster) => (
          <Marker
            key={cluster.district}
            coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
            onPress={() => setSelectedCluster(cluster)}
            tracksViewChanges={false}>
            <View style={styles.clusterMarkerWrap}>
              <View style={styles.clusterCircle}>
                <ThemedText style={styles.clusterCount}>{cluster.users.length}</ThemedText>
              </View>
              <ThemedText style={styles.clusterLabel}>
                {cluster.district} • {cluster.users.length}
              </ThemedText>
            </View>
          </Marker>
        ))}
      </MapView>

      <Modal
        visible={selectedCluster !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCluster(null)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedCluster(null)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>
                {selectedCluster?.district} • {selectedCluster?.users.length ?? 0} kişi
              </ThemedText>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedCluster(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedCluster?.users ?? []}
              keyExtractor={(item) => item.id}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <ClusterUserCard
                  user={item}
                  photoUrl={photoUrls[item.id] ?? null}
                  photoLoading={photosLoading && !(item.id in photoUrls)}
                  onDismiss={handleDismissUser}
                  onReport={handleReportUser}
                  onCardPress={handleCardPress}
                />
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 12,
  },
  loadingText: { color: '#888', fontSize: 15 },
  clusterMarkerWrap: {
    alignItems: 'center',
    gap: 4,
  },
  clusterCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  clusterCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  clusterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    height: '75%',
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: GRID_H_PADDING,
    paddingBottom: 16,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
  photoWrap: {
    width: '100%',
    height: PHOTO_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  nowBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nowBadgeText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '600',
  },
  reportBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMeta: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
