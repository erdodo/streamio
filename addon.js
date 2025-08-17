const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");

// API Configuration
const API_BASE_URL = 'https://app.erdoganyesil.org/api';
const API_HEADERS = {
    'accept': 'application/json',
    'X-Locale': 'en-US',
    'X-Role': 'root',
    'X-Authenticator': 'basic',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInRlbXAiOnRydWUsImlhdCI6MTc1NTQyNTMxMSwic2lnbkluVGltZSI6MTc1NTQyNTMxMTU5NywiZXhwIjoxNzU1Njg0NTExLCJqdGkiOiJlNDhjZGU2Mi0yODkwLTRlNzQtYTkzNC00NmJhNGI1ZjhhM2MifQ.kSgJBfD3lUWses3SvlcxVEsca5vTZdo-5OgRh055YXg',
    'X-App': 'erdoFlix',
    'X-Timezone': '+03:00',
    'X-Hostname': 'app.erdoganyesil.org'
};

const manifest = {
    "id": "org.erdoganyesil.erdoflix",
    "version": "1.0.2",

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
                    "options": ["aksiyon", "komedi", "dram", "korku", "bilim kurgu"],
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
            "id": "erdoflix_top",
            "name": "ErdoFlix Popüler",
            "extra": [
                {
                    "name": "skip", 
                    "isRequired": false
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
        const filterParam = encodeURIComponent('{}');
        const url = `${API_BASE_URL}/filmler:list?filter=${filterParam}&pageSize=${limit}`;
        console.log(`API'ye istek gönderiliyor: ${url}`);

        const response = await axios.get(url, {
            headers: API_HEADERS,
            timeout: 10000
        });

        console.log(`API yanıtı: ${response.status}`);
        console.log(`API'den ${response.data.data?.length || 0} film alındı`);
        console.log(`Toplam film sayısı: ${response.data.meta?.count || 'bilinmiyor'}`);
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

async function fetchMovieSources(movieId) {
    try {
        const filterParam = encodeURIComponent(`{"kaynak_id":${movieId}}`);
        const timestamp = Date.now();
        const url = `${API_BASE_URL}/film_kaynaklari:list?filter=${filterParam}&_t=${timestamp}`;
        console.log(`Film kaynakları alınıyor: ${url}`);

        const response = await axios.get(url, {
            headers: {
                ...API_HEADERS,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 5000
        });

        console.log(`Kaynak yanıtı: ${response.status}`);
        console.log(`Film ${movieId} için ${response.data.data?.length || 0} kaynak bulundu`);
        return response.data.data || [];
    } catch (error) {
        console.log(`Film kaynakları alınırken hata: ${error.message}`);
        return [];
    }
}

async function fetchMovieSubtitles(movieId) {
    try {
        const filterParam = encodeURIComponent(`{"film_id":${movieId}}`);
        // Cache busting için timestamp ekle
        const timestamp = Date.now();
        const url = `${API_BASE_URL}/film_altyazilari:list?filter=${filterParam}&_t=${timestamp}`;
        console.log(`Film altyazıları alınıyor: ${url}`);

        const response = await axios.get(url, {
            headers: {
                ...API_HEADERS,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 5000
        });

        console.log(`Altyazı yanıtı: ${response.status}`);
        console.log(`Film ${movieId} için ${response.data.data?.length || 0} altyazı bulundu`);
        return response.data.data || [];
    } catch (error) {
        console.log(`Film altyazıları alınırken hata: ${error.message}`);
        return [];
    }
}

const builder = new addonBuilder(manifest);

// Catalog handler - Film listesini döndürür
builder.defineCatalogHandler(async function(args) {
    console.log(`Catalog istegi: ${JSON.stringify(args)}`);

    if (args.type !== 'movie' || !['erdoflix_movies', 'erdoflix_top'].includes(args.id)) {
        return Promise.resolve({ metas: [] });
    }

    try {
        // Skip parametresi için sayfalama
        const skip = parseInt(args.extra?.skip) || 0;
        const pageSize = args.id === 'erdoflix_top' ? 20 : 50; // Popüler için daha az
        
        const movies = await fetchMovies(300);
        console.log(`${movies.length} film alındı, catalog: ${args.id}, skip: ${skip}`);

        // Popüler catalog için tersten sırala (en yeni önce)
        let processedMovies = args.id === 'erdoflix_top' 
            ? movies.slice().reverse() 
            : movies;

        // Sayfalama uygula
        const paginatedMovies = processedMovies.slice(skip, skip + pageSize);
        
        const metas = paginatedMovies.map(movie => ({
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
            // Ana sayfa için ek meta bilgiler
            genre: ['film'],
            runtime: undefined,
            imdbRating: undefined,
            // Popüler catalog için öncelik
            ...(args.id === 'erdoflix_top' && { featured: true })
        }));

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
            genres: ['Film'],
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
    console.log(`Film ${movieId} için stream aranıyor`);

    try {
        const [sources, subtitles] = await Promise.all([
            fetchMovieSources(movieId),
            fetchMovieSubtitles(movieId)
        ]);

        const streams = [];

        // Her kaynak için stream oluştur
        for (const source of sources) {
            if (!source.url) continue;

            const stream = {
                url: source.url,
                title: source.baslik || `ErdoFlix - ${source.id}`,
                subtitles: []
            };

            // Altyazıları ekle
            for (const subtitle of subtitles) {
                if (subtitle.url) {
                    const sub = {
                        url: subtitle.url,
                        lang: subtitle.baslik // Varsayılan Türkçe
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
                        sub.label = 'Türkçe';
                    }

                    stream.subtitles.push(sub);
                }
            }

            console.log(`Kaynak "${stream.title}" için ${stream.subtitles.length} altyazı eklendi`);
            streams.push(stream);
        }

        console.log(`Film ${movieId} için ${streams.length} stream döndürülüyor`);
        return Promise.resolve({ streams: streams });
    } catch (error) {
        console.log(`Stream hatası: ${error.message}`);
        return Promise.resolve({ streams: [] });
    }
});

module.exports = builder.getInterface();