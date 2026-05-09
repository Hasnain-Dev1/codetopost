const https = require("https");
const fs = require("fs");

fetch("https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Regular.ttf")
  .then(res => res.arrayBuffer())
  .then(arrayBuffer => {
    fs.writeFileSync("public/JetBrainsMono.ttf", Buffer.from(arrayBuffer));
    console.log("Font downloaded successfully!");
  })
  .catch(err => console.error("Download failed:", err.message));