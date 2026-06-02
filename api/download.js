import ytdl from "@distube/ytdl-core";

export default async function handler(req, res) {
    const { url, type } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).send("Invalid URL");
    }

    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");

        if (type === "mp4") {
            res.setHeader("Content-Disposition", `attachment; filename="${title}.mp4"`);
            res.setHeader("Content-Type", "video/mp4");

            ytdl(url, {
                filter: "audioandvideo",
                quality: "highest"
            }).pipe(res);
        }

        else if (type === "mp3") {
            res.setHeader("Content-Disposition", `attachment; filename="${title}.mp3"`);
            res.setHeader("Content-Type", "audio/mpeg");

            const stream = ytdl(url, {
                filter: "audioonly",
                quality: "highestaudio"
            });

            stream.pipe(res);
        }

        else {
            return res.status(400).send("Invalid type");
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
}
