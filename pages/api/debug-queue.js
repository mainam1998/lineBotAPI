import uploadQueue from '../../utils/uploadQueue';

export default async function handler(req, res) {
  console.log(`[DEBUG] Debug Queue API: ${req.method} ${req.url}`);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const globalStats = uploadQueue.getQueueStats();
    
    // Get detailed queue information for debugging
    const debugInfo = {
      stats: globalStats,
      queueItems: uploadQueue.queue.map(item => ({
        id: item.id,
        userId: item.userId,
        fileName: item.fileName,
        status: item.status,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        addedAt: item.addedAt,
        completedAt: item.completedAt,
        error: item.error,
        bufferSize: item.buffer ? `${(item.buffer.length / (1024 * 1024)).toFixed(2)} MB` : 'No buffer'
      })),
      userQueues: Array.from(uploadQueue.userQueues.entries()).map(([userId, fileIds]) => ({
        userId,
        fileIds,
        fileCount: fileIds.length
      })),
      isProcessing: uploadQueue.processing
    };

    res.status(200).json({
      status: 'ok',
      message: 'Debug queue information retrieved successfully',
      data: debugInfo
    });

  } catch (error) {
    console.error('[ERROR] Error getting debug queue info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get debug queue info',
      error: error.message
    });
  }
}
