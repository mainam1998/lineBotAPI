/**
 * Debug Google Drive Connection
 * Run this to debug what's wrong with Google Drive setup
 */

require('dotenv').config({ path: '.env.local' });

async function debugGoogleDrive() {
  console.log('🔍 Debugging Google Drive Connection...\n');

  // 1. Check environment variables
  console.log('📋 Environment Variables:');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY exists:', !!process.env.GOOGLE_PRIVATE_KEY);
  console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || '❌ Missing');
  console.log('');

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_EMAIL is missing');
    return;
  }

  if (!process.env.GOOGLE_PRIVATE_KEY) {
    console.error('❌ GOOGLE_PRIVATE_KEY is missing');
    return;
  }

  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    console.error('❌ GOOGLE_DRIVE_FOLDER_ID is missing');
    return;
  }

  // 2. Check private key format
  console.log('🔑 Private Key Analysis:');
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  console.log('Length:', privateKey.length);
  console.log('Starts with BEGIN:', privateKey.includes('-----BEGIN PRIVATE KEY-----'));
  console.log('Ends with END:', privateKey.includes('-----END PRIVATE KEY-----'));
  console.log('Has \\n characters:', privateKey.includes('\\n'));
  console.log('');

  // 3. Test Google Drive API
  try {
    console.log('🚀 Testing Google Drive API...');
    const { google } = require('googleapis');
    
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    // Test 1: Get folder info
    console.log('📁 Testing folder access...');
    try {
      const folderResponse = await drive.files.get({
        fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
        fields: 'id, name, permissions'
      });

      console.log('✅ Folder access successful!');
      console.log('Folder Name:', folderResponse.data.name);
      console.log('Folder ID:', folderResponse.data.id);
      console.log('');

    } catch (folderError) {
      console.error('❌ Folder access failed:');
      console.error('Error:', folderError.message);
      console.error('Code:', folderError.code);
      
      if (folderError.code === 404) {
        console.error('💡 Solutions:');
        console.error('   - Check if Folder ID is correct');
        console.error('   - Make sure folder exists in Google Drive');
        console.error('   - Verify folder is shared with service account');
      } else if (folderError.code === 403) {
        console.error('💡 Solutions:');
        console.error('   - Share folder with service account email');
        console.error('   - Give Editor or Owner permissions');
        console.error('   - Check if Google Drive API is enabled');
      }
      console.error('');
      return;
    }

    // Test 2: List files in folder
    console.log('📄 Testing file listing...');
    try {
      const filesResponse = await drive.files.list({
        q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, createdTime)',
        pageSize: 10
      });

      const files = filesResponse.data.files;
      console.log('✅ File listing successful!');
      console.log(`Found ${files.length} files:`);
      
      if (files.length === 0) {
        console.log('   (No files in folder - this is normal for a new folder)');
      } else {
        files.forEach((file, index) => {
          const size = file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Unknown';
          console.log(`   ${index + 1}. ${file.name} (${size})`);
        });
      }
      console.log('');

    } catch (listError) {
      console.error('❌ File listing failed:');
      console.error('Error:', listError.message);
      console.error('Code:', listError.code);
      console.error('');
      return;
    }

    // Test 3: Create a test file
    console.log('📝 Testing file creation...');
    try {
      const testFileResponse = await drive.files.create({
        requestBody: {
          name: 'debug-test.txt',
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: 'text/plain',
          body: `Debug test file created at ${new Date().toISOString()}\nGoogle Drive integration is working!`,
        },
      });

      console.log('✅ Test file created successfully!');
      console.log('File ID:', testFileResponse.data.id);
      console.log('File Name:', testFileResponse.data.name);
      console.log('');

      // Clean up - delete test file
      await drive.files.delete({
        fileId: testFileResponse.data.id,
      });
      console.log('🗑️ Test file deleted successfully');
      console.log('');

    } catch (createError) {
      console.error('❌ File creation failed:');
      console.error('Error:', createError.message);
      console.error('Code:', createError.code);
      console.error('');
      return;
    }

    console.log('🎉 All tests passed! Google Drive integration is working correctly.');
    console.log('');
    console.log('📋 Summary:');
    console.log('✅ Environment variables are set');
    console.log('✅ Private key format is correct');
    console.log('✅ Service account authentication works');
    console.log('✅ Folder access permissions are correct');
    console.log('✅ File operations work');
    console.log('');
    console.log('🚀 Your Google Drive integration is ready to use!');

  } catch (error) {
    console.error('❌ Google Drive API Error:');
    console.error('Error message:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.error('');
      console.error('💡 This is usually a private key or service account issue:');
      console.error('   - Check if private key format is correct');
      console.error('   - Ensure service account email is correct');
      console.error('   - Verify that the service account key is not expired');
      console.error('   - Make sure there are no extra spaces in environment variables');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      console.error('');
      console.error('💡 This is a network connectivity issue:');
      console.error('   - Check your internet connection');
      console.error('   - Verify firewall settings');
    }
    
    console.error('');
    console.error('🔧 Debug info:');
    console.error('Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.error('Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
    console.error('Private Key Length:', process.env.GOOGLE_PRIVATE_KEY?.length || 0);
  }
}

// Run the debug
debugGoogleDrive().catch(console.error);
