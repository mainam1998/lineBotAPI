import { initLineClient, verifySignature } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, resumableUpload, listFiles } from '../../utils/googleDrive';
import uploadQueue from '../../utils/uploadQueue';

// ตัดฟังก์ชันที่ไม่ได้ใช้แล้วออก

export default async function handler(req, res) {
  // Log request method and path
  console.log(`[DEBUG] Request: ${req.method} ${req.url}`);

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[DEBUG] Not a POST request, returning 405');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always return 200 OK for LINE webhook
  console.log('[DEBUG] Received webhook body:', JSON.stringify(req.body, null, 2));

  // Verify LINE signature (but don't return error status)
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!signature) {
      console.log('[DEBUG] Missing LINE signature, but continuing anyway');
      // Continue processing even without signature
    } else {
      try {
        const isValid = verifySignature(signature, body);
        console.log('[DEBUG] Signature verification result:', isValid);
        // Continue processing even if signature is invalid
      } catch (signatureError) {
        console.error('[ERROR] Error during signature verification:', signatureError);
        // Continue processing even if signature verification fails
      }
    }
  } catch (error) {
    console.error('[ERROR] Error in signature verification block:', error);
    // Continue processing even if there's an error
  }

  // Initialize LINE client
  let lineClient;
  try {
    console.log('[DEBUG] Initializing LINE client');
    lineClient = initLineClient();
    console.log('[DEBUG] LINE client initialized successfully');
  } catch (error) {
    console.error('[ERROR] Failed to initialize LINE client:', error);
    return res.status(200).end();
  }

  // Process LINE webhook event
  try {
    const event = req.body.events?.[0];

    // If no events or not a message event, return 200 OK
    if (!event || event.type !== 'message') {
      console.log('[DEBUG] No events or not a message event');
      return res.status(200).end();
    }

    console.log('[DEBUG] Processing message event:', event.message.type);

    // Handle text message (commands)
    if (event.message.type === 'text') {
      const text = event.message.text.trim().toLowerCase();
      console.log('[DEBUG] Received text message:', text);

      // Handle commands
      if (text === 'help' || text === 'ช่วยเหลือ') {
        console.log('[DEBUG] Processing help command');
        const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
        const helpMessage = `คำสั่งที่ใช้ได้:
- help หรือ ช่วยเหลือ: แสดงคำสั่งที่ใช้ได้
- status หรือ สถานะ: แสดงสถานะของบอท
- list หรือ รายการ: แสดงรายการไฟล์ล่าสุด
- queue หรือ คิว หรือ สถานะคิว: แสดงสถานะคิวอัพโหลด
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive (รองรับหลายไฟล์พร้อมกัน)

เว็บไซต์: ${webAppUrl}`;

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: helpMessage,
        });
        return res.status(200).end();
      }

      if (text === 'status' || text === 'สถานะ') {
        console.log('[DEBUG] Processing status command');
        try {
          const botInfo = await lineClient.getBotInfo();

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const statusMessage = `สถานะของบอท:
- ชื่อ: ${botInfo.displayName}
- รูปภาพ: ${botInfo.pictureUrl || 'ไม่มี'}
- สถานะ: พร้อมใช้งาน
- โฟลเดอร์: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'กำหนดแล้ว' : 'ยังไม่ได้กำหนด'}

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: statusMessage,
          });
        } catch (error) {
          console.error('[ERROR] Error getting bot info:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const botErrorMessage = `เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: botErrorMessage,
          });
        }
        return res.status(200).end();
      }

      if (text === 'list' || text === 'รายการ') {
        console.log('[DEBUG] Processing list command');
        try {
          const drive = initGoogleDrive();
          const files = await listFiles(drive, process.env.GOOGLE_DRIVE_FOLDER_ID || 'root');

          if (files.length === 0) {
            const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
            const noFilesMessage = `ไม่พบไฟล์ในโฟลเดอร์

เว็บไซต์: ${webAppUrl}`;

            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: noFilesMessage,
            });
            return res.status(200).end();
          }

          const fileList = files
            .slice(0, 10) // Limit to 10 files
            .map((file, index) => {
              const size = file.size ? `(${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB)` : '';
              return `${index + 1}. ${file.name} ${size}`;
            })
            .join('\n');

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const listMessage = `ไฟล์ล่าสุด (${Math.min(files.length, 10)} จาก ${files.length}):\n${fileList}\n\nเว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: listMessage,
          });
        } catch (error) {
          console.error('[ERROR] Error listing files:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการดึงรายการไฟล์ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: errorMessage,
          });
        }
        return res.status(200).end();
      }

      if (text === 'queue' || text === 'คิว' || text === 'สถานะคิว') {
        console.log('[DEBUG] Processing queue status command');
        try {
          const userId = event.source.userId;
          const userQueueStatus = uploadQueue.getUserQueueStatus(userId);
          const globalStats = uploadQueue.getQueueStats();

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          let queueMessage = `สถานะคิวอัพโหลด:

ของคุณ:
- รอดำเนินการ: ${userQueueStatus.pending} ไฟล์
- กำลังอัพโหลด: ${userQueueStatus.processing} ไฟล์
- สำเร็จแล้ว: ${userQueueStatus.completed} ไฟล์
- ล้มเหลว: ${userQueueStatus.failed} ไฟล์

ระบบทั้งหมด:
- คิวทั้งหมด: ${globalStats.total} ไฟล์
- กำลังประมวลผล: ${globalStats.isProcessing ? 'ใช่' : 'ไม่'}

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: queueMessage,
          });
        } catch (error) {
          console.error('[ERROR] Error getting queue status:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการดึงสถานะคิว กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: errorMessage,
          });
        }
        return res.status(200).end();
      }
    }

    // Handle file, image, video, or audio message
    if (['file', 'image', 'video', 'audio'].includes(event.message.type)) {
      // Generate filename based on message type
      let fileName;
      let fileExtension;

      switch (event.message.type) {
        case 'file':
          fileName = event.message.fileName;
          break;
        case 'image':
          fileExtension = '.jpg';
          fileName = `image_${event.message.id}${fileExtension}`;
          break;
        case 'video':
          fileExtension = '.mp4';
          fileName = `video_${event.message.id}${fileExtension}`;
          break;
        case 'audio':
          fileExtension = '.m4a';
          fileName = `audio_${event.message.id}${fileExtension}`;
          break;
        default:
          fileName = `file_${event.message.id}`;
      }
      console.log('[DEBUG] Handling message type:', event.message.type, 'with filename:', fileName);

      try {
        // Get file content from LINE
        console.log('[DEBUG] Getting file content from LINE, message ID:', event.message.id);
        let stream;
        try {
          stream = await lineClient.getMessageContent(event.message.id);
          console.log('[DEBUG] File content stream received');

          // Check if stream is valid
          if (!stream) {
            throw new Error('Received empty stream from LINE');
          }
        } catch (streamError) {
          console.error('[ERROR] Failed to get file content from LINE:', streamError);
          throw new Error(`Failed to get file content: ${streamError.message}`);
        }

        // Convert stream to buffer for better handling
        console.log('[DEBUG] Converting stream to buffer');
        let buffer;
        try {
          buffer = await streamToBuffer(stream);
          console.log('[DEBUG] Stream converted to buffer successfully, size:', (buffer.length / (1024 * 1024)).toFixed(2), 'MB');
        } catch (bufferError) {
          console.error('[ERROR] Failed to convert stream to buffer:', bufferError);
          throw new Error(`Failed to process file: ${bufferError.message}`);
        }

        // Add file to upload queue instead of uploading immediately
        console.log('[DEBUG] Adding file to upload queue');
        const userId = event.source.userId;
        const queueId = uploadQueue.addToQueue(userId, {
          fileName,
          buffer,
          messageId: event.message.id,
          messageType: event.message.type
        });

        console.log(`[DEBUG] File added to queue with ID: ${queueId}`);

        // Get current queue status for user
        const userQueueStatus = uploadQueue.getUserQueueStatus(userId);

        // Send immediate confirmation with queue status
        const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
        const queueMessage = `ไฟล์ถูกเพิ่มในคิวแล้ว: ${fileName}

สถานะคิวของคุณ:
- รอดำเนินการ: ${userQueueStatus.pending} ไฟล์
- กำลังอัพโหลด: ${userQueueStatus.processing} ไฟล์

เว็บไซต์: ${webAppUrl}`;

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: queueMessage,
        });

      } catch (error) {
        console.error('[ERROR] Error handling file message:', error);

        // Try to notify user about error
        try {
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการเพิ่มไฟล์ในคิว กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: errorMessage,
          });
        } catch (notifyError) {
          console.error('[ERROR] Failed to notify user about error:', notifyError);
        }
      }
    }

    return res.status(200).end();
  } catch (error) {
    console.error('[ERROR] Error processing webhook:', error);

    // Always return 200 OK for LINE webhook
    return res.status(200).end();
  }
}
