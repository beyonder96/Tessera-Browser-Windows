Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$srcPng = Join-Path $projectRoot 'build\variation-v1-with-shadow.png'
if (-not (Test-Path $srcPng)) {
    $srcPng = Join-Path $projectRoot 'build\icon-source.png'
}
$outIco = Join-Path $projectRoot 'build\icon.ico'
$outPng = Join-Path $projectRoot 'build\icon.png'
$publicPng = Join-Path $projectRoot 'public\assets\icon.png'
$distPng = Join-Path $projectRoot 'dist\assets\icon.png'

# 1. Copy 256x256 PNG to destinations
Copy-Item $srcPng $outPng -Force
Copy-Item $srcPng $publicPng -Force
$distDir = Join-Path $projectRoot 'dist\assets'
if (Test-Path $distDir) {
    Copy-Item $srcPng $distPng -Force
}

# 2. Generate multi-resolution PNG buffers
$sizes = @(256, 48, 32, 24, 16)
$baseBmp = [System.Drawing.Bitmap]::FromFile($srcPng)
$pngBuffers = @()

foreach ($sz in $sizes) {
    if ($sz -eq 256) {
        $ms = New-Object System.IO.MemoryStream
        $baseBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBuffers += ,@($sz, $ms.ToArray())
        $ms.Dispose()
    } else {
        $bmpRes = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmpRes)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($baseBmp, 0, 0, $sz, $sz)
        
        $ms = New-Object System.IO.MemoryStream
        $bmpRes.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBuffers += ,@($sz, $ms.ToArray())
        $ms.Dispose()
        $g.Dispose()
        $bmpRes.Dispose()
    }
}
$baseBmp.Dispose()

# 3. Build multi-image Windows ICO container
$count = $pngBuffers.Count
$headerSize = 6 + ($count * 16)
$currentOffset = $headerSize

# ICO Header: 6 bytes
$icoBytes = New-Object System.Collections.Generic.List[byte]
# Reserved (2 bytes) = 0
$icoBytes.AddRange([BitConverter]::GetBytes([uint16]0))
# Type (2 bytes) = 1 (ICO)
$icoBytes.AddRange([BitConverter]::GetBytes([uint16]1))
# Count (2 bytes)
$icoBytes.AddRange([BitConverter]::GetBytes([uint16]$count))

# Directory Entries: 16 bytes each
foreach ($entry in $pngBuffers) {
    $sz = $entry[0]
    $data = $entry[1]
    
    $wByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $hByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    
    $icoBytes.Add($wByte)                       # Width (1 byte)
    $icoBytes.Add($hByte)                       # Height (1 byte)
    $icoBytes.Add([byte]0)                      # Color palette (1 byte)
    $icoBytes.Add([byte]0)                      # Reserved (1 byte)
    $icoBytes.AddRange([BitConverter]::GetBytes([uint16]1))   # Color planes (2 bytes)
    $icoBytes.AddRange([BitConverter]::GetBytes([uint16]32))  # Bits per pixel (2 bytes)
    $icoBytes.AddRange([BitConverter]::GetBytes([uint32]$data.Length))     # Image size (4 bytes)
    $icoBytes.AddRange([BitConverter]::GetBytes([uint32]$currentOffset))    # Image offset (4 bytes)
    
    $currentOffset += $data.Length
}

# Append PNG payloads
foreach ($entry in $pngBuffers) {
    $icoBytes.AddRange($entry[1])
}

[System.IO.File]::WriteAllBytes($outIco, $icoBytes.ToArray())
Write-Host "Created multi-resolution icon.ico ($($icoBytes.Count) bytes) with resolutions: $($sizes -join ', ')"
