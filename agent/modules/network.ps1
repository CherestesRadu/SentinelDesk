
# SentinelDesk - Network Interface Diagnosis

$interfaces = @()

$adapters = @(Get-NetAdapter -ErrorAction Stop)

foreach ($adapter in $adapters) {
    $config = Get-NetIPConfiguration `
        -InterfaceIndex $adapter.ifIndex `
        -ErrorAction SilentlyContinue

    $ipv4Addresses = @(
        $config.IPv4Address |
        ForEach-Object { $_.IPAddress }
    )

    $gateways = @(
        $config.IPv4DefaultGateway |
        ForEach-Object { $_.NextHop }
    )

    $dnsServers = @(
        Get-DnsClientServerAddress `
            -InterfaceIndex $adapter.ifIndex `
            -AddressFamily IPv4 `
            -ErrorAction SilentlyContinue |
        ForEach-Object { $_.ServerAddresses }
    )

    $internet = $false
    $testAddress = $null

    if ($adapter.Status -eq "Up" -and $ipv4Addresses.Count -gt 0) {
        foreach ($ip in $ipv4Addresses) {
            $client = $null

            try {
                $client = [System.Net.Sockets.TcpClient]::new()

                $localAddress = [System.Net.IPAddress]::Parse($ip)
                $client.Client.Bind(
                    [System.Net.IPEndPoint]::new($localAddress, 0)
                )

                $task = $client.ConnectAsync(
                    [System.Net.IPAddress]::Parse("1.1.1.1"),
                    443
                )

                if ($task.Wait(2500) -and $client.Connected) {
                    $internet = $true
                    $testAddress = $ip
                    break
                }
            }
            catch {
                # This interface could not establish the TCP connection.
            }
            finally {
                if ($null -ne $client) {
                    $client.Dispose()
                }
            }
        }
    }

    $status = if ($adapter.Status -ne "Up") {
        "Disconnected"
    }
    elseif ($ipv4Addresses.Count -eq 0) {
        "No IPv4"
    }
    elseif ($internet) {
        "Internet OK"
    }
    else {
        "No internet"
    }

    $interfaces += [PSCustomObject]@{
        name       = [string]$adapter.Name
        description = [string]$adapter.InterfaceDescription
        status     = [string]$adapter.Status
        interfaceIndex = [int]$adapter.ifIndex
        macAddress = [string]$adapter.MacAddress
        ipv4       = @($ipv4Addresses)
        gateways   = @($gateways)
        dns        = @($dnsServers)
        internet   = [bool]$internet
        internetStatus = [string]$status
        testSource = $testAddress
    }
}

# Write audit entry relative to this script's location.
try {
    $logDirectory = Join-Path $PSScriptRoot "..\logs"
    $logPath = Join-Path $logDirectory "audit.log"

    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -Path $logDirectory -ItemType Directory -Force |
            Out-Null
    }

    $date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')
    "$date Network interface diagnosis completed: $($interfaces.Count) adapters." |
        Out-File -FilePath $logPath -Append -Encoding utf8
}
catch {
    # Logging failure should not invalidate diagnostic results.
}

$result = [PSCustomObject]@{
    success = $true
    data = [PSCustomObject]@{
        interfaces = @($interfaces)
        total = $interfaces.Count
        internetCount = @(
            $interfaces | Where-Object { $_.internet }
        ).Count
    }
}

$result | ConvertTo-Json -Depth 6 -Compress
