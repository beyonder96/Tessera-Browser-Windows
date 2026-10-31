Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $projectRoot 'build'
$iconPath = Join-Path $outDir 'icon-test.png'
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $outDir 'icon.png'
}
$icon = [System.Drawing.Bitmap]::FromFile($iconPath)

# 1. Composite on dark taskbar #20272F
$darkSim = New-Object System.Drawing.Bitmap(256, 256)
$g1 = [System.Drawing.Graphics]::FromImage($darkSim)
$g1.Clear([System.Drawing.Color]::FromArgb(255, 32, 39, 47))
$g1.DrawImage($icon, 0, 0, 256, 256)
$darkSim.Save("$outDir\sim-dark-taskbar.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g1.Dispose()
$darkSim.Dispose()

# 2. Composite on light taskbar #F3F3F3
$lightSim = New-Object System.Drawing.Bitmap(256, 256)
$g2 = [System.Drawing.Graphics]::FromImage($lightSim)
$g2.Clear([System.Drawing.Color]::FromArgb(255, 243, 243, 243))
$g2.DrawImage($icon, 0, 0, 256, 256)
$lightSim.Save("$outDir\sim-light-taskbar.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$lightSim.Dispose()

$icon.Dispose()
Write-Host "Simulations saved to $outDir\sim-dark-taskbar.png and sim-light-taskbar.png"
