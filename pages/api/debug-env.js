export default function handler(req, res) {
  try {
    console.log('🔍 Debug Environment Variables');

    // Check all environment variables
    const envCheck = {
      // LINE Bot
      LINE_CHANNEL_ACCESS_TOKEN: {
        exists: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        length: process.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0,
        preview: process.env.LINE_CHANNEL_ACCESS_TOKEN ? 
          process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 10) + '...' : 'Missing'
      },
      LINE_CHANNEL_SECRET: {
        exists: !!process.env.LINE_CHANNEL_SECRET,
        length: process.env.LINE_CHANNEL_SECRET?.length || 0,
        preview: process.env.LINE_CHANNEL_SECRET ? 
          process.env.LINE_CHANNEL_SECRET.substring(0, 10) + '...' : 'Missing'
      },

      // Google Drive - New format
      GOOGLE_SERVICE_ACCOUNT_EMAIL: {
        exists: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        value: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'Missing'
      },

      // Google Drive - Old format (for backward compatibility)
      GOOGLE_CLIENT_EMAIL: {
        exists: !!process.env.GOOGLE_CLIENT_EMAIL,
        value: process.env.GOOGLE_CLIENT_EMAIL || 'Missing'
      },

      GOOGLE_PRIVATE_KEY: {
        exists: !!process.env.GOOGLE_PRIVATE_KEY,
        length: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
        hasBeginMarker: process.env.GOOGLE_PRIVATE_KEY?.includes('-----BEGIN PRIVATE KEY-----') || false,
        hasEndMarker: process.env.GOOGLE_PRIVATE_KEY?.includes('-----END PRIVATE KEY-----') || false,
        hasNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes('\\n') || false,
        preview: process.env.GOOGLE_PRIVATE_KEY ? 
          process.env.GOOGLE_PRIVATE_KEY.substring(0, 30) + '...' : 'Missing'
      },

      GOOGLE_DRIVE_FOLDER_ID: {
        exists: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
        value: process.env.GOOGLE_DRIVE_FOLDER_ID || 'Missing',
        length: process.env.GOOGLE_DRIVE_FOLDER_ID?.length || 0
      },

      // Other
      ADMIN_KEY: {
        exists: !!process.env.ADMIN_KEY,
        length: process.env.ADMIN_KEY?.length || 0
      },

      NODE_ENV: {
        value: process.env.NODE_ENV || 'undefined'
      },

      WEBHOOK_URL: {
        exists: !!process.env.WEBHOOK_URL,
        value: process.env.WEBHOOK_URL || 'Missing'
      }
    };

    // Determine which Google service account email to use
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    
    // Check if all required variables are set
    const requiredVars = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_DRIVE_FOLDER_ID'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    const hasServiceAccountEmail = !!serviceAccountEmail;

    // Overall status
    const allRequiredSet = missingVars.length === 0 && hasServiceAccountEmail;

    // Response
    return res.status(200).json({
      status: allRequiredSet ? 'ok' : 'error',
      message: allRequiredSet ? 
        'ตัวแปรสภาพแวดล้อมครบถ้วน' : 
        `ตัวแปรสภาพแวดล้อมไม่ครบ: ${missingVars.join(', ')}${!hasServiceAccountEmail ? ', GOOGLE_SERVICE_ACCOUNT_EMAIL' : ''}`,
      
      summary: {
        allRequiredSet,
        missingVariables: missingVars,
        hasServiceAccountEmail,
        serviceAccountEmailSource: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL' : 
                                   process.env.GOOGLE_CLIENT_EMAIL ? 'GOOGLE_CLIENT_EMAIL' : 'None',
        effectiveServiceAccountEmail: serviceAccountEmail || 'Missing'
      },

      details: envCheck,

      recommendations: allRequiredSet ? [
        '✅ ตัวแปรสภาพแวดล้อมครบถ้วน',
        '✅ พร้อมทดสอบ Google Drive API',
        '💡 ลองทดสอบผ่านปุ่ม "ทดสอบ Google Drive API"'
      ] : [
        '❌ ตัวแปรสภาพแวดล้อมไม่ครบถ้วน',
        '🔧 ตรวจสอบไฟล์ .env.local',
        '📝 เพิ่มตัวแปรที่ขาดหายไป',
        '🔄 รีสตาร์ท development server หลังแก้ไข'
      ]
    });

  } catch (error) {
    console.error('Error in debug-env:', error);
    return res.status(500).json({
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการตรวจสอบตัวแปรสภาพแวดล้อม',
      error: error.message
    });
  }
}
