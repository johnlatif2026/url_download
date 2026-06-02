const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper function to validate URL and extract platform
async function validateUrl(url) {
    try {
        // Check if it's a YouTube URL
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url);
            return {
                isValid: true,
                platform: 'youtube',
                title: info.videoDetails.title,
                duration: info.videoDetails.lengthSeconds,
                thumbnail: info.videoDetails.thumbnails[0].url
            };
        }
        
        // For other platforms (TikTok, Instagram, Facebook, Twitter)
        // Note: These require additional APIs or services
        const urlPatterns = {
            tiktok: /(tiktok\.com)/i,
            instagram: /(instagram\.com)/i,
            facebook: /(facebook\.com|fb\.watch)/i,
            twitter: /(twitter\.com|x\.com)/i
        };
        
        let platform = null;
        for (const [key, pattern] of Object.entries(urlPatterns)) {
            if (pattern.test(url)) {
                platform = key;
                break;
            }
        }
        
        if (platform) {
            return {
                isValid: true,
                platform: platform,
                title: `${platform.toUpperCase()} Video`,
                message: `Support for ${platform} requires API integration. For now, YouTube is fully supported.`
            };
        }
        
        return { isValid: false, error: 'Unsupported URL format' };
    } catch (error) {
        return { isValid: false, error: 'Invalid URL or network error' };
    }
}

// Download endpoint
app.get('/download', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        // Validate input
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }
        
        if (!type || !['mp4', 'mp3'].includes(type)) {
            return res.status(400).json({ error: 'Type must be either mp4 or mp3' });
        }
        
        // Validate URL
        const validation = await validateUrl(url);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.error });
        }
        
        // Handle YouTube downloads
        if (validation.platform === 'youtube') {
            try {
                const info = await ytdl.getInfo(url);
                const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
                
                if (type === 'mp4') {
                    // Get video format with both video and audio
                    const format = ytdl.chooseFormat(info.formats, { 
                        quality: '18', // 360p MP4 with audio
                        filter: 'audioandvideo'
                    });
                    
                    if (!format) {
                        return res.status(404).json({ error: 'No suitable video format found' });
                    }
                    
                    res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
                    res.header('Content-Type', 'video/mp4');
                    
                    const stream = ytdl(url, { format: format });
                    stream.pipe(res);
                    
                    stream.on('error', (error) => {
                        console.error('Stream error:', error);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Error streaming video' });
                        }
                    });
                    
                } else if (type === 'mp3') {
                    // Get audio only format
                    const audioFormat = ytdl.chooseFormat(info.formats, { 
                        quality: '140', // m4a audio
                        filter: 'audioonly'
                    });
                    
                    if (!audioFormat) {
                        return res.status(404).json({ error: 'No audio format found' });
                    }
                    
                    res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
                    res.header('Content-Type', 'audio/mpeg');
                    
                    const stream = ytdl(url, { format: audioFormat });
                    stream.pipe(res);
                    
                    stream.on('error', (error) => {
                        console.error('Stream error:', error);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Error streaming audio' });
                        }
                    });
                }
            } catch (error) {
                console.error('Download error:', error);
                res.status(500).json({ error: 'Error processing download: ' + error.message });
            }
        } else {
            // For other platforms, return a message about limitations
            res.status(501).json({ 
                error: `Full support for ${validation.platform} requires third-party API integration. For now, please use YouTube URLs.`,
                message: validation.message
            });
        }
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Validate URL endpoint (for real-time validation)
app.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        const validation = await validateUrl(url);
        res.json(validation);
    } catch (error) {
        res.status(500).json({ error: 'Validation error' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});

module.exports = app;
