const express = require("express");
const crypto = require("crypto");
const { exec } = require("child_process");

const router = express.Router();

const GITHUB_SECRET = process.env.GITHUB_SECRET || "focus123";

const PROJECT_DIR = "/var/www/TATA-TVS-backend";
const PM2_PROCESS = "TATA-TVS-backend";

router.post("/", (req, res) => {

  const signature = req.headers["x-hub-signature-256"];
  const event = req.headers["x-github-event"] || "unknown";

  if (event === "ping") {
    return res.status(200).json({ success: true, message: "Ping received" });
  }

  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing signature" });
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", GITHUB_SECRET)
      .update(req.rawBody)
      .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  ) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  res.status(200).json({ success: true, message: "Deployment started" });

exec(
`cd ${PROJECT_DIR} &&
git fetch origin main &&
git diff --quiet HEAD origin/main || (
    echo  &&
    git reset --hard origin/main &&
    npm ci --omit=dev &&
    pm2 reload TATA-TVS-backend &&
    echo 
)`,
(err, stdout, stderr) => {

    if (err) {
        console.error("❌ Deploy error:", err);
        return;
    }

    console.log(stdout);

    if (stderr) console.error(stderr);
});
});

module.exports = router;