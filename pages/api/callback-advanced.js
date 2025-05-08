import { Client } from '@line/bot-sdk';
import { google } from 'googleapis';
import { Readable } from 'stream';

// LINE SDK configuration
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

// Initialize LINE client
const lineClient = new Client(lineConfig);

// Initialize Google Drive API client with Service Account
const initGoogleDrive = () => {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive.file']
  );
  
  return google.drive({ version: 'v3', auth });
};

// Helper function to convert stream to buffer
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

// Helper function for resumable upload to Google Drive
const resumableUpload = async (drive, fileName, buffer, folderId) => {
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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify LINE signature
  try {
    const signature = req.headers['x-line-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing LINE signature' });
    }
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Process LINE webhook event
  try {
    const event = req.body.events?.[0];
    
    // If no events or not a message event, return 200 OK
    if (!event || event.type !== 'message') {
      return res.status(200).end();
    }

    // Handle file message
    if (event.message.type === 'file') {
      // Initialize Google Drive client
      const drive = initGoogleDrive();
      
      // Get file content from LINE
      const stream = await lineClient.getMessageContent(event.message.id);
      
      // Convert stream to buffer for resumable upload
      const buffer = await streamToBuffer(stream);
      
      // Send initial response to user
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `กำลังอัปโหลดไฟล์ "${event.message.fileName}" (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)...`,
      });
      
      // Upload file to Google Drive using resumable upload
      const uploadResult = await resumableUpload(
        drive,
        event.message.fileName,
        buffer,
        process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
      );
      
      // Send success message to user
      await lineClient.pushMessage(event.source.userId, {
        type: 'text',
        text: `ไฟล์ "${uploadResult.name}" ถูกอัปโหลดเรียบร้อยแล้ว\nลิงก์: ${uploadResult.webViewLink || 'ไม่สามารถสร้างลิงก์ได้'}`,
      });

      console.log('File uploaded successfully:', uploadResult);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Try to notify user about error
    try {
      const event = req.body.events?.[0];
      if (event && event.source && event.source.userId) {
        await lineClient.pushMessage(event.source.userId, {
          type: 'text',
          text: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง',
        });
      }
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
