# WebRTC P2P Video Aloqa - Mobil & APK Qo'llanmasi

Ushbu ilova server talab qilmaydigan, Google STUN serveri orqali to'g'ridan-to'g'ri P2P video aloqa o'rnatuvchi zamonaviy dasturdir.

Ilovani Android qurilmada ishlatish va APK olishning 3 ta oson yo'li:

---

## 1-Usul: PWA (Progressive Web App) sifatida telefoningizga o'rnatish (Eng tez va tavsiya etilgan)
Ilova to'liq PWA standartida tayyorlangan (`manifest.json` va `sw.js` mavjud).
1. Ushbu loyihani brauzerda (Chrome / Brave / Edge) oching (masalan, lokal server yoki GitHub Pages orqali).
2. Sahifaning yuqori o'ng burchagidagi **"O'rnatish"** (yoki brauzer menyusidagi **"Bosh ekranga qo'shish" / "Ilovani o'rnatish"**) tugmasini bosing.
3. Ilova telefoningizga xuddi APK ilova kabi o'rnatiladi, o'zining mustaqil ikonkasiga ega bo'ladi va brauzer panellarisiz to'liq ekranda ishlaydi!

---

## 2-Usul: Android Studio orqali APK yig'ish (Native APK)
Loyiha ichida to'liq tayyor Android Studio loyihasi mavjud: `android/` papkasi.
Ushbu loyihada WebRTC uchun zarur bo'lgan barcha ruxsatlar (`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`) va `WebChromeClient.onPermissionRequest` to'g'ri sozlangan.

1. **Android Studio** dasturini oching.
2. **Open** tugmasini bosib, `c:\Users\Sevinch\Desktop\webrtc\android` papkasini tanlang.
3. Loyiha yuklangach, yuqorigi menyudan:
   `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)` ni bosing.
4. Bir necha daqiqadan so'ng tayyor `.apk` fayli `android/app/build/outputs/apk/debug/app-debug.apk` yo'lida hosil bo'ladi.
5. Uni telefoningizga o'rnatib bemalol foydalanishingiz mumkin!

---

## 3-Usul: GitHub Actions orqali avtomatik APK yuklab olish (Hech narsa o'rnatmasdan)
Agar kompyuteringizda Android Studio bo'lmasa:
1. Ushbu papkadagi fayllarni o'z GitHub hisobingizga yuklang (Push).
2. Loyihada tayyorlangan `.github/workflows/build-apk.yml` avtomatik ishga tushadi.
3. 2-3 daqiqadan so'ng GitHub dagi **Actions** bo'limida tayyor `WebRTC-P2P-Video-APK` faylini to'g'ridan-to'g'ri yuklab olishingiz mumkin.

---

## Mobil Yangi Imkoniyatlari:
- 🔄 **Kamerani almashtirish (Flip Camera):** Oldi va orqa kamera o'rtasida 1 bosishda o'tish.
- 📤 **Web Share API:** Taklif (`offer.json`) yoki javobni Telegram / WhatsApp orqali to'g'ridan-to'g'ri yuborish.
- 📋 **Xotiradan nusxa olish va joylash:** Fayl o'rniga matn kodi bilan ham bir zumda ulanish.
- 🔲 **To'liq ekran (Fullscreen):** Video maydonini kattalashtirib tomosha qilish.
- 📴 **Oflayn ish rejimi (Service Worker):** Internetsiz ham ilova ochiladi va faqat Google STUN orqali P2P bog'lanadi.
