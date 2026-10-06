$hostname = $env:COMPUTERNAME
$date = (Get-Date).ToString('[ dd:MM:yy ]:')

$log_output = $date + ' hostname requested.'

$log_output | Out-File ./agent/logs/audit.log -Append

@{
    success = $true
    data = @{
        hostname = $hostname
    }
} | ConvertTo-Json