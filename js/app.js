import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
const ADMIN_EMAILS = ["hhjhhj422@gmail.com", "adp@adplanters.com", "dlghgus9997@gmail.com"];
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
let clientsMap = {};
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
// 3. 공통 유틸리티 & 워터마크 & 권한 검증 헬퍼
// ============================================================================
function safeAddListener(id, eventType, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(eventType, callback);
    }
}

// 최상위 관리자 권한 확인
function checkIsAdmin() {
    if (currentUserRole === 'admin') {
        return true;
    }
    if (auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email)) {
        return true;
    }
    return false;
}

// 작성자 본인 확인 로직
function checkIsAuthor(task) {
    if (!auth.currentUser || !task) {
        return false;
    }
    return (task.staff === currentUserName) || 
           (task.email === auth.currentUser.email) || 
           (task.uid === auth.currentUser.uid);
}

// 사선 지그재그 바둑판 패턴 워터마크 동적 생성
function renderWatermark() {
    if (document.getElementById('autoWatermarkLayer')) {
        return;
    }
    
    const container = document.createElement('div');
    container.id = 'autoWatermarkLayer';
    container.className = 'watermark-container';

    let rowsHtml = '';
    for (let i = 0; i < 24; i++) {
        const shiftStyle = (i % 2 === 0) ? 'margin-left: 0px;' : 'margin-left: 140px;';
        rowsHtml += `<div class="watermark-row" style="${shiftStyle}">`;
        for (let j = 0; j < 10; j++) {
            rowsHtml += `<span class="wm-ad">ADplanters</span> <span class="wm-hermes">✕</span> <span class="wm-noah">NOAH UNIVERSE COMPANY</span>`;
        }
        rowsHtml += `</div>`;
    }
    
    container.innerHTML = rowsHtml;
    document.body.prepend(container);
}

// 이미지 원본 보기 전용 모달 (ESC / 배경 클릭 닫기 지원)
function openImageModal(imgUrl) {
    let modal = document.getElementById('globalImageModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalImageModal';
        modal.className = 'fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-4 hidden backdrop-blur-xs transition-opacity duration-200';
        modal.innerHTML = `
            <div class="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
                <button type="button" id="closeImageModalBtn" class="absolute -top-10 right-0 text-white text-3xl font-bold hover:text-orange-400 transition cursor-pointer">&times;</button>
                <img id="globalImageModalImg" src="" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" />
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'closeImageModalBtn') {
                modal.classList.add('hidden');
            }
        });
    }
    
    const modalImg = document.getElementById('globalImageModalImg');
    if (modalImg) {
        modalImg.src = imgUrl;
    }
    modal.classList.remove('hidden');
}

// 모든 모달 닫기
function closeAllModals() {
    const globalImgModal = document.getElementById('globalImageModal');
    if (globalImgModal) {
        globalImgModal.classList.add('hidden');
    }

    const modals = [
        createModal, editTaskModal, clientModal, 
        editClientModal, assignModal, detailModal, 
        libraryViewModal, libraryEditModal, pendingModal
    ];
    
    modals.forEach(m => { 
        if(m) {
            m.classList.add('hidden'); 
        }
    });
    
    window.history.pushState({}, '', window.location.pathname);
}

// 키보드 ESC 키 감지 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

// 모달 바깥 배경 클릭 시 닫기
[createModal, editTaskModal, clientModal, editClientModal, assignModal, detailModal, libraryViewModal, libraryEditModal].forEach(modalEl => {
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                closeAllModals();
            }
        });
    }
});

// 이미지 썸네일 클릭 이벤트 위임
document.addEventListener('click', (e) => {
    const imgTrigger = e.target.closest('.img-preview-btn');
    if (imgTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const url = imgTrigger.getAttribute('data-url');
        if (url) {
            openImageModal(url);
        }
    }
});

// Firebase Storage 원본 파일 업로드
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

// 드래그 & 드롭 파일 첨부 바인딩 헬퍼
function setupDragAndDrop(dropAreaId, fileInputId) {
    const dropArea = document.getElementById(dropAreaId);
    const fileInput = document.getElementById(fileInputId);
    
    if (!dropArea || !fileInput) {
        return;
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('border-hermes', 'bg-orange-50/50', 'ring-2', 'ring-orange-300');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('border-hermes', 'bg-orange-50/50', 'ring-2', 'ring-orange-300');
        }, false);
    });

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            fileInput.files = files;
            alert(`[드래그 첨부 성공] 총 ${files.length}개의 파일이 선택되었습니다.`);
        }
    }, false);
}

// 이미지 파일 판별 헬퍼
function isImageFile(fileName, url) {
    const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerName = (fileName || '').toLowerCase();
    const lowerUrl = (url || '').toLowerCase();
    const isDataImg = lowerUrl.startsWith('data:image/');
    return isDataImg || imgExts.some(ext => lowerName.endsWith(ext) || lowerUrl.includes(ext));
}

// 이미지 썸네일 미리보기 + 첨부파일 렌더링
function renderFileButtons(item) {
    if (item.files && item.files.length > 0) {
        return item.files.map(f => {
            const url = f.fileUrl || f.fileData; 
            const fileName = f.fileName || '첨부파일';

            if (isImageFile(fileName, url)) {
                return `
                    <div class="inline-block relative group my-1 mr-2 align-top">
                        <img src="${url}" alt="${fileName}" data-url="${url}" class="img-preview-btn w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-xs hover:shadow-md hover:scale-105 transition duration-200 cursor-pointer" title="클릭하여 확대 보기" />
                        <a href="${url}" target="_blank" download="${fileName}" onclick="event.stopPropagation();" class="absolute bottom-1 right-1 bg-black/60 hover:bg-black text-white text-[9px] px-1.5 py-0.5 rounded shadow transition" title="다운로드">
                            <i class="fa-solid fa-download"></i>
                        </a>
                    </div>
                `;
            }

            return `
                <a href="${url}" target="_blank" download="${fileName}" class="download-link inline-flex items-center gap-1 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-hermes text-[10px] font-bold px-2 py-1.5 rounded-lg border border-gray-200 transition my-0.5 shadow-sm">
                    <i class="fa-solid fa-download text-hermes"></i> ${fileName}
                </a>
            `;
        }).join(' ');
    }
    return `<span class="text-gray-300 text-[10px]">첨부파일 없음</span>`;
}

// 활동 로그 기록
async function logActivity(action, details = "") {
    if (!auth.currentUser) {
        return;
    }
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
// 4. 인증 및 사용자 권한 제어
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    renderWatermark();

    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        currentUserName = user.displayName || "담당자";
        
        const staffInput = document.getElementById('inputStaff');
        if(staffInput) {
            staffInput.value = currentUserName;
        }

        if(!isInitialLoginLogged) {
            logActivity("로그인", "시스템에 성공적으로 접속했습니다.");
            isInitialLoginLogged = true;
        }

        // 1. ADMIN_EMAILS 목록 지정 관리자 자동 승인
        if (ADMIN_EMAILS.includes(user.email)) {
            await setDoc(userRef, { 
                email: user.email, 
                name: currentUserName, 
                role: "admin", 
                status: "approved" 
            }, { merge: true });
            
            currentUserRole = 'admin';
            showDashboard(user);
            return;
        }

        // 2. 이메일 기반 기존 UID 자동 매핑 처리
        if (!userSnap.exists()) {
            const q = query(collection(db, "users"), where("email", "==", user.email));
            const qSnap = await getDocs(q);
            
            if (!qSnap.empty) {
                const oldDoc = qSnap.docs[0];
                const oldData = oldDoc.data();
                
                await setDoc(userRef, { 
                    ...oldData, 
                    uid: user.uid,
                    updatedAt: new Date().toISOString()
                });

                if (oldDoc.id !== user.uid) {
                    await deleteDoc(doc(db, "users", oldDoc.id));
                }
                
                currentUserRole = oldData.role || 'player';
                
                if (oldData.status === 'approved') {
                    showDashboard(user);
                } else {
                    showPendingPopup();
                }
                return;
            }

            await setDoc(userRef, { 
                email: user.email, 
                name: currentUserName, 
                role: "player", 
                status: "pending", 
                createdAt: new Date().toISOString() 
            });
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

function showDashboard(user) {
    if(loginSection) loginSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.add('hidden');
    if(dashboardSection) dashboardSection.classList.remove('hidden');

    if(document.getElementById('currentUserName')) {
        document.getElementById('currentUserName').innerText = user.displayName || '사용자';
    }
    
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

    setupDragAndDrop('commentInputBox', 'commentFileInputBox');
    setupDragAndDrop('inputContent', 'inputFile');

    fetchTasks();
}

function showPendingPopup() {
    if(loginSection) loginSection.classList.remove('hidden');
    if(dashboardSection) dashboardSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.remove('hidden');
}

// ============================================================================
// 5. 업무 이슈/요청 게시판 (목록 렌더링 및 외부 모달 제어)
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
        email: auth.currentUser ? auth.currentUser.email : '',
        uid: auth.currentUser ? auth.currentUser.uid : '',
        assignedManagers: assignedManagersArr,
        status: "답변대기", 
        views: 0,
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

// 외부 리스트에서 게시글 삭제 처리
async function deleteTask(taskId) {
    const task = tasksMap[taskId];
    const title = task ? task.title : '해당 이슈';
    
    if (confirm(`[${title}] 이슈를 정말 삭제하시겠습니까?`)) {
        try {
            await deleteDoc(doc(db, "crm_tasks", taskId));
            await logActivity("이슈 삭제", `[${title}] 이슈 삭제 처리`);
            alert("이슈가 삭제되었습니다.");
            closeAllModals();
            fetchTasks();
        } catch (err) {
            alert("이슈 삭제 실패: " + err.message);
        }
    }
}

// 외부 리스트 게시글 수정 모달 팝업 오픈 (빈 공백 방지 완벽 처리)
function openEditTaskModal(taskId) {
    const task = tasksMap[taskId];
    if (!task) return;
    currentDetailTaskId = taskId;

    if (editTaskModal) {
        const inputs = editTaskModal.querySelectorAll('input[type="text"]');
        const selects = editTaskModal.querySelectorAll('select');
        const textareas = editTaskModal.querySelectorAll('textarea');

        const clientIn = document.getElementById('editInputClient') || editTaskModal.querySelector('[name="client"]') || inputs[0];
        const titleIn = document.getElementById('editInputTitle') || editTaskModal.querySelector('[name="title"]') || inputs[1];
        const typeIn = document.getElementById('editInputType') || editTaskModal.querySelector('[name="type"]') || selects[0];
        const agencyIn = document.getElementById('editInputAgency') || editTaskModal.querySelector('[name="agency"]') || selects[1];
        const contentIn = document.getElementById('editInputContent') || editTaskModal.querySelector('[name="content"]') || textareas[0];

        if (clientIn) clientIn.value = task.client || '';
        if (titleIn) titleIn.value = task.title || '';
        if (typeIn) typeIn.value = task.type || 'Q&A';
        if (agencyIn) agencyIn.value = task.agency || '';
        if (contentIn) contentIn.value = task.content || '';

        editTaskModal.classList.remove('hidden');
        editTaskModal.style.zIndex = "99999"; 
    }
}

// 담당자 다중 연결 중앙 플로팅 모달 오픈
async function openAssignModal(taskId) {
    const task = tasksMap[taskId];
    if (!task) return;
    currentAssignClientId = taskId;

    if (assignModal) {
        const modalCard = assignModal.querySelector('.bg-white') || assignModal.firstElementChild;
        let listContainer = assignModal.querySelector('#assignManagerList') || assignModal.querySelector('.assign-manager-list');

        if (!listContainer && modalCard) {
            const formContainer = modalCard.querySelector('form') || modalCard;
            listContainer = document.createElement('div');
            listContainer.id = 'assignManagerList';
            listContainer.className = 'my-4 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-52 overflow-y-auto shadow-inner';
            
            const pDesc = modalCard.querySelector('p');
            if (pDesc) {
                pDesc.after(listContainer);
            } else {
                formContainer.prepend(listContainer);
            }
        }

        if (listContainer) {
            listContainer.innerHTML = '<div class="text-xs text-gray-400 p-3 text-center font-bold"><i class="fa-solid fa-spinner animate-spin mr-1"></i> 멤버 목록 불러오는 중...</div>';
            try {
                const usersSnap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
                let html = '<div class="flex flex-col gap-1.5">';
                
                const currentAssigned = task.assignedManagers && task.assignedManagers.length > 0 
                    ? task.assignedManagers 
                    : (task.staff && task.staff !== '미지정' ? task.staff.split(',').map(s=>s.trim()) : []);

                usersSnap.forEach(uDoc => {
                    const u = uDoc.data();
                    const isChecked = currentAssigned.includes(u.name) ? 'checked' : '';
                    html += `
                        <label class="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer text-xs font-bold text-gray-700 transition border border-transparent hover:border-gray-200 shadow-2xs">
                            <input type="checkbox" value="${u.name}" class="assign-manager-checkbox rounded text-hermes focus:ring-hermes" ${isChecked} />
                            <span>${u.name} <span class="text-[10px] text-gray-400 font-normal">(${u.email})</span></span>
                        </label>
                    `;
                });
                html += '</div>';
                listContainer.innerHTML = html;
            } catch(err) {
                console.error(err);
                listContainer.innerHTML = '<div class="text-xs text-red-500 p-2 text-center">멤버 로드 실패</div>';
            }
        }

        assignModal.classList.remove('hidden');
        assignModal.style.zIndex = "99999";

        const closeBtn = assignModal.querySelector('.fa-xmark')?.closest('button') || assignModal.querySelector('button[title="닫기"]');
        const cancelBtn = assignModal.querySelector('button.bg-gray-100') || Array.from(assignModal.querySelectorAll('button')).find(b => b.textContent.includes('취소'));
        
        if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); assignModal.classList.add('hidden'); };
        if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); assignModal.classList.add('hidden'); };
    }
}

// 외부 리스트 게시글 수정 완료 저장
safeAddListener('editTaskForm', 'submit', async (e) => {
    e.preventDefault();
    if (!currentDetailTaskId) return;

    const inputs = editTaskModal.querySelectorAll('input[type="text"]');
    const selects = editTaskModal.querySelectorAll('select');
    const textareas = editTaskModal.querySelectorAll('textarea');

    const clientIn = document.getElementById('editInputClient') || editTaskModal.querySelector('[name="client"]') || inputs[0];
    const titleIn = document.getElementById('editInputTitle') || editTaskModal.querySelector('[name="title"]') || inputs[1];
    const typeIn = document.getElementById('editInputType') || editTaskModal.querySelector('[name="type"]') || selects[0];
    const contentIn = document.getElementById('editInputContent') || editTaskModal.querySelector('[name="content"]') || textareas[0];

    try {
        await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), {
            title: titleIn ? titleIn.value : tasksMap[currentDetailTaskId].title,
            content: contentIn ? contentIn.value : tasksMap[currentDetailTaskId].content,
            type: typeIn ? typeIn.value : tasksMap[currentDetailTaskId].type,
            client: clientIn ? clientIn.value : tasksMap[currentDetailTaskId].client,
            updatedAt: new Date().toISOString()
        });
        
        if (editTaskModal) {
            editTaskModal.classList.add('hidden');
        }
        alert("이슈 수정이 완료되었습니다.");
        
        await fetchTasks();
        if (!detailModal.classList.contains('hidden')) {
            openDetailModal(currentDetailTaskId);
        }
    } catch (err) { 
        alert("이슈 수정 실패: " + err.message); 
    }
});

// 외부 모달 폼 제출을 통한 담당자 배정 
safeAddListener('assignForm', 'submit', async (e) => {
    e.preventDefault();
    const targetId = currentAssignClientId || currentDetailTaskId;
    if (!targetId) return;

    const submitBtn = assignModal.querySelector('button[type="submit"]') || Array.from(assignModal.querySelectorAll('button')).find(b => b.textContent.includes('배정'));
    const origText = submitBtn ? submitBtn.innerText : '배정 완료';
    
    if (submitBtn) { 
        submitBtn.innerText = "저장 중..."; 
        submitBtn.disabled = true; 
    }

    const checkboxes = assignModal.querySelectorAll('.assign-manager-checkbox:checked');
    const selectedManagers = Array.from(checkboxes).map(cb => cb.value);
    const staffString = selectedManagers.length > 0 ? selectedManagers.join(', ') : '미지정';

    try {
        await updateDoc(doc(db, "crm_tasks", targetId), {
            assignedManagers: selectedManagers,
            staff: staffString
        });

        if (tasksMap[targetId]) {
            tasksMap[targetId].assignedManagers = selectedManagers;
            tasksMap[targetId].staff = staffString;
        }

        if (assignModal) {
            assignModal.classList.add('hidden');
        }
        
        alert("담당자가 배정되었습니다.");
        await fetchTasks();

        if (detailModal && !detailModal.classList.contains('hidden')) {
            openDetailModal(targetId);
        }
    } catch (err) { 
        alert("담당자 저장 실패: " + err.message); 
    } finally {
        if (submitBtn) { 
            submitBtn.innerText = origText; 
            submitBtn.disabled = false; 
        }
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

        fetchedData.forEach(item => {
            const isAdmin = checkIsAdmin();
            const isAuthor = checkIsAuthor(item);

            let adminActions = `<td class="admin-only-col p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 align-middle"><span class="text-gray-300 text-xs">-</span></td>`;

            if (isAdmin) {
                adminActions = `
                    <td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" class="edit-task-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold" data-id="${item.id}">수정</button>
                            <button type="button" class="assign-task-btn bg-orange-50 text-hermes hover:bg-hermes hover:text-white px-2 py-1 rounded transition text-[11px] font-bold" data-id="${item.id}">담당자</button>
                            <button type="button" class="delete-task-btn bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold" data-id="${item.id}" data-t="${item.title}">삭제</button>
                        </div>
                    </td>
                `;
            } else if (isAuthor) {
                adminActions = `
                    <td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" class="edit-task-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold" data-id="${item.id}">수정</button>
                        </div>
                    </td>
                `;
            }

            const fileButton = renderFileButtons(item);
            const commentCount = item.comments ? item.comments.length : 0;
            const displayStaff = (item.assignedManagers && item.assignedManagers.length > 0) ? item.assignedManagers.join(', ') : (item.staff || '미지정');

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
                    <td class="p-3 md:p-4 align-middle text-xs font-bold text-gray-700">${displayStaff}</td>
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

// ============================================================================
// 6. 이슈 상세 모달 (자연스러운 인라인 에디팅 & 담당자 배정 표기 최적화)
// ============================================================================
async function openDetailModal(taskId) {
    const task = tasksMap[taskId];
    if(!task) return;
    
    currentDetailTaskId = taskId;
    const newUrl = `${window.location.pathname}?id=${taskId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    task.views = (task.views || 0) + 1;
    try {
        await updateDoc(doc(db, "crm_tasks", taskId), { views: increment(1) });
    } catch (e) { console.error("View increment error:", e); }

    const viewCountEl = document.getElementById('detailViews') || document.querySelector('#detailModal .fa-eye')?.parentElement;
    if (viewCountEl) {
        viewCountEl.innerHTML = `<i class="fa-solid fa-eye mr-1"></i> ${task.views}`;
    }

    document.getElementById('detailTitle').innerText = task.title || '제목 없음';
    document.getElementById('detailType').innerText = task.type || 'Q&A';
    document.getElementById('detailClient').innerText = task.client || '-';
    
    // 지정 담당자 표기 복구 및 디자인 보정
    const staffDisplay = (task.assignedManagers && task.assignedManagers.length > 0) 
        ? task.assignedManagers.join(', ') 
        : (task.staff || '미지정');
    
    const staffEl = document.getElementById('detailStaff');
    if (staffEl) {
        staffEl.innerText = staffDisplay;
        staffEl.className = "text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 inline-block";
    }

    document.getElementById('detailDate').innerText = task.date || '-';
    document.getElementById('detailContent').innerText = task.content || '등록된 내용이 없습니다.';

    // 상단 컨트롤러 버튼 바 제어 (관리자 vs 작성자 본인)
    const isAdmin = checkIsAdmin();
    const isAuthor = checkIsAuthor(task);

    let actionArea = document.getElementById('detailTaskActions');
    if (!actionArea) {
        const shareBtn = document.getElementById('shareLinkBtn') || document.querySelector('#detailModal button:last-child');
        if (shareBtn && shareBtn.parentElement) {
            actionArea = document.createElement('div');
            actionArea.id = 'detailTaskActions';
            actionArea.className = 'inline-flex items-center gap-1.5 ml-2 mr-2';
            shareBtn.parentElement.insertBefore(actionArea, shareBtn);
        }
    }

    if (actionArea) {
        if (isAdmin) {
            actionArea.innerHTML = `
                <button type="button" id="btnDetailEdit" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-lg border border-blue-200 transition shadow-2xs">수정</button>
                <button type="button" id="btnDetailAssign" class="px-2.5 py-1 bg-orange-50 hover:bg-hermes text-hermes hover:text-white text-xs font-bold rounded-lg border border-orange-200 transition shadow-2xs">담당자 연결</button>
                <button type="button" id="btnDetailDelete" class="px-2.5 py-1 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white text-xs font-bold rounded-lg border border-red-200 transition shadow-2xs">삭제</button>
            `;
            document.getElementById('btnDetailDelete').onclick = () => deleteTask(taskId);
            
            document.getElementById('btnDetailEdit').onclick = () => bindInlineEditMode(taskId);
            document.getElementById('btnDetailAssign').onclick = () => openAssignModal(taskId);
            
        } else if (isAuthor) {
            actionArea.innerHTML = `
                <button type="button" id="btnDetailEdit" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-lg border border-blue-200 transition shadow-2xs">수정</button>
            `;
            document.getElementById('btnDetailEdit').onclick = () => bindInlineEditMode(taskId);
        } else {
            actionArea.innerHTML = '';
        }
    }

    const fileBtnArea = document.getElementById('detailFileBtn');
    if (fileBtnArea) {
        fileBtnArea.innerHTML = renderFileButtons(task);
    }

    renderComments(task.comments || []);
    detailModal.classList.remove('hidden');
    logActivity("상세 조회", `[${task.title}] 상세 내용을 조회했습니다.`);
}

// 상세 모달 내부 본문 자연스러운 인라인 편집 모드
function bindInlineEditMode(taskId) {
    const task = tasksMap[taskId];
    const titleEl = document.getElementById('detailTitle');
    const contentEl = document.getElementById('detailContent');
    const actionArea = document.getElementById('detailTaskActions');

    if (!titleEl || !contentEl) return;

    titleEl.innerHTML = `<input type="text" id="inlineEditTitle" value="${task.title.replace(/"/g, '&quot;')}" class="w-full text-lg font-black border border-orange-400 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-hermes" />`;
    contentEl.innerHTML = `<textarea id="inlineEditContent" rows="6" class="w-full text-sm font-medium border border-orange-400 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-hermes">${task.content}</textarea>`;

    if (actionArea) {
        actionArea.innerHTML = `
            <button type="button" id="btnInlineSave" class="px-3 py-1.5 bg-hermes hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition">저장</button>
            <button type="button" id="btnInlineCancel" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition">취소</button>
        `;

        document.getElementById('btnInlineCancel').onclick = () => openDetailModal(taskId);
        document.getElementById('btnInlineSave').onclick = async () => {
            const newTitle = document.getElementById('inlineEditTitle').value.trim();
            const newContent = document.getElementById('inlineEditContent').value.trim();
            if(!newTitle) { alert("제목을 입력해주세요."); return; }

            document.getElementById('btnInlineSave').innerText = "저장중...";
            try {
                await updateDoc(doc(db, "crm_tasks", taskId), { 
                    title: newTitle, 
                    content: newContent, 
                    updatedAt: new Date().toISOString() 
                });
                tasksMap[taskId].title = newTitle; 
                tasksMap[taskId].content = newContent;
                alert("수정이 반영되었습니다."); 
                fetchTasks(); 
                openDetailModal(taskId);
            } catch(err) { 
                alert(err.message); 
            }
        };
    }
}

// ============================================================================
// 7. 소통 댓글 모듈 (인라인 수정 및 드래그앤드롭 첨부 보존)
// ============================================================================
function renderComments(commentsArr) {
    const listEl = document.getElementById('commentListArea') || document.getElementById('commentList');
    const countEl = document.getElementById('commentCountBadge') || document.getElementById('commentCount');
    
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
                <button type="button" class="edit-comment-btn text-[10px] font-bold text-blue-600 hover:underline transition" data-index="${index}">수정</button>
                <button type="button" class="delete-comment-btn text-[10px] font-bold text-red-500 hover:underline transition" data-index="${index}">삭제</button>
            </div>
        ` : '';

        let filesHtml = '';
        if (c.files && c.files.length > 0) {
            filesHtml = `<div class="flex flex-wrap gap-2 pt-2 mt-2 border-t border-gray-100">${renderFileButtons({ files: c.files })}</div>`;
        }

        listEl.innerHTML += `
            <div class="bg-white border border-gray-200 p-3 rounded-xl shadow-xs space-y-1 comment-item" id="comment-item-${index}">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-800">${c.author} <span class="text-[10px] text-gray-400">(${c.role || '멤버'})</span></span>
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-400">${c.date}</span>
                        ${actionBtns}
                    </div>
                </div>
                <div class="comment-body-area" id="comment-body-${index}">
                    <p class="text-xs text-gray-700 whitespace-pre-line">${c.text}</p>
                    ${filesHtml}
                </div>
            </div>
        `;
    });

    listEl.querySelectorAll('.edit-comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            const comment = commentsArr[idx];
            const bodyArea = document.getElementById(`comment-body-${idx}`);

            if (!bodyArea || bodyArea.querySelector('textarea')) return;

            let currentEditFiles = comment.files ? [...comment.files] : [];

            function renderEditFilesList() {
                if (currentEditFiles.length === 0) return '<span class="text-[10px] text-gray-400 italic">첨부파일 없음</span>';
                return currentEditFiles.map((f, fIdx) => {
                    const fileName = f.fileName || '첨부파일';
                    return `
                        <span class="inline-flex items-center gap-1 bg-white text-gray-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-200 shadow-2xs">
                            <i class="fa-solid fa-paperclip text-hermes"></i> ${fileName}
                            <button type="button" class="remove-edit-file-btn text-red-500 hover:text-red-700 ml-1 font-black" data-fidx="${fIdx}">✕</button>
                        </span>
                    `;
                }).join(' ');
            }

            bodyArea.innerHTML = `
                <div class="mt-1 space-y-2">
                    <textarea id="inline-edit-textarea-${idx}" class="w-full text-xs p-2.5 border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-hermes/30 transition resize-y" rows="3" placeholder="댓글 내용 및 드래그 파일 첨부 가능">${comment.text}</textarea>
                    
                    <div class="space-y-1 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                        <div class="text-[10px] font-bold text-gray-500 flex justify-between">
                            <span>첨부파일 관리:</span>
                            <span class="text-orange-500 font-normal text-[9px]">* 텍스트 상자나 버튼에 파일 드래그 가능</span>
                        </div>
                        <div id="inline-edit-files-container-${idx}" class="flex flex-wrap gap-1">
                            ${renderEditFilesList()}
                        </div>
                        <div class="pt-1">
                            <input type="file" id="inline-edit-file-input-${idx}" multiple class="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-white file:border file:border-gray-200 file:text-gray-700 hover:file:bg-orange-50 cursor-pointer" />
                        </div>
                    </div>

                    <div class="flex justify-end gap-1.5 pt-1">
                        <button type="button" class="cancel-inline-edit-btn bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition">취소</button>
                        <button type="button" class="save-inline-edit-btn bg-hermes hover:bg-orange-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-xs">저장</button>
                    </div>
                </div>
            `;

            setupDragAndDrop(`inline-edit-textarea-${idx}`, `inline-edit-file-input-${idx}`);

            const filesContainer = document.getElementById(`inline-edit-files-container-${idx}`);

            function bindFileRemoveEvents() {
                if (!filesContainer) return;
                filesContainer.querySelectorAll('.remove-edit-file-btn').forEach(rmBtn => {
                    rmBtn.addEventListener('click', (rmEvt) => {
                        rmEvt.stopPropagation();
                        const fIdx = parseInt(rmBtn.getAttribute('data-fidx'));
                        currentEditFiles.splice(fIdx, 1);
                        filesContainer.innerHTML = renderEditFilesList();
                        bindFileRemoveEvents();
                    });
                });
            }
            bindFileRemoveEvents();

            const saveBtn = bodyArea.querySelector('.save-inline-edit-btn');
            const cancelBtn = bodyArea.querySelector('.cancel-inline-edit-btn');
            const textarea = document.getElementById(`inline-edit-textarea-${idx}`);
            const newFileInput = document.getElementById(`inline-edit-file-input-${idx}`);

            cancelBtn.addEventListener('click', (eEvt) => {
                eEvt.stopPropagation();
                renderComments(commentsArr);
            });

            saveBtn.addEventListener('click', async (eEvt) => {
                eEvt.stopPropagation();
                const updatedText = textarea.value.trim();
                
                if (!updatedText && currentEditFiles.length === 0 && (!newFileInput.files || newFileInput.files.length === 0)) {
                    alert("댓글 내용이나 첨부파일을 지정해 주세요.");
                    return;
                }

                saveBtn.innerText = "저장 중...";
                saveBtn.disabled = true;

                try {
                    let newlyUploadedFiles = [];
                    if (newFileInput && newFileInput.files && newFileInput.files.length > 0) {
                        newlyUploadedFiles = await uploadFilesToStorage(newFileInput.files, "crm_comments");
                    }

                    const finalFiles = [...currentEditFiles, ...newlyUploadedFiles];
                    commentsArr[idx].text = updatedText;
                    commentsArr[idx].files = finalFiles;

                    await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), { comments: commentsArr });
                    renderComments(commentsArr);
                    fetchTasks();
                } catch(err) {
                    alert("댓글 수정 저장 실패: " + err.message);
                    saveBtn.innerText = "저장";
                    saveBtn.disabled = false;
                }
            });
        });
    });

    listEl.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            if (confirm("댓글을 완전히 삭제하시겠습니까?")) {
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
        if(fileInput) fileInput.value = '';
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
// 8. 클라이언트 관리 모듈 (🌟 수정/삭제 기능 완벽 연동)
// ============================================================================
async function deleteClient(clientId) {
    const client = clientsMap[clientId];
    const cName = client ? client.name : '해당 클라이언트';
    if (confirm(`[${cName}] 클라이언트를 삭제하시겠습니까?`)) {
        try {
            await deleteDoc(doc(db, "clients", clientId));
            await logActivity("클라이언트 삭제", `[${cName}] 삭제 완료`);
            alert("삭제되었습니다.");
            fetchClients();
        } catch (err) { 
            alert("삭제 실패: " + err.message); 
        }
    }
}

function openEditClientModal(clientId) {
    const client = clientsMap[clientId];
    if (!client) return;
    currentEditClientId = clientId;

    if (editClientModal) {
        const inputs = editClientModal.querySelectorAll('input');
        const nameIn = document.getElementById('editClientName') || editClientModal.querySelector('[name="name"]') || inputs[0];
        const homeIn = document.getElementById('editClientHomeUrl') || editClientModal.querySelector('[name="homeUrl"]') || inputs[1];
        const instaIn = document.getElementById('editClientInstaUrl') || editClientModal.querySelector('[name="instaUrl"]') || inputs[2];
        const metaIdIn = document.getElementById('editClientMetaId') || editClientModal.querySelector('[name="metaId"]') || inputs[3];
        const metaPwIn = document.getElementById('editClientMetaPw') || editClientModal.querySelector('[name="metaPw"]') || inputs[4];
        const budgetIn = document.getElementById('editClientBudget') || editClientModal.querySelector('[name="budget"]') || inputs[5];

        if (nameIn) nameIn.value = client.name || '';
        if (homeIn) homeIn.value = client.homeUrl || '';
        if (instaIn) instaIn.value = client.instaUrl || '';
        if (metaIdIn) metaIdIn.value = client.metaId || '';
        if (metaPwIn) metaPwIn.value = client.metaPw || '';
        if (budgetIn) budgetIn.value = client.budget || '';

        editClientModal.classList.remove('hidden');
        editClientModal.style.zIndex = "99999";
    }
}

safeAddListener('editClientForm', 'submit', async (e) => {
    e.preventDefault();
    if (!currentEditClientId) return;

    const inputs = editClientModal.querySelectorAll('input');
    const nameIn = document.getElementById('editClientName') || editClientModal.querySelector('[name="name"]') || inputs[0];
    const homeIn = document.getElementById('editClientHomeUrl') || editClientModal.querySelector('[name="homeUrl"]') || inputs[1];
    const instaIn = document.getElementById('editClientInstaUrl') || editClientModal.querySelector('[name="instaUrl"]') || inputs[2];
    const metaIdIn = document.getElementById('editClientMetaId') || editClientModal.querySelector('[name="metaId"]') || inputs[3];
    const metaPwIn = document.getElementById('editClientMetaPw') || editClientModal.querySelector('[name="metaPw"]') || inputs[4];
    const budgetIn = document.getElementById('editClientBudget') || editClientModal.querySelector('[name="budget"]') || inputs[5];

    try {
        await updateDoc(doc(db, "clients", currentEditClientId), {
            name: nameIn ? nameIn.value : clientsMap[currentEditClientId].name,
            homeUrl: homeIn ? homeIn.value : clientsMap[currentEditClientId].homeUrl,
            instaUrl: instaIn ? instaIn.value : clientsMap[currentEditClientId].instaUrl,
            metaId: metaIdIn ? metaIdIn.value : clientsMap[currentEditClientId].metaId,
            metaPw: metaPwIn ? metaPwIn.value : clientsMap[currentEditClientId].metaPw,
            budget: budgetIn ? budgetIn.value : clientsMap[currentEditClientId].budget,
            updatedAt: new Date().toISOString()
        });
        editClientModal.classList.add('hidden');
        alert("클라이언트 정보가 수정되었습니다.");
        fetchClients();
    } catch (err) {
        alert("수정 실패: " + err.message);
    }
});

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
        clientsMap = {};

        if (querySnapshot.empty) {
            if(emptyState) emptyState.style.display = 'flex';
            return;
        }
        if(emptyState) emptyState.style.display = 'none';

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            clientsMap[docSnap.id] = { id: docSnap.id, ...data };
            
            let managersHtml = '<span class="text-gray-400 text-xs">미배정</span>';
            if (data.managers && data.managers.length > 0) {
                const maxVisible = 1; 
                const visibleManagers = data.managers.slice(0, maxVisible);
                const hiddenCount = data.managers.length - maxVisible;

                let badges = visibleManagers.map(m => `
                    <span class="inline-flex items-center bg-blue-50 text-noah text-[10px] px-1.5 py-0.5 rounded border border-blue-100 font-bold truncate max-w-[75px]" title="${m}">
                        ${m}
                    </span>
                `).join('');
                
                if (hiddenCount > 0) {
                    const allList = data.managers.map(m => `<div class="py-0.5 flex items-center gap-1"><i class="fa-solid fa-user text-orange-400 text-[9px]"></i> ${m}</div>`).join('');
                    badges += `
                        <div class="inline-block relative group align-middle">
                            <span class="inline-flex items-center bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-hermes text-[10px] px-1.5 py-0.5 rounded border border-gray-200 cursor-pointer font-bold transition shadow-2xs">
                                +${hiddenCount}명
                            </span>
                            <div class="hidden group-hover:block absolute bottom-full right-0 mb-2 p-3 bg-gray-900/95 text-white text-[11px] rounded-xl shadow-2xl z-50 whitespace-nowrap min-w-[120px] border border-gray-700/80 backdrop-blur-xs">
                                <div class="font-bold border-b border-gray-700 pb-1.5 mb-1.5 text-orange-400 text-[10px] flex items-center gap-1">
                                    <i class="fa-solid fa-users"></i> 전체 담당자 (${data.managers.length}명)
                                </div>
                                <div class="space-y-0.5 text-left text-gray-200 font-medium">${allList}</div>
                            </div>
                        </div>
                    `;
                }
                managersHtml = `<div class="flex items-center gap-1 w-full max-w-[130px] overflow-hidden">${badges}</div>`;
            }

            const isAdmin = checkIsAdmin();
            const adminActions = isAdmin ? 
                `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
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
                    <td class="p-3 md:p-4 max-w-[130px] overflow-hidden align-middle">${managersHtml}</td>
                    ${adminActions}
                </tr>
            `;
            tbody.innerHTML += tr;
        });

    } catch (e) { console.error("Client fetch error:", e); }
}

// 🌟 클라이언트 테이블 내부 수정/삭제 클릭 이벤트 위임
const clientsTableEl = document.getElementById('clientsTable');
if (clientsTableEl) {
    clientsTableEl.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-client-btn');
        if (editBtn) {
            e.stopPropagation();
            const clientId = editBtn.getAttribute('data-id');
            if (clientId) openEditClientModal(clientId);
            return;
        }

        const delBtn = e.target.closest('.delete-client-btn');
        if (delBtn) {
            e.stopPropagation();
            const clientId = delBtn.getAttribute('data-id');
            if (clientId) deleteClient(clientId);
            return;
        }
    });
}

// ============================================================================
// 9. 인사이트 라이브러리 모듈
// ============================================================================
async function fetchLibraryItems() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 라이브러리 로딩 중...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, "crm_library"));
        libraryMap = {};
        let libList = [];

        querySnapshot.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            libList.push(item);
            libraryMap[docSnap.id] = item;
        });

        grid.innerHTML = '';
        const isAdmin = checkIsAdmin();

        libList.forEach(item => {
            const adminBtns = isAdmin ? `
                <div class="flex items-center gap-1.5 ml-auto">
                    <button class="edit-lib-btn text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition" data-id="${item.id}">수정</button>
                    <button class="delete-lib-btn text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition" data-id="${item.id}">삭제</button>
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
                        <p class="text-xs text-gray-500 mb-5 line-clamp-2 leading-relaxed flex-1">${item.desc || ''}</p>
                        <div class="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                            <button class="text-xs font-bold text-gray-600 hover:text-hermes transition flex items-center gap-1.5"><i class="fa-solid fa-book-open"></i> HTML 열람</button>
                            ${pdfBtn}
                        </div>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.lib-card-trigger').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.edit-lib-btn') || e.target.closest('.delete-lib-btn') || e.target.closest('a')) return;
                const libId = card.getAttribute('data-id');
                openLibraryViewModal(libId);
            });
        });

    } catch (e) { console.error("Library fetch error:", e); }
}

function openLibraryViewModal(id) {
    const item = libraryMap[id];
    if (!item) return;

    currentViewLibId = id;
    const newUrl = `${window.location.pathname}?libId=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    if (document.getElementById('libViewCategory')) document.getElementById('libViewCategory').innerText = item.category || '가이드';
    if (document.getElementById('libViewTitle')) document.getElementById('libViewTitle').innerText = item.title;
    if (document.getElementById('libViewHtmlContent')) document.getElementById('libViewHtmlContent').innerHTML = item.htmlContent || '<p>상세 내용이 없습니다.</p>';

    if (libraryViewModal) libraryViewModal.classList.remove('hidden');
    logActivity("라이브러리 열람", `[${item.title}] 가이드북 HTML 열람`);
}

// ============================================================================
// 10. 멤버 관리 / 승인 관리 / 로그 모니터링 모듈
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

// ============================================================================
// 11. 네비게이션 및 핸들러 연결
// ============================================================================
safeAddListener('googleLoginBtn', 'click', () => signInWithPopup(auth, provider));
safeAddListener('logoutBtn', 'click', () => signOut(auth));
safeAddListener('closePendingBtn', 'click', () => signOut(auth));

safeAddListener('openModalBtn', 'click', () => createModal.classList.remove('hidden'));
safeAddListener('closeModalBtn', 'click', () => createModal.classList.add('hidden'));
safeAddListener('cancelBtn', 'click', () => createModal.classList.add('hidden'));

safeAddListener('closeDetailModalBtn', 'click', () => closeAllModals());

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        
        navItems.forEach(n => {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
        });
        e.currentTarget.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";

        if (statsContainer) statsContainer.classList.add('hidden');
        if (tasksContainer) tasksContainer.classList.add('hidden');
        if (clientsContainer) clientsContainer.classList.add('hidden');
        if (membersContainer) membersContainer.classList.add('hidden');
        if (approvalsContainer) approvalsContainer.classList.add('hidden');
        if (logsContainer) logsContainer.classList.add('hidden');
        if (libraryContainer) libraryContainer.classList.add('hidden');

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

const boardTableEl = document.getElementById('boardTable');
if (boardTableEl) {
    boardTableEl.addEventListener('click', (e) => {
        if (e.target.closest('.download-link') || e.target.closest('.img-preview-btn')) return;

        const delBtn = e.target.closest('.delete-task-btn');
        if (delBtn) {
            e.stopPropagation();
            const taskId = delBtn.getAttribute('data-id');
            if (taskId) deleteTask(taskId);
            return;
        }

        const editBtn = e.target.closest('.edit-task-btn');
        if (editBtn) {
            e.stopPropagation();
            const taskId = editBtn.getAttribute('data-id');
            if (taskId) openEditTaskModal(taskId);
            return;
        }

        const assignBtn = e.target.closest('.assign-task-btn');
        if (assignBtn) {
            e.stopPropagation();
            const taskId = assignBtn.getAttribute('data-id');
            if (taskId) openAssignModal(taskId);
            return;
        }

        const row = e.target.closest('.task-detail-trigger');
        if (row) {
            const taskId = row.getAttribute('data-id');
            if (taskId) openDetailModal(taskId);
        }
    });
}