// test_auth.js
// Firebase Admin SDK v12+ 모듈화 구문을 적용한 인증 검증 통코드

// 1. 최신 모듈 방식: 필요한 함수만 개별적으로 가져옵니다.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// 2. ADC(Application Default Credentials)를 사용하여 앱 초기화
initializeApp({
  credential: applicationDefault(),
  projectId: 'adplanters' // 본인의 프로젝트 ID 명시
});

const db = getFirestore();

// 3. 인증 상태 검증 함수
async function verifyAuthentication() {
  try {
    console.log('🔄 Firebase 최신 SDK(v12+)를 통해 인증 상태 및 DB 접근 권한을 확인하는 중...');
    
    // DB 접근 권한 확인을 위한 컬렉션 목록 조회 시도
    await db.listCollections();
    
    console.log('\n------------------------------------------------------------');
    console.log('✅ 인증 완벽 성공! ADplanters 프로젝트에 정상적으로 연결되었습니다.');
    console.log('이제 기존의 백업 스크립트(backup_db.js)를 안심하고 실행하셔도 됩니다.');
    console.log('------------------------------------------------------------\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 인증 실패: 권한이 없거나 올바르지 않은 구글 계정으로 로그인되었습니다.');
    console.error('상세 오류:', error.message);
    process.exit(1);
  }
}

// 4. 검증 실행
verifyAuthentication();