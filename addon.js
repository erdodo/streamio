const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");

// API Configuration
const API_BASE_URL = 'https://app.erdoganyesil.org/api';
const API_HEADERS = {
    'accept': 'application/json',
    'X-Locale': 'en-US',
    'X-Role': 'root',
    'X-Authenticator': 'basic',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTc1NTUxMzAxMywiZXhwIjozMzMxMzExMzAxM30.pdsffP79aEvVPYr3LlkRAC_CuRILSOXH0uZrhxUiE5s',
    'X-App': 'erdoFlix',
    'X-Timezone': '+03:00',
    'X-Hostname': 'app.erdoganyesil.org'
};

const manifest = {
    "id": "org.erdoganyesil.erdoflix",
    "version": "1.0.8",

    "name": "ErdoFlix M3U8 Addon",
    "description": "Erdogan Yesil API ile M3U8 kaynaklarını sunan Stremio addon'u",
    "logo": "https://via.placeholder.com/256x256/ff6b35/ffffff?text=ErdoFlix",
    "background": "https://via.placeholder.com/1920x1080/1a1a1a/ffffff?text=ErdoFlix+Background",

    "types": ["movie"],

    "catalogs": [
        {
            "type": "movie",
            "id": "erdoflix_movies",
            "name": "ErdoFlix Filmler",
            "extra": [
                {
                    "name": "genre",
                    "options": ["aksiyon", "komedi", "dram", "korku", "bilim-kurgu", "gerilim", "romantik", "tarih", "aile", "suç"],
                    "isRequired": false
                },
                {
                    "name": "skip",
                    "isRequired": false
                }
            ]
        },
        {
            "type": "movie",
            "id": "erdoflix_search",
            "name": "ErdoFlix Arama",
            "extra": [
                {
                    "name": "search",
                    "isRequired": true
                }
            ]
        }
    ],

    "resources": [
        "catalog",
        "meta",
        {
            "name": "stream",
            "types": ["movie"],
            "idPrefixes": ["ey"]
        }
    ],

    "behaviorHints": {
        "adult": false,
        "p2p": false,
        "configurable": false,
        "configurationRequired": false
    }
};

// API Helper Functions
async function fetchMovies(limit = 1000) {
    try {
        // Sadece kaynağı olan filmleri getir
        const filter = {
            "$and": [
                {
                    "kaynaklar_id": {
                        "id": {
                            "$notEmpty": true
                        }
                    }
                }
            ]
        };
        const filterParam = encodeURIComponent(JSON.stringify(filter));
        const url = `${API_BASE_URL}/filmler:list?filter=${filterParam}&pageSize=${limit}&appends[]=turler&appends[]=kaynaklar_id&appends[]=film_altyazilari_id`;
        console.log(`API'ye istek gönderiliyor (sadece kaynağı olan filmler): ${url}`);

        const response = await axios.get(url, {
            headers: API_HEADERS,
            timeout: 10000
        });

        console.log(`API yanıtı: ${response.status}`);
        console.log(`API'den ${response.data.data?.length || 0} kaynağı olan film alındı`);
        console.log(`Toplam kaynaklı film sayısı: ${response.data.meta?.count || 'bilinmiyor'}`);
        return response.data.data || [];
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log('API timeout hatası');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('API bağlantı hatası');
        } else {
            console.log(`API genel hatası: ${error.message}`);
        }
        return [];
    }
}

// M3U8 playlist'ini parse ederek embedded subtitles ve audio tracks bulur
async function parseM3U8(url) {
    try {
        console.log(`M3U8 parse ediliyor: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 5000
        });

        const content = response.data;
        const lines = content.split('\n');
        const subtitles = [];
        const audioTracks = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Subtitle tracks
            if (line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
                const subtitle = {};

                // Language
                const langMatch = line.match(/LANGUAGE="([^"]+)"/);
                if (langMatch) subtitle.lang = langMatch[1];

                // Name/Label
                const nameMatch = line.match(/NAME="([^"]+)"/);
                if (nameMatch) subtitle.label = nameMatch[1];

                // URI
                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    subtitle.url = uriMatch[1];
                    // Relative URL'yi absolute yap
                    if (!subtitle.url.startsWith('http')) {
                        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
                        subtitle.url = baseUrl + subtitle.url;
                    }
                }

                // Default
                const isDefault = line.includes('DEFAULT=YES');
                if (isDefault) subtitle.default = true;

                if (subtitle.url) {
                    subtitle.format = subtitle.url.includes('.vtt') ? 'vtt' : 'srt';
                    subtitles.push(subtitle);
                }
            }

            // Audio tracks
            if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
                const audio = {};

                const langMatch = line.match(/LANGUAGE="([^"]+)"/);
                if (langMatch) audio.lang = langMatch[1];

                const nameMatch = line.match(/NAME="([^"]+)"/);
                if (nameMatch) audio.name = nameMatch[1];

                const isDefault = line.includes('DEFAULT=YES');
                if (isDefault) audio.default = true;

                audioTracks.push(audio);
            }
        }

        console.log(`M3U8 parse sonucu: ${subtitles.length} altyazı, ${audioTracks.length} ses track`);
        return { subtitles, audioTracks };
    } catch (error) {
        console.log(`M3U8 parse hatası: ${error.message}`);
        return { subtitles: [], audioTracks: [] };
    }
}

// Stream URL'nin geçerli olup olmadığını kontrol eder
async function validateStreamUrl(url) {
    try {
        console.log(`Stream URL kontrol ediliyor: ${url}`);
        const response = await axios.head(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 3000,
            validateStatus: function (status) {
                return status < 500; // 4xx'ler de geçerli sayılsın
            }
        });

        const isValid = response.status >= 200 && response.status < 400;
        console.log(`Stream URL ${url} - Status: ${response.status}, Geçerli: ${isValid}`);
        return isValid;
    } catch (error) {
        console.log(`Stream URL kontrol hatası ${url}: ${error.message}`);
        return false;
    }
}

const builder = new addonBuilder(manifest);

// Catalog handler - Film listesini döndürür
builder.defineCatalogHandler(async function(args) {
    console.log(`Catalog istegi: ${JSON.stringify(args)}`);

    if (args.type !== 'movie' || !['erdoflix_movies', 'erdoflix_search'].includes(args.id)) {
        return Promise.resolve({ metas: [] });
    }

    try {
        // Skip parametresi için sayfalama
        const skip = parseInt(args.extra?.skip) || 0;
        const pageSize = 50;

        // Search parametresi
        let searchQuery = args.extra?.search;
        if (searchQuery) {
            searchQuery = searchQuery.split('.json')[0].split('?')[0].trim();
        }

        // Search catalog için özel kontrol
        if (args.id === 'erdoflix_search') {
            if (!searchQuery || searchQuery.length < 2) {
                console.log(`Search catalog için geçersiz query: "${searchQuery}"`);
                return Promise.resolve({ metas: [] });
            }
        }

        console.log(`Search query: ${searchQuery || 'Yok'}`);

        // Genre filtresi
        let selectedGenre = args.extra?.genre;
        // Browser'dan gelen extra parametreleri temizle
        if (selectedGenre) {
            selectedGenre = selectedGenre.split('.json')[0].split('?')[0];
        }
        console.log(`Genre filtresi: ${selectedGenre || 'Yok'}`);

        const movies = await fetchMovies(500); // Search için daha fazla film
        console.log(`${movies.length} film alındı, catalog: ${args.id}, skip: ${skip}, genre: ${selectedGenre || 'Hepsi'}, search: ${searchQuery || 'Yok'}`);

        // Search filtresini önce uygula
        let filteredMovies = movies;
        if (searchQuery && searchQuery.length >= 2) {
            const searchTerm = searchQuery.toLowerCase();
            filteredMovies = movies.filter(movie => {
                const movieTitle = (movie.baslik || '').toLowerCase();
                const originalTitle = (movie.orjinal_baslik || '').toLowerCase();
                const description = (movie.detay || '').toLowerCase();

                // Film türlerini de ara
                const genres = movie.turler?.map(tur => tur.baslik.toLowerCase()) || [];
                const genreMatch = genres.some(genre => genre.includes(searchTerm));

                return movieTitle.includes(searchTerm) ||
                       originalTitle.includes(searchTerm) ||
                       description.includes(searchTerm) ||
                       genreMatch;
            });
            console.log(`Search "${searchQuery}" filtresi uygulandı: ${filteredMovies.length} film kaldı`);
        }

        // Genre filtresini uygula
        if (selectedGenre) {
            filteredMovies = filteredMovies.filter(movie => {
                const movieGenres = movie.turler?.map(tur => tur.baslik.toLowerCase()) || [];
                return movieGenres.some(genre =>
                    genre.includes(selectedGenre.toLowerCase()) ||
                    selectedGenre.toLowerCase().includes(genre) ||
                    // Türkçe karakter desteği için
                    genre.replace('ı', 'i').replace('ü', 'u').replace('ö', 'o').replace('ş', 's').replace('ç', 'c').replace('ğ', 'g').includes(selectedGenre.toLowerCase()) ||
                    selectedGenre.toLowerCase().replace('ı', 'i').replace('ü', 'u').replace('ö', 'o').replace('ş', 's').replace('ç', 'c').replace('ğ', 'g').includes(genre)
                );
            });
            console.log(`Genre "${selectedGenre}" filtresi uygulandı: ${filteredMovies.length} film kaldı`);
        }

        // Sayfalama uygula
        const paginatedMovies = filteredMovies.slice(skip, skip + pageSize);

        const metas = paginatedMovies.map(movie => {
            // Film türlerini çıkar
            const genres = movie.turler?.map(tur => tur.baslik) || ['Film'];

            return {
                id: `ey${movie.id}`,
                type: 'movie',
                name: movie.baslik || movie.orjinal_baslik || `Film ${movie.id}`,
                poster: movie.poster || `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(movie.baslik || 'Film')}`,
                background: movie.arka_plan || undefined,
                description: movie.detay || undefined,
                releaseInfo: movie.yayin_tarihi || undefined,
                year: movie.yayin_tarihi ? new Date(movie.yayin_tarihi).getFullYear() : undefined,
                country: 'TR',
                language: 'tr',
                // Gerçek film türleri
                genre: genres,
                runtime: undefined,
                imdbRating: undefined,
                // Popüler catalog için öncelik
                ...(args.id === 'erdoflix_top' && { featured: true })
            };
        });

        console.log(`Catalog '${args.id}'da ${metas.length} film döndürülüyor (skip: ${skip})`);
        return Promise.resolve({
            metas: metas,
            cacheMaxAge: args.id === 'erdoflix_top' ? 3600 : 1800 // Popüler için daha uzun cache
        });
    } catch (error) {
        console.log(`Catalog hatası: ${error.message}`);
        return Promise.resolve({ metas: [] });
    }
});

// Meta handler - Film detaylarını döndürür (İzleme geçmişi için kritik)
builder.defineMetaHandler(async function(args) {
    console.log(`Meta handler çağrıldı: ${JSON.stringify(args)}`);

    if (args.type !== 'movie') {
        console.log(`Desteklenmeyen tip: ${args.type}`);
        return Promise.resolve({ meta: {} });
    }

    // ID'den film ID'sini çıkar (ey prefix'ini kaldır)
    if (!args.id.startsWith('ey')) {
        console.log(`Geçersiz ID formatı: ${args.id}`);
        return Promise.resolve({ meta: {} });
    }

    const movieId = args.id.substring(2); // 'ey' prefix'ini kaldır
    console.log(`Film ${movieId} için meta bilgisi aranıyor`);

    try {
        // API'den filmleri al
        const movies = await fetchMovies(300);
        const targetMovie = movies.find(movie => movie.id.toString() === movieId);

        if (!targetMovie) {
            console.log(`Film ${movieId} bulunamadı, toplam ${movies.length} film var`);
            return Promise.resolve({ meta: {} });
        }

        // İzleme geçmişi için gerekli tüm alanları doldur
        const movieName = targetMovie.baslik || targetMovie.orjinal_baslik || `Film ${movieId}`;
        const moviePoster = targetMovie.poster || `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(movieName)}`;

        // Film türlerini çıkar
        const genres = targetMovie.turler?.map(tur => tur.baslik) || ['Film'];

        const meta = {
            id: args.id, // Tam ID (ey prefix'li)
            type: 'movie',
            name: movieName, // ZORUNLU - İzleme geçmişi için
            poster: moviePoster, // ZORUNLU - İzleme geçmişi için
            background: targetMovie.arka_plan || moviePoster,
            description: targetMovie.detay || `${movieName} film detayları`,
            releaseInfo: targetMovie.yayin_tarihi || undefined,
            year: targetMovie.yayin_tarihi ? new Date(targetMovie.yayin_tarihi).getFullYear() : new Date().getFullYear(),
            imdbRating: undefined,
            genres: genres, // Gerçek film türleri
            runtime: undefined,
            director: undefined,
            cast: undefined,
            country: 'TR',
            language: 'tr',
            // İzleme geçmişi için ek bilgiler
            website: undefined,
            awards: undefined,
            writer: undefined,
            videos: []
        };

        console.log(`✅ Film ${movieId} meta başarılı: "${meta.name}" | Poster: ${meta.poster ? 'Var' : 'Yok'}`);
        console.log(`Meta detayları: ID=${meta.id}, Name="${meta.name}", Type=${meta.type}`);

        return Promise.resolve({
            meta: meta,
            cacheMaxAge: 3600 // 1 saat cache
        });
    } catch (error) {
        console.log(`❌ Meta hatası Film ${movieId}: ${error.message}`);
        // Hata durumunda bile basit meta döndür
        return Promise.resolve({
            meta: {
                id: args.id,
                type: 'movie',
                name: `Film ${movieId}`,
                poster: `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=Film+${movieId}`
            }
        });
    }
});

// Stream handler - Video kaynaklarını döndürür
builder.defineStreamHandler(async function(args) {
    if (args.type !== 'movie') {
        return Promise.resolve({ streams: [] });
    }

    // ID'den film ID'sini çıkar (ey prefix'ini kaldır)
    if (!args.id.startsWith('ey')) {
        return Promise.resolve({ streams: [] });
    }

    const movieId = args.id.substring(2); // 'ey' prefix'ini kaldır
    console.log(`🎬 Film ${movieId} için gelişmiş stream aranıyor`);

    try {
        // Filmler listesinden embedded verilerle birlikte al
        const movies = await fetchMovies(300);
        const targetMovie = movies.find(movie => movie.id.toString() === movieId);

        if (!targetMovie) {
            console.log(`❌ Film ${movieId} bulunamadı`);
            return Promise.resolve({ streams: [] });
        }

        const streams = [];
        const sources = targetMovie.kaynaklar_id || [];
        const subtitles = targetMovie.film_altyazilari_id || [];

        console.log(`📊 Film ${movieId}: ${sources.length} kaynak, ${subtitles.length} altyazı bulundu`);

        // Her kaynak için stream oluştur
        for (const source of sources) {
            if (!source.url) continue;

            console.log(`🔍 Kaynak işleniyor: "${source.baslik}" - ${source.url}`);

            // Stream URL'sini doğrula
            const isValidUrl = await validateStreamUrl(source.url);
            if (!isValidUrl) {
                console.log(`❌ Geçersiz stream URL atlandı: ${source.url}`);
                continue;
            }

            const stream = {
                url: source.url,
                title: source.baslik || `ErdoFlix - ${source.id}`,
                subtitles: [],
                behaviorHints: {
                    bingeGroup: `erdoflix-${movieId}`,
                    countryWhitelist: ['TR', 'US', 'GB']
                }
            };

            // M3U8 ise embedded content'i parse et
            if (source.url.toLowerCase().includes('.m3u8')) {
                console.log(`🔍 M3U8 dosyası parse ediliyor: ${source.url}`);
                const m3u8Data = await parseM3U8(source.url);

                // Embedded altyazıları ekle
                if (m3u8Data.subtitles.length > 0) {
                    console.log(`📝 M3U8'den ${m3u8Data.subtitles.length} embedded altyazı bulundu`);
                    for (const sub of m3u8Data.subtitles) {
                        stream.subtitles.push({
                            url: sub.url,
                            lang: sub.lang || 'tr',
                            label: sub.label || `${sub.lang || 'Türkçe'} (Embedded)`,
                            format: sub.format || 'vtt'
                        });
                    }
                }

                // Audio track bilgilerini title'a ekle
                if (m3u8Data.audioTracks.length > 1) {
                    const audioInfo = m3u8Data.audioTracks.map(a => a.name || a.lang).join(', ');
                    stream.title += ` [${audioInfo}]`;
                }
            }

            // Harici altyazıları da ekle
            for (const subtitle of subtitles) {
                if (subtitle.url) {
                    const sub = {
                        url: subtitle.url,
                        lang: 'tr' // Varsayılan Türkçe
                    };

                    // VTT formatını belirt
                    if (subtitle.url.toLowerCase().includes('.vtt')) {
                        sub.format = 'vtt';
                    } else if (subtitle.url.toLowerCase().includes('.srt')) {
                        sub.format = 'srt';
                    }

                    if (subtitle.baslik) {
                        sub.label = subtitle.baslik;
                    } else {
                        sub.label = 'Türkçe (Harici)';
                    }

                    // Aynı altyazı zaten varsa ekleme
                    const existingSubtitle = stream.subtitles.find(s => s.url === sub.url);
                    if (!existingSubtitle) {
                        stream.subtitles.push(sub);
                    }
                }
            }

            // Quality bilgilerini ekle
            if (source.baslik) {
                const quality = source.baslik.match(/(\d+p)/i);
                if (quality) {
                    stream.quality = quality[1];
                }
            }

            console.log(`✅ Kaynak "${stream.title}" için ${stream.subtitles.length} altyazı eklendi`);
            streams.push(stream);
        }

        // Streams'i kaliteye göre sırala (en yüksek kalite önce)
        streams.sort((a, b) => {
            const qualityA = parseInt(a.quality?.replace('p', '') || '0');
            const qualityB = parseInt(b.quality?.replace('p', '') || '0');
            return qualityB - qualityA;
        });

        console.log(`🎯 Film ${movieId} için ${streams.length} geçerli stream döndürülüyor`);

        if (streams.length === 0) {
            console.log(`⚠️ Film ${movieId} için hiç geçerli stream bulunamadı`);
        }

        return Promise.resolve({
            streams: streams,
            cacheMaxAge: 1800 // 30 dakika cache
        });
    } catch (error) {
        console.log(`❌ Stream hatası Film ${movieId}: ${error.message}`);
        return Promise.resolve({ streams: [] });
    }
});

module.exports = builder.getInterface();