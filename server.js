const express = require('express');
const cors = require('cors');
const ytdlp = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Pro-level info fetching
app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        
        console.log(`[PRO] Fetching info: ${url}`);
        
        // Try anonymous first
        try {
            const info = await ytdlp(url, { 
                dumpJson: true, 
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                youtubeSkipDashManifest: true,
                noCacheDir: true, // Crucial for serverless/read-only environments
                extractorArgs: 'twitter:api=syndication'
            });
            return res.json({
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration_string || info.duration,
                channel: info.uploader || info.channel || info.extractor_key,
            });
        } catch (initialError) {
            console.error(`[PRO] Extraction failed:`, initialError.message);
            
            // Only try browser cookies on Windows (Local Development)
            if (process.platform === 'win32') {
                console.log(`[PRO] Attempting local browser cookies...`);
                const browsers = ['edge', 'chrome', 'firefox', 'brave'];
                for (const browser of browsers) {
                    try {
                        const info = await ytdlp(url, { 
                            dumpJson: true, 
                            noWarnings: true,
                            noCacheDir: true,
                            cookiesFromBrowser: browser
                        });
                        return res.json({
                            title: info.title,
                            thumbnail: info.thumbnail,
                            duration: info.duration_string || info.duration,
                            channel: info.uploader || info.channel || info.extractor_key,
                            authenticated: true
                        });
                    } catch (e) {
                        console.log(`[PRO] ${browser} failed.`);
                    }
                }
            }
            res.status(500).json({ error: initialError.message });
            return;
        }
    } catch (error) {
        console.error('[PRO] Fatal Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
});

// Pro-level streaming download
app.get('/api/download', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL is required');

    try {
        console.log(`[PRO] Downloading: ${url}`);
        
        // Define helper for downloading with cookies
        const startDownload = async (browser = null) => {
            const options = {
                dumpJson: true,
                noWarnings: true,
                noCacheDir: true,
                extractorArgs: 'twitter:api=syndication'
            };
            if (browser) options.cookiesFromBrowser = browser;

            const info = await ytdlp(url, options);
            let title = (info.title || 'video').replace(/[^\w\s-]/g, '').trim();
            let ext = info.ext || 'mp4';
            if (ext === 'webm') ext = 'mp4';

            res.header('Content-Type', 'video/mp4');
            res.attachment(`${title || 'video'}.${ext}`);
            
            const dlOptions = {
                format: 'best[ext=mp4]/best',
                output: '-',
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                noCacheDir: true,
                extractorArgs: 'twitter:api=syndication'
            };
            if (browser) dlOptions.cookiesFromBrowser = browser;

            const ytDlpProcess = ytdlp.exec(url, dlOptions);
            ytDlpProcess.stdout.pipe(res);
            ytDlpProcess.on('error', (err) => {
                console.error('[PRO] Process Error:', err);
                if (!res.headersSent) res.status(500).send('Download failed: ' + err.message);
            });
            req.on('close', () => { ytDlpProcess.kill(); });
        };

        // Try anonymous first
        try {
            await startDownload();
        } catch (e) {
            console.error(`[PRO] Download failed:`, e.message);
            if (process.platform === 'win32') {
                const browsers = ['edge', 'chrome', 'firefox', 'brave'];
                for (const browser of browsers) {
                    try {
                        await startDownload(browser);
                        return;
                    } catch (err) {
                        console.log(`[PRO] ${browser} download failed.`);
                    }
                }
            }
            if (!res.headersSent) res.status(500).send('All download methods failed: ' + e.message);
        }

    } catch (error) {
        console.error('[PRO] Download Error:', error);
        if (!res.headersSent) res.status(500).send('Download error');
    }
});

app.listen(PORT, () => {
    console.log(`[PRO] VidSync is live at http://localhost:${PORT}`);
});
