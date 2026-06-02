const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to validate URL and extract platform
async function validateUrl(url) {
    try {
        console.log('Validating URL:', url);
        
        // Check if it's a YouTube URL
        if (ytdl.validateURL(url)) {
            try {
                const info = await ytdl.getInfo(url);
                console.log('Video info fetched successfully');
                return {
                    isValid: true,
                    platform: 'youtube',
                    title: info.videoDetails.title,
                    duration: info.videoDetails.lengthSeconds,
                    thumbnail: info.videoDetails.thumbnails[0]?.url || '',
                    author: info.videoDetails.author?.name || 'Unknown'
                };
            } catch (infoError) {
                console.error('Error getting video info:', infoError);
                return {
                    isValid: true,
                    platform: 'youtube',
                    title: 'YouTube Video',
                    message: 'تم التحقق من الرابط بنجاح'
                };
            }
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
        return { isValid: false, error: '❌ حدث خطأ في التحقق من الرابط: ' + error.message };
    }
}

// Download endpoint
app.get('/download', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        console.log(`Download request: ${type} - ${url}`);
        
        if (!url) {
            return res.status(400).json({ error: 'الرجاء إدخال رابط الفيديو' });
        }
        
        if (!type || !['mp4', 'mp3'].includes(type)) {
            return res.status(400).json({ error: 'نوع التحميل غير صحيح' });
        }
        
        // Check if it's a YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'الرابط ليس رابط يوتيوب صحيح' });
        }
        
        try {
            const info = await ytdl.getInfo(url);
            let title = info.videoDetails.title
                .replace(/[^\w\s\u0600-\u06FF]/gi, '')
                .substring(0, 100);
            
            if (type === 'mp4') {
                // Try different quality options
                let format = info.formats.find(f => f.hasVideo && f.hasAudio && f.qualityLabel === '360p');
                if (!format) format = info.formats.find(f => f.hasVideo && f.hasAudio && f.qualityLabel === '480p');
                if (!format) format = info.formats.find(f => f.hasVideo && f.hasAudio && f.qualityLabel === '720p');
                if (!format) format = info.formats.find(f => f.hasVideo && f.hasAudio);
                
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
                const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
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
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'خطأ داخلي في الخادم' });
    }
});

// Validate URL endpoint
app.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;
        console.log('Validate request received for:', url);
        
        if (!url) {
            return res.status(400).json({ error: 'الرابط مطلوب' });
        }
        
        const validation = await validateUrl(url);
        console.log('Validation result:', validation);
        res.json(validation);
    } catch (error) {
        console.error('Validation endpoint error:', error);
        res.status(500).json({ error: 'خطأ في التحقق من الرابط: ' + error.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📥 Media Downloader is ready to use`);
    console.log(`✅ Make sure you have internet connection`);
});
