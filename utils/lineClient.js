import { Client } from '@line/bot-sdk';

/**
 * Initialize LINE client
 * @returns {import('@line/bot-sdk').Client} LINE client
 */
export const initLineClient = () => {
  const lineConfig = {
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
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
  
  return Client.validateSignature(body, lineConfig.channelSecret, signature);
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
