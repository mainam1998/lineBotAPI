/**
 * Test Google Drive Connection
 * Run this file to test if Google Drive credentials are working
 */

require('dotenv').config({ path: '.env.local' });

async function testGoogleDriveConnection() {
  console.log('🔍 Testing Google Drive Connection...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Set' : '❌ Missing');
  console.log('');

  // Check Google Drive credentials format
  if (process.env.GOOGLE_PRIVATE_KEY) {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    console.log('🔑 Private Key Format:');
    console.log('Starts with BEGIN:', privateKey.includes('-----BEGIN PRIVATE KEY-----') ? '✅' : '❌');
    console.log('Ends with END:', privateKey.includes('-----END PRIVATE KEY-----') ? '✅' : '❌');
    console.log('Has newlines:', privateKey.includes('\\n') ? '✅' : '❌');
    console.log('');
  }

  // Test Google Drive API
  try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    console.log('🚀 Testing Google Drive API...');
    
    // Test folder access
    const folderResponse = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id, name, permissions'
    });

    console.log('✅ Google Drive API Connection Successful!');
    console.log('📁 Folder Name:', folderResponse.data.name);
    console.log('📁 Folder ID:', folderResponse.data.id);
    console.log('');

    // Test file creation (create a test file)
    console.log('📝 Testing file creation...');
    const testFileResponse = await drive.files.create({
      requestBody: {
        name: 'test-connection.txt',
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: 'text/plain',
        body: 'This is a test file created by LINE Bot\nConnection test successful!',
      },
    });

    console.log('✅ Test file created successfully!');
    console.log('📄 File ID:', testFileResponse.data.id);
    console.log('📄 File Name:', testFileResponse.data.name);
    console.log('');

    // Clean up - delete test file
    await drive.files.delete({
      fileId: testFileResponse.data.id,
    });
    console.log('🗑️ Test file deleted successfully');
    console.log('');

    console.log('🎉 All tests passed! Google Drive integration is working correctly.');

  } catch (error) {
    console.error('❌ Google Drive API Error:');
    console.error('Error message:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.error('💡 Possible solutions:');
      console.error('   - Check if private key format is correct');
      console.error('   - Ensure service account email is correct');
      console.error('   - Verify that the service account key is not expired');
    } else if (error.message.includes('File not found')) {
      console.error('💡 Possible solutions:');
      console.error('   - Check if folder ID is correct');
      console.error('   - Ensure folder is shared with service account email');
      console.error('   - Verify folder permissions (Editor or Owner)');
    } else if (error.message.includes('insufficient permissions')) {
      console.error('💡 Possible solutions:');
      console.error('   - Share the folder with service account email');
      console.error('   - Give Editor or Owner permissions');
      console.error('   - Check if Google Drive API is enabled');
    }
    
    console.error('');
    console.error('🔧 Debug info:');
    console.error('Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.error('Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
  }
}

// Run the test
testGoogleDriveConnection().catch(console.error);
