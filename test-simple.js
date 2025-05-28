/**
 * Simple test for Google Drive connection
 */

require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('🔍 Testing Google Drive Connection...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Set' : '❌ Missing');
  console.log('');

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test Google Drive API
  try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    console.log('🚀 Testing Google Drive API...');
    
    // Test folder access
    const folderResponse = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id, name'
    });

    console.log('✅ Google Drive API Connection Successful!');
    console.log('📁 Folder Name:', folderResponse.data.name);
    console.log('📁 Folder ID:', folderResponse.data.id);
    console.log('');

    // List files in folder
    console.log('📝 Listing files in folder...');
    const filesResponse = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime)',
      pageSize: 10
    });

    const files = filesResponse.data.files;
    console.log(`📄 Found ${files.length} files:`);
    
    if (files.length === 0) {
      console.log('   (No files found in folder)');
    } else {
      files.forEach((file, index) => {
        const size = file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Unknown';
        console.log(`   ${index + 1}. ${file.name} (${size})`);
      });
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Google Drive API Error:');
    console.error('Error message:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.error('💡 Possible solutions:');
      console.error('   - Check if private key format is correct');
      console.error('   - Ensure service account email is correct');
    } else if (error.message.includes('File not found')) {
      console.error('💡 Possible solutions:');
      console.error('   - Check if folder ID is correct');
      console.error('   - Ensure folder is shared with service account email');
    } else if (error.message.includes('insufficient permissions')) {
      console.error('💡 Possible solutions:');
      console.error('   - Share the folder with service account email');
      console.error('   - Give Editor or Owner permissions');
    }
  }
}

// Run the test
testConnection().catch(console.error);
