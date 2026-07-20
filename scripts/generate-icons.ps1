# Generator identitas wordmark (keputusan paket identitas 20 Jul 2026):
# glyph not musik (U+266A) di ubin navy HKBP #031e66 — NETRAL, tidak memakai
# atau meniru lambang resmi HKBP (izin tertulis dari HKBP pusat belum turun).
# Kalau kelak izin resmi ada, kembalikan logo resmi cukup dengan mengganti
# generator ini + `npm run icons` — satu-satunya sumber aset identitas.
#
# Output (di-commit ke repo):
#   public/icons/icon-192.png  - ikon PWA (ubin navy, glyph putih)
#   public/icons/icon-512.png  - idem, 512px
#   public/logo-mark.png       - glyph navy transparan untuk masthead
# Pakai: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force "$root\public\icons" | Out-Null

function New-Mark([int]$size, [string]$path, [bool]$transparent) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $navy = [System.Drawing.Color]::FromArgb(3, 30, 102)
  if ($transparent) {
    $g.Clear([System.Drawing.Color]::Transparent)
    $ink = $navy
  } else {
    $g.Clear($navy)
    $ink = [System.Drawing.Color]::White
  }
  $font = New-Object System.Drawing.Font('Segoe UI Symbol', [float]($size * 0.52), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush($ink)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, [float]($size * -0.03), $size, $size)
  $g.DrawString([string][char]0x266A, $font, $brush, $rect, $fmt)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "ditulis: $path"
}

New-Mark 192 "$root\public\icons\icon-192.png" $false
New-Mark 512 "$root\public\icons\icon-512.png" $false
New-Mark 128 "$root\public\logo-mark.png" $true
