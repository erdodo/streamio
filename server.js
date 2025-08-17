const { serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const path = require("path");

const addonInterface = require("./addon");
const port = process.env.PORT || 3000;

// Express app oluştur
const app = express();

// Static files serve et
app.use(express.static('public'));

// Ana sayfa route'u
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Stremio addon router'ını mount et
const addonRouter = getRouter(addonInterface);
app.use(addonRouter);

// Server'ı başlat
app.listen(port, () => {
    console.log(`HTTP addon accessible at: http://127.0.0.1:${port}/manifest.json`);
    console.log(`Landing page available at: http://127.0.0.1:${port}/`);
});