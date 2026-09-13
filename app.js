import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyABMgjiEEqx1b4tBxl5CKQWL_3ifuVxKPI",
    authDomain: "partner-noah.firebaseapp.com",
    projectId: "partner-noah",
    storageBucket: "partner-noah.firebasestorage.app",
    messagingSenderId: "318086991323",
    appId: "1:318086991323:web:22c27ea5adc89afa9b6bfe"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 마스터 계정
const ADMIN_EMAILS = ["hhjhhj422@gmail.com", "adp@adplanters.com"];
let currentUserRole = ''; 

// DOM 요소
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const pendingModal = document.getElementById('pendingModal');
const createModal = document.getElementById('createModal');
const statsContainer = document.getElementById('statsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const approvalsContainer = document.getElementById('approvalsContainer');
const navItems = document.querySelectorAll('.nav-item');
const menuApprovals = document.getElementById('menuApprovals');
const pageTitle = document.getElementById('pageTitle');
const pageDesc = document.getElementById('pageDesc');

// 이벤트 리스너: 모달 및 로그인
document.getElementById('openModalBtn').addEventListener('click', () => createModal.classList.remove('hidden'));
document.getElementById('closeModalBtn').addEventListener('click', () => createModal.classList.add('hidden'));
document.getElementById('cancelBtn').addEventListener('click', () => createModal.classList.add('hidden'));
document.getElementById('googleLoginBtn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('closePendingBtn').addEventListener('click', () => { pendingModal.classList.add('hidden'); signOut(auth); });

// [기능 1] 좌측 메뉴 라우팅
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        
        navItems.forEach(n => {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
            if(n.id === 'menuApprovals' && currentUserRole !== 'admin') n.classList.add('hidden');
        });
        e.currentTarget.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";

        statsContainer.classList.add('hidden');
        tasksContainer.classList.add('hidden');
        approvalsContainer.classList.add('hidden');

        if (menu === 'dashboard') {
            statsContainer.classList.remove('hidden');
            tasksContainer.classList.remove('hidden');
            pageTitle.innerText = 'ADplanters x Noah 파트너십 관리 보드';
            pageDesc.innerText = 'Firebase Firestore 기반 실시간 통합 고객 관리 시스템입니다.';
            fetchTasks();
        } else if (menu === 'inquiries') {
            tasksContainer.classList.remove('hidden');
            pageTitle.innerText = '클라이언트 문의 및 요청 리스트';
            pageDesc.innerText = '상세한 이슈 내역을 확인하고 관리합니다.';
            fetchTasks();
        } else if (menu === 'approvals') {
            approvalsContainer.classList.remove('hidden');
            pageTitle.innerText = '권한 승인 관리';
            pageDesc.innerText = '신규 가입 유저의 역할을 지정하고 접속 권한을 승인합니다.';
            fetchApprovals();
        }
    });
});

// [기능 2] 인증 및 상태 모니터링
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (ADMIN_EMAILS.includes(user.email)) {
            await setDoc(userRef, { email: user.email, name: user.displayName || "대표", role: "admin", status: "approved" }, { merge: true });
            currentUserRole = 'admin';
            showDashboard(user);
            return;
        }

        if (!userSnap.exists()) {
            await setDoc(userRef, { email: user.email, name: user.displayName || "일반 유저", role: "staff", status: "pending", createdAt: new Date().toISOString() });
            showPendingPopup();
        } else {
            const userData = userSnap.data();
            if (userData.status === 'approved') {
                currentUserRole = userData.role || 'staffA';
                showDashboard(user);
            } else {
                showPendingPopup();
            }
        }
    } else {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        pendingModal.classList.add('hidden');
    }
});

function showDashboard(user) {
    loginSection.classList.add('hidden');
    pendingModal.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    document.getElementById('currentUserName').innerText = user.displayName || '사용자';
    document.getElementById('currentUserEmail').innerText = user.email;
    
    if(currentUserRole === 'admin') menuApprovals.classList.remove('hidden');
    else menuApprovals.classList.add('hidden');

    fetchTasks();
}

function showPendingPopup() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    pendingModal.classList.remove('hidden');
}

function getStatusBadge(status) {
    if (status === '대기중') return `<span class="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100">${status}</span>`;
    if (status === '진행중') return `<span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">${status}</span>`;
    if (status === '완료') return `<span class="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-bold border border-gray-200">${status}</span>`;
    return `<span>${status}</span>`;
}

// [기능 3] 게시판 데이터 읽기
async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 데이터 로딩중...</td></tr>';

    try {
        const tasksRef = collection(db, "crm_tasks");
        let q = query(tasksRef);
        
        if (currentUserRole === 'subadmin') q = query(tasksRef, where("agency", "==", "noah"));
        if (currentUserRole === 'staffA') q = query(tasksRef, where("staff", "==", "직원 A"));
        if (currentUserRole === 'staffB') q = query(tasksRef, where("staff", "==", "직원 B"));

        const querySnapshot = await getDocs(q);
        let fetchedData = [];
        querySnapshot.forEach((docSnap) => { fetchedData.push({ id: docSnap.id, ...docSnap.data() }); });
        tbody.innerHTML = '';

        if (fetchedData.length === 0) {
            emptyState.style.display = 'flex';
            updateStats([]);
            return;
        }

        emptyState.style.display = 'none';
        updateStats(fetchedData);

        fetchedData.forEach(item => {
            const adminActions = currentUserRole === 'admin' ? 
                `<div class="flex justify-center gap-2"><button class="delete-btn text-gray-400 hover:text-red-500 transition" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i></button></div>` 
                : `<div class="text-center text-gray-300 text-xs">-</div>`;

            const tr = `
                <tr class="hover:bg-hermes-light/30 transition group border-b border-gray-100">
                    <td class="p-4 font-bold text-gray-900">${item.client || '-'}</td>
                    <td class="p-4"><span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">${item.type || '-'}</span></td>
                    <td class="p-4 text-gray-700 font-medium group-hover:text-hermes transition">${item.title || '-'}</td>
                    <td class="p-4 text-gray-500 font-medium flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><i class="fa-solid fa-user"></i></div>${item.staff || '미지정'}</td>
                    <td class="p-4">${getStatusBadge(item.status)}</td>
                    <td class="p-4 text-gray-400 text-xs font-medium">${item.date || '-'}</td>
                    <td class="p-4 border-l border-gray-100 bg-gray-50/50">${adminActions}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('삭제하시겠습니까?')) {
                    await deleteDoc(doc(db, "crm_tasks", e.currentTarget.getAttribute('data-id')));
                    fetchTasks();
                }
            });
        });
    } catch (e) { console.error("Firestore error:", e); }
}

function updateStats(data) {
    document.getElementById('statTotal').innerText = data.length;
    document.getElementById('statWait').innerText = data.filter(d => d.status === '대기중').length;
    document.getElementById('statIng').innerText = data.filter(d => d.status === '진행중').length;
    document.getElementById('statDone').innerText = data.filter(d => d.status === '완료').length;
}

// [기능 4] 권한 승인 관리 조회
async function fetchApprovals() {
    if(currentUserRole !== 'admin') return;

    const tbody = document.getElementById('approvalsTable');
    const emptyState = document.getElementById('emptyApprovals');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 유저 목록 불러오는 중...</td></tr>';

    try {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-4 font-bold text-gray-900">${user.name}</td>
                    <td class="p-4 text-gray-500 font-medium">${user.email}</td>
                    <td class="p-4">
                        <select class="role-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="staffA">담당 직원 A</option>
                            <option value="staffB">담당 직원 B</option>
                            <option value="subadmin">서브 관리자 (노아)</option>
                        </select>
                    </td>
                    <td class="p-4 text-center">
                        <button class="approve-btn bg-hermes hover:bg-hermes-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg mr-1 transition shadow-sm" data-uid="${docSnap.id}">승인</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const selectEl = document.querySelector(`.role-select[data-uid="${uid}"]`);
                if (confirm('해당 유저를 승인하시겠습니까?')) {
                    await updateDoc(doc(db, "users", uid), { status: 'approved', role: selectEl.value });
                    alert('승인되었습니다.');
                    fetchApprovals();
                }
            });
        });
    } catch (error) { console.error("유저 로드 에러:", error); }
}

// [기능 5] 신규 이슈 DB 저장
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const newTask = {
        client: document.getElementById('inputClient').value,
        type: document.getElementById('inputType').value,
        agency: document.getElementById('inputAgency').value,
        title: document.getElementById('inputTitle').value,
        staff: document.getElementById('inputStaff').value,
        status: document.getElementById('inputStatus').value,
        date: dateStr
    };

    try {
        await addDoc(collection(db, "crm_tasks"), newTask);
        document.getElementById('createModal').classList.add('hidden');
        document.getElementById('taskForm').reset();
        fetchTasks();
    } catch (error) {
        alert("저장 실패: " + error.message);
    }
});

// 동적 워터마크 생성 실행
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('watermarkBox');
    if(container) {
        let html = '';
        const rowContent = `<div class="watermark-row"><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span></div>`;
        for (let i = 0; i < 30; i++) html += rowContent;
        container.innerHTML = html;
    }
});