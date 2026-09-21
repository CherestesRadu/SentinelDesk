$hostname = $env:COMPUTERNAME

@{
    success = $true
    data = @{
        hostname = $hostname
    }
} | ConvertTo-Json