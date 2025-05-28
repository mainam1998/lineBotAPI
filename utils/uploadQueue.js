// Upload Queue System for handling multiple file uploads
// Enhanced with performance monitoring and improved error handling

const performanceMonitor = require('./performanceMonitor');
const fileValidator = require('./fileValidator');
const errorHandler = require('./errorHandler');

class UploadQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.userQueues = new Map(); // Track files per user
    this.uploadSessions = new Map(); // Track individual upload sessions
  }

  // Add file to queue
  addToQueue(userId, fileData) {
    const queueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...fileData,
      status: 'pending',
      addedAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    this.queue.push(queueItem);

    // Track user's files
    if (!this.userQueues.has(userId)) {
      this.userQueues.set(userId, []);
    }
    this.userQueues.get(userId).push(queueItem.id);

    console.log(`[QUEUE] Added file to queue: ${queueItem.fileName} for user ${userId} (buffer size: ${(queueItem.buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`[QUEUE] Queue length: ${this.queue.length}`);

    // Start processing immediately if not already processing
    if (!this.processing) {
      // Use setImmediate to start processing in next tick
      setImmediate(() => {
        this.processQueue();
      });
    }

    // Send queue status update to user
    setImmediate(async () => {
      try {
        const userQueueStatus = this.getUserQueueStatus(userId);
        await this.sendQueueStatusUpdate(userId, userQueueStatus);
      } catch (error) {
        console.error('[QUEUE] Failed to send queue status update:', error);
      }
    });

    return queueItem.id;
  }

  // Get user's queue status
  getUserQueueStatus(userId) {
    const userFileIds = this.userQueues.get(userId) || [];
    const userFiles = this.queue.filter(item => userFileIds.includes(item.id));

    return {
      total: userFiles.length,
      pending: userFiles.filter(item => item.status === 'pending').length,
      processing: userFiles.filter(item => item.status === 'processing').length,
      completed: userFiles.filter(item => item.status === 'completed').length,
      failed: userFiles.filter(item => item.status === 'failed').length,
      files: userFiles.map(item => ({
        id: item.id,
        fileName: item.fileName,
        status: item.status,
        error: item.error
      }))
    };
  }

  // Process queue sequentially
  async processQueue() {
    if (this.processing) {
      console.log('[QUEUE] Already processing queue');
      return;
    }

    this.processing = true;
    console.log(`[QUEUE] Starting queue processing. Total items: ${this.queue.length}`);
    console.log(`[QUEUE] Queue items:`, this.queue.map(item => ({ id: item.id, fileName: item.fileName, status: item.status })));

    while (this.queue.length > 0) {
      const pendingItems = this.queue.filter(item => item.status === 'pending');
      console.log(`[QUEUE] Pending items: ${pendingItems.length}`);

      const item = pendingItems[0]; // Get first pending item

      if (!item) {
        console.log('[QUEUE] No pending items found, breaking loop');
        console.log(`[QUEUE] Current queue status:`, this.queue.map(item => ({ fileName: item.fileName, status: item.status })));
        break;
      }

      console.log(`[QUEUE] Processing file: ${item.fileName} (attempt ${item.attempts + 1}/${item.maxAttempts})`);

      item.status = 'processing';
      item.attempts++;

      try {
        // Start performance monitoring
        const uploadSession = performanceMonitor.recordUploadStart(
          item.fileName,
          item.buffer.length,
          'queue-upload'
        );
        this.uploadSessions.set(item.id, uploadSession);

        // Process the upload
        console.log(`[QUEUE] Starting upload for: ${item.fileName}`);
        const result = await this.uploadFile(item);

        // Record successful upload
        performanceMonitor.recordUploadComplete(uploadSession, true);
        this.uploadSessions.delete(item.id);

        item.status = 'completed';
        item.result = result;
        item.completedAt = new Date();

        // Clear buffer to free memory
        item.buffer = null;

        console.log(`[QUEUE] Successfully uploaded: ${item.fileName}`);

        // Don't notify user here - let onComplete callback handle it
        // await this.notifyUser(item.userId, 'success', item);

        // Call onComplete callback if provided
        if (item.onComplete) {
          await item.onComplete(true, result, null);
        } else {
          // Only notify if no callback provided (fallback)
          await this.notifyUser(item.userId, 'success', item);
        }

      } catch (error) {
        console.error(`[QUEUE] Failed to upload ${item.fileName}:`, error);

        // Record failed upload
        const uploadSession = this.uploadSessions.get(item.id);
        if (uploadSession) {
          performanceMonitor.recordUploadComplete(uploadSession, false, error.message);
          this.uploadSessions.delete(item.id);
        }

        // Handle error with enhanced error handler
        const errorInfo = errorHandler.getUserMessage(error, 'queue_upload', {
          fileName: item.fileName,
          fileSize: item.buffer ? item.buffer.length : 0,
          userId: item.userId,
          attempt: item.attempts
        });

        item.error = errorInfo.message;

        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
          // Clear buffer to free memory
          item.buffer = null;
          console.log(`[QUEUE] Max attempts reached for ${item.fileName}, marking as failed`);

          // Don't notify user here - let onComplete callback handle it
          // await this.notifyUser(item.userId, 'failed', item);

          // Call onComplete callback if provided
          if (item.onComplete) {
            await item.onComplete(false, null, item.error);
          } else {
            // Only notify if no callback provided (fallback)
            await this.notifyUser(item.userId, 'failed', item);
          }
        } else {
          item.status = 'pending';
          console.log(`[QUEUE] Retrying ${item.fileName} (attempt ${item.attempts}/${item.maxAttempts})`);
        }
      }

      // Add shorter delay between uploads for faster processing
      console.log('[QUEUE] Waiting 1 second before next upload...');
      await this.delay(1000);

      // Log current queue status
      console.log(`[QUEUE] Current queue status after processing ${item.fileName}:`);
      console.log(this.queue.map(item => ({ fileName: item.fileName, status: item.status, attempts: item.attempts })));
    }

    this.processing = false;
    console.log('[QUEUE] Queue processing completed');
    console.log(`[QUEUE] Final queue status:`, this.getQueueStats());

    // Clean up completed and failed items older than 1 hour (only when not processing)
    this.cleanupQueue();
  }

  // Modern upload file function with fallback support and validation
  async uploadFile(item) {
    try {
      console.log(`[QUEUE] Starting upload for ${item.fileName} (size: ${(item.buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

      // Validate file before upload
      const validation = fileValidator.validateFile(item.fileName, item.buffer.length, item.buffer);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Log validation warnings
      if (validation.warnings.length > 0) {
        console.warn(`[QUEUE] File validation warnings for ${item.fileName}: ${validation.warnings.join(', ')}`);
      }

      // Try modern upload first
      try {
        const { initGoogleDrive, modernUpload } = require('./googleDriveModern');
        const drive = initGoogleDrive();

        console.log(`[QUEUE] Attempting modern upload for ${item.fileName}`);

        // Use modern upload with automatic strategy selection and fallback
        const uploadPromise = modernUpload(
          drive,
          item.fileName,
          item.buffer,
          process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        );

        // Smart timeout based on file size (optimized for Vercel Free Plan)
        const fileSizeInMB = item.buffer.length / (1024 * 1024);
        const smartUploadTimeout = Math.max(45000, fileSizeInMB * 1000); // Min 45s, +1s per MB

        console.log(`[QUEUE] Using smart timeout: ${Math.round(smartUploadTimeout/1000)}s`);

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Upload timeout after ${Math.round(smartUploadTimeout/1000)} seconds`)), smartUploadTimeout);
        });

        const result = await Promise.race([uploadPromise, timeoutPromise]);

        console.log(`[QUEUE] Modern upload successful for ${item.fileName}:`, result);
        return result;

      } catch (modernError) {
        console.warn(`[QUEUE] Modern upload failed for ${item.fileName}, trying legacy upload:`, modernError.message);

        // Fallback to legacy upload
        const { initGoogleDrive, resumableUpload } = require('./googleDrive');
        const drive = initGoogleDrive();

        console.log(`[QUEUE] Attempting legacy upload for ${item.fileName}`);

        const legacyUploadPromise = resumableUpload(
          drive,
          item.fileName,
          item.buffer,
          process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        );

        // Longer timeout for legacy upload (adjusted for Vercel Free Plan)
        const legacyTimeout = 55000; // 55 seconds
        const legacyTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Legacy upload timeout after ${legacyTimeout/1000} seconds`)), legacyTimeout);
        });

        const result = await Promise.race([legacyUploadPromise, legacyTimeoutPromise]);

        console.log(`[QUEUE] Legacy upload successful for ${item.fileName}:`, result);
        return result;
      }

    } catch (error) {
      console.error(`[QUEUE] All upload methods failed for ${item.fileName}:`, error);
      throw error;
    }
  }

  // Notify user about upload status
  async notifyUser(userId, status, item) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
      let message;

      if (status === 'success') {
        message = `อัพโหลดสำเร็จ

ไฟล์: ${item.result.webViewLink || 'ไม่สามารถสร้างลิงก์ได้'}

เว็บไซต์: ${webAppUrl}`;
      } else if (status === 'failed') {
        message = `อัพโหลดไฟล์ล้มเหลว: ${item.fileName}
เหตุผล: ${item.error}

เว็บไซต์: ${webAppUrl}`;
      }

      if (message) {
        await lineClient.pushMessage(userId, {
          type: 'text',
          text: message,
        });
      }
    } catch (error) {
      console.error('[QUEUE] Failed to notify user:', error);
    }
  }

  // Send queue status update to user
  async sendQueueStatusUpdate(userId, userQueueStatus) {
    try {
      const { initLineClient } = require('./lineClient');
      const lineClient = initLineClient();

      const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';

      if (userQueueStatus.total > 1) {
        const message = `สถานะคิวอัพโหลด:

รวมไฟล์: ${userQueueStatus.total} ไฟล์
- รอดำเนินการ: ${userQueueStatus.pending} ไฟล์
- กำลังอัพโหลด: ${userQueueStatus.processing} ไฟล์
- สำเร็จแล้ว: ${userQueueStatus.completed} ไฟล์

เว็บไซต์: ${webAppUrl}`;

        await lineClient.pushMessage(userId, {
          type: 'text',
          text: message,
        });
      }
    } catch (error) {
      console.error('[QUEUE] Failed to send queue status update:', error);
    }
  }

  // Clean up old queue items
  cleanupQueue() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const initialLength = this.queue.length;

    console.log(`[QUEUE] Starting cleanup. Current queue length: ${initialLength}`);

    this.queue = this.queue.filter(item => {
      // Keep all pending and processing items
      if (item.status === 'pending' || item.status === 'processing') {
        return true;
      }

      // Keep completed/failed items that are less than 1 hour old
      const shouldKeep = (item.completedAt && item.completedAt > oneHourAgo) ||
                        (!item.completedAt && item.addedAt > oneHourAgo);

      if (!shouldKeep) {
        console.log(`[QUEUE] Removing old item: ${item.fileName} (status: ${item.status})`);
        // Remove from user queues
        const userFileIds = this.userQueues.get(item.userId) || [];
        const updatedUserFileIds = userFileIds.filter(id => id !== item.id);
        if (updatedUserFileIds.length === 0) {
          this.userQueues.delete(item.userId);
        } else {
          this.userQueues.set(item.userId, updatedUserFileIds);
        }
      }

      return shouldKeep;
    });

    if (this.queue.length !== initialLength) {
      console.log(`[QUEUE] Cleaned up ${initialLength - this.queue.length} old items. New length: ${this.queue.length}`);
    } else {
      console.log(`[QUEUE] No items to clean up`);
    }
  }

  // Utility function for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue statistics
  getQueueStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      processing: this.queue.filter(item => item.status === 'processing').length,
      completed: this.queue.filter(item => item.status === 'completed').length,
      failed: this.queue.filter(item => item.status === 'failed').length,
      isProcessing: this.processing
    };
  }
}

// Create singleton instance
const uploadQueue = new UploadQueue();

module.exports = uploadQueue;
