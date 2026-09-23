// backup_db.js
// Firebase Admin SDK v12+ 모듈화 구문을 적용한 완전한 DB 추출 통코드

// 1. 최신 모듈 방식: 앱 초기화 및 Firestore 객체 가져오기
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// 2. ADC(Application Default Credentials)를 사용하여 앱 초기화
initializeApp({
  credential: applicationDefault(),
  projectId: 'adplanters'
});

const db = getFirestore();

// 3. 비동기 백업 함수 정의
async function backupFirestore() {
  try {
    console.log('🔄 Firebase Firestore 최신 SDK(v12+) 기반 데이터 백업을 시작합니다...');
    
    // 모든 최상위 컬렉션 목록 가져오기
    const collections = await db.listCollections();
    const backupData = {};

    // 4. 각 컬렉션을 순회하며 데이터 무손실 추출
    for (let collection of collections) {
      console.log(`▶ 컬렉션 백업 중: [${collection.id}]`);
      const snapshot = await collection.get();
      backupData[collection.id] = {};

      snapshot.forEach(doc => {
        // 문서 ID를 Key로, 실제 데이터를 Value로 저장
        backupData[collection.id][doc.id] = doc.data();
      });
    }

    // 5. 타임스탬프 기반 파일명 생성
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0];
    const fileName = `firestore_backup_${timestamp}.json`;

    // 6. JSON 파일 로컬 저장 (들여쓰기 2칸 적용)
    fs.writeFileSync(fileName, JSON.stringify(backupData, null, 2));
    
    console.log('\n------------------------------------------------------------');
    console.log(`✅ 데이터 백업이 성공적으로 완료되었습니다!`);
    console.log(`💾 저장 위치 및 파일명: ./${fileName}`);
    console.log('------------------------------------------------------------');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 데이터 백업 중 오류가 발생했습니다:');
    console.error(error);
    process.exit(1);
  }
}

// 7. 백업 스크립트 실행
backupFirestore();