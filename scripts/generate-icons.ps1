# Generator aset identitas dari assets/logo-hkbp.jpg (helper Windows, System.Drawing).
# Output (di-commit ke repo — script ini hanya perlu dijalankan ulang kalau logo ganti):
#   public/icons/icon-192.png  - ikon PWA, latar putih + margin 13% (aman maskable)
#   public/icons/icon-512.png  - idem, 512px
#   public/logo-hkbp.png       - logo transparan (putih->alpha) untuk masthead app
# Pakai: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$logo = [System.Drawing.Image]::FromFile("$root\assets\logo-hkbp.jpg")

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White)
  $m = [int]($size * 0.13)
  $s = $size - 2 * $m
  $g.DrawImage($logo, $m, $m, $s, $s)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "ditulis: $path"
}

New-Icon 192 "$root\public\icons\icon-192.png"
New-Icon 512 "$root\public\icons\icon-512.png"

# Logo transparan untuk masthead: kunci putih jadi alpha (threshold longgar,
# halo tipis sisa anti-alias JPEG tidak terlihat pada ukuran tampil kecil).
$h = 128
$w = [int]($logo.Width * $h / $logo.Height)
$small = New-Object System.Drawing.Bitmap($logo, $w, $h)
$out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $small.GetPixel($x, $y)
    if ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235) {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    } else {
      $out.SetPixel($x, $y, $p)
    }
  }
}
$out.Save("$root\public\logo-hkbp.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "ditulis: $root\public\logo-hkbp.png"
