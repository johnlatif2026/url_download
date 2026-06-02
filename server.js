const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const path = require('path');
const https = require('https');
const stream = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function validateUrl(url) {
    try {
        if (ytdl.validateURL(url)) {
            try {
                const info = await ytdl.getInfo(url);
                return {
                    isValid: true,
                    platform: 'youtube',
                    title: info.videoDetails.title,
                    duration: info.videoDetails.lengthSeconds,
                    thumbnail: info.videoDetails.thumbnails[0]?.url || '',
                    author: info.videoDetails.author?.name || 'Unknown'
                };
            } catch (infoError) {
                return { isValid: true, platform: 'youtube', title: 'YouTube Video' };
            }
        }
        return { isValid: false, error: '❌ الرابط غير صالح' };
    } catch (error) {
        return { isValid: false, error: '❌ حدث خطأ' };
    }
}

// Endpoint للتحميل المباشر (وليس رابط)
app.get('/download-stream', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'رابط غير صالح' });
        }

        const info = await ytdl.getInfo(url);
        let title = info.videoDetails.title.replace(/[^\w\s]/gi, '').substring(0, 50);
        
        if (type === 'mp4') {
            // اختيار أفضل تنسيق فيديو
            const format = ytdl.chooseFormat(info.formats, { 
                quality: 'lowest',
                filter: 'audioandvideo'
            });
            
            if (!format) {
                return res.status(404).json({ error: 'لا يوجد تنسيق فيديو' });
            }
            
            // تعيين headers للتحميل
            res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
            res.header('Content-Type', 'video/mp4');
            
            // تدفق الفيديو مباشرة
            const videoStream = ytdl(url, { format: format });
            videoStream.pipe(res);
            
            videoStream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'خطأ في التدفق' });
                }
            });
            
        } else if (type === 'mp3') {
            // تنسيق الصوت
            const audioFormat = ytdl.chooseFormat(info.formats, { 
                quality: '140',
                filter: 'audioonly'
            });
            
            if (!audioFormat) {
                return res.status(404).json({ error: 'لا يوجد تنسيق صوت' });
            }
            
            res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
            res.header('Content-Type', 'audio/mpeg');
            
            const audioStream = ytdl(url, { format: audioFormat });
            audioStream.pipe(res);
            
            audioStream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'خطأ في التدفق' });
                }
            });
        }
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'فشل التحميل: ' + error.message });
    }
});

// Validate endpoint
app.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'الرابط مطلوب' });
        const validation = await validateUrl(url);
        res.json(validation);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في التحقق' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server on http://localhost:${PORT}`);
});
