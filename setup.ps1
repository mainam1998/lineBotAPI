# LINE File Bot Setup Script

# Create .env.local file if it doesn't exist
if (-not (Test-Path .env.local)) {
    Write-Host "Creating .env.local file..." -ForegroundColor Cyan
    Copy-Item .env.local.example .env.local
}

# Prompt for LINE configuration
Write-Host "LINE Bot Configuration" -ForegroundColor Green
$lineChannelSecret = Read-Host "Enter your LINE Channel Secret"
$lineChannelAccessToken = Read-Host "Enter your LINE Channel Access Token"

# Prompt for Google Drive configuration
Write-Host "Google Drive Configuration" -ForegroundColor Green
$googleClientEmail = Read-Host "Enter your Google Service Account Email"
$googlePrivateKey = Read-Host "Enter your Google Service Account Private Key (paste the entire key)"
$googleDriveFolderId = Read-Host "Enter your Google Drive Folder ID (or leave empty for root)"

# Update .env.local file
$envContent = @"
# LINE Bot configuration
LINE_CHANNEL_SECRET=$lineChannelSecret
LINE_CHANNEL_ACCESS_TOKEN=$lineChannelAccessToken

# Google Drive API configuration
GOOGLE_CLIENT_EMAIL=$googleClientEmail
GOOGLE_PRIVATE_KEY="$googlePrivateKey"
GOOGLE_DRIVE_FOLDER_ID=$googleDriveFolderId
"@

Set-Content -Path .env.local -Value $envContent

Write-Host "Configuration saved to .env.local" -ForegroundColor Green

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

# Start development server
Write-Host "Starting development server..." -ForegroundColor Cyan
Write-Host "You can access the bot at http://localhost:3000" -ForegroundColor Yellow
Write-Host "To expose your local server to the internet, use ngrok: ngrok http 3000" -ForegroundColor Yellow
npm run dev
