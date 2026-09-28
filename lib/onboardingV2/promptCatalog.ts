// Tempa onboarding V2 — local prompt catalog (P07 R2, D60). Original, easy
// English prompts in four categories, each with a short Turkish meaning and
// two short examples per language (one warm/natural, one lightly playful).
// Examples are HELP TEXT ONLY: never stored as an answer, never count toward
// the requirement, never shown on the profile. IDs are stable local keys —
// not a backend enum (Q6 still open).

export type PromptCategory = 'about_me' | 'just_for_fun' | 'you_and_me' | 'my_everyday';

export const PROMPT_CATEGORIES: { key: PromptCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'about_me', label: 'About me' },
  { key: 'just_for_fun', label: 'Just for fun' },
  { key: 'you_and_me', label: 'You & me' },
  { key: 'my_everyday', label: 'My everyday' },
];

export type PromptEntry = {
  id: string;
  category: PromptCategory;
  en: string;
  /** Short Turkish meaning, shown on request ("Türkçesi"). */
  tr: string;
  examples: { en: [string, string]; tr: [string, string] };
};

const p = (
  id: string,
  category: PromptCategory,
  en: string,
  tr: string,
  exEn: [string, string],
  exTr: [string, string],
): PromptEntry => ({ id, category, en, tr, examples: { en: exEn, tr: exTr } });

export const PROMPT_CATALOG: PromptEntry[] = [
  // About me
  p('small_thing_i_love', 'about_me', 'A small thing I love…', 'Sevdiğim küçük bir şey…',
    ['Morning coffee on a day with no rush.', "When someone's dog decides I'm its new best friend."],
    ['Sabah kahvesi ve acele etmediğim günler.', 'Birinin köpeğinin beni yeni en yakın arkadaşı ilan etmesi.']),
  p('friends_know_me_for', 'about_me', 'My friends know me for…', 'Arkadaşlarım beni şununla bilir…',
    ['Showing up when it matters.', 'Shortcuts that somehow always take longer.'],
    ['Önemli anlarda hep orada olmamla.', 'Nedense hep daha uzun süren kestirmelerimle.']),
  p('want_to_try', 'about_me', 'Something I want to try…', 'Denemek istediğim bir şey…',
    ['Sailing on the Bosphorus at sunset.', 'Pottery, knowing my first bowl will look a bit sad.'],
    ["Gün batımında Boğaz'da yelken.", 'Çömlek; ilk kasemin biraz üzgün görüneceğini bile bile.']),
  p('one_thing_to_know', 'about_me', 'One thing to know about me…', 'Hakkımda bilmen gereken bir şey…',
    ["I take my time, but I really listen.", "I'll always suggest sharing a dessert."],
    ['Acele etmem ama gerçekten dinlerim.', 'Tatlıyı paylaşmayı mutlaka teklif ederim.']),
  p('ask_me_about', 'about_me', 'Ask me about…', 'Bana şunu sor…',
    ["The city I'd move to tomorrow.", 'The day I got lost in my own neighborhood.'],
    ['Yarın taşınabileceğim şehri.', 'Kendi mahallemde kaybolduğum günü.']),
  // Just for fun
  p('funny_little_habit', 'just_for_fun', 'My funny little habit…', 'Komik küçük alışkanlığım…',
    ['Giving names to the plants on my balcony.', 'Reading the whole menu, then ordering the usual.'],
    ['Balkondaki bitkilere isim vermek.', 'Menüye on dakika bakıp hep aynı şeyi söylemek.']),
  p('oddly_good_at', 'just_for_fun', "I'm oddly good at…", 'Garip derecede iyi olduğum şey…',
    ['Finding the quiet table in a busy café.', 'Recognizing a song from its first two seconds.'],
    ['Kalabalık bir kafede sessiz masayı bulmak.', 'Şarkıyı ilk iki saniyesinden tanımak.']),
  p('dont_judge_me', 'just_for_fun', "Don't judge me, but…", 'Beni yargılama ama…',
    ['I reread the same book every winter.', "I put ketchup on things that don't need it."],
    ['Her kış aynı kitabı yeniden okurum.', 'Ketçaba ihtiyacı olmayan şeylere de ketçap koyarım.']),
  p('take_too_seriously', 'just_for_fun', 'I take this too seriously…', 'Fazla ciddiye aldığım şey…',
    ['Choosing the right spot for a picnic.', 'Board games. Especially the ones I lose.'],
    ['Piknik için doğru yeri seçmek.', 'Kutu oyunları. Özellikle kaybettiklerim.']),
  p('most_used_phrase', 'just_for_fun', 'My most used phrase…', 'En çok kullandığım cümle…',
    ['"Let\'s walk a little more."', '"Five more minutes."'],
    ['"Biraz daha yürüyelim."', '"Beş dakika daha."']),
  // You & me
  p('together_we_could', 'you_and_me', 'Together, we could…', 'Birlikte şunu yapabiliriz…',
    ['Find the best tiramisu in Istanbul.', 'Buy a plant and try to keep it alive.'],
    ["İstanbul'un en iyi tiramisusunu bulabiliriz.", 'Bir bitki alıp hayatta tutmayı deneyebiliriz.']),
  p('first_date_needs', 'you_and_me', 'Our first date needs…', 'İlk buluşmamızda şunlar olmalı…',
    ['Good coffee and an easy walk after.', 'A plan B in case the café is full.'],
    ['İyi kahve ve sonrasında kısa bir yürüyüş.', 'Kafe doluysa bir B planı.']),
  p('you_pick_the_place', 'you_and_me', "You pick the place, I'll…", 'Sen yeri seç, ben de…',
    ['Bring the good questions.', 'Research the dessert menu in advance.'],
    ['İyi soruları ben getiririm.', 'Tatlı menüsünü önceden araştırırım.']),
  p('well_laugh_about', 'you_and_me', "We'll laugh about…", 'Birlikte güleceğimiz şey…',
    ['Our worst travel stories.', 'Which one of us picked the wrong ferry.'],
    ['En kötü seyahat hikâyelerimize.', 'Hangimizin yanlış vapura bindiğine.']),
  p('teach_me_how_to', 'you_and_me', 'Teach me how to…', 'Bana şunu öğret…',
    ['Make a really good menemen.', 'Win at backgammon, just once.'],
    ['Gerçekten iyi bir menemen yapmayı.', 'Tavlada bir kere de olsa kazanmayı.']),
  // My everyday
  p('sunday_starts_with', 'my_everyday', 'My Sunday usually starts with…', 'Pazar günüm genelde şununla başlar…',
    ['A long breakfast and no alarm.', 'Promising to be productive. Then brunch.'],
    ['Uzun bir kahvaltı ve alarmsız bir sabah.', 'Verimli olacağıma söz vermek. Sonra brunch.']),
  p('always_make_time_for', 'my_everyday', 'I always make time for…', 'Her zaman vakit ayırdığım şey…',
    ['Calling my grandmother on Sundays.', 'A second look at the pastry counter.'],
    ['Pazar günleri anneannemi aramak.', 'Pastane vitrinine ikinci kez bakmak.']),
  p('comfort_food', 'my_everyday', 'My go-to comfort food…', 'Beni rahatlatan yemek…',
    ['Lentil soup with lemon.', 'Anything with melted cheese on top.'],
    ['Limonlu mercimek çorbası.', 'Üstünde eriyen peynir olan her şey.']),
  p('after_a_long_day', 'my_everyday', 'After a long day, I…', 'Uzun bir günün sonunda…',
    ['Take the long way home, on foot.', "Say I'll sleep early. Then I don't."],
    ['Eve uzun yoldan yürüyerek dönerim.', 'Erken yatacağım derim, yatmam.']),
  p('always_say_yes_to', 'my_everyday', "A plan I'll always say yes to…", 'Her zaman evet diyeceğim plan…',
    ['A sunset walk by the water.', 'Any plan that ends with dessert.'],
    ['Deniz kenarında gün batımı yürüyüşü.', 'Tatlıyla biten her plan.']),
];

export function promptById(id: string | null | undefined): PromptEntry | undefined {
  return id ? PROMPT_CATALOG.find((e) => e.id === id) : undefined;
}

export function promptsInCategory(category: PromptCategory | 'all'): PromptEntry[] {
  return category === 'all' ? PROMPT_CATALOG : PROMPT_CATALOG.filter((e) => e.category === category);
}
