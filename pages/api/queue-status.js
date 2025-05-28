import uploadQueue from '../../utils/uploadQueue';

export default async function handler(req, res) {
  console.log(`[DEBUG] Queue Status API: ${req.method} ${req.url}`);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const globalStats = uploadQueue.getQueueStats();
    
    // Get detailed queue information
    const queueDetails = {
      stats: globalStats,
      recentActivity: {
        totalProcessed: globalStats.completed + globalStats.failed,
        successRate: globalStats.completed > 0 ? 
          ((globalStats.completed / (globalStats.completed + globalStats.failed)) * 100).toFixed(1) : 0
      }
    };

    res.status(200).json({
      status: 'ok',
      message: 'Queue status retrieved successfully',
      data: queueDetails
    });

  } catch (error) {
    console.error('[ERROR] Error getting queue status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get queue status',
      error: error.message
    });
  }
}
