const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// PowerShell에서 전달받은 실행 인자 수신
const serviceAccountPath = process.argv[2] || './serviceAccountKey.json';
const outputDirPath = process.argv[3] || './database_and_env';

// 1. Firebase 인증 키 파일 존재 여부 검증
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ [오류] Firebase 인증 키(serviceAccountKey.json)를 찾을 수 없습니다: ${serviceAccountPath}`);
  process.exit(1);
}

// 2. Firebase Admin SDK 인증 초기화
const serviceAccount = require(path.resolve(serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 3. Firestore 무손실 추출 비동기 함수
async function backupFirestore() {
  try {
    console.log('🔄 Firebase Firestore 데이터 백업을 시작합니다...');
    const collections = await db.listCollections();
    const backupData = {};

    if (collections.length === 0) {
      console.log('⚠️ Firestore 데이터베이스에 존재하는 컬렉션이 없습니다.');
    }

    for (const collection of collections) {
      const colId = collection.id;
      console.log(`▶ 컬렉션 백업 중: [${colId}]`);
      backupData[colId] = {};
      const snapshot = await collection.get();

      snapshot.forEach((doc) => {
        backupData[colId][doc.id] = doc.data();
      });
      console.log(`   └ 백업 완료: ${colId} (${snapshot.size}개 문서)`);
    }

    // 저장 대상 디렉터리 존재 검사 및 자동 생성
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const outputPath = path.join(outputDirPath, 'firestore_backup.json');
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ [성공] Firestore 데이터 백업 완료: ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ [오류] Firestore 백업 처리 중 실패했습니다:', error);
    process.exit(1);
  }
}

backupFirestore();