# 🎬 ErdoFlix Stremio Addon

**Gelişmiş M3U8 ve Live TV desteği olan Stremio addon'u**

![Version](https://img.shields.io/badge/version-1.3.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D%2014.0.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## 📋 İçindekiler

- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [API Yapısı](#api-yapısı)
- [Fonksiyon Açıklamaları](#fonksiyon-açıklamaları)
- [Konfigürasyon](#konfigürasyon)
- [Sorun Giderme](#sorun-giderme)
- [Geliştirici Notları](#geliştirici-notları)

## ✨ Özellikler

### 🎥 Film Özellikleri
- ✅ **424+ film** ErdoFlix API'sinden
- ✅ **API-based filtreleme** (sunucu tarafı)
- ✅ **Gelişmiş arama** (başlık, orijinal başlık, açıklama)
- ✅ **Tür filtreleme** (aksiyon, komedi, dram, vb.)
- ✅ **M3U8 parsing** embedded altyazı/ses desteği
- ✅ **Çoklu altyazı desteği** (tr, tr2, tr3 format)
- ✅ **Kalite seçimi** otomatik sıralama
- ✅ **Cache optimizasyonu** (1800s film, 900s arama)

### 📺 Live TV Özellikleri
- ✅ **Canlı TV kanalları** (TRT 1, Kanal D, Show TV, ATV, Star TV)
- ✅ **4'e kadar alternatif stream** per kanal
- ✅ **TV arama kataloğu** kanal ismi ile arama
- ✅ **Kısa cache süresi** (300s) canlı içerik için
- ✅ **Live TV optimizasyonu** bingeGroup ile

### 🔧 Teknik Özellikler
- ✅ **JWT Authentication** ErdoFlix API için
- ✅ **Error handling** timeout, bağlantı hatası yönetimi
- ✅ **Debug endpoints** test ve geliştirme için
- ✅ **CORS support** cross-origin istekler
- ✅ **Express.js** sunucu framework

## 🚀 Kurulum

### Gereksinimler
```bash
Node.js >= 14.0.0
npm >= 6.0.0
```

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Sunucuyu Başlat
```bash
# Geliştirme modu
npm start

# Veya doğrudan
node server.js

# Background'da çalıştır
nohup node server.js > server.log 2>&1 &
```

### 3. Stremio'ya Ekle
Stremio uygulamasında:
1. **Settings** → **Addons**
2. **Community Addons** sekmesi
3. URL gir: `http://127.0.0.1:3002/manifest.json`
4. **Install** butonuna tıkla

## 📖 Kullanım

### Film İzleme
1. Stremio'da **Movies** sekmesine git
2. **ErdoFlix Filmler** kataloğunu seç
3. Film seç ve izle
4. Tür filtresi için kategorileri kullan

### Canlı TV İzleme
1. Stremio'da **TV** sekmesine git
2. **ErdoFlix TV Kanalları** kataloğunu seç
3. Kanal seç ve canlı yayını izle
4. Alternatif streamler için farklı kalite seçenekleri

### Arama Kullanımı
- **Film Arama**: `ErdoFlix Arama` kataloğu
- **TV Arama**: `ErdoFlix TV Arama` kataloğu
- Minimum 2 karakter gerekli

## 🔗 API Yapısı

### ErdoFlix API Endpoints

#### Filmler API
```javascript
GET /api/filmler
Headers: {
  'Authorization': 'Bearer [JWT_TOKEN]',
  'X-Role': 'root',
  'X-App': 'erdoFlix',
  // ... diğer headers
}

// Query Parameters
?filter={"$and":[...]}  // Filtreleme
?sort=["id"]           // Sıralama
?pageSize=100          // Sayfa boyutu
```

#### TV Kanalları API (Gelecek)
```javascript
GET /api/tv_list
// Şu anda mock data kullanılıyor
// Gerçek endpoint kullanıcı tarafından sağlanacak
```

### Addon Endpoints

#### Manifest
```
GET /manifest.json
```

#### Kataloglar
```
GET /catalog/{type}/{id}.json
GET /catalog/{type}/{id}/{extra}.json

Örnekler:
/catalog/movie/erdoflix_movies.json
/catalog/movie/erdoflix_search/search=avengers.json
/catalog/tv/erdoflix_tv_channels.json
```

#### Meta Bilgiler
```
GET /meta/{type}/{id}.json

Örnekler:
/meta/movie/ey123.json
/meta/tv/ey_tv_1.json
```

#### Stream'ler
```
GET /stream/{type}/{id}.json

Örnekler:
/stream/movie/ey123.json
/stream/tv/ey_tv_1.json
```

#### Debug Endpoints
```
GET /debug/movie/{id}      # Film detayları
GET /debug/m3u8?url={url}  # M3U8 parsing test
```

## 🔧 Fonksiyon Açıklamaları

### Ana Fonksiyonlar

#### `fetchMovies(limit, searchQuery, genreFilter)`
**Amaç**: ErdoFlix API'sinden filtreli film listesi getirir
```javascript
// Parametreler
limit: number        // Maksimum film sayısı (varsayılan: 100)
searchQuery: string  // Arama terimi (min 2 karakter)
genreFilter: string  // Tür filtresi (aksiyon, komedi, vb.)

// Dönüş değeri
Promise<Array>       // Film objeleri dizisi

// Kullanım
const movies = await fetchMovies(50, "avengers", "aksiyon");
```

**Özellikler**:
- ✅ API-based filtreleme (performans optimizasyonu)
- ✅ Timeout handling (15 saniye)
- ✅ Error handling (ECONNABORTED, ECONNREFUSED)
- ✅ Query building otomatik

#### `fetchTVChannels(limit, searchQuery)`
**Amaç**: TV kanalları listesi getirir (şu anda mock data)
```javascript
// Parametreler
limit: number        // Maksimum kanal sayısı (varsayılan: 100)
searchQuery: string  // Kanal adı araması

// Dönüş değeri
Promise<Array>       // TV kanal objeleri

// Kullanım
const channels = await fetchTVChannels(20, "trt");
```

#### `parseM3U8(url)`
**Amaç**: M3U8 playlist dosyasını parse ederek embedded altyazı/ses bilgilerini çıkarır
```javascript
// Parametreler
url: string          // M3U8 dosya URL'i

// Dönüş değeri
Promise<Object>      // {subtitles: Array, audioTracks: Array}

// Kullanım
const m3u8Data = await parseM3U8("https://example.com/video.m3u8");
console.log(m3u8Data.subtitles.length); // Altyazı sayısı
```

**Parse edilen bilgiler**:
- 🎬 **Subtitle tracks**: EXT-X-MEDIA:TYPE=SUBTITLES
- 🔊 **Audio tracks**: EXT-X-MEDIA:TYPE=AUDIO
- 🏷️ **Language tags**: LANGUAGE="tr", LANGUAGE="en"
- 📝 **Labels**: NAME="Turkish", NAME="English"
- 🔗 **URI paths**: Relative/absolute URL handling

### Yardımcı Fonksiyonlar

#### `buildFilterQuery(searchQuery, genreFilter)`
**Amaç**: API sorgusu için NocoBase filter objesi oluşturur
```javascript
// MongoDB benzeri filter syntax
{
  "$and": [
    {"kaynaklar_id": {"id": {"$notEmpty": true}}},
    {"$or": [
      {"baslik": {"$includes": "arama_terimi"}},
      {"orjinal_baslik": {"$includes": "arama_terimi"}}
    ]}
  ]
}
```

#### Stream Quality Detection
**Amaç**: Kalite bilgisini otomatik algılar ve sıralar
```javascript
// Kalite algılama
const quality = source.baslik.match(/(\d+p)/i);
stream.quality = quality ? quality[1] : "HD";

// Sıralama (yüksek kalite önce)
streams.sort((a, b) => {
    const qualityA = parseInt(a.quality?.replace('p', '') || '0');
    const qualityB = parseInt(b.quality?.replace('p', '') || '0');
    return qualityB - qualityA;
});
```

### Altyazı Sistemi

#### Çoklu Altyazı Desteği
**Problem**: Aynı dilde birden fazla altyazı olduğunda Stremio sadece sonuncusunu gösterir
**Çözüm**: Benzersiz lang kodları (tr, tr2, tr3, tr4...)

```javascript
// Embedded altyazılar için
const embeddedLangCounter = {};
for (const sub of m3u8Data.subtitles) {
    let lang = sub.lang || 'tr';
    if (embeddedLangCounter[lang]) {
        embeddedLangCounter[lang]++;
        lang = `${sub.lang || 'tr'}${embeddedLangCounter[sub.lang || 'tr']}`;
    }
    // tr, tr2, tr3, tr4 format
}

// Harici altyazılar için
const subtitleLangCounter = {};
for (const subtitle of subtitles) {
    let lang = 'tr';
    if (subtitleLangCounter[lang]) {
        subtitleLangCounter[lang]++;
        lang = `tr${subtitleLangCounter[lang]}`;
    }
    // tr, tr2, tr3, tr4 format
}
```

## ⚙️ Konfigürasyon

### Environment Variables
```bash
PORT=3002                    # Sunucu portu
NODE_ENV=development         # Çalışma modu
DEBUG=*                      # Debug çıktıları (isteğe bağlı)
```

### API Headers Konfigürasyonu
```javascript
const API_HEADERS = {
    'accept': 'application/json',
    'X-Locale': 'en-US',
    'X-Role': 'root',
    'X-Authenticator': 'basic',
    'Authorization': 'Bearer [JWT_TOKEN]',
    'X-App': 'erdoFlix',
    'X-Timezone': '+03:00',
    'X-Hostname': 'app.erdoganyesil.org'
};
```

### Cache Ayarları
```javascript
// Cache süreleri (saniye)
const CACHE_DURATIONS = {
    manifest: 3600,      // 1 saat
    catalog: 1800,       // 30 dakika
    search: 900,         // 15 dakika
    meta: 3600,          // 1 saat
    stream: 1800,        // 30 dakika
    tv_stream: 300       // 5 dakika (canlı TV)
};
```

## 🐛 Sorun Giderme

### Yaygın Problemler

#### 1. "Address already in use" Hatası
```bash
# Port kullanımda, kill et
lsof -ti:3002 | xargs kill -9

# Farklı port kullan
PORT=3003 node server.js
```

#### 2. API Authentication Hatası
```bash
# JWT token'ın geçerli olduğunu kontrol et
curl -H "Authorization: Bearer [TOKEN]" \
     https://app.erdoganyesil.org/api/filmler
```

#### 3. M3U8 Parse Hatası
```bash
# M3U8 URL'ini doğrudan test et
curl "https://example.com/video.m3u8"

# Debug endpoint kullan
curl "http://127.0.0.1:3002/debug/m3u8?url=ENCODED_URL"
```

#### 4. Altyazı Görünmeme
- ✅ URL geçerli mi kontrol et
- ✅ Format (VTT/SRT) doğru mu
- ✅ CORS headers var mı
- ✅ Benzersiz lang kodları kullanılıyor mu

#### 5. TV Kanalları Boş
```javascript
// Mock data kullanıldığını kontrol et
console.log('⚠️ TV API endpoint bulunamadı, mock data kullanılıyor');

// Gerçek TV API endpoint'ini güncelleyin
const TV_API_URL = 'https://app.erdoganyesil.org/api/tv_channels';
```

### Debug Komutları

#### Sunucu Durumu
```bash
# Process kontrolü
ps aux | grep "node server.js"

# Port kontrolü
netstat -tlnp | grep :3002

# Log takibi
tail -f server.log
```

#### API Test
```bash
# Manifest test
curl http://127.0.0.1:3002/manifest.json | jq

# Katalog test
curl "http://127.0.0.1:3002/catalog/movie/erdoflix_movies.json" | jq '.metas | length'

# Stream test
curl "http://127.0.0.1:3002/stream/movie/ey1.json" | jq '.streams[0]'
```

#### Performance Test
```bash
# Response time ölçümü
time curl -s "http://127.0.0.1:3002/catalog/movie/erdoflix_movies.json" > /dev/null

# Memory kullanımı
node -e "console.log(process.memoryUsage())"
```

## 👨‍💻 Geliştirici Notları

### Kod Yapısı
```
addon.js                 # Ana addon dosyası
├── Manifest            # Stremio addon tanımı
├── API Helpers         # ErdoFlix API fonksiyonları
├── M3U8 Parser         # Video playlist parser
├── Catalog Handlers    # Film/TV katalog handlers
├── Meta Handlers       # Meta bilgi handlers
└── Stream Handlers     # Video stream handlers

server.js               # Express sunucu
├── Static Routes       # Statik dosya servisi
├── Debug Routes        # Test/debug endpoints
└── Addon Routes        # Stremio addon routes
```

### Veri Akışı
```
1. Stremio Request → Express Router
2. Router → Addon Handler (catalog/meta/stream)
3. Handler → API Helper (fetchMovies/fetchTVChannels)
4. API Helper → ErdoFlix API / Mock Data
5. Response Processing → M3U8 Parse (if needed)
6. Cache & Return → Stremio Client
```

### Performance Optimizasyonları

#### API-based Filtering
```javascript
// ❌ Yavaş: Client-side filtering
const allMovies = await fetchMovies(1000);
const filtered = allMovies.filter(movie =>
    movie.baslik.includes(searchQuery)
);

// ✅ Hızlı: Server-side filtering
const filtered = await fetchMovies(100, searchQuery);
```

#### Cache Strategy
```javascript
// Katalog cache: Uzun süreli (30 dk)
catalog: { cacheMaxAge: 1800 }

// Arama cache: Kısa süreli (15 dk)
search: { cacheMaxAge: 900 }

// Canlı TV: Çok kısa (5 dk)
tv_stream: { cacheMaxAge: 300 }
```

#### Memory Management
```javascript
// Sayfalama ile memory kullanımını sınırla
const pageSize = 50;
const totalLimit = skip + pageSize + 50;

// Büyük response'ları slice et
return response.data.slice(skip, skip + pageSize);
```

### Güvenlik Notları

#### JWT Token
- 🔐 Token expiry: 2038 yılı (uzun süreli)
- 🔑 Role: `root` (tam erişim)
- ⚠️ Production'da token rotation uygulayın

#### CORS Policy
```javascript
// Tüm origin'lere açık (development)
app.use(cors());

// Production'da spesifik domain'ler
app.use(cors({
    origin: ['https://app.strem.io', 'https://staging.strem.io']
}));
```

### Gelecek Geliştirmeler

#### Öncelikli (Priority 1)
- [ ] **Gerçek TV API** entegrasyonu
- [ ] **Error monitoring** (Sentry/LogRocket)
- [ ] **Rate limiting** DoS koruması
- [ ] **Health check** endpoint

#### Orta Öncelik (Priority 2)
- [ ] **User preferences** kullanıcı ayarları
- [ ] **Watch history** izleme geçmişi
- [ ] **Favorites** favori filmler
- [ ] **Recommendation** öneri sistemi

#### Düşük Öncelik (Priority 3)
- [ ] **Multi-language** i18n desteği
- [ ] **Theme support** özelleştirilebilir görünüm
- [ ] **Statistics** kullanım istatistikleri
- [ ] **Admin panel** yönetim arayüzü

### API Rate Limits
```javascript
// Mevcut limitler (tahmini)
const RATE_LIMITS = {
    requests_per_minute: 100,   // Dakika başına istek
    concurrent_requests: 10,    // Eşzamanlı istek
    timeout: 15000             // Timeout (15 saniye)
};
```

### Monitoring
```javascript
// Log seviyeleri
console.log()    // Info: Normal işlemler
console.warn()   // Warning: Dikkat gerektiren durumlar
console.error()  // Error: Hata durumları

// Performance tracking
const startTime = Date.now();
// ... işlem ...
const duration = Date.now() - startTime;
console.log(`⏱️ İşlem süresi: ${duration}ms`);
```

---

## 📞 Destek

Herhangi bir sorun yaşarsanız:

1. **Debug mode** ile çalıştırın: `DEBUG=* node server.js`
2. **Log dosyalarını** kontrol edin: `tail -f server.log`
3. **API endpoints** test edin: Debug komutları bölümü
4. **GitHub Issues** açın: Detaylı hata bilgisi ile

## 📄 Lisans

MIT License - Kişisel ve ticari kullanım için ücretsiz.

---

**Son Güncelleme**: 19 Ağustos 2025 | **Version**: 1.3.1

> 💡 **İpucu**: Bu README'yi bookmark'layın - gelecekte referans olarak kullanabilirsiniz!
