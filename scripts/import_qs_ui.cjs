const fs = require("fs");
const path = require("path");

const QS_DIR = "C:\\\\Users\\\\Hudson Brekker\\\\Downloads\\\\Sources\\\\QSanguosha\\\\image\\\\system";
const TARGET_DIR = path.join(__dirname, "..", "raw-assets", "main{m}", "system");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${entry.name}`);
    }
  }
}

if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });

const filesToCopy = ["tableBg.jpg", "card-back.png"];
for (const f of filesToCopy) {
  const p = path.join(QS_DIR, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(TARGET_DIR, f));
}

copyDir(path.join(QS_DIR, "roles"), path.join(TARGET_DIR, "roles"));
copyDir(path.join(QS_DIR, "magatamas"), path.join(TARGET_DIR, "magatamas"));
copyDir(path.join(QS_DIR, "phase"), path.join(TARGET_DIR, "phase"));

console.log("Done copying UI assets!");

