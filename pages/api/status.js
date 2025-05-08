import { initLineClient } from '../../utils/lineClient';
import { initGoogleDrive } from '../../utils/googleDrive';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check LINE configuration
    const lineConfigured = Boolean(
      process.env.LINE_CHANNEL_SECRET && 
      process.env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // Check Google Drive configuration
    const googleDriveConfigured = Boolean(
      process.env.GOOGLE_CLIENT_EMAIL && 
      process.env.GOOGLE_PRIVATE_KEY
    );

    // Check Google Drive folder
    const folderConfigured = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);

    // Get bot info if configured
    let botInfo = null;
    if (lineConfigured) {
      try {
        const lineClient = initLineClient();
        botInfo = await lineClient.getBotInfo();
      } catch (error) {
        console.error('Error getting bot info:', error);
      }
    }

    // Get folder info if configured
    let folderInfo = null;
    if (googleDriveConfigured && folderConfigured) {
      try {
        const drive = initGoogleDrive();
        folderInfo = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          fields: 'id,name,mimeType',
        });
      } catch (error) {
        console.error('Error getting folder info:', error);
      }
    }

    // Return status
    return res.status(200).json({
      status: 'ok',
      config: {
        line: lineConfigured,
        googleDrive: googleDriveConfigured,
        folder: folderConfigured,
      },
      bot: botInfo,
      folder: folderInfo?.data || null,
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
