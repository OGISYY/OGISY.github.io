# Uso (PowerShell, desde la raiz del repo):
#   powershell -ExecutionPolicy Bypass -File tools/optimize-images.ps1 -Root .
# Genera derivados JPEG ligeros (800 y 1600 px) en media/web/, con el mismo arbol que media/.
# - Los originales no se modifican. Usa WIC (WPF), que decodifica PNG y WebP.
# - Solo procesa imagenes nuevas o modificadas (usa -Force para regenerarlo todo).
# - Borra de media/web/ los derivados cuyo original ya no existe.
param([string]$Root = '.', [int[]]$Widths = @(800, 1600), [int]$Quality = 80, [switch]$Force)
Add-Type -AssemblyName PresentationCore, WindowsBase
$media = (Resolve-Path (Join-Path $Root 'media')).Path
$out   = Join-Path $media 'web'
$expected = @{}

Get-ChildItem $media -Recurse -Include *.png, *.jpg, *.jpeg, *.webp |
  Where-Object { $_.FullName -notlike "$out\*" } |
  ForEach-Object {
    $src = $_
    $rel = $src.FullName.Substring($media.Length + 1)
    $base = [System.IO.Path]::ChangeExtension($rel, $null).TrimEnd('.')
    $dests = $Widths | ForEach-Object { Join-Path $out "$base-$_.jpg" }
    $dests | ForEach-Object { $expected[$_.ToLower()] = $true }

    $fresh = -not $Force -and ($dests | Where-Object { -not (Test-Path $_) -or (Get-Item $_).LastWriteTime -lt $src.LastWriteTime }).Count -eq 0
    if ($fresh) { return }

    $stream = [System.IO.File]::OpenRead($src.FullName)
    try {
      $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create($stream,
        [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
        [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
      $frame = $dec.Frames[0]
    } catch { Write-Warning "No se pudo decodificar $rel : $_"; return }
    finally { $stream.Close() }

    for ($i = 0; $i -lt $Widths.Count; $i++) {
      $targetW = [Math]::Min($Widths[$i], $frame.PixelWidth)
      $scale = $targetW / $frame.PixelWidth
      $tb = New-Object System.Windows.Media.Imaging.TransformedBitmap($frame, (New-Object System.Windows.Media.ScaleTransform($scale, $scale)))
      # Sin alpha antes de pasar a JPEG
      $conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap($tb, [System.Windows.Media.PixelFormats]::Bgr24, $null, 0)
      $enc = New-Object System.Windows.Media.Imaging.JpegBitmapEncoder
      $enc.QualityLevel = $Quality
      $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($conv))
      $dest = $dests[$i]
      New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
      $fs = [System.IO.File]::Create($dest)
      $enc.Save($fs); $fs.Close()
      "{0,-62} {1,5}px {2,7:N0} KB  (orig {3}x{4})" -f $rel, $targetW, ((Get-Item $dest).Length / 1KB), $frame.PixelWidth, $frame.PixelHeight
    }
  }

# Limpieza: derivados huerfanos y carpetas vacias
if (Test-Path $out) {
  Get-ChildItem $out -Recurse -File -Filter *.jpg |
    Where-Object { -not $expected.ContainsKey($_.FullName.ToLower()) } |
    ForEach-Object { "Eliminado (sin original): " + $_.FullName.Substring($out.Length + 1); Remove-Item $_.FullName }
  Get-ChildItem $out -Recurse -Directory | Sort-Object { $_.FullName.Length } -Descending |
    Where-Object { -not (Get-ChildItem $_.FullName -Force) } | Remove-Item
}
