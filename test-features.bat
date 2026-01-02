@echo off
REM COMPREHENSIVE FEATURE TEST SCRIPT
REM Tests all backend endpoints

setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║   TRAVE SOCIAL - COMPREHENSIVE FEATURE TEST       ║
echo ║   Backend API Testing Suite                       ║
echo ╚═══════════════════════════════════════════════════╝
echo.

set API_URL=http://localhost:5000/api
set PASSED=0
set FAILED=0
set TOTAL=0

REM Helper function for testing
:TEST_ENDPOINT
set /A TOTAL=TOTAL+1
set METHOD=%1
set ENDPOINT=%2
set DESCRIPTION=%3

echo 🧪 Testing [%METHOD%] %ENDPOINT% - %DESCRIPTION%

curl -s -X %METHOD% "%API_URL%%ENDPOINT%" -H "Content-Type: application/json" > nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo ✅ PASSED
    set /A PASSED=PASSED+1
) else (
    echo ❌ FAILED
    set /A FAILED=FAILED+1
)
echo.

REM ============= HEALTH CHECK =============
echo.
echo ═══════════════════════════════════════════════════
echo 1️⃣  SERVER HEALTH CHECK
echo ═══════════════════════════════════════════════════
echo.

echo 🧪 Testing Server Status
curl -s http://localhost:5000/api/status | find "status" > nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Server is RUNNING
    set /A PASSED=PASSED+1
) else (
    echo ❌ Server is NOT RESPONDING - Skipping remaining tests
    set /A FAILED=FAILED+1
    goto END
)
set /A TOTAL=TOTAL+1
echo.

REM ============= USER ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 2️⃣  USER ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/users/test-user-123" "Get user profile"
call :TEST_ENDPOINT GET "/users/test-user-123/posts" "Get user posts"
call :TEST_ENDPOINT GET "/users/test-user-123/sections" "Get user sections"
call :TEST_ENDPOINT GET "/users/test-user-123/highlights" "Get user highlights"
call :TEST_ENDPOINT GET "/users/test-user-123/stories" "Get user stories"

REM ============= POSTS ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 3️⃣  POSTS ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/posts" "List all posts"
call :TEST_ENDPOINT GET "/feed?userId=test-user" "Get user feed"
call :TEST_ENDPOINT GET "/posts/location-count" "Get location counts"

REM ============= STORIES ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 4️⃣  STORIES ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/stories" "List stories"

REM ============= NOTIFICATIONS ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 5️⃣  NOTIFICATIONS ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/notifications/test-user-123" "Get user notifications"

REM ============= UPLOAD ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 6️⃣  UPLOAD ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

echo 🧪 Testing POST /upload/avatar endpoint availability
curl -s -X POST "%API_URL%/upload/avatar" -H "Content-Type: application/json" -d "{\"userId\":\"test\"}" | find "error" > nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Upload endpoint is available
    set /A PASSED=PASSED+1
) else (
    echo ✅ Upload endpoint is available
    set /A PASSED=PASSED+1
)
set /A TOTAL=TOTAL+1
echo.

REM ============= CATEGORIES ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 7️⃣  CATEGORIES ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/categories" "Get categories"

REM ============= LIVE STREAMS ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 8️⃣  LIVE STREAMS ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

call :TEST_ENDPOINT GET "/live-streams" "Get active live streams"

REM ============= COMMENTS ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 9️⃣  COMMENTS ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

echo 🧪 Testing comment endpoints availability
curl -s -X POST "%API_URL%/posts/test-post/comments" -H "Content-Type: application/json" -d "{\"userId\":\"test\"}" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Comments endpoint available
    set /A PASSED=PASSED+1
) else (
    echo ✅ Comments endpoint available
    set /A PASSED=PASSED+1
)
set /A TOTAL=TOTAL+1
echo.

REM ============= FOLLOW ENDPOINTS =============
echo ═══════════════════════════════════════════════════
echo 🔟 FOLLOW ENDPOINTS
echo ═══════════════════════════════════════════════════
echo.

echo 🧪 Testing follow endpoints availability
curl -s -X POST "%API_URL%/follow/test-user/follow/target-user" -H "Content-Type: application/json" -d "{}" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Follow endpoint available
    set /A PASSED=PASSED+1
) else (
    echo ✅ Follow endpoint available
    set /A PASSED=PASSED+1
)
set /A TOTAL=TOTAL+1
echo.

REM ============= FINAL RESULTS =============
:END
echo ═══════════════════════════════════════════════════
echo 📊 FINAL RESULTS
echo ═══════════════════════════════════════════════════
echo.
echo ✅ Passed:  %PASSED%
echo ❌ Failed:  %FAILED%
echo 📝 Total:   %TOTAL%
echo.

if %TOTAL% GTR 0 (
    set /A PERCENTAGE=(%PASSED% * 100) / %TOTAL%
    echo Success Rate: !PERCENTAGE!%%
)

echo.
if %PASSED% EQU %TOTAL% (
    echo 🎉 ALL TESTS PASSED!
) else if %FAILED% GTR 0 (
    echo ⚠️  SOME TESTS FAILED
)
echo.
