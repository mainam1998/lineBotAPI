/**
 * API Route Configuration for Next.js
 * This file configures the API routes for handling large file uploads
 */

// This configuration applies to all API routes in this directory
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Adjusted for Vercel Free Plan
    },
    responseLimit: false,
  },
}

// Default export for the config endpoint
export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      config: {
        maxFileSize: '50MB',
        timeout: '60 seconds',
        supportedMethods: ['POST', 'GET'],
        features: [
          'File upload to Google Drive',
          'Performance monitoring',
          'Error analytics',
          'File validation',
          'Chunked upload support'
        ]
      }
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
