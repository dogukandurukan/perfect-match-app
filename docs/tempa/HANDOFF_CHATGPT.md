# Tempa — ChatGPT için devir notu (25 Ekim 2026 sonu)

Bu not yeni bir ChatGPT oturumuna yapıştırılmak için yazıldı.

**Rol dağılımı:**
- **ChatGPT:** ürün değerlendirmesi yapar ve Claude Code için prompt hazırlar. Mac'e, koda ve veritabanına erişmez.
- **Claude Code:** kodu yazar ve yerel testleri çalıştırır.
- **Doğukan (ürün sahibi):** kararları verir ve telefon testlerini yapar.

## Proje

- **Tempa:** yavaş ve niyetli tanışmayı öne çıkaran bir flört uygulaması. Uygulama İngilizce; Expo / React Native ve Supabase üzerinde çalışıyor.
- **Yeni (V2) deneyim:**
  - başvuruya dayalı onboarding (başvuru incelenir, onaylanan üye olur);
  - Discover, Matches, Activity, Chats ve Profile ekranları.
- **Çalışma ortamı:**
  - Çalışma dalı `tempa/v2-persist-r2`; ana dala merge edilmedi, yayına alınmadı.
  - Tüm yeni işler yalnız Mac'teki yerel test sunucusunda (tempa-local) sentetik test hesaplarıyla deneniyor.
- **Yayın durumu:** yayına hazır ya da merge için güvenli diye bir sonuç yok; merge için anlaşılmış bir sürüm de yok.
- **Ortak sunucu:**
  - Ortak geliştirme/canlı sunucunun bugünkü gerçek durumu bu oturumda doğrulanmadı.
  - Ana dala push yapılınca otomatik bir şey tetiklenip tetiklenmediği de doğrulanmadı.

## Son günlerde tamamlananlar

### 1. "What you're looking for" bölümü (başvuru gönderilmeden hemen önce)

Akış: Davet → Niyet → Öncelikler → Yakınlaşma biçimi → Özet → Başvuru.

**Niyet — "What are you looking for?"**
- Ana seçim:
  - A one-night connection
  - Casual dating, without commitment
  - Seeing where things go
  - A long-term relationship
  - A relationship leading to marriage
  - Still figuring it out
- İsteğe bağlı "Also open to…": birden fazla somut niyet eklenebilir. Ana seçim burada tekrar seçilemez; "Still figuring it out" burada sunulmaz.
- Niyet bir kez soruluyor: bölüm açıkken onboarding'in başındaki eski niyet sorusu gizleniyor.
- Eski niyeti olmayan kullanıcı için yeni niyet zorunlu (atlama yok).
- Yeni seçimler eski seçeneklere eşlenmiyor, tersi de yok.

**Öncelikler — "What matters to you?"**
- En fazla 3 başlık seçilir: Active lifestyle, Shared interests, Education, Work & career, Money mindset, Living arrangements, Plans for children.
- Her başlıkta en az bir detay seçilmeli; her detay için Preference ya da Must-have işaretlenir.
- "No specific preferences" ayrı bir seçenek.
- Kullanıcının karşı tarafta istediği şeyler, kendisiyle ilgili bilgilerden ayrı tutuluyor.

**Yakınlaşma — "How do you like to connect?"**
- En fazla 2 seçim yapılır. "I'm not sure yet" tek başına seçilir. Soru atlanabilir.

**Özet ve başvuru**
- Özet sabit metinlerden oluşuyor; puan, kişilik etiketi ya da uyum yüzdesi yok.
- Özetteki üç bölüm: Your intention, What matters to you in a partner, Your connection style.
- Özet başvuruyu göndermiyor; gönderim yalnız "Submit application" ile oluyor.
- Cevabı kayıtlı kullanıcı uygulamayı her açtığında daveti yeniden görmüyor; başvuru ekranındaki "View" kartından özete ulaşıyor.

**Gizlilik ve kapatma**
- Yeni niyet, öncelikler ve yakınlaşma tercihleri **özel**: profilde görünmüyor ve **henüz eşleştirmede kullanılmıyor**.
- Tek bir ayarla bölüm kapatılabiliyor. Kapatılınca eski niyet sorusu geri geliyor; kayıtlı cevaplar silinmiyor.

### 2. Profil ziyaretleri

- Bir üyenin tam profilini açan kişi, karşı tarafın Activity ekranında ziyaretçi olarak görünüyor ("Viewed your profile" ya da 24 saat sonra "Visited again").
- İlk ziyaretten önce kullanıcıya bir bilgilendirme gösteriliyor.
- Bilgilendirme, sistem uyarısı yerine sayfa içinde küçük bir alana dönüştü:
  - Tek düğme "Got it". Kapatmak ya da geri çıkmak ziyaret kaydetmiyor; alan bir sonraki uygun açılışta tekrar çıkıyor.
  - Bu yeni hali yalnız yerel testlerle doğrulandı, telefonda henüz görülmedi.
- Premium kullanıcıların ziyaretçi kimliklerini görmesi **yalnız bir öneri**, kesin onaylanmadı.

## Telefonda doğrulananlar (ürün sahibi)

**Üç sorulu bölüm:**
- Tasarım onaylandı.
- Sorular cevaplanıp özete ulaşıldı.
- Ana niyet, ek niyetler ve yakınlaşma seçimleri özette göründü.
- Bir öncelik özette Must-have olarak göründü.
- "Continue to application" sonrasında uygulama tamamen kapatılıp açıldı; "View" ile aynı özet korunmuştu.

**Önceki iki sorulu sürüm:** cevaplama, tek cevaplı özet ve kapat/aç sonrası kalıcılık doğrulandı. Bu sonuç yalnız o sürüme ait.

**Profil ziyaretleri (eski sistem-uyarısı bilgilendirmesiyle):**
- Pars, Hale'nin profilini Activity'den açtı.
- Bilgilendirme ilk açılışta çıktı, onaydan sonra çıkmadı.
- Hale'nin ekranında 2 ziyaretçi göründü: Pars gerçek bir telefon ziyaretiydi, Vedat test verisiydi.

**Henüz telefonda doğrulanmayanlar:**
- Seçim sınırlarının bütün durumları.
- Bir cevabı temizlemek ve yeniden açılışta silinmiş kalması.
- Eski niyeti olmayan hesapta zorunlu yeni niyet akışı.
- Kayıt hatası ve yeniden deneme.
- Üç sorulu sürümle başvurunun gönderilmesi.
- Ziyaretler için: yeni "Got it" bilgilendirmesi, etiket metinleri, bildirim rozetinin etkilenmemesi, gerçek 24 saatlik tekrar ziyaret, onaydan önce kayıt olmaması.

Yerel otomatik testlerin hepsi geçiyor; ancak bunlar telefon testinin yerine geçmiyor.

## Açık ürün kararları

1. **Eski ve yeni niyet çelişebilir.**
   - Eski niyet herkese açık: profilde "Looking for" olarak görünüyor. Seçenekleri long-term, casual ve not sure.
   - Yeni niyet özel. Örneğin test hesabında eski niyet "long-term" iken yeni niyet "one-night".
   - 27 Ekim kararı: "Looking for" herkese açık kalıyor ve ayrı düzenleniyor; özel niyet ona aktarılmıyor. İkisinin farklı olabilmesi artık bilinçli bir durum. Açık kalan: yeni hesapların "Looking for"u onboarding'de nerede seçeceği.
2. **Tercihlerin eşleştirmede kullanılıp kullanılmayacağı.**
   - Birçok tercih için karşı tarafta veri yok: üniversite derecesi, yalnız yaşama, çocuk planı, finansal bağımsızlık, harcama yaklaşımı, kariyere verilen önem, birlikte aktif olma.
   - Kısmen var olanlar: aktiflik düzeyi, çalışma durumu, ilgi alanları.
   - Kullanılacaksa önce kullanıcıya açıklanmalı ve tercihlerini yeniden onaylaması istenmeli.
3. **Must-have'in anlamı:** kesin filtre mi olacak, sıralama etkisi mi? Veri olmayan durumlarda sahte uygunluk üretilmemeli.
4. **"Also open to…" seçimleri** eşleşme havuzunu genişletecek mi?
5. **Profil ziyaretleri:** premium ayrımı (öneri durumunda).

## Genel profil düzenleme — Paket 1 (27 Ekim, yalnız yerel; henüz push edilmedi)

Onaylanmış üye artık Profile → **Edit profile** ekranından şunları değiştirebiliyor:
- **Looking for:** herkese açık; eski üç seçenek (long-term, casual, not sure); isteğe bağlı. Kaldırılırsa profilde görünmez. Özel tercihlerden türetilmez.
- **Boy.**
- **İş durumu:** unvan korunur; profilde unvan varsa unvan görünür.
- **Yaşam tarzı:** "I have pets" seçilince tür zorunlu; başka bir cevapta eski tür temizlenir.
- **İlk buluşma tercihleri:** tür, gün ve saat.

Ekranın genel davranışı:
- Listede her bilginin gerçek görünürlüğü yazıyor: Public ya da Private. Cinsiyet ve kimi görmek istediği Private ve kilitli.
- Kilitli satırlarda "This detail can't be changed yet" yazıyor.
- Photos ve Interests de bu listenin içinden açılıyor.
- Kaydetme, vazgeçme, hata sonrası tekrar deneme ve başka cihazda yapılmış bir değişiklik için "Reload" davranışı, mevcut fotoğraf sırası ekranıyla aynı.

Durum: yerel otomatik testler geçti; **telefonda henüz test edilmedi.**

**Karar verildi:** "Looking for" herkese açık kalıyor ve ayrı düzenleniyor. Yeni özel niyet özel kalıyor; ikisi farklı olabilir.

**Açık:**
- Eski niyeti olmayan yeni hesap "Looking for"u onboarding'de nerede seçecek? Öneri: profil önizlemesinde isteğe bağlı bir kart; henüz yapılmadı.
- Serbest metin alanları, üyeler için özel tercihlerin düzenlenmesi, fotoğraf ekleme/silme/değiştirme ve kimlik alanları sonraki paketlerde, ayrı kararlarla ele alınacak.

### Profil düzeni ve "Recently" (27 Ekim, yalnız yerel; henüz push edilmedi)

Son mockup'a göre yapıldı; story fikrinin ve büyük müzik/kitap kartlarının yerini aldı.
- **My Profile:** kompakt fotoğraf, "ad, yaş" ve şehir; altında "Recently"; ardından Edit profile ve Preview. Preview, karşı tarafın gördüğü ortak profil görünümü; kendi önizlemende beğeni/yorum yok.
- **Edit profile:** tek sayfa. Photos / Answers / Details sekmeleri ilgili bölüme kaydırıyor.
  - Fotoğraflarda yalnız sıra ve ana fotoğraf değişiyor; ekleme/silme düğmesi yok.
  - Prompt cevapları kilitli kartlar olarak görünüyor.
  - Details, Paket 1'deki satırlar.
- **Recently:** isteğe bağlı bir kitap (ad — yazar) ve bir şarkı (ad — sanatçı, isteğe bağlı müzik bağlantısı). Elle giriliyor ve değiştirilene ya da kaldırılana kadar kalıyor.
  - Her profil görünümünde ismin altında iki küçük satır olarak görünüyor; boş satır gösterilmiyor; ikisi de boşsa başkaları başlığı da görmüyor.
  - Şarkı satırı yalnız güvenli bir müzik bağlantısı (https; Spotify, Apple Music, YouTube vb.) varsa dışarıda açılıyor.

Durum: yerel testler geçti; ekran görüntüsü alınamadı (bu Mac'te simülatör yok); **telefonda test edilmedi.**

ChatGPT'den beklenen: Paket 1 ve profil düzeni telefon testlerinin sonucuna göre sıradaki paketin önceliği ve "önce incele" promptu.
