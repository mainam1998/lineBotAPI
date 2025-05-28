/**
 * Performance Monitor for LINE Bot File Upload System
 * Tracks upload performance, errors, and system metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      uploads: {
        total: 0,
        successful: 0,
        failed: 0,
        totalSize: 0, // in bytes
        totalTime: 0, // in milliseconds
      },
      errors: new Map(), // error type -> count
      uploadMethods: new Map(), // method -> count
      fileSizes: {
        small: 0, // < 5MB
        medium: 0, // 5-50MB
        large: 0, // > 50MB
      },
      performance: {
        averageSpeed: 0, // MB/s
        averageTime: 0, // ms
        slowestUpload: { time: 0, fileName: '', size: 0 },
        fastestUpload: { time: Infinity, fileName: '', size: 0 },
      },
      systemHealth: {
        memoryUsage: [],
        cpuUsage: [],
        lastCheck: null,
      }
    };
    
    // Start system monitoring
    this.startSystemMonitoring();
  }

  /**
   * Record upload start
   */
  recordUploadStart(fileName, fileSize, method = 'unknown') {
    const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[MONITOR] Upload started: ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)}MB) using ${method}`);
    
    return {
      uploadId,
      fileName,
      fileSize,
      method,
      startTime: Date.now(),
    };
  }

  /**
   * Record upload completion
   */
  recordUploadComplete(uploadSession, success = true, error = null) {
    const endTime = Date.now();
    const uploadTime = endTime - uploadSession.startTime;
    const fileSizeInMB = uploadSession.fileSize / (1024 * 1024);
    const uploadSpeed = fileSizeInMB / (uploadTime / 1000); // MB/s

    // Update basic metrics
    this.metrics.uploads.total++;
    this.metrics.uploads.totalSize += uploadSession.fileSize;
    this.metrics.uploads.totalTime += uploadTime;

    if (success) {
      this.metrics.uploads.successful++;
      
      // Update performance metrics
      this.updatePerformanceMetrics(uploadSession.fileName, uploadSession.fileSize, uploadTime, uploadSpeed);
      
      console.log(`[MONITOR] Upload completed: ${uploadSession.fileName} in ${uploadTime}ms (${uploadSpeed.toFixed(2)}MB/s)`);
    } else {
      this.metrics.uploads.failed++;
      
      // Record error
      if (error) {
        const errorType = this.categorizeError(error);
        this.metrics.errors.set(errorType, (this.metrics.errors.get(errorType) || 0) + 1);
      }
      
      console.log(`[MONITOR] Upload failed: ${uploadSession.fileName} after ${uploadTime}ms - ${error || 'Unknown error'}`);
    }

    // Update method statistics
    this.metrics.uploadMethods.set(
      uploadSession.method, 
      (this.metrics.uploadMethods.get(uploadSession.method) || 0) + 1
    );

    // Update file size categories
    if (fileSizeInMB < 5) {
      this.metrics.fileSizes.small++;
    } else if (fileSizeInMB < 50) {
      this.metrics.fileSizes.medium++;
    } else {
      this.metrics.fileSizes.large++;
    }

    // Update averages
    this.updateAverages();
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(fileName, fileSize, uploadTime, uploadSpeed) {
    // Update fastest upload
    if (uploadTime < this.metrics.performance.fastestUpload.time) {
      this.metrics.performance.fastestUpload = {
        time: uploadTime,
        fileName,
        size: fileSize,
      };
    }

    // Update slowest upload
    if (uploadTime > this.metrics.performance.slowestUpload.time) {
      this.metrics.performance.slowestUpload = {
        time: uploadTime,
        fileName,
        size: fileSize,
      };
    }
  }

  /**
   * Update average metrics
   */
  updateAverages() {
    if (this.metrics.uploads.successful > 0) {
      const totalSizeInMB = this.metrics.uploads.totalSize / (1024 * 1024);
      const totalTimeInSeconds = this.metrics.uploads.totalTime / 1000;
      
      this.metrics.performance.averageSpeed = totalSizeInMB / totalTimeInSeconds;
      this.metrics.performance.averageTime = this.metrics.uploads.totalTime / this.metrics.uploads.successful;
    }
  }

  /**
   * Categorize error for tracking
   */
  categorizeError(error) {
    const errorMessage = error.toString().toLowerCase();
    
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('network') || errorMessage.includes('econnreset')) return 'network';
    if (errorMessage.includes('quota') || errorMessage.includes('storage')) return 'quota';
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) return 'permission';
    if (errorMessage.includes('size') || errorMessage.includes('limit')) return 'size_limit';
    if (errorMessage.includes('mime') || errorMessage.includes('type')) return 'file_type';
    
    return 'unknown';
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    // Monitor every 30 seconds
    setInterval(() => {
      this.recordSystemHealth();
    }, 30000);
  }

  /**
   * Record system health metrics
   */
  recordSystemHealth() {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageInMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        timestamp: Date.now(),
      };

      // Keep only last 20 measurements (10 minutes)
      this.metrics.systemHealth.memoryUsage.push(memoryUsageInMB);
      if (this.metrics.systemHealth.memoryUsage.length > 20) {
        this.metrics.systemHealth.memoryUsage.shift();
      }

      this.metrics.systemHealth.lastCheck = Date.now();

      // Log warning if memory usage is high
      if (memoryUsageInMB.heapUsed > 1000) { // > 1GB
        console.warn(`[MONITOR] High memory usage: ${memoryUsageInMB.heapUsed}MB heap used`);
      }

    } catch (error) {
      console.error('[MONITOR] Error recording system health:', error.message);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const successRate = this.metrics.uploads.total > 0 
      ? (this.metrics.uploads.successful / this.metrics.uploads.total * 100).toFixed(1)
      : 0;

    const totalSizeInMB = (this.metrics.uploads.totalSize / (1024 * 1024)).toFixed(2);

    return {
      summary: {
        totalUploads: this.metrics.uploads.total,
        successfulUploads: this.metrics.uploads.successful,
        failedUploads: this.metrics.uploads.failed,
        successRate: `${successRate}%`,
        totalDataTransferred: `${totalSizeInMB}MB`,
        averageSpeed: `${this.metrics.performance.averageSpeed.toFixed(2)}MB/s`,
        averageTime: `${(this.metrics.performance.averageTime / 1000).toFixed(1)}s`,
      },
      fileSizes: this.metrics.fileSizes,
      uploadMethods: Object.fromEntries(this.metrics.uploadMethods),
      errors: Object.fromEntries(this.metrics.errors),
      performance: {
        fastest: {
          time: `${(this.metrics.performance.fastestUpload.time / 1000).toFixed(1)}s`,
          file: this.metrics.performance.fastestUpload.fileName,
          size: `${(this.metrics.performance.fastestUpload.size / (1024 * 1024)).toFixed(2)}MB`,
        },
        slowest: {
          time: `${(this.metrics.performance.slowestUpload.time / 1000).toFixed(1)}s`,
          file: this.metrics.performance.slowestUpload.fileName,
          size: `${(this.metrics.performance.slowestUpload.size / (1024 * 1024)).toFixed(2)}MB`,
        },
      },
      systemHealth: {
        currentMemory: this.metrics.systemHealth.memoryUsage[this.metrics.systemHealth.memoryUsage.length - 1],
        lastCheck: new Date(this.metrics.systemHealth.lastCheck).toISOString(),
      }
    };
  }

  /**
   * Get detailed metrics for debugging
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Reset metrics (for testing or periodic cleanup)
   */
  resetMetrics() {
    this.metrics = {
      uploads: { total: 0, successful: 0, failed: 0, totalSize: 0, totalTime: 0 },
      errors: new Map(),
      uploadMethods: new Map(),
      fileSizes: { small: 0, medium: 0, large: 0 },
      performance: {
        averageSpeed: 0,
        averageTime: 0,
        slowestUpload: { time: 0, fileName: '', size: 0 },
        fastestUpload: { time: Infinity, fileName: '', size: 0 },
      },
      systemHealth: {
        memoryUsage: [],
        cpuUsage: [],
        lastCheck: null,
      }
    };
    
    console.log('[MONITOR] Metrics reset');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
