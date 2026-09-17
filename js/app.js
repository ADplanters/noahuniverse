import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ============================================================================
// 1. Firebase ADplanters 프로젝트 최신 인증 키 및 초기화
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCwKR7IiuasOe9bPd7vKyp4aa_VmGjhXzQ",
    authDomain: "adplanters.firebaseapp.com",
    projectId: "adplanters",
    storageBucket: "adplanters.firebasestorage.app",
    messagingSenderId: "13377832038",
    appId: "1:13377832038:web:94a285ac7bbe96c5f2d9a7",
    measurementId: "G-TKQRR1QKRG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

// 어드민 이메일 및 전역 상태 데이터
const ADMIN_EMAILS = ["hhjhhj422@gmail.com", "adp@adplanters.com"];
let currentUserRole = ''; 
let currentUserName = ''; 
let currentAssignClientId = null; 
let currentEditClientId = null;
let currentDetailTaskId = null; 
let currentEditLibId = null; 
let currentViewLibId = null; 
let isInitialLoginLogged = false;
let isInitialDeepLinkChecked = false; 
let tasksMap = {}; 
let libraryMap = {}; 
let cachedClientNames = []; 

// ============================================================================
// 2. DOM 요소 바인딩
// ============================================================================
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
const detailModal = document.getElementById('detailModal');

const libraryViewModal = document.getElementById('libraryViewModal');
const libraryEditModal = document.getElementById('libraryEditModal');

// ============================================================================
// 3. 공통 유틸리티 및 Helper 함수
// ============================================================================
function safeAddListener(id, eventType, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventType, callback);
}

function checkIsAdmin() {
    if (currentUserRole === 'admin') return true;
    if (auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email)) return true;
    return false;
}

// Firebase Storage 원본 파일 업로드 (용량 한도 제한 방지)
async function uploadFilesToStorage(fileList, folderName) {
    const uploadedFiles = [];
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const uniqueFileName = `${Date.now()}_${Math.floor(Math.random()*1000)}_${file.name}`;
        const storageReference = ref(storage, `${folderName}/${uniqueFileName}`);
        
        try {
            await uploadBytes(storageReference, file);
            const downloadUrl = await getDownloadURL(storageReference);
            uploadedFiles.push({ 
                fileName: file.name, 
                fileUrl: downloadUrl 
            });
        } catch (error) {
            console.error("Storage 업로드 오류:", error);
            throw new Error(`[${file.name}] 파일 업로드 처리에 실패했습니다.`);
        }
    }
    return uploadedFiles;
}

// 첨부파일 다운로드 UI 버튼 생성
function renderFileButtons(item) {
    if (item.files && item.files.length > 0) {
        return item.files.map(f => {
            const url = f.fileUrl || f.fileData; 
            return `<a href="${url}" target="_blank" download="${f.fileName}" class="download-link inline-flex items-center gap-1 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-[10px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 transition my-0.5 shadow-sm"><i class="fa-solid fa-download text-hermes"></i> ${f.fileName}</a>`;
        }).join(' ');
    }
    return `<span class="text-gray-300 text-[10px]">첨부파일 없음</span>`;
}

// 활동 로그 기록
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

// 클립보드 복사 헬퍼
function copyToClipboard(text, label = "링크") {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label}가 클립보드에 복사되었습니다.\n\n` + text);
        });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`${label}가 클립보드에 복사되었습니다.\n\n` + text);
    }
}

// ============================================================================
// 4. 인증 및 사용자 권한 제어 (이메일 기반 신규 UID 자동 연동)
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        currentUserName = user.displayName || "담당자";
        
        const staffInput = document.getElementById('inputStaff');
        if(staffInput) staffInput.value = currentUserName;

        if(!isInitialLoginLogged) {
            logActivity("로그인", "시스템에 성공적으로 접속했습니다.");
            isInitialLoginLogged = true;
        }

        // 1. ADMIN_EMAILS 목록 지정 관리자 자동 승인
        if (ADMIN_EMAILS.includes(user.email)) {
            await setDoc(userRef, { email: user.email, name: currentUserName, role: "admin", status: "approved" }, { merge: true });
            currentUserRole = 'admin';
            showDashboard(user);
            return;
        }

        // 2. 현재 새 UID 문서가 없는 경우: 이전된 이메일 데이터 찾아서 자동 연동
        if (!userSnap.exists()) {
            const q = query(collection(db, "users"), where("email", "==", user.email));
            const qSnap = await getDocs(q);
            
            if (!qSnap.empty) {
                const oldDoc = qSnap.docs[0];
                const oldData = oldDoc.data();
                
                // 기존 데이터 기반으로 새 UID 문서 생성
                await setDoc(userRef, { 
                    ...oldData, 
                    uid: user.uid,
                    updatedAt: new Date().toISOString()
                });

                // 구 UID 문서가 별도로 존재한다면 정리
                if (oldDoc.id !== user.uid) {
                    await deleteDoc(doc(db, "users", oldDoc.id));
                }
                
                currentUserRole = oldData.role || 'player';
                
                // 기존 승인 유저만 대시보드 진입, 대기 상태 유저는 대기 팝업 노출
                if (oldData.status === 'approved') {
                    showDashboard(user);
                } else {
                    showPendingPopup();
                }
                return;
            }

            // 완전 신규 가입자만 대기 상태로 새로 생성
            await setDoc(userRef, { 
                email: user.email, 
                name: currentUserName, 
                role: "player", 
                status: "pending", 
                createdAt: new Date().toISOString() 
            });
            showPendingPopup();
        } else {
            // 이미 새 UID 문서가 존재하는 유저 처리
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

function showDashboard(user) {
    if(loginSection) loginSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.add('hidden');
    if(dashboardSection) dashboardSection.classList.remove('hidden');

    if(document.getElementById('currentUserName')) document.getElementById('currentUserName').innerText = user.displayName || '사용자';
    if(document.getElementById('currentUserRoleName')) {
        const roleLabel = currentUserRole === 'admin' ? '최상위 관리자 (Admin)' : (currentUserRole === 'leader' ? '리더 (노아 대표)' : 'Player (담당 직원)');
        document.getElementById('currentUserRoleName').innerText = roleLabel;
    }
    
    const isAdmin = checkIsAdmin();
    if(isAdmin) {
        const adminMenu = document.getElementById('adminMenuSection');
        if(adminMenu) adminMenu.classList.remove('hidden');
        const openLibBtn = document.getElementById('openLibraryModalBtn');
        if(openLibBtn) openLibBtn.classList.remove('hidden');
    } else {
        const adminMenu = document.getElementById('adminMenuSection');
        if(adminMenu) adminMenu.classList.add('hidden');
    }

    fetchTasks();
}

function showPendingPopup() {
    if(loginSection) loginSection.classList.remove('hidden');
    if(dashboardSection) dashboardSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.remove('hidden');
}

// ============================================================================
// 5. 업무 이슈/요청 게시판
// ============================================================================
safeAddListener('taskForm', 'submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#taskForm button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "파일 업로드 및 저장 중...";
    submitBtn.disabled = true;

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const fileInput = document.getElementById('inputFile');
    
    let filesArr = [];
    try {
        if (fileInput.files.length > 0) {
            filesArr = await uploadFilesToStorage(fileInput.files, "crm_tasks");
        }
    } catch (error) {
        alert(error.message);
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        return;
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
        await logActivity("이슈 등록", `[${newTask.client}] 신규 이슈 작성: ${tTitle}`);
        fetchTasks();
        alert("이슈가 성공적으로 등록되었습니다.");
    } catch (error) { 
        alert("DB 저장 오류: " + error.message); 
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩 중...</td></tr>';

    try {
        let fetchedData = [];
        const querySnapshot = await getDocs(collection(db, "crm_tasks"));
        tasksMap = {}; 
        
        querySnapshot.forEach((docSnap) => { 
            const tItem = { id: docSnap.id, ...docSnap.data() };
            fetchedData.push(tItem);
            tasksMap[docSnap.id] = tItem;
        });

        fetchedData.sort((a, b) => new Date(b.date.replace(/\./g, '-')) - new Date(a.date.replace(/\./g, '-')));

        tbody.innerHTML = '';
        if (fetchedData.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }

        if(emptyState) emptyState.style.display = 'none';

        let rowsHtml = '';
        const isAdmin = checkIsAdmin();

        fetchedData.forEach(item => {
            const adminActions = isAdmin ? 
                `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle">
                    <button class="delete-task-btn bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2.5 py-1.5 rounded transition shadow-sm text-xs font-bold" data-id="${item.id}" data-t="${item.title}"><i class="fa-solid fa-trash-can"></i> 삭제</button>
                </td>` : `<td class="admin-only-col hidden"></td>`;

            const fileButton = renderFileButtons(item);
            const commentCount = item.comments ? item.comments.length : 0;

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
                    <td class="p-3 md:p-4 align-middle text-xs">${item.staff || '미지정'}</td>
                    <td class="p-3 md:p-4 align-middle text-center"><span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">${item.status || '답변대기'}</span></td>
                    <td class="p-3 md:p-4 align-middle text-gray-400 text-[11px] font-medium">${item.date || '-'}</td>
                    ${adminActions}
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;

        if (!isInitialDeepLinkChecked) {
            const urlParams = new URLSearchParams(window.location.search);
            const sharedTaskId = urlParams.get('id');
            if (sharedTaskId && tasksMap[sharedTaskId]) {
                openDetailModal(sharedTaskId);
            }
            isInitialDeepLinkChecked = true;
        }

    } catch (e) { console.error("Firestore error:", e); }
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
    document.getElementById('detailDate').innerText = task.date || '-';
    document.getElementById('detailContent').innerText = task.content || '등록된 내용이 없습니다.';

    const fileBtnArea = document.getElementById('detailFileBtn');
    if (fileBtnArea) fileBtnArea.innerHTML = renderFileButtons(task);

    renderComments(task.comments || []);
    detailModal.classList.remove('hidden');
}

// ============================================================================
// 6. 댓글 시스템
// ============================================================================
function renderComments(commentsArr) {
    const listEl = document.getElementById('commentListArea');
    const countEl = document.getElementById('commentCountBadge');
    if (countEl) countEl.innerText = commentsArr.length;
    if (!listEl) return;
    
    listEl.innerHTML = '';
    if(commentsArr.length === 0) {
        listEl.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">등록된 소통 댓글이 없습니다.</p>';
        return;
    }

    const isAdmin = checkIsAdmin();

    commentsArr.forEach((c, index) => {
        const canManage = (c.author === currentUserName) || isAdmin;
        const actionBtns = canManage ? `
            <div class="flex items-center gap-1.5 ml-2">
                <button type="button" class="edit-comment-btn text-[10px] font-bold text-gray-400 hover:text-blue-600 transition" data-index="${index}">수정</button>
                <button type="button" class="delete-comment-btn text-[10px] font-bold text-gray-400 hover:text-red-500 transition" data-index="${index}">삭제</button>
            </div>
        ` : '';

        let filesHtml = '';
        if (c.files && c.files.length > 0) {
            filesHtml = `<div class="flex flex-wrap gap-2 pt-1 mt-1 border-t border-gray-100">${renderFileButtons({ files: c.files })}</div>`;
        }

        listEl.innerHTML += `
            <div class="bg-white border border-gray-200 p-3 rounded-xl shadow-xs space-y-1">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-800">${c.author} <span class="text-[10px] text-gray-400">(${c.role || '멤버'})</span></span>
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-400">${c.date}</span>
                        ${actionBtns}
                    </div>
                </div>
                <p class="text-xs text-gray-700 whitespace-pre-line">${c.text}</p>
                ${filesHtml}
            </div>
        `;
    });

    listEl.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (confirm("댓글을 삭제하시겠습니까?")) {
                commentsArr.splice(idx, 1);
                await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), { comments: commentsArr });
                renderComments(commentsArr);
                fetchTasks();
            }
        });
    });
}

safeAddListener('submitNewCommentBtn', 'click', async () => {
    if(!currentDetailTaskId) return;
    const task = tasksMap[currentDetailTaskId];
    const textInput = document.getElementById('commentInputBox');
    const fileInput = document.getElementById('commentFileInputBox');
    const text = textInput.value.trim();

    if(!text && fileInput.files.length === 0) { 
        alert('댓글 내용이나 첨부할 파일을 입력해 주세요.'); 
        return; 
    }

    const submitBtn = document.getElementById('submitNewCommentBtn');
    submitBtn.innerText = "저장 중...";
    submitBtn.disabled = true;

    let commentFiles = [];
    try {
        if (fileInput.files.length > 0) {
            commentFiles = await uploadFilesToStorage(fileInput.files, "crm_comments");
        }
    } catch(err) {
        alert(err.message);
        submitBtn.innerText = "등록";
        submitBtn.disabled = false;
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newComment = {
        author: currentUserName,
        role: currentUserRole,
        date: dateStr,
        text: text,
        files: commentFiles
    };

    const updatedComments = [...(task.comments || []), newComment];

    try {
        await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), { comments: updatedComments });
        textInput.value = '';
        fileInput.value = '';
        task.comments = updatedComments;
        renderComments(updatedComments);
        fetchTasks();
    } catch (e) { 
        alert("댓글 저장 실패: " + e.message); 
    } finally {
        submitBtn.innerText = "등록";
        submitBtn.disabled = false;
    }
});

// ============================================================================
// 7. 클라이언트 관리 모듈
// ============================================================================
async function fetchClients() {
    const tbody = document.getElementById('clientsTable');
    const emptyState = document.getElementById('emptyClients');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩 중...</td></tr>';

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
                        <div class="text-gray-900 font-bold flex items-center gap-1 mt-0.5">PW: ${data.metaPw || '-'}</div>
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

    } catch (e) { console.error("Client fetch error:", e); }
}

// ============================================================================
// 8. 멤버 관리 / 승인 관리 / 로그 모니터링 모듈
// ============================================================================
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

async function fetchLogs() {
    const isAdmin = checkIsAdmin();
    if(!isAdmin) return;
    const tbody = document.getElementById('logsTable');
    const emptyState = document.getElementById('emptyLogs');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로그 데이터 수집 중...</td></tr>';

    try {
        const logsSnap = await getDocs(collection(db, "activity_logs"));
        let logs = [];
        logsSnap.forEach(docSnap => logs.push({ id: docSnap.id, ...docSnap.data() }));

        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        tbody.innerHTML = '';
        if (logs.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }
        if(emptyState) emptyState.style.display = 'none';

        logs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateStr = dateObj.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false });
            
            const tr = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="p-3 md:p-4 text-xs font-medium text-gray-500 align-middle">${dateStr}</td>
                    <td class="p-3 md:p-4 text-xs font-bold text-gray-800 align-middle">${log.name} (${log.email})</td>
                    <td class="p-3 md:p-4 align-middle"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold text-[11px]">${log.action}</span></td>
                    <td class="p-3 md:p-4 text-xs text-gray-600 font-medium whitespace-normal align-middle">${log.details || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    } catch (error) { console.error("Log error:", error); }
}

async function fetchLibraryItems() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 라이브러리 로딩 중...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, "crm_library"));
        grid.innerHTML = '';

        querySnapshot.forEach(docSnap => {
            const item = docSnap.data();
            grid.innerHTML += `
                <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span class="px-2.5 py-1 bg-orange-50 text-hermes text-[10px] font-bold rounded-md">${item.category || '가이드'}</span>
                    <h3 class="font-black text-gray-900 mt-2 mb-1">${item.title}</h3>
                    <p class="text-xs text-gray-500 line-clamp-2">${item.desc || ''}</p>
                </div>
            `;
        });
    } catch (e) { console.error("Library fetch error:", e); }
}

// ============================================================================
// 9. 네비게이션 및 모달 이벤트 핸들러
// ============================================================================
safeAddListener('googleLoginBtn', 'click', () => signInWithPopup(auth, provider));
safeAddListener('logoutBtn', 'click', () => signOut(auth));
safeAddListener('closePendingBtn', 'click', () => signOut(auth));

safeAddListener('openModalBtn', 'click', () => createModal.classList.remove('hidden'));
safeAddListener('closeModalBtn', 'click', () => createModal.classList.add('hidden'));
safeAddListener('cancelBtn', 'click', () => createModal.classList.add('hidden'));

safeAddListener('closeDetailModalBtn', 'click', () => {
    detailModal.classList.add('hidden');
    window.history.pushState({}, '', window.location.pathname);
});

// 메뉴 네비게이션 및 탭별 데이터 호출 연결
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        
        // 탭 스타일 활성화
        navItems.forEach(n => {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
        });
        e.currentTarget.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";

        // 컨테이너 초기화
        if (statsContainer) statsContainer.classList.add('hidden');
        if (tasksContainer) tasksContainer.classList.add('hidden');
        if (clientsContainer) clientsContainer.classList.add('hidden');
        if (membersContainer) membersContainer.classList.add('hidden');
        if (approvalsContainer) approvalsContainer.classList.add('hidden');
        if (logsContainer) logsContainer.classList.add('hidden');
        if (libraryContainer) libraryContainer.classList.add('hidden');

        // 선택 메뉴 노출 및 데이터 로드
        if (menu === 'dashboard') {
            if (statsContainer) statsContainer.classList.remove('hidden');
            if (tasksContainer) tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'inquiries') {
            if (tasksContainer) tasksContainer.classList.remove('hidden');
            fetchTasks();
        } else if (menu === 'clients') {
            if (clientsContainer) clientsContainer.classList.remove('hidden');
            fetchClients();
        } else if (menu === 'members') {
            if (membersContainer) membersContainer.classList.remove('hidden');
            fetchMembers();
        } else if (menu === 'approvals') {
            if (approvalsContainer) approvalsContainer.classList.remove('hidden');
            fetchApprovals();
        } else if (menu === 'logs') {
            if (logsContainer) logsContainer.classList.remove('hidden');
            fetchLogs();
        } else if (menu === 'library') {
            if (libraryContainer) libraryContainer.classList.remove('hidden');
            fetchLibraryItems();
        }
    });
});

// 이슈 목록 테이블 클릭 상세 열기
const boardTableEl = document.getElementById('boardTable');
if (boardTableEl) {
    boardTableEl.addEventListener('click', (e) => {
        if (e.target.closest('.download-link') || e.target.closest('.delete-task-btn')) return;
        const row = e.target.closest('.task-detail-trigger');
        if (row) {
            const taskId = row.getAttribute('data-id');
            if (taskId) openDetailModal(taskId);
        }
    });
}