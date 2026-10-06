param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

$Target = $Target.Trim()

$date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')

$results = Test-Connection `
    -ComputerName $Target `
    -Count 4 `
    -ErrorAction SilentlyContinue

$received = @($results).Count
$sent = 4
$lost = $sent - $received

if ($received -gt 0) {
    $average = [math]::Round(
        (($results | Measure-Object -Property ResponseTime -Average).Average),
        2
    )

    $reachable = $true
}
else {
    $average = $null
    $reachable = $false
}

$log_output = $date + " Ping $Target - $received/$sent packets received."
$log_output | Out-File ./agent/logs/audit.log -Append

@{
    success = $true
    data = @{
        target = $Target
        reachable = $reachable
        packets_sent = $sent
        packets_received = $received
        packets_lost = $lost
        loss_percent = [math]::Round(($lost / $sent) * 100, 2)
        average_ms = $average
    }
} | ConvertTo-Json -Depth 3