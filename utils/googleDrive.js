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
 * Convert stream to buffer
 * @param {import('stream').Readable} stream - Readable stream
 * @returns {Promise<Buffer>} Buffer containing stream data
 */
export const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

/**
 * Upload file to Google Drive using resumable upload
 * @param {import('googleapis').drive_v3.Drive} drive - Google Drive API client
 * @param {string} fileName - Name of the file
 * @param {Buffer} buffer - File content as buffer
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Object>} Upload result
 */
export const resumableUpload = async (drive, fileName, buffer, folderId) => {
  // Step 1: Initialize resumable upload session
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId || 'root'],
    },
    media: {
      mimeType: 'application/octet-stream',
      body: Readable.from(buffer),
    },
    fields: 'id,name,webViewLink',
    // Use resumable upload
    uploadType: 'resumable',
  });

  return res.data;
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
