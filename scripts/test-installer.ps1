$projectRoot = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $projectRoot 'release\Tessera-Browser-Setup-1.0.0.exe'
try {
    # Check if executable can be queried or if SAC blocks it immediately
    $p = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
    Write-Host "Installer File Description: $($p.FileDescription), Company: $($p.CompanyName)"
} catch {
    Write-Host "Error: $_"
}
