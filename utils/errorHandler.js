/**
 * Enhanced Error Handler for LINE Bot Upload System
 * Provides comprehensive error handling, logging, and user-friendly messages
 */

class ErrorHandler {
  constructor() {
    this.errorCounts = new Map(); // Track error frequency
    this.lastErrors = []; // Keep track of recent errors
    this.maxRecentErrors = 50; // Maximum number of recent errors to keep
  }

  /**
   * Handle and categorize errors
   * @param {Error} error - The error object
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Processed error information
   */
  handleError(error, context = 'unknown', metadata = {}) {
    const errorInfo = this.categorizeError(error, context, metadata);
    
    // Log error
    this.logError(errorInfo);
    
    // Track error frequency
    this.trackError(errorInfo);
    
    // Store recent error
    this.storeRecentError(errorInfo);
    
    return errorInfo;
  }

  /**
   * Categorize error and provide user-friendly messages
   */
  categorizeError(error, context, metadata) {
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';
    
    let category = 'unknown';
    let severity = 'medium';
    let userMessage = 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง';
    let technicalMessage = errorMessage;
    let retryable = true;
    let suggestedAction = 'ลองใหม่อีกครั้ง';

    // Network errors
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('ENOTFOUND') || 
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('network')) {
      category = 'network';
      severity = 'medium';
      userMessage = 'เกิดปัญหาการเชื่อมต่อเครือข่าย กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่';
      suggestedAction = 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
      retryable = true;
    }
    
    // Timeout errors
    else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      category = 'timeout';
      severity = 'medium';
      userMessage = 'หมดเวลาในการอัพโหลด ไฟล์อาจมีขนาดใหญ่เกินไป หรือเครือข่ายช้า';
      suggestedAction = 'ลองอัพโหลดไฟล์ที่มีขนาดเล็กกว่า หรือตรวจสอบความเร็วเครือข่าย';
      retryable = true;
    }
    
    // File size errors
    else if (errorMessage.includes('size') || 
             errorMessage.includes('limit') || 
             errorMessage.includes('too large')) {
      category = 'file_size';
      severity = 'low';
      userMessage = 'ไฟล์มีขนาดใหญ่เกินกำหนด (สูงสุด 300MB)';
      suggestedAction = 'ลดขนาดไฟล์หรือแบ่งไฟล์ออกเป็นส่วนเล็กๆ';
      retryable = false;
    }
    
    // Google Drive quota errors
    else if (errorMessage.includes('quota') || 
             errorMessage.includes('storage') || 
             errorMessage.includes('insufficient')) {
      category = 'quota';
      severity = 'high';
      userMessage = 'พื้นที่เก็บข้อมูล Google Drive เต็ม กรุณาลบไฟล์เก่าหรือเพิ่มพื้นที่';
      suggestedAction = 'ติดต่อผู้ดูแลระบบเพื่อเพิ่มพื้นที่เก็บข้อมูล';
      retryable = false;
    }
    
    // Permission errors
    else if (errorMessage.includes('permission') || 
             errorMessage.includes('unauthorized') || 
             errorMessage.includes('forbidden')) {
      category = 'permission';
      severity = 'high';
      userMessage = 'ไม่มีสิทธิ์เข้าถึง Google Drive กรุณาติดต่อผู้ดูแลระบบ';
      suggestedAction = 'ติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์การเข้าถึง';
      retryable = false;
    }
    
    // File validation errors
    else if (errorMessage.includes('validation') || 
             errorMessage.includes('invalid file') || 
             errorMessage.includes('file type')) {
      category = 'validation';
      severity = 'low';
      userMessage = 'ไฟล์ไม่ถูกต้องหรือประเภทไฟล์ไม่รองรับ';
      suggestedAction = 'ตรวจสอบประเภทไฟล์และขนาดไฟล์';
      retryable = false;
    }
    
    // LINE API errors
    else if (errorMessage.includes('LINE') || 
             errorMessage.includes('messaging') || 
             context.includes('line')) {
      category = 'line_api';
      severity = 'medium';
      userMessage = 'เกิดปัญหากับ LINE API กรุณาลองใหม่อีกครั้ง';
      suggestedAction = 'รอสักครู่แล้วลองใหม่';
      retryable = true;
    }
    
    // Module/Import errors
    else if (errorMessage.includes('Module') || 
             errorMessage.includes('import') || 
             errorMessage.includes('require')) {
      category = 'module';
      severity = 'high';
      userMessage = 'เกิดปัญหาระบบภายใน กรุณาติดต่อผู้ดูแลระบบ';
      suggestedAction = 'ติดต่อผู้ดูแลระบบ';
      retryable = false;
    }
    
    // Memory errors
    else if (errorMessage.includes('memory') || 
             errorMessage.includes('heap') || 
             errorMessage.includes('out of memory')) {
      category = 'memory';
      severity = 'high';
      userMessage = 'ระบบมีการใช้หน่วยความจำสูง กรุณารอสักครู่แล้วลองใหม่';
      suggestedAction = 'รอสักครู่แล้วลองอัพโหลดไฟล์ที่มีขนาดเล็กกว่า';
      retryable = true;
    }

    return {
      timestamp: new Date().toISOString(),
      context,
      category,
      severity,
      userMessage,
      technicalMessage,
      originalError: errorMessage,
      stack: errorStack,
      retryable,
      suggestedAction,
      metadata
    };
  }

  /**
   * Log error with appropriate level
   */
  logError(errorInfo) {
    const logMessage = `[ERROR] ${errorInfo.context} - ${errorInfo.category} - ${errorInfo.technicalMessage}`;
    
    switch (errorInfo.severity) {
      case 'high':
        console.error(logMessage, {
          category: errorInfo.category,
          context: errorInfo.context,
          metadata: errorInfo.metadata,
          stack: errorInfo.stack
        });
        break;
      case 'medium':
        console.warn(logMessage, {
          category: errorInfo.category,
          context: errorInfo.context,
          metadata: errorInfo.metadata
        });
        break;
      case 'low':
        console.log(logMessage, {
          category: errorInfo.category,
          context: errorInfo.context
        });
        break;
      default:
        console.error(logMessage);
    }
  }

  /**
   * Track error frequency
   */
  trackError(errorInfo) {
    const key = `${errorInfo.category}_${errorInfo.context}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Log if error is frequent
    if (count > 5) {
      console.warn(`[ERROR_TRACKER] Frequent error detected: ${key} (${count + 1} times)`);
    }
  }

  /**
   * Store recent error for analysis
   */
  storeRecentError(errorInfo) {
    this.lastErrors.unshift(errorInfo);
    
    // Keep only recent errors
    if (this.lastErrors.length > this.maxRecentErrors) {
      this.lastErrors = this.lastErrors.slice(0, this.maxRecentErrors);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const totalErrors = this.lastErrors.length;
    const errorsByCategory = {};
    const errorsBySeverity = {};
    const recentErrors = this.lastErrors.slice(0, 10);

    // Count by category and severity
    this.lastErrors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: recentErrors.map(error => ({
        timestamp: error.timestamp,
        category: error.category,
        context: error.context,
        userMessage: error.userMessage
      })),
      frequentErrors: Array.from(this.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => ({ error: key, count }))
    };
  }

  /**
   * Clear error statistics
   */
  clearStats() {
    this.errorCounts.clear();
    this.lastErrors = [];
    console.log('[ERROR_HANDLER] Error statistics cleared');
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error, context = 'unknown', metadata = {}) {
    const errorInfo = this.handleError(error, context, metadata);
    return {
      message: errorInfo.userMessage,
      retryable: errorInfo.retryable,
      suggestedAction: errorInfo.suggestedAction,
      category: errorInfo.category
    };
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

module.exports = errorHandler;
