$pairs = @(
  @{ vue='src/renderer/src/components/layout/layout.vue'; scss='src/renderer/src/components/layout/layout.scss'; base='layout.scss' },
  @{ vue='src/renderer/src/components/layout/navbar/navbar.vue'; scss='src/renderer/src/components/layout/navbar/navbar.scss'; base='navbar.scss' },
  @{ vue='src/renderer/src/components/layout/sidebar/sidebar.vue'; scss='src/renderer/src/components/layout/sidebar/sidebar.scss'; base='sidebar.scss' },
  @{ vue='src/renderer/src/components/content/mainpage/mainpage.vue'; scss='src/renderer/src/components/content/mainpage/mainpage.scss'; base='mainpage.scss' },
  @{ vue='src/renderer/src/components/content/my-music/my-music.vue'; scss='src/renderer/src/components/content/my-music/my-music.scss'; base='my-music.scss' },
  @{ vue='src/renderer/src/components/content/songsearch/songsearch.vue'; scss='src/renderer/src/components/content/songsearch/songsearch.scss'; base='songsearch.scss' },
  @{ vue='src/renderer/src/components/content/setting/setting.vue'; scss='src/renderer/src/components/content/setting/setting.scss'; base='setting.scss' },
  @{ vue='src/renderer/src/components/content/player-footer/player-footer.vue'; scss='src/renderer/src/components/content/player-footer/player-footer.scss'; base='player-footer.scss' },
  @{ vue='src/renderer/src/components/content/Myplaylist/playlistDetail.vue'; scss='src/renderer/src/components/content/Myplaylist/playlistDetail.scss'; base='playlistDetail.scss' }
)

foreach($p in $pairs){
  if(!(Test-Path $p.vue) -or !(Test-Path $p.scss)){ throw "Missing file in pair: $($p.vue) / $($p.scss)" }
  $vueText = Get-Content -Path $p.vue -Raw
  $scssText = Get-Content -Path $p.scss -Raw
  $importPattern = '@import\s+[''\"]\./' + [regex]::Escape($p.base) + '[''\"];\s*'
  if([regex]::IsMatch($vueText, $importPattern)){
    $newText = [regex]::Replace($vueText, $importPattern, { param($m) $scssText + "`r`n" }, 1)
    Set-Content -Path $p.vue -Value $newText -Encoding utf8
    Write-Output "Inlined: $($p.vue)"
  } else {
    Write-Output "Skip (already inlined): $($p.vue)"
  }
}

$deleteFiles = @(
  'src/renderer/src/components/layout/layout.scss',
  'src/renderer/src/components/layout/navbar/navbar.scss',
  'src/renderer/src/components/layout/sidebar/sidebar.scss',
  'src/renderer/src/components/content/mainpage/mainpage.scss',
  'src/renderer/src/components/content/my-music/my-music.scss',
  'src/renderer/src/components/content/songsearch/songsearch.scss',
  'src/renderer/src/components/content/setting/setting.scss',
  'src/renderer/src/components/content/player-footer/player-footer.scss',
  'src/renderer/src/components/content/Myplaylist/playlistDetail.scss',
  'src/renderer/src/components/content/playlist/songlist.scss'
)
foreach($f in $deleteFiles){ if(Test-Path $f){ Remove-Item $f -Force; Write-Output "Deleted: $f" } }
Write-Output 'SCSS inlining and cleanup completed.'
