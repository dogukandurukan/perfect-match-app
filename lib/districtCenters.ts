export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  // İstanbul
  Sisli: { lat: 41.0602, lng: 28.9877 },
  Atasehir: { lat: 40.9923, lng: 29.1244 },
  Kadikoy: { lat: 40.9906, lng: 29.0233 },
  Maltepe: { lat: 40.9351, lng: 29.15 },
  Beyoglu: { lat: 41.0333, lng: 28.975 },
  Uskudar: { lat: 41.0231, lng: 29.0128 },
  Besiktas: { lat: 41.0422, lng: 29.0067 },
  Moda: { lat: 40.9833, lng: 29.0267 },

  // İzmir
  Konak: { lat: 38.4192, lng: 27.1287 },
  Bornova: { lat: 38.4681, lng: 27.2167 },
  Karsiyaka: { lat: 38.4567, lng: 27.1119 },

  // Ankara
  Kecioren: { lat: 39.975, lng: 32.8597 },
  Cankaya: { lat: 39.9179, lng: 32.8624 },
  Yenimahalle: { lat: 39.9667, lng: 32.8167 },
};

/** Kullanıcının district'ine göre merkez koordinat döndürür.
 *  Bilinmeyen semt için null döner. */
export function getDistrictCenter(district: string | null): { lat: number; lng: number } | null {
  if (!district) return null;
  return DISTRICT_CENTERS[district] ?? null;
}
