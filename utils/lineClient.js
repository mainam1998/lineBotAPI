import { Client, validateSignature } from '@line/bot-sdk';

/**
 * Initialize LINE client with enhanced configuration
 * @returns {import('@line/bot-sdk').Client} LINE client
 */
export const initLineClient = () => {
  const lineConfig = {
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    // Enhanced HTTP client configuration for TLS stability
    httpConfig: {
      timeout: 120000, // 2 minutes timeout (increased for TLS issues)
      keepAlive: true, // Enable keep-alive
      maxSockets: 3, // Further reduce concurrent connections
      maxFreeSockets: 1, // Keep minimal connections open
      // TLS configuration
      secureProtocol: 'TLSv1_2_method', // Force TLS 1.2
      rejectUnauthorized: true, // Verify certificates
      // Connection configuration
      family: 4, // Force IPv4 to avoid IPv6 issues
      // Add retry configuration
      retry: {
        retries: 3, // Increase retries for TLS issues
        retryDelay: (retryCount) => Math.min(3000 * Math.pow(2, retryCount), 15000), // Longer backoff
        retryCondition: (error) => {
          // Retry on network errors, TLS errors, and 5xx responses
          return error.code === 'ECONNRESET' ||
                 error.code === 'ENOTFOUND' ||
                 error.code === 'ECONNREFUSED' ||
                 error.code === 'ETIMEDOUT' ||
                 error.code === 'EPROTO' ||
                 error.code === 'CERT_HAS_EXPIRED' ||
                 error.message.includes('TLS') ||
                 error.message.includes('socket') ||
                 (error.response && error.response.status >= 500);
        }
      }
    }
  };

  return new Client(lineConfig);
};

/**
 * Verify LINE signature
 * @param {string} signature - X-Line-Signature header
 * @param {string} body - Request body
 * @returns {boolean} Whether signature is valid
 */
export const verifySignature = (signature, body) => {
  const lineConfig = {
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  };

  return validateSignature(body, lineConfig.channelSecret, signature);
};

/**
 * Send text message to user
 * @param {import('@line/bot-sdk').Client} client - LINE client
 * @param {string} userId - LINE user ID
 * @param {string} text - Message text
 * @returns {Promise<Object>} Send result
 */
export const sendTextMessage = async (client, userId, text) => {
  return client.pushMessage(userId, {
    type: 'text',
    text,
  });
};

/**
 * Reply to message
 * @param {import('@line/bot-sdk').Client} client - LINE client
 * @param {string} replyToken - Reply token
 * @param {Object} message - Message object
 * @returns {Promise<Object>} Reply result
 */
export const replyMessage = async (client, replyToken, message) => {
  return client.replyMessage(replyToken, message);
};

/**
 * Get user profile
 * @param {import('@line/bot-sdk').Client} client - LINE client
 * @param {string} userId - LINE user ID
 * @returns {Promise<Object>} User profile
 */
export const getUserProfile = async (client, userId) => {
  return client.getProfile(userId);
};
