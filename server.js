const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// التحقق من الرابط
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
        return { isValid: false, error: '❌ حدث خطأ في التحقق' };
    }
}

// Endpoint التحميل الرئيسي
app.get('/download', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'رابط غير صالح' });
        }
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s\u0600-\u06FF]/gi, '').substring(0, 50);
        
        if (type === 'mp4') {
            res.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp4`);
            res.header('Content-Type', 'video/mp4');
            ytdl(url, { quality: '18', filter: 'audioandvideo' }).pipe(res);
        } 
        else if (type === 'mp3') {
            res.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp3`);
            res.header('Content-Type', 'audio/mpeg');
            ytdl(url, { quality: '140', filter: 'audioonly' }).pipe(res);
        }
        else {
            res.status(400).json({ error: 'نوع غير صحيح' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'فشل التحميل: ' + error.message });
    }
});

// Endpoint التحقق
app.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'الرابط مطلوب' });
        }
        const validation = await validateUrl(url);
        res.json(validation);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في التحقق' });
    }
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// للتصدير في Vercel
if (process.env.VERCEL) {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
