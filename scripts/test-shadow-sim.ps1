Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $projectRoot "build\variation-v1-with-shadow.png"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $projectRoot "build\icon.png"
}
$icon = [System.Drawing.Bitmap]::FromFile($iconPath)

$comp = New-Object System.Drawing.Bitmap(600, 320)
$gc = [System.Drawing.Graphics]::FromImage($comp)
$gc.Clear([System.Drawing.Color]::FromArgb(255, 32, 39, 47))
$gc.DrawImage($icon, 172, 32, 256, 256)
$comp.Save((Join-Path $projectRoot "build\shadow-on-dark.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$compLight = New-Object System.Drawing.Bitmap(600, 320)
$gcl = [System.Drawing.Graphics]::FromImage($compLight)
$gcl.Clear([System.Drawing.Color]::FromArgb(255, 245, 245, 245))
$gcl.DrawImage($icon, 172, 32, 256, 256)
$compLight.Save((Join-Path $projectRoot "build\shadow-on-light.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$icon.Dispose()
$gc.Dispose()
$gcl.Dispose()
$comp.Dispose()
$compLight.Dispose()
Write-Host "Simulations with shadow generated successfully!"
