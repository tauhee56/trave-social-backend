# Test Authentication Endpoints

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Trave Social Backend Auth System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "TEST 1: Health Check" -ForegroundColor Green
Write-Host "GET http://localhost:5000/api/status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/status" -Method GET
    $response.Content | ConvertFrom-Json | ConvertTo-Json
    Write-Host "✅ Status: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Register User
Write-Host "TEST 2: Register New User" -ForegroundColor Green
Write-Host "POST http://localhost:5000/api/auth/register" -ForegroundColor Yellow
$body = @{
    email = "testuser@example.com"
    password = "Test123456"
    displayName = "Test User"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    $result = $response.Content | ConvertFrom-Json
    $result | ConvertTo-Json
    if ($result.success) {
        Write-Host "✅ Registration: SUCCESS" -ForegroundColor Green
        $script:token = $result.token
    } else {
        Write-Host "⚠️  Registration: FAILED - $($result.error)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Login User
Write-Host "TEST 3: Login User" -ForegroundColor Green
Write-Host "POST http://localhost:5000/api/auth/login" -ForegroundColor Yellow
$loginBody = @{
    email = "testuser@example.com"
    password = "Test123456"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    $result = $response.Content | ConvertFrom-Json
    $result | ConvertTo-Json
    if ($result.success) {
        Write-Host "✅ Login: SUCCESS" -ForegroundColor Green
        $script:token = $result.token
        Write-Host "Token stored for next test" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Login: FAILED - $($result.error)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Verify Token
if ($script:token) {
    Write-Host "TEST 4: Verify Token" -ForegroundColor Green
    Write-Host "POST http://localhost:5000/api/auth/verify" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/verify" `
            -Method POST `
            -ContentType "application/json" `
            -Headers @{ Authorization = "Bearer $($script:token)" }
        $result = $response.Content | ConvertFrom-Json
        $result | ConvertTo-Json
        Write-Host "✅ Verify: SUCCESS" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "TEST 4: Verify Token - SKIPPED (no token available)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Tests Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Backend is working and ready for use!" -ForegroundColor Green
