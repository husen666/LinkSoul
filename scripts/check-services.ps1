param(
  [int]$TimeoutMs = 2500
)

$ErrorActionPreference = "Continue"

$services = @(
  @{ Name = "Backend API"; Url = "http://localhost:3000/api/v1/health" },
  @{ Name = "Admin Panel"; Url = "http://localhost:5174/" },
  @{ Name = "Mobile Web"; Url = "http://localhost:8081/" },
  @{ Name = "AI Service"; Url = "http://localhost:8000/health" }
)

Write-Host ("`n[service-check] timeout={0}ms`n" -f $TimeoutMs)
$rows = @()

foreach ($svc in $services) {
  $name = $svc.Name
  $url = $svc.Url
  $status = "DOWN"
  $code = "-"
  $note = ""

  try {
    $resp = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec ([Math]::Ceiling($TimeoutMs / 1000.0))
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
      $status = "UP"
      $code = [string]$resp.StatusCode
    } else {
      $status = "WARN"
      $code = [string]$resp.StatusCode
    }
  } catch {
    $msg = $_.Exception.Message
    if ($msg -like "*404*") {
      $status = "WARN"
      $code = "404"
      $note = "endpoint missing"
    } else {
      $status = "DOWN"
      $note = ($msg -replace "`r|`n", " ")
    }
  }

  $rows += [PSCustomObject]@{
    Service = $name
    Status  = $status
    Code    = $code
    Url     = $url
    Note    = $note
  }
}

$rows | Format-Table -AutoSize

$upCount = @($rows | Where-Object { $_.Status -eq "UP" }).Count
$warnCount = @($rows | Where-Object { $_.Status -eq "WARN" }).Count
$downCount = @($rows | Where-Object { $_.Status -eq "DOWN" }).Count

Write-Host ("`n[service-check] UP={0} WARN={1} DOWN={2}`n" -f $upCount, $warnCount, $downCount)

if ($downCount -gt 0) {
  exit 1
}
