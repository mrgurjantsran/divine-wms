import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.middleware';
import * as masterDataController from '../controllers/master-data.controller';

const router: Router = express.Router();

// ✅ Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ OPTIMIZED Multer config for large files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB - Strict limit
    fieldSize: 500 * 1024 * 1024, // 500MB
    files: 1, // Only 1 file
    parts: 2 // Only 2 parts (file + form)
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    console.log(`📤 File check: ${file.originalname} - ${fileExt}`);
    
    if (allowedExts.includes(fileExt)) {
      console.log(`✅ File accepted: ${file.originalname}`);
      cb(null, true);
    } else {
      console.error(`❌ File rejected: ${fileExt} not in ${allowedExts.join(', ')}`);
      cb(new Error(`Invalid file format. Allowed: ${allowedExts.join(', ')}`));
    }
  }
});

// ✅ GET routes (auth first - no file handling)
router.get('/', authMiddleware, masterDataController.getMasterData);
router.get('/batches', authMiddleware, masterDataController.getBatches);
router.get('/progress/:jobId', authMiddleware, masterDataController.getUploadProgress);
router.get('/active', authMiddleware, masterDataController.getActiveUploads);
router.get('/export', authMiddleware, masterDataController.exportMasterData);

// ✅ POST/DELETE routes
// IMPORTANT: upload.single() BEFORE authMiddleware for large files
router.post('/upload', 
  upload.single('file'), // ✅ FIRST - parse file from request
  authMiddleware,         // ✅ THEN - verify auth
  masterDataController.uploadMasterData
);

router.delete('/:id', authMiddleware, masterDataController.deleteMasterData);
router.delete('/batch/:batchId', authMiddleware, masterDataController.deleteBatch);
router.delete('/cancel/:jobId', authMiddleware, masterDataController.cancelUpload);

export default router;
