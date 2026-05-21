// Screen: Top eşleşme bul ve kaydet | Status: wip | Last updated: Mayıs 2026
import { calculateMatchScore, type SupabaseMatchUser } from '@/lib/matchScoring';
import { supabase } from '@/lib/supabaseClient';

export type TopMatch = {
  userId: string;
  firstName: string;
  lastName: string;
  photos: string[];
  city: string;
  matchPercentage: number;
  matchCategory: string;
  reasons: string[];
};

export async function findAndSaveTopMatches(userId: string): Promise<{
  matches: TopMatch[];
  error: string | null;
}> {
  try {
    const { data: currentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (profileErr || !currentProfile) return { matches: [], error: 'Profil bulunamadı' };

    const { data: currentAnswers, error: answersErr } = await supabase
      .from('onboarding_answers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (answersErr || !currentAnswers) return { matches: [], error: 'Onboarding cevapları bulunamadı' };

    const { data: candidates, error: candErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('setup_completed', true)
      .neq('id', userId);
    if (candErr || !candidates) return { matches: [], error: 'Adaylar çekilemedi' };

    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length === 0) return { matches: [], error: null };

    const { data: allAnswers, error: allAnswersErr } = await supabase
      .from('onboarding_answers')
      .select('*')
      .in('user_id', candidateIds);
    if (allAnswersErr) return { matches: [], error: allAnswersErr.message };

    const answersMap = new Map((allAnswers ?? []).map((a) => [a.user_id, a]));

    const currentUser: SupabaseMatchUser = {
      profiles: currentProfile,
      onboarding_answers: currentAnswers,
    };
    const scored: (TopMatch & { score: number })[] = [];

    for (const candidate of candidates) {
      const candidateAnswers = answersMap.get(candidate.id);
      if (!candidateAnswers) continue;

      const result = calculateMatchScore(currentUser, {
        profiles: candidate,
        onboarding_answers: candidateAnswers,
      });
      if (!result.ok) continue;

      scored.push({
        userId: candidate.id,
        firstName: candidate.first_name ?? '',
        lastName: candidate.last_name ?? '',
        photos: candidate.photos ?? [],
        city: candidate.city ?? '',
        matchPercentage: result.matchPercentage,
        matchCategory: result.matchCategory,
        reasons: result.reasons,
        score: result.matchPercentage,
      });
    }

    const top3 = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    if (top3.length > 0) {
      const { error: deleteErr } = await supabase.from('matches').delete().eq('user_id', userId).eq('status', 'pending');
      if (deleteErr) return { matches: [], error: deleteErr.message };

      const rows = top3.map((match) => ({
        user_id: userId,
        matched_user_id: match.userId,
        match_percentage: match.matchPercentage,
        match_category: match.matchCategory,
        reasons: match.reasons,
        status: 'pending',
        expires_at: expiresAt,
      }));
      const { error: insertErr } = await supabase.from('matches').insert(rows);
      if (insertErr) return { matches: [], error: insertErr.message };
    }

    return { matches: top3.map(({ score: _score, ...m }) => m), error: null };
  } catch (err) {
    console.error('findAndSaveTopMatches error:', err);
    return { matches: [], error: String(err) };
  }
}
