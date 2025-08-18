const puppeteer = require('puppeteer');
const axios = require('axios');

class VideasyExtractor {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 dakika cache
    }

    /**
     * TMDB ID'den Videasy iframe URL'si oluşturur
     */
    getVideasyUrl(tmdbId) {
        return `https://player.videasy.net/movie/${tmdbId}`;
    }

    /**
     * Cache kontrolü yapar
     */
    getCached(tmdbId) {
        const cached = this.cache.get(tmdbId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📋 Cache'den Videasy stream alındı: ${tmdbId}`);
            return cached.data;
        }
        return null;
    }

    /**
     * Cache'e kaydet
     */
    setCache(tmdbId, data) {
        this.cache.set(tmdbId, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * API endpoint'lerini dener
     */
    async tryAPIEndpoints(tmdbId) {
        const baseUrl = 'https://player.videasy.net';
        const endpoints = [
            `/api/movie/${tmdbId}`,
            `/api/stream/${tmdbId}`,
            `/movie/${tmdbId}/stream`,
            `/embed/${tmdbId}/sources`,
            `/player/config/${tmdbId}`,
            `/api/v1/movie/${tmdbId}`,
            `/api/sources/${tmdbId}`,
        ];

        console.log(`🔍 Videasy API endpoint'leri deneniyor: ${tmdbId}`);

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(baseUrl + endpoint, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': `${baseUrl}/movie/${tmdbId}`,
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
                        'Origin': baseUrl
                    },
                    timeout: 5000
                });

                if (response.data && response.data.sources) {
                    console.log(`✅ Videasy API bulundu: ${endpoint}`);
                    return this.parseAPISources(response.data.sources);
                }
                
                if (response.data && response.data.url) {
                    console.log(`✅ Videasy direkt URL bulundu: ${endpoint}`);
                    return [{
                        url: response.data.url,
                        quality: response.data.quality || 'Unknown',
                        type: response.data.type || 'video/mp4'
                    }];
                }

            } catch (error) {
                console.log(`❌ API ${endpoint}: ${error.message}`);
            }
        }

        return null;
    }

    /**
     * API response'dan stream'leri parse eder
     */
    parseAPISources(sources) {
        const streams = [];
        
        if (Array.isArray(sources)) {
            sources.forEach(source => {
                if (source.file || source.url || source.src) {
                    streams.push({
                        url: source.file || source.url || source.src,
                        quality: source.label || source.quality || 'Auto',
                        type: source.type || 'video/mp4'
                    });
                }
            });
        } else if (typeof sources === 'object') {
            Object.keys(sources).forEach(quality => {
                const url = sources[quality];
                if (typeof url === 'string' && url.startsWith('http')) {
                    streams.push({
                        url: url,
                        quality: quality,
                        type: 'video/mp4'
                    });
                }
            });
        }

        return streams;
    }

    /**
     * Puppeteer ile iframe'i analiz eder
     */
    async extractWithPuppeteer(tmdbId) {
        let browser = null;
        
        try {
            console.log(`🎭 Puppeteer ile Videasy analizi başlıyor: ${tmdbId}`);
            
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            
            // User agent ayarla
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            const videoStreams = [];
            
            // Network isteklerini dinle
            page.on('response', async (response) => {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                
                // Video stream'lerini yakala
                if (this.isVideoStream(url, contentType)) {
                    console.log(`🎬 Video stream yakalandı: ${url}`);
                    videoStreams.push({
                        url: url,
                        quality: this.extractQuality(url),
                        type: contentType || 'video/mp4',
                        headers: response.headers()
                    });
                }
            });

            const iframeUrl = this.getVideasyUrl(tmdbId);
            console.log(`📺 Iframe yükleniyor: ${iframeUrl}`);
            
            await page.goto(iframeUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Sayfanın yüklenmesini bekle
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Play butonuna tıklamaya çalış
            try {
                const playButton = await page.$('button[class*="play"], .play-button, [aria-label*="play"], .vjs-big-play-button, .plyr__control--overlaid');
                if (playButton) {
                    console.log('▶️ Play butonuna tıklanıyor...');
                    await playButton.click();
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (e) {
                console.log('ℹ️ Play butonu bulunamadı, otomatik oynatma olabilir');
            }

            // DOM'dan video elementlerini kontrol et
            const domVideos = await page.evaluate(() => {
                const videos = [];
                
                // Video elementleri
                document.querySelectorAll('video').forEach(video => {
                    if (video.src) {
                        videos.push({
                            url: video.src,
                            quality: 'Auto',
                            type: 'video/mp4',
                            source: 'video-element'
                        });
                    }
                    
                    // Source elementleri
                    video.querySelectorAll('source').forEach(source => {
                        if (source.src) {
                            videos.push({
                                url: source.src,
                                quality: source.getAttribute('label') || 'Auto',
                                type: source.type || 'video/mp4',
                                source: 'source-element'
                            });
                        }
                    });
                });

                // Script'lerden URL'leri çıkar
                document.querySelectorAll('script').forEach(script => {
                    const content = script.textContent;
                    
                    // M3U8 URL'leri
                    const m3u8Matches = content.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"']*/g);
                    if (m3u8Matches) {
                        m3u8Matches.forEach(url => {
                            videos.push({
                                url: url,
                                quality: 'HLS',
                                type: 'application/x-mpegURL',
                                source: 'script-m3u8'
                            });
                        });
                    }
                    
                    // MP4 URL'leri
                    const mp4Matches = content.match(/https?:\/\/[^\s'"]+\.mp4[^\s'"']*/g);
                    if (mp4Matches) {
                        mp4Matches.forEach(url => {
                            videos.push({
                                url: url,
                                quality: 'Auto',
                                type: 'video/mp4',
                                source: 'script-mp4'
                            });
                        });
                    }
                });

                return videos;
            });

            // Network'den yakalanan ve DOM'dan çıkarılan stream'leri birleştir
            const allStreams = [...videoStreams, ...domVideos];
            
            // Duplicate'leri kaldır
            const uniqueStreams = this.removeDuplicates(allStreams);
            
            console.log(`📊 Toplam ${uniqueStreams.length} video stream bulundu`);
            
            return uniqueStreams;

        } catch (error) {
            console.log(`❌ Puppeteer hatası: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * URL'nin video stream olup olmadığını kontrol eder
     */
    isVideoStream(url, contentType) {
        const videoContentTypes = ['video/', 'application/x-mpegurl', 'application/vnd.apple.mpegurl'];
        const videoExtensions = ['.m3u8', '.mp4', '.mkv', '.avi', '.webm', '.ts'];
        
        // Content type kontrolü
        if (videoContentTypes.some(type => contentType.toLowerCase().includes(type))) {
            return true;
        }
        
        // URL extension kontrolü
        if (videoExtensions.some(ext => url.toLowerCase().includes(ext))) {
            return true;
        }
        
        // Manifest keyword'leri
        if (url.includes('manifest') || url.includes('playlist')) {
            return true;
        }
        
        return false;
    }

    /**
     * URL'den kalite bilgisini çıkarır
     */
    extractQuality(url) {
        const qualityMatches = url.match(/(\d+p|\d+x\d+)/i);
        if (qualityMatches) {
            return qualityMatches[1];
        }
        
        if (url.includes('1080')) return '1080p';
        if (url.includes('720')) return '720p';
        if (url.includes('480')) return '480p';
        if (url.includes('360')) return '360p';
        
        return 'Auto';
    }

    /**
     * Duplicate stream'leri kaldırır
     */
    removeDuplicates(streams) {
        const seen = new Set();
        return streams.filter(stream => {
            const key = stream.url;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Ana extraction fonksiyonu
     */
    async extractStreams(tmdbId) {
        try {
            // Cache kontrolü
            const cached = this.getCached(tmdbId);
            if (cached) {
                return cached;
            }

            console.log(`🎯 Videasy stream extraction başlıyor: TMDB ${tmdbId}`);

            // Önce API'yi dene
            let streams = await this.tryAPIEndpoints(tmdbId);
            
            // API'den sonuç alınamazsa Puppeteer'ı kullan
            if (!streams || streams.length === 0) {
                console.log('🎭 API\'den sonuc alinamadi, Puppeteer deneniyor...');
                streams = await this.extractWithPuppeteer(tmdbId);
            }

            // Sonuçları formatla
            const formattedStreams = this.formatForStremio(streams, tmdbId);
            
            // Cache'e kaydet
            this.setCache(tmdbId, formattedStreams);
            
            console.log(`✅ Videasy extraction tamamlandı: ${formattedStreams.length} stream`);
            return formattedStreams;

        } catch (error) {
            console.log(`❌ Videasy extraction hatası: ${error.message}`);
            return [];
        }
    }

    /**
     * Stream'leri Stremio formatına çevirir
     */
    formatForStremio(streams, tmdbId) {
        if (!streams || streams.length === 0) {
            return [];
        }

        return streams.map((stream, index) => ({
            url: stream.url,
            title: `Videasy ${stream.quality || 'Auto'} ${index > 0 ? `(${index + 1})` : ''}`.trim(),
            quality: stream.quality,
            subtitles: [],
            behaviorHints: {
                bingeGroup: `videasy-${tmdbId}`,
                countryWhitelist: ['TR', 'US', 'GB'],
                notWebReady: false
            }
        }));
    }

    /**
     * Videasy'de film olup olmadığını kontrol eder
     */
    async checkAvailability(tmdbId) {
        try {
            const iframeUrl = this.getVideasyUrl(tmdbId);
            const response = await axios.head(iframeUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout: 5000
            });
            
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}

module.exports = VideasyExtractor;
