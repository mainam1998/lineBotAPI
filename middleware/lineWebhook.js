import { verifySignature } from '../utils/lineClient';

/**
 * Middleware for verifying LINE webhook signature
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @param {Function} next - Next.js next function
 * @returns {Promise<void>}
 */
export const lineWebhookMiddleware = async (req, res, next) => {
  // Only process POST requests
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
    
    // Signature is valid, proceed to handler
    return next();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
