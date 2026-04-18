$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\81907\Desktop'

Write-Host "Loading 5 portrait base64 strings from disk..." -ForegroundColor Cyan
$heroImg      = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\portrait_hero.b64')
$heroThumbImg = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\portrait_hero_thumb.b64')
$serviceImg   = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\portrait_service.b64')
$profileImg   = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\portrait_profile.b64')
$profileThumb = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\portrait_profile_thumb.b64')
Write-Host "  hero / hero_thumb / service / profile / profile_thumb loaded."

Write-Host "Encoding 6 NEW gallery JPGs to base64..." -ForegroundColor Cyan
function Encode-Image([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    return 'data:image/jpeg;base64,' + [Convert]::ToBase64String($bytes)
}

$gal = @{}
for ($i = 1; $i -le 6; $i++) {
    $jpgPath = ('C:\Users\81907\Desktop\image\gal{0:D2}.jpg' -f $i)
    $gal[$i] = Encode-Image $jpgPath
    $kb = [math]::Round((Get-Item $jpgPath).Length/1KB, 0)
    Write-Host ("  gal{0:D2}.jpg => {1} KB" -f $i, $kb)
}

Write-Host "`nReading new template..." -ForegroundColor Cyan
$tpl = [System.IO.File]::ReadAllText('C:\Users\81907\Desktop\lp_template.html')

Write-Host "Injecting all 11 photos..." -ForegroundColor Cyan
$out = $tpl
$out = $out.Replace('HERO_IMG_PLACEHOLDER',     $heroImg)
$out = $out.Replace('HERO_THUMB_PLACEHOLDER',   $heroThumbImg)
$out = $out.Replace('SERVICE_IMG_PLACEHOLDER',  $serviceImg)
$out = $out.Replace('PROFILE_IMG_PLACEHOLDER',  $profileImg)
$out = $out.Replace('PROFILE_THUMB_PLACEHOLDER',$profileThumb)
for ($i = 1; $i -le 6; $i++) {
    $ph = ('GAL{0:D2}_PLACEHOLDER' -f $i)
    $out = $out.Replace($ph, $gal[$i])
}

Write-Host "Writing lp.html and index.html..." -ForegroundColor Cyan
[System.IO.File]::WriteAllText('C:\Users\81907\Desktop\lp.html',    $out, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText('C:\Users\81907\Desktop\index.html', $out, [System.Text.Encoding]::UTF8)

$lpSize = [math]::Round((Get-Item 'lp.html').Length / 1KB, 0)
$ixSize = [math]::Round((Get-Item 'index.html').Length / 1KB, 0)
Write-Host ""
Write-Host ("OK  lp.html: {0} KB" -f $lpSize) -ForegroundColor Green
Write-Host ("OK  index.html: {0} KB" -f $ixSize) -ForegroundColor Green
