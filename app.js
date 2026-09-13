import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const ADMIN_EMAILS = ["hhjhhj422@gmail.com", "adp@adplanters.com"];
let currentUserRole = ''; 
let currentUserName = ''; 
let currentAssignClientId = null; 

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const pendingModal = document.getElementById('pendingModal');

// Views
const statsContainer = document.getElementById('statsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const clientsContainer = document.getElementById('clientsContainer');
const approvalsContainer = document.getElementById('approvalsContainer');
const navItems = document.querySelectorAll('.nav-item');
const menuApprovals = document.getElementById('menuApprovals');
const pageTitle = document.getElementById('pageTitle');
const pageDesc = document.getElementById('pageDesc');

// Mobile UI Elements
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const mobileOverlay = document.getElementById('mobileOverlay');

// Modals
const createModal = document.getElementById('createModal');
const clientModal = document.getElementById('clientModal');
const assignModal = document.getElementById('assignModal');

// 모바일 드로어 제어
function openMobileSidebar() {
    sidebar.classList.remove('-translate-x-full');
    mobileOverlay.classList.remove('hidden');
}

function closeMobileSidebar() {
    sidebar.classList.add('-translate-x-full');
    mobileOverlay.classList.add('hidden');
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileSidebar);

// 모달 토글
document.getElementById('openModalBtn').addEventListener('click', () => createModal.classList.remove('hidden'));
document.getElementById('closeModalBtn').addEventListener('click', () => createModal.classList.add('hidden'));
document.getElementById('cancelBtn').addEventListener('click', () => createModal.classList.add('hidden'));

document.getElementById('openClientModalBtn').addEventListener('click', () => {
    document.getElementById('c_registerName').value = currentUserName;
    clientModal.classList.remove('hidden');
});
document.getElementById('closeClientModalBtn').addEventListener('click', () => clientModal.classList.add('hidden'));
document.getElementById('cancelClientBtn').addEventListener('click', () => clientModal.classList.add('hidden'));

document.getElementById('closeAssignModalBtn').addEventListener('click', () => assignModal.classList.add('hidden'));
document.getElementById('cancelAssignBtn').addEventListener('click', () => assignModal.classList.add('hidden'));

// Auth 제어
document.getElementById('googleLoginBtn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('closePendingBtn').addEventListener('click', () => { pendingModal.classList.add('hidden'); signOut(auth); });

// [1] 라우터
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
        clientsContainer.classList.add('hidden');
        approvalsContainer.classList.add('hidden');

        if (menu === 'dashboard') {
            statsContainer.classList.remove('hidden');
            tasksContainer.classList.remove('hidden');
            pageTitle.innerText = 'ADplanters x Noah 파트너십 관리 보드';
            // ★ 문구 수정 반영 ★
            pageDesc.innerText = '양사의 성공적인 프로젝트와 동반 성장을 이끄는 통합 비즈니스 협업 공간입니다.';
            fetchTasks();
        } else if (menu === 'clients') {
            clientsContainer.classList.remove('hidden');
            pageTitle.innerText = '통합 클라이언트 관리';
            pageDesc.innerText = '전체 클라이언트의 핵심 정보와 광고 일정을 관리합니다.';
            fetchClients();
        } else if (menu === 'inquiries') {
            tasksContainer.classList.remove('hidden');
            pageTitle.innerText = '업무 이슈 및 요청 리스트';
            pageDesc.innerText = '상세한 업무 내역을 확인하고 처리합니다.';
            fetchTasks();
        } else if (menu === 'approvals') {
            approvalsContainer.classList.remove('hidden');
            pageTitle.innerText = '권한 승인 관리';
            pageDesc.innerText = '신규 가입 유저의 역할을 지정하고 접속 권한을 승인합니다.';
            fetchApprovals();
        }

        closeMobileSidebar();
    });
});

// [2] 로그인 세션 & 권한 검증
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        currentUserName = user.displayName || "담당자";
        document.getElementById('inputStaff').value = currentUserName;

        if (ADMIN_EMAILS.includes(user.email)) {
            await setDoc(userRef, { email: user.email, name: currentUserName, role: "admin", status: "approved" }, { merge: true });
            currentUserRole = 'admin';
            showDashboard(user);
            return;
        }

        if (!userSnap.exists()) {
            await setDoc(userRef, { email: user.email, name: currentUserName, role: "player", status: "pending", createdAt: new Date().toISOString() });
            showPendingPopup();
        } else {
            const userData = userSnap.data();
            if (userData.status === 'approved') {
                currentUserRole = userData.role || 'player';
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

function getRoleDisplayName(role) {
    if (role === 'admin') return '최상위 관리자 (Admin)';
    if (role === 'leader') return '리더 (노아 대표)';
    return 'Player (담당 직원)';
}

function showDashboard(user) {
    loginSection.classList.add('hidden');
    pendingModal.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    document.getElementById('currentUserName').innerText = user.displayName || '사용자';
    document.getElementById('currentUserEmail').innerText = user.email;
    document.getElementById('currentUserRoleName').innerText = getRoleDisplayName(currentUserRole);
    
    if(currentUserRole === 'admin') {
        menuApprovals.classList.remove('hidden');
        const oldStyle = document.getElementById('adminStyle');
        if(oldStyle) oldStyle.remove();
    } else {
        menuApprovals.classList.add('hidden');
        if(!document.getElementById('adminStyle')) {
            const style = document.createElement('style');
            style.id = 'adminStyle';
            style.innerHTML = '.admin-only-col { display: none !important; }';
            document.head.appendChild(style);
        }
    }
    fetchTasks();
}

function showPendingPopup() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    pendingModal.classList.remove('hidden');
}

// [3] 클라이언트 DB 관리 로직
document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newClient = {
        name: document.getElementById('c_name').value,
        homeUrl: document.getElementById('c_homeUrl').value,
        instaUrl: document.getElementById('c_instaUrl').value,
        metaId: document.getElementById('c_metaId').value,
        metaPw: document.getElementById('c_metaPw').value,
        budget: document.getElementById('c_budget').value,
        instaDate: document.getElementById('c_instaDate').value,
        metaDate: document.getElementById('c_metaDate').value,
        registeredBy: document.getElementById('c_registerName').value,
        managers: [], 
        agency: document.getElementById('inputAgency').value || "noah", 
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "clients"), newClient);
        clientModal.classList.add('hidden');
        document.getElementById('clientForm').reset();
        fetchClients();
        alert("성공적으로 등록되었습니다.");
    } catch (error) {
        alert("등록 실패: " + error.message);
    }
});

async function fetchClients() {
    const tbody = document.getElementById('clientsTable');
    const emptyState = document.getElementById('emptyClients');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 데이터 로딩중...</td></tr>';

    try {
        let q = collection(db, "clients");
        if (currentUserRole === 'player') {
            q = query(collection(db, "clients"), where("managers", "array-contains", currentUserName));
        }

        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let managersHtml = '<span class="text-gray-400 text-xs">미배정</span>';
            if (data.managers && data.managers.length > 0) {
                managersHtml = data.managers.map(m => `<span class="inline-block bg-blue-50 text-noah text-[10px] px-2 py-1 rounded border border-blue-100 mr-1 mb-1 font-bold">${m}</span>`).join('');
            }

            const adminActions = currentUserRole === 'admin' ? 
                `<td class="p-3 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col">
                    <button class="open-assign-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}">담당자 연결</button>
                </td>` : `<td class="admin-only-col hidden"></td>`;

            const tr = `
                <tr class="hover:bg-orange-50/30 transition border-b border-gray-100">
                    <td class="p-3 font-black text-gray-900">${data.name}</td>
                    <td class="p-3 text-xs text-gray-500">
                        ${data.homeUrl ? `<a href="${data.homeUrl}" target="_blank" class="text-blue-500 hover:underline"><i class="fa-solid fa-link"></i> 웹</a> ` : ''}
                        ${data.instaUrl ? `<a href="${data.instaUrl}" target="_blank" class="text-pink-500 hover:underline"><i class="fa-brands fa-instagram"></i> 인스타</a>` : ''}
                    </td>
                    <td class="p-3 text-xs"><div class="text-gray-700 font-medium">ID: ${data.metaId || '-'}</div><div class="text-gray-400">PW: ${data.metaPw ? '********' : '-'}</div></td>
                    <td class="p-3 font-bold text-hermes text-xs">${data.budget || '-'}</td>
                    <td class="p-3 text-xs text-gray-600"><div>인스타: ${data.instaDate || '-'}</div><div>메타: ${data.metaDate || '-'}</div></td>
                    <td class="p-3 text-xs font-bold text-gray-500">${data.registeredBy || '-'}</td>
                    <td class="p-3 max-w-[120px] whitespace-normal">${managersHtml}</td>
                    ${adminActions}
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.open-assign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentAssignClientId = e.currentTarget.getAttribute('data-id');
                openAssignModal(currentAssignClientId);
            });
        });
    } catch (e) { console.error("Client fetch error:", e); }
}

async function openAssignModal(clientId) {
    const listContainer = document.getElementById('managerCheckboxList');
    listContainer.innerHTML = '<div class="text-center text-xs text-gray-500"><i class="fa-solid fa-spinner animate-spin"></i> 로딩중...</div>';
    assignModal.classList.remove('hidden');

    try {
        const q = query(collection(db, "users"), where("status", "==", "approved"));
        const usersSnap = await getDocs(q);
        
        const clientSnap = await getDoc(doc(db, "clients", clientId));
        const currentManagers = clientSnap.data().managers || [];

        listContainer.innerHTML = '';
        usersSnap.forEach(userDoc => {
            const uData = userDoc.data();
            const isChecked = currentManagers.includes(uData.name) ? 'checked' : '';
            const roleName = uData.role === 'admin' ? '최상위 관리자' : (uData.role === 'leader' ? '리더' : 'Player');
            
            const checkboxHtml = `
                <label class="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition border border-transparent hover:border-gray-200">
                    <input type="checkbox" value="${uData.name}" class="assign-checkbox w-4 h-4 text-hermes focus:ring-hermes border-gray-300 rounded" ${isChecked}>
                    <div>
                        <p class="text-sm font-bold text-gray-800">${uData.name} <span class="text-[10px] font-normal text-gray-400 bg-gray-100 px-1 rounded">${roleName}</span></p>
                        <p class="text-xs text-gray-500">${uData.email}</p>
                    </div>
                </label>
            `;
            listContainer.innerHTML += checkboxHtml;
        });
    } catch (e) { listContainer.innerHTML = '<div class="text-red-500 text-xs text-center">에러 발생</div>'; }
}

document.getElementById('saveAssignBtn').addEventListener('click', async () => {
    if(!currentAssignClientId) return;
    const checkboxes = document.querySelectorAll('.assign-checkbox:checked');
    const selectedManagers = Array.from(checkboxes).map(cb => cb.value);

    try {
        await updateDoc(doc(db, "clients", currentAssignClientId), { managers: selectedManagers });
        assignModal.classList.add('hidden');
        alert("성공적으로 담당자가 배정되었습니다.");
        fetchClients(); 
    } catch (error) { alert("업데이트 실패: " + error.message); }
});

// [4] 이슈 등록 및 조회 로직
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    const fileInput = document.getElementById('inputFile');
    let fileName = "";
    let fileData = "";

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileName = file.name;
        fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    const newTask = {
        client: document.getElementById('inputClient').value,
        type: document.getElementById('inputType').value,
        agency: document.getElementById('inputAgency').value,
        title: document.getElementById('inputTitle').value,
        content: document.getElementById('inputContent').value,
        fileName: fileName,
        fileData: fileData,
        staff: document.getElementById('inputStaff').value,
        status: "대기중", 
        date: dateStr
    };

    try {
        await addDoc(collection(db, "crm_tasks"), newTask);
        createModal.classList.add('hidden');
        document.getElementById('taskForm').reset();
        fetchTasks();
        alert("성공적으로 등록되었습니다.");
    } catch (error) { alert("저장 실패: " + error.message); }
});

async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 로딩중...</td></tr>';

    try {
        let fetchedData = [];
        const querySnapshot = await getDocs(collection(db, "crm_tasks"));
        
        if (currentUserRole === 'player') {
            const cQ = query(collection(db, "clients"), where("managers", "array-contains", currentUserName));
            const cSnap = await getDocs(cQ);
            const myClients = [];
            cSnap.forEach(d => myClients.push(d.data().name));

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (myClients.includes(data.client) || data.staff === currentUserName) {
                    fetchedData.push({ id: docSnap.id, ...data });
                }
            });
        } 
        else if (currentUserRole === 'leader') {
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.agency === "noah") fetchedData.push({ id: docSnap.id, ...data });
            });
        } 
        else {
            querySnapshot.forEach((docSnap) => { fetchedData.push({ id: docSnap.id, ...docSnap.data() }); });
        }

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
                : `<div class="text-center text-gray-300 text-xs admin-only-col hidden">-</div>`;

            const fileButton = item.fileData ? 
                `<a href="${item.fileData}" download="${item.fileName}" class="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 transition">
                    <i class="fa-solid fa-download text-hermes"></i> ${item.fileName}
                </a>` : `<span class="text-gray-300 text-xs">없음</span>`;

            function getBadge(status) {
                if(status==='대기중') return `<span class="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100">대기중</span>`;
                if(status==='진행중') return `<span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">진행중</span>`;
                return `<span class="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-bold border border-gray-200">완료</span>`;
            }

            const tr = `
                <tr class="hover:bg-hermes-light/30 transition group border-b border-gray-100">
                    <td class="p-3 md:p-4 font-bold text-gray-900">${item.client || '-'}</td>
                    <td class="p-3 md:p-4"><span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">${item.type || '-'}</span></td>
                    <td class="p-3 md:p-4 max-w-xs md:max-w-md">
                        <div class="font-bold text-gray-900 group-hover:text-hermes transition">${item.title || '-'}</div>
                        ${item.content ? `<div class="text-xs text-gray-500 mt-1 whitespace-pre-line bg-gray-50/80 p-2 rounded border border-gray-100">${item.content}</div>` : ''}
                    </td>
                    <td class="p-3 md:p-4">${fileButton}</td>
                    <td class="p-3 md:p-4 text-gray-500 font-medium text-xs flex items-center gap-1.5"><div class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-user"></i></div>${item.staff || '미지정'}</td>
                    <td class="p-3 md:p-4">${getBadge(item.status)}</td>
                    <td class="p-3 md:p-4 text-gray-400 text-xs font-medium">${item.date || '-'}</td>
                    <td class="p-3 md:p-4 border-l border-gray-100 bg-gray-50/50 ${currentUserRole === 'admin' ? '' : 'hidden admin-only-col'}">${adminActions}</td>
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

// [5] 유저 가입 승인 로직 (Admin 전용)
async function fetchApprovals() {
    if(currentUserRole !== 'admin') return;
    const tbody = document.getElementById('approvalsTable');
    const emptyState = document.getElementById('emptyApprovals');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 로딩 중...</td></tr>';

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
                            <option value="player">Player (담당 직원)</option>
                            <option value="leader">리더 (노아 대표)</option>
                            <option value="admin">최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-4 text-center">
                        <button class="approve-btn bg-hermes hover:bg-hermes-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm" data-uid="${docSnap.id}">승인</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const selectEl = document.querySelector(`.role-select[data-uid="${uid}"]`);
                if (confirm('선택하신 권한으로 승인하시겠습니까?')) {
                    await updateDoc(doc(db, "users", uid), { status: 'approved', role: selectEl.value });
                    alert('승인 완료되었습니다.');
                    fetchApprovals();
                }
            });
        });
    } catch (error) { console.error("유저 로드 에러:", error); }
}

// 동적 배경 워터마크
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('watermarkBox');
    if(container) {
        let html = '';
        const rowContent = `<div class="watermark-row"><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span><span><span class="wm-ad">ADPLANTERS</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span></span></div>`;
        for (let i = 0; i < 30; i++) html += rowContent;
        container.innerHTML = html;
    }
});