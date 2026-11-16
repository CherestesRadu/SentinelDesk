$hostname = $env:COMPUTERNAME
$date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')

$log_output = $date + ' hostname requested.'

$log_output | Out-File ./agent/logs/audit.log -Append -Encoding utf8

@{
    success = $true
    data = @{
        hostname = $hostname
    }
} | ConvertTo-Json