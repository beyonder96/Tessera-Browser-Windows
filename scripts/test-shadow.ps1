Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$src = Join-Path $projectRoot 'build\variation-v1-pure-linework.png'
$out = Join-Path $projectRoot 'build\variation-v1-with-shadow.png'

$base = [System.Drawing.Bitmap]::FromFile($src)
$res = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($res)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Create a soft dark silhouette for shadow
$shadowBmp = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt 256; $y++) {
    for ($x = 0; $x -lt 256; $x++) {
        $p = $base.GetPixel($x, $y)
        if ($p.A -gt 10) {
            # 35% black shadow
            $sA = [int]($p.A * 0.38)
            $shadowBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($sA, 0, 0, 0))
        }
    }
}

# Draw shadow slightly offset (1px down, 1px right) and blurred/spread 1px
$offsets = @(
    @(-1, 0), @(1, 0), @(0, -1), @(0, 1),
    @(-1, -1), @(1, -1), @(-1, 1), @(1, 1),
    @(0, 2), @(0, 1)
)
foreach ($off in $offsets) {
    $g.DrawImage($shadowBmp, [int]$off[0], [int]$off[1])
}
# Draw pure white logo on top
$g.DrawImage($base, 0, 0)

$res.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$shadowBmp.Dispose()
$res.Dispose()
$base.Dispose()

Write-Host "Saved shadow variation to $out"
