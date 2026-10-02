const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. PowerShell(backup.ps1) 스크립트에서 전달받는 실행 인자 수신
// process.argv[2]: serviceAccountKey.json 파일 경로
// process.argv[3]: 백업 데이터가 들어갈 타임스탬프 디렉터리 경로
const serviceAccountPath = process.argv[2] || './serviceAccountKey.json';
const outputDirPath = process.argv[3] || './database_and_env';

// 2. Firebase 서비스 계정 인증 키 파일 존재 여부 검증
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ [오류] Firebase 서비스 계정 키 파일을 찾을 수 없습니다: ${serviceAccountPath}`);
  process.exit(1);
}

// 3. Firebase Admin SDK 인증 및 Firestore 인스턴스 초기화
const serviceAccount = require(path.resolve(serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 4. Firestore 데이터베이스 100% 무손실 추출 비동기 함수
async function backupFirestore() {
  try {
    console.log('🔄 Firebase Firestore 데이터베이스 무손실 추출을 시작합니다...');
    
    // 전체 최상위 컬렉션 목록 조회
    const collections = await db.listCollections();
    const backupData = {};

    // 컬렉션 및 문서 순회 추출 (원본 데이터 1:1 보존)
    for (const collection of collections) {
      const colId = collection.id;
      console.log(`▶ 컬렉션 백업 중: [${colId}]`);
      
      backupData[colId] = {};
      const snapshot = await collection.get();

      snapshot.forEach((doc) => {
        // 문서 ID를 Key로 지정하고, 문서 내부 모든 필드 데이터를 Value로 저장
        backupData[colId][doc.id] = doc.data();
      });
      
      console.log(`   └ 백업 완료: ${colId} (${snapshot.size}개 문서 포함)`);
    }

    // 5. 백업 데이터 저장용 폴더 존재 확인 및 자동 생성
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    // 6. JSON 파일 가독성 옵션(들여쓰기 2칸)을 적용하여 안전하게 내보내기
    const outputPath = path.join(outputDirPath, 'firestore_backup.json');
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log('\n------------------------------------------------------------');
    console.log(`✅ 데이터베이스 백업이 성공적으로 completed 되었습니다!`);
    console.log(`💾 최종 저장 파일: ${outputPath}`);
    console.log('------------------------------------------------------------');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 데이터베이스 백업 진행 중 오류가 발생했습니다:');
    console.error(error);
    process.exit(1);
  }
}

// 7. 백업 함수 실행
backupFirestore();