/**
 * Batch File Processor
 * รอรับไฟล์หลายไฟล์แล้วประมวลผลทีละไฟล์จนครบ
 */

class BatchProcessor {
  constructor() {
    this.batches = new Map(); // userId -> batch data
    this.timers = new Map(); // userId -> timer
    this.BATCH_TIMEOUT = 30000; // 30 seconds
  }

  /**
   * เพิ่มไฟล์เข้า batch
   */
  addFileToBatch(userId, fileData) {
    console.log(`[BATCH] Adding file to batch for user ${userId}: ${fileData.fileName}`);

    // สร้าง batch ใหม่หากยังไม่มี
    if (!this.batches.has(userId)) {
      this.batches.set(userId, {
        files: [],
        startTime: new Date(),
        status: 'collecting', // collecting, processing, completed
        totalFiles: 0,
        processedFiles: 0
      });
    }

    const batch = this.batches.get(userId);

    // เพิ่มไฟล์เข้า batch
    batch.files.push({
      ...fileData,
      addedAt: new Date(),
      status: 'pending' // pending, downloading, uploading, completed, failed
    });

    batch.totalFiles = batch.files.length;

    console.log(`[BATCH] Batch for user ${userId} now has ${batch.totalFiles} files`);

    // รีเซ็ต timer
    this.resetBatchTimer(userId);

    return batch.totalFiles;
  }

  /**
   * รีเซ็ต timer สำหรับ batch
   */
  resetBatchTimer(userId) {
    // ยกเลิก timer เก่า
    if (this.timers.has(userId)) {
      clearTimeout(this.timers.get(userId));
    }

    // สร้าง timer ใหม่
    const timer = setTimeout(() => {
      console.log(`[BATCH] Batch timeout for user ${userId}, starting processing`);
      this.processBatch(userId);
    }, this.BATCH_TIMEOUT);

    this.timers.set(userId, timer);
    console.log(`[BATCH] Timer reset for user ${userId}, will process in ${this.BATCH_TIMEOUT/1000} seconds`);
  }

  /**
   * เริ่มประมวลผล batch
   */
  async processBatch(userId) {
    const batch = this.batches.get(userId);
    if (!batch || batch.status !== 'collecting') {
      console.log(`[BATCH] No batch to process for user ${userId} or already processing`);
      return;
    }

    console.log(`[BATCH] Starting batch processing for user ${userId} with ${batch.totalFiles} files`);

    batch.status = 'processing';
    batch.processedFiles = 0;

    // ส่งข้อความแจ้งเริ่มประมวลผล
    await this.notifyBatchStart(userId, batch);

    // ประมวลผลไฟล์ทีละไฟล์
    for (let i = 0; i < batch.files.length; i++) {
      const file = batch.files[i];
      console.log(`[BATCH] Processing file ${i + 1}/${batch.totalFiles}: ${file.fileName}`);

      try {
        // อัพเดทสถานะไฟล์
        file.status = 'downloading';

        // แจ้งความคืบหน้า
        await this.notifyProgress(userId, batch, i + 1);

        // ดาวน์โหลดไฟล์จาก LINE
        const stream = await this.downloadFromLine(file.messageId);

        // แปลง stream เป็น buffer
        file.status = 'uploading';
        const buffer = await this.streamToBuffer(stream);

        // อัพโหลดไป Google Drive
        const result = await this.uploadToGoogleDrive(file.fileName, buffer);

        // อัพเดทสถานะ
        file.status = 'completed';
        file.result = result;
        batch.processedFiles++;

        // แจ้งผลสำเร็จ
        await this.notifyFileSuccess(userId, file, i + 1, batch.totalFiles);

        console.log(`[BATCH] File ${i + 1}/${batch.totalFiles} completed: ${file.fileName}`);

      } catch (error) {
        console.error(`[BATCH] File ${i + 1}/${batch.totalFiles} failed: ${file.fileName}`, error);

        file.status = 'failed';
        file.error = error.message;
        batch.processedFiles++;

        // แจ้งผลล้มเหลว
        await this.notifyFileError(userId, file, i + 1, batch.totalFiles, error.message);
      }

      // หน่วงเวลาระหว่างไฟล์
      if (i < batch.files.length - 1) {
        await this.delay(2000); // 2 seconds
      }
    }

    // เสร็จสิ้นการประมวลผล
    batch.status = 'completed';
    batch.completedAt = new Date();

    // ส่งสรุปผลลัพธ์
    await this.notifyBatchComplete(userId, batch);

    // ทำความสะอาด
    this.cleanupBatch(userId);

    console.log(`[BATCH] Batch processing completed for user ${userId}`);
  }

  /**
   * ดาวน์โหลดไฟล์จาก LINE with enhanced error handling
   */
  async downloadFromLine(messageId) {
    let retryCount = 0;
    const maxRetries = 3; // Increased retries

    while (retryCount < maxRetries) {
      try {
        console.log(`[BATCH] Downloading from LINE (attempt ${retryCount + 1}/${maxRetries})`);

        // Create fresh LINE client for each attempt
        const { initLineClient } = require('./lineClient');
        const lineClient = initLineClient();

        // Progressive timeout (longer for each retry)
        const timeout = 30000 + (retryCount * 15000); // 30s, 45s, 60s

        const downloadPromise = lineClient.getMessageContent(messageId);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Download timeout after ${timeout/1000} seconds`)), timeout);
        });

        const stream = await Promise.race([downloadPromise, timeoutPromise]);

        if (!stream) {
          throw new Error('Received empty stream from LINE');
        }

        console.log(`[BATCH] Download successful on attempt ${retryCount + 1}`);
        return stream;

      } catch (error) {
        retryCount++;
        console.error(`[BATCH] Download attempt ${retryCount} failed:`, error.message);

        if (retryCount < maxRetries) {
          // Progressive backoff with jitter
          const baseDelay = retryCount * 5000; // 5s, 10s, 15s
          const jitter = Math.random() * 2000; // 0-2s random
          const delay = baseDelay + jitter;

          console.log(`[BATCH] Retrying download in ${Math.round(delay)}ms...`);
          await this.delay(delay);
        } else {
          // Classify error type for better user message
          let errorType = 'ไม่ทราบสาเหตุ';
          if (error.message.includes('TLS') || error.message.includes('socket')) {
            errorType = 'ปัญหาการเชื่อมต่อเครือข่าย (TLS/Socket)';
          } else if (error.message.includes('timeout')) {
            errorType = 'หมดเวลาในการดาวน์โหลด';
          } else if (error.message.includes('ECONNRESET')) {
            errorType = 'การเชื่อมต่อถูกรีเซ็ต';
          } else if (error.message.includes('ENOTFOUND')) {
            errorType = 'ไม่พบเซิร์ฟเวอร์';
          }

          throw new Error(`${errorType}: ${error.message}`);
        }
      }
    }
  }

  /**
   * แปลง stream เป็น buffer
   */
  async streamToBuffer(stream) {
    const { streamToBuffer } = require('./googleDriveModern');
    return await streamToBuffer(stream, 60000);
  }

  /**
   * อัพโหลดไป Google Drive with fallback
   */
  async uploadToGoogleDrive(fileName, buffer) {
    // Try direct upload first (faster)
    try {
      console.log(`[BATCH] Attempting direct upload for: ${fileName}`);
      return await this.directUploadToGoogleDrive(fileName, buffer);
    } catch (directError) {
      console.warn(`[BATCH] Direct upload failed for ${fileName}, using queue: ${directError.message}`);

      // Fallback to upload queue
      return await this.queueUploadToGoogleDrive(fileName, buffer);
    }
  }

  /**
   * Direct upload to Google Drive
   */
  async directUploadToGoogleDrive(fileName, buffer) {
    const { initGoogleDrive, modernUpload } = require('./googleDriveModern');

    const drive = initGoogleDrive();
    const result = await modernUpload(
      drive,
      fileName,
      buffer,
      process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
    );

    console.log(`[BATCH] Direct upload successful for: ${fileName}`);
    return result;
  }

  /**
   * Queue upload to Google Drive
   */
  async queueUploadToGoogleDrive(fileName, buffer) {
    const uploadQueue = require('./uploadQueue');

    return new Promise((resolve, reject) => {
      const queueId = uploadQueue.addToQueue('batch_user', {
        fileName: fileName,
        buffer: buffer,
        messageId: 'batch_' + Date.now(),
        messageType: 'file',
        onComplete: async (success, result, error) => {
          if (success) {
            console.log(`[BATCH] Queue upload successful for: ${fileName}`);
            resolve(result);
          } else {
            console.error(`[BATCH] Queue upload failed for: ${fileName}`);
            reject(new Error(error));
          }
        }
      });

      console.log(`[BATCH] Added ${fileName} to upload queue with ID: ${queueId}`);
    });
  }

  /**
   * แจ้งเริ่มประมวลผล batch
   */
  async notifyBatchStart(userId, batch) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const fileList = batch.files.map((file, index) =>
        `${index + 1}. ${file.fileName}`
      ).join('\n');

      const message = `🚀 เริ่มประมวลผลไฟล์ ${batch.totalFiles} ไฟล์

📋 รายการไฟล์:
${fileList}

⏳ ระบบจะอัพโหลดทีละไฟล์จนครบทุกไฟล์
📊 ความคืบหน้าจะแจ้งให้ทราบ

🌐 เว็บไซต์: https://line-bot-rho-ashy.vercel.app/`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      console.error('[BATCH] Failed to notify batch start:', error);
    }
  }

  /**
   * แจ้งความคืบหน้า
   */
  async notifyProgress(userId, batch, currentFile) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const file = batch.files[currentFile - 1];
      const message = `🔄 กำลังประมวลผลไฟล์ ${currentFile}/${batch.totalFiles}

📁 ไฟล์: ${file.fileName}
📊 สถานะ: กำลังดาวน์โหลด...

⏳ กรุณารอสักครู่`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      console.error('[BATCH] Failed to notify progress:', error);
    }
  }

  /**
   * แจ้งผลสำเร็จของไฟล์
   */
  async notifyFileSuccess(userId, file, currentFile, totalFiles) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const message = `✅ อัพโหลดสำเร็จ ${currentFile}/${totalFiles}

📁 ไฟล์: ${file.fileName}
🔗 ลิงก์: ${file.result.webViewLink || 'ไม่สามารถสร้างลิงก์ได้'}

${currentFile < totalFiles ? '⏭️ ดำเนินการไฟล์ถัดไป...' : '🎉 เสร็จสิ้นทุกไฟล์แล้ว!'}`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      console.error('[BATCH] Failed to notify file success:', error);
    }
  }

  /**
   * แจ้งผลล้มเหลวของไฟล์
   */
  async notifyFileError(userId, file, currentFile, totalFiles, errorMessage) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const message = `❌ อัพโหลดล้มเหลว ${currentFile}/${totalFiles}

📁 ไฟล์: ${file.fileName}
🔍 สาเหตุ: ${errorMessage}

${currentFile < totalFiles ? '⏭️ ดำเนินการไฟล์ถัดไป...' : '📊 ดูสรุปผลลัพธ์ด้านล่าง'}`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      console.error('[BATCH] Failed to notify file error:', error);
    }
  }

  /**
   * แจ้งสรุปผลลัพธ์
   */
  async notifyBatchComplete(userId, batch) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const successCount = batch.files.filter(f => f.status === 'completed').length;
      const failedCount = batch.files.filter(f => f.status === 'failed').length;

      const message = `🎯 สรุปผลการประมวลผล

📊 สถิติ:
• ไฟล์ทั้งหมด: ${batch.totalFiles} ไฟล์
• สำเร็จ: ${successCount} ไฟล์
• ล้มเหลว: ${failedCount} ไฟล์

⏱️ เวลาที่ใช้: ${Math.round((batch.completedAt - batch.startTime) / 1000)} วินาที

🌐 เว็บไซต์: https://line-bot-rho-ashy.vercel.app/`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      console.error('[BATCH] Failed to notify batch complete:', error);
    }
  }

  /**
   * ทำความสะอาด batch
   */
  cleanupBatch(userId) {
    // ยกเลิก timer
    if (this.timers.has(userId)) {
      clearTimeout(this.timers.get(userId));
      this.timers.delete(userId);
    }

    // ลบ batch data (เก็บไว้ 1 ชั่วโมง)
    setTimeout(() => {
      this.batches.delete(userId);
      console.log(`[BATCH] Cleaned up batch data for user ${userId}`);
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * ดูสถานะ batch
   */
  getBatchStatus(userId) {
    const batch = this.batches.get(userId);
    if (!batch) {
      return null;
    }

    return {
      status: batch.status,
      totalFiles: batch.totalFiles,
      processedFiles: batch.processedFiles,
      files: batch.files.map(f => ({
        fileName: f.fileName,
        status: f.status
      }))
    };
  }

  /**
   * หน่วงเวลา
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// สร้าง singleton instance
const batchProcessor = new BatchProcessor();

module.exports = batchProcessor;
