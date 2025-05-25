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
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive.file']
  );

  return google.drive({ version: 'v3', auth });
};

/**
 * Convert stream to buffer with timeout and error handling
 * @param {import('stream').Readable} stream - Readable stream
 * @param {number} timeoutMs - Timeout in milliseconds (default: 60 seconds)
 * @returns {Promise<Buffer>} Buffer containing stream data
 */
export const streamToBuffer = async (stream, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let isResolved = false;

    // Set timeout
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        stream.destroy();
        reject(new Error(`Stream to buffer conversion timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    stream.on('data', (chunk) => {
      if (!isResolved) {
        chunks.push(chunk);
      }
    });

    stream.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    stream.on('end', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      }
    });

    stream.on('close', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      }
    });
  });
};

/**
 * Get MIME type from file extension
 * @param {string} fileName - File name with extension
 * @returns {string} MIME type
 */
export const getMimeType = (fileName) => {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    
    // Audio
    'm4a': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Other
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
  };

  return mimeTypes[fileExtension] || 'application/octet-stream';
};

/**
 * Modern Google Drive upload with automatic strategy selection
 * Based on Google Drive API v3 best practices 2024
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive instance
 * @param {string} fileName - Name of the file
 * @param {Buffer} buffer - File buffer
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Object>} Upload result
 */
export const modernUpload = async (drive, fileName, buffer, folderId) => {
  try {
    console.log('[DRIVE] Starting modern upload');
    console.log('[DRIVE] File:', fileName, 'Size:', (buffer.length / (1024 * 1024)).toFixed(2), 'MB');

    // Detect MIME type
    const mimeType = getMimeType(fileName);
    console.log('[DRIVE] MIME type:', mimeType);

    // Determine upload strategy based on file size
    const fileSizeInMB = buffer.length / (1024 * 1024);
    const useResumableUpload = fileSizeInMB > 5; // Use resumable for files > 5MB

    if (useResumableUpload) {
      console.log('[DRIVE] Using resumable upload for large file');
      return await performResumableUpload(drive, fileName, buffer, mimeType, folderId);
    } else {
      console.log('[DRIVE] Using multipart upload for small file');
      return await performMultipartUpload(drive, fileName, buffer, mimeType, folderId);
    }
  } catch (error) {
    console.error('[DRIVE] Upload failed:', error.message);
    throw new Error(`Google Drive upload failed: ${error.message}`);
  }
};

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
 */
async function performResumableUpload(drive, fileName, buffer, mimeType, folderId) {
  try {
    console.log('[DRIVE] Executing resumable upload');
    
    // Step 1: Initiate resumable upload session
    const sessionUri = await initiateResumableSession(drive, fileName, mimeType, folderId);
    console.log('[DRIVE] Resumable session initiated');

    // Step 2: Upload file data
    const result = await uploadFileData(sessionUri, buffer, mimeType);
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
async function initiateResumableSession(drive, fileName, mimeType, folderId) {
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
 * Upload file data to resumable session
 */
async function uploadFileData(sessionUri, buffer, mimeType) {
  // Calculate smart timeout based on file size
  const fileSizeInMB = buffer.length / (1024 * 1024);
  const timeoutMs = Math.max(60000, fileSizeInMB * 15000); // Min 1min, +15s per MB

  try {
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
 * Get access token from drive instance
 */
async function getAccessToken(drive) {
  try {
    const auth = drive.context._options.auth;
    const accessToken = await auth.getAccessToken();
    return accessToken.token;
  } catch (error) {
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
