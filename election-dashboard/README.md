# Seçim 2026 — Canlı Seçim Dashboard Altyapısı

Bu depo, "Seçim 2026" canlı seçim/anket takip uygulaması için optimize edilmiş, ölçeklenebilir ve güvenli backend altyapısını içerir.

## Özellikler & Altyapı
- **Framework**: Next.js 16.2 (Turbopack) & React 19.
- **ORM & Veritabanı**: Prisma ORM ile PostgreSQL (Neon Serverless).
- **Bellek İçi & Dağıtık Cache**: `ioredis` ile Redis (Upstash) rate limit, proof-of-work doğrulama ve SSE yayın dağıtımı.
- **Güvenlik**:
  - SHA-256 tabanlı Client-Side Proof-of-Work (PoW) koruması.
  - Cloudflare Turnstile robot doğrulama entegrasyonu.
  - HMAC-SHA256 imzalı `HttpOnly`, `Secure` ve `SameSite=Strict` yönetici oturum çerezleri.
  - IP bazlı ve cihaz bazlı oy sınırlamaları.
- **SSE (Server-Sent Events)**: Dağıtık sunucularda eşzamanlı veri güncellemeleri için Redis Pub/Sub tabanlı anlık yayın.
- **Test ve Sağlık Kontrolleri**: Vitest tabanlı entegrasyon testleri ve `/api/health` servis izleme sistemi.

---

## 🛠️ Canlı Ortam Kurulumu (Production Setup)

Uygulamayı canlı ortama (Vercel, Railway, Docker, vb.) kurmak için aşağıdaki adımları sırasıyla tamamlayın.

### 1. PostgreSQL Veritabanı (Neon)
1. [Neon.tech](https://neon.tech/) adresinden ücretsiz bir hesap oluşturun.
2. Yeni bir proje başlatın.
3. Kontrol panelinden PostgreSQL bağlantı adreslerini alın:
   - **DATABASE_URL (Pooled)**: `postgres://...` (Genellikle Connection Pooling aktif olan URL).
   - **DIRECT_URL (Direct)**: `postgres://...` (Prisma migrations için pooling olmayan doğrudan bağlantı URL'i).

### 2. Redis Cache (Upstash)
1. [Upstash.com](https://upstash.com/) adresinden ücretsiz bir Redis veritabanı oluşturun.
2. Sağlanan **Redis Connection URL**'ini kopyalayın (örnek: `rediss://default:...@...upstash.io:6379`).

### 3. Cloudflare Turnstile Widget (Robot Koruması)
1. [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/) adresine gidin.
2. Uygulama alan adınızı (domain) ekleyin.
3. Üretilen anahtarları kopyalayın:
   - **Site Key (Public)**: Arayüzde görüntülenecek widget anahtarı.
   - **Secret Key (Private)**: Arka planda doğrulanacak gizli anahtar.

---

## 🔑 Çevre Değişkenleri (Environment Variables)

Projenin kök dizininde `.env` dosyasını oluşturun ve aşağıdaki değişkenleri doldurun (Şablon için `.env.example` dosyasına göz atabilirsiniz):

```env
# --- Veritabanı Yapılandırması (Postgres via Neon) ---
DATABASE_URL="postgres://user:password@pooled-host/dbname?sslmode=require"
DIRECT_URL="postgres://user:password@direct-host/dbname?sslmode=require"

# --- Redis Yapılandırması (Upstash) ---
REDIS_URL="rediss://default:token@host.upstash.io:6379"
# Yerel geliştirme ortamında Redis olmadan çalıştırmak için:
SKIP_REDIS=false

# --- Robot Koruması (Cloudflare Turnstile) ---
TURNSTILE_SECRET_KEY="1x00000000000000000000000000000000"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
# Geliştirme ortamında Turnstile korumasını atlamak için (Üretimde her zaman false olmalıdır):
SKIP_ANTIBOT_CHECKS=false

# --- Güvenlik & Kimlik Doğrulama ---
ADMIN_PIN="yonetici_sifresi_belirleyin"
IP_HASH_SALT="ip_maskeleme_tuzu_belirleyin"
```

---

## 🚀 Çalıştırma ve Dağıtım (Deployment)

### Veritabanı Tablolarını Oluşturma
Prisma göç (migration) şemasını canlı PostgreSQL veritabanınıza uygulamak için aşağıdaki komutu çalıştırın:
```bash
npx prisma migrate deploy
```

### Projeyi Başlatma
1. Paketleri yükleyin:
   ```bash
   npm install
   ```
2. Prisma istemcisini oluşturun:
   ```bash
   npx prisma generate
   ```
3. Uygulamayı derleyin ve başlatın:
   ```bash
   npm run build
   npm run start
   ```

---

## 🧪 Testler ve Geliştirme Araçları

### Testleri Çalıştırma
Vitest backend entegrasyon testlerini koşturmak için:
```bash
npm run test
```

### Yapay Oy Ekleme (Seeding / Yük Testi)
Geliştirme aşamasında veritabanını doldurmak ve yük testi yapmak için yerel seeder betiğini kullanabilirsiniz:
```bash
# Belirli bir oylamaya saniyede 50 oy hızında oy ekleme
npx tsx scripts/seed-votes.ts --poll <oylama-id> --rate 50
```

### SQLite Verilerini Aktarma
Eski SQLite veritabanındaki (`election.db`) oyları ve günlükleri Postgres'e taşımak için:
1. Geliştirme paketini yükleyin: `npm install better-sqlite3`
2. Göç betiğini koşturun:
   ```bash
   npx tsx scripts/migrate-sqlite-to-postgres.ts
   ```
3. İşlem bittikten sonra paketi silebilirsiniz.
