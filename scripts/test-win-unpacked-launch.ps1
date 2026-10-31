$projectRoot = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $projectRoot 'release\win-unpacked\Tessera Browser.exe'
try {
    $proc = Start-Process -FilePath $exe -PassThru
    Start-Sleep -Seconds 2
    Write-Host "Running PID: $($proc.Id), HasExited: $($proc.HasExited)"
    if (-not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
        Write-Host "Process stopped cleanly."
    }
} catch {
    Write-Host "Failed to start: $_"
}
