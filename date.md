# System Date and Disk Space Analysis

**Generated on:** 2026-06-22 13:54:54

## Disk Space Analysis

| Filesystem | Size | Used | Avail | Capacity | Mount Point |
|------------|------|------|-------|----------|-------------|
| /dev/disk3s3s1 | 926 GiB | 12 GiB | 741 GiB | 2% | / |
| devfs | 212 KiB | 212 KiB | 0 Bi | 100% | /dev |
| /dev/disk3s6 | 926 GiB | 5.0 GiB | 741 GiB | 1% | /System/Volumes/VM |
| /dev/disk3s4 | 926 GiB | 8.4 GiB | 741 GiB | 2% | /System/Volumes/Preboot |
| /dev/disk3s2 | 926 GiB | 42 MiB | 741 GiB | 1% | /System/Volumes/Update |
| /dev/disk1s2 | 500 MiB | 6.0 MiB | 481 MiB | 2% | /System/Volumes/xarts |
| /dev/disk1s1 | 500 MiB | 5.6 MiB | 481 MiB | 2% | /System/Volumes/iSCPreboot |
| /dev/disk1s3 | 500 MiB | 2.8 GiB | 481 MiB | 1% | /System/Volumes/Hardware |
| /dev/disk3s1 | 926 GiB | 159 GiB | 741 GiB | 18% | /System/Volumes/Data |
| map auto_home | 0 Bi | 0 Bi | 0 Bi | 100% | /System/Volumes/Data/home |
| /dev/disk5s1 | 24 MiB | 12 MiB | 11 MiB | 54% | /Volumes/Install Hermes |
| /dev/disk7s1 | 1.9 GiB | 1.5 GiB | 458 MiB | 77% | /Volumes/oMLX |

## Free Space Concerns

- **High Priority:** `/dev/disk7s1` (`/Volumes/oMLX`) is at **77% capacity** with only 458 MiB available. This should be monitored closely.

- **Medium Priority:** `/dev/disk5s1` (`/Volumes/Install Hermes`) is at **54% capacity** with only 11 MiB available. While not critical yet, this volume is relatively small and may need attention.

- **Normal Operation:** All other volumes have healthy free space levels (≤18% used).
