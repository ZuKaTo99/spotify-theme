# Richtet die vorhandenen Spotify-Verknuepfungen fuer `spicetify auto` ein.
# Die Originale bleiben unter %APPDATA%\spicetify\ZuKaToShortcutBackups erhalten.
# Aufruf: powershell -NoProfile -File tools/setup-spotify-launcher.ps1
# Rueckgaengig: powershell -NoProfile -File tools/setup-spotify-launcher.ps1 -Restore
param([switch]$Restore)

$ErrorActionPreference = 'Stop'
$spicetifyExe = Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe'
$backupDirectory = Join-Path $env:APPDATA 'spicetify\ZuKaToShortcutBackups'
$shortcuts = @(
    @{ Name = 'Desktop'; Path = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Spotify.lnk' },
    @{ Name = 'StartMenu'; Path = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Spotify.lnk' }
)

if (-not $Restore -and -not (Test-Path -LiteralPath $spicetifyExe -PathType Leaf)) {
    throw "Spicetify fehlt: $spicetifyExe"
}

$shell = New-Object -ComObject WScript.Shell
foreach ($entry in $shortcuts) {
    $shortcutPath = $entry.Path
    $backupPath = Join-Path $backupDirectory "$($entry.Name)-Spotify.lnk"
    if ($Restore) {
        if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
            Write-Host "Keine Sicherung fuer $($entry.Name) vorhanden."
            continue
        }
        Copy-Item -LiteralPath $backupPath -Destination $shortcutPath -Force
        Write-Host "Wiederhergestellt: $shortcutPath"
        continue
    }
    if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
        Write-Host "Nicht vorhanden: $shortcutPath"
        continue
    }

    $shortcut = $shell.CreateShortcut($shortcutPath)
    if ($shortcut.TargetPath -ieq $spicetifyExe -and $shortcut.Arguments -eq 'auto') {
        Write-Host "Bereits eingerichtet: $shortcutPath"
        continue
    }
    if ([IO.Path]::GetFileName($shortcut.TargetPath) -ine 'Spotify.exe') {
        throw "Unerwartetes Verknuepfungsziel, nicht geaendert: $shortcutPath -> $($shortcut.TargetPath)"
    }

    if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $shortcutPath -Destination $backupPath
    }
    $spotifyIcon = $shortcut.IconLocation
    $shortcut.TargetPath = $spicetifyExe
    $shortcut.Arguments = 'auto'
    $shortcut.WorkingDirectory = Split-Path -Path $spicetifyExe -Parent
    $shortcut.IconLocation = $spotifyIcon
    $shortcut.Description = 'Spotify mit ZuKaTo und automatischer Spicetify-Reparatur starten'
    $shortcut.Save()
    Write-Host "Eingerichtet: $shortcutPath"
}
