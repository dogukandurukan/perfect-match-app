-- Fix district names incorrectly stored in profiles.city (Istanbul districts)

UPDATE public.profiles
SET city = 'Istanbul'
WHERE city IN (
  'Kadikoy', 'Moda', 'Besiktas', 'Sisli', 'Beyoglu',
  'Uskudar', 'Maltepe', 'Atasehir', 'Bakirkoy',
  'Sariyer', 'Beykoz', 'Pendik', 'Kartal', 'Tuzla',
  'Umraniye', 'Cekmekoy', 'Sultangazi', 'Bagcilar',
  'Bahcelievler', 'Kucukcekmece', 'Buyukcekmece',
  'Catalca', 'Silivri', 'Arnavutkoy', 'Eyupsultan',
  'Fatih', 'Gaziosmanpasa', 'Gungoren', 'Kagithane',
  'Zeytinburnu', 'Adalar', 'Avcilar', 'Bayrampasa'
)
AND city IS DISTINCT FROM 'Istanbul';
