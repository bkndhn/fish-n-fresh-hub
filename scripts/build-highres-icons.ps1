Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$logoPath = Join-Path $root "public\logo.png"
$iconDir = Join-Path $root "public\icons"

if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
}

$origBmp = [System.Drawing.Bitmap]::FromFile($logoPath)
$origW = $origBmp.Width
$origH = $origBmp.Height
$cornerColor = $origBmp.GetPixel(4, 4)

Write-Host "Loaded logo: ${origW}x${origH}, Corner Color: R=$($cornerColor.R) G=$($cornerColor.G) B=$($cornerColor.B) A=$($cornerColor.A)"

function Render-Icon {
    param(
        [int]$TargetSize,
        [string]$OutFile,
        [bool]$IsMaskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($TargetSize, $TargetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($IsMaskable) {
        # Fill background with corner color or white so Android maskable has solid backdrop
        $bgBrush = New-Object System.Drawing.SolidBrush($cornerColor)
        $g.FillRectangle($bgBrush, 0, 0, $TargetSize, $TargetSize)
        $bgBrush.Dispose()

        # Maskable safe-zone is central 80% (10% padding on each side)
        $padding = [int]($TargetSize * 0.10)
        $contentSize = $TargetSize - ($padding * 2)
        $destRect = New-Object System.Drawing.Rectangle($padding, $padding, $contentSize, $contentSize)
        $g.DrawImage($origBmp, $destRect, 0, 0, $origW, $origH, [System.Drawing.GraphicsUnit]::Pixel)
    } else {
        # Regular icon: high-res draw with transparent background
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $TargetSize, $TargetSize)
        $g.DrawImage($origBmp, $destRect, 0, 0, $origW, $origH, [System.Drawing.GraphicsUnit]::Pixel)
    }

    $destPath = Join-Path $root $OutFile
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    Write-Host "Generated crisp icon: $OutFile (${TargetSize}x${TargetSize}, Maskable=$IsMaskable)"
}

# Generate standard crisp icons
Render-Icon -TargetSize 512 -OutFile "public\icons\icon-512.png" -IsMaskable $false
Render-Icon -TargetSize 192 -OutFile "public\icons\icon-192.png" -IsMaskable $false
Render-Icon -TargetSize 180 -OutFile "public\apple-touch-icon.png" -IsMaskable $false

# Generate maskable icons with safe margin for Android adaptive launch
Render-Icon -TargetSize 512 -OutFile "public\icons\icon-maskable-512.png" -IsMaskable $true
Render-Icon -TargetSize 192 -OutFile "public\icons\icon-maskable-192.png" -IsMaskable $true

# Also save true 1024x1024 PNG logo
$truePngPath = Join-Path $root "public\logo-1024.png"
$origBmp.Save($truePngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved true 1024x1024 PNG logo to $truePngPath"

$origBmp.Dispose()

# Overwrite logo.png with real PNG
$tempPngPath = Join-Path $root "public\logo-1024.png"
Copy-Item -Path $tempPngPath -Destination $logoPath -Force
Write-Host "Updated public\logo.png with true PNG encoding"
