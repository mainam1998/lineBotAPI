/**
 * Error Statistics API Endpoint
 * Provides error tracking and analysis for the upload system
 */

const errorHandler = require('../../utils/errorHandler');

export default async function handler(req, res) {
  console.log(`[ERRORS] Request: ${req.method} ${req.url}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetErrors(req, res);
      case 'POST':
        return handleClearErrors(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[ERRORS] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * Handle GET request - return error statistics
 */
async function handleGetErrors(req, res) {
  try {
    const { detailed } = req.query;

    const errorStats = errorHandler.getErrorStats();

    // Add system information
    const systemInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    let response = {
      success: true,
      data: {
        stats: errorStats,
        system: systemInfo,
      }
    };

    // Add detailed information if requested
    if (detailed === 'true') {
      response.data.detailed = {
        errorCounts: Array.from(errorHandler.errorCounts.entries()),
        recentErrorsDetailed: errorHandler.lastErrors.slice(0, 20)
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('[ERRORS] Error getting error stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get error statistics',
      message: error.message
    });
  }
}

/**
 * Handle POST request - clear error statistics (admin only)
 */
async function handleClearErrors(req, res) {
  try {
    const { action, adminKey } = req.body;

    // Simple admin key check (in production, use proper authentication)
    const expectedAdminKey = process.env.ADMIN_KEY || 'admin123';
    if (adminKey !== expectedAdminKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - invalid admin key'
      });
    }

    if (action === 'clear') {
      errorHandler.clearStats();
      
      console.log('[ERRORS] Error statistics cleared by admin');
      
      return res.status(200).json({
        success: true,
        message: 'Error statistics cleared successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "clear" to clear error statistics.'
      });
    }

  } catch (error) {
    console.error('[ERRORS] Error clearing error stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear error statistics',
      message: error.message
    });
  }
}
