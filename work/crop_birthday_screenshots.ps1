Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot '..\outputs\helloproject-mobile-archive\helloproject-mobile.com\birthday_cards'
$originals = Join-Path $root '_source_screenshots'
New-Item -ItemType Directory -Path $originals -Force | Out-Null

$items = @(
  @{ Name = '2019-01-06_yanagawa.jpg'; Year = '2019'; Top = 183; Height = 428 },
  @{ Name = '2020-12-27_inaba.jpg'; Year = '2020'; Top = 185; Height = 428 },
  @{ Name = '2020-12-30_uemura.jpg'; Year = '2020'; Top = 183; Height = 427 }
)

foreach ($item in $items) {
  $target = Join-Path (Join-Path $root $item.Year) $item.Name
  $source = if ($item.Source) { $item.Source } else { $target }
  $backup = Join-Path $originals $item.Name
  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $source -Destination $backup
  }

  $image = [System.Drawing.Image]::FromFile($backup)
  try {
    $rect = [System.Drawing.Rectangle]::new(0, $item.Top, $image.Width, $item.Height)
    if ($rect.Bottom -gt $image.Height) { throw "Crop exceeds source: $($item.Name)" }
    $bitmap = [System.Drawing.Bitmap]::new($rect.Width, $rect.Height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
      } finally { $graphics.Dispose() }
      $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    } finally { $bitmap.Dispose() }
  } finally { $image.Dispose() }
  Write-Output "$($item.Name): $($rect.Width)x$($rect.Height)"
}
