$projectRoot = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$wsh = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $desktop "Tessera Browser.lnk"
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath = Join-Path $projectRoot "release\win-unpacked\Tessera Browser.exe"
$shortcut.WorkingDirectory = Join-Path $projectRoot "release\win-unpacked"
$shortcut.IconLocation = "$(Join-Path $projectRoot 'build\icon.ico'),0"
$shortcut.Description = "Tessera Browser for Windows"
$shortcut.Save()
Write-Host "Atalho criado com sucesso em: $lnkPath"
