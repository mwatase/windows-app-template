<#
  Signs one file with Authenticode. Tauri calls this for each binary and
  installer it produces, when the release workflow has configured it as the
  bundle's signCommand (see .github/workflows/release.yml).

  Two ways to sign, chosen by which secret is present:

  WINDOWS_SIGN_COMMAND
    A command line for a cloud signing service, with %1 standing for the file.
    Code signing keys issued since June 2023 live in hardware or in a cloud
    HSM and cannot be exported, so this is the usual route for a new
    certificate: Azure Artifact Signing, DigiCert KeyLocker, SSL.com eSigner.

  WINDOWS_CERTIFICATE + WINDOWS_CERTIFICATE_PASSWORD
    A base64-encoded .pfx and its password, for a certificate that can be
    exported to one.

  Usage:  pwsh -File scripts/sign-windows.ps1 <file>
#>
param(
  [Parameter(Mandatory = $true)][string]$File
)

$ErrorActionPreference = 'Stop'
$timestampServer = 'http://timestamp.digicert.com'

if (-not (Test-Path -LiteralPath $File)) { throw "Nothing to sign: $File does not exist." }

if ($env:WINDOWS_SIGN_COMMAND) {
  $command = $env:WINDOWS_SIGN_COMMAND.Replace('%1', "`"$File`"")
  Write-Host "Signing $File with the configured signing command"
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) { throw "The signing command failed with exit code $LASTEXITCODE." }
  exit 0
}

if ($env:WINDOWS_CERTIFICATE) {
  # signtool ships with the Windows SDK, which is not on PATH. Take the newest.
  $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $signtool) { throw 'signtool.exe was not found. Install the Windows SDK.' }

  $pfx = Join-Path ([IO.Path]::GetTempPath()) "sign-$([guid]::NewGuid()).pfx"
  [IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE))
  try {
    Write-Host "Signing $File with the certificate from WINDOWS_CERTIFICATE"
    # SHA-256 file digest, and an RFC 3161 timestamp so the signature stays
    # valid after the certificate itself expires.
    & $signtool.FullName sign /fd sha256 /f $pfx /p $env:WINDOWS_CERTIFICATE_PASSWORD /tr $timestampServer /td sha256 $File
    if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE." }
  }
  finally {
    Remove-Item -LiteralPath $pfx -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

Write-Host "No signing secret is set; $File stays unsigned."
