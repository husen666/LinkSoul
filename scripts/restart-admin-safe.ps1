param(
  [int]$Port = 5174
)

$ErrorActionPreference = "Stop"

Write-Host "[safe-restart-admin] Checking listeners on port $Port..."
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
    Write-Host "[safe-restart-admin] Stopping PID $pid on port $Port..."
    taskkill /PID $pid /F | Out-Null
  }
} else {
  Write-Host "[safe-restart-admin] No listener found on port $Port."
}

Write-Host "[safe-restart-admin] Starting admin on port $Port..."
pnpm --filter @linksoul/admin dev -- --port $Port
