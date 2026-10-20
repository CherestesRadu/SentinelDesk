
$ErrorActionPreference = 'Stop'

try {
    # Windows-Speicherinformationen abrufen
    $os = Get-CimInstance -ClassName Win32_OperatingSystem

    if (-not $os) {
        throw 'Windows-Speicherinformationen konnten nicht gelesen werden.'
    }

    # Installierten RAM ermitteln
    $memoryModules = @(
        Get-CimInstance -ClassName Win32_PhysicalMemory
    )

    $installedBytes = (
        $memoryModules |
        Measure-Object -Property Capacity -Sum
    ).Sum

    # Gesamten und freien Arbeitsspeicher in KB
    $totalKB = [double]$os.TotalVisibleMemorySize
    $freeKB = [double]$os.FreePhysicalMemory

    # Fallback, falls die installierte RAM-Kapazität nicht verfügbar ist
    if (-not $installedBytes -or $installedBytes -le 0) {
        $installedBytes = $totalKB * 1024
    }

    $installedGB = [math]::Round($installedBytes / 1GB, 2)
    $totalGB = [math]::Round($totalKB / 1MB, 2)
    $availableGB = [math]::Round($freeKB / 1MB, 2)
    $usedGB = [math]::Round(($totalKB - $freeKB) / 1MB, 2)

    if ($totalKB -gt 0) {
        $usagePercent = [math]::Round(
            (($totalKB - $freeKB) / $totalKB) * 100,
            1
        )
    }
    else {
        $usagePercent = 0
    }

    $result = [ordered]@{
        success = $true
        data = [ordered]@{
            installedGB = $installedGB
            usableGB = $totalGB
            usedGB = $usedGB
            availableGB = $availableGB
            usagePercent = $usagePercent
            moduleCount = $memoryModules.Count
        }
    }

    $result | ConvertTo-Json -Depth 5 -Compress
}
catch {
    $result = [ordered]@{
        success = $false
        error = $_.Exception.Message
    }

    $result | ConvertTo-Json -Depth 5 -Compress
}
