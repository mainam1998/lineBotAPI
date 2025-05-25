// Upload Queue System for handling multiple file uploads
class UploadQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.userQueues = new Map(); // Track files per user
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

    console.log(`[QUEUE] Added file to queue: ${queueItem.fileName} for user ${userId}`);
    console.log(`[QUEUE] Queue length: ${this.queue.length}`);

    // Start processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }

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
    console.log('[QUEUE] Starting queue processing');

    while (this.queue.length > 0) {
      const item = this.queue.find(item => item.status === 'pending');
      
      if (!item) {
        console.log('[QUEUE] No pending items found');
        break;
      }

      console.log(`[QUEUE] Processing file: ${item.fileName} (attempt ${item.attempts + 1}/${item.maxAttempts})`);
      
      item.status = 'processing';
      item.attempts++;

      try {
        // Process the upload
        const result = await this.uploadFile(item);
        
        item.status = 'completed';
        item.result = result;
        item.completedAt = new Date();
        
        console.log(`[QUEUE] Successfully uploaded: ${item.fileName}`);
        
        // Notify user of success
        await this.notifyUser(item.userId, 'success', item);
        
      } catch (error) {
        console.error(`[QUEUE] Failed to upload ${item.fileName}:`, error);
        
        item.error = error.message;
        
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
          console.log(`[QUEUE] Max attempts reached for ${item.fileName}, marking as failed`);
          
          // Notify user of failure
          await this.notifyUser(item.userId, 'failed', item);
        } else {
          item.status = 'pending';
          console.log(`[QUEUE] Retrying ${item.fileName} (attempt ${item.attempts}/${item.maxAttempts})`);
        }
      }

      // Add delay between uploads to avoid rate limiting
      await this.delay(1000);
    }

    // Clean up completed and failed items older than 1 hour
    this.cleanupQueue();
    
    this.processing = false;
    console.log('[QUEUE] Queue processing completed');
  }

  // Upload file function
  async uploadFile(item) {
    const { initGoogleDrive, resumableUpload } = require('./googleDrive');
    
    console.log(`[QUEUE] Uploading ${item.fileName} to Google Drive`);
    
    const drive = initGoogleDrive();
    const result = await resumableUpload(
      drive,
      item.fileName,
      item.buffer,
      process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
    );
    
    return result;
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

  // Clean up old queue items
  cleanupQueue() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const initialLength = this.queue.length;
    
    this.queue = this.queue.filter(item => {
      const shouldKeep = item.status === 'pending' || item.status === 'processing' || 
                        (item.completedAt && item.completedAt > oneHourAgo) ||
                        (!item.completedAt && item.addedAt > oneHourAgo);
      
      if (!shouldKeep) {
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
      console.log(`[QUEUE] Cleaned up ${initialLength - this.queue.length} old items`);
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
