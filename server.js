import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";

const app = express();
app.use(cors());

app.get("/download", async (req, res) => {
    const { url, type } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).send("Invalid URL");
    }

    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");

        if (type === "mp4") {
            res.setHeader("Content-Disposition", `attachment; filename="${title}.mp4"`);

            ytdl(url, {
                filter: "audioandvideo",
                quality: "highest"
            }).pipe(res);
        }

        else if (type === "mp3") {
            res.setHeader("Content-Disposition", `attachment; filename="${title}.mp3"`);

            ytdl(url, {
                filter: "audioonly"
            }).pipe(res);
        }

        else {
            res.status(400).send("Invalid type");
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
