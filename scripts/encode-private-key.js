/**
 * Script to encode Google Private Key to Base64 for Vercel deployment
 * This solves the newline issues with private keys in Vercel environment variables
 */

const fs = require('fs');
const path = require('path');

// Read private key from .env.local
require('dotenv').config({ path: '.env.local' });

function encodePrivateKey() {
  console.log('🔑 Encoding Google Private Key to Base64...\n');

  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ GOOGLE_PRIVATE_KEY not found in .env.local');
    console.log('💡 Make sure your .env.local file contains:');
    console.log('GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
    process.exit(1);
  }

  // Clean and validate private key
  const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');
  
  if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----') || 
      !cleanPrivateKey.includes('-----END PRIVATE KEY-----')) {
    console.error('❌ Invalid private key format');
    console.log('💡 Private key must include BEGIN and END markers');
    process.exit(1);
  }

  // Encode to base64
  const base64PrivateKey = Buffer.from(cleanPrivateKey).toString('base64');

  console.log('✅ Private key encoded successfully!\n');
  console.log('📋 Copy this value to your Vercel Environment Variables:\n');
  console.log('Variable Name: GOOGLE_PRIVATE_KEY_BASE64');
  console.log('Variable Value:');
  console.log('─'.repeat(80));
  console.log(base64PrivateKey);
  console.log('─'.repeat(80));
  console.log('\n🚀 Steps to add to Vercel:');
  console.log('1. Go to your Vercel Dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Settings > Environment Variables');
  console.log('4. Add new variable:');
  console.log('   Name: GOOGLE_PRIVATE_KEY_BASE64');
  console.log('   Value: (paste the base64 string above)');
  console.log('5. Set for Production, Preview, and Development');
  console.log('6. Redeploy your application');
  console.log('\n💡 You can remove GOOGLE_PRIVATE_KEY from Vercel after adding GOOGLE_PRIVATE_KEY_BASE64');

  // Save to file for easy copying
  const outputFile = path.join(__dirname, '..', 'private-key-base64.txt');
  fs.writeFileSync(outputFile, base64PrivateKey);
  console.log(`\n📄 Base64 key also saved to: ${outputFile}`);
  
  // Test decoding
  console.log('\n🧪 Testing decode...');
  const decoded = Buffer.from(base64PrivateKey, 'base64').toString('utf8');
  if (decoded === cleanPrivateKey) {
    console.log('✅ Decode test passed!');
  } else {
    console.log('❌ Decode test failed!');
  }
}

// Run the encoding
encodePrivateKey();
