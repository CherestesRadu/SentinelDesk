$adapter = Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4Address -and $_.NetAdapter.Status -eq "Up"
    } |
    Select-Object -First 1

if (-not $adapter) {
    @{
        success = $false
        error = "No active network adapter found"
    } | ConvertTo-Json

    exit
}

$date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')
$log_output = $date + ' network information requested.'

$log_output | Out-File ./agent/logs/audit.log -Append

$ipv4 = $adapter.IPv4Address.IPAddress
$prefixLength = $adapter.IPv4Address.PrefixLength
$gateway = $adapter.IPv4DefaultGateway.NextHop

$dnsServers = $adapter.DnsServer.ServerAddresses

@{
    success = $true
    data = @{
        interface = $adapter.InterfaceAlias
        ipv4 = $ipv4
        prefix = $prefixLength
        gateway = $gateway
        dns = $dnsServers
    }
} | ConvertTo-Json -Depth 3