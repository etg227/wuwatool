# wuwatool：从《鸣潮》本地日志读取唤取记录链接并复制到剪贴板。
# 只读取游戏日志，不修改、不上传任何文件。先在游戏里打开「唤取 → 唤取记录」页面，再运行。
& {
  $ErrorActionPreference = 'SilentlyContinue'
  $wwRoots = New-Object System.Collections.Generic.List[string]
  $wwMui = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache'
  foreach ($n in (Get-ItemProperty $wwMui).PSObject.Properties.Name) {
    if ($n -match '^(.*)\\Client\\Binaries\\Win64\\Client-Win64-Shipping\.exe') { $wwRoots.Add($Matches[1]) }
    elseif ($n -match '^(.*(Wuthering|鸣潮|鳴潮)[^\\]*)\\launcher\.exe') { $wwRoots.Add($Matches[1]); $wwRoots.Add($Matches[1] + '\Wuthering Waves Game') }
  }
  foreach ($k in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*') {
    foreach ($a in (Get-ItemProperty $k)) {
      if ($a.DisplayName -match 'Wuthering|鸣潮|鳴潮' -and $a.InstallLocation) { $wwRoots.Add($a.InstallLocation.TrimEnd('\')); $wwRoots.Add($a.InstallLocation.TrimEnd('\') + '\Wuthering Waves Game') }
    }
  }
  foreach ($d in (Get-PSDrive -PSProvider FileSystem).Root) {
    foreach ($p in 'Wuthering Waves\Wuthering Waves Game', 'Wuthering Waves Game', '鸣潮\Wuthering Waves Game', 'Games\Wuthering Waves\Wuthering Waves Game', 'Program Files\Wuthering Waves\Wuthering Waves Game', 'Program Files (x86)\Wuthering Waves\Wuthering Waves Game', 'Program Files\Epic Games\WutheringWavesj3oFh\Wuthering Waves Game', 'SteamLibrary\steamapps\common\Wuthering Waves\Wuthering Waves Game', 'Program Files (x86)\Steam\steamapps\common\Wuthering Waves\Wuthering Waves Game') { $wwRoots.Add($d.TrimEnd('\') + '\' + $p) }
  }
  $wwPattern = 'https://aki-gm-resources(-oversea)?\.aki-game\.(com|net)/aki/gacha/index\.html#/record\?[^\s"''<>]+'
  function Find-WwGachaUrl($roots) {
    $logs = @()
    foreach ($r in ($roots | Select-Object -Unique)) {
      $logs += Get-Item ($r + '\Client\Saved\Logs\Client.log')
      $logs += Get-ChildItem ($r + '\Client\Binaries\Win64\ThirdParty') -Recurse -Filter 'debug.log'
    }
    foreach ($f in ($logs | Where-Object { $_ } | Sort-Object LastWriteTime -Descending)) {
      $s = [IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite')
      try { $text = (New-Object IO.StreamReader($s)).ReadToEnd() } finally { $s.Close() }
      $m = [regex]::Matches($text, $wwPattern)
      if ($m.Count -gt 0) { return $m[$m.Count - 1].Value }
    }
    return $null
  }
  $wwUrl = Find-WwGachaUrl $wwRoots
  if (-not $wwUrl) {
    $wwDir = (Read-Host '没有自动找到游戏日志。请输入游戏安装目录（例如 D:\Wuthering Waves），直接回车则退出').Trim('"', ' ')
    if ($wwDir) { $wwUrl = Find-WwGachaUrl @($wwDir, ($wwDir + '\Wuthering Waves Game')) }
  }
  if ($wwUrl) {
    Set-Clipboard -Value $wwUrl
    Write-Host '已复制唤取记录链接，回到 wuwatool 抽卡记录页粘贴即可：' -ForegroundColor Green
    Write-Host $wwUrl
  } else {
    Write-Host '没有找到唤取记录链接：请先在游戏里打开「唤取 → 唤取记录」页面并等待加载，然后重新运行。' -ForegroundColor Yellow
  }
}
