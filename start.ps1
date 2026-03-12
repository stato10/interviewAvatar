# AI Interview Coach - Startup Script
# Starts Backend (8000), Agent, and Web (5173)

$ErrorActionPreference = "Stop"

function Check-Port($port) {
    if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) {
        Write-Host "Port $port is in use. Attempting to free it..." -ForegroundColor Yellow
        $proc = Get-NetTCPConnection -LocalPort $port | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $proc) {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
}

Write-Host ">>> STARTING AI INTERVIEW COACH <<<" -ForegroundColor Green

# 1. Cleanup Ports 8000 (Backend) and 5173 (Frontend)
Check-Port 8000
Check-Port 5173

# 2. Start Backend
Write-Host "1. Starting Backend (Port 8000)..." -ForegroundColor Cyan
$backendReq = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& { cd backend; python main.py }" -PassThru

# 3. Start Agent
Write-Host "2. Starting Agent..." -ForegroundColor Cyan
$agentReq = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& { cd agent; uv run python agent.py dev }" -PassThru

# 4. Start Frontend
Write-Host "3. Starting Web UI..." -ForegroundColor Cyan
$frontendReq = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& { cd web; npm run dev }" -PassThru

# 5. Launch Browser
Start-Sleep -Seconds 5
Write-Host "4. Opening Browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ">>> ALL SYSTEMS GO <<<" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000"
Write-Host "Agent: agent.py dev"
Write-Host "Web UI: http://localhost:5173"
