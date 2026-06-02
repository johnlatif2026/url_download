// مثال بسيط باستخدام API خارجي
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    // استخدم API مجاني مثل y2mate أو savefrom
    const apiUrl = `https://api.vevioz.com/api/button/mp4/${encodeURIComponent(videoUrl)}`;
    
    try {
        const response = await axios.get(apiUrl);
        res.redirect(response.data.downloadUrl);
    } catch (error) {
        res.send('خطأ في التحميل');
    }
});

app.listen(3000);
