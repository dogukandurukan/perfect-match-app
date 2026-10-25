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
   - Hangisinin gösterileceği ya da kullanılacağı karar bekliyor.
2. **Tercihlerin eşleştirmede kullanılıp kullanılmayacağı.**
   - Birçok tercih için karşı tarafta veri yok: üniversite derecesi, yalnız yaşama, çocuk planı, finansal bağımsızlık, harcama yaklaşımı, kariyere verilen önem, birlikte aktif olma.
   - Kısmen var olanlar: aktiflik düzeyi, çalışma durumu, ilgi alanları.
   - Kullanılacaksa önce kullanıcıya açıklanmalı ve tercihlerini yeniden onaylaması istenmeli.
3. **Must-have'in anlamı:** kesin filtre mi olacak, sıralama etkisi mi? Veri olmayan durumlarda sahte uygunluk üretilmemeli.
4. **"Also open to…" seçimleri** eşleşme havuzunu genişletecek mi?
5. **Profil ziyaretleri:** premium ayrımı (öneri durumunda).

## Yarın: genel profil düzenleme — önce inceleme, sonra karar

Henüz kodlama yok; önce mevcut durum çıkarılıp seçenekler ürün sahibine sunulacak.

Bugünkü kural: onaylanmış üyeler yalnız ilgi alanlarını, aktiviteleri, kitap/film/sanatçıları ve sohbet başlatıcıyı düzenleyebiliyor. Fotoğraflarda yalnız sıralamayı ve ana fotoğrafı değiştirebiliyorlar. Diğer her şey kilitli.

İnceleme sırası:
1. Hangi alanlar düzenlenebilir olmalı? Hangileri doğrulama ya da yeniden inceleme gerektirir (fotoğraf, isim, doğum tarihi, cinsiyet, selfie)?
2. Eski herkese açık niyet ile yeni özel niyet düzenlemede nasıl ele alınmalı?
3. Kaydetme, vazgeçme (kaydedilmemiş değişiklik uyarısı), hata ve tekrar deneme, yeniden açınca kalıcılık davranışı.
4. Fotoğraf ekleme, silme ve değiştirme ne gerektirir? Mevcut sıralama ve ana fotoğraf davranışı korunmalı.

ChatGPT'den beklenen: bu dört başlık için ürün değerlendirmesi ve Claude Code'a gidecek "önce incele, kod yazma" promptu.
