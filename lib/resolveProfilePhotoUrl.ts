import { supabase } from './supabaseClient';

const USER_PHOTOS_BUCKET = 'user-photos';

/** Storage path or full URL → renderable image URL. */
export function getProfilePhotoPublicUrl(ref: string): string {
  if (ref.startsWith('http://') || ref.startsWith('https://')) {
    return ref;
  }
  const { data } = supabase.storage.from(USER_PHOTOS_BUCKET).getPublicUrl(ref);
  return data.publicUrl;
}

export async function resolveProfilePhotoUrl(path: string): Promise<string> {
  return getProfilePhotoPublicUrl(path);
}
