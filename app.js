import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ [완벽 복구] 대표님의 원래 활성 프로젝트(partner-noah) 설정값 ★
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
let currentEditClientId = null;
let currentDetailTaskId = null; 
let currentReplyTaskId = null;
let currentEditLibId = null; // 🌟 수정 중인 라이브러리 아이템 ID
let isInitialLoginLogged = false;
let isInitialDeepLinkChecked = false; 
let tasksMap = {}; 
let libraryMap = {}; // 🌟 라이브러리 데이터 로컬 캐시
let cachedClientNames = []; 

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const pendingModal = document.getElementById('pendingModal');

const statsContainer = document.getElementById('statsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const clientsContainer = document.getElementById('clientsContainer');
const membersContainer = document.getElementById('membersContainer');
const approvalsContainer = document.getElementById('approvalsContainer');
const logsContainer = document.getElementById('logsContainer');
const libraryContainer = document.getElementById('libraryContainer'); 

const navItems = document.querySelectorAll('.nav-item');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');

const createModal = document.getElementById('createModal');
const editTaskModal = document.getElementById('editTaskModal'); 
const clientModal = document.getElementById('clientModal');
const editClientModal = document.getElementById('editClientModal');
const assignModal = document.getElementById('assignModal');
const replyModal = document.getElementById('replyModal');
const detailModal = document.getElementById('detailModal');

// 🌟 인사이트 라이브러리 전용 모달 매핑
const libraryViewModal = document.getElementById('libraryViewModal');
const libraryEditModal = document.getElementById('libraryEditModal');

function safeAddListener(id, eventType, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventType, callback);
}

function checkIsAdmin() {
    if (currentUserRole === 'admin') return true;
    if (auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email)) return true;
    return false;
}

// 다중 체크박스 UI 렌더링 함수
async function populateAssignManagerCheckboxes(containerId, selectedManagers = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const q = query(collection(db, "users"), where("status", "==", "approved"));
        const snap = await getDocs(q);
        container.innerHTML = '';
        if(snap.empty) {
            container.innerHTML = '<p class="text-xs text-gray-500 p-2">승인된 사용자가 없습니다.</p>';
            return;
        }

        const selArray = Array.isArray(selectedManagers) ? selectedManagers : (selectedManagers ? [selectedManagers] : []);

        snap.forEach(docSnap => {
            const u = docSnap.data();
            const roleLabel = u.role === 'admin' ? '최상위 관리자' : (u.role === 'leader' ? '리더' : 'Player');
            const isChecked = selArray.includes(u.name) ? 'checked' : '';
            const themeClass = containerId.includes('edit') ? 'text-blue-600 focus:ring-blue-600' : 'text-hermes focus:ring-hermes';

            container.innerHTML += `
                <label class="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition border border-transparent hover:border-gray-200">
                    <input type="checkbox" value="${u.name}" class="${containerId}-checkbox w-4 h-4 ${themeClass} border-gray-300 rounded" ${isChecked}>
                    <span class="text-xs font-bold text-gray-800">${u.name} <span class="text-[10px] font-normal text-gray-500">(${roleLabel})</span></span>
                </label>
            `;
        });
    } catch (e) { console.error("담당자 목록 로드 실패:", e); }
}

async function ensureClientNamesLoaded() {
    if (cachedClientNames.length > 0) return cachedClientNames;
    try {
        const querySnapshot = await getDocs(collection(db, "clients"));
        cachedClientNames = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.name) cachedClientNames.push(data.name);
        });
    } catch (e) { console.error("클라이언트 목록 로드 실패:", e); }
    return cachedClientNames;
}

function initClientAutocomplete(inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    if (inputEl.parentElement) inputEl.parentElement.classList.add('relative');

    let suggestBox = document.getElementById(inputId + '_suggestions');
    if (!suggestBox) {
        suggestBox = document.createElement('div');
        suggestBox.id = inputId + '_suggestions';
        suggestBox.className = 'absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto hidden divide-y divide-gray-100';
        inputEl.parentElement.appendChild(suggestBox);
    }

    const showSuggestions = async () => {
        await ensureClientNamesLoaded();
        const queryVal = inputEl.value.trim().toLowerCase();
        if (!queryVal) {
            suggestBox.classList.add('hidden');
            suggestBox.innerHTML = '';
            return;
        }

        const matches = cachedClientNames.filter(name => name.toLowerCase().includes(queryVal));
        if (matches.length === 0) {
            suggestBox.classList.add('hidden');
            suggestBox.innerHTML = '';
            return;
        }

        suggestBox.innerHTML = matches.map(name => `
            <div class="suggestion-item p-2.5 text-xs font-bold text-gray-800 hover:bg-orange-50 hover:text-hermes cursor-pointer transition flex items-center justify-between">
                <span>${name}</span>
                <span class="text-[10px] text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded">클릭하여 선택</span>
            </div>
        `).join('');

        suggestBox.classList.remove('hidden');

        suggestBox.querySelectorAll('.suggestion-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
                inputEl.value = matches[idx];
                suggestBox.classList.add('hidden');
                suggestBox.innerHTML = '';
            });
        });
    };

    inputEl.addEventListener('input', showSuggestions);
    inputEl.addEventListener('focus', showSuggestions);
    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !suggestBox.contains(e.target)) suggestBox.classList.add('hidden');
    });
}

function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

function renderFileButtons(item) {
    if (item.files && item.files.length > 0) {
        return item.files.map(f => 
            `<a href="${f.fileData}" download="${f.fileName}" class="download-link inline-flex items-center gap-1 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-[10px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 transition my-0.5"><i class="fa-solid fa-download text-hermes"></i> ${f.fileName}</a>`
        ).join(' ');
    } else if (item.fileData) {
        return `<a href="${item.fileData}" download="${item.fileName}" class="download-link inline-flex items-center gap-1 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-[10px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 transition"><i class="fa-solid fa-download text-hermes"></i> ${item.fileName}</a>`;
    }
    return `<span class="text-gray-300 text-[10px]">없음</span>`;
}

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
    } catch (e) { console.error("Log error:", e); }
}

function closeMobileSidebar() {
    if(sidebar) sidebar.classList.add('-translate-x-full');
    if(mobileOverlay) mobileOverlay.classList.add('hidden');
}

safeAddListener('mobileMenuBtn', 'click', () => { 
    if(sidebar) sidebar.classList.remove('-translate-x-full'); 
    if(mobileOverlay) mobileOverlay.classList.remove('hidden'); 
});
safeAddListener('closeSidebarBtn', 'click', closeMobileSidebar);
safeAddListener('mobileOverlay', 'click', closeMobileSidebar);

safeAddListener('openModalBtn', 'click', () => {
    ensureClientNamesLoaded();
    createModal.classList.remove('hidden');
    const assignArea = document.getElementById('assignManagerArea');
    const isAdmin = checkIsAdmin();
    if (isAdmin) {
        if (assignArea) assignArea.classList.remove('hidden');
        populateAssignManagerCheckboxes('createAssignManagerList', []);
    } else {
        if (assignArea) assignArea.classList.add('hidden');
    }
});

safeAddListener('closeModalBtn', 'click', () => createModal.classList.add('hidden'));
safeAddListener('cancelBtn', 'click', () => createModal.classList.add('hidden'));

function closeDetailModalAction() {
    detailModal.classList.add('hidden');
    const cleanUrl = window.location.pathname;
    window.history.pushState({}, '', cleanUrl);
}

safeAddListener('closeDetailModalBtn', 'click', closeDetailModalAction);
safeAddListener('closeDetailBtn', 'click', closeDetailModalAction);

safeAddListener('shareLinkBtn', 'click', () => {
    if (!currentDetailTaskId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${currentDetailTaskId}`;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("이슈 고유 주소가 클립보드에 복사되었습니다.\n\n" + shareUrl);
        }).catch(() => { fallbackCopyTextToClipboard(shareUrl); });
    } else {
        fallbackCopyTextToClipboard(shareUrl);
    }
});

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        alert("이슈 고유 주소가 복사되었습니다.\n\n" + text);
    } catch (err) { alert("복사 실패. 브라우저가 지원하지 않습니다."); }
    document.body.removeChild(textArea);
}

safeAddListener('openClientModalBtn', 'click', () => {
    const registerInput = document.getElementById('c_registerName');
    if(registerInput) registerInput.value = currentUserName;
    clientModal.classList.remove('hidden');
});
safeAddListener('closeClientModalBtn', 'click', () => clientModal.classList.add('hidden'));
safeAddListener('cancelClientBtn', 'click', () => clientModal.classList.add('hidden'));

safeAddListener('closeEditClientModalBtn', 'click', () => editClientModal.classList.add('hidden'));
safeAddListener('cancelEditClientBtn', 'click', () => editClientModal.classList.add('hidden'));

safeAddListener('closeAssignModalBtn', 'click', () => assignModal.classList.add('hidden'));
safeAddListener('cancelAssignBtn', 'click', () => assignModal.classList.add('hidden'));

safeAddListener('closeReplyModalBtn', 'click', () => replyModal.classList.add('hidden'));
safeAddListener('cancelReplyBtn', 'click', () => replyModal.classList.add('hidden'));

safeAddListener('closeEditTaskModalBtn', 'click', () => editTaskModal.classList.add('hidden'));
safeAddListener('cancelEditTaskBtn', 'click', () => editTaskModal.classList.add('hidden'));

safeAddListener('googleLoginBtn', 'click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch(e) {
        if (e.code === 'auth/popup-blocked') alert("팝업창이 차단되었습니다.");
        else if (e.code === 'auth/unauthorized-domain') alert("Firebase에 등록되지 않은 도메인입니다.");
        else alert("로그인 오류: " + e.message);
    }
});

safeAddListener('logoutBtn', 'click', async () => {
    await logActivity("로그아웃", "시스템을 정상 종료했습니다.");
    signOut(auth);
});
safeAddListener('closePendingBtn', 'click', () => { 
    if(pendingModal) pendingModal.classList.add('hidden'); 
    signOut(auth); 
});

// 🌟 [라우터] 메뉴 전환
navItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        const menuTitle = e.currentTarget.getAttribute('data-title');
        
        navItems.forEach(n => {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
        });
        e.currentTarget.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";

        if(statsContainer) statsContainer.classList.add('hidden');
        if(tasksContainer) tasksContainer.classList.add('hidden');
        if(clientsContainer) clientsContainer.classList.add('hidden');
        if(membersContainer) membersContainer.classList.add('hidden');
        if(approvalsContainer) approvalsContainer.classList.add('hidden');
        if(logsContainer) logsContainer.classList.add('hidden');
        if(libraryContainer) libraryContainer.classList.add('hidden');

        if(menu !== 'logout') logActivity("메뉴 이동", `[${menuTitle}] 화면을 조회했습니다.`);

        if (menu === 'dashboard') {
            if(statsContainer) statsContainer.classList.remove('hidden');
            if(tasksContainer) tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'clients') {
            if(clientsContainer) clientsContainer.classList.remove('hidden');
            fetchClients();
        } else if (menu === 'inquiries') {
            if(tasksContainer) tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'library') {
            if(libraryContainer) libraryContainer.classList.remove('hidden');
            fetchLibraryItems(); // 🌟 라이브러리 목록 불러오기
        } else if (menu === 'members') {
            if(membersContainer) membersContainer.classList.remove('hidden');
            fetchMembers();
        } else if (menu === 'approvals') {
            if(approvalsContainer) approvalsContainer.classList.remove('hidden');
            fetchApprovals();
        } else if (menu === 'logs') {
            if(logsContainer) logsContainer.classList.remove('hidden');
            fetchLogs();
        }
        closeMobileSidebar();
    });
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        currentUserName = user.displayName || "담당자";
        
        const staffInput = document.getElementById('inputStaff');
        if(staffInput) staffInput.value = currentUserName;

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
        if(loginSection) loginSection.classList.remove('hidden');
        if(dashboardSection) dashboardSection.classList.add('hidden');
        if(pendingModal) pendingModal.classList.add('hidden');
    }
});

function getRoleDisplayName(role) {
    if (role === 'admin') return '최상위 관리자 (Admin)';
    if (role === 'leader') return '리더 (노아 대표)';
    return 'Player (담당 직원)';
}

function showDashboard(user) {
    if(loginSection) loginSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.add('hidden');
    if(dashboardSection) dashboardSection.classList.remove('hidden');

    if(document.getElementById('currentUserName')) document.getElementById('currentUserName').innerText = user.displayName || '사용자';
    if(document.getElementById('currentUserRoleName')) document.getElementById('currentUserRoleName').innerText = getRoleDisplayName(currentUserRole);
    
    const isAdmin = checkIsAdmin();

    if(isAdmin) {
        const adminMenu = document.getElementById('adminMenuSection');
        if(adminMenu) adminMenu.classList.remove('hidden');
        const oldStyle = document.getElementById('adminStyle');
        if(oldStyle) oldStyle.remove();
        
        // Admin 전용 버튼 표시
        const openLibBtn = document.getElementById('openLibraryModalBtn');
        if(openLibBtn) openLibBtn.classList.remove('hidden');
    } else {
        const adminMenu = document.getElementById('adminMenuSection');
        if(adminMenu) adminMenu.classList.add('hidden');
        
        if(!document.getElementById('adminStyle')) {
            const style = document.createElement('style');
            style.id = 'adminStyle';
            style.innerHTML = '.admin-only-col { display: none !important; }';
            document.head.appendChild(style);
        }
    }

    initClientAutocomplete('inputClient');
    initClientAutocomplete('editTaskClient');
    fetchTasks();
}

function showPendingPopup() {
    if(loginSection) loginSection.classList.remove('hidden');
    if(dashboardSection) dashboardSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.remove('hidden');
}

safeAddListener('clientForm', 'submit', async (e) => {
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
        agency: document.getElementById('inputAgency') ? document.getElementById('inputAgency').value : "noah", 
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "clients"), newClient);
        clientModal.classList.add('hidden');
        document.getElementById('clientForm').reset();
        await logActivity("클라이언트 등록", `신규 클라이언트 [${cName}] 데이터 생성`);
        cachedClientNames = [];
        fetchClients();
        alert("성공적으로 등록되었습니다.");
    } catch (error) { alert("등록 실패: " + error.message); }
});

safeAddListener('editClientForm', 'submit', async (e) => {
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
        cachedClientNames = [];
        fetchClients();
    } catch (error) { alert("수정 실패: " + error.message); }
});

async function fetchClients() {
    const tbody = document.getElementById('clientsTable');
    const emptyState = document.getElementById('emptyClients');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩중...</td></tr>';

    try {
        let q = collection(db, "clients");
        if (currentUserRole === 'player') {
            q = query(collection(db, "clients"), where("managers", "array-contains", currentUserName));
        }

        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }
        if(emptyState) emptyState.style.display = 'none';

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let managersHtml = '<span class="text-gray-400 text-xs">미배정</span>';
            if (data.managers && data.managers.length > 0) {
                managersHtml = data.managers.map(m => `<span class="inline-block bg-blue-50 text-noah text-[10px] px-2 py-1 rounded border border-blue-100 mr-1 mb-1 font-bold">${m}</span>`).join('');
            }

            const isAdmin = checkIsAdmin();
            const adminActions = isAdmin ? 
                `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle">
                    <div class="flex items-center justify-center gap-1.5">
                        <button class="open-assign-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}">배정</button>
                        <button class="edit-client-btn bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}">수정</button>
                        <button class="delete-client-btn bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm" data-id="${docSnap.id}" data-name="${data.name}">삭제</button>
                    </div>
                </td>` : `<td class="admin-only-col hidden"></td>`;

            const tr = `
                <tr class="hover:bg-orange-50/30 transition border-b border-gray-100">
                    <td class="p-3 md:p-4 font-black text-gray-900 align-middle">${data.name}</td>
                    <td class="p-3 md:p-4 text-xs text-gray-500 align-middle">
                        ${data.homeUrl ? `<a href="${data.homeUrl}" target="_blank" class="text-blue-500 hover:underline"><i class="fa-solid fa-link"></i> 웹</a> ` : ''}
                        ${data.instaUrl ? `<a href="${data.instaUrl}" target="_blank" class="text-pink-500 hover:underline"><i class="fa-brands fa-instagram"></i> 인스타</a>` : ''}
                    </td>
                    <td class="p-3 md:p-4 text-xs align-middle">
                        <div class="text-gray-700 font-medium">ID: ${data.metaId || '-'}</div>
                        <div class="text-gray-900 font-bold flex items-center gap-1 mt-0.5">
                            PW: ${data.metaPw || '-'}
                            ${data.metaPw ? `<button onclick="event.stopPropagation(); navigator.clipboard.writeText('${data.metaPw}'); alert('비밀번호가 복사되었습니다.');" class="text-[10px] text-gray-400 hover:text-blue-600 underline cursor-pointer ml-1" title="비밀번호 복사">복사</button>` : ''}
                        </div>
                    </td>
                    <td class="p-3 md:p-4 font-bold text-hermes text-xs align-middle">${data.budget || '-'}</td>
                    <td class="p-3 md:p-4 text-xs text-gray-600 align-middle"><div>인스타: ${data.instaDate || '-'}</div><div>메타: ${data.metaDate || '-'}</div></td>
                    <td class="p-3 md:p-4 text-xs font-bold text-gray-500 align-middle">${data.registeredBy || '-'}</td>
                    <td class="p-3 md:p-4 max-w-[120px] whitespace-normal align-middle">${managersHtml}</td>
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

        document.querySelectorAll('.edit-client-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                currentEditClientId = e.currentTarget.getAttribute('data-id');
                const clientSnap = await getDoc(doc(db, "clients", currentEditClientId));
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
            });
        });

        document.querySelectorAll('.delete-client-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const clientId = e.currentTarget.getAttribute('data-id');
                const clientName = e.currentTarget.getAttribute('data-name');
                if (confirm(`정말 클라이언트 [${clientName}] 데이터를 삭제하시겠습니까?`)) {
                    await deleteDoc(doc(db, "clients", clientId));
                    await logActivity("클라이언트 삭제", `클라이언트 [${clientName}] 영구 삭제 처리`);
                    cachedClientNames = [];
                    fetchClients();
                }
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

safeAddListener('saveAssignBtn', 'click', async () => {
    if(!currentAssignClientId) return;
    const checkboxes = document.querySelectorAll('.assign-checkbox:checked');
    const selectedManagers = Array.from(checkboxes).map(cb => cb.value);

    try {
        await updateDoc(doc(db, "clients", currentAssignClientId), { managers: selectedManagers });
        assignModal.classList.add('hidden');
        await logActivity("담당자 배정", `선택된 클라이언트에 [${selectedManagers.join(", ")}] 담당자 배정`);
        alert("성공적으로 담당자가 배정되었습니다.");
        fetchClients(); 
    } catch (error) { alert("업데이트 실패: " + error.message); }
});

safeAddListener('taskForm', 'submit', async (e) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const fileInput = document.getElementById('inputFile');
    let filesArr = [];

    if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            if (file.size >= 1048576) {
                alert(`[${file.name}] 파일 용량이 1MB를 초과합니다.`);
                return;
            }
            let fileData = "";
            if (file.type.startsWith('image/')) {
                try { fileData = await compressImage(file, 1200, 0.7); } 
                catch (err) { alert("이미지 압축 처리 실패: " + err.message); return; }
            } else {
                fileData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
            filesArr.push({ fileName: file.name, fileData: fileData });
        }
    }

    const tTitle = document.getElementById('inputTitle').value;
    const isAdmin = checkIsAdmin();
    
    let assignedManagersArr = [];
    if (isAdmin) {
        const checkboxes = document.querySelectorAll('.createAssignManagerList-checkbox:checked');
        assignedManagersArr = Array.from(checkboxes).map(cb => cb.value);
    }

    const newTask = {
        client: document.getElementById('inputClient').value,
        type: document.getElementById('inputType').value,
        agency: document.getElementById('inputAgency').value,
        title: tTitle,
        content: document.getElementById('inputContent').value,
        files: filesArr,
        staff: document.getElementById('inputStaff').value,
        assignedManagers: assignedManagersArr,
        status: "답변대기", 
        date: dateStr,
        comments: [] 
    };

    try {
        await addDoc(collection(db, "crm_tasks"), newTask);
        createModal.classList.add('hidden');
        document.getElementById('taskForm').reset();
        const selNameEl = document.getElementById('selectedFileName');
        if (selNameEl) selNameEl.innerText = "선택된 파일 없음";
        await logActivity("이슈 등록", `[${newTask.client}] 신규 게시글 작성: ${tTitle}`);
        fetchTasks();
        alert("게시글이 성공적으로 등록되었습니다.");
    } catch (error) { alert("저장 실패: " + error.message); }
});

async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩중...</td></tr>';

    try {
        let fetchedData = [];
        const querySnapshot = await getDocs(collection(db, "crm_tasks"));
        tasksMap = {}; 
        
        if (currentUserRole === 'player') {
            const cQ = query(collection(db, "clients"), where("managers", "array-contains", currentUserName));
            const cSnap = await getDocs(cQ);
            const myClients = [];
            cSnap.forEach(d => myClients.push(d.data().name));

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                let isAssigned = false;
                if (Array.isArray(data.assignedManagers)) {
                    isAssigned = data.assignedManagers.includes(currentUserName);
                } else if (data.assignedManager === currentUserName) { 
                    isAssigned = true;
                }

                if (myClients.includes(data.client) || data.staff === currentUserName || isAssigned) {
                    const tItem = { id: docSnap.id, ...data };
                    fetchedData.push(tItem);
                    tasksMap[docSnap.id] = tItem;
                }
            });
        } 
        else {
            querySnapshot.forEach((docSnap) => { 
                const tItem = { id: docSnap.id, ...docSnap.data() };
                fetchedData.push(tItem);
                tasksMap[docSnap.id] = tItem;
            });
        }

        fetchedData.sort((a, b) => {
            const dateA = a.date ? new Date(a.date.replace(/\./g, '-')) : 0;
            const dateB = b.date ? new Date(b.date.replace(/\./g, '-')) : 0;
            return dateB - dateA;
        });

        tbody.innerHTML = '';
        if (fetchedData.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            updateStats([]);
            return;
        }

        if(emptyState) emptyState.style.display = 'none';
        updateStats(fetchedData);

        let rowsHtml = '';
        const isAdmin = checkIsAdmin();

        fetchedData.forEach(item => {
            const adminActions = isAdmin ? 
                `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle">
                    <button class="delete-task-btn bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2.5 py-1.5 rounded transition shadow-sm text-xs font-bold" data-id="${item.id}" data-t="${item.title}"><i class="fa-solid fa-trash-can"></i> 삭제</button>
                </td>` : `<td class="admin-only-col hidden"></td>`;

            const fileButton = renderFileButtons(item);

            function getBadge(status) {
                if(status === '답변대기' || status === '대기중') return `<span class="text-red-500 font-bold border border-red-200 bg-red-50 px-2 py-0.5 rounded text-[11px]">답변대기</span>`;
                if(status === '진행중') return `<span class="text-blue-500 font-bold border border-blue-200 bg-blue-50 px-2 py-0.5 rounded text-[11px]">진행중</span>`;
                return `<span class="text-gray-600 font-bold border border-gray-200 bg-gray-100 px-2 py-0.5 rounded text-[11px]">답변완료</span>`;
            }

            const commentCount = item.comments ? item.comments.length : 0;

            let assignedStr = "";
            if (Array.isArray(item.assignedManagers) && item.assignedManagers.length > 0) {
                assignedStr = item.assignedManagers.join(', ');
            } else if (item.assignedManager) {
                assignedStr = item.assignedManager;
            }

            const staffDisplay = assignedStr 
                ? `${item.staff || '미지정'} <span class="text-hermes font-bold text-[10px] block sm:inline sm:ml-1">(담당: ${assignedStr})</span>`
                : (item.staff || '미지정');

            rowsHtml += `
                <tr class="hover:bg-hermes-light/30 transition group border-b border-gray-100 cursor-pointer task-detail-trigger" data-id="${item.id}">
                    <td class="p-3 md:p-4 font-bold text-gray-900 align-middle text-xs">${item.client || '-'}</td>
                    <td class="p-3 md:p-4 align-middle"><span class="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-bold">${item.type || '-'}</span></td>
                    <td class="p-3 md:p-4 align-middle">
                        <div class="font-bold text-gray-900 group-hover:text-hermes transition flex items-center gap-1">
                            <span class="truncate max-w-[150px] sm:max-w-xs">${item.title || '-'}</span> 
                            ${commentCount > 0 ? `<span class="text-hermes text-[10px] font-black">[${commentCount}]</span>` : ''}
                        </div>
                    </td>
                    <td class="p-3 md:p-4 align-middle">${fileButton}</td>
                    <td class="p-3 md:p-4 align-middle whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                            <div class="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] flex-shrink-0"><i class="fa-solid fa-user"></i></div>
                            <span class="text-gray-600 font-medium text-[11px]">${staffDisplay}</span>
                        </div>
                    </td>
                    <td class="p-3 md:p-4 align-middle text-center">${getBadge(item.status)}</td>
                    <td class="p-3 md:p-4 align-middle text-gray-400 text-[11px] font-medium">${item.date || '-'}</td>
                    ${adminActions}
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;

        if (!isInitialDeepLinkChecked) {
            const urlParams = new URLSearchParams(window.location.search);
            const sharedTaskId = urlParams.get('id');
            if (sharedTaskId) {
                if (tasksMap[sharedTaskId]) {
                    openDetailModal(sharedTaskId);
                } else {
                    alert("요청하신 이슈를 찾을 수 없거나 접근 권한이 없습니다.");
                }
            }
            isInitialDeepLinkChecked = true;
        }

    } catch (e) { console.error("Firestore error:", e); }
}

const boardTableEl = document.getElementById('boardTable');
if (boardTableEl) {
    boardTableEl.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-task-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const docId = deleteBtn.getAttribute('data-id');
            const tTitle = deleteBtn.getAttribute('data-t');
            if (confirm('게시글을 완전히 삭제하시겠습니까?')) {
                try {
                    await deleteDoc(doc(db, "crm_tasks", docId));
                    await logActivity("게시글 삭제", `[${tTitle}] 게시글 영구 삭제`);
                    fetchTasks();
                } catch(err) { alert('삭제 실패: ' + err.message); }
            }
            return;
        }

        if (e.target.closest('.download-link')) {
            e.stopPropagation();
            return;
        }

        const row = e.target.closest('.task-detail-trigger');
        if (row) {
            const taskId = row.getAttribute('data-id');
            if (taskId) {
                openDetailModal(taskId);
            }
        }
    });
}

function updateStats(data) {
    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = data.length;
    if(document.getElementById('statWait')) document.getElementById('statWait').innerText = data.filter(d => d.status === '답변대기' || d.status === '대기중').length;
    if(document.getElementById('statIng')) document.getElementById('statIng').innerText = data.filter(d => d.status === '진행중').length;
    if(document.getElementById('statDone')) document.getElementById('statDone').innerText = data.filter(d => d.status === '답변완료' || d.status === '완료').length;
}

function openDetailModal(taskId) {
    const task = tasksMap[taskId];
    if(!task) return;
    
    currentDetailTaskId = taskId;
    
    const newUrl = `${window.location.pathname}?id=${taskId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    document.getElementById('detailTitle').innerText = task.title || '제목 없음';
    document.getElementById('detailType').innerText = task.type || 'Q&A';
    document.getElementById('detailClient').innerText = task.client || '-';
    document.getElementById('detailStaff').innerText = task.staff || '미지정';
    
    let assignedStr = "";
    if (Array.isArray(task.assignedManagers) && task.assignedManagers.length > 0) {
        assignedStr = task.assignedManagers.join(', ');
    } else if (task.assignedManager) {
        assignedStr = task.assignedManager;
    }
    document.getElementById('detailAssignManager').innerText = assignedStr ? assignedStr : '미지정';
    
    document.getElementById('detailDate').innerText = task.date || '-';
    document.getElementById('detailAgency').innerText = task.agency === 'noah' ? '노아유니버스' : '애드플랜터스';
    document.getElementById('detailContent').innerText = task.content || '등록된 상세 내용이 없습니다.';

    const statusEl = document.getElementById('detailStatus');
    if(task.status === '답변대기' || task.status === '대기중') statusEl.innerHTML = `<span class="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-red-100">답변대기</span>`;
    else if(task.status === '진행중') statusEl.innerHTML = `<span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-100">진행중</span>`;
    else statusEl.innerHTML = `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-gray-200">답변완료</span>`;

    const fileBtnArea = document.getElementById('detailFileBtn');
    if ((task.files && task.files.length > 0) || task.fileData) {
        fileBtnArea.innerHTML = renderFileButtons(task);
    } else {
        fileBtnArea.innerHTML = `<span class="text-gray-400 text-xs">첨부파일이 없습니다.</span>`;
    }

    const actionArea = document.getElementById('authorActionArea');
    const editBtn = document.getElementById('detailEditBtn');
    const deleteBtn = document.getElementById('detailDeleteBtn');
    let canShowAction = false;
    
    if(currentUserName === task.staff) {
        editBtn.classList.remove('hidden');
        canShowAction = true;
    } else {
        editBtn.classList.add('hidden');
    }

    const isAdmin = checkIsAdmin();
    if(isAdmin) {
        deleteBtn.classList.remove('hidden');
        canShowAction = true;
        document.getElementById('adminStatusChangeArea').classList.remove('hidden');
        let selStatus = task.status;
        if(selStatus==='대기중') selStatus='답변대기';
        if(selStatus==='완료') selStatus='답변완료';
        document.getElementById('adminStatusSelect').value = selStatus || '답변대기';
    } else {
        deleteBtn.classList.add('hidden');
        document.getElementById('adminStatusChangeArea').classList.add('hidden');
    }

    if(canShowAction) actionArea.classList.remove('hidden');
    else actionArea.classList.add('hidden');

    renderComments(task.comments || []);

    detailModal.classList.remove('hidden');
    logActivity("상세 조회", `[${task.title}] 상세 내용을 조회했습니다.`);
}

function renderComments(commentsArr) {
    const list = document.getElementById('commentList');
    document.getElementById('commentCount').innerText = commentsArr.length;
    list.innerHTML = '';
    
    if(commentsArr.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">등록된 댓글이 없습니다.</p>';
        return;
    }

    commentsArr.forEach(c => {
        const isAdmin = c.role === 'admin' || c.role === 'leader';
        const bgClass = isAdmin ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100';
        const nameColor = isAdmin ? 'text-noah' : 'text-gray-800';
        const icon = isAdmin ? '<i class="fa-solid fa-crown text-[10px] text-yellow-500 mr-1"></i>' : '';

        list.innerHTML += `
            <div class="${bgClass} border p-3 rounded-xl">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs font-bold ${nameColor}">${icon}${c.author} <span class="text-[10px] text-gray-400 font-normal">(${c.role})</span></span>
                    <span class="text-[10px] text-gray-400">${c.date}</span>
                </div>
                <p class="text-xs text-gray-700 whitespace-pre-line">${c.text}</p>
            </div>
        `;
    });
    list.scrollTop = list.scrollHeight;
}

safeAddListener('submitCommentBtn', 'click', async () => {
    if(!currentDetailTaskId) return;
    const task = tasksMap[currentDetailTaskId];
    const textInput = document.getElementById('commentInput');
    const text = textInput.value.trim();
    if(!text) { alert('댓글 내용을 입력해 주세요.'); return; }

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newComment = {
        author: currentUserName,
        role: currentUserRole,
        date: dateStr,
        text: text
    };

    const updatedComments = [...(task.comments || []), newComment];
    let updatePayload = { comments: updatedComments };
    
    const isAdmin = checkIsAdmin();
    if(isAdmin) {
        updatePayload.status = document.getElementById('adminStatusSelect').value;
    }

    try {
        await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), updatePayload);
        textInput.value = '';
        await logActivity("댓글 등록", `[${task.title}] 게시물에 소통 댓글 작성`);
        
        task.comments = updatedComments;
        if(isAdmin) task.status = updatePayload.status;
        
        openDetailModal(currentDetailTaskId); 
        fetchTasks(); 
    } catch (e) { alert("댓글 등록 실패: " + e.message); }
});

safeAddListener('detailDeleteBtn', 'click', async () => {
    if(!currentDetailTaskId) return;
    const task = tasksMap[currentDetailTaskId];
    if(confirm('게시글을 영구적으로 삭제하시겠습니까?')) {
        try {
            await deleteDoc(doc(db, "crm_tasks", currentDetailTaskId));
            closeDetailModalAction(); 
            await logActivity("게시글 삭제", `[${task.title}] 영구 삭제 완료`);
            alert('삭제되었습니다.');
            fetchTasks();
        } catch(e) { alert('삭제 실패: '+e.message); }
    }
});

safeAddListener('detailEditBtn', 'click', async () => {
    if(!currentDetailTaskId) return;
    const task = tasksMap[currentDetailTaskId];
    
    document.getElementById('editTaskClient').value = task.client || '';
    document.getElementById('editTaskType').value = task.type || 'Q&A';
    document.getElementById('editTaskAgency').value = task.agency || 'noah';
    document.getElementById('editTaskTitle').value = task.title || '';
    document.getElementById('editTaskContent').value = task.content || '';
    
    const editAssignArea = document.getElementById('editAssignManagerArea');
    const isAdmin = checkIsAdmin();

    if (isAdmin) {
        if (editAssignArea) editAssignArea.classList.remove('hidden');
        const legacyVal = task.assignedManager;
        const currentArr = task.assignedManagers || [];
        const combinedSel = currentArr.length > 0 ? currentArr : (legacyVal ? [legacyVal] : []);
        await populateAssignManagerCheckboxes('editAssignManagerList', combinedSel);
    } else {
        if (editAssignArea) editAssignArea.classList.add('hidden');
    }

    const fileLabel = (task.files && task.files.length > 0) 
        ? task.files.map(f => f.fileName).join(', ') 
        : (task.fileName || '없음');
    document.getElementById('currentAttachedFile').innerText = fileLabel;
    
    detailModal.classList.add('hidden');
    editTaskModal.classList.remove('hidden');
});

safeAddListener('editTaskForm', 'submit', async (e) => {
    e.preventDefault();
    if(!currentDetailTaskId) return;
    const task = tasksMap[currentDetailTaskId];
    
    const fileInput = document.getElementById('editTaskFile');
    let finalFilesArr = task.files || [];
    if (task.fileData && finalFilesArr.length === 0) {
        finalFilesArr = [{ fileName: task.fileName, fileData: task.fileData }];
    }

    if (fileInput.files.length > 0) {
        let newFilesArr = [];
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            if (file.size >= 1048576) { alert(`[${file.name}] 용량이 1MB를 초과합니다.`); return; }
            
            let fileData = "";
            if (file.type.startsWith('image/')) {
                try { fileData = await compressImage(file, 1200, 0.7); } 
                catch (err) { alert("압축 실패"); return; }
            } else {
                fileData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
            newFilesArr.push({ fileName: file.name, fileData: fileData });
        }
        finalFilesArr = newFilesArr;
    }

    const updatedTask = {
        client: document.getElementById('editTaskClient').value,
        type: document.getElementById('editTaskType').value,
        agency: document.getElementById('editTaskAgency').value,
        title: document.getElementById('editTaskTitle').value,
        content: document.getElementById('editTaskContent').value,
        files: finalFilesArr
    };

    const isAdmin = checkIsAdmin();
    if (isAdmin) {
        const checkboxes = document.querySelectorAll('.editAssignManagerList-checkbox:checked');
        updatedTask.assignedManagers = Array.from(checkboxes).map(cb => cb.value);
        updatedTask.assignedManager = ""; 
    }

    try {
        await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), updatedTask);
        editTaskModal.classList.add('hidden');
        closeDetailModalAction(); 
        await logActivity("게시글 수정", `[${updatedTask.title}] 본문 및 담당자 수정 처리`);
        alert("수정되었습니다.");
        fetchTasks();
    } catch(e) { alert("수정 실패: " + e.message); }
});

// ============================================================================
// 🌟 [신규 추가] 인사이트 라이브러리 (HTML 커스텀 페이지 & DB CRUD 관리)
// ============================================================================

// 라이브러리 아이템 불러오기 (초기 데이터 시드 자동 생성 포함)
async function fetchLibraryItems() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 라이브러리 데이터를 로딩 중입니다...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, "crm_library"));
        libraryMap = {};
        let libList = [];

        // DB가 비어있는 경우 최초 시드 데이터 자동 등록
        if (querySnapshot.empty) {
            await seedDefaultLibraryItems();
            return fetchLibraryItems();
        }

        querySnapshot.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            libList.push(item);
            libraryMap[docSnap.id] = item;
        });

        // 생성일 정렬
        libList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        grid.innerHTML = '';
        const isAdmin = checkIsAdmin();

        libList.forEach(item => {
            const adminBtns = isAdmin ? `
                <div class="flex items-center gap-1.5 ml-auto">
                    <button class="edit-lib-btn text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition" data-id="${item.id}">수정</button>
                    <button class="delete-lib-btn text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition" data-id="${item.id}" data-title="${item.title}">삭제</button>
                </div>
            ` : '';

            const pdfBtn = item.pdfUrl ? `
                <a href="${item.pdfUrl}" target="_blank" download class="px-3 py-1.5 bg-gray-50 hover:bg-hermes hover:text-white text-hermes text-xs font-bold rounded-lg border border-gray-200 transition shadow-sm flex items-center gap-1.5">
                    <i class="fa-solid fa-download"></i> PDF
                </a>
            ` : '';

            grid.innerHTML += `
                <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col cursor-pointer lib-card-trigger" data-id="${item.id}">
                    <div class="h-36 bg-gray-50 relative overflow-hidden flex items-center justify-center border-b border-gray-100">
                        <div class="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-transparent"></div>
                        <i class="${item.iconClass || 'fa-solid fa-file-lines text-hermes'} text-5xl group-hover:scale-110 transition duration-300"></i>
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <div class="mb-3 flex items-center justify-between">
                            <span class="inline-block px-2.5 py-1 bg-orange-50 text-hermes text-[10px] font-bold rounded-md border border-orange-100">${item.category || '가이드'}</span>
                            ${adminBtns}
                        </div>
                        <h3 class="font-black text-gray-900 mb-2 leading-snug group-hover:text-hermes transition">${item.title}</h3>
                        <p class="text-xs text-gray-500 mb-5 line-clamp-2 leading-relaxed flex-1">${item.desc}</p>
                        <div class="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                            <button class="text-xs font-bold text-gray-600 hover:text-hermes transition flex items-center gap-1.5"><i class="fa-solid fa-book-open"></i> HTML 열람</button>
                            ${pdfBtn}
                        </div>
                    </div>
                </div>
            `;
        });

        // 카드 클릭 시 HTML 열람 모달 오픈 이벤트 연결
        document.querySelectorAll('.lib-card-trigger').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.edit-lib-btn') || e.target.closest('.delete-lib-btn') || e.target.closest('a')) return;
                const libId = card.getAttribute('data-id');
                openLibraryViewModal(libId);
            });
        });

        // 관리자 전용 수정 버튼 이벤트
        document.querySelectorAll('.edit-lib-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const libId = btn.getAttribute('data-id');
                openLibraryEditModal(libId);
            });
        });

        // 관리자 전용 삭제 버튼 이벤트
        document.querySelectorAll('.delete-lib-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const libId = btn.getAttribute('data-id');
                const title = btn.getAttribute('data-title');
                if (confirm(`정말 [${title}] 콘텐츠를 삭제하시겠습니까?`)) {
                    try {
                        await deleteDoc(doc(db, "crm_library", libId));
                        alert('삭제되었습니다.');
                        fetchLibraryItems();
                    } catch(err) { alert('삭제 실패: ' + err.message); }
                }
            });
        });

    } catch (e) {
        console.error("Library fetch error:", e);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-500 font-bold">라이브러리 데이터를 불러오지 못했습니다.</div>';
    }
}

// 초기 기본 시드 데이터 자동 로딩
async function seedDefaultLibraryItems() {
    const seeds = [
        {
            category: "퍼포먼스 마케팅",
            iconClass: "fa-brands fa-meta text-blue-600",
            title: "메타(Meta) 광고 100% 활용 가이드",
            desc: "페이스북과 인스타그램 스폰서드 광고의 장점과 머신러닝 최적화 원리, 타겟팅 기법을 담은 필수 지침서입니다.",
            pdfUrl: "",
            htmlContent: `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-gray-900 border-b pb-2">1. 왜 머신러닝 기반 메타광고인가?</h2>
                    <p>메타(Meta) 광고는 단순 타겟팅을 넘어 AI 알고리즘이 구매 가능성이 가장 높은 잠재고객을 찾아내는 강력한 솔루션입니다.</p>
                    <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 my-3">
                        <h4 class="font-bold text-blue-900 mb-1">💡 핵심 성과 공식</h4>
                        <p class="text-xs text-blue-800">고품질 소재(이미지/숏폼) + 타겟 세분화 + 메타 픽셀 데이터 연동 = ROAS 극대화</p>
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 border-b pb-2 mt-6">2. 성공을 위한 3단계 세팅법</h2>
                    <ul class="list-disc pl-5 space-y-1 text-xs text-gray-700">
                        <li>맞춤 타겟(Custom Audience) 및 유사 타겟(Lookalike) 설계</li>
                        <li>소재 A/B 테스트를 통한 반응률 최상 조합 추출</li>
                        <li>랜딩페이지 전환 추적 픽셀 실시간 피드백 루프 구축</li>
                    </ul>
                </div>
            `,
            createdAt: new Date().toISOString()
        },
        {
            category: "웹 기획/개발",
            iconClass: "fa-solid fa-laptop-code text-gray-800",
            title: "매출을 부르는 홈페이지 제작의 이유",
            desc: "단순한 온라인 명함을 넘어, 방문한 고객을 설득하고 실제 전환(DB 수집/결제)을 이끌어내는 랜딩페이지 구축 전략 리포트.",
            pdfUrl: "",
            htmlContent: `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-gray-900 border-b pb-2">온라인 이탈률을 70% 낮추는 랜딩페이지의 조건</h2>
                    <p>아무리 광고비를 많이 써도, 도착한 웹사이트가 부실하면 고객은 3초 만에 이탈합니다.</p>
                    <div class="bg-orange-50 p-4 rounded-xl border border-orange-200 my-3">
                        <h4 class="font-bold text-hermes mb-1">🔥 필수 구성 요소</h4>
                        <p class="text-xs text-gray-700">1. 직관적인 메인 카피라이팅<br>2. 고객 후기 및 신뢰 자산(인증서/특허)<br>3. 즉각적인 문의하기(CTA) 버튼 배치</p>
                    </div>
                </div>
            `,
            createdAt: new Date().toISOString()
        },
        {
            category: "SEO 최적화",
            iconClass: "fa-solid fa-map-location-dot text-green-600",
            title: "네이버 스마트플레이스 1페이지 노출 원리",
            desc: "트래픽, 체류시간, 저장하기 등 네이버 알고리즘이 사랑하는 플레이스 세팅 및 관리 핵심 노하우.",
            pdfUrl: "",
            htmlContent: `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-gray-900 border-b pb-2">스마트플레이스 상위노출 핵심 지표 분석</h2>
                    <p>네이버 지도 검색 최상단 노출은 오프라인 매장 및 지역 기반 비즈니스 매출의 80%를 결정짓습니다.</p>
                    <div class="bg-green-50 p-4 rounded-xl border border-green-200 my-3">
                        <h4 class="font-bold text-green-900 mb-1">📌 지수 상승 4대 요소</h4>
                        <p class="text-xs text-green-800">대표 키워드 세팅 + 영수증/방문자 리뷰 + 사용자 저장/길찾기 유입 + 최신 소식 업데이트</p>
                    </div>
                </div>
            `,
            createdAt: new Date().toISOString()
        }
    ];

    for (const seed of seeds) {
        await addDoc(collection(db, "crm_library"), seed);
    }
}

// HTML 상세 보기 모달 오픈
function openLibraryViewModal(id) {
    const item = libraryMap[id];
    if (!item) return;

    document.getElementById('libViewCategory').innerText = item.category || '가이드';
    document.getElementById('libViewTitle').innerText = item.title;
    
    // 🌟 커스텀 HTML 파싱 렌더링
    document.getElementById('libViewHtmlContent').innerHTML = item.htmlContent || '<p>등록된 상세 내용이 없습니다.</p>';

    const pdfBtn = document.getElementById('libViewPdfBtn');
    if (item.pdfUrl) {
        pdfBtn.href = item.pdfUrl;
        pdfBtn.classList.remove('hidden');
    } else {
        pdfBtn.classList.add('hidden');
    }

    libraryViewModal.classList.remove('hidden');
    logActivity("라이브러리 열람", `[${item.title}] 가이드북 HTML 열람`);
}

// 관리자 작성/수정 모달 오픈
function openLibraryEditModal(id = null) {
    currentEditLibId = id;
    const form = document.getElementById('libraryForm');
    form.reset();

    if (id && libraryMap[id]) {
        const item = libraryMap[id];
        document.getElementById('libFormCategory').value = item.category || '';
        document.getElementById('libFormIcon').value = item.iconClass || '';
        document.getElementById('libFormTitle').value = item.title || '';
        document.getElementById('libFormDesc').value = item.desc || '';
        document.getElementById('libFormPdfUrl').value = item.pdfUrl || '';
        document.getElementById('libFormHtmlContent').value = item.htmlContent || '';
    }

    libraryEditModal.classList.remove('hidden');
}

// 라이브러리 모달 이벤트 바인딩
safeAddListener('openLibraryModalBtn', 'click', () => openLibraryEditModal(null));
safeAddListener('closeLibViewModalBtn', 'click', () => libraryViewModal.classList.add('hidden'));
safeAddListener('closeLibViewBtn', 'click', () => libraryViewModal.classList.add('hidden'));
safeAddListener('closeLibEditModalBtn', 'click', () => libraryEditModal.classList.add('hidden'));
safeAddListener('cancelLibEditBtn', 'click', () => libraryEditModal.classList.add('hidden'));

// 라이브러리 저장 이벤트 핸들러
safeAddListener('libraryForm', 'submit', async (e) => {
    e.preventDefault();
    const payload = {
        category: document.getElementById('libFormCategory').value.trim(),
        iconClass: document.getElementById('libFormIcon').value.trim() || 'fa-solid fa-file-lines text-hermes',
        title: document.getElementById('libFormTitle').value.trim(),
        desc: document.getElementById('libFormDesc').value.trim(),
        pdfUrl: document.getElementById('libFormPdfUrl').value.trim(),
        htmlContent: document.getElementById('libFormHtmlContent').value,
        createdAt: new Date().toISOString()
    };

    try {
        if (currentEditLibId) {
            await updateDoc(doc(db, "crm_library", currentEditLibId), payload);
            await logActivity("라이브러리 수정", `[${payload.title}] 가이드북 수정`);
            alert("수정되었습니다.");
        } else {
            await addDoc(collection(db, "crm_library"), payload);
            await logActivity("라이브러리 등록", `[${payload.title}] 신규 가이드북 생성`);
            alert("등록되었습니다.");
        }
        libraryEditModal.classList.add('hidden');
        fetchLibraryItems();
    } catch(err) {
        alert("저장 실패: " + err.message);
    }
});

// 멤버 관리 (Admin 전용)
async function fetchMembers() {
    const isAdmin = checkIsAdmin();
    if(!isAdmin) return;
    const tbody = document.getElementById('membersTable');
    if(!tbody) return;
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
                    <td class="p-3 md:p-4 font-bold text-gray-900 align-middle">${user.name}</td>
                    <td class="p-3 md:p-4 text-gray-500 text-xs align-middle">${user.email}</td>
                    <td class="p-3 md:p-4 align-middle">${statusBadge}</td>
                    <td class="p-3 md:p-4 align-middle">
                        <select class="role-update-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player" ${user.role==='player'?'selected':''}>Player (담당 직원)</option>
                            <option value="leader" ${user.role==='leader'?'selected':''}>리더 (노아 대표)</option>
                            <option value="admin" ${user.role==='admin'?'selected':''}>최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle">
                        <button class="update-member-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm" data-uid="${docSnap.id}" data-name="${user.name}">권한수정</button>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle">
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
                    await logActivity("권한 변경", `[${uName}] 유저의 권한을 '${newRole}'(으)로 변경`);
                    fetchMembers();
                    alert('권한이 수정되었습니다.');
                }
            });
        });

        document.querySelectorAll('.delete-member-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                const uName = e.currentTarget.getAttribute('data-name');
                if(confirm(`경고: ${uName}님의 계정을 영구 삭제하시겠습니까?`)) {
                    await deleteDoc(doc(db, "users", uid));
                    await logActivity("계정 삭제", `[${uName}] 유저 계정 강제 탈퇴 처리`);
                    fetchMembers();
                    alert('해당 계정이 삭제되었습니다.');
                }
            });
        });
    } catch (error) { console.error("멤버 로드 에러:", error); }
}

// 신규 가입 승인 관리 (Admin 전용)
async function fetchApprovals() {
    const isAdmin = checkIsAdmin();
    if(!isAdmin) return;
    const tbody = document.getElementById('approvalsTable');
    const emptyState = document.getElementById('emptyApprovals');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩 중...</td></tr>';

    try {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }

        if(emptyState) emptyState.style.display = 'none';
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-3 md:p-4 font-bold text-gray-900 align-middle">${user.name}</td>
                    <td class="p-3 md:p-4 text-gray-500 font-medium align-middle">${user.email}</td>
                    <td class="p-3 md:p-4 align-middle">
                        <select class="role-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player">Player (담당 직원)</option>
                            <option value="leader">리더 (노아 대표)</option>
                            <option value="admin">최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle">
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
                    fetchApprovals();
                    alert('승인 완료되었습니다.');
                }
            });
        });
    } catch (error) { console.error("유저 로드 에러:", error); }
}

// 접속 및 작업 이력 로그 모니터링 (Admin 전용)
async function fetchLogs() {
    const isAdmin = checkIsAdmin();
    if(!isAdmin) return;
    const tbody = document.getElementById('logsTable');
    const emptyState = document.getElementById('emptyLogs');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로그 데이터 수집 중...</td></tr>';

    try {
        const filterSelect = document.getElementById('logUserFilter');
        if (filterSelect && filterSelect.options.length <= 1) {
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

        const selectedEmail = filterSelect ? filterSelect.value : 'all';
        if (selectedEmail !== "all") {
            logs = logs.filter(log => log.email === selectedEmail);
        }

        tbody.innerHTML = '';
        if (logs.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }
        if(emptyState) emptyState.style.display = 'none';

        logs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateStr = dateObj.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false });
            
            let badgeHtml = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            if(log.action.includes('로그인')) badgeHtml = `<span class="bg-blue-50 text-blue-500 border border-blue-100 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('로그아웃')) badgeHtml = `<span class="bg-gray-50 text-gray-400 border border-gray-200 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('삭제') || log.action.includes('탈퇴')) badgeHtml = `<span class="bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;
            else if(log.action.includes('등록') || log.action.includes('승인') || log.action.includes('배정') || log.action.includes('이동') || log.action.includes('수정') || log.action.includes('조회') || log.action.includes('댓글')) badgeHtml = `<span class="bg-hermes-light text-hermes border border-orange-200 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span>`;

            const tr = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="p-3 md:p-4 text-xs font-medium text-gray-500 w-1/5 align-middle">${dateStr}</td>
                    <td class="p-3 md:p-4 text-xs font-bold text-gray-800 w-1/5 align-middle">${log.name} <span class="font-normal text-gray-400 block sm:inline mt-1 sm:mt-0">(${log.email})</span></td>
                    <td class="p-3 md:p-4 w-1/6 align-middle">${badgeHtml}</td>
                    <td class="p-3 md:p-4 text-xs text-gray-600 font-medium whitespace-normal w-[40%] align-middle">${log.details || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    } catch (error) { 
        console.error("Log error:", error); 
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">데이터를 불러오지 못했습니다.</td></tr>';
    }
}

if(document.getElementById('logUserFilter')) {
    document.getElementById('logUserFilter').addEventListener('change', fetchLogs);
}