const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

//Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper function للتحقق من الرابط
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
        return { isValid: false, error: '❌ الرابط غير صالح. يرجى التأكد من الرابط' };
    } catch (error) {
        return { isValid: false, error: '❌ حدث خطأ في التحقق من الرابط' };
    }
}

// *** نقطة التحول: Endpoint جديد لاستخراج رابط التحميل المباشر ***
app.get('/get-link', async (req, res) => {
    try {
        const { url, type } = req.query;
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'رابط يوتيوب غير صالح' });
        }

        // 1. نجيب معلومات الفيديو
        const info = await ytdl.getInfo(url);
        
        // 2. ننضف اسم الملف
        let title = info.videoDetails.title
            .replace(/[^\w\s\u0600-\u06FF]/gi, '')
            .substring(0, 50);
            
        let directUrl = '';
        let fileExt = '';
        
        if (type === 'mp4') {
            // اختيار أفضل جودة فيديو (360p أو 720p)
            let format = info.formats.find(f => f.hasVideo && f.hasAudio && f.qualityLabel === '360p');
            if (!format) format = info.formats.find(f => f.hasVideo && f.hasAudio);
            if (!format) throw new Error('No video format found');
            directUrl = format.url;
            fileExt = 'mp4';
        } else {
            // اختيار أفضل جودة صوت
            let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate === 128);
            if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
            if (!format) throw new Error('No audio format found');
            directUrl = format.url;
            fileExt = 'mp3';
        }
        
        // 3. نرجع الرابط للواجهة عشان المتصفح يفتحه
        res.json({
            success: true,
            downloadUrl: directUrl, // الرابط السحري من سيرفرات جوجل
            filename: `${title}.${fileExt}`
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'فشل استخراج رابط التحميل: ' + error.message });
    }
});

// Validate endpoint (نفس الكود القديم)
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

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server ready on http://localhost:${PORT}`);
    console.log(`🎯 New endpoint: /get-link?url=VIDEO_URL&type=mp4`);
});
