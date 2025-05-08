import Head from 'next/head';
import { useState } from 'react';

export default function Home() {
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTest = async (endpoint) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/${endpoint}`);
      const data = await response.json();
      setTestResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '0 2rem',
      textAlign: 'center'
    }}>
      <Head>
        <title>LINE File Bot</title>
        <meta name="description" content="LINE Bot for uploading files to Google Drive" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          LINE File Bot
        </h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
          This bot receives files from LINE and uploads them to Google Drive.
        </p>
        <div style={{
          padding: '1.5rem',
          border: '1px solid #eaeaea',
          borderRadius: '10px',
          backgroundColor: '#f9f9f9',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Status</h2>
          <p>
            Webhook URL: <code>/api/callback</code>
          </p>
          <p style={{ marginTop: '1rem' }}>
            Bot is ready to receive messages
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          border: '1px solid #eaeaea',
          borderRadius: '10px',
          backgroundColor: '#f9f9f9',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Test Tools</h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => runTest('test')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Test API
            </button>

            <button
              onClick={() => runTest('line-test')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#00B900',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Test LINE API
            </button>

            <button
              onClick={() => runTest('drive-test')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4285F4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Test Google Drive API
            </button>
          </div>

          {isLoading && (
            <p>Loading...</p>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#FFEBEE',
              color: '#D32F2F',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}

          {testResults && (
            <div style={{
              padding: '1rem',
              backgroundColor: testResults.status === 'ok' ? '#E8F5E9' : '#FFEBEE',
              color: testResults.status === 'ok' ? '#2E7D32' : '#D32F2F',
              borderRadius: '4px',
              textAlign: 'left',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <p><strong>Status:</strong> {testResults.status}</p>
              <p><strong>Message:</strong> {testResults.message}</p>

              {testResults.env && (
                <div>
                  <p><strong>Environment Variables:</strong></p>
                  <ul>
                    {Object.entries(testResults.env).map(([key, value]) => (
                      <li key={key}>{key}: {String(value)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {testResults.botInfo && (
                <div>
                  <p><strong>Bot Info:</strong></p>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(testResults.botInfo, null, 2)}
                  </pre>
                </div>
              )}

              {testResults.files && (
                <div>
                  <p><strong>Files:</strong></p>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(testResults.files, null, 2)}
                  </pre>
                </div>
              )}

              {testResults.error && (
                <div>
                  <p><strong>Error Details:</strong> {testResults.error}</p>
                  {testResults.privateKeyHint && (
                    <p><strong>Hint:</strong> {testResults.privateKeyHint}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
