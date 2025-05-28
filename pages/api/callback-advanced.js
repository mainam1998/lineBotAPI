import { initLineClient, verifySignature } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, resumableUpload } from '../../utils/googleDrive';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify LINE signature
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!signature) {
      return res.status(400).json({ error: 'Missing LINE signature' });
    }

    if (!verifySignature(signature, body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Initialize LINE client
  const lineClient = initLineClient();

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

      // Upload file to Google Drive using resumable upload
      const uploadResult = await resumableUpload(
        drive,
        event.message.fileName,
        buffer,
        process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
      );

      // Send success message to user
      const webAppUrl = 'https://line-bot-api-ruby.vercel.app/';
      const successMessage = `อัพโหลดสำเร็จ

ไฟล์: ${uploadResult.webViewLink || 'ไม่สามารถสร้างลิงก์ได้'}

เว็บไซต์: ${webAppUrl}`;

      await lineClient.pushMessage(event.source.userId, {
        type: 'text',
        text: successMessage,
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
        const webAppUrl = 'https://line-bot-api-ruby.vercel.app/';
        const errorMessage = `เกิดข้อผิดพลาดในการอัพโหลดไฟล์ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

        await lineClient.pushMessage(event.source.userId, {
          type: 'text',
          text: errorMessage,
        });
      }
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
