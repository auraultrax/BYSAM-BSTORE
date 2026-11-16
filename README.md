# BYSAM & BSTORE

Beray geliştirici portalı ve yayın yönetimi.
- index.html: BYSAM Domain ve BSTORE uygulama başvurusu seçimi.
- admin.html: e-posta/şifre girişli yönetici paneli.
- portal.js: Auth, ilk başvuru ve yalnızca sürüm/kod güncellemesi.
- admin.js: dosyaları inceleme, reddetme, yayımlama, kaynak dosyalarını düzenleme ve yayın silme.

## Dosya sınırları
- En az 1, en fazla 7 kaynak kod dosyası.
- En fazla 4 ek dosya (görsel/PDF/ZIP).
- Dosya başına 25 MB.
- Kaynak dosyaları arasında index.html veya index.html içeren ZIP paketi.
- ZIP çıkarma işleminde 120 dosya sınırı ve yol geçişi kontrolü bulunur.

## Yönetici yetkisi
Admin hesabı normal Supabase Auth e-posta/şifre hesabıdır. Yönetici olarak yetkilendirmek için ilgili kullanıcının Auth App Metadata alanında beray_admin: true claim'i olmalıdır. Bu claim kullanıcı tarafından düzenlenebilen user metadata alanına konmamalıdır. Yönetici yetkisi olmayan hesap admin.html üzerinden giriş yapsa bile yönetim paneline ulaşamaz.

Supabase SQL Editor'de yalnızca yetkilendirilecek kişinin e-posta adresiyle şu işlemi yap:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"beray_admin": true}'::jsonb
where lower(email) = lower('YONETICI_EPOSTASI');
```

Ardından hesabın oturumunu kapatıp yeniden aç. Şifreyi veya Service Role anahtarını paylaşma.

## Önemli yayın notu
Onaylanan kaynaklar public beray-published bucket'ına kopyalanır. Yayınlanan uygulama kodu herkes tarafından görülebilir. Gizli API anahtarları veya özel veriler yayın kaynaklarına konmamalıdır. Kullanıcı kodları sandbox iframe içinde açılır.

## GitHub Pages
Repo Settings → Pages → Build and deployment → Source: GitHub Actions seç. Portal: https://auraultrax.github.io/BYSAM-BSTORE/
Yönetici: https://auraultrax.github.io/BYSAM-BSTORE/admin.html
