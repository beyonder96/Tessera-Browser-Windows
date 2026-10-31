Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $projectRoot 'release\win-unpacked\Tessera Browser.exe'
if (Test-Path $exe) {
    $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
    $bmp = $ico.ToBitmap()
    Write-Host "Extracted EXE Icon: $($bmp.Width)x$($bmp.Height), Corner Alpha: $($bmp.GetPixel(2,2).A)"
    $bmp.Save((Join-Path $projectRoot 'build\extracted-exe-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $ico.Dispose()
}
