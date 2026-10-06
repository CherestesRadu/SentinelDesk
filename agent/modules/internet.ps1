$target = "8.8.8.8"

$date = (Get-Date).ToString('[ dd.MM.yy HH:mm:ss ]:')

$result = Test-Connection -ComputerName $target -Count 1 -Quiet

if ($result) {
    $log_output = $date + ' Internet connectivity check successful.'
    $log_output | Out-File ./agent/logs/audit.log -Append

    @{
        success = $true
        data = @{
            connected = $true
            target = $target
        }
    } | ConvertTo-Json
}
else {
    $log_output = $date + ' Internet connectivity check failed.'
    $log_output | Out-File ./agent/logs/audit.log -Append

    @{
        success = $true
        data = @{
            connected = $false
            target = $target
        }
    } | ConvertTo-Json
}