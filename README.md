# Dongu MVP (Demo / Prototip)

Bu proje, plastik geri donusum puanlama fikrinin ilk ve sade surumudur.

## Kurulum

```bash
npm install
npm run web
```

Mobil cihazda denemek icin:

```bash
npm run android
```

## MVP Ozeti

- Kayit ol / Giris yap
- QR okutma (MVP'de metin ile simulasyon)
- Zorunlu fotograf yukleme
- Puan hesaplama (puan = urun agirligi)
- Gecmis islemler
- Magaza ve puanla satin alma

## Demo QR Kodlari

- `DONGU-1001` -> 20 puan
- `DONGU-1002` -> 35 puan
- `DONGU-1003` -> 50 puan

## Test QR Kodlari (Yeni)

- `DONGU-2001` -> Urun: Maden Suyu Sisesi, Puan: 10, Tur: `plastic_or_glass`
- `DONGU-2002` -> Urun: Cips Paketi, Puan: 12, Tur: `packaging`

QR fixture kaynagi: `src/data/mockQrs.ts`

## Not

Bu surumde odeme, kargo, firma entegrasyonu ve AI dogrulama yoktur.
