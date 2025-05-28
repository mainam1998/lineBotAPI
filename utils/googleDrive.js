import { google } from 'googleapis';
import { Readable } from 'stream';

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
 * Convert stream to buffer with timeout
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

    // Handle stream close event
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
 * Upload file to Google Drive using direct upload
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive API client
 * @param {string} fileName - Name of the file
 * @param {Buffer} buffer - File content as buffer
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Object>} Upload result
 */
export const resumableUpload = async (drive, fileName, buffer, folderId) => {
  console.log('[DEBUG] Starting direct upload to Google Drive');
  console.log('[DEBUG] File name:', fileName);
  console.log('[DEBUG] File size:', (buffer.length / (1024 * 1024)).toFixed(2), 'MB');
  console.log('[DEBUG] Folder ID:', folderId || 'root');

  try {
    // Create a readable stream from the buffer
    const fileStream = Readable.from(buffer);

    // Determine MIME type based on file extension
    let mimeType = 'application/octet-stream';
    const fileExtension = fileName.split('.').pop().toLowerCase();

    // Map common file extensions to MIME types
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'm4a': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'txt': 'text/plain'
    };

    if (fileExtension && mimeTypes[fileExtension]) {
      mimeType = mimeTypes[fileExtension];
    }

    console.log('[DEBUG] Uploading file with MIME type:', mimeType);

    // Upload file to Google Drive with timeout and retry
    const uploadPromise = drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId || 'root'],
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id,name,webViewLink,mimeType',
    }, {
      // Set a longer timeout
      timeout: 120000, // 2 minutes
      // Increase retry count
      retry: true,
      retryConfig: {
        retries: 3,
        retryDelay: 2000,
      }
    });

    // Add overall timeout for the upload
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Google Drive upload timeout after 3 minutes')), 3 * 60 * 1000);
    });

    const res = await Promise.race([uploadPromise, timeoutPromise]);

    console.log('[DEBUG] Upload successful, file ID:', res.data.id);
    return res.data;
  } catch (error) {
    console.error('[ERROR] Upload failed:', error.message);
    throw error;
  }
};

/**
 * Create folder in Google Drive
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive API client
 * @param {string} folderName - Name of the folder
 * @param {string} parentFolderId - Parent folder ID
 * @returns {Promise<string>} Folder ID
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
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive API client
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Array>} List of files
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
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive API client
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<Object>} File metadata
 */
export const getFile = async (drive, fileId) => {
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, createdTime, size',
  });

  return res.data;
};
