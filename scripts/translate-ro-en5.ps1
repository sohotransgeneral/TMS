$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$jsonPath = Join-Path $PSScriptRoot "translations4.json"
$json = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$pairs = $json | ConvertFrom-Json

$files = Get-ChildItem -Path "actions","lib","components","app" -Recurse -Include *.ts,*.tsx -File `
    | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\|\\prisma\\seed\.ts$|\\invoice-pdf\.ts$' }

$changes = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $orig = $content
    foreach ($p in $pairs) {
        $from = $p[0]; $to = $p[1]
        $content = $content.Replace($from, $to)
    }
    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $changes++
        Write-Host ("edited: " + $file.FullName.Substring((Get-Location).Path.Length + 1))
    }
}
Write-Host "Done. Files changed: $changes"

