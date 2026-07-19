import { supabase } from './supabaseClient';

export async function resolveProfilePhotoUrl(path: string): Promise<string> {
  // Eğer zaten http ile başlıyorsa direkt döndür (eski pravatar URL'leri)
  if (path.startsWith('http')) return path;

  const { data, error } = await supabase.storage
    .from('user-photos')
    .createSignedUrl(path, 60 * 60); // 1 saat geçerli

  if (error || !data?.signedUrl) return '';
  return data.signedUrl;
}
