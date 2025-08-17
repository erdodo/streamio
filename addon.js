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
    "version": "1.0.0",

    "name": "ErdoFlix M3U8 Addon",
    "description": "Erdogan Yesil API ile M3U8 kaynaklarını sunan Stremio addon'u",

    "types": ["movie"],

    "catalogs": [
        {
            "type": "movie",
            "id": "erdoflix_movies",
            "name": "ErdoFlix Filmler"
        }
    ],

    "resources": [
        "catalog",
        {
            "name": "stream",
            "types": ["movie"],
            "idPrefixes": ["ey"]
        }
    ]
};

// API Helper Functions
async function fetchMovies(limit = 100) {
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
    if (args.type !== 'movie' || args.id !== 'erdoflix_movies') {
        return Promise.resolve({ metas: [] });
    }

    try {
        const movies = await fetchMovies();
        const metas = movies.map(movie => ({
            id: `ey${movie.id}`,
            type: 'movie',
            name: movie.baslik || movie.orjinal_baslik || `Film ${movie.id}`,
            poster: movie.poster || undefined,
            background: movie.arka_plan || undefined,
            description: movie.detay || undefined,
            releaseInfo: movie.yayin_tarihi || undefined,
            imdbRating: undefined,
            genres: undefined
        }));

        console.log(`Catalog'da ${metas.length} film döndürülüyor`);
        return Promise.resolve({ metas: metas });
    } catch (error) {
        console.log(`Catalog hatası: ${error.message}`);
        return Promise.resolve({ metas: [] });
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