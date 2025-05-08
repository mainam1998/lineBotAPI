import Head from 'next/head';

export default function Home() {
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
          backgroundColor: '#f9f9f9'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Status</h2>
          <p>
            Webhook URL: <code>/api/callback</code>
          </p>
          <p style={{ marginTop: '1rem' }}>
            Bot is {process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'configured' : 'not configured'}
          </p>
        </div>
      </main>
    </div>
  );
}
