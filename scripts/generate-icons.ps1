Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
}

function Build-PwaIcon {
    param(
        [int]$Size,
        [string]$Filename
    )

    $dest = Join-Path $iconDir $Filename
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#0284c7")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#0f766e")
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
    $g.FillRectangle($brush, $rect)

    # Circle badge
    $innerSize = [int]($Size * 0.76)
    $offset = [int](($Size - $innerSize) / 2)
    $innerRect = New-Object System.Drawing.Rectangle($offset, $offset, $innerSize, $innerSize)
    $innerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
    $g.FillEllipse($innerBrush, $innerRect)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 255, 255, 255), [Math]::Max(2, [int]($Size * 0.02)))
    $g.DrawEllipse($pen, $innerRect)

    # Title FNF
    $fontSize = [int]($Size * 0.28)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("FNF", $font, $textBrush, [float]($Size / 2), [float]($Size / 2 - $Size * 0.05), $sf)

    # Subtitle
    $subSize = [int]($Size * 0.09)
    $subFont = New-Object System.Drawing.Font("Arial", $subSize, [System.Drawing.FontStyle]::Bold)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#fef08a"))
    $g.DrawString("FRESH HUB", $subFont, $subBrush, [float]($Size / 2), [float]($Size / 2 + $Size * 0.22), $sf)

    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $dest"
}

Build-PwaIcon -Size 192 -Filename "icon-192.png"
Build-PwaIcon -Size 512 -Filename "icon-512.png"
Build-PwaIcon -Size 192 -Filename "icon-maskable-192.png"
Build-PwaIcon -Size 512 -Filename "icon-maskable-512.png"
