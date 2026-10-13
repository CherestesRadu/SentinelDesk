
# SentinelDesk - SSD / Storage Diagnosis

$warnings = @()
$disks = @()
$volumes = @()
$diskSource = "Unknown"

# 1. Read physical disks
try {
    $physicalDisks = @(Get-PhysicalDisk -ErrorAction Stop)

    if ($physicalDisks.Count -gt 0) {
        $diskSource = "Get-PhysicalDisk"

        $disks = @(
            foreach ($disk in $physicalDisks) {
                $model = [string]$disk.FriendlyName

                if ([string]::IsNullOrWhiteSpace($model)) {
                    $model = [string]$disk.Model
                }

                $mediaType = [string]$disk.MediaType
                $healthStatus = [string]$disk.HealthStatus

                if ([string]::IsNullOrWhiteSpace($mediaType) -or
                    $mediaType -eq "Unspecified") {
                    $mediaType = "Unknown"
                }

                if ([string]::IsNullOrWhiteSpace($healthStatus)) {
                    $healthStatus = "Unknown"
                }

                [PSCustomObject]@{
                    model             = $model
                    mediaType         = $mediaType
                    sizeBytes         = [double]$disk.Size
                    sizeGB            = [math]::Round(
                        [double]$disk.Size / 1GB, 2
                    )
                    healthStatus      = $healthStatus
                    operationalStatus = @(
                        $disk.OperationalStatus |
                        ForEach-Object { [string]$_ }
                    )
                    serialNumber      = [string]$disk.SerialNumber
                    busType           = [string]$disk.BusType
                }
            }
        )
    }
}
catch {
    $warnings += "Get-PhysicalDisk failed: $($_.Exception.Message)"
}

# 2. Fallback: use Windows CIM information
if ($disks.Count -eq 0) {
    try {
        $systemDisks = @(
            Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction Stop
        )

        $diskSource = "Win32_DiskDrive"

        $disks = @(
            foreach ($disk in $systemDisks) {
                $status = [string]$disk.Status

                if ([string]::IsNullOrWhiteSpace($status)) {
                    $status = "Unknown"
                }

                [PSCustomObject]@{
                    model             = [string]$disk.Model
                    mediaType         = "Unknown"
                    sizeBytes         = [double]$disk.Size
                    sizeGB            = [math]::Round(
                        [double]$disk.Size / 1GB, 2
                    )
                    healthStatus      = $status
                    operationalStatus = @($status)
                    serialNumber      = [string]$disk.SerialNumber
                    busType           = [string]$disk.InterfaceType
                }
            }
        )
    }
    catch {
        $warnings += "Win32_DiskDrive failed: $($_.Exception.Message)"
    }
}

# 3. Read volumes and calculate free space
try {
    $systemVolumes = @(
        Get-Volume -ErrorAction Stop |
        Where-Object {
            $_.DriveLetter -and $_.Size -gt 0
        }
    )

    $volumes = @(
        foreach ($volume in $systemVolumes) {
            $sizeBytes = [double]$volume.Size
            $freeBytes = [double]$volume.SizeRemaining

            [PSCustomObject]@{
                driveLetter  = "$($volume.DriveLetter):"
                label        = [string]$volume.FileSystemLabel
                fileSystem   = [string]$volume.FileSystem
                sizeGB       = [math]::Round($sizeBytes / 1GB, 2)
                freeGB       = [math]::Round($freeBytes / 1GB, 2)
                freePercent  = [math]::Round(
                    ($freeBytes / $sizeBytes) * 100, 2
                )
                healthStatus = [string]$volume.HealthStatus
            }
        }
    )
}
catch {
    $warnings += "Get-Volume failed: $($_.Exception.Message)"
}

# 4. Detect disks with reported health problems
$problemDisks = @(
    $disks | Where-Object {
        $_.healthStatus -match 'Unhealthy|Warning|Pred Fail|Error|Degraded' -or
        ($_.operationalStatus -join ' ') -match 'Error|Degraded|Lost Communication'
    }
)

# 5. Detect volumes with less than 10% free space
$lowSpaceVolumes = @(
    $volumes | Where-Object { $_.freePercent -lt 10 }
)

if ($lowSpaceVolumes.Count -gt 0) {
    $letters = ($lowSpaceVolumes.driveLetter -join ', ')
    $warnings += "Less than 10% free space on: $letters"
}

if ($disks.Count -eq 0) {
    $warnings += "No physical disks could be retrieved."
}

# 6. Determine the overall reported status
$overallHealth = "Unknown"

if ($problemDisks.Count -gt 0 -or $lowSpaceVolumes.Count -gt 0) {
    $overallHealth = "Warning"
}
elseif ($disks.Count -gt 0) {
    $unknownDisks = @(
        $disks | Where-Object {
            $_.healthStatus -notmatch '^(Healthy|OK)$'
        }
    )

    if ($unknownDisks.Count -eq 0) {
        $overallHealth = "Healthy"
    }
}

# 7. Write to the existing SentinelDesk audit log
try {
    $logDirectory = Join-Path $PSScriptRoot "..\logs"
    $logPath = Join-Path $logDirectory "audit.log"

    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -Path $logDirectory -ItemType Directory -Force |
        Out-Null
    }

    $date = (Get-Date).ToString('[ dd.MM.yyyy HH:mm:ss ]:')

    $issues = @()

    if ($disks.Count -eq 0) {
        $issues += "Keine Datenträgerinformationen verfügbar."
    }

    if ($problemDisks.Count -gt 0) {
        $issues += "$($problemDisks.Count) Datenträger melden einen problematischen Status."
    }

    if ($lowSpaceVolumes.Count -gt 0) {
        $issues += "$($lowSpaceVolumes.Count) Volume(s) haben weniger als 10% freien Speicherplatz."
    }

    if ($issues.Count -gt 0) {
        $message = "$date WARNUNG: " + ($issues -join " ")
    }
    else {
        $message = "$date Datenträgerdiagnose abgeschlossen: $($disks.Count) Datenträger, $($volumes.Count) Volume(s)."
    }

    $message | Out-File -FilePath $logPath -Append -Encoding Unicode
}
catch {
    $warnings += "Could not write audit log: $($_.Exception.Message)"
}

# 8. Return JSON for the Flask agent
$success = ($disks.Count -gt 0)
$errorMessage = $null

if (-not $success) {
    $errorMessage = "Unable to retrieve physical disk information."
}

$result = [PSCustomObject]@{
    success = $success
    error   = $errorMessage
    data    = [PSCustomObject]@{
        disks    = @($disks)
        volumes  = @($volumes)
        summary  = [PSCustomObject]@{
            diskCount     = $disks.Count
            volumeCount   = $volumes.Count
            lowSpaceCount = $lowSpaceVolumes.Count
            healthStatus  = $overallHealth
            source        = $diskSource
        }
        warnings = @($warnings)
    }
}

$result | ConvertTo-Json -Depth 6 -Compress
