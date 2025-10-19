const fs = require("fs");
const path = "package.json";
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
pkg.dependencies["@clerk/nextjs"] = "^5.4.1";
pkg.dependencies["@clerk/elements"] = "^0.14.6";
pkg.dependencies["next-cloudinary"] = "^6.13.0";
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
