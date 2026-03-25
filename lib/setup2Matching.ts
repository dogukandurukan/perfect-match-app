import type { IntentKey } from '@/lib/onboardingIntent';

type MaybeText = string | null | undefined;

export type Setup2AnswersFields = {
  sub_intent?: MaybeText;
  friendship_type?: MaybeText;
  shared_interests_importance?: MaybeText;
  social_preference?: MaybeText;
  casualness_expectation?: MaybeText;
  exclusivity_view?: MaybeText;
  marriage_view?: MaybeText;
  children_view?: MaybeText;
  living_preference?: MaybeText;
  life_priority?: MaybeText;
  commitment_view?: MaybeText;
};

function same(a: MaybeText, b: MaybeText): boolean {
  return !!a && !!b && a === b;
}

function bothFlex(a: MaybeText, b: MaybeText, flexible: string): boolean {
  return a === flexible || b === flexible;
}

export function intentScore(a: IntentKey, b: IntentKey): number {
  if (a === 'not_sure_yet' && b === 'not_sure_yet') return 15;
  if (a === b) return 20;
  if (a === 'not_sure_yet' || b === 'not_sure_yet') return 10;
  return 0;
}

export function friendshipTypeScore(a: MaybeText, b: MaybeText): number {
  if (same(a, b)) return 10;
  if (bothFlex(a, b, 'Both')) return 5;
  return 0;
}

export function sharedInterestsScore(a: MaybeText, b: MaybeText): number {
  if (a === 'Very important' && b === 'Very important') return 10;
  if (a === 'Somewhat important' && b === 'Somewhat important') return 5;
  return 0;
}

export function socialPreferenceScore(a: MaybeText, b: MaybeText): number {
  if (same(a, b)) return 10;
  if (bothFlex(a, b, 'Both')) return 5;
  return 0;
}

export function casualnessExpectationScore(a: MaybeText, b: MaybeText): number {
  if (same(a, b)) return 10;
  if (a === 'All of the above' || b === 'All of the above') return 5;
  return 0;
}

export function exclusivityViewScore(a: MaybeText, b: MaybeText): number {
  return same(a, b) ? 10 : 3;
}

export function simpleSame10Score(a: MaybeText, b: MaybeText): number {
  return same(a, b) ? 10 : 0;
}

export function setup2AnswersScore(
  intentA: IntentKey,
  answersA: Setup2AnswersFields,
  intentB: IntentKey,
  answersB: Setup2AnswersFields,
): number {
  let score = intentScore(intentA, intentB);

  // Just friends
  const aFriends = intentA === 'just_friends' || (intentA === 'not_sure_yet' && answersA.sub_intent === 'Friendship');
  const bFriends = intentB === 'just_friends' || (intentB === 'not_sure_yet' && answersB.sub_intent === 'Friendship');
  if (aFriends && bFriends) {
    score += friendshipTypeScore(answersA.friendship_type, answersB.friendship_type);
    score += sharedInterestsScore(answersA.shared_interests_importance, answersB.shared_interests_importance);
    score += socialPreferenceScore(answersA.social_preference, answersB.social_preference);
  }

  // Keeping it casual
  if (intentA === 'keeping_it_casual' && intentB === 'keeping_it_casual') {
    score += casualnessExpectationScore(answersA.casualness_expectation, answersB.casualness_expectation);
    score += exclusivityViewScore(answersA.exclusivity_view, answersB.exclusivity_view);
  }

  // Open to relationship
  const aRomantic = intentA === 'open_to_relationship' || (intentA === 'not_sure_yet' && answersA.sub_intent === 'Something romantic');
  const bRomantic = intentB === 'open_to_relationship' || (intentB === 'not_sure_yet' && answersB.sub_intent === 'Something romantic');
  if (aRomantic && bRomantic) {
    score += simpleSame10Score(answersA.marriage_view, answersB.marriage_view);
    score += simpleSame10Score(answersA.children_view, answersB.children_view);
    score += simpleSame10Score(answersA.living_preference, answersB.living_preference);
    score += simpleSame10Score(answersA.life_priority, answersB.life_priority);
  }

  // Not sure yet / both
  const aBoth = intentA === 'not_sure_yet' && answersA.sub_intent === 'Both';
  const bBoth = intentB === 'not_sure_yet' && answersB.sub_intent === 'Both';
  if (aBoth && bBoth) {
    score += simpleSame10Score(answersA.commitment_view, answersB.commitment_view);
    score += friendshipTypeScore(answersA.friendship_type, answersB.friendship_type);
    score += socialPreferenceScore(answersA.social_preference, answersB.social_preference);
  }

  return score;
}
