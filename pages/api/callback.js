import { initLineClient, verifySignature, replyMessage } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, resumableUpload, listFiles } from '../../utils/googleDrive';

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
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `คำสั่งที่ใช้ได้:
- help หรือ ช่วยเหลือ: แสดงคำสั่งที่ใช้ได้
- status หรือ สถานะ: แสดงสถานะของบอท
- list หรือ รายการ: แสดงรายการไฟล์ล่าสุด
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive`,
        });
        return res.status(200).end();
      }

      if (text === 'status' || text === 'สถานะ') {
        console.log('[DEBUG] Processing status command');
        try {
          const botInfo = await lineClient.getBotInfo();

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: `สถานะของบอท:
- ชื่อ: ${botInfo.displayName}
- รูปภาพ: ${botInfo.pictureUrl || 'ไม่มี'}
- สถานะ: พร้อมใช้งาน
- โฟลเดอร์: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'กำหนดแล้ว' : 'ยังไม่ได้กำหนด'}`,
          });
        } catch (error) {
          console.error('[ERROR] Error getting bot info:', error);
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ กรุณาลองใหม่อีกครั้ง',
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
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: 'ไม่พบไฟล์ในโฟลเดอร์',
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

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: `ไฟล์ล่าสุด (${Math.min(files.length, 10)} จาก ${files.length}):\n${fileList}`,
          });
        } catch (error) {
          console.error('[ERROR] Error listing files:', error);
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: 'เกิดข้อผิดพลาดในการดึงรายการไฟล์ กรุณาลองใหม่อีกครั้ง',
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
        // Initialize Google Drive client
        console.log('[DEBUG] Initializing Google Drive client');
        const drive = initGoogleDrive();
        console.log('[DEBUG] Google Drive client initialized');

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
        // Send initial response to user
        console.log('[DEBUG] Sending initial response to user');
        // Get message type in Thai
        let messageTypeInThai;
        switch (event.message.type) {
          case 'image':
            messageTypeInThai = 'รูปภาพ';
            break;
          case 'video':
            messageTypeInThai = 'วิดีโอ';
            break;
          case 'audio':
            messageTypeInThai = 'ไฟล์เสียง';
            break;
          default:
            messageTypeInThai = 'ไฟล์';
        }

        await replyMessage(lineClient, event.replyToken, {
          type: 'text',
          text: `กำลังอัปโหลด${messageTypeInThai} "${fileName}" (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)...`,
        });
        console.log('[DEBUG] Initial response sent');

        // Upload file to Google Drive using resumable upload for better handling of large files
        console.log('[DEBUG] Starting file upload to Google Drive');
        let uploadResult;
        try {
          uploadResult = await resumableUpload(
            drive,
            fileName,
            buffer,
            process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
          );
          console.log('[DEBUG] File uploaded successfully, result:', uploadResult);
        } catch (uploadError) {
          console.error('[ERROR] Failed to upload file to Google Drive:', uploadError);
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Send success message to user
        // Get message type in Thai (reuse the same logic)
        let messageTypeInThai;
        switch (event.message.type) {
          case 'image':
            messageTypeInThai = 'รูปภาพ';
            break;
          case 'video':
            messageTypeInThai = 'วิดีโอ';
            break;
          case 'audio':
            messageTypeInThai = 'ไฟล์เสียง';
            break;
          default:
            messageTypeInThai = 'ไฟล์';
        }

        await lineClient.pushMessage(event.source.userId, {
          type: 'text',
          text: `${messageTypeInThai} "${uploadResult.name}" ถูกอัปโหลดเรียบร้อยแล้ว${uploadResult.webViewLink ? `\nลิงก์: ${uploadResult.webViewLink}` : ''}`,
        });
      } catch (error) {
        console.error('[ERROR] Error handling file message:', error);

        // Try to notify user about error
        try {
          await lineClient.pushMessage(event.source.userId, {
            type: 'text',
            text: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง',
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
