const fs = require("fs");
const path = require("path");

const QS_DIR = "C:\\\\Users\\\\Hudson Brekker\\\\Downloads\\\\Sources\\\\QSanguosha\\\\image";
const TARGET_DIR = path.join(__dirname, "..", "raw-assets", "main{m}");

function copyDir(src, dest, extFilter) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // For now, we only copy specific flat directories, so we can ignore deep recursion if not needed,
      // but let's support it just in case.
      copyDir(srcPath, destPath, extFilter);
    } else {
      if (!extFilter || entry.name.endsWith(extFilter)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${entry.name}`);
      }
    }
  }
}

console.log("Importing General Cards...");
copyDir(path.join(QS_DIR, "generals", "card"), path.join(TARGET_DIR, "generals", "card"), ".jpg");

console.log("Importing Playing Cards...");
copyDir(path.join(QS_DIR, "card"), path.join(TARGET_DIR, "cards", "card"), ".jpg");

console.log("Importing Equipments...");
copyDir(path.join(QS_DIR, "equips"), path.join(TARGET_DIR, "ui", "equips"), ".png");

console.log("Importing System Animations...");
copyDir(path.join(QS_DIR, "system", "animation"), path.join(TARGET_DIR, "system", "animation"), ".png");

console.log("Importing Action Animations...");
copyDir(path.join(QS_DIR, "animate"), path.join(TARGET_DIR, "animate"), ".png");

console.log("Done!");

