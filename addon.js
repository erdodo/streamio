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
    "version": "1.3.0",

    "name": "ErdoFlix M3U8 Addon",
    "description": "Erdogan Yesil API ile M3U8 kaynaklarını sunan Stremio addon'u",
    "logo": "https://via.placeholder.com/256x256/ff6b35/ffffff?text=ErdoFlix",
    "background": "https://via.placeholder.com/1920x1080/1a1a1a/ffffff?text=ErdoFlix+Background",

    "types": ["movie", "tv"],

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
        },
        {
            "type": "tv",
            "id": "erdoflix_tv_channels",
            "name": "ErdoFlix TV Kanalları",
            "extra": [
                {
                    "name": "skip",
                    "isRequired": false
                }
            ]
        },
        {
            "type": "tv",
            "id": "erdoflix_tv_search",
            "name": "ErdoFlix TV Arama",
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
            "types": ["movie", "tv"],
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
async function fetchMovies(limit = 100, searchQuery = null, genreFilter = null) {
    try {
        // Base filter - sadece kaynağı olan filmler
        const baseFilter = {
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

        // Search query varsa filtre ekle
        if (searchQuery && searchQuery.length >= 2) {
            const searchConditions = {
                "$or": [
                    { "baslik": { "$includes": searchQuery } },
                    { "orjinal_baslik": { "$includes": searchQuery } },
                    { "detay": { "$includes": searchQuery } }
                ]
            };
            baseFilter["$and"].push(searchConditions);
        }

        // Genre filter varsa ekle
        if (genreFilter) {
            const genreCondition = {
                "turler": {
                    "baslik": { "$includes": genreFilter }
                }
            };
            baseFilter["$and"].push(genreCondition);
        }

        const filterParam = encodeURIComponent(JSON.stringify(baseFilter));
        const url = `${API_BASE_URL}/filmler:list?filter=${filterParam}&pageSize=${limit}&appends[]=turler&appends[]=kaynaklar_id&appends[]=film_altyazilari_id`;

        console.log(`API'ye istek gönderiliyor (filtreli): ${url.substring(0, 150)}...`);
        if (searchQuery) console.log(`🔍 Arama terimi: "${searchQuery}"`);
        if (genreFilter) console.log(`🎭 Tür filtresi: "${genreFilter}"`);

        const response = await axios.get(url, {
            headers: API_HEADERS,
            timeout: 15000
        });

        console.log(`API yanıtı: ${response.status}`);
        console.log(`API'den ${response.data.data?.length || 0} filtreli film alındı`);
        console.log(`Toplam filtreli film sayısı: ${response.data.meta?.count || 'bilinmiyor'}`);
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

// TV Channels API Helper Function
async function fetchTVChannels(limit = 100, searchQuery = null) {
    try {
        console.log(`TV kanalları getiriliyor - arama: ${searchQuery || 'yok'}, limit: ${limit}`);

        // Geçici olarak mock data kullan - gerçek endpoint'i kullanıcıdan soralım
        console.log('⚠️ TV API endpoint bulunamadı, mock data kullanılıyor');

        const mockChannels = [
            {
                id: 1,
                name: "TRT 1",
                logo: "https://via.placeholder.com/300x450/ff6b35/ffffff?text=TRT1",
                url1: "https://tv-trt1.medya.trt.com.tr/master.m3u8",
                url2: "https://tv-trt1-dvr.medya.trt.com.tr/master.m3u8",
                url3: null,
                url4: null
            },
            {
                id: 2,
                name: "Kanal D",
                logo: "https://via.placeholder.com/300x450/ff6b35/ffffff?text=KANALD",
                url1: "https://demiroren-live.daioncdn.net/kanald/kanald.m3u8",
                url2: null,
                url3: null,
                url4: null
            },
            {
                id: 3,
                name: "Show TV",
                logo: "https://via.placeholder.com/300x450/ff6b35/ffffff?text=SHOW",
                url1: "https://ciner-live.daioncdn.net/showtv/showtv.m3u8",
                url2: null,
                url3: null,
                url4: null
            },
            {
                id: 4,
                name: "ATV",
                logo: "https://via.placeholder.com/300x450/ff6b35/ffffff?text=ATV",
                url1: "https://trkvz-live.daioncdn.net/atv/atv.m3u8",
                url2: null,
                url3: null,
                url4: null
            },
            {
                id: 5,
                name: "Star TV",
                logo: "https://via.placeholder.com/300x450/ff6b35/ffffff?text=STAR",
                url1: "https://dogus-live.daioncdn.net/startv/startv.m3u8",
                url2: null,
                url3: null,
                url4: null
            }
        ];

        let filteredChannels = mockChannels;

        if (searchQuery && searchQuery.length >= 2) {
            filteredChannels = mockChannels.filter(channel =>
                channel.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        console.log(`${filteredChannels.length} TV kanalı bulundu (mock data)`);
        return filteredChannels.slice(0, limit);

    } catch (error) {
        console.log(`TV kanalları hatası: ${error.message}`);
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

// Catalog handler - Film ve TV listesini döndürür
builder.defineCatalogHandler(async function(args) {
    console.log(`Catalog istegi: ${JSON.stringify(args)}`);

    // Movie catalog handling
    if (args.type === 'movie' && ['erdoflix_movies', 'erdoflix_search'].includes(args.id)) {
        try {
            // Skip parametresi için sayfalama
            const skip = parseInt(args.extra?.skip) || 0;
            const pageSize = 50;

            // Search parametresi temizle
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

            // Genre filtresi temizle
            let selectedGenre = args.extra?.genre;
            if (selectedGenre) {
                selectedGenre = selectedGenre.split('.json')[0].split('?')[0];
            }

            console.log(`🎬 Film Catalog parametreleri: catalog=${args.id}, skip=${skip}, search="${searchQuery || 'Yok'}", genre="${selectedGenre || 'Yok'}"`);

            // API'den doğrudan filtreli sonuçları al
            const totalLimit = skip + pageSize + 50;
            const movies = await fetchMovies(totalLimit, searchQuery, selectedGenre);

            console.log(`📊 API'den ${movies.length} filtreli film alındı`);

            // Sadece sayfalama uygula
            const paginatedMovies = movies.slice(skip, skip + pageSize);

            const metas = paginatedMovies.map(movie => {
                // Film türlerini çıkar
                const genres = movie.turler?.map(tur => tur.baslik) || ['Film'];

                return {
                    id: `ey${movie.id}`,
                    type: 'movie',
                    name: movie.baslik || movie.orjinal_baslik || 'Bilinmeyen Film',
                    poster: movie.kapak_foto || 'https://via.placeholder.com/300x450/cccccc/666666?text=No+Image',
                    year: movie.yayin_yili,
                    genres: genres,
                    imdbRating: movie.imdb_puani || null
                };
            });

            console.log(`📄 Sayfa döndürülüyor: ${metas.length} film (skip: ${skip})`);
            return Promise.resolve({ metas });

        } catch (error) {
            console.log(`Film catalog hatası: ${error.message}`);
            return Promise.resolve({ metas: [] });
        }
    }

    // TV catalog handling
    else if (args.type === 'tv' && ['erdoflix_tv_channels', 'erdoflix_tv_search'].includes(args.id)) {
        try {
            // Skip parametresi için sayfalama
            const skip = parseInt(args.extra?.skip) || 0;
            const pageSize = 50;

            // Search parametresi temizle
            let searchQuery = args.extra?.search;
            if (searchQuery) {
                searchQuery = searchQuery.split('.json')[0].split('?')[0].trim();
            }

            // Search catalog için özel kontrol
            if (args.id === 'erdoflix_tv_search') {
                if (!searchQuery || searchQuery.length < 2) {
                    console.log(`TV Search catalog için geçersiz query: "${searchQuery}"`);
                    return Promise.resolve({ metas: [] });
                }
            }

            console.log(`📺 TV Catalog parametreleri: catalog=${args.id}, skip=${skip}, search="${searchQuery || 'Yok'}"`);

            // TV kanalları API'sinden veri al
            const totalLimit = skip + pageSize + 50;
            const channels = await fetchTVChannels(totalLimit, searchQuery);

            console.log(`📊 API'den ${channels.length} TV kanalı alındı`);

            // Sadece sayfalama uygula
            const paginatedChannels = channels.slice(skip, skip + pageSize);

            const metas = paginatedChannels.map((channel, index) => {
                return {
                    id: `ey_tv_${channel.id || index}`,
                    type: 'tv',
                    name: channel.name || 'Bilinmeyen Kanal',
                    poster: channel.logo || 'https://via.placeholder.com/300x450/ff6b35/ffffff?text=TV',
                    genres: ['TV', 'Live'],
                    description: `Canlı TV Kanalı: ${channel.name || 'Bilinmeyen'}`,
                    // TV için gerekli olan alanlar
                    year: new Date().getFullYear()
                };
            });

            console.log(`📄 TV Sayfa döndürülüyor: ${metas.length} kanal (skip: ${skip})`);
            return Promise.resolve({ metas });

        } catch (error) {
            console.log(`TV catalog hatası: ${error.message}`);
            return Promise.resolve({ metas: [] });
        }
    }

    // Desteklenmeyen catalog
    return Promise.resolve({ metas: [] });
});

// Meta handler - Film ve TV detaylarını döndürür (İzleme geçmişi için kritik)
builder.defineMetaHandler(async function(args) {
    console.log(`Meta handler çağrıldı: ${JSON.stringify(args)}`);

    // Movie meta handling
    if (args.type === 'movie') {
        // ID'den film ID'sini çıkar (ey prefix'ini kaldır)
        if (!args.id.startsWith('ey')) {
            console.log(`Geçersiz film ID formatı: ${args.id}`);
            return Promise.resolve({ meta: {} });
        }

        const movieId = args.id.substring(2); // 'ey' prefix'ini kaldır
        console.log(`Film ${movieId} için meta bilgisi aranıyor`);

        try {
        // API'den filmleri al
        const movies = await fetchMovies(300, null, null); // Meta için filtreleme yok
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
    }

    // TV meta handling
    else if (args.type === 'tv') {
        // ID'den TV kanal ID'sini çıkar (ey_tv_ prefix'ini kaldır)
        if (!args.id.startsWith('ey_tv_')) {
            console.log(`Geçersiz TV ID formatı: ${args.id}`);
            return Promise.resolve({ meta: {} });
        }

        const channelId = args.id.substring(6); // 'ey_tv_' prefix'ini kaldır
        console.log(`TV kanalı ${channelId} için meta bilgisi aranıyor`);

        try {
            // TV kanalları listesinden al
            const channels = await fetchTVChannels(1000, null);
            const targetChannel = channels.find(channel =>
                channel.id?.toString() === channelId || channels.indexOf(channel).toString() === channelId
            );

            if (!targetChannel) {
                console.log(`TV kanalı ${channelId} bulunamadı`);
                return Promise.resolve({ meta: {} });
            }

            const meta = {
                id: args.id,
                type: 'tv',
                name: targetChannel.name || 'Bilinmeyen Kanal',
                poster: targetChannel.logo || 'https://via.placeholder.com/300x450/ff6b35/ffffff?text=TV',
                background: targetChannel.logo || undefined,
                description: `Canlı TV Kanalı: ${targetChannel.name || 'Bilinmeyen'}`,
                genres: ['TV', 'Live'],
                year: new Date().getFullYear(),
                country: 'TR',
                language: 'tr',
                runtime: 'Live Stream'
            };

            console.log(`✅ TV kanalı ${channelId} meta başarılı: "${meta.name}"`);
            return Promise.resolve({
                meta: meta,
                cacheMaxAge: 3600
            });

        } catch (error) {
            console.log(`❌ TV Meta hatası kanal ${channelId}: ${error.message}`);
            return Promise.resolve({
                meta: {
                    id: args.id,
                    type: 'tv',
                    name: `TV Kanalı ${channelId}`,
                    poster: 'https://via.placeholder.com/300x450/ff6b35/ffffff?text=TV'
                }
            });
        }
    }

    // Desteklenmeyen tip
    console.log(`Desteklenmeyen tip: ${args.type}`);
    return Promise.resolve({ meta: {} });
});

// Stream handler - Video kaynaklarını döndürür (Film ve TV)
builder.defineStreamHandler(async function(args) {
    // Movie stream handling
    if (args.type === 'movie') {
        // ID'den film ID'sini çıkar (ey prefix'ini kaldır)
        if (!args.id.startsWith('ey')) {
            return Promise.resolve({ streams: [] });
        }

        const movieId = args.id.substring(2); // 'ey' prefix'ini kaldır
        console.log(`🎬 Film ${movieId} için gelişmiş stream aranıyor`);

        try {
            // Filmler listesinden embedded verilerle birlikte al
            const movies = await fetchMovies(300, null, null); // Stream için filtreleme yok
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
    }

    // TV stream handling
    else if (args.type === 'tv') {
        // ID'den TV kanal ID'sini çıkar (ey_tv_ prefix'ini kaldır)
        if (!args.id.startsWith('ey_tv_')) {
            return Promise.resolve({ streams: [] });
        }

        const channelId = args.id.substring(6); // 'ey_tv_' prefix'ini kaldır
        console.log(`📺 TV kanalı ${channelId} için stream aranıyor`);

        try {
            // TV kanalları listesinden al
            const channels = await fetchTVChannels(1000, null);
            const targetChannel = channels.find(channel =>
                channel.id?.toString() === channelId || channels.indexOf(channel).toString() === channelId
            );

            if (!targetChannel) {
                console.log(`TV kanalı ${channelId} bulunamadı`);
                return Promise.resolve({ streams: [] });
            }

            console.log(`TV kanalı bulundu: ${targetChannel.name}`);
            const streams = [];

            // Her URL'yi stream olarak ekle
            if (targetChannel.url1) {
                streams.push({
                    name: `${targetChannel.name} - Kaynak 1`,
                    title: `${targetChannel.name} (HD)`,
                    url: targetChannel.url1,
                    ytId: null,
                    infoHash: null,
                    fileIdx: null,
                    quality: "HD",
                    tag: ["Live TV"],
                    behavioral_hints: {
                        notWebReady: false,
                        bingeGroup: `tv_${channelId}`
                    }
                });
            }

            if (targetChannel.url2) {
                streams.push({
                    name: `${targetChannel.name} - Kaynak 2`,
                    title: `${targetChannel.name} (Alternatif)`,
                    url: targetChannel.url2,
                    ytId: null,
                    infoHash: null,
                    fileIdx: null,
                    quality: "HD",
                    tag: ["Live TV", "Alternative"],
                    behavioral_hints: {
                        notWebReady: false,
                        bingeGroup: `tv_${channelId}`
                    }
                });
            }

            if (targetChannel.url3) {
                streams.push({
                    name: `${targetChannel.name} - Kaynak 3`,
                    title: `${targetChannel.name} (Yedek)`,
                    url: targetChannel.url3,
                    ytId: null,
                    infoHash: null,
                    fileIdx: null,
                    quality: "SD",
                    tag: ["Live TV", "Backup"],
                    behavioral_hints: {
                        notWebReady: false,
                        bingeGroup: `tv_${channelId}`
                    }
                });
            }

            if (targetChannel.url4) {
                streams.push({
                    name: `${targetChannel.name} - Kaynak 4`,
                    title: `${targetChannel.name} (Mobil)`,
                    url: targetChannel.url4,
                    ytId: null,
                    infoHash: null,
                    fileIdx: null,
                    quality: "SD",
                    tag: ["Live TV", "Mobile"],
                    behavioral_hints: {
                        notWebReady: false,
                        bingeGroup: `tv_${channelId}`
                    }
                });
            }

            console.log(`📺 TV kanalı ${channelId} için ${streams.length} stream döndürülüyor`);

            return Promise.resolve({
                streams: streams,
                cacheMaxAge: 300 // 5 dakika cache (TV için daha kısa)
            });

        } catch (error) {
            console.log(`❌ TV Stream hatası kanal ${channelId}: ${error.message}`);
            return Promise.resolve({ streams: [] });
        }
    }

    // Desteklenmeyen tip
    return Promise.resolve({ streams: [] });
});

module.exports = builder.getInterface();