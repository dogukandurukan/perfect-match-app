// DEV Activity preview only: bundled placeholder photos ("DEV · SYNTHETIC"
// illustrations of fictional people, not final). Never imported by the real
// Activity tab.
import { DISCOVER_PHOTOS } from '@/components/dev/discover/previewPhotos';

export const ACTIVITY_PHOTOS: Record<string, number[]> = {
  defne: DISCOVER_PHOTOS.defne,
  ece: DISCOVER_PHOTOS.ece,
  /** "Me" — the photos and answers the others liked. */
  mert: DISCOVER_PHOTOS.mert,
  asya: [require('../../../assets/dev/activity-preview/asya-1.png'), require('../../../assets/dev/activity-preview/asya-2.png')],
  zeynep: [require('../../../assets/dev/activity-preview/zeynep-1.png'), require('../../../assets/dev/activity-preview/zeynep-2.png')],
  melis: [require('../../../assets/dev/activity-preview/melis-1.png'), require('../../../assets/dev/activity-preview/melis-2.png')],
};

export const activityPhoto = (personId: string, i = 0): number | null => ACTIVITY_PHOTOS[personId]?.[i] ?? null;
