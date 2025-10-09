const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const fs = require("fs");

// 📂 تحديد مكان التخزين المؤقت
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // ✅ لو مفيش اسم أو امتداد، نضيف .jpg بشكل افتراضي
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype) {
      ext = "." + file.mimetype.split("/")[1];
    }
    if (!ext) ext = ".jpg";

    const safeName = (file.originalname || "upload").replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

// 🟢 السماح بأي نوع ملف (هنفلتر بعدين)
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

// 🚀 إعدادات Multer بحد أقصى 20 ميجا
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// 🟣 ميدل وير لمعالجة الصور (ضغط + تحويل ل JPG)
const processImage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    // ✅ لو مفيش mimetype أو originalname نحط قيم افتراضية
    if (!req.file.mimetype || !req.file.originalname) {
      console.warn("⚠️ Missing mimetype/originalname — forcing .jpg");
      req.file.mimetype = "image/jpeg";
      const newPath = req.file.path + ".jpg";
      fs.renameSync(req.file.path, newPath);
      req.file.filename = path.basename(newPath);
      req.file.path = newPath;
    }

    const ext = path.extname(req.file.path).toLowerCase();
    const imageExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".tiff",
      ".heic",
      ".heif",
    ];

    // ✅ لو الملف مش صورة، نسيبه زي ما هو
    if (!imageExts.includes(ext)) {
      return next();
    }

    let outputPath = req.file.path;

    // 🔄 تحويل HEIC/HEIF إلى JPG
    if (ext === ".heic" || ext === ".heif") {
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
        req.file.mimetype = "image/jpeg";
      } catch (e) {
        console.warn("⚠️ HEIC convert failed, keeping original:", e.message);
      }
    } else {
      // 📉 ضغط باقي الصور وتحويلها دائمًا لـ JPG
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
        req.file.mimetype = "image/jpeg";
      } catch (e) {
        console.warn("⚠️ Sharp compression failed, keeping original:", e.message);
      }
    }

    next();
  } catch (err) {
    console.error("❌ Error in processImage:", err);
    // 👇 لو حصل خطأ، نعدي الملف زي ما هو
    next();
  }
};

module.exports = { upload, processImage };
