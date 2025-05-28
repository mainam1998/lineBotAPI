import { google } from 'googleapis';
import { Readable } from 'stream';
import axios from 'axios';

/**
 * Modern Google Drive API client with 2024 best practices
 * Based on Google Drive API v3 documentation
 */

/**
 * Initialize Google Drive API client with Service Account
 * @returns {import('googleapis').drive_v3.Drive} Google Drive API client
 */
export const initGoogleDrive = () => {
  try {
    console.log('[DRIVE] Initializing Google Drive...');

    // Check if credentials are available
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    if (!serviceAccountEmail) {
      throw new Error('Google Drive service account email is not set (GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_CLIENT_EMAIL)');
    }

    // Handle private key - support both direct and base64 encoded
    let privateKey;
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
      // Decode from base64 (recommended for Vercel)
      console.log('[DRIVE] Using base64 encoded private key');
      try {
        privateKey = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
      } catch (decodeError) {
        throw new Error('Failed to decode GOOGLE_PRIVATE_KEY_BASE64: ' + decodeError.message);
      }
    } else if (process.env.GOOGLE_PRIVATE_KEY) {
      // Use direct private key
      console.log('[DRIVE] Using direct private key');
      privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else {
      throw new Error('Google Drive private key is not set (neither GOOGLE_PRIVATE_KEY nor GOOGLE_PRIVATE_KEY_BASE64)');
    }

    // Validate private key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format - must include BEGIN and END markers');
    }

    console.log('[DRIVE] Service Account Email:', serviceAccountEmail);
    console.log('[DRIVE] Private Key Length:', privateKey.length);

    const auth = new google.auth.JWT(
      serviceAccountEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive.file']
    );

    return google.drive({ version: 'v3', auth });

  } catch (error) {
    console.error('[DRIVE] Failed to initialize Google Drive:', error.message);
    throw error;
  }
};

/**
 * Convert stream to buffer with enhanced timeout and error handling
 * Memory-efficient version with chunked processing for large files
 * @param {import('stream').Readable} stream - Readable stream
 * @param {number} timeoutMs - Timeout in milliseconds (default: 60 seconds)
 * @param {number} maxSize - Maximum file size in bytes (default: 300MB)
 * @returns {Promise<Buffer>} Buffer containing stream data
 */
export const streamToBuffer = async (stream, timeoutMs = 50000, maxSize = 50 * 1024 * 1024) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let isResolved = false;
    let bytesReceived = 0;

    console.log(`[STREAM] Starting stream to buffer conversion with ${timeoutMs}ms timeout, max size: ${(maxSize / (1024 * 1024)).toFixed(0)}MB`);

    // Set timeout with progress tracking
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.error(`[STREAM] Timeout after ${timeoutMs}ms, received ${bytesReceived} bytes`);
        try {
          stream.destroy();
        } catch (destroyError) {
          console.error(`[STREAM] Error destroying stream:`, destroyError.message);
        }
        reject(new Error(`Stream to buffer conversion timeout after ${timeoutMs}ms (received ${bytesReceived} bytes)`));
      }
    }, timeoutMs);

    // Track progress with adaptive intervals
    let lastProgressTime = Date.now();
    let progressLogInterval = 5000; // Start with 5 seconds
    const progressInterval = setInterval(() => {
      if (!isResolved) {
        const now = Date.now();
        const elapsed = now - lastProgressTime;
        const mbReceived = (bytesReceived / (1024 * 1024)).toFixed(1);
        console.log(`[STREAM] Progress: ${mbReceived}MB received, ${elapsed}ms since last update`);

        // Adaptive progress logging - slower for larger files
        if (bytesReceived > 50 * 1024 * 1024) { // > 50MB
          progressLogInterval = 10000; // 10 seconds
        }

        // If no progress for 20 seconds, consider it stalled
        if (elapsed > 20000) {
          console.warn(`[STREAM] Stream appears stalled, no progress for ${elapsed}ms`);
        }
      }
    }, progressLogInterval);

    stream.on('data', (chunk) => {
      if (!isResolved) {
        // Check size limit before adding chunk
        if (bytesReceived + chunk.length > maxSize) {
          isResolved = true;
          clearTimeout(timeout);
          clearInterval(progressInterval);
          try {
            stream.destroy();
          } catch (destroyError) {
            console.error(`[STREAM] Error destroying stream:`, destroyError.message);
          }
          reject(new Error(`File size exceeds maximum limit of ${(maxSize / (1024 * 1024)).toFixed(0)}MB`));
          return;
        }

        chunks.push(chunk);
        bytesReceived += chunk.length;
        lastProgressTime = Date.now();

        // Log progress for large files with reduced frequency
        const mbReceived = bytesReceived / (1024 * 1024);
        if (mbReceived >= 1 && bytesReceived % (5 * 1024 * 1024) === 0) { // Every 5MB after 1MB
          console.log(`[STREAM] Received ${mbReceived.toFixed(1)}MB`);

          // Force garbage collection for large files if available
          if (global.gc && mbReceived > 50) {
            try {
              global.gc();
              console.log(`[STREAM] Forced garbage collection at ${mbReceived.toFixed(1)}MB`);
            } catch (gcError) {
              // Ignore GC errors
            }
          }
        }
      }
    });

    stream.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        clearInterval(progressInterval);
        console.error(`[STREAM] Stream error after receiving ${bytesReceived} bytes:`, error.message);
        reject(error);
      }
    });

    stream.on('end', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        clearInterval(progressInterval);
        const mbReceived = (bytesReceived / (1024 * 1024)).toFixed(2);
        console.log(`[STREAM] Stream ended successfully, total: ${mbReceived}MB`);

        // Concatenate chunks efficiently
        try {
          const buffer = Buffer.concat(chunks);
          // Clear chunks array to free memory
          chunks.length = 0;
          resolve(buffer);
        } catch (concatError) {
          console.error(`[STREAM] Error concatenating chunks:`, concatError.message);
          reject(new Error(`Failed to concatenate stream chunks: ${concatError.message}`));
        }
      }
    });

    stream.on('close', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        clearInterval(progressInterval);
        const mbReceived = (bytesReceived / (1024 * 1024)).toFixed(2);
        console.log(`[STREAM] Stream closed, total: ${mbReceived}MB`);

        try {
          const buffer = Buffer.concat(chunks);
          chunks.length = 0;
          resolve(buffer);
        } catch (concatError) {
          console.error(`[STREAM] Error concatenating chunks on close:`, concatError.message);
          reject(new Error(`Failed to concatenate stream chunks: ${concatError.message}`));
        }
      }
    });

    // Handle stream abort
    stream.on('aborted', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        clearInterval(progressInterval);
        console.error(`[STREAM] Stream aborted after receiving ${bytesReceived} bytes`);
        reject(new Error(`Stream aborted after receiving ${bytesReceived} bytes`));
      }
    });
  });
};

/**
 * Get MIME type from file extension with comprehensive 2024 support
 * @param {string} fileName - File name with extension
 * @returns {string} MIME type
 */
export const getMimeType = (fileName) => {
  if (!fileName || typeof fileName !== 'string') {
    return 'application/octet-stream';
  }

  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  if (!fileExtension) {
    return 'application/octet-stream';
  }

  const mimeTypes = {
    // Images - Enhanced support
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'avif': 'image/avif',
    'jfif': 'image/jpeg',

    // Videos - Enhanced support
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'mpg': 'video/mpeg',
    'mpeg': 'video/mpeg',
    'ogv': 'video/ogg',
    'm4v': 'video/x-m4v',
    'asf': 'video/x-ms-asf',

    // Audio - Enhanced support
    'm4a': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'wma': 'audio/x-ms-wma',
    'opus': 'audio/opus',
    'aiff': 'audio/aiff',
    'au': 'audio/basic',
    'ra': 'audio/x-realaudio',
    'mid': 'audio/midi',
    'midi': 'audio/midi',

    // Documents - Enhanced support
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'pages': 'application/vnd.apple.pages',
    'numbers': 'application/vnd.apple.numbers',
    'keynote': 'application/vnd.apple.keynote',

    // Archives - Enhanced support
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'bz2': 'application/x-bzip2',
    'xz': 'application/x-xz',
    'dmg': 'application/x-apple-diskimage',
    'iso': 'application/x-iso9660-image',

    // Programming & Development
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'ts': 'application/typescript',
    'jsx': 'text/jsx',
    'tsx': 'text/tsx',
    'json': 'application/json',
    'xml': 'application/xml',
    'yaml': 'application/x-yaml',
    'yml': 'application/x-yaml',
    'toml': 'application/toml',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'c': 'text/x-c',
    'cpp': 'text/x-c++',
    'h': 'text/x-c',
    'hpp': 'text/x-c++',
    'cs': 'text/x-csharp',
    'php': 'application/x-httpd-php',
    'rb': 'text/x-ruby',
    'go': 'text/x-go',
    'rs': 'text/x-rust',
    'swift': 'text/x-swift',
    'kt': 'text/x-kotlin',
    'scala': 'text/x-scala',

    // Web & Markup
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'scss': 'text/x-scss',
    'sass': 'text/x-sass',
    'less': 'text/x-less',
    'md': 'text/markdown',
    'markdown': 'text/markdown',

    // Data formats
    'csv': 'text/csv',
    'tsv': 'text/tab-separated-values',
    'sql': 'application/sql',
    'db': 'application/x-sqlite3',
    'sqlite': 'application/x-sqlite3',
    'sqlite3': 'application/x-sqlite3',

    // Fonts
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'eot': 'application/vnd.ms-fontobject',

    // Adobe & Design
    'psd': 'image/vnd.adobe.photoshop',
    'ai': 'application/postscript',
    'eps': 'application/postscript',
    'indd': 'application/x-indesign',
    'sketch': 'application/x-sketch',
    'fig': 'application/x-figma',

    // CAD & 3D
    'dwg': 'image/vnd.dwg',
    'dxf': 'image/vnd.dxf',
    'step': 'application/step',
    'stp': 'application/step',
    'iges': 'application/iges',
    'igs': 'application/iges',
    'stl': 'model/stl',
    'obj': 'model/obj',
    'fbx': 'model/fbx',
    'dae': 'model/vnd.collada+xml',
    'gltf': 'model/gltf+json',
    'glb': 'model/gltf-binary',

    // eBooks
    'epub': 'application/epub+zip',
    'mobi': 'application/x-mobipocket-ebook',
    'azw': 'application/vnd.amazon.ebook',
    'azw3': 'application/vnd.amazon.ebook',

    // Virtual Machine & Containers
    'ova': 'application/x-virtualbox-ova',
    'ovf': 'application/x-virtualbox-ovf',
    'vmdk': 'application/x-virtualbox-vmdk',
    'vdi': 'application/x-virtualbox-vdi',
    'vhd': 'application/x-virtualbox-vhd',
    'vhdx': 'application/x-virtualbox-vhdx',

    // Executable & Binary
    'exe': 'application/x-msdownload',
    'msi': 'application/x-msi',
    'deb': 'application/vnd.debian.binary-package',
    'rpm': 'application/x-rpm',
    'pkg': 'application/x-newton-compatible-pkg',
    'apk': 'application/vnd.android.package-archive',
    'ipa': 'application/octet-stream',
    'app': 'application/x-apple-diskimage',

    // Backup & System
    'bak': 'application/x-backup',
    'tmp': 'application/x-temp',
    'log': 'text/plain',
    'conf': 'text/plain',
    'cfg': 'text/plain',
    'ini': 'text/plain',
    'env': 'text/plain',

    // Blockchain & Crypto
    'wallet': 'application/x-bitcoin-wallet',
    'key': 'application/x-pem-file',
    'pem': 'application/x-pem-file',
    'crt': 'application/x-x509-ca-cert',
    'cer': 'application/x-x509-ca-cert',
    'p12': 'application/x-pkcs12',
    'pfx': 'application/x-pkcs12',
  };

  const mimeType = mimeTypes[fileExtension];

  // Log detected MIME type for debugging
  if (mimeType && mimeType !== 'application/octet-stream') {
    console.log(`[MIME] Detected ${fileExtension} -> ${mimeType}`);
  } else {
    console.log(`[MIME] Unknown extension ${fileExtension}, using application/octet-stream`);
  }

  return mimeType || 'application/octet-stream';
};

/**
 * Modern Google Drive upload with automatic strategy selection and fallback
 * Based on Google Drive API v3 best practices 2024
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive instance
 * @param {string} fileName - Name of the file
 * @param {Buffer} buffer - File buffer
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Object>} Upload result
 */
export const modernUpload = async (drive, fileName, buffer, folderId) => {
  const startTime = Date.now();
  let uploadMethod = 'unknown';

  try {
    console.log('[DRIVE] Starting modern upload');
    console.log('[DRIVE] File:', fileName, 'Size:', (buffer.length / (1024 * 1024)).toFixed(2), 'MB');

    // Validate inputs
    if (!drive) {
      throw new Error('Google Drive instance is required');
    }
    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Valid file name is required');
    }
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Valid buffer is required');
    }
    if (buffer.length === 0) {
      throw new Error('Buffer cannot be empty');
    }

    // Check file size limits (adjusted for Vercel Free Plan)
    const fileSizeInMB = buffer.length / (1024 * 1024);
    const MAX_FILE_SIZE_MB = 50; // Adjusted for Vercel Free Plan timeout limits

    if (fileSizeInMB > MAX_FILE_SIZE_MB) {
      throw new Error(`File size ${fileSizeInMB.toFixed(2)}MB exceeds maximum limit of ${MAX_FILE_SIZE_MB}MB`);
    }

    // Detect MIME type
    const mimeType = getMimeType(fileName);
    console.log('[DRIVE] MIME type:', mimeType);

    // Determine upload strategy based on file size and type (optimized for Vercel Free Plan)
    let useResumableUpload = false;
    let useChunkedUpload = false;

    if (fileSizeInMB > 25) {
      // Large files (>25MB) - use resumable with chunking
      useResumableUpload = true;
      useChunkedUpload = true;
      uploadMethod = 'resumable-chunked';
    } else if (fileSizeInMB > 5) {
      // Medium files (5-25MB) - use resumable
      useResumableUpload = true;
      uploadMethod = 'resumable';
    } else {
      // Small files (<5MB) - use multipart
      uploadMethod = 'multipart';
    }

    console.log(`[DRIVE] Selected upload method: ${uploadMethod} for ${fileSizeInMB.toFixed(2)}MB file`);

    // Try modern upload with selected strategy
    try {
      let result;

      if (useResumableUpload) {
        console.log('[DRIVE] Using resumable upload for large file');
        result = await performResumableUpload(drive, fileName, buffer, mimeType, folderId, useChunkedUpload);
      } else {
        console.log('[DRIVE] Using multipart upload for small file');
        result = await performMultipartUpload(drive, fileName, buffer, mimeType, folderId);
      }

      // Log success metrics
      const uploadTime = Date.now() - startTime;
      const uploadSpeed = (fileSizeInMB / (uploadTime / 1000)).toFixed(2);
      console.log(`[DRIVE] Upload successful - Method: ${uploadMethod}, Time: ${uploadTime}ms, Speed: ${uploadSpeed}MB/s`);

      return result;

    } catch (modernError) {
      console.warn('[DRIVE] Modern upload failed, falling back to simple upload:', modernError.message);
      uploadMethod = 'simple-fallback';

      // Fallback to simple upload using googleapis directly
      const result = await performSimpleUpload(drive, fileName, buffer, mimeType, folderId);

      const uploadTime = Date.now() - startTime;
      console.log(`[DRIVE] Fallback upload successful - Method: ${uploadMethod}, Time: ${uploadTime}ms`);

      return result;
    }
  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error(`[DRIVE] All upload methods failed - Method: ${uploadMethod}, Time: ${uploadTime}ms, Error:`, error.message);

    // Enhanced error reporting
    let enhancedError = error.message;
    if (error.message.includes('timeout')) {
      enhancedError = `Upload timeout after ${uploadTime}ms - file may be too large or connection too slow`;
    } else if (error.message.includes('ECONNRESET')) {
      enhancedError = 'Connection was reset - please try again';
    } else if (error.message.includes('ENOTFOUND')) {
      enhancedError = 'Network connection failed - check internet connectivity';
    } else if (error.message.includes('quota')) {
      enhancedError = 'Google Drive storage quota exceeded';
    } else if (error.message.includes('permission')) {
      enhancedError = 'Permission denied - check Google Drive folder access';
    }

    throw new Error(`Google Drive upload failed: ${enhancedError}`);
  }
};

/**
 * Simple fallback upload using googleapis directly
 */
async function performSimpleUpload(drive, fileName, buffer, mimeType, folderId) {
  try {
    console.log('[DRIVE] Executing simple fallback upload');

    const fileStream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId || 'root'],
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id,name,webViewLink,mimeType,size',
    });

    console.log('[DRIVE] Simple upload successful:', response.data.id);
    return formatUploadResult(response.data);

  } catch (error) {
    console.error('[DRIVE] Simple upload error:', error.message);
    throw error;
  }
}

/**
 * Perform multipart upload for small files (< 5MB)
 * More efficient for small files with single request
 */
async function performMultipartUpload(drive, fileName, buffer, mimeType, folderId) {
  try {
    console.log('[DRIVE] Executing multipart upload');

    const fileStream = Readable.from(buffer);

    // Smart timeout based on file size
    const fileSizeInMB = buffer.length / (1024 * 1024);
    const timeoutMs = Math.max(30000, fileSizeInMB * 10000); // Min 30s, +10s per MB

    const uploadPromise = drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId || 'root'],
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id,name,webViewLink,mimeType,size',
    }, {
      timeout: timeoutMs,
      retry: {
        retries: 2,
        retryDelay: (retryCount) => Math.min(2000 * Math.pow(2, retryCount), 8000),
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Multipart upload timeout after ${timeoutMs/1000}s`)), timeoutMs);
    });

    const response = await Promise.race([uploadPromise, timeoutPromise]);

    console.log('[DRIVE] Multipart upload successful:', response.data.id);
    return formatUploadResult(response.data);

  } catch (error) {
    console.error('[DRIVE] Multipart upload error:', error.message);
    throw error;
  }
}

/**
 * Perform resumable upload for large files (> 5MB)
 * Better for large files with network interruption recovery
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive instance
 * @param {string} fileName - Name of the file
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @param {string} folderId - Google Drive folder ID
 * @param {boolean} useChunkedUpload - Whether to use chunked upload for very large files
 */
async function performResumableUpload(drive, fileName, buffer, mimeType, folderId, useChunkedUpload = false) {
  try {
    console.log('[DRIVE] Executing resumable upload');
    const fileSizeInMB = buffer.length / (1024 * 1024);

    // Step 1: Initiate resumable upload session
    const sessionUri = await initiateResumableSession(drive, fileName, mimeType, folderId, buffer);
    console.log('[DRIVE] Resumable session initiated');

    // Step 2: Upload file data (chunked or single)
    let result;
    if (useChunkedUpload && fileSizeInMB > 50) {
      console.log('[DRIVE] Using chunked upload for very large file');
      result = await uploadFileDataChunked(sessionUri, buffer, mimeType);
    } else {
      console.log('[DRIVE] Using single resumable upload');
      result = await uploadFileData(sessionUri, buffer, mimeType);
    }

    console.log('[DRIVE] Resumable upload successful:', result.id);
    return formatUploadResult(result);

  } catch (error) {
    console.error('[DRIVE] Resumable upload error:', error.message);
    throw error;
  }
}

/**
 * Initiate resumable upload session
 */
async function initiateResumableSession(drive, fileName, mimeType, folderId, buffer) {
  const metadata = {
    name: fileName,
    parents: [folderId || 'root']
  };

  try {
    const accessToken = await getAccessToken(drive);

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      metadata,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': buffer.length.toString(),
        },
        timeout: 30000,
      }
    );

    const sessionUri = response.headers.location;
    if (!sessionUri) {
      throw new Error('Failed to get resumable session URI');
    }

    return sessionUri;
  } catch (error) {
    throw new Error(`Failed to initiate resumable session: ${error.message}`);
  }
}

/**
 * Upload file data to resumable session (single upload)
 */
async function uploadFileData(sessionUri, buffer, mimeType) {
  // Calculate smart timeout based on file size
  const fileSizeInMB = buffer.length / (1024 * 1024);
  const timeoutMs = Math.max(60000, fileSizeInMB * 15000); // Min 1min, +15s per MB

  try {
    console.log(`[DRIVE] Uploading ${fileSizeInMB.toFixed(2)}MB in single request with ${timeoutMs/1000}s timeout`);

    const response = await axios.put(sessionUri, buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
      },
      timeout: timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 308) {
      // Resume incomplete - implement resume logic if needed
      throw new Error('Upload incomplete - resume not implemented yet');
    }
    throw new Error(`File data upload failed: ${error.message}`);
  }
}

/**
 * Upload file data to resumable session using chunks (for very large files)
 */
async function uploadFileDataChunked(sessionUri, buffer, mimeType) {
  const fileSizeInMB = buffer.length / (1024 * 1024);
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks for optimal performance
  const totalSize = buffer.length;
  let uploadedBytes = 0;

  console.log(`[DRIVE] Starting chunked upload for ${fileSizeInMB.toFixed(2)}MB file with ${CHUNK_SIZE / (1024 * 1024)}MB chunks`);

  try {
    while (uploadedBytes < totalSize) {
      const chunkStart = uploadedBytes;
      const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalSize);
      const chunk = buffer.slice(chunkStart, chunkEnd);
      const chunkSize = chunk.length;

      console.log(`[DRIVE] Uploading chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1}/${Math.ceil(totalSize / CHUNK_SIZE)} (${(chunkStart / (1024 * 1024)).toFixed(1)}-${(chunkEnd / (1024 * 1024)).toFixed(1)}MB)`);

      // Calculate timeout for this chunk (minimum 30s, +5s per MB)
      const chunkTimeoutMs = Math.max(30000, (chunkSize / (1024 * 1024)) * 5000);

      const headers = {
        'Content-Type': mimeType,
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${chunkStart}-${chunkEnd - 1}/${totalSize}`,
      };

      try {
        const response = await axios.put(sessionUri, chunk, {
          headers,
          timeout: chunkTimeoutMs,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        uploadedBytes = chunkEnd;

        // Check if upload is complete
        if (response.status === 200 || response.status === 201) {
          console.log(`[DRIVE] Chunked upload completed successfully`);
          return response.data;
        } else if (response.status === 308) {
          // Continue with next chunk
          console.log(`[DRIVE] Chunk uploaded successfully, continuing...`);

          // Optional: Force garbage collection after each chunk for large files
          if (global.gc && fileSizeInMB > 100) {
            try {
              global.gc();
            } catch (gcError) {
              // Ignore GC errors
            }
          }
        } else {
          throw new Error(`Unexpected response status: ${response.status}`);
        }

      } catch (chunkError) {
        console.error(`[DRIVE] Chunk upload failed:`, chunkError.message);

        // Retry logic for failed chunks
        if (chunkError.code === 'ECONNRESET' || chunkError.code === 'ETIMEDOUT') {
          console.log(`[DRIVE] Retrying chunk due to network error...`);

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Retry the same chunk (don't increment uploadedBytes)
          continue;
        } else {
          throw chunkError;
        }
      }
    }

    throw new Error('Chunked upload completed but no final response received');

  } catch (error) {
    console.error(`[DRIVE] Chunked upload failed after uploading ${(uploadedBytes / (1024 * 1024)).toFixed(2)}MB:`, error.message);
    throw new Error(`Chunked file upload failed: ${error.message}`);
  }
}

/**
 * Get access token from drive instance
 */
async function getAccessToken(drive) {
  try {
    // Get auth client from drive instance
    const auth = drive.context._options.auth;

    // Get access token
    const credentials = await auth.getAccessToken();

    // Return the token
    return credentials.token || credentials;
  } catch (error) {
    console.error('[DRIVE] Failed to get access token:', error);
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

/**
 * Format upload result consistently
 */
function formatUploadResult(data) {
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    mimeType: data.mimeType,
    size: data.size,
  };
}

// Legacy function for backward compatibility
export const resumableUpload = modernUpload;

/**
 * Create folder in Google Drive
 */
export const createFolder = async (drive, folderName, parentFolderId = 'root') => {
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  });

  return res.data.id;
};

/**
 * List files in Google Drive folder
 */
export const listFiles = async (drive, folderId = 'root') => {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
  });

  return res.data.files;
};

/**
 * Get file from Google Drive
 */
export const getFile = async (drive, fileId) => {
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, createdTime, size',
  });

  return res.data;
};
