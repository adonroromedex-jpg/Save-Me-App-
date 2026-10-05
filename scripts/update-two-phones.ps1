# Run from the repository AFTER applying 20261004_chat_experience.sql and 20261005_identity_restart.sql.
$ErrorActionPreference = 'Stop'
& {
    $repo = Split-Path $PSScriptRoot -Parent
    Push-Location $repo
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci echwe.' }
        npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Prebuild echwe.' }
        Push-Location android
        try {
            .\gradlew.bat assembleRelease
            if ($LASTEXITCODE -ne 0) { throw 'Build Android echwe.' }
        } finally { Pop-Location }
        $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
        $adb = Join-Path $sdk 'platform-tools\adb.exe'
        if (!(Test-Path $adb)) { throw 'Mwen pa jwenn adb.exe.' }
        $apk = (Resolve-Path '.\android\app\build\outputs\apk\release\app-release.apk').Path
        $phones = @(& $adb devices -l | Where-Object {
            $_ -match '^\S+\s+device\s' -and $_ -match 'model:SM_S(911U1|921U)(\s|$)'
        } | ForEach-Object { ($_ -split '\s+')[0] })
        if ($phones.Count -ne 2) { & $adb devices -l; throw 'Konekte epi otorize toude telefon yo.' }
        $jobs = @(foreach ($serial in $phones) {
            Start-Job -ArgumentList $adb,$serial,$apk -ScriptBlock {
                param($adbPath,$deviceSerial,$apkPath)
                $output = & $adbPath -s $deviceSerial install -r $apkPath 2>&1
                [PSCustomObject]@{Serial=$deviceSerial;Code=$LASTEXITCODE;Output=($output -join "`n")}
            }
        })
        try { $results = @($jobs | Wait-Job | Receive-Job -ErrorAction Stop) }
        finally { $jobs | Remove-Job -Force }
        foreach ($result in $results) {
            Write-Host "$($result.Serial): $($result.Output)"
            if ($null -eq $result.Code -or $result.Code -ne 0) { throw 'Yon enstalasyon pa konfime.' }
        }
        if ($results.Count -ne 2) { throw 'Pa gen de rezilta enstalasyon.' }
        Write-Host 'Save Me 1.3.2 enstale sou toude telefon yo. Done yo konsève.'
    } finally { Pop-Location }
}
