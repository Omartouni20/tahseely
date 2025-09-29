const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const fs = require("fs");

// 📂 تخزين الملفات مؤقتًا في فولدر uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// 🟢 فلتر الملفات (صور + PDF)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff",
    ".heic", ".heif", // دعم صور الآيفون
    ".pdf"
  ];

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("صيغة الملف غير مدعومة"), false);
  }
};

const upload = multer({ storage, fileFilter });

// 🟣 ميدل وير بعد الرفع: HEIC → JPG وضغط باقي الصور
const processImage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPdf = ext === ".pdf";
    const isHeic = ext === ".heic" || ext === ".heif";

    if (isPdf) return next(); // ✅ PDF يترفع زي ما هو

    let outputPath = req.file.path;

    if (isHeic) {
      try {
        const inputBuffer = fs.readFileSync(req.file.path);
        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: "JPEG",
          quality: 0.8,
        });

        outputPath = req.file.path.replace(/\.(heic|heif)$/i, ".jpg");
        fs.writeFileSync(outputPath, outputBuffer);
        fs.unlinkSync(req.file.path);

        req.file.filename = path.basename(outputPath);
        req.file.path = outputPath;
      } catch (e) {
        console.warn("⚠️ HEIC convert failed, keeping original:", e.message);
      }
    } else {
      try {
        const outputBuffer = await sharp(req.file.path)
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        outputPath = req.file.path.replace(path.extname(req.file.path), ".jpg");
        fs.writeFileSync(outputPath, outputBuffer);
        if (outputPath !== req.file.path) fs.unlinkSync(req.file.path);

        req.file.filename = path.basename(outputPath);
        req.file.path = outputPath;
      } catch (e) {
        console.warn("⚠️ Sharp compression failed, keeping original:", e.message);
      }
    }

    next();
  } catch (err) {
    console.error("❌ Error in processImage:", err);
    // 👇 متوقفش السيرفر، عدّي وخلي الملف الأصلي زي ما هو
    next();
  }
};

module.exports = { upload, processImage };
