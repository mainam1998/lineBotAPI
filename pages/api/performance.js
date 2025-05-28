/**
 * Performance Monitoring API Endpoint
 * Provides system performance metrics and upload statistics
 */

const performanceMonitor = require('../../utils/performanceMonitor');

export default async function handler(req, res) {
  console.log(`[PERFORMANCE] Request: ${req.method} ${req.url}`);

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
        return handleGetMetrics(req, res);
      case 'POST':
        return handleResetMetrics(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[PERFORMANCE] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * Handle GET request - return performance metrics
 */
async function handleGetMetrics(req, res) {
  try {
    const { detailed } = req.query;

    let metrics;
    if (detailed === 'true') {
      // Return detailed metrics for debugging
      metrics = performanceMonitor.getDetailedMetrics();
    } else {
      // Return summary metrics for dashboard
      metrics = performanceMonitor.getPerformanceSummary();
    }

    // Add system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      data: {
        metrics,
        system: systemInfo,
      }
    });

  } catch (error) {
    console.error('[PERFORMANCE] Error getting metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
      message: error.message
    });
  }
}

/**
 * Handle POST request - reset metrics (admin only)
 */
async function handleResetMetrics(req, res) {
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

    if (action === 'reset') {
      performanceMonitor.resetMetrics();
      
      console.log('[PERFORMANCE] Metrics reset by admin');
      
      return res.status(200).json({
        success: true,
        message: 'Performance metrics reset successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "reset" to reset metrics.'
      });
    }

  } catch (error) {
    console.error('[PERFORMANCE] Error resetting metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset performance metrics',
      message: error.message
    });
  }
}
