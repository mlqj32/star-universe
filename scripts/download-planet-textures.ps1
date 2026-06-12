$ErrorActionPreference = 'Continue'
$base = 'https://www.solarsystemscope.com/textures/download'
$three = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets'
$wikiMercury = 'https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg'
$artPluto = 'https://cdn.jsdelivr.net/npm/artastra@1.0.8/textures/pluto.jpg'
$headers = @{
  'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0'
  'Referer'    = 'https://www.solarsystemscope.com/textures/'
}
$outDir = Join-Path $PSScriptRoot '..\textures\planets' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $outDir) {
  $outDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'textures\planets'
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$wikiSun = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Solarsystemscope_texture_2k_sun.jpg'
$wikiSunPath = 'https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_sun.jpg'
$wikiSaturnRingPath = 'https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_saturn_ring_alpha.png'

$files = @(
  @{ n = '2k_sun.jpg';               u = $wikiSunPath; alt = $wikiSun; alt2 = "$base/2k_sun.jpg" },
  @{ n = '2k_mercury.jpg';           u = $wikiMercury },
  @{ n = '2k_venus_atmosphere.jpg';  u = "$base/2k_venus_atmosphere.jpg" },
  @{ n = '2k_mars.jpg';               u = "$base/2k_mars.jpg" },
  @{ n = '2k_jupiter.jpg';            u = "$base/2k_jupiter.jpg" },
  @{ n = '2k_saturn.jpg';             u = "$base/2k_saturn.jpg" },
  @{ n = '2k_saturn_ring_alpha.png';  u = $wikiSaturnRingPath; alt2 = "$base/2k_saturn_ring_alpha.png" },
  @{ n = '2k_uranus.jpg';             u = 'https://upload.wikimedia.org/wikipedia/commons/1/13/Solarsystemscope_texture_2k_uranus.jpg'; alt = "$base/2k_uranus.jpg" },
  @{ n = '2k_neptune.jpg';            u = 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Solarsystemscope_texture_2k_neptune.jpg'; alt = "$base/2k_neptune.jpg" },
  @{ n = '2k_moon.jpg';               u = "$base/2k_moon.jpg" },
  @{ n = '2k_eris.jpg';               u = "$base/2k_eris.jpg"; alt = "$base/2k_eris_fictional.jpg" },
  @{ n = '2k_haumea.jpg';             u = "$base/2k_haumea_fictional.jpg" },
  @{ n = '2k_makemake.jpg';           u = "$base/2k_makemake_fictional.jpg" },
  @{ n = '2k_ceres.jpg';              u = "$base/2k_ceres_fictional.jpg" },
  @{ n = '2k_pluto.jpg';              u = $artPluto },
  @{ n = 'earth_atmos_2048.jpg';      u = "$three/earth_atmos_2048.jpg" },
  @{ n = 'earth_normal_2048.jpg';    u = "$three/earth_normal_2048.jpg" }
)

function Save-Texture($entry) {
  $path = Join-Path $outDir $entry.n
  $urls = @($entry.u)
  if ($entry.alt) { $urls += $entry.alt }
  if ($entry.alt2) { $urls += $entry.alt2 }

  foreach ($u in $urls) {
    try {
      Invoke-WebRequest -Uri $u -OutFile $path -Headers $headers -UseBasicParsing -TimeoutSec 120
      if ((Get-Item $path).Length -gt 10000) {
        Write-Host "完成 $($entry.n)"
        return $true
      }
    } catch {
      Write-Host "尝试失败 $($entry.n) <- $u"
    }
  }
  Write-Host "失败 $($entry.n)（无可用专属源）"
  return $false
}

foreach ($f in $files) {
  Save-Texture $f | Out-Null
}
