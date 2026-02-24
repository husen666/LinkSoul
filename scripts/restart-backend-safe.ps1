param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "[safe-restart] Checking listeners on port $Port..."
$lines = netstat -ano | Select-String -Pattern (":$Port\s+.*LISTENING\s+(\d+)$")

$pids = @()
foreach ($line in $lines) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
  if ($parts.Length -gt 0) {
    $pid = $parts[-1]
    if ($pid -match "^\d+$") {
      $pids += [int]$pid
    }
  }
}

$pids = $pids | Select-Object -Unique

if ($pids.Count -gt 0) {
  foreach ($pid in $pids) {
    Write-Host "[safe-restart] Stopping PID $pid on port $Port..."
    taskkill /PID $pid /F | Out-Null
  }
} else {
  Write-Host "[safe-restart] No listener found on port $Port."
}

Write-Host "[safe-restart] Starting backend in watch mode..."
pnpm --filter @linksoul/backend dev
