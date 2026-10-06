Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot '..\outputs\helloproject-mobile-archive\helloproject-mobile.com\birthday_cards'
$blog2017 = 'https://ameblo.jp/uen0/entry-12340229760.html'
$blog2018 = 'https://ameblo.jp/uen0/entry-12429315501.html'
$map2017 = @'
0106 yanagawa
0107 ishida
0202 makino
0205 nakajima
0207 yajima
0207 hagiwara
0210 nomura
0210 ozeki
0215 ogata
0219 morito
0222 yokoyama
0304 fujii
0306 tsugunaga
0307 haga
0308 wada
0312 oda
0326 aikawa
0327 ogawa
0401 kishimoto
0402 miyazaki
0406 katsuta
0412 suzuki
0421 takagi
0426 hamaura
0507 sato
0510 funaki
0528 sasaki
0528 sayashi
0604 nakanishi
0612 murota
0702 kanazawa
0707 ikuta
0717 inoue
0721 taguchi
0729 akiyama
0801 wada
0804 hirose
0903 asakura
0929 ono
1007 nonaka
1014 yamaki
1020 niinuma
1022 kasahara
1024 kamiko
1027 kudo
1030 fukumura
1105 ogata
1107 iikubo
1116 tanimoto
1123 takeuchi
1124 yamagishi
1130 kaga
1201 miyamoto
1217 onoda
1227 inaba
1230 uemura
'@ -split "`n" | Where-Object { $_.Trim() }
$map2018 = @'
0106 yanagawa
0107 ishida_from-screenshot
0202 makino
0210 ozeki
0210 nomura
0215 ogata
0219 morito
0222 yokoyama
0307 haga
0308 wada
0312 oda
'@ -split "`n" | Where-Object { $_.Trim() }

function Get-ImageUrls($page) {
  $html = (Invoke-WebRequest -Uri $page -UseBasicParsing).Content
  $seen = @{}
  $urls = @()
  foreach ($match in [regex]::Matches($html, 'https://stat\.ameba\.jp/user_images/[^"''\s<>?]+')) {
    if (-not $seen.ContainsKey($match.Value)) {
      $seen[$match.Value] = $true
      $urls += $match.Value
    }
  }
  return $urls
}

function Get-CardRect($image) {
  $x = $image.Width - 3
  $top = -1
  for ($y = 170; $y -lt [Math]::Min(350, $image.Height); $y++) {
    $pixel = $image.GetPixel($x, $y)
    $isBlue = $pixel.R -lt 40 -and $pixel.G -ge 80 -and $pixel.G -le 160 -and $pixel.B -ge 150
    if (-not $isBlue -and $y -gt 180) {
      $previous = $image.GetPixel($x, $y - 1)
      if ($previous.R -lt 40 -and $previous.G -ge 80 -and $previous.G -le 160 -and $previous.B -ge 150) {
        $top = $y
        break
      }
    }
  }
  if ($top -lt 0) { throw 'Could not locate card top' }
  for ($y = $top + 300; $y -lt $image.Height; $y++) {
    $white = $true
    foreach ($sample in @(0, [int]($image.Width / 4), [int]($image.Width / 2), [int](3 * $image.Width / 4), ($image.Width - 1))) {
      $pixel = $image.GetPixel($sample, $y)
      if ($pixel.R -lt 240 -or $pixel.G -lt 240 -or $pixel.B -lt 240) { $white = $false; break }
    }
    if ($white) { return [System.Drawing.Rectangle]::new(0, $top, $image.Width, $y - $top) }
  }
  throw 'Could not locate card bottom'
}

function Save-Crop($source, $target, $rect) {
  $image = [System.Drawing.Image]::FromFile($source)
  try {
    if (-not $rect) { $rect = Get-CardRect $image }
    $bitmap = [System.Drawing.Bitmap]::new($rect.Width, $rect.Height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
      } finally { $graphics.Dispose() }
      $format = if ([IO.Path]::GetExtension($target) -eq '.jpg') { [System.Drawing.Imaging.ImageFormat]::Jpeg } else { [System.Drawing.Imaging.ImageFormat]::Png }
      $bitmap.Save($target, $format)
    } finally { $bitmap.Dispose() }
  } finally { $image.Dispose() }
  return "$($rect.Width)x$($rect.Height)"
}

$sources = @{}
foreach ($year in @('2017', '2018')) {
  $page = if ($year -eq '2017') { $blog2017 } else { $blog2018 }
  $map = if ($year -eq '2017') { $map2017 } else { $map2018 }
  $urls = Get-ImageUrls $page
  if ($year -eq '2018') { $urls2018 = $urls }
  $expected = if ($year -eq '2017') { 56 } else { 49 }
  if ($urls.Count -ne $expected) { throw "Unexpected $year image count: $($urls.Count)" }
  $dir = Join-Path $root $year
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  for ($i = 0; $i -lt $map.Count; $i++) {
    $parts = $map[$i].Trim() -split '\s+'
    $mmdd, $slug = $parts
    $ext = if ($slug -eq 'ishida_from-screenshot') { 'jpg' } else { 'png' }
    $name = '{0}-{1}-{2}_{3}.{4}' -f $year, $mmdd.Substring(0, 2), $mmdd.Substring(2, 2), $slug, $ext
    $sourceDir = Join-Path $PSScriptRoot "birthday_source_$year"
    New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null
    $sourceName = if ($year -eq '2017') { '{0:D3}' -f ($i + 1) } else { '{0:D2}' -f ($i + 1) }
    $source = Join-Path $sourceDir ($sourceName + [IO.Path]::GetExtension($urls[$i]))
    if (-not (Test-Path -LiteralPath $source)) { Invoke-WebRequest -Uri $urls[$i] -OutFile $source }
    $target = Join-Path $dir $name
    $rect = $null
    if ($year -eq '2018' -and $i -ge 7) {
      $tops = @(181, 193, 197, 197)
      $heights = @(429, 429, 428, 428)
      $sourceImage = [System.Drawing.Image]::FromFile($source)
      try { $rect = [System.Drawing.Rectangle]::new(0, $tops[$i - 7], $sourceImage.Width, $heights[$i - 7]) }
      finally { $sourceImage.Dispose() }
    }
    $size = Save-Crop $source $target $rect
    $sources[$name] = @{ source = 'blog_screenshot'; url = $urls[$i]; page_url = $page }
    Write-Output "$name $size"
  }
}

$splitSource = Join-Path $PSScriptRoot 'birthday_source_2018\12.jpg'
if (-not (Test-Path -LiteralPath $splitSource)) { Invoke-WebRequest -Uri $urls2018[11] -OutFile $splitSource }
foreach ($item in @(
  @{ Name = '2018-04-01_kishimoto.png'; Rect = [System.Drawing.Rectangle]::new(31, 220, 648, 380) },
  @{ Name = '2018-04-02_miyazaki.png'; Rect = [System.Drawing.Rectangle]::new(31, 750, 648, 383) }
)) {
  $target = Join-Path (Join-Path $root '2018') $item.Name
  $size = Save-Crop $splitSource $target $item.Rect
  $sources[$item.Name] = @{ source = 'blog_screenshot'; url = $urls2018[11]; page_url = $blog2018 }
  Write-Output "$($item.Name) $size"
}

$sources | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root '_blog_screenshot_sources.json') -Encoding UTF8
