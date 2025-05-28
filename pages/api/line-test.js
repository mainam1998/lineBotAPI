import { Client } from '@line/bot-sdk';

export default async function handler(req, res) {
  try {
    console.log('Testing LINE API connection');
    
    // Check if LINE credentials are set
    if (!process.env.LINE_CHANNEL_SECRET || !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return res.status(200).json({ 
        status: 'error',
        message: 'LINE credentials are not set',
        env: {
          LINE_CHANNEL_SECRET_EXISTS: !!process.env.LINE_CHANNEL_SECRET,
          LINE_CHANNEL_ACCESS_TOKEN_EXISTS: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
        }
      });
    }
    
    // Initialize LINE client
    const lineConfig = {
      channelSecret: process.env.LINE_CHANNEL_SECRET,
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    };
    
    try {
      const lineClient = new Client(lineConfig);
      
      // Get bot info to test connection
      const botInfo = await lineClient.getBotInfo();
      
      return res.status(200).json({ 
        status: 'ok',
        message: 'LINE API connection successful',
        botInfo
      });
    } catch (lineError) {
      console.error('Error connecting to LINE API:', lineError);
      return res.status(200).json({ 
        status: 'error',
        message: 'Failed to connect to LINE API',
        error: lineError.message
      });
    }
  } catch (error) {
    console.error('Error in LINE test handler:', error);
    return res.status(200).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
}
