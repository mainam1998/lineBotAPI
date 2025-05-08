# LINE File Bot Deployment Script

# Check if Vercel CLI is installed
$vercelInstalled = $null
try {
    $vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
} catch {
    # Vercel CLI not found
}

if ($null -eq $vercelInstalled) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Check if .env.local exists
if (Test-Path .env.local) {
    Write-Host "Found .env.local file. Using environment variables from this file." -ForegroundColor Green
} else {
    Write-Host "No .env.local file found. Please create one based on .env.local.example." -ForegroundColor Yellow
    Copy-Item .env.local.example .env.local
    Write-Host "Created .env.local from example. Please edit it with your actual values." -ForegroundColor Yellow
    exit
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

# Build the project
Write-Host "Building project..." -ForegroundColor Cyan
npm run build

# Deploy to Vercel
Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Don't forget to set up your LINE webhook URL in the LINE Developer Console." -ForegroundColor Yellow
Write-Host "Webhook URL: https://your-vercel-domain.vercel.app/api/callback" -ForegroundColor Yellow
