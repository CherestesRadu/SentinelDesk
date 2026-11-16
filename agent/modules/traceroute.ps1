param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

$Target = $Target.Trim()
$parsedAddress = $null
$isIpAddress = [System.Net.IPAddress]::TryParse($Target, [ref]$parsedAddress)
$isDnsName = [System.Uri]::CheckHostName($Target) -eq [System.UriHostNameType]::Dns

if (-not $isIpAddress -and -not $isDnsName) {
    @{
        success = $false
        error = "Invalid IP address or hostname: $Target"
    } | ConvertTo-Json -Compress
    exit 0
}

$tracertPath = Join-Path $env:SystemRoot "System32\tracert.exe"
$traceOutput = @(& $tracertPath -d -h 20 -w 250 $Target 2>&1)
$exitCode = $LASTEXITCODE
$outputLines = @($traceOutput | ForEach-Object { [string]$_ })
$hops = @(
    foreach ($line in $outputLines) {
        if ($line -match '^\s*(?<hop>\d+)\s+(?<details>.*)$') {
            [PSCustomObject]@{
                number = [int]$Matches.hop
                details = [string]$Matches.details.Trim()
            }
        }
    }
)

try {
    $logDirectory = Join-Path $PSScriptRoot "..\logs"
    $logPath = Join-Path $logDirectory "audit.log"

    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -Path $logDirectory -ItemType Directory -Force | Out-Null
    }

    $date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')
    "$date Traceroute to $Target completed with exit code $exitCode." |
        Out-File -FilePath $logPath -Append -Encoding utf8
}
catch {
    # Logging failure should not invalidate traceroute results.
}

@{
    success = $true
    data = @{
        target = $Target
        exitCode = $exitCode
        hopCount = $hops.Count
        hops = @($hops)
        output = @($outputLines)
    }
} | ConvertTo-Json -Depth 5 -Compress
