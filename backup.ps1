# ============================================================================
# ADplanters x NOAH UNIVERSE - 무손실 통합 타임스탬프 백업 스크립트 (완전 수정본)
# ============================================================================

# 0. 터미널 한글 깨짐 방지 (UTF-8 인코딩 설정)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 1. 원본 및 상위 백업 경로 지정
$sourcePath = "C:\Users\rnap1\Documents\GitHub\noahuniverse"
$parentPath = "C:\Users\rnap1\Documents\GitHub"

# 2. 고유 구분 타임스탬프 생성 (기존 백업 덮어쓰기 방지)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path -Path $parentPath -ChildPath "noahuniverse_backup_$timestamp"
$dbBackupPath = Join-Path -Path $backupPath -ChildPath "database_and_env"

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

$serviceKeyPath = Join-Path -Path$sourcePath -ChildPath "serviceAccountKey.json"
$nodeBackupScript = Join-Path -Path$sourcePath -ChildPath "backup_db.js"

# 변수 검증 및 안전한 파일 존재 확인 (Test-Path Null 오류 방지)
if (-not [string]::IsNullOrEmpty($serviceKeyPath) -and (Test-Path -LiteralPath$serviceKeyPath)) {
    if (-not [string]::IsNullOrEmpty($nodeBackupScript) -and (Test-Path -LiteralPath$nodeBackupScript)) {
        node "$nodeBackupScript" "$serviceKeyPath" "$dbBackupPath"
    } else {
        Write-Host "[경고] backup_db.js 파일이 없어 데이터베이스 추출을 건너뜁니다." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "[경고] serviceAccountKey.json 키 파일이 없어 Firebase 추출을 건너뜁니다." -ForegroundColor DarkYellow
}


# 5. Vercel 환경 변수 파일 백업 (대화형 프롬프트 자동 승인 --yes 추가)
Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [3/3] Vercel 환경 변수(.env) 다운로드..." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

Push-Location $sourcePath
try {
    # npx --yes 옵션을 통해 대화형 패키지 설치 대기 취소 현상 해결
    npx --yes vercel env pull "$dbBackupPath\.env.production.local" --yes --environment=production
    Write-Host "[완료] Vercel 환경 변수 백업 완료" -ForegroundColor Green
} catch {
    Write-Host "[알림] Vercel CLI 인증 미완료 또는 프로젝트 연동 없음으로 넘어갑니다." -ForegroundColor DarkYellow
} finally {
    Pop-Location
}


# 6. 완료 상태 리포트 출력
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " 기존 백업 보존 및 신규 백업 작성이 성공적으로 완료되었습니다!" -ForegroundColor Green
Write-Host " 생성된 저장 경로: $backupPath" -ForegroundColor Cyan
Write-Host " - 프로젝트 소스: $backupPath" -ForegroundColor White
Write-Host " - DB 및 환경변수: $dbBackupPath" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green