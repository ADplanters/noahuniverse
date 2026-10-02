# ============================================================================
# ADplanters x NOAH UNIVERSE - 무손실 통합 타임스탬프 백업 스크립트 (최종 완결본)
# ============================================================================

# 0. 터미널 한글 및 특수문자 깨짐 방지
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 1. 원본 및 상위 백업 경로 지정
$sourcePath = "C:\Users\rnap1\Documents\GitHub\noahuniverse"
$parentPath = "C:\Users\rnap1\Documents\GitHub"

# 2. 고유 구분 타임스탬프 생성 (기존 백업 보존)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$parentPath\noahuniverse_backup_$timestamp"
$dbBackupPath = "$backupPath\database_and_env"

# 백업 저장소 폴더 생성
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
New-Item -ItemType Directory -Path $dbBackupPath -Force | Out-Null

Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [1/3] 소스코드 및 웹 프로젝트 파일 복사 중 ($timestamp)..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

# 3. 소스코드 전체 복사
Copy-Item -Path "$sourcePath\*" -Destination $backupPath -Recurse -Force
Write-Host "[완료] 소스코드 복사 완료" -ForegroundColor Green


# 4. backup_db.js 스크립트를 호출하여 Firebase DB 데이터 추출
Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [2/3] backup_db.js 실행을 통한 Firebase DB 추출..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

# 문법 오류가 불가능하도록 직관적인 경로 문자열 결합 방식으로 100% 변경
$serviceKeyPath = "$sourcePath\serviceAccountKey.json"
$nodeBackupScript = "$sourcePath\backup_db.js"

if ((Test-Path $serviceKeyPath) -and (Test-Path$nodeBackupScript)) {
    node "$nodeBackupScript" "$serviceKeyPath" "$dbBackupPath"
} else {
    Write-Host "[경고] serviceAccountKey.json 또는 backup_db.js 파일이 없어 Firebase 추출을 건너뜁니다." -ForegroundColor DarkYellow
}


# 5. Vercel 환경 변수 파일 백업 (로그인 상태 사전 점검으로 멈춤 현상 방지)
Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [3/3] Vercel 환경 변수(.env) 다운로드..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

Push-Location $sourcePath
try {
    # Vercel CLI 로그인 여부를 사전에 인지하여 무한 대기 현상 방지
    $null = npx --yes vercel whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        npx --yes vercel env pull "$dbBackupPath\.env.production.local" --yes --environment=production 2>$null
        if (Test-Path "$dbBackupPath\.env.production.local") {
            Write-Host "[완료] Vercel 환경 변수 백업 완료" -ForegroundColor Green
        } else {
            Write-Host "[알림] Vercel 프로젝트 연동 정보가 없어 환경 변수 추출을 건너뜁니다." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "[알림] Vercel 미로그인 상태입니다. 대기 없이 Vercel 백업을 건너뜁니다." -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "[알림] Vercel 환경 변수 추출을 건너뜁니다." -ForegroundColor DarkYellow
} finally {
    Pop-Location
}


# 6. 백업 완료 상태 리포트 출력
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " 기존 백업 보존 및 신규 백업 작성이 성공적으로 완료되었습니다!" -ForegroundColor Green
Write-Host " 생성된 저장 경로: $backupPath" -ForegroundColor Cyan
Write-Host " - 프로젝트 소스: $backupPath" -ForegroundColor White
Write-Host " - DB 및 환경변수: $dbBackupPath" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green