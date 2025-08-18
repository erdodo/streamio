const { serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const path = require("path");

const addonInterface = require("./addon");
const port = process.env.PORT || 3002;

// Express app oluştur
const app = express();

// Static files serve et
app.use(express.static('public'));

// Ana sayfa route'u
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug endpoint - film ve altyazı durumunu kontrol et
app.get('/debug/movie/:id', async (req, res) => {
    const movieId = req.params.id;

    try {
        // Addon'dan helper fonksiyonları kullan
        const addon = require('./addon');

        res.json({
            movieId: movieId,
            timestamp: new Date().toISOString(),
            message: `Film ${movieId} için debug bilgileri alınıyor. Terminalde log'ları kontrol edin.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test M3U8 parse endpoint
app.get('/debug/m3u8', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parametresi gerekli: ?url=https://example.com/playlist.m3u8' });
        }

        const axios = require('axios');

        console.log(`🔍 Test M3U8 parse: ${url}`);
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
        const videoTracks = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Subtitle tracks
            if (line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
                const subtitle = { line: line };

                const langMatch = line.match(/LANGUAGE="([^"]+)"/);
                if (langMatch) subtitle.lang = langMatch[1];

                const nameMatch = line.match(/NAME="([^"]+)"/);
                if (nameMatch) subtitle.label = nameMatch[1];

                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) subtitle.url = uriMatch[1];

                subtitles.push(subtitle);
            }

            // Audio tracks
            if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
                const audio = { line: line };

                const langMatch = line.match(/LANGUAGE="([^"]+)"/);
                if (langMatch) audio.lang = langMatch[1];

                const nameMatch = line.match(/NAME="([^"]+)"/);
                if (nameMatch) audio.name = nameMatch[1];

                audioTracks.push(audio);
            }

            // Stream info
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                const stream = { line: line };

                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
                if (bandwidthMatch) stream.bandwidth = parseInt(bandwidthMatch[1]);

                const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                if (resolutionMatch) stream.resolution = resolutionMatch[1];

                videoTracks.push(stream);
            }
        }

        res.json({
            url: url,
            timestamp: new Date().toISOString(),
            totalLines: lines.length,
            result: {
                subtitles: subtitles,
                audioTracks: audioTracks,
                videoTracks: videoTracks
            },
            rawContent: content.substring(0, 1000) + (content.length > 1000 ? '...' : '')
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Stremio addon router'ını mount et
const addonRouter = getRouter(addonInterface);
app.use(addonRouter);

// Server'ı başlat
app.listen(port, () => {
    console.log(`HTTP addon accessible at: http://127.0.0.1:${port}/manifest.json`);
    console.log(`Landing page available at: http://127.0.0.1:${port}/`);
});