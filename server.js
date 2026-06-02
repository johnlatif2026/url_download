import express from "express";
import cors from "cors";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";

const app = express();

app.use(cors());

app.get("/download", async (req, res) => {
    try {
        const { url, type } = req.query;

        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).send("Invalid URL");
        }

        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");

        if (type === "mp4") {
            res.header("Content-Disposition", `attachment; filename="${title}.mp4"`);

            ytdl(url, {
                filter: "audioandvideo",
                quality: "highest"
            }).pipe(res);
        }

        else if (type === "mp3") {
            res.header("Content-Disposition", `attachment; filename="${title}.mp3"`);

            const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

            ffmpeg(stream)
                .format("mp3")
                .audioBitrate(128)
                .pipe(res);
        }

        else {
            return res.status(400).send("Invalid type");
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// مهم لـ Vercel
export default app;
