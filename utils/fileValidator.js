/**
 * File Validator for LINE Bot Upload System
 * Enhanced validation with security checks and file type detection
 */

const path = require('path');

class FileValidator {
  constructor() {
    // Maximum file size (50MB - Adjusted for Vercel Free Plan)
    this.MAX_FILE_SIZE = 50 * 1024 * 1024;

    // Minimum file size (1 byte)
    this.MIN_FILE_SIZE = 1;

    // Allowed file extensions (comprehensive list)
    this.ALLOWED_EXTENSIONS = new Set([
      // Images
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif',
      'heic', 'heif', 'avif', 'jfif',

      // Videos
      'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv', '3gp', '3g2',
      'mpg', 'mpeg', 'ogv', 'm4v', 'asf',

      // Audio
      'm4a', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'oga', 'wma', 'opus',
      'aiff', 'au', 'ra', 'mid', 'midi',

      // Documents
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf',
      'odt', 'ods', 'odp', 'pages', 'numbers', 'keynote',

      // Archives
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso',

      // Programming
      'js', 'mjs', 'ts', 'jsx', 'tsx', 'json', 'xml', 'yaml', 'yml',
      'toml', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php',
      'rb', 'go', 'rs', 'swift', 'kt', 'scala',

      // Web & Markup
      'html', 'htm', 'css', 'scss', 'sass', 'less', 'md', 'markdown',

      // Data
      'csv', 'tsv', 'sql', 'db', 'sqlite', 'sqlite3',

      // Fonts
      'ttf', 'otf', 'woff', 'woff2', 'eot',

      // Design
      'psd', 'ai', 'eps', 'indd', 'sketch', 'fig',

      // CAD & 3D
      'dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'obj',
      'fbx', 'dae', 'gltf', 'glb',

      // eBooks
      'epub', 'mobi', 'azw', 'azw3',

      // System
      'log', 'conf', 'cfg', 'ini', 'env',

      // Crypto
      'key', 'pem', 'crt', 'cer', 'p12', 'pfx'
    ]);

    // Dangerous file extensions (security risk)
    this.DANGEROUS_EXTENSIONS = new Set([
      'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jar',
      'app', 'deb', 'rpm', 'pkg', 'dmg', 'msi', 'apk', 'ipa'
    ]);

    // File type categories for better organization
    this.FILE_CATEGORIES = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif'],
      video: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv', '3gp', '3g2', 'mpg', 'mpeg', 'ogv', 'm4v'],
      audio: ['m4a', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'oga', 'wma', 'opus', 'aiff', 'au', 'ra', 'mid', 'midi'],
      document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
      code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs'],
      data: ['json', 'xml', 'csv', 'sql', 'yaml', 'yml']
    };
  }

  /**
   * Validate file with comprehensive checks
   * @param {string} fileName - Name of the file
   * @param {number} fileSize - Size of the file in bytes
   * @param {Buffer} buffer - File buffer (optional, for content validation)
   * @returns {Object} Validation result
   */
  validateFile(fileName, fileSize, buffer = null) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: fileName,
        size: fileSize,
        sizeInMB: (fileSize / (1024 * 1024)).toFixed(2),
        extension: null,
        category: null,
        mimeType: null
      }
    };

    try {
      // Basic validation
      if (!fileName || typeof fileName !== 'string') {
        result.errors.push('Invalid file name');
        result.isValid = false;
        return result;
      }

      if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
        result.errors.push('Invalid file size');
        result.isValid = false;
        return result;
      }

      // Extract file extension
      const extension = this.getFileExtension(fileName);
      result.fileInfo.extension = extension;

      // File name validation
      const nameValidation = this.validateFileName(fileName);
      if (!nameValidation.isValid) {
        result.errors.push(...nameValidation.errors);
        result.warnings.push(...nameValidation.warnings);
      }

      // File size validation
      const sizeValidation = this.validateFileSize(fileSize);
      if (!sizeValidation.isValid) {
        result.errors.push(...sizeValidation.errors);
        result.warnings.push(...sizeValidation.warnings);
      }

      // File extension validation
      const extensionValidation = this.validateFileExtension(extension);
      if (!extensionValidation.isValid) {
        result.errors.push(...extensionValidation.errors);
        result.warnings.push(...extensionValidation.warnings);
      }

      // Determine file category
      result.fileInfo.category = this.getFileCategory(extension);

      // Content validation (if buffer provided)
      if (buffer) {
        const contentValidation = this.validateFileContent(buffer, extension);
        if (!contentValidation.isValid) {
          result.errors.push(...contentValidation.errors);
          result.warnings.push(...contentValidation.warnings);
        }
      }

      // Final validation result
      result.isValid = result.errors.length === 0;

      // Log validation result
      if (result.isValid) {
        console.log(`[VALIDATOR] File validated: ${fileName} (${result.fileInfo.sizeInMB}MB, ${result.fileInfo.category})`);
      } else {
        console.warn(`[VALIDATOR] File validation failed: ${fileName} - ${result.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error('[VALIDATOR] Validation error:', error);
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate file name
   */
  validateFileName(fileName) {
    const result = { isValid: true, errors: [], warnings: [] };

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(fileName)) {
      result.errors.push('File name contains dangerous characters');
      result.isValid = false;
    }

    // Check file name length
    if (fileName.length > 255) {
      result.errors.push('File name too long (max 255 characters)');
      result.isValid = false;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(fileName)) {
      result.errors.push('File name is reserved by system');
      result.isValid = false;
    }

    // Warning for special characters
    if (/[^\w\-_. ]/.test(fileName)) {
      result.warnings.push('File name contains special characters');
    }

    return result;
  }

  /**
   * Validate file size
   */
  validateFileSize(fileSize) {
    const result = { isValid: true, errors: [], warnings: [] };

    if (fileSize < this.MIN_FILE_SIZE) {
      result.errors.push('File is empty');
      result.isValid = false;
    }

    if (fileSize > this.MAX_FILE_SIZE) {
      result.errors.push(`File too large (max ${this.MAX_FILE_SIZE / (1024 * 1024)}MB)`);
      result.isValid = false;
    }

    // Warning for large files
    const warningSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > warningSize) {
      result.warnings.push('Large file - upload may take longer');
    }

    return result;
  }

  /**
   * Validate file extension
   */
  validateFileExtension(extension) {
    const result = { isValid: true, errors: [], warnings: [] };

    if (!extension) {
      result.warnings.push('File has no extension');
      return result;
    }

    // Check for dangerous extensions
    if (this.DANGEROUS_EXTENSIONS.has(extension)) {
      result.errors.push('File type not allowed for security reasons');
      result.isValid = false;
    }

    // Check if extension is allowed
    if (!this.ALLOWED_EXTENSIONS.has(extension)) {
      result.warnings.push('Uncommon file type - may not be supported');
    }

    return result;
  }

  /**
   * Validate file content (basic checks)
   */
  validateFileContent(buffer, extension) {
    const result = { isValid: true, errors: [], warnings: [] };

    try {
      // Check for null bytes (potential security risk)
      if (buffer.includes(0x00) && !this.isBinaryFileType(extension)) {
        result.warnings.push('File contains null bytes');
      }

      // Basic file signature validation
      const signature = this.getFileSignature(buffer);
      if (signature && !this.validateFileSignature(signature, extension)) {
        result.warnings.push('File content may not match extension');
      }

    } catch (error) {
      console.error('[VALIDATOR] Content validation error:', error);
      result.warnings.push('Could not validate file content');
    }

    return result;
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(fileName) {
    return path.extname(fileName).toLowerCase().slice(1);
  }

  /**
   * Get file category based on extension
   */
  getFileCategory(extension) {
    for (const [category, extensions] of Object.entries(this.FILE_CATEGORIES)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Check if file type is binary
   */
  isBinaryFileType(extension) {
    const binaryTypes = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mp3', 'pdf', 'zip', 'exe'];
    return binaryTypes.includes(extension);
  }

  /**
   * Get file signature (magic bytes)
   */
  getFileSignature(buffer) {
    if (buffer.length < 4) return null;
    return buffer.slice(0, 4).toString('hex').toUpperCase();
  }

  /**
   * Validate file signature against extension
   */
  validateFileSignature(signature, extension) {
    const signatures = {
      'jpg': ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFDB'],
      'png': ['89504E47'],
      'gif': ['47494638'],
      'pdf': ['25504446'],
      'zip': ['504B0304', '504B0506'],
    };

    const expectedSignatures = signatures[extension];
    return !expectedSignatures || expectedSignatures.some(sig => signature.startsWith(sig));
  }
}

// Create singleton instance
const fileValidator = new FileValidator();

module.exports = fileValidator;
