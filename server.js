const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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
                thumbnail: info.videoDetails.thumbnails[0]?.url || '',
                author: info.videoDetails.author.name
            };
        }
        
        // For other platforms
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
                message: `🚧 دعم ${platform} قيد التطوير. يرجى استخدام روابط YouTube حالياً`
            };
        }
        
        return { isValid: false, error: '❌ الرابط غير صالح. يرجى التأكد من الرابط' };
    } catch (error) {
        console.error('Validation error:', error);
        return { isValid: false, error: '❌ حدث خطأ في التحقق من الرابط' };
    }
}

// Download endpoint
app.get('/download', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        console.log(`Download request: ${type} - ${url}`);
        
        // Validate input
        if (!url) {
            return res.status(400).json({ error: 'الرجاء إدخال رابط الفيديو' });
        }
        
        if (!type || !['mp4', 'mp3'].includes(type)) {
            return res.status(400).json({ error: 'نوع التحميل غير صحيح' });
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
                // Clean filename
                let title = info.videoDetails.title
                    .replace(/[^\w\s\u0600-\u06FF]/gi, '')
                    .substring(0, 100);
                
                if (type === 'mp4') {
                    // Get video format (try 18 first, then 22, then any with audio)
                    let format = ytdl.chooseFormat(info.formats, { 
                        quality: '18',
                        filter: 'audioandvideo'
                    });
                    
                    if (!format) {
                        format = ytdl.chooseFormat(info.formats, { 
                            quality: '22',
                            filter: 'audioandvideo'
                        });
                    }
                    
                    if (!format) {
                        format = info.formats.find(f => f.hasVideo && f.hasAudio);
                    }
                    
                    if (!format) {
                        return res.status(404).json({ error: 'لم يتم العثور على صيغة فيديو مناسبة' });
                    }
                    
                    res.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp4`);
                    res.header('Content-Type', 'video/mp4');
                    
                    const stream = ytdl(url, { format: format });
                    stream.pipe(res);
                    
                    stream.on('error', (error) => {
                        console.error('Stream error:', error);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'خطأ في تدفق الفيديو' });
                        }
                    });
                    
                } else if (type === 'mp3') {
                    // Get audio only format
                    const audioFormat = ytdl.chooseFormat(info.formats, { 
                        quality: '140',
                        filter: 'audioonly'
                    });
                    
                    if (!audioFormat) {
                        return res.status(404).json({ error: 'لم يتم العثور على صيغة صوتية مناسبة' });
                    }
                    
                    res.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp3`);
                    res.header('Content-Type', 'audio/mpeg');
                    
                    const stream = ytdl(url, { format: audioFormat });
                    stream.pipe(res);
                    
                    stream.on('error', (error) => {
                        console.error('Stream error:', error);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'خطأ في تدفق الصوت' });
                        }
                    });
                }
            } catch (error) {
                console.error('Download error:', error);
                res.status(500).json({ error: 'حدث خطأ أثناء التحميل: ' + error.message });
            }
        } else {
            res.status(501).json({ 
                error: `⚠️ دعم ${validation.platform} قيد التطوير حالياً`,
                message: 'يرجى استخدام روابط YouTube للتحميل الفوري'
            });
        }
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'خطأ داخلي في الخادم' });
    }
});

// Validate URL endpoint
app.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'الرابط مطلوب' });
        }
        
        const validation = await validateUrl(url);
        res.json(validation);
    } catch (error) {
        console.error('Validation endpoint error:', error);
        res.status(500).json({ error: 'خطأ في التحقق من الرابط' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'حدث خطأ غير متوقع' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📥 Media Downloader is ready to use`);
});
