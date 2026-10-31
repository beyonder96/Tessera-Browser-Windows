# Create and install local Authenticode Code Signing Certificate for Tessera Ecosystem
$certSubject = "CN=Tessera Ecosystem, O=Tessera Ecosystem, OU=Desktop Engineering"
$existing = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*Tessera Ecosystem*" }
$projectRoot = Split-Path -Parent $PSScriptRoot

if (-not $existing) {
    Write-Host "Creating new Code Signing certificate..."
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $certSubject `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5) `
        -KeyLength 2048 `
        -HashAlgorithm "SHA256"

    # Export and import into CurrentUser\Root so Windows recognizes it as a trusted publisher
    $cerPath = Join-Path $projectRoot "build\TesseraEcosystem.cer"
    Export-Certificate -Cert $cert -FilePath $cerPath -Force
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" | Out-Null
    Write-Host "Certificate installed into Root & TrustedPublisher successfully."
} else {
    $cert = $existing[0]
    Write-Host "Using existing certificate: $($cert.Thumbprint)"
}

# Sign release executables
$targets = @(
    (Join-Path $projectRoot "release\win-unpacked\Tessera Browser.exe"),
    (Join-Path $projectRoot "release\Tessera-Browser-Setup-1.0.0.exe"),
    (Join-Path $projectRoot "release\Tessera-Browser-Portable-1.0.0.exe")
)

foreach ($t in $targets) {
    if (Test-Path $t) {
        Write-Host "Signing $t ..."
        try {
            Set-AuthenticodeSignature -Certificate $cert -FilePath $t -TimestampServer "http://timestamp.digicert.com" -HashAlgorithm "SHA256" | Out-Null
        } catch {
            Set-AuthenticodeSignature -Certificate $cert -FilePath $t -HashAlgorithm "SHA256" | Out-Null
        }
        $sig = Get-AuthenticodeSignature $t
        Write-Host "  -> Result: $($sig.Status) | Signer: $($sig.SignerCertificate.Subject)"
    }
}
