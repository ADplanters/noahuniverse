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
let currentEditClientId = null; // 수정 중인 클라이언트 ID
let isInitialLoginLogged = false;

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const pendingModal = document.getElementById('pendingModal');

const statsContainer = document.getElementById('statsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const clientsContainer = document.getElementById('clientsContainer');
const approvalsContainer = document.getElementById('approvalsContainer');
const logsContainer = document.getElementById('logsContainer'); 
const membersContainer = document.getElementById('membersContainer'); 
const navItems = document.querySelectorAll('.nav-item');

const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const mobileOverlay = document.getElementById('mobileOverlay');

const createModal = document.getElementById('createModal');
const clientModal = document.getElementById('clientModal');
const editClientModal = document.getElementById('editClientModal'); // 수정 모달
const assignModal = document.getElementById('assignModal');

// 활동 로그 기록 헬퍼 함수
async function logActivity(action, details = "") {
    if (!auth.currentUser) return;
    try {
        await addDoc(collection(db, "activity_logs"), {
            uid: auth.currentUser.uid,
            name: currentUserName || auth.currentUser.displayName || "Unknown",
            email: auth.currentUser.email,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Log error:", e);
    }
}

function closeMobileSidebar() {
    sidebar.classList.add('-translate-x-full');
    mobileOverlay.classList.add('hidden');
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => { sidebar.classList.remove('-translate-x-full'); mobileOverlay.classList.remove('hidden'); });
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

// 클라이언트 수정 모달 토글
document.getElementById('closeEditClientModalBtn').addEventListener('click', () => editClientModal.classList.add('hidden'));
document.getElementById('cancelEditClientBtn').addEventListener('click', () => editClientModal.classList.add('hidden'));

document.getElementById('closeAssignModalBtn').addEventListener('click', () => assignModal.classList.add('hidden'));
document.getElementById('cancelAssignBtn').addEventListener('click', () => assignModal.classList.add('hidden'));

// Auth 제어
document.getElementById('googleLoginBtn').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        logActivity("로그인", "시스템에 접속했습니다.");
    }).catch(e => console.error(e));
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logActivity("로그아웃", "시스템을 정상 종료했습니다.");
    signOut(auth);
});
document.getElementById('closePendingBtn').addEventListener('click', () => { pendingModal.classList.add('hidden'); signOut(auth); });

// 라우팅
navItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        const menuTitle = e.currentTarget.getAttribute('data-title');
        
        navItems.forEach(n => {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
        });
        e.currentTarget.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";

        statsContainer.classList.add('hidden');
        tasksContainer.classList.add('hidden');
        clientsContainer.classList.add('hidden');
        approvalsContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        membersContainer.classList.add('hidden');

        if(menu !== 'logout') {
            logActivity("메뉴 이동", `[${menuTitle}] 화면을 조회했습니다.`);
        }

        if (menu === 'dashboard') {
            statsContainer.classList.remove('hidden');
            tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'clients') {
            clientsContainer.classList.remove('hidden');
            fetchClients();
        } else if (menu === 'inquiries') {
            tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'members') {
            membersContainer.classList.remove('hidden');
            fetchMembers();
        } else if (menu === 'approvals') {
            approvalsContainer.classList.remove('hidden');
            fetchApprovals();
        } else if (menu === 'logs') {
            logsContainer.classList.remove('hidden');
            fetchLogs();
        }

        closeMobileSidebar();
    });
});

// Auth 모니터링
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        currentUserName = user.displayName || "담당자";
        document.getElementById('inputStaff').value = currentUserName;

        if(!isInitialLoginLogged) {
            logActivity("로그인", "시스템에 접속했습니다.");
            isInitialLoginLogged = true;
        }

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
        isInitialLoginLogged = false;
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
    document.getElementById('currentUserRoleName').innerText = getRoleDisplayName(currentUserRole);
    
    if(currentUserRole === 'admin') {
        document.getElementById('adminMenuSection').classList.remove('hidden');
        const oldStyle = document.getElementById('adminStyle');
        if(oldStyle) oldStyle.remove();
    } else {
        document.getElementById('adminMenuSection').classList.add('hidden');
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

// ============================================================================
// 클라이언트 DB 등록/수정/삭제 로직
// ============================================================================

// 신규 등록
document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cName = document.getElementById('c_name').value;
    const newClient = {
        name: cName,
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
        await logActivity("클라이언트 등록", `신규 클라이언트 [${cName}] 데이터 추가`);
        fetchClients();
        alert("성공적으로 등록되었습니다.");
    } catch (error) { alert("등록 실패: " + error.message); }
});

// ★ [신규] 클라이언트 수정 제출 처리 ★
document.getElementById('editClientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEditClientId) return;

    const cName = document.getElementById('edit_c_name').value;
    const updatedData = {
        name: cName,
        homeUrl: document.getElementById('edit_c_homeUrl').value,
        instaUrl: document.getElementById('edit_c_instaUrl').value,
        metaId: document.getElementById('edit_c_metaId').value,
        metaPw: document.getElementById('edit_c_metaPw').value,
        budget: document.getElementById('edit_c_budget').value,
        instaDate: document.getElementById('edit_c_instaDate').value,
        metaDate: document.getElementById('edit_c_metaDate').value
    };

    try {
        await updateDoc(doc(db, "clients", currentEditClientId), updatedData);
        editClientModal.classList.add('hidden');
        await logActivity("클라이언트 수정", `클라이언트 [${cName}] 세부 정보 수정`);
        alert("클라이언트 정보가 수정되었습니다.");
        fetchClients();
    } catch (error) {
        alert("수정 실패: " + error.message);
    }
});

// ★ [수정 및 삭제 버튼 반영된 클라이언트 목록 불러오기] ★
async function fetchClients() {
    const tbody = document.getElementById('clientsTable');
    const emptyState = document.getElementById('emptyClients');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩중...</td></tr>';

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

            // ★ 관리자(Admin) 전용 액션 버튼: 담당자 연결 / 수정 / 삭제 ★
            const adminActions = currentUserRole === 'admin' ? 
                `<td class="p-3 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col">
                    <div class="flex items-center justify-center gap-1.5">
                        <button class="open-assign-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}">담당자 연결</button>
                        <button class="edit-client-btn bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}">수정</button>
                        <button class="delete-client-btn bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold px-2 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}" data-name="${data.name}">삭제</button>
                    </div>
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

        // 담당자 연결 이벤트
        document.querySelectorAll('.open-assign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentAssignClientId = e.currentTarget.getAttribute('data-id');
                openAssignModal(currentAssignClientId);
            });
        });

        // ★ [신규] 클라이언트 수정 버튼 이벤트 ★
        document.querySelectorAll('.edit-client-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const clientId = e.currentTarget.getAttribute('data-id');
                openEditClientModal(clientId);
            });
        });

        // ★ [신규] 클라이언트 삭제 버튼 이벤트 ★
        document.querySelectorAll('.delete-client-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const clientId = e.currentTarget.getAttribute('data-id');
                const clientName = e.currentTarget.getAttribute('data-name');
                if (confirm(`정말 클라이언트 [${clientName}] 데이터를 삭제하시겠습니까?`)) {
                    try {
                        await deleteDoc(doc(db, "clients", clientId));
                        await logActivity("클라이언트 삭제", `클라이언트 [${clientName}] 영구 삭제`);
                        alert("클라이언트가 삭제되었습니다.");
                        fetchClients();
                    } catch (err) {
                        alert("삭제 실패: " + err.message);
                    }
                }
            });
        });

    } catch (e) { console.error("Client fetch error:", e); }
}

// 수정 모달 열기 및 기존 데이터 채우기
async function openEditClientModal(clientId) {
    currentEditClientId = clientId;
    try {
        const clientSnap = await getDoc(doc(db, "clients", clientId));
        if (!clientSnap.exists()) return;
        const data = clientSnap.data();

        document.getElementById('edit_c_name').value = data.name || '';
        document.getElementById('edit_c_homeUrl').value = data.homeUrl || '';
        document.getElementById('edit_c_instaUrl').value = data.instaUrl || '';
        document.getElementById('edit_c_metaId').value = data.metaId || '';
        document.getElementById('edit_c_metaPw').value = data.metaPw || '';
        document.getElementById('edit_c_budget').value = data.budget || '';
        document.getElementById('edit_c_instaDate').value = data.instaDate || '';
        document.getElementById('edit_c_metaDate').value = data.metaDate || '';

        editClientModal.classList.remove('hidden');
    } catch (err) {
        alert("데이터 불러오기 실패: " + err.message);
    }
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
        await logActivity("담당자 배정", `해당 클라이언트에 [${selectedManagers.join(", ")}] 담당자 배정`);
        alert("성공적으로 담당자가 배정되었습니다.");
        fetchClients(); 
    } catch (error) { alert("업데이트 실패: " + error.message); }
});

// 멤버 관리
async function fetchMembers() {
    if(currentUserRole !== 'admin') return;
    const tbody = document.getElementById('membersTable');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 로딩 중...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const statusBadge = user.status === 'approved' 
                ? '<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold border border-blue-100">승인완료</span>'
                : '<span class="bg-red-50 text-red-500 px-2 py-1 rounded text-[10px] font-bold border border-red-100">대기중</span>';

            const tr = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="p-3 md:p-4 font-bold text-gray-900">${user.name}</td>
                    <td class="p-3 md:p-4 text-gray-500 text-xs">${user.email}</td>
                    <td class="p-3 md:p-4">${statusBadge}</td>
                    <td class="p-3 md:p-4">
                        <select class="role-update-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player" ${user.role==='player'?'selected':''}>Player (담당 직원)</option>
                            <option value="leader" ${user.role==='leader'?'selected':''}>리더 (노아 대표)</option>
                            <option value="admin" ${user.role==='admin'?'selected':''}>최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center">
                        <button class="update-member-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm" data-uid="${docSnap.id}" data-name="${user.name}">권한수정</button>
                    </td>
                    <td class="p-3 md:p-4 text-center">
                        <button class="delete-member-btn bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm" data-uid="${docSnap.id}" data-name="${user.name}">강제탈퇴</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.update-member-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const uName = e.currentTarget.getAttribute('data-name');
                const newRole = document.querySelector(`.role-update-select[data-uid="${uid}"]`).value;
                
                if(confirm(`${uName}님의 권한을 수정하시겠습니까?`)) {
                    await updateDoc(doc(db, "users", uid), { role: newRole, status: 'approved' });
                    await logActivity("권한 변경", `[${uName}] 유저의 권한을 '${newRole}'(으)로 변경했습니다.`);
                    alert('권한이 수정되었습니다.');
                    fetchMembers();
                }
            });
        });

        document.querySelectorAll('.delete-member-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const uName = e.currentTarget.getAttribute('data-name');
                
                if(confirm(`경고: ${uName}님의 계정을 영구 삭제하시겠습니까?`)) {
                    await deleteDoc(doc(db, "users", uid));
                    await logActivity("계정 삭제", `[${uName}] 유저의 계정을 강제 탈퇴 처리했습니다.`);
                    alert('해당 계정이 삭제되었습니다.');
                    fetchMembers();
                }
            });
        });
    } catch (error) { console.error("멤버 로드 에러:", error); }
}

// 이슈/Q&A 로직
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const fileInput = document.getElementById('inputFile');
    let fileName = "", fileData = "";

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileName = file.name;
        fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    const tTitle = document.getElementById('inputTitle').value;
    const newTask = {
        client: document.getElementById('inputClient').value,
        type: document.getElementById('inputType').value,
        agency: document.getElementById('inputAgency').value,
        title: tTitle,
        content: document.getElementById('inputContent').value,
        fileName: fileName,
        fileData: fileData,
        staff: document.getElementById('inputStaff').value,
        status: "대기중", 
        date: dateStr
    };

    try {
        await addDoc(collection(db, "crm_tasks"), newTask);
        document.getElementById('createModal').classList.add('hidden');
        document.getElementById('taskForm').reset();
        await logActivity("이슈 등록", `[${newTask.client}] 신규 이슈 작성: ${tTitle}`);
        fetchTasks();
        alert("성공적으로 등록되었습니다.");
    } catch (error) { alert("저장 실패: " + error.message); }
});

async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩중...</td></tr>';

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
                `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col"><button class="delete-btn text-gray-400 hover:text-red-500 transition" data-id="${item.id}" data-t="${item.title}"><i class="fa-solid fa-trash-can"></i></button></td>` 
                : `<td class="admin-only-col hidden"></td>`;

            const fileButton = item.fileData ? 
                `<a href="${item.fileData}" download="${item.fileName}" class="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 transition"><i class="fa-solid fa-download text-hermes"></i> ${item.fileName}</a>` : `<span class="text-gray-300 text-xs">없음</span>`;

            function getBadge(status) {
                if(status==='대기중') return `<span class="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100">대기중</span>`;
                if(status==='진행중') return `<span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">진행중</span>`;
                return `<span class="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-bold border border-gray-200">완료</span>`;
            }

            const tr = `
                <tr class="hover:bg-hermes-light/30 transition group border-b border-gray-100">
                    <td class="p-3 md:p-4 font-bold text-gray-900">${item.client || '-'}</td>
                    <td class="p-3 md:p-4"><span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">${item.type || '-'}</span></td>
                    <td class="p-3 md:p-4 max-w-xs md:max-w-md"><div class="font-bold text-gray-900 group-hover:text-hermes transition">${item.title || '-'}</div>${item.content ? `<div class="text-xs text-gray-500 mt-1 whitespace-pre-line bg-gray-50/80 p-2 rounded border border-gray-100">${item.content}</div>` : ''}</td>
                    <td class="p-3 md:p-4">${fileButton}</td>
                    <td class="p-3 md:p-4 text-gray-500 font-medium text-xs flex items-center gap-1.5"><div class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-user"></i></div>${item.staff || '미지정'}</td>
                    <td class="p-3 md:p-4">${getBadge(item.status)}</td>
                    <td class="p-3 md:p-4 text-gray-400 text-xs font-medium">${item.date || '-'}</td>
                    ${adminActions}
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                const tTitle = e.currentTarget.getAttribute('data-t');
                if (confirm('삭제하시겠습니까?')) {
                    await deleteDoc(doc(db, "crm_tasks", docId));
                    await logActivity("이슈 삭제", `[${tTitle}] 항목을 삭제했습니다.`);
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

// 승인 로직
async function fetchApprovals() {
    if(currentUserRole !== 'admin') return;
    const tbody = document.getElementById('approvalsTable');
    const emptyState = document.getElementById('emptyApprovals');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩 중...</td></tr>';

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
                    <td class="p-3 md:p-4 font-bold text-gray-900">${user.name}</td>
                    <td class="p-3 md:p-4 text-gray-500 font-medium">${user.email}</td>
                    <td class="p-3 md:p-4">
                        <select class="role-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player">Player (담당 직원)</option>
                            <option value="leader">리더 (노아 대표)</option>
                            <option value="admin">최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center">
                        <button class="approve-btn bg-hermes hover:bg-hermes-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm" data-uid="${docSnap.id}" data-name="${user.name}">승인</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });

        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const uName = e.currentTarget.getAttribute('data-name');
                const selectEl = document.querySelector(`.role-select[data-uid="${uid}"]`);
                if (confirm('선택하신 권한으로 승인하시겠습니까?')) {
                    await updateDoc(doc(db, "users", uid), { status: 'approved', role: selectEl.value });
                    await logActivity("가입 승인", `[${uName}] 유저를 신규 승인(${selectEl.value}) 처리했습니다.`);
                    alert('승인 완료되었습니다.');
                    fetchApprovals();
                }
            });
        });
    } catch (error) { console.error("유저 로드 에러:", error); }
}

// 접속 및 작업 이력 모니터링
async function fetchLogs() {
    if(currentUserRole !== 'admin') return;
    const tbody = document.getElementById('logsTable');
    const emptyState = document.getElementById('emptyLogs');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로그 데이터 수집 중...</td></tr>';

    try {
        const filterSelect = document.getElementById('logUserFilter');
        if (filterSelect.options.length <= 1) {
            const usersSnap = await getDocs(collection(db, "users"));
            usersSnap.forEach(docSnap => {
                const u = docSnap.data();
                if(u.status === 'approved') {
                    const opt = document.createElement('option');
                    opt.value = u.email;
                    opt.text = `${u.name} (${u.email})`;
                    filterSelect.appendChild(opt);
                }
            });
        }

        const logsSnap = await getDocs(collection(db, "activity_logs"));
        let logs = [];
        logsSnap.forEach(docSnap => logs.push({ id: docSnap.id, ...docSnap.data() }));

        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const selectedEmail = filterSelect.value;
        if (selectedEmail !== "all") {
            logs = logs.filter(log => log.email === selectedEmail);
        }

        tbody.innerHTML = '';
        if (logs.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        emptyState.style.display = 'none';

        logs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateStr = dateObj.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false });
            
            let badgeHtml = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            if(log.action.includes('로그인')) badgeHtml = `<span class="bg-blue-50 text-blue-500 border border-blue-100 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('로그아웃')) badgeHtml = `<span class="bg-gray-50 text-gray-400 border border-gray-200 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('삭제') || log.action.includes('탈퇴')) badgeHtml = `<span class="bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('등록') || log.action.includes('승인') || log.action.includes('배정') || log.action.includes('이동') || log.action.includes('수정')) badgeHtml = `<span class="bg-hermes-light text-hermes border border-orange-200 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;

            const tr = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="p-3 md:p-4 text-xs font-medium text-gray-500 w-1/5">${dateStr}</td>
                    <td class="p-3 md:p-4 text-xs font-bold text-gray-800 w-1/5">${log.name} <span class="font-normal text-gray-400 block sm:inline mt-1 sm:mt-0">(${log.email})</span></td>
                    <td class="p-3 md:p-4 w-1/6">${badgeHtml}</td>
                    <td class="p-3 md:p-4 text-xs text-gray-600 font-medium whitespace-normal w-[40%]">${log.details || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    } catch (error) { 
        console.error("Log error:", error); 
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">데이터를 불러오지 못했습니다.</td></tr>';
    }
}
document.getElementById('logUserFilter').addEventListener('change', fetchLogs);