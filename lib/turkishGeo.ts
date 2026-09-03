// City + district reference data for onboarding location autocomplete
// (Raya-style "type → pick from list" instead of free typing, so
// "Kadikoy" and "Kadıköy" become the same canonical value — 2026-09-02).
// Static/local, no paid geocoding API (user explicitly declined the cost).

export const CITY_OPTIONS = ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'] as const;
export type CityOption = (typeof CITY_OPTIONS)[number];

export function formatCityLabel(city: CityOption): string {
  return `${city}, Turkey`;
}

export function formatDistrictLabel(district: string, city: CityOption): string {
  return `${district}, ${city}`;
}

// Real ilçe (district) lists for the 5 supported cities, canonical Turkish
// spelling/diacritics. Selecting from here (instead of typing freely) is
// what makes discovery_max_distance's district match reliable.
export const DISTRICTS_BY_CITY: Record<CityOption, string[]> = {
  Istanbul: [
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
    'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
    'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
    'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
    'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
    'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
    'Ümraniye', 'Üsküdar', 'Zeytinburnu',
  ],
  Ankara: [
    'Akyurt', 'Altındağ', 'Ayaş', 'Bala', 'Beypazarı', 'Çamlıdere', 'Çankaya',
    'Çubuk', 'Elmadağ', 'Etimesgut', 'Evren', 'Gölbaşı', 'Güdül', 'Haymana',
    'Kalecik', 'Kazan', 'Keçiören', 'Kızılcahamam', 'Mamak', 'Nallıhan',
    'Polatlı', 'Pursaklar', 'Sincan', 'Şereflikoçhisar', 'Yenimahalle',
  ],
  Izmir: [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama', 'Beydağ', 'Bornova',
    'Buca', 'Çeşme', 'Çiğli', 'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe',
    'Karabağlar', 'Karaburun', 'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz',
    'Konak', 'Menderes', 'Menemen', 'Narlıdere', 'Ödemiş', 'Seferihisar',
    'Selçuk', 'Tire', 'Torbalı', 'Urla',
  ],
  Bursa: [
    'Büyükorhan', 'Gemlik', 'Gürsu', 'Harmancık', 'İnegöl', 'İznik', 'Karacabey',
    'Keles', 'Kestel', 'Mudanya', 'Mustafakemalpaşa', 'Nilüfer', 'Orhaneli',
    'Orhangazi', 'Osmangazi', 'Yenişehir', 'Yıldırım',
  ],
  Antalya: [
    'Akseki', 'Aksu', 'Alanya', 'Demre', 'Döşemealtı', 'Elmalı', 'Finike',
    'Gazipaşa', 'Gündoğmuş', 'İbradı', 'Kaş', 'Kemer', 'Kepez', 'Konyaaltı',
    'Korkuteli', 'Kumluca', 'Manavgat', 'Muratpaşa', 'Serik',
  ],
};

const TR_DIACRITICS: Record<string, string> = {
  ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c',
  Ş: 's', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ü: 'u', Ç: 'c',
};

export function normalizeTr(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[şğıöüçŞĞİIÖÜÇ]/g, (ch) => TR_DIACRITICS[ch] ?? ch);
}

export function searchCities(query: string): CityOption[] {
  const q = normalizeTr(query);
  if (!q) return [...CITY_OPTIONS];
  return CITY_OPTIONS.filter((c) => normalizeTr(c).includes(q));
}

export function searchDistricts(city: CityOption, query: string): string[] {
  const list = DISTRICTS_BY_CITY[city] ?? [];
  const q = normalizeTr(query);
  if (!q) return list;
  return list.filter((d) => normalizeTr(d).includes(q));
}

export function canonicalDistrict(city: CityOption, raw: string): string | null {
  const target = normalizeTr(raw);
  if (!target) return null;
  const list = DISTRICTS_BY_CITY[city] ?? [];
  return list.find((d) => normalizeTr(d) === target) ?? null;
}
