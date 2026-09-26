/**
 * ADplanters x NOAH UNIVERSE - Application Main Module
 * File Location: ./js/app.js
 * Version: 1.4.0 (Fixed Tooltip Clipping & Table Cell Overflows)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// 어드민 이메일 및 전역 상태 데이터 보존
const ADMIN_EMAILS = ["hhjhhj422@gmail.com", "adp@adplanters.com", "dlghgus9997@gmail.com"];
let currentUserRole = ''; 
let currentUserName = ''; 
let currentUserEmail = ''; 
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

let allTasksData = []; // 검색 필터링을 위한 전역 배열

// 예산 관리 및 페이지네이션 전역 변수
let currentEditBudgetId = null;
let allClientsData = [];
let currentClientPage = 1;
const CLIENTS_PER_PAGE = 10;

// 대시보드 롤링 Ticker 타이머 보존 객체
let latestRollingInterval = null;
let progressRollingInterval = null;

// 접속자 IP 전역 보존 변수
let currentClientIP = '127.0.0.1';

// 신규 댓글 작성용 드래그앤드롭 누적 파일 배열
let newCommentSelectedFiles = [];

// 전역 시스템/관리자 메모 보존
let globalMemoContent = '';

// 클라이언트 상호명 비교 시 띄어쓰기 및 대소문자 제거 정규화 헬퍼
const normalizeName = (str) => (str || '').replace(/\s+/g, '').toLowerCase();

// 상호명 띄어쓰기 차이, 포함 관계를 지능적으로 검색하는 클라이언트 매칭 함수
const findClientByName = (clientName) => {
    if (!clientName || clientName === "📢 전체 공지") return null;
    const target = normalizeName(clientName);
    if (!target) return null;

    let found = allClientsData.find(c => normalizeName(c.name) === target);
    if (found) return found;

    return allClientsData.find(c => {
        const cNorm = normalizeName(c.name);
        return cNorm && (cNorm.includes(target) || target.includes(cNorm));
    }) || null;
};

// ============================================================================
// 클라이언트 IP 주소 자동 수집 헬퍼
// ============================================================================
async function fetchClientIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (data && data.ip) {
            currentClientIP = data.ip;
        }
    } catch (e) {
        console.warn("IP 수집 실패, 기본값 적용:", e);
    }
}
fetchClientIP();

// ============================================================================
// 2. DOM 요소 바인딩
// ============================================================================
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const pendingModal = document.getElementById('pendingModal');

const statsContainer = document.getElementById('statsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const clientsContainer = document.getElementById('clientsContainer');
const budgetContainer = document.getElementById('budgetContainer'); 
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
const budgetEditModal = document.getElementById('budgetEditModal'); 

const libraryViewModal = document.getElementById('libraryViewModal');
const libraryEditModal = document.getElementById('libraryEditModal');

// ============================================================================
// 3. 공통 유틸리티 & 워터마크 & 권한 검증 헬퍼 & 탭 라우팅
// ============================================================================
function safeAddListener(id, eventType, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(eventType, callback);
    }
}

function toggleMobileSidebar(forceState) {
    const sidebarEl = document.getElementById('sidebar');
    const overlayEl = document.getElementById('mobileOverlay');
    if (!sidebarEl) return;

    const isCurrentlyClosed = sidebarEl.classList.contains('-translate-x-full') || sidebarEl.classList.contains('hidden');
    const shouldOpen = forceState !== undefined ? forceState : isCurrentlyClosed;

    if (shouldOpen) {
        sidebarEl.classList.remove('-translate-x-full', 'hidden');
        sidebarEl.classList.add('translate-x-0');
        if (overlayEl) overlayEl.classList.remove('hidden');
    } else {
        sidebarEl.classList.add('-translate-x-full');
        sidebarEl.classList.remove('translate-x-0');
        if (overlayEl) overlayEl.classList.add('hidden');
    }
}

function checkIsAdmin() {
    if (currentUserRole === 'admin') return true;
    if (auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email)) return true;
    return false;
}

function checkIsAuthor(task) {
    if (!auth.currentUser || !task) return false;
    return (task.staff === currentUserName) || 
           (task.email === auth.currentUser.email) || 
           (task.uid === auth.currentUser.uid);
}

function switchTab(tabName, pushHistory = true) {
    const adminOnlyTabs = ['budget', 'members', 'approvals', 'logs'];
    const isAdmin = checkIsAdmin();

    if (adminOnlyTabs.includes(tabName) && !isAdmin) {
        alert("최상위 관리자(Admin) 권한이 필요한 메뉴입니다.");
        tabName = 'dashboard';
    }

    if (pushHistory) {
        const newUrl = `${window.location.pathname}?tab=${tabName}`;
        window.history.pushState({ tab: tabName }, '', newUrl);
    }

    toggleMobileSidebar(false);

    navItems.forEach(n => {
        const m = n.getAttribute('data-menu');
        if (m === tabName) {
            n.className = "nav-item flex items-center gap-3 bg-hermes text-white px-4 py-3 rounded-lg font-bold shadow-md shadow-orange-200/50 transition";
        } else {
            n.className = "nav-item flex items-center gap-3 text-gray-600 hover:bg-hermes-light hover:text-hermes px-4 py-3 rounded-lg font-medium transition";
        }
    });

    if (statsContainer) statsContainer.classList.add('hidden');
    if (tasksContainer) tasksContainer.classList.add('hidden');
    if (clientsContainer) clientsContainer.classList.add('hidden');
    if (budgetContainer) budgetContainer.classList.add('hidden'); 
    if (membersContainer) membersContainer.classList.add('hidden');
    if (approvalsContainer) approvalsContainer.classList.add('hidden');
    if (logsContainer) logsContainer.classList.add('hidden');
    if (libraryContainer) libraryContainer.classList.add('hidden');

    if (tabName === 'dashboard') {
        if (statsContainer) statsContainer.classList.remove('hidden');
        if (tasksContainer) tasksContainer.classList.remove('hidden');
        fetchTasks();
    } else if (tabName === 'inquiries') {
        if (tasksContainer) tasksContainer.classList.remove('hidden');
        fetchTasks();
    } else if (tabName === 'clients') {
        if (clientsContainer) clientsContainer.classList.remove('hidden');
        fetchClients();
    } else if (tabName === 'budget') {
        if (budgetContainer) budgetContainer.classList.remove('hidden');
        fetchClients(); 
    } else if (tabName === 'members') {
        if (membersContainer) membersContainer.classList.remove('hidden');
        fetchMembers();
    } else if (tabName === 'approvals') {
        if (approvalsContainer) approvalsContainer.classList.remove('hidden');
        fetchApprovals();
    } else if (tabName === 'logs') {
        if (logsContainer) logsContainer.classList.remove('hidden');
        fetchLogs();
    } else if (tabName === 'library') {
        if (libraryContainer) libraryContainer.classList.remove('hidden');
        fetchLibraryItems();
    }
}

function checkAllNavBadges() {
    const NOW = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const isWithin24Hours = (dateInput) => {
        if (!dateInput) return false;
        let timeMS = 0;
        if (typeof dateInput === 'string') {
            timeMS = new Date(dateInput.replace(/\./g, '-')).getTime();
        } else if (dateInput.toDate) {
            timeMS = dateInput.toDate().getTime();
        } else if (dateInput instanceof Date) {
            timeMS = dateInput.getTime();
        }
        return !isNaN(timeMS) && (NOW - timeMS) < TWENTY_FOUR_HOURS;
    };

    let hasNewInquiries = false;
    let hasNewClients = false;
    let hasNewLibrary = false;

    Object.values(tasksMap).forEach(t => { if (isWithin24Hours(t.createdAt || t.date)) hasNewInquiries = true; });
    Object.values(clientsMap).forEach(c => { if (isWithin24Hours(c.createdAt)) hasNewClients = true; });
    Object.values(libraryMap).forEach(l => { if (isWithin24Hours(l.createdAt)) hasNewLibrary = true; });

    const setMenuBadge = (menuName, showBadge) => {
        const targetLinks = document.querySelectorAll(`.nav-item[data-menu="${menuName}"]`);
        targetLinks.forEach(link => {
            const existingBadge = link.querySelector('.nav-new-badge');
            if (existingBadge) existingBadge.remove();
            if (showBadge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'nav-new-badge ml-auto relative flex h-2.5 w-2.5 shrink-0 self-center';
                badgeEl.innerHTML = `
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>
                `;
                link.appendChild(badgeEl);
            }
        });
    };

    setMenuBadge('inquiries', hasNewInquiries);
    setMenuBadge('clients', hasNewClients);
    setMenuBadge('library', hasNewLibrary);
}

function renderWatermark() {
    const container = document.getElementById('watermarkGrid');
    if (!container || container.children.length > 0) return;

    let rowsHtml = '';
    const textRow = "ADplanters X NOAH UNIVERSE COMPANY ";
    for (let i = 0; i < 24; i++) {
        const shiftStyle = (i % 2 === 0) ? 'margin-left: 0px;' : 'margin-left: 140px;';
        rowsHtml += `<div class="whitespace-nowrap font-black text-sm tracking-widest text-slate-800 select-none" style="${shiftStyle}">`;
        for (let j = 0; j < 8; j++) {
            rowsHtml += `<span style="margin-right:1.5rem;">${textRow}</span>`;
        }
        rowsHtml += `</div>`;
    }
    
    container.innerHTML = rowsHtml;
}

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

function closeAllModals() {
    const globalImgModal = document.getElementById('globalImageModal');
    if (globalImgModal) globalImgModal.classList.add('hidden');

    const modals = [
        createModal, editTaskModal, clientModal, 
        editClientModal, assignModal, detailModal, 
        libraryViewModal, libraryEditModal, pendingModal, budgetEditModal
    ]; 
    
    modals.forEach(m => { 
        if(m) {
            m.classList.add('hidden'); 
        }
    });
    
    document.body.style.overflow = '';
    
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'dashboard';
    window.history.pushState({ tab: activeTab }, '', `${window.location.pathname}?tab=${activeTab}`);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

[createModal, editTaskModal, clientModal, editClientModal, assignModal, detailModal, libraryViewModal, libraryEditModal, pendingModal, budgetEditModal].forEach(modalEl => {
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) closeAllModals();
        });

        const closeBtns = modalEl.querySelectorAll('.fa-xmark, button[title="닫기"], #closeLibViewModalBtn, #closeLibViewBtn');
        closeBtns.forEach(icon => {
            const btn = icon.closest('button') || icon;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            });
        });

        const cancelBtns = Array.from(modalEl.querySelectorAll('button')).filter(b => b.textContent.trim() === '취소');
        cancelBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            });
        });
    }
});

function hideAllViewersTooltips() {
    ['viewersTooltip', 'libViewersTooltip'].forEach(id => {
        const tooltip = document.getElementById(id);
        if (tooltip) {
            tooltip.classList.add('invisible', 'opacity-0', 'pointer-events-none');
            tooltip.classList.remove('visible', 'opacity-100', 'pointer-events-auto');
        }
    });
}

function toggleViewerTooltip(tooltipId, e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const tooltip = document.getElementById(tooltipId);
    if (!tooltip) return;

    const isCurrentlyVisible = !tooltip.classList.contains('invisible') && tooltip.classList.contains('visible');

    hideAllViewersTooltips();

    if (!isCurrentlyVisible) {
        tooltip.classList.remove('invisible', 'opacity-0', 'pointer-events-none');
        tooltip.classList.add('visible', 'opacity-100', 'pointer-events-auto');
    }
}

safeAddListener('viewCountBadgeBtn', 'click', (e) => toggleViewerTooltip('viewersTooltip', e));
safeAddListener('libViewCountBadgeBtn', 'click', (e) => toggleViewerTooltip('libViewersTooltip', e));

['viewCountBadgeWrapper', 'libViewCountBadgeWrapper'].forEach(wrapperId => {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
        wrapper.addEventListener('mouseleave', () => {
            hideAllViewersTooltips();
        });
    }
});

// ============================================================================
// 🌟 3.5. Note 영역 UI (명칭 "Note" 적용)
// ============================================================================
function initSideMemoWidget() {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    let widgetEl = document.getElementById('globalSideMemoWidget');
    if (!widgetEl) {
        widgetEl = document.createElement('div');
        widgetEl.id = 'globalSideMemoWidget';
        widgetEl.className = 'side-memo-widget mb-6 w-full';

        const headerSection = mainEl.querySelector('header');
        if (headerSection) {
            headerSection.after(widgetEl);
        } else {
            mainEl.prepend(widgetEl);
        }
    }

    renderSideMemoWidget();
    subscribeGlobalMemo();
}

function subscribeGlobalMemo() {
    try {
        const memoDocRef = doc(db, "system_settings", "global_memo");
        onSnapshot(memoDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                globalMemoContent = data.content || '';
            } else {
                globalMemoContent = '';
            }
            renderSideMemoWidget();
        });
    } catch (e) {
        console.error("Global memo subscription error:", e);
    }
}

function renderSideMemoWidget() {
    const widgetEl = document.getElementById('globalSideMemoWidget');
    if (!widgetEl) return;

    const isAdmin = checkIsAdmin();

    if (isAdmin) {
        widgetEl.innerHTML = `
            <div class="side-memo-header">
                <div class="side-memo-title">
                    <i class="fa-solid fa-note-sticky text-hermes"></i>
                    <span>Note</span>
                </div>
                <span class="side-memo-badge">Admin</span>
            </div>
            <div class="space-y-2">
                <textarea id="globalMemoTextarea" rows="3" placeholder="모든 계정에서 공통으로 열람 가능한 Note 내용을 입력하세요." class="w-full text-xs p-3 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hermes/40 bg-white font-medium resize-y leading-relaxed">${globalMemoContent}</textarea>
                <div class="flex justify-end gap-2">
                    <button type="button" id="saveGlobalMemoBtn" class="bg-hermes hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-floppy-disk"></i> 저장
                    </button>
                </div>
            </div>
        `;

        const saveBtn = document.getElementById('saveGlobalMemoBtn');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const textIn = document.getElementById('globalMemoTextarea');
                const val = textIn ? textIn.value.trim() : '';

                saveBtn.innerText = "저장 중...";
                saveBtn.disabled = true;

                try {
                    await setDoc(doc(db, "system_settings", "global_memo"), {
                        content: val,
                        updatedAt: new Date().toISOString(),
                        updatedBy: currentUserName
                    }, { merge: true });

                    await logActivity("Note 수정", `공유 Note 업데이트 완료`);
                    alert("Note가 저장되었습니다.");
                } catch (err) {
                    alert("Note 저장 실패: " + err.message);
                } finally {
                    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> 저장`;
                    saveBtn.disabled = false;
                }
            };
        }
    } else {
        const displayHtml = globalMemoContent
            ? `<div class="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-medium bg-white p-3 rounded-xl border border-orange-100">${globalMemoContent}</div>`
            : `<div class="text-xs text-gray-400 italic py-2">등록된 Note가 없습니다.</div>`;

        widgetEl.innerHTML = `
            <div class="side-memo-header">
                <div class="side-memo-title">
                    <i class="fa-solid fa-note-sticky text-hermes"></i>
                    <span>Note</span>
                </div>
                <span class="side-memo-badge">공유</span>
            </div>
            ${displayHtml}
        `;
    }
}

// ============================================================================
// 🌟 3.6. 잘림 없는 최상위 화이트 메모지 스타일 커스텀 글로벌 툴팁 DOM 생성 & 위치 정밀 제어
// ============================================================================
function getOrCreateGlobalTooltip() {
    let tooltip = document.getElementById('globalMemoTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'globalMemoTooltip';
        tooltip.innerHTML = `
            <div class="memo-tooltip-header">
                <i class="fa-solid fa-sticky-note"></i>
                <span>메모 상세 내용</span>
            </div>
            <div class="memo-tooltip-body" id="globalMemoTooltipBody"></div>
        `;
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function showGlobalMemoTooltip(text, e) {
    if (!text || text === '-') return;
    const tooltip = getOrCreateGlobalTooltip();
    const bodyEl = document.getElementById('globalMemoTooltipBody');
    if (bodyEl) bodyEl.textContent = text;

    tooltip.classList.add('visible');
    positionGlobalMemoTooltip(e);
}

function moveGlobalMemoTooltip(e) {
    const tooltip = document.getElementById('globalMemoTooltip');
    if (tooltip && tooltip.classList.contains('visible')) {
        positionGlobalMemoTooltip(e);
    }
}

function hideGlobalMemoTooltip() {
    const tooltip = document.getElementById('globalMemoTooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

function positionGlobalMemoTooltip(e) {
    const tooltip = document.getElementById('globalMemoTooltip');
    if (!tooltip) return;

    const offset = 14;
    let left = e.clientX + offset;
    let top = e.clientY + offset;

    const tooltipWidth = tooltip.offsetWidth || 220;
    const tooltipHeight = tooltip.offsetHeight || 80;

    // 우측 화면 한계 진입 시 마우스 커서 좌측 옆으로 자동 전환
    if (left + tooltipWidth > window.innerWidth - 16) {
        left = e.clientX - tooltipWidth - offset;
    }
    // 하단 화면 한계 진입 시 마우스 커서 위쪽 옆으로 자동 전환
    if (top + tooltipHeight > window.innerHeight - 16) {
        top = e.clientY - tooltipHeight - offset;
    }
    // 상단 및 좌측 바운더리 보장
    if (top < 16) top = 16;
    if (left < 16) left = 16;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function bindMemoTooltipEvents(containerEl) {
    if (!containerEl) return;
    containerEl.querySelectorAll('.memo-hover-trigger').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            const memoStr = el.getAttribute('data-memo');
            showGlobalMemoTooltip(memoStr, e);
        });
        el.addEventListener('mousemove', (e) => {
            moveGlobalMemoTooltip(e);
        });
        el.addEventListener('mouseleave', () => {
            hideGlobalMemoTooltip();
        });
    });
}

// ============================================================================
// 4. 주/부 담당자 선택 UI 생성 헬퍼 함수
// ============================================================================
async function buildManagerSelectionUI(containerEl, currentManagersArr, checkboxClassName, primarySelectId) {
    containerEl.innerHTML = '<div class="text-xs text-gray-400 p-2 text-center font-bold"><i class="fa-solid fa-spinner animate-spin mr-1"></i> 멤버 목록 불러오는 중...</div>';
    try {
        const usersSnap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
        
        const primary = (currentManagersArr && currentManagersArr.length > 0) ? currentManagersArr[0] : '';
        const subs = (currentManagersArr && currentManagersArr.length > 1) ? currentManagersArr.slice(1) : [];
        
        let selectHtml = `
            <div class="mb-3">
                <label class="block text-[10px] font-black text-red-500 mb-1">주 담당자 (1명 필수 지정)</label>
                <select id="${primarySelectId}" class="w-full text-xs border border-red-200 rounded-lg p-2 focus:border-red-500 outline-none font-bold text-gray-800 bg-red-50/30">
                    <option value="">선택 안함</option>
        `;
        
        let checkHtml = `
            <div>
                <div class="flex justify-between items-center mb-1">
                    <label class="block text-[10px] font-bold text-gray-600">부 담당자 (다중 선택)</label>
                    <button type="button" class="text-[9px] bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-2 py-0.5 rounded transition ${checkboxClassName}-select-all">전체 선택</button>
                </div>
                <div class="flex flex-col gap-1 max-h-32 overflow-y-auto p-1.5 bg-white border border-gray-200 rounded-lg shadow-inner">
        `;
        
        usersSnap.forEach(uDoc => {
            const u = uDoc.data();
            const isPrimary = u.name === primary ? 'selected' : '';
            selectHtml += `<option value="${u.name}" ${isPrimary}>${u.name}</option>`;
            
            const isSub = subs.includes(u.name) ? 'checked' : '';
            checkHtml += `
                <label class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer text-[11px] font-bold text-gray-700 transition">
                    <input type="checkbox" value="${u.name}" class="${checkboxClassName} rounded text-hermes" ${isSub} />
                    <span>${u.name} <span class="text-[9px] text-gray-400 font-normal">(${u.email})</span></span>
                </label>
            `;
        });
        selectHtml += `</select></div>`;
        checkHtml += `</div></div>`;
        
        containerEl.innerHTML = selectHtml + checkHtml;

        const selectAllBtn = containerEl.querySelector(`.${checkboxClassName}-select-all`);
        if (selectAllBtn) {
            let isAllSelected = false;
            
            const allCheckboxes = containerEl.querySelectorAll(`.${checkboxClassName}`);
            const checkedBoxes = containerEl.querySelectorAll(`.${checkboxClassName}:checked`);
            if (allCheckboxes.length > 0 && allCheckboxes.length === checkedBoxes.length) {
                isAllSelected = true;
                selectAllBtn.innerText = "전체 해제";
            }

            selectAllBtn.addEventListener('click', () => {
                isAllSelected = !isAllSelected;
                allCheckboxes.forEach(cb => {
                    cb.checked = isAllSelected;
                });
                selectAllBtn.innerText = isAllSelected ? "전체 해제" : "전체 선택";
            });
        }
    } catch (e) {
        containerEl.innerHTML = '<div class="text-xs text-red-500 p-2 text-center">멤버 목록 로드 실패</div>';
    }
}

// ============================================================================
// 5. 전역 문서 클릭 및 알림 이벤트 
// ============================================================================
safeAddListener('notifBellBtn', 'click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
});

safeAddListener('closeNotifBtn', 'click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.add('hidden');
});

document.addEventListener('click', async (e) => {
    if (!e.target.closest('#viewCountBadgeWrapper') && !e.target.closest('#libViewCountBadgeWrapper')) {
        hideAllViewersTooltips();
    }

    if (!e.target.closest('#notifBellBtn') && !e.target.closest('#notifDropdown')) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    const editClientBtn = e.target.closest('.edit-client-btn');
    if (editClientBtn) {
        e.preventDefault();
        e.stopPropagation();
        const clientId = editClientBtn.getAttribute('data-id');
        if (clientId) openEditClientModal(clientId);
        return;
    }

    const delClientBtn = e.target.closest('.delete-client-btn');
    if (delClientBtn) {
        e.preventDefault();
        e.stopPropagation();
        const clientId = delClientBtn.getAttribute('data-id');
        if (clientId) deleteClient(clientId);
        return;
    }

    const editBudgetBtn = e.target.closest('.edit-budget-btn');
    if (editBudgetBtn) {
        e.preventDefault();
        e.stopPropagation();
        const clientId = editBudgetBtn.getAttribute('data-id');
        if (clientId) openBudgetEditModal(clientId);
        return;
    }

    const copyTextBtn = e.target.closest('.copy-text-btn');
    if (copyTextBtn) {
        e.preventDefault();
        e.stopPropagation();
        const textToCopy = copyTextBtn.getAttribute('data-copy');
        const labelName = copyTextBtn.getAttribute('title') || '계정 정보';
        if (textToCopy) {
            copyToClipboard(textToCopy, labelName);
        }
        return;
    }

    const editBtn = e.target.closest('.edit-task-btn');
    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = editBtn.getAttribute('data-id');
        if (taskId) openEditTaskModal(taskId);
        return;
    }

    const assignBtn = e.target.closest('.assign-task-btn');
    if (assignBtn) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = assignBtn.getAttribute('data-id');
        if (taskId) openAssignModal(taskId);
        return;
    }

    const delBtn = e.target.closest('.delete-task-btn');
    if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = delBtn.getAttribute('data-id');
        if (taskId) deleteTask(taskId);
        return;
    }

    const taskRow = e.target.closest('.task-detail-trigger');
    if (taskRow && !e.target.closest('a') && !e.target.closest('button')) {
        const taskId = taskRow.getAttribute('data-id');
        if (taskId) openDetailModal(taskId);
        return;
    }

    const logoTrigger = e.target.closest('#mobileLogoBtn') || e.target.closest('#sidebarLogoBtn') || e.target.closest('.logo-home-btn');
    if (logoTrigger) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        switchTab('dashboard', true);
        return;
    }

    const closeSidebarTrigger = e.target.closest('#closeSidebarBtn') || 
                                e.target.closest('#closeSidebar') || 
                                (e.target.closest('button') && e.target.closest('button').querySelector('#closeSidebarBtn'));
    if (closeSidebarTrigger) {
        e.preventDefault();
        e.stopPropagation();
        toggleMobileSidebar(false);
        return;
    }

    const mobileMenuTrigger = e.target.closest('#mobileMenuBtn') || 
                              e.target.closest('#hamburgerBtn') || 
                              e.target.closest('#openSidebarBtn') || 
                              e.target.closest('.mobile-menu-btn') || 
                              (e.target.closest('button') && (e.target.closest('button').querySelector('.fa-bars') || e.target.closest('button').querySelector('.fa-bars-staggered')));

    if (mobileMenuTrigger) {
        e.preventDefault();
        e.stopPropagation();
        toggleMobileSidebar();
        return;
    }

    if (e.target.closest('#mobileOverlay')) {
        toggleMobileSidebar(false);
        return;
    }

    // 신규 클라이언트 등록 버튼 클릭 시
    const addClientBtn = e.target.closest('#openClientModalBtn');
    if (addClientBtn && clientModal) {
        e.preventDefault();
        e.stopPropagation();
        
        const form = document.getElementById('clientForm');
        if (form) form.reset(); 

        const regIn = document.getElementById('c_registerName');
        if (regIn) regIn.value = currentUserName; 

        const contractPeriodIn = document.getElementById('c_contractPeriod');
        if (contractPeriodIn) {
            if (checkIsAdmin()) {
                contractPeriodIn.disabled = false;
                contractPeriodIn.placeholder = "예: 2024.01.01 ~ 2024.12.31";
                contractPeriodIn.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
            } else {
                contractPeriodIn.disabled = true;
                contractPeriodIn.placeholder = "최상위 관리자(Admin) 전용 설정 항목";
                contractPeriodIn.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
            }
        }
        
        clientModal.classList.remove('hidden');
        clientModal.style.zIndex = "99999";
        return;
    }

    // 신규 이슈 등록
    const openTaskModalBtn = e.target.closest('#openModalBtn');
    if (openTaskModalBtn && createModal) {
        e.preventDefault();
        e.stopPropagation();
        
        if (allClientsData.length === 0) {
            await fetchClients();
        }

        const clientSelect = document.getElementById('inputClient');
        if (clientSelect) {
            clientSelect.innerHTML = `
                <option value="">클라이언트를 선택하세요</option>
                <option value="📢 전체 공지">📢 [전체 공지]</option>
            `;
            allClientsData.forEach(c => {
                clientSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        }

        const assignList = document.getElementById('createAssignManagerList');
        if (assignList && checkIsAdmin()) {
            await buildManagerSelectionUI(assignList, [], 'create-assign-manager-checkbox', 'createPrimarySelect');
            const assignArea = document.getElementById('assignManagerArea');
            if(assignArea) assignArea.classList.remove('hidden');
        }
        
        const budgetInfo = document.getElementById('createClientBudgetInfo');
        if (budgetInfo) budgetInfo.classList.add('hidden');

        createModal.classList.remove('hidden');
        createModal.style.zIndex = "99999";
        return;
    }

    const imgTrigger = e.target.closest('.img-preview-btn');
    if (imgTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const url = imgTrigger.getAttribute('data-url');
        if (url) openImageModal(url);
    }

    const shareTrigger = e.target.closest('#shareLinkBtn') || (e.target.closest('button') && e.target.closest('button').textContent.includes('링크 복사'));
    if (shareTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const targetTaskId = currentDetailTaskId || new URLSearchParams(window.location.search).get('id');
        if (targetTaskId) {
            const shareUrl = `${window.location.origin}${window.location.pathname}?id=${targetTaskId}`;
            copyToClipboard(shareUrl, "게시글 링크");
        } else {
            copyToClipboard(window.location.href, "현재 페이지 링크");
        }
    }
});

// 업무 등록 시 클라이언트 드롭다운 선택 이벤트 연동
safeAddListener('inputClient', 'change', (e) => {
    const clientName = e.target.value;
    const infoDiv = document.getElementById('createClientBudgetInfo');
    if(!infoDiv) return;
    
    if (clientName === "📢 전체 공지") {
        infoDiv.innerHTML = `<span class="font-bold text-blue-600"><i class="fa-solid fa-bullhorn mr-1"></i> 모든 파트너 및 멤버에게 공개되는 전체 공지사항입니다.</span>`;
        infoDiv.classList.remove('hidden');
        return;
    }
    
    const client = findClientByName(clientName);
    if (client) {
        const total = Number(client.totalBudget) || 0;
        const recharged = Number(client.rechargedBudget) || 0;
        const used = Number(client.usedBudget) || 0;
        const rem = (total + recharged) - used;
        infoDiv.innerHTML = `<span class="font-bold text-hermes">현재 충전대기: ${rem.toLocaleString()}원</span> (총 ${((total+recharged)/10000).toLocaleString()}만 / 충전금액 ${(used/10000).toLocaleString()}만)`;
        infoDiv.classList.remove('hidden');
    } else {
        infoDiv.classList.add('hidden');
    }
});

window.openEditTaskModal = openEditTaskModal;
window.openAssignModal = openAssignModal;
window.deleteTask = deleteTask;
window.openDetailModal = openDetailModal;
window.openEditClientModal = openEditClientModal;
window.deleteClient = deleteClient;
window.openBudgetEditModal = openBudgetEditModal;

safeAddListener('taskSearchTarget', 'change', applyTaskFilters);
safeAddListener('taskSearchKeyword', 'input', applyTaskFilters);
safeAddListener('taskStatusFilter', 'change', applyTaskFilters);

async function uploadFilesToStorage(fileList, folderName) {
    const uploadedFiles = [];
    const filesArray = Array.from(fileList); 

    for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const extIndex = file.name.lastIndexOf('.');
        const nameWithoutExt = extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
        const ext = extIndex !== -1 ? file.name.substring(extIndex) : '';
        const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileName = `${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}${ext}`;
        const storageReference = ref(storage, `${folderName}/${uniqueFileName}`);
        
        try {
            await uploadBytes(storageReference, file);
            const downloadUrl = await getDownloadURL(storageReference);
            uploadedFiles.push({ fileName: file.name, fileUrl: downloadUrl });
        } catch (error) {
            console.error("Storage 업로드 상세 오류 객체:", error);
            const detailMsg = error.code ? `코드: ${error.code} / 메시지: ${error.message}` : error.message;
            throw new Error(`[${file.name}] 업로드 실패 (${detailMsg})`);
        }
    }
    return uploadedFiles;
}

function setupDragAndDrop(dropAreaId, fileInputId) {
    const dropArea = document.getElementById(dropAreaId);
    const fileInput = document.getElementById(fileInputId);
    if (!dropArea) return;

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

    if (fileInputId !== 'commentFileInputBox') {
        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt.files && dt.files.length > 0 && fileInput) {
                fileInput.files = dt.files;
            }
        }, false);
    }
}

function isImageFile(fileName, url) {
    const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerName = (fileName || '').toLowerCase();
    const lowerUrl = (url || '').toLowerCase();
    const isDataImg = lowerUrl.startsWith('data:image/');
    return isDataImg || imgExts.some(ext => lowerName.endsWith(ext) || lowerUrl.includes(ext));
}

function renderFileButtons(item, isTableList = false) {
    if (item.files && item.files.length > 0) {
        return item.files.map((f, idx) => {
            const url = f.fileUrl || f.fileData; 
            const fileName = f.fileName || '첨부파일';
            const isImg = isImageFile(fileName, url);

            if (isTableList) {
                const badgeLabel = isImg ? `[이미지 ${idx + 1}]` : `[파일 ${idx + 1}]`;
                return `
                    <a href="${url}" target="_blank" download="${fileName}" onclick="event.stopPropagation();" class="download-link inline-flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-hermes hover:text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-200 transition my-0.5 shadow-2xs whitespace-nowrap" title="${fileName}">
                        <i class="${isImg ? 'fa-solid fa-image' : 'fa-solid fa-paperclip'} text-[9px]"></i> ${badgeLabel}
                    </a>
                `;
            }

            if (isImg) {
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
    return `<span class="text-gray-300 text-[10px] whitespace-nowrap">첨부파일 없음</span>`;
}

async function logActivity(action, details = "") {
    if (!auth.currentUser) return;
    try {
        await addDoc(collection(db, "activity_logs"), {
            uid: auth.currentUser.uid,
            name: currentUserName || auth.currentUser.displayName || "Unknown",
            email: auth.currentUser.email,
            ip: currentClientIP,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Log error:", e);
    }
}

function copyToClipboard(text, label = "링크") {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label}가 클립보드에 복사되었습니다.\n\n` + text);
        }).catch(err => {
            fallbackCopyToClipboard(text, label);
        });
    } else {
        fallbackCopyToClipboard(text, label);
    }
}

function fallbackCopyToClipboard(text, label = "링크") {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert(`${label}가 클립보드에 복사되었습니다.\n\n` + text);
    } catch (err) {
        alert("링크 복사에 실패했습니다. 주소창의 URL을 직접 복사해 주세요.");
    } finally {
        document.body.removeChild(textArea);
    }
}

// ============================================================================
// 6. 인증 및 사용자 권한 제어
// ============================================================================
getRedirectResult(auth).catch((error) => {
    if (error && error.code !== 'auth/popup-closed-by-user') {
        console.error("Redirect 로그인 에러 객체:", error);
    }
});

onAuthStateChanged(auth, async (user) => {
    renderWatermark();

    if (user) {
        currentUserName = user.displayName || (user.email ? user.email.split('@')[0] : "담당자");
        currentUserEmail = user.email || '';

        const staffInput = document.getElementById('inputStaff');
        if(staffInput) staffInput.value = currentUserName;

        const userEmailEl = document.getElementById('currentUserEmail');
        if (userEmailEl) userEmailEl.innerText = currentUserEmail;

        if(!isInitialLoginLogged) {
            logActivity("로그인", "시스템에 성공적으로 접속했습니다.");
            isInitialLoginLogged = true;
        }

        if (ADMIN_EMAILS.includes(user.email)) {
            currentUserRole = 'admin';
            try {
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, { 
                    email: user.email, 
                    name: currentUserName, 
                    role: "admin", 
                    status: "approved" 
                }, { merge: true });
            } catch (err) {
                console.error("Admin user sync error:", err);
            }
            showDashboard(user);
            return;
        }

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, { 
                    email: user.email, 
                    name: currentUserName, 
                    role: "player", 
                    status: "pending", 
                    createdAt: new Date().toISOString() 
                }, { merge: true });
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
        } catch (dbErr) {
            console.error("Firestore user doc fetch error:", dbErr);
            currentUserRole = 'player';
            showDashboard(user);
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
    initNewCommentDragAndDrop();

    initSideMemoWidget(); 
    fetchClients();

    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || urlParams.get('menu') || 'dashboard';
    switchTab(initialTab, false);
}

function showPendingPopup() {
    if(loginSection) loginSection.classList.remove('hidden');
    if(dashboardSection) dashboardSection.classList.add('hidden');
    if(pendingModal) pendingModal.classList.remove('hidden');
}

// ============================================================================
// 7. 업무 이슈/요청 게시판
// ============================================================================
safeAddListener('openModalBtn', 'click', () => {
    if (createModal) {
        createModal.classList.remove('hidden');
        createModal.style.zIndex = "99999";
    }
});

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
    const taskType = document.getElementById('inputType').value;
    const isAdmin = checkIsAdmin();
    
    let assignedManagersArr = [];
    if (isAdmin) {
        const pSel = document.getElementById('createPrimarySelect');
        const pVal = pSel ? pSel.value : '';
        if(pVal) assignedManagersArr.push(pVal);

        const checkboxes = document.querySelectorAll('.create-assign-manager-checkbox:checked');
        checkboxes.forEach(cb => {
            if(cb.value !== pVal) assignedManagersArr.push(cb.value);
        });
    }

    const authorStaffName = document.getElementById('inputStaff').value || currentUserName || '담당자';
    const selectedClient = document.getElementById('inputClient').value; 

    const newTask = {
        client: selectedClient,
        type: taskType,
        agency: document.getElementById('inputAgency').value,
        title: tTitle,
        content: document.getElementById('inputContent').value,
        files: filesArr, 
        staff: authorStaffName, 
        email: auth.currentUser ? auth.currentUser.email : '',
        uid: auth.currentUser ? auth.currentUser.uid : '',
        assignedManagers: assignedManagersArr,
        status: "답변대기", 
        views: 0,
        viewers: [],
        date: dateStr,
        createdAt: new Date().toISOString(), 
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

async function openEditTaskModal(taskId) {
    const task = tasksMap[taskId];
    if (!task) return;
    currentDetailTaskId = taskId;

    if (allClientsData.length === 0) {
        await fetchClients();
    }

    const clientSelect = document.getElementById('editTaskClient');
    const titleIn = document.getElementById('editTaskTitle');
    const typeIn = document.getElementById('editTaskType');
    const agencyIn = document.getElementById('editTaskAgency');
    const contentIn = document.getElementById('editTaskContent');

    if (clientSelect) {
        clientSelect.innerHTML = `
            <option value="">클라이언트를 선택하세요</option>
            <option value="📢 전체 공지" ${task.client === '📢 전체 공지' ? 'selected' : ''}>📢 [전체 공지]</option>
        `;
        allClientsData.forEach(c => {
            const isSelected = (findClientByName(task.client)?.id === c.id) ? 'selected' : '';
            clientSelect.innerHTML += `<option value="${c.name}" ${isSelected}>${c.name}</option>`;
        });
    }

    if (titleIn) titleIn.value = task.title || '';
    if (typeIn) typeIn.value = task.type || '보고서';
    if (agencyIn) agencyIn.value = task.agency || 'noah';
    if (contentIn) contentIn.value = task.content || '';

    const editAssignArea = document.getElementById('editAssignManagerArea');
    const editAssignList = document.getElementById('editAssignManagerList');
    if (editAssignArea && editAssignList && checkIsAdmin()) {
        editAssignArea.classList.remove('hidden');
        await buildManagerSelectionUI(editAssignList, task.assignedManagers || [], 'edit-assign-manager-checkbox', 'editTaskPrimarySelect');
    }

    if (editTaskModal) {
        editTaskModal.classList.remove('hidden');
        editTaskModal.style.zIndex = "99999"; 
    }
}

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
            listContainer.className = 'my-4 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[300px] overflow-y-auto shadow-inner';
            
            const pDesc = modalCard.querySelector('p');
            if (pDesc) {
                pDesc.after(listContainer);
            } else {
                formContainer.prepend(listContainer);
            }
        }

        if (listContainer) {
            await buildManagerSelectionUI(listContainer, task.assignedManagers || [], 'assign-manager-checkbox', 'assignPrimarySelect');
        }

        assignModal.classList.remove('hidden');
        assignModal.style.zIndex = "99999";
        bindAssignSubmitEvents();
    }
}

async function executeAssignManagers() {
    const targetId = currentAssignClientId || currentDetailTaskId;
    if (!targetId) {
        alert("대상을 찾을 수 없습니다.");
        return;
    }

    const submitBtn = assignModal.querySelector('button[type="submit"]') || 
                      Array.from(assignModal.querySelectorAll('button')).find(b => b.textContent.includes('배정') || b.textContent.includes('완료'));
    
    const origText = submitBtn ? submitBtn.innerText : '배정 완료';
    if (submitBtn) {
        submitBtn.innerText = "저장 중...";
        submitBtn.disabled = true;
    }

    try {
        const pSel = document.getElementById('assignPrimarySelect');
        const pVal = pSel ? pSel.value : '';
        let selectedManagers = [];
        if (pVal) selectedManagers.push(pVal);

        const checkboxes = assignModal.querySelectorAll('.assign-manager-checkbox:checked');
        checkboxes.forEach(cb => {
            if(cb.value !== pVal) selectedManagers.push(cb.value);
        });

        await updateDoc(doc(db, "crm_tasks", targetId), {
            assignedManagers: selectedManagers
        });

        if (tasksMap[targetId]) {
            tasksMap[targetId].assignedManagers = selectedManagers;
        }

        alert("담당자가 연결되었습니다.");
        assignModal.classList.add('hidden');

        await fetchTasks();

        if (detailModal && !detailModal.classList.contains('hidden')) {
            openDetailModal(targetId);
        }
    } catch (err) {
        console.error("담당자 배정 오류:", err);
        alert("담당자 배정 실패: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        }
    }
}

function bindAssignSubmitEvents() {
    const submitBtn = assignModal.querySelector('button[type="submit"]') || 
                      Array.from(assignModal.querySelectorAll('button')).find(b => b.textContent.includes('배정') || b.textContent.includes('완료'));
    
    if (submitBtn) {
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await executeAssignManagers();
        };
    }

    const assignForm = assignModal.querySelector('form') || document.getElementById('assignForm');
    if (assignForm) {
        assignForm.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await executeAssignManagers();
        };
    }
}

safeAddListener('editTaskForm', 'submit', async (e) => {
    e.preventDefault();
    if (!currentDetailTaskId) return;

    const submitBtn = editTaskModal.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerText : '수정 완료 저장';
    if (submitBtn) {
        submitBtn.innerText = "저장 중...";
        submitBtn.disabled = true;
    }

    try {
        const clientVal = document.getElementById('editTaskClient').value;
        const titleVal = document.getElementById('editTaskTitle').value;
        const typeVal = document.getElementById('editTaskType').value;
        const agencyVal = document.getElementById('editTaskAgency').value;
        const contentVal = document.getElementById('editTaskContent').value;
        const fileInput = document.getElementById('editTaskFile');

        let updatedData = {
            client: clientVal,
            title: titleVal,
            type: typeVal,
            agency: agencyVal,
            content: contentVal,
            updatedAt: new Date().toISOString()
        };

        if (fileInput && fileInput.files.length > 0) {
            const newFiles = await uploadFilesToStorage(fileInput.files, "crm_tasks");
            updatedData.files = newFiles;
        }

        if (checkIsAdmin()) {
            const pSel = document.getElementById('editTaskPrimarySelect');
            const pVal = pSel ? pSel.value : '';
            let mgrs = [];
            if(pVal) mgrs.push(pVal);

            const checkboxes = editTaskModal.querySelectorAll('.edit-assign-manager-checkbox:checked');
            checkboxes.forEach(cb => {
                if(cb.value !== pVal) mgrs.push(cb.value);
            });
            updatedData.assignedManagers = mgrs;
        }

        await updateDoc(doc(db, "crm_tasks", currentDetailTaskId), updatedData);
        Object.assign(tasksMap[currentDetailTaskId], updatedData);

        if (editTaskModal) {
            editTaskModal.classList.add('hidden');
        }
        alert("이슈 정보가 수정되었습니다.");
        
        await fetchTasks();
        if (detailModal && !detailModal.classList.contains('hidden')) {
            openDetailModal(currentDetailTaskId);
        }
    } catch (err) { 
        alert("이슈 수정 실패: " + err.message); 
    } finally {
        if (submitBtn) {
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        }
    }
});

function renderRollingTickers(tasksList) {
    const latestListEl = document.getElementById('tickerLatestList');
    const progressListEl = document.getElementById('tickerProgressList');

    if (!latestListEl || !progressListEl) return;

    const latestTasks = [...tasksList].slice(0, 10);
    const progressTasks = tasksList.filter(t => t.status === '진행중' || t.status === '답변대기').slice(0, 10);

    const buildTickerItemsHtml = (items) => {
        if (items.length === 0) {
            return `<li class="h-[40px] flex items-center text-gray-400 font-normal px-2">등록된 항목이 없습니다.</li>`;
        }
        return items.map(item => {
            const primaryMgr = (item.assignedManagers && item.assignedManagers.length > 0) ? item.assignedManagers[0] : '미지정';
            const extraCnt = (item.assignedManagers && item.assignedManagers.length > 1) ? ` <span class="text-gray-500 font-medium ml-0.5">+${item.assignedManagers.length - 1}</span>` : '';
            
            return `
            <li class="h-[40px] flex items-center justify-between group cursor-pointer task-detail-trigger border-b border-gray-50 last:border-0 hover:bg-orange-50/50 px-2 transition-colors shrink-0" data-id="${item.id}">
                <div class="flex items-center gap-2 truncate pr-2">
                    <span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold shrink-0">${item.client || '공지'}</span>
                    <span class="truncate font-bold text-gray-800 group-hover:text-hermes transition">${item.title}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 hidden sm:inline-block whitespace-nowrap"><i class="fa-solid fa-user text-[9px] mr-0.5"></i>${primaryMgr}${extraCnt}</span>
                    <span class="text-[10px] text-gray-400 font-normal whitespace-nowrap">${item.date || ''}</span>
                </div>
            </li>
        `}).join('');
    };

    let latestHtml = buildTickerItemsHtml(latestTasks);
    if (latestTasks.length > 3) {
        latestHtml += buildTickerItemsHtml(latestTasks.slice(0, 3)); 
    }
    latestListEl.innerHTML = latestHtml;

    let progressHtml = buildTickerItemsHtml(progressTasks);
    if (progressTasks.length > 3) {
        progressHtml += buildTickerItemsHtml(progressTasks.slice(0, 3));
    }
    progressListEl.innerHTML = progressHtml;

    if (latestRollingInterval) clearInterval(latestRollingInterval);
    if (progressRollingInterval) clearInterval(progressRollingInterval);

    const startVerticalRoll = (listEl, itemCount) => {
        if (itemCount <= 3) return null; 
        let currentIndex = 0;
        return setInterval(() => {
            currentIndex++;
            listEl.style.transition = 'transform 0.5s ease-in-out';
            listEl.style.transform = `translateY(-${currentIndex * 40}px)`;

            if (currentIndex === itemCount) { 
                setTimeout(() => {
                    listEl.style.transition = 'none';
                    currentIndex = 0;
                    listEl.style.transform = `translateY(0)`;
                }, 500); 
            }
        }, 3000);
    };

    latestRollingInterval = startVerticalRoll(latestListEl, latestTasks.length);
    progressRollingInterval = startVerticalRoll(progressListEl, progressTasks.length);
}

function updateNotifications(tasksList) {
    const notifBadge = document.getElementById('notifBadge');
    const notifList = document.getElementById('notifList');

    if (!currentUserName) return;

    const myNotifs = [];

    tasksList.forEach(task => {
        const isAssigned = task.assignedManagers && task.assignedManagers.includes(currentUserName);
        const isTagged = (task.title && task.title.includes(`@${currentUserName}`)) ||
                         (task.content && task.content.includes(`@${currentUserName}`)) ||
                         (task.comments && task.comments.some(c => c.text && c.text.includes(`@${currentUserName}`)));

        if (isAssigned || isTagged) {
            const reason = isTagged ? '💬 멘션 태그됨' : '📌 담당자 지정됨';
            myNotifs.push({
                id: task.id,
                title: task.title,
                client: task.client,
                reason: reason,
                date: task.date || '최신'
            });
        }
    });

    const buildNotifHtml = (notifs) => {
        if (notifs.length === 0) return `<div class="p-5 text-center text-gray-400 text-xs">새로운 알림이 없습니다.</div>`;
        return notifs.map(n => `
            <div class="p-3 hover:bg-orange-50/50 transition cursor-pointer task-detail-trigger border-b border-gray-50 last:border-0" data-id="${n.id}">
                <div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span class="font-bold text-hermes">${n.reason}</span>
                    <span>${n.date}</span>
                </div>
                <div class="font-bold text-gray-800 text-xs truncate leading-snug">${n.title}</div>
                <div class="text-[10px] text-gray-500 truncate mt-1"><i class="fa-solid fa-building text-[9px] mr-1"></i>${n.client || '공지'}</div>
            </div>
        `).join('');
    };

    if (myNotifs.length > 0) {
        if (notifBadge) { notifBadge.innerText = myNotifs.length; notifBadge.classList.remove('hidden'); }
    } else {
        if (notifBadge) notifBadge.classList.add('hidden');
    }

    if (notifList) notifList.innerHTML = buildNotifHtml(myNotifs);
}

function updateDashboardStats(tasksList) {
    const statTotalEl = document.getElementById('statTotal');
    const statWaitEl = document.getElementById('statWait');
    const statIngEl = document.getElementById('statIng');
    const statDoneEl = document.getElementById('statDone');

    if (!statTotalEl || !statWaitEl || !statIngEl || !statDoneEl) return;

    let total = 0, wait = 0, ing = 0, done = 0;

    tasksList.forEach(t => {
        total++;
        const st = (t.status || '').trim();
        
        if (st === '답변대기' || st === '대기중' || st === '') {
            wait++;
        } else if (st === '진행중') {
            ing++;
        } else if (st === '처리완료' || st === '답변완료' || st === '완료') {
            done++;
        }
    });

    statTotalEl.innerHTML = `${total}<span class="text-xs font-medium text-gray-500 ml-1">개</span>`;
    statWaitEl.innerHTML = `${wait}<span class="text-xs font-medium text-gray-500 ml-1">건</span>`;
    statIngEl.innerHTML = `${ing}<span class="text-xs font-medium text-gray-500 ml-1">건</span>`;
    statDoneEl.innerHTML = `${done}<span class="text-xs font-medium text-gray-500 ml-1">건</span>`;
}

function applyTaskFilters() {
    const target = document.getElementById('taskSearchTarget') ? document.getElementById('taskSearchTarget').value : 'all';
    const keyword = document.getElementById('taskSearchKeyword') ? document.getElementById('taskSearchKeyword').value.trim().toLowerCase() : '';
    const status = document.getElementById('taskStatusFilter') ? document.getElementById('taskStatusFilter').value : 'all';

    const filteredData = allTasksData.filter(task => {
        if (status !== 'all' && task.status !== status) return false;

        if (keyword) {
            const clientName = (task.client || '').toLowerCase();
            const titleName = (task.title || '').toLowerCase();
            
            if (target === 'client') {
                if (!clientName.includes(keyword)) return false;
            } else if (target === 'title') {
                if (!titleName.includes(keyword)) return false;
            } else { 
                if (!clientName.includes(keyword) && !titleName.includes(keyword)) return false;
            }
        }
        return true;
    });

    renderTasksTable(filteredData);
}

function renderTasksTable(dataToRender) {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    if(!tbody) return;

    tbody.innerHTML = '';
    if (dataToRender.length === 0) {
        if(emptyState) emptyState.style.display = 'flex';
        checkAllNavBadges();
        return;
    }

    if(emptyState) emptyState.style.display = 'none';
    let rowsHtml = '';

    dataToRender.forEach(item => {
        const isAdmin = checkIsAdmin();
        const isAuthor = checkIsAuthor(item);

        let adminActions = `<td class="admin-only-col p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 align-middle whitespace-nowrap"><span class="text-gray-300 text-xs">-</span></td>`;

        if (isAdmin) {
            adminActions = `
                <td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" class="edit-task-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold whitespace-nowrap cursor-pointer" data-id="${item.id}">수정</button>
                        <button type="button" class="assign-task-btn bg-orange-50 text-hermes hover:bg-hermes hover:text-white px-2 py-1 rounded transition text-[11px] font-bold whitespace-nowrap cursor-pointer" data-id="${item.id}">담당자</button>
                        <button type="button" class="delete-task-btn bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold whitespace-nowrap cursor-pointer" data-id="${item.id}" data-t="${item.title}">삭제</button>
                    </div>
                </td>
            `;
        } else if (isAuthor) {
            adminActions = `
                <td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" class="edit-task-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition text-[11px] font-bold whitespace-nowrap cursor-pointer" data-id="${item.id}">수정</button>
                    </div>
                </td>
            `;
        }

        const fileButton = renderFileButtons(item, true);
        const commentCount = item.comments ? item.comments.length : 0;
        const authorName = item.staff || item.name || '미상';
        
        let managerDisplay = '<span class="text-gray-400 font-normal">미배정</span>';
        if (item.assignedManagers && item.assignedManagers.length > 0) {
            const primary = item.assignedManagers[0];
            const extraCount = item.assignedManagers.length - 1;
            managerDisplay = `<span class="text-red-500 font-bold" title="주 담당자">${primary}</span>`;
            if (extraCount > 0) managerDisplay += `<span class="text-gray-500 font-medium ml-1 text-[10px]">+${extraCount}</span>`;
        }

        const displayStaffHtml = `
            <div class="inline-flex items-center gap-1.5 break-keep whitespace-nowrap text-xs">
                <span class="text-gray-800 font-extrabold" title="작성자">${authorName}</span>
                <span class="text-gray-300 font-normal">/</span>
                ${managerDisplay}
            </div>
        `;

        let statusBadgeClass = 'bg-blue-50 text-blue-600 border-blue-100';
        if (item.status === '진행중') statusBadgeClass = 'bg-amber-50 text-amber-600 border-amber-200';
        else if (item.status === '처리완료' || item.status === '답변완료' || item.status === '완료') statusBadgeClass = 'bg-green-50 text-green-600 border-green-200';
        else if (item.status === '보류') statusBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200';

        let clientBadgeHtml = item.client || '-';
        if (item.client === '📢 전체 공지') {
            clientBadgeHtml = `<span class="bg-blue-600 text-white font-black text-[11px] px-2 py-0.5 rounded-full shadow-2xs">📢 전체 공지</span>`;
        }

        let typeBadgeHtml = `<span class="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">${item.type || '-'}</span>`;
        if (item.type === '기타') {
            typeBadgeHtml = `<span class="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap"><i class="fa-solid fa-note-sticky text-[9px] mr-0.5"></i>기타(메모)</span>`;
        }

        rowsHtml += `
            <tr class="hover:bg-hermes-light/30 transition group border-b border-gray-100 cursor-pointer task-detail-trigger break-keep" data-id="${item.id}">
                <td class="p-3.5 md:p-4 align-middle text-gray-900 text-[11px] font-bold whitespace-nowrap">
                    <div>${item.date || '-'}</div>
                    <div class="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                        <i class="fa-regular fa-eye text-gray-400"></i> ${item.views || 0}
                    </div>
                </td>
                <td class="p-3.5 md:p-4 align-middle text-center whitespace-nowrap"><span class="${statusBadgeClass} px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap">${item.status || '답변대기'}</span></td>
                <td class="p-3.5 md:p-4 font-bold text-gray-900 align-middle text-xs whitespace-nowrap min-w-[80px]">${clientBadgeHtml}</td>
                <td class="p-3.5 md:p-4 align-middle whitespace-nowrap">${typeBadgeHtml}</td>
                <td class="p-3.5 md:p-4 align-middle min-w-[200px]">
                    <div class="font-bold text-gray-900 group-hover:text-hermes transition flex items-center gap-1 break-keep">
                        <span class="break-all">${item.title || '-'}</span> 
                        ${commentCount > 0 ? `<span class="text-hermes text-[10px] font-black shrink-0">[${commentCount}]</span>` : ''}
                    </div>
                </td>
                <td class="p-3.5 md:p-4 align-middle whitespace-nowrap">${fileButton}</td>
                <td class="p-3.5 md:p-4 align-middle text-xs font-bold break-keep min-w-[140px]">${displayStaffHtml}</td>
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

    checkAllNavBadges();
}

async function fetchTasks() {
    const tbody = document.getElementById('boardTable');
    const emptyState = document.getElementById('emptyState');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 이슈 전체 데이터 불러오는 중...</td></tr>';

    try {
        let fetchedData = [];
        const querySnapshot = await getDocs(collection(db, "crm_tasks"));
        tasksMap = {}; 

        querySnapshot.forEach((docSnap) => { 
            const tItem = { id: docSnap.id, ...docSnap.data() };
            fetchedData.push(tItem);
            tasksMap[docSnap.id] = tItem;
        });

        fetchedData.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date.replace(/\./g, '-')).getTime() : 0);
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date.replace(/\./g, '-')).getTime() : 0);
            return (timeB || 0) - (timeA || 0);
        });

        updateDashboardStats(fetchedData);
        renderRollingTickers(fetchedData);
        updateNotifications(fetchedData);

        allTasksData = fetchedData; 
        applyTaskFilters();         

    } catch (e) { console.error("Firestore fetch tasks error:", e); }
}

async function openDetailModal(taskId) {
    const task = tasksMap[taskId];
    if(!task) return;
    
    currentDetailTaskId = taskId;
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'dashboard';
    const newUrl = `${window.location.pathname}?tab=${activeTab}&id=${taskId}`;
    window.history.pushState({ tab: activeTab, id: taskId }, '', newUrl);

    if (!allClientsData || allClientsData.length === 0) {
        await fetchClients();
    }

    if (detailModal) {
        const modalCard = detailModal.querySelector('.bg-white') || detailModal.firstElementChild;
        if (modalCard) {
            modalCard.classList.add('max-w-[95vw]', 'sm:max-w-3xl', 'w-full', 'overflow-x-hidden', 'box-border', 'p-4', 'sm:p-6');
        }

        const topHeader = detailModal.querySelector('.flex.justify-between') || detailModal.querySelector('header');
        if (topHeader) {
            topHeader.classList.add('flex-wrap', 'gap-2', 'max-w-full', 'items-center');
        }
    }

    newCommentSelectedFiles = [];
    renderNewCommentFilePreviews();

    const newViewerObj = {
        name: currentUserName || "사용자",
        ip: currentClientIP,
        timestamp: new Date().toISOString()
    };
    
    const existingViewers = task.viewers || [];
    const updatedViewers = [newViewerObj, ...existingViewers].slice(0, 10);
    task.views = (task.views || 0) + 1;
    task.viewers = updatedViewers;

    try {
        await updateDoc(doc(db, "crm_tasks", taskId), { 
            views: increment(1),
            viewers: updatedViewers 
        });
    } catch (e) { console.error("View increment error:", e); }

    const viewCountNumEl = document.getElementById('detailViewCountNum');
    if (viewCountNumEl) {
        viewCountNumEl.innerText = task.views;
    }

    const viewersListContentEl = document.getElementById('viewersListContent');
    if (viewersListContentEl) {
        if (!task.viewers || task.viewers.length === 0) {
            viewersListContentEl.innerHTML = '<div class="text-[11px] text-gray-400 py-1 text-center">조회 기록이 없습니다.</div>';
        } else {
            viewersListContentEl.innerHTML = task.viewers.map(v => {
                const dateObj = new Date(v.timestamp);
                const dateStr = dateObj.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit', hour12: false });
                return `
                    <div class="flex items-center justify-between text-[11px] py-1 border-b border-gray-100 last:border-0">
                        <span class="font-bold text-gray-800">${v.name}</span>
                        <span class="font-mono text-gray-500 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">${v.ip || '127.0.0.1'}</span>
                        <span class="text-gray-400 text-[10px]">${dateStr}</span>
                    </div>
                `;
            }).join('');
        }
    }

    const titleEl = document.getElementById('detailTitle');
    if (titleEl) {
        titleEl.innerText = task.title || '제목 없음';
        titleEl.className = "text-base sm:text-xl font-black text-gray-900 break-all leading-snug max-w-full";
    }

    document.getElementById('detailType').innerText = task.type || '보고서';
    
    const typeEl = document.getElementById('detailType');
    if (typeEl && typeEl.parentElement) {
        typeEl.parentElement.classList.add('flex-wrap', 'items-center', 'gap-1');
        let statusSelectEl = document.getElementById('detailStatusSelect');
        
        const isUserAdmin = checkIsAdmin();
        const selectCursorClass = isUserAdmin ? 'cursor-pointer' : 'cursor-not-allowed bg-gray-100 text-gray-500 border-gray-200';

        if (!statusSelectEl) {
            statusSelectEl = document.createElement('select');
            statusSelectEl.id = 'detailStatusSelect';
            statusSelectEl.className = `text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white focus:border-hermes outline-none ml-2 shadow-2xs my-1 ${selectCursorClass}`;
            if (!isUserAdmin) statusSelectEl.setAttribute('disabled', 'true');
            typeEl.parentElement.appendChild(statusSelectEl);
        } else {
            statusSelectEl.className = `text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 bg-white focus:border-hermes outline-none ml-2 shadow-2xs my-1 ${selectCursorClass}`;
            if (!isUserAdmin) {
                statusSelectEl.setAttribute('disabled', 'true');
            } else {
                statusSelectEl.removeAttribute('disabled');
            }
        }
        
        const currentStatus = task.status || '답변대기';
        statusSelectEl.innerHTML = `
            <option value="답변대기" ${currentStatus === '답변대기' ? 'selected' : ''}>답변대기</option>
            <option value="진행중" ${currentStatus === '진행중' ? 'selected' : ''}>진행중</option>
            <option value="처리완료" ${currentStatus === '처리완료' ? 'selected' : ''}>처리완료</option>
            <option value="보류" ${currentStatus === '보류' ? 'selected' : ''}>보류</option>
        `;

        statusSelectEl.onchange = async (e) => {
            const newStatus = e.target.value;
            try {
                await updateDoc(doc(db, "crm_tasks", taskId), { status: newStatus });
                tasksMap[taskId].status = newStatus;
                await logActivity("상태 변경", `[${task.title}] 상태를 '${newStatus}'(으)로 변경`);
                alert(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
                fetchTasks();
            } catch(err) {
                alert("상태 변경 실패: " + err.message);
            }
        };
    }

    document.getElementById('detailClient').innerText = task.client || '-';
    
    const authorName = task.staff || task.name || '담당자';
    const detailStaffEl = document.getElementById('detailStaff');
    if (detailStaffEl) {
        detailStaffEl.innerText = authorName;
        detailStaffEl.className = "font-bold text-gray-800";
    }

    const detailAssignEl = document.getElementById('detailAssignManager') || document.getElementById('detailAssign') || document.getElementById('detailAssignedManagers');
    if (detailAssignEl) {
        let assignedStr = '미지정';
        if (task.assignedManagers && task.assignedManagers.length > 0) {
            const primary = task.assignedManagers[0];
            const subs = task.assignedManagers.slice(1).join(', ');
            assignedStr = `<span class="text-red-500 font-bold">${primary}</span>`;
            if (subs) assignedStr += ` <span class="text-gray-500 font-normal ml-1">(${subs})</span>`;
        }
        detailAssignEl.innerHTML = assignedStr;
        detailAssignEl.className = "text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block break-all max-w-full";
    }

    document.getElementById('detailDate').innerText = task.date || '-';

    const agencyNameMap = { 'noah': '노아유니버스', 'adplanters': '애드플랜터스' };
    const detailAgencyEl = document.getElementById('detailAgency');
    if (detailAgencyEl) {
        detailAgencyEl.innerText = agencyNameMap[task.agency] || task.agency || '노아유니버스';
    }

    const budgetTotalEl = document.getElementById('detailBudgetTotal');
    const budgetRechargedEl = document.getElementById('detailBudgetRecharged');
    const budgetSpentEl = document.getElementById('detailBudgetSpent');
    const budgetRemainingEl = document.getElementById('detailBudgetRemaining');
    const budgetStatusEl = document.getElementById('detailClientBudgetStatus');

    const mappedClient = findClientByName(task.client);

    if (mappedClient && budgetTotalEl) {
        const tB = Number(mappedClient.totalBudget) || 0;
        const rB = Number(mappedClient.rechargedBudget) || 0;
        const sB = Number(mappedClient.usedBudget) || 0;
        const remB = (tB + rB) - sB;

        budgetTotalEl.innerText = tB.toLocaleString() + '원';
        budgetRechargedEl.innerText = rB.toLocaleString() + '원';
        budgetSpentEl.innerText = sB.toLocaleString() + '원';
        budgetRemainingEl.innerText = remB.toLocaleString() + '원';

        if (budgetSpentEl && budgetSpentEl.parentElement) {
            const spentLabelSpan = budgetSpentEl.parentElement.querySelector('span');
            if (spentLabelSpan) {
                spentLabelSpan.innerHTML = `충전금액 <span class="inline-flex items-center text-[9px] font-black text-red-500 bg-red-100 px-1 py-0.2 rounded-full animate-bounce ml-0.5 border border-red-200">ING</span>`;
            }
        }

        if (remB < 0) {
            budgetStatusEl.innerText = '충전금액 초과';
            budgetStatusEl.className = 'text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold';
        } else if (remB === 0 && (tB + rB) > 0) {
            budgetStatusEl.innerText = '충전대기 소진';
            budgetStatusEl.className = 'text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold';
        } else {
            budgetStatusEl.innerText = '정상 운영중';
            budgetStatusEl.className = 'text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold';
        }
        budgetTotalEl.closest('.col-span-2').classList.remove('hidden');

        const budgetGrid = budgetTotalEl.closest('.grid');
        if (budgetGrid && budgetGrid.parentElement) {
            let contractDiv = document.getElementById('detailContractPeriodDiv');
            if (!contractDiv) {
                contractDiv = document.createElement('div');
                contractDiv.id = 'detailContractPeriodDiv';
                contractDiv.className = 'mt-2 border border-blue-100 bg-blue-50/40 px-3 py-2.5 rounded-lg flex items-center justify-between text-[11px] sm:text-xs shadow-sm';
                budgetGrid.parentElement.appendChild(contractDiv);
            }
            contractDiv.innerHTML = `<span class="font-bold text-gray-700"><i class="fa-regular fa-calendar-check mr-1.5 text-blue-500"></i>계약 기간 / 마감일</span> <span class="font-black text-blue-700">${mappedClient.contractPeriod || '미등록 (Admin 설정 필요)'}</span>`;
        }
    } else if (budgetTotalEl) {
        budgetTotalEl.closest('.col-span-2').classList.add('hidden');
        const contractDiv = document.getElementById('detailContractPeriodDiv');
        if (contractDiv) contractDiv.remove(); 
    }
    
    const contentEl = document.getElementById('detailContent');
    if (contentEl) {
        contentEl.innerText = task.content || '등록된 내용이 없습니다.';
        contentEl.className = "text-xs sm:text-sm text-gray-700 whitespace-pre-line break-all max-w-full overflow-x-auto leading-relaxed";
    }

    // 기타 분류 전용 메모 영역
    let otherMemoBox = document.getElementById('detailOtherMemoBox');
    if (!otherMemoBox && contentEl && contentEl.parentElement) {
        otherMemoBox = document.createElement('div');
        otherMemoBox.id = 'detailOtherMemoBox';
        otherMemoBox.className = 'mt-4 p-3 bg-purple-50/60 border border-purple-200 rounded-xl hidden';
        contentEl.parentElement.appendChild(otherMemoBox);
    }

    const isAdmin = checkIsAdmin();

    if (otherMemoBox) {
        if (task.type === '기타') {
            otherMemoBox.classList.remove('hidden');
            const memoVal = task.otherMemo || '';

            if (isAdmin) {
                otherMemoBox.innerHTML = `
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-bold text-purple-900 flex items-center gap-1">
                            <i class="fa-solid fa-note-sticky text-purple-600"></i> 기타 항목 메모 (Admin 전용 수정)
                        </span>
                        <span class="text-[10px] text-purple-600 font-bold bg-purple-100 px-1.5 py-0.5 rounded">전체 열람 가능</span>
                    </div>
                    <textarea id="taskOtherMemoTextarea" rows="2" placeholder="관리자 전용 메모를 입력하세요." class="w-full text-xs p-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white font-medium resize-y">${memoVal}</textarea>
                    <div class="flex justify-end mt-1.5">
                        <button type="button" id="saveTaskOtherMemoBtn" class="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition shadow-xs">
                            메모 저장
                        </button>
                    </div>
                `;

                const saveMemoBtn = document.getElementById('saveTaskOtherMemoBtn');
                if (saveMemoBtn) {
                    saveMemoBtn.onclick = async () => {
                        const txt = document.getElementById('taskOtherMemoTextarea').value.trim();
                        saveMemoBtn.innerText = "저장중...";
                        saveMemoBtn.disabled = true;

                        try {
                            await updateDoc(doc(db, "crm_tasks", taskId), { otherMemo: txt });
                            tasksMap[taskId].otherMemo = txt;
                            await logActivity("기타 메모 수정", `[${task.title}] 기타 메모 업데이트`);
                            alert("기타 항목 메모가 저장되었습니다.");
                        } catch (err) {
                            alert("메모 저장 실패: " + err.message);
                        } finally {
                            saveMemoBtn.innerText = "메모 저장";
                            saveMemoBtn.disabled = false;
                        }
                    };
                }
            } else {
                otherMemoBox.innerHTML = `
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold text-purple-900 flex items-center gap-1">
                            <i class="fa-solid fa-note-sticky text-purple-600"></i> 기타 항목 메모
                        </span>
                    </div>
                    <div class="text-xs text-purple-950 font-medium whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded-lg border border-purple-100">
                        ${memoVal || '등록된 메모가 없습니다.'}
                    </div>
                `;
            }
        } else {
            otherMemoBox.classList.add('hidden');
        }
    }

    const shareBtn = document.getElementById('shareLinkBtn') || Array.from(detailModal.querySelectorAll('button')).find(b => b.textContent.includes('링크 복사'));
    if (shareBtn) {
        shareBtn.classList.add('whitespace-nowrap', 'shrink-0');
        shareBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const shareUrl = `${window.location.origin}${window.location.pathname}?tab=${activeTab}&id=${taskId}`;
            copyToClipboard(shareUrl, "게시글 링크");
        };
    }

    const isAuthor = checkIsAuthor(task);

    let actionArea = document.getElementById('detailTaskActions');
    if (!actionArea) {
        if (shareBtn && shareBtn.parentElement) {
            actionArea = document.createElement('div');
            actionArea.id = 'detailTaskActions';
            actionArea.className = 'inline-flex flex-wrap items-center gap-1.5 ml-1 mr-1 max-w-full';
            shareBtn.parentElement.insertBefore(actionArea, shareBtn);
        }
    } else {
        actionArea.className = 'inline-flex flex-wrap items-center gap-1.5 ml-1 mr-1 max-w-full';
    }

    if (actionArea) {
        if (isAdmin) {
            actionArea.innerHTML = `
                <button type="button" id="btnDetailEdit" class="px-2 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-lg border border-blue-200 transition shadow-2xs whitespace-nowrap">수정</button>
                <button type="button" id="btnDetailAssign" class="px-2 py-1 bg-orange-50 hover:bg-hermes text-hermes hover:text-white text-xs font-bold rounded-lg border border-orange-200 transition shadow-2xs whitespace-nowrap">담당자 연결</button>
                <button type="button" id="btnDetailDelete" class="px-2 py-1 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white text-xs font-bold rounded-lg border border-red-200 transition shadow-2xs whitespace-nowrap">삭제</button>
            `;
            document.getElementById('btnDetailDelete').onclick = () => deleteTask(taskId);
            document.getElementById('btnDetailEdit').onclick = () => openEditTaskModal(taskId);
            document.getElementById('btnDetailAssign').onclick = () => openAssignModal(taskId);
            
        } else if (isAuthor) {
            actionArea.innerHTML = `
                <button type="button" id="btnDetailEdit" class="px-2 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-lg border border-blue-200 transition shadow-2xs whitespace-nowrap">수정</button>
            `;
            document.getElementById('btnDetailEdit').onclick = () => openEditTaskModal(taskId);
        } else {
            actionArea.innerHTML = '';
        }
    }

    const fileBtnArea = document.getElementById('detailFileBtn');
    if (fileBtnArea) {
        fileBtnArea.className = "flex flex-wrap gap-2 max-w-full overflow-x-auto";
        fileBtnArea.innerHTML = renderFileButtons(task, false);
    }

    renderComments(task.comments || []);
    detailModal.classList.remove('hidden');
    logActivity("상세 조회", `[${task.title}] 상세 내용을 조회했습니다.`);
}

function bindInlineEditMode(taskId) {
    const task = tasksMap[taskId];
    const titleEl = document.getElementById('detailTitle');
    const contentEl = document.getElementById('detailContent');
    const actionArea = document.getElementById('detailTaskActions');

    if (!titleEl || !contentEl) return;

    titleEl.innerHTML = `<input type="text" id="inlineEditTitle" value="${task.title.replace(/"/g, '&quot;')}" class="w-full text-base sm:text-lg font-black border border-orange-400 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-hermes box-border" />`;
    contentEl.innerHTML = `<textarea id="inlineEditContent" rows="6" class="w-full text-xs sm:text-sm font-medium border border-orange-400 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-hermes box-border">${task.content}</textarea>`;

    if (actionArea) {
        actionArea.innerHTML = `
            <button type="button" id="btnInlineSave" class="px-3 py-1.5 bg-hermes hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition whitespace-nowrap">저장</button>
            <button type="button" id="btnInlineCancel" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition whitespace-nowrap">취소</button>
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
// 7. 소통 댓글 모듈
// ============================================================================

function renderNewCommentFilePreviews() {
    let prevArea = document.getElementById('commentNewFilesPreviewArea');
    const inputBox = document.getElementById('commentInputBox');

    if (!prevArea && inputBox && inputBox.parentElement) {
        prevArea = document.createElement('div');
        prevArea.id = 'commentNewFilesPreviewArea';
        prevArea.className = 'flex flex-wrap gap-2 my-2.5 p-2 bg-gray-50 border border-dashed border-gray-200 rounded-xl empty:hidden max-w-full';
        inputBox.parentElement.insertBefore(prevArea, inputBox.nextSibling);
    }

    if (!prevArea) return;
    prevArea.innerHTML = '';

    newCommentSelectedFiles.forEach((file, idx) => {
        const isImg = file.type.startsWith('image/') || isImageFile(file.name, '');
        if (isImg) {
            const objectUrl = URL.createObjectURL(file);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inline-block relative group my-1 mr-1';
            itemDiv.innerHTML = `
                <img src="${objectUrl}" data-url="${objectUrl}" class="img-preview-btn w-16 h-16 object-cover rounded-xl border border-orange-300 shadow-2xs cursor-pointer hover:scale-105 transition" title="클릭하여 확대 보기" />
                <button type="button" class="remove-new-comment-file-btn absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black shadow transition" data-idx="${idx}">✕</button>
            `;
            prevArea.appendChild(itemDiv);
        } else {
            const itemSpan = document.createElement('span');
            itemSpan.className = 'inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-orange-200 my-1 break-all max-w-full';
            itemSpan.innerHTML = `
                <i class="fa-solid fa-file text-hermes shrink-0"></i> <span class="truncate max-w-[120px]">${file.name}</span>
                <button type="button" class="remove-new-comment-file-btn text-red-500 hover:text-red-700 ml-1 font-black shrink-0" data-idx="${idx}">✕</button>
            `;
            prevArea.appendChild(itemSpan);
        }
    });

    prevArea.querySelectorAll('.remove-new-comment-file-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const removeIdx = parseInt(btn.getAttribute('data-idx'));
            newCommentSelectedFiles.splice(removeIdx, 1);
            renderNewCommentFilePreviews();
        };
    });
}

function initNewCommentDragAndDrop() {
    const commentInput = document.getElementById('commentInputBox');
    const commentFileInput = document.getElementById('commentFileInputBox');

    if (commentInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            commentInput.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            commentInput.addEventListener(eventName, () => {
                commentInput.classList.add('border-hermes', 'bg-orange-50/50', 'ring-2', 'ring-orange-300');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            commentInput.addEventListener(eventName, () => {
                commentInput.classList.remove('border-hermes', 'bg-orange-50/50', 'ring-2', 'ring-orange-300');
            }, false);
        });

        commentInput.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(f => newCommentSelectedFiles.push(f));
                renderNewCommentFilePreviews();
            }
        }, false);
    }

    if (commentFileInput) {
        commentFileInput.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                Array.from(e.target.files).forEach(f => newCommentSelectedFiles.push(f));
                renderNewCommentFilePreviews();
                e.target.value = '';
            }
        };
    }
}

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
            <div class="flex items-center gap-1.5 ml-2 shrink-0">
                <button type="button" class="edit-comment-btn text-[10px] font-bold text-blue-600 hover:underline transition" data-index="${index}">수정</button>
                <button type="button" class="delete-comment-btn text-[10px] font-bold text-red-500 hover:underline transition" data-index="${index}">삭제</button>
            </div>
        ` : '';

        let filesHtml = '';
        if (c.files && c.files.length > 0) {
            filesHtml = `<div class="flex flex-wrap gap-2 pt-2 mt-2 border-t border-gray-100 max-w-full">${renderFileButtons({ files: c.files }, false)}</div>`;
        }

        listEl.innerHTML += `
            <div class="bg-white border border-gray-200 p-3 rounded-xl shadow-xs space-y-1 comment-item max-w-full overflow-hidden" id="comment-item-${index}">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-800">${c.author} <span class="text-[10px] text-gray-400">(${c.role || '멤버'})</span></span>
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-400">${c.date}</span>
                        ${actionBtns}
                    </div>
                </div>
                <div class="comment-body-area" id="comment-body-${index}">
                    <p class="text-xs text-gray-700 whitespace-pre-line break-all max-w-full">${c.text}</p>
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
            let newSelectedFiles = []; 

            function renderEditFilesList() {
                if (currentEditFiles.length === 0) return '<span class="text-[10px] text-gray-400 italic">첨부파일 없음</span>';
                return currentEditFiles.map((f, fIdx) => {
                    const fileName = f.fileName || '첨부파일';
                    return `
                        <span class="inline-flex items-center gap-1 bg-white text-gray-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-200 shadow-2xs break-all max-w-full">
                            <i class="fa-solid fa-paperclip text-hermes shrink-0"></i> <span class="truncate max-w-[120px]">${fileName}</span>
                            <button type="button" class="remove-edit-file-btn text-red-500 hover:text-red-700 ml-1 font-black shrink-0" data-fidx="${fIdx}">✕</button>
                        </span>
                    `;
                }).join(' ');
            }

            function renderNewFilesPreview() {
                const prevContainer = document.getElementById(`inline-edit-new-previews-${idx}`);
                if (!prevContainer) return;
                prevContainer.innerHTML = '';

                newSelectedFiles.forEach((file, nIdx) => {
                    const isImg = file.type.startsWith('image/') || isImageFile(file.name, '');
                    if (isImg) {
                        const objectUrl = URL.createObjectURL(file);
                        prevContainer.innerHTML += `
                            <div class="inline-block relative group my-1 mr-1">
                                <img src="${objectUrl}" data-url="${objectUrl}" class="img-preview-btn w-16 h-16 object-cover rounded-xl border border-orange-300 shadow-2xs cursor-pointer hover:scale-105 transition" title="클릭하여 확대 보기" />
                                <button type="button" class="remove-new-file-btn absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black shadow" data-nidx="${nIdx}">✕</button>
                            </div>
                        `;
                    } else {
                        prevContainer.innerHTML += `
                            <span class="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-orange-200 my-1 break-all max-w-full">
                                <i class="fa-solid fa-file text-hermes shrink-0"></i> <span class="truncate max-w-[120px]">${file.name}</span>
                                <button type="button" class="remove-new-file-btn text-red-500 hover:text-red-700 ml-1 font-black shrink-0" data-nidx="${nIdx}">✕</button>
                            </span>
                        `;
                    }
                });

                prevContainer.querySelectorAll('.remove-new-file-btn').forEach(rmBtn => {
                    rmBtn.addEventListener('click', (eEvt) => {
                        eEvt.stopPropagation();
                        const nIdx = parseInt(rmBtn.getAttribute('data-nidx'));
                        newSelectedFiles.splice(nIdx, 1);
                        renderNewFilesPreview();
                    });
                });
            }

            bodyArea.innerHTML = `
                <div class="mt-1 space-y-2 border-2 border-orange-300 p-2.5 sm:p-3 rounded-2xl bg-orange-50/20 transition-all cursor-pointer max-w-full" id="inline-edit-box-${idx}">
                    <textarea id="inline-edit-textarea-${idx}" class="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hermes/30 transition resize-y bg-white box-border" rows="3" placeholder="댓글 내용을 수정하거나 전체 영역에 파일을 끌어다 놓으세요.">${comment.text}</textarea>
                    
                    <div class="space-y-1 bg-white p-2.5 rounded-xl border border-gray-200 max-w-full">
                        <div class="text-[10px] font-bold text-gray-500 flex justify-between flex-wrap gap-1">
                            <span>기존 첨부파일:</span>
                            <span class="text-orange-500 font-bold text-[9px]">* 이 박스 영역 전체에 파일 드래그 & 드롭 가능</span>
                        </div>
                        
                        <div id="inline-edit-files-container-${idx}" class="flex flex-wrap gap-1 max-w-full">
                            ${renderEditFilesList()}
                        </div>

                        <div id="inline-edit-new-previews-${idx}" class="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-200 empty:hidden max-w-full">
                        </div>

                        <div class="pt-1 flex items-center gap-2">
                            <input type="file" id="inline-edit-file-input-${idx}" multiple class="hidden" />
                            <button type="button" id="inline-edit-file-trigger-${idx}" class="text-xs bg-gray-100 hover:bg-orange-100 text-gray-700 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 border border-gray-200 whitespace-nowrap">
                                <i class="fa-solid fa-paperclip text-hermes"></i> PC 파일 선택
                            </button>
                        </div>
                    </div>

                    <div class="flex justify-end gap-1.5 pt-1">
                        <button type="button" class="cancel-inline-edit-btn bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap">취소</button>
                        <button type="button" class="save-inline-edit-btn bg-hermes hover:bg-orange-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-xs whitespace-nowrap">저장</button>
                    </div>
                </div>
            `;

            const editBox = document.getElementById(`inline-edit-box-${idx}`);
            const fileInput = document.getElementById(`inline-edit-file-input-${idx}`);
            const fileTrigger = document.getElementById(`inline-edit-file-trigger-${idx}`);

            if (fileTrigger && fileInput) {
                fileTrigger.onclick = () => fileInput.click();
                fileInput.onchange = (fEvt) => {
                    if (fEvt.target.files && fEvt.target.files.length > 0) {
                        Array.from(fEvt.target.files).forEach(f => newSelectedFiles.push(f));
                        renderNewFilesPreview();
                    }
                };
            }

            if (editBox) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    editBox.addEventListener(eventName, (eEvt) => {
                        eEvt.preventDefault();
                        eEvt.stopPropagation();
                    }, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    editBox.addEventListener(eventName, () => {
                        editBox.classList.add('ring-4', 'ring-orange-400/50', 'bg-orange-100/40');
                    }, false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    editBox.addEventListener(eventName, () => {
                        editBox.classList.remove('ring-4', 'ring-orange-400/50', 'bg-orange-100/40');
                    }, false);
                });

                editBox.addEventListener('drop', (dropEvt) => {
                    const dt = dropEvt.dataTransfer;
                    if (dt.files && dt.files.length > 0) {
                        Array.from(dt.files).forEach(f => newSelectedFiles.push(f));
                        renderNewFilesPreview();
                    }
                }, false);
            }

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

            cancelBtn.addEventListener('click', (eEvt) => {
                eEvt.stopPropagation();
                renderComments(commentsArr);
            });

            saveBtn.addEventListener('click', async (eEvt) => {
                eEvt.stopPropagation();
                const textarea = document.getElementById(`inline-edit-textarea-${idx}`);
                const updatedText = textarea.value.trim();

                if (!updatedText && currentEditFiles.length === 0 && newSelectedFiles.length === 0) {
                    alert("댓글 내용이나 첨부파일을 지정해 주세요.");
                    return;
                }

                saveBtn.innerText = "저장 중...";
                saveBtn.disabled = true;

                try {
                    let newlyUploadedFiles = [];
                    if (newSelectedFiles.length > 0) {
                        newlyUploadedFiles = await uploadFilesToStorage(newSelectedFiles, "crm_comments");
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
    const text = textInput ? textInput.value.trim() : '';

    if(!text && newCommentSelectedFiles.length === 0) { 
        alert('댓글 내용이나 첨부할 파일을 입력해 주세요.'); 
        return; 
    }

    const submitBtn = document.getElementById('submitNewCommentBtn');
    submitBtn.innerText = "저장 중...";
    submitBtn.disabled = true;

    let commentFiles = [];
    try {
        if (newCommentSelectedFiles.length > 0) {
            commentFiles = await uploadFilesToStorage(newCommentSelectedFiles, "crm_comments");
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
        
        if(textInput) textInput.value = '';
        newCommentSelectedFiles = [];
        renderNewCommentFilePreviews();

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
// 8. 클라이언트 관리
// ============================================================================
safeAddListener('clientForm', 'submit', async (e) => {
    e.preventDefault();
    if (!clientModal) return;

    const nameIn = document.getElementById('c_name');
    const homeIn = document.getElementById('c_homeUrl');
    const instaIn = document.getElementById('c_instaUrl');
    const metaIdIn = document.getElementById('c_metaId');
    const metaPwIn = document.getElementById('c_metaPw');
    const metaEmailIn = document.getElementById('c_metaEmail');
    const metaPhoneIn = document.getElementById('c_metaPhone');
    const memoIn = document.getElementById('c_memo');
    const instaDateIn = document.getElementById('c_instaDate');
    const metaDateIn = document.getElementById('c_metaDate');
    const contractPeriodIn = document.getElementById('c_contractPeriod'); 

    const submitBtn = clientModal.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerText : '저장';
    if(submitBtn) { 
        submitBtn.innerText = '저장 중...'; 
        submitBtn.disabled = true; 
    }

    try {
        const newClient = {
            name: nameIn ? nameIn.value : '',
            homeUrl: homeIn ? homeIn.value : '',
            instaUrl: instaIn ? instaIn.value : '',
            metaId: metaIdIn ? metaIdIn.value : '',
            metaPw: metaPwIn ? metaPwIn.value : '',
            metaEmail: metaEmailIn ? metaEmailIn.value : '', 
            metaPhone: metaPhoneIn ? metaPhoneIn.value : '', 
            memo: memoIn ? memoIn.value : '',                
            totalBudget: 0,        
            rechargedBudget: 0,
            usedBudget: 0,
            instaDate: instaDateIn ? instaDateIn.value : '',
            metaDate: metaDateIn ? metaDateIn.value : '',
            contractPeriod: contractPeriodIn ? contractPeriodIn.value : '', 
            registeredBy: currentUserName,
            managers: [currentUserName], 
            createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, "clients"), newClient);
        clientModal.classList.add('hidden');
        
        const form = document.getElementById('clientForm');
        if(form) form.reset();
        
        await logActivity("클라이언트 등록", `[${newClient.name}] 신규 등록 완료`);
        alert("클라이언트가 성공적으로 등록되었습니다.");
        fetchClients();
    } catch (err) {
        alert("등록 실패: " + err.message);
    } finally {
        if(submitBtn) { 
            submitBtn.innerText = origText; 
            submitBtn.disabled = false; 
        }
    }
});

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

async function openEditClientModal(clientId) {
    const client = clientsMap[clientId];
    if (!client) return;
    currentEditClientId = clientId;

    if (editClientModal) {
        const nameIn = document.getElementById('edit_c_name');
        const homeIn = document.getElementById('edit_c_homeUrl');
        const instaIn = document.getElementById('edit_c_instaUrl');
        const metaIdIn = document.getElementById('edit_c_metaId');
        const metaPwIn = document.getElementById('edit_c_metaPw');
        const metaEmailIn = document.getElementById('edit_c_metaEmail');
        const metaPhoneIn = document.getElementById('edit_c_metaPhone');
        const memoIn = document.getElementById('edit_c_memo');
        const instaDateIn = document.getElementById('edit_c_instaDate');
        const metaDateIn = document.getElementById('edit_c_metaDate');
        const contractPeriodIn = document.getElementById('edit_c_contractPeriod'); 

        if (nameIn) nameIn.value = client.name || '';
        if (homeIn) homeIn.value = client.homeUrl || '';
        if (instaIn) instaIn.value = client.instaUrl || '';
        if (metaIdIn) metaIdIn.value = client.metaId || '';
        if (metaPwIn) metaPwIn.value = client.metaPw || '';
        if (metaEmailIn) metaEmailIn.value = client.metaEmail || '';
        if (metaPhoneIn) metaPhoneIn.value = client.metaPhone || '';
        if (memoIn) memoIn.value = client.memo || '';
        if (instaDateIn) instaDateIn.value = client.instaDate || '';
        if (metaDateIn) metaDateIn.value = client.metaDate || '';
        
        if (contractPeriodIn) {
            contractPeriodIn.value = client.contractPeriod || '';
            if (checkIsAdmin()) {
                contractPeriodIn.disabled = false;
                contractPeriodIn.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
            } else {
                contractPeriodIn.disabled = true;
                contractPeriodIn.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
            }
        }

        const editManagerList = document.getElementById('editClientManagerList');
        if (editManagerList) {
            await buildManagerSelectionUI(editManagerList, client.managers || [], 'edit-client-manager-checkbox', 'editClientPrimarySelect');
        }

        editClientModal.classList.remove('hidden');
        editClientModal.style.zIndex = "99999";
    }
}

safeAddListener('editClientForm', 'submit', async (e) => {
    e.preventDefault();
    if (!currentEditClientId) return;

    const nameIn = document.getElementById('edit_c_name');
    const homeIn = document.getElementById('edit_c_homeUrl');
    const instaIn = document.getElementById('edit_c_instaUrl');
    const metaIdIn = document.getElementById('edit_c_metaId');
    const metaPwIn = document.getElementById('edit_c_metaPw');
    const metaEmailIn = document.getElementById('edit_c_metaEmail');
    const metaPhoneIn = document.getElementById('edit_c_metaPhone');
    const memoIn = document.getElementById('edit_c_memo');
    const instaDateIn = document.getElementById('edit_c_instaDate');
    const metaDateIn = document.getElementById('edit_c_metaDate');
    const contractPeriodIn = document.getElementById('edit_c_contractPeriod'); 

    let updatedManagers = clientsMap[currentEditClientId].managers || [];
    
    const pSel = document.getElementById('editClientPrimarySelect');
    if (pSel) {
        updatedManagers = [];
        const pVal = pSel.value;
        if(pVal) updatedManagers.push(pVal);
        const checkboxes = editClientModal.querySelectorAll('.edit-client-manager-checkbox:checked');
        checkboxes.forEach(cb => {
            if(cb.value !== pVal) updatedManagers.push(cb.value);
        });
    }

    try {
        await updateDoc(doc(db, "clients", currentEditClientId), {
            name: nameIn ? nameIn.value : clientsMap[currentEditClientId].name,
            homeUrl: homeIn ? homeIn.value : clientsMap[currentEditClientId].homeUrl,
            instaUrl: instaIn ? instaIn.value : clientsMap[currentEditClientId].instaUrl,
            metaId: metaIdIn ? metaIdIn.value : clientsMap[currentEditClientId].metaId,
            metaPw: metaPwIn ? metaPwIn.value : clientsMap[currentEditClientId].metaPw,
            metaEmail: metaEmailIn ? metaEmailIn.value : (clientsMap[currentEditClientId].metaEmail || ''),
            metaPhone: metaPhoneIn ? metaPhoneIn.value : (clientsMap[currentEditClientId].metaPhone || ''),
            memo: memoIn ? memoIn.value : (clientsMap[currentEditClientId].memo || ''),
            instaDate: instaDateIn ? instaDateIn.value : (clientsMap[currentEditClientId].instaDate || ''),
            metaDate: metaDateIn ? metaDateIn.value : (clientsMap[currentEditClientId].metaDate || ''),
            contractPeriod: contractPeriodIn ? contractPeriodIn.value : (clientsMap[currentEditClientId].contractPeriod || ''), 
            managers: updatedManagers,
            updatedAt: new Date().toISOString()
        });
        editClientModal.classList.add('hidden');
        alert("클라이언트 정보가 수정되었습니다.");
        fetchClients();
    } catch (err) {
        alert("수정 실패: " + err.message);
    }
});

// 전체 클라이언트 수집 및 렌더링
async function fetchClients() {
    const tbodyClients = document.getElementById('clientsTable');
    const emptyClients = document.getElementById('emptyClients');
    
    if (tbodyClients) {
        tbodyClients.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로딩 중...</td></tr>';
    }

    try {
        const querySnapshot = await getDocs(collection(db, "clients"));
        allClientsData = [];
        clientsMap = {};

        if (querySnapshot.empty) {
            if(tbodyClients) tbodyClients.innerHTML = '';
            if(emptyClients) emptyClients.style.display = 'flex';
            checkAllNavBadges();
            const pagination = document.getElementById('clientPagination');
            if(pagination) pagination.classList.add('hidden');
            renderBudgetTable(); 
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const clientObj = { id: docSnap.id, ...data };
            allClientsData.push(clientObj);
            clientsMap[docSnap.id] = clientObj;
        });

        allClientsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        renderClientsPage(currentClientPage || 1);
        renderBudgetTable(); 

    } catch (e) { console.error("Client fetch error:", e); }
}

// 일반 클라이언트 리스트 페이지네이션 렌더링
function renderClientsPage(page) {
    currentClientPage = page;
    const tbody = document.getElementById('clientsTable');
    const pagination = document.getElementById('clientPagination');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    let targetClients = allClientsData;
    if (currentUserRole === 'player') {
        targetClients = allClientsData.filter(c => c.managers && c.managers.includes(currentUserName));
    }

    const totalPages = Math.ceil(targetClients.length / CLIENTS_PER_PAGE);
    const startIndex = (page - 1) * CLIENTS_PER_PAGE;
    const endIndex = startIndex + CLIENTS_PER_PAGE;
    const pageData = targetClients.slice(startIndex, endIndex);

    if (targetClients.length === 0) {
        const emptyClients = document.getElementById('emptyClients');
        if(emptyClients) emptyClients.style.display = 'flex';
        if(pagination) pagination.classList.add('hidden');
        return;
    } else {
        const emptyClients = document.getElementById('emptyClients');
        if(emptyClients) emptyClients.style.display = 'none';
    }

    pageData.forEach(data => {
        let managersHtml = '<span class="text-gray-400 text-xs whitespace-nowrap">미배정</span>';
        if (data.managers && data.managers.length > 0) {
            const primary = data.managers[0];
            const extraCount = data.managers.length - 1;
            
            let badges = `<span class="inline-flex items-center text-red-500 text-[11px] font-bold truncate max-w-[75px]" title="주 담당자">${primary}</span>`;
            
            if (extraCount > 0) {
                const allList = data.managers.map((m, idx) => {
                    const iconColor = idx === 0 ? 'text-red-500' : 'text-orange-400';
                    return `<div class="py-0.5 flex items-center gap-1"><i class="fa-solid fa-user ${iconColor} text-[9px]"></i> ${m}</div>`;
                }).join('');
                badges += `
                    <div class="inline-block relative group align-middle ml-1">
                        <span class="inline-flex items-center bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-hermes text-[10px] px-1.5 py-0.5 rounded border border-gray-200 cursor-pointer font-bold transition shadow-2xs whitespace-nowrap">
                            +${extraCount}명
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
            managersHtml = `<div class="flex items-center w-full max-w-[130px] overflow-visible">${badges}</div>`;
        }

        const isAdmin = checkIsAdmin();
        const adminActions = isAdmin ? 
            `<td class="p-3 md:p-4 text-center border-l border-gray-100 bg-gray-50/50 admin-only-col align-middle whitespace-nowrap">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" class="edit-client-btn bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm whitespace-nowrap cursor-pointer" data-id="${data.id}">수정</button>
                    <button type="button" class="delete-client-btn bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition shadow-sm whitespace-nowrap cursor-pointer" data-id="${data.id}" data-name="${data.name}">삭제</button>
                </div>
            </td>` : `<td class="admin-only-col hidden"></td>`;

        let copyIdBtn = data.metaId ? `<button type="button" class="copy-text-btn text-gray-400 hover:text-hermes transition p-0.5 rounded cursor-pointer" data-copy="${data.metaId}" title="ID 복사"><i class="fa-regular fa-copy text-[11px]"></i></button>` : '';
        let copyPwBtn = data.metaPw ? `<button type="button" class="copy-text-btn text-gray-400 hover:text-hermes transition p-0.5 rounded cursor-pointer" data-copy="${data.metaPw}" title="PW 복사"><i class="fa-regular fa-copy text-[11px]"></i></button>` : '';

        let metaExtraHtml = '';
        if(data.metaEmail || data.metaPhone || data.memo) {
            const memoSnippet = data.memo ? `<div class="pt-1 mt-1 border-t border-gray-200 text-gray-600 truncate max-w-[180px] memo-hover-trigger cursor-pointer" data-memo="${data.memo.replace(/"/g, '&quot;')}"><i class="fa-solid fa-note-sticky text-orange-400 text-[10px] mr-1"></i>${data.memo}</div>` : '';
            metaExtraHtml = `
                <div class="mt-1 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200 max-w-[200px]">
                    ${data.metaEmail ? `<div class="mb-0.5 flex items-start gap-1"><span class="font-bold text-gray-400">E:</span> <span class="truncate max-w-[150px]">${data.metaEmail}</span></div>` : ''}
                    ${data.metaPhone ? `<div class="mb-0.5 flex items-start gap-1"><span class="font-bold text-gray-400">P:</span> <span class="truncate max-w-[150px]">${data.metaPhone}</span></div>` : ''}
                    ${memoSnippet}
                </div>
            `;
        } else {
            metaExtraHtml = `<div class="mt-1 text-[10px] text-gray-400 italic">추가 정보 없음</div>`;
        }

        const tr = `
            <tr class="hover:bg-orange-50/30 transition border-b border-gray-100 break-keep">
                <td class="p-3 md:p-4 font-black text-gray-900 align-middle whitespace-nowrap">${data.name}</td>
                <td class="p-3 md:p-4 text-xs text-gray-500 align-middle whitespace-nowrap">
                    ${data.homeUrl ? `<a href="${data.homeUrl}" target="_blank" class="text-blue-500 hover:underline"><i class="fa-solid fa-link"></i> 웹</a> ` : ''}
                    ${data.instaUrl ? `<a href="${data.instaUrl}" target="_blank" class="text-pink-500 hover:underline"><i class="fa-brands fa-instagram"></i> 인스타</a>` : ''}
                </td>
                <td class="p-3 md:p-4 text-xs align-middle">
                    <div class="flex items-center gap-1.5 whitespace-nowrap">
                        <span class="font-medium text-gray-700">ID: ${data.metaId || '-'}</span>${copyIdBtn}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <span class="font-bold text-gray-900">PW: ${data.metaPw || '-'}</span>${copyPwBtn}
                    </div>
                </td>
                <td class="p-3 md:p-4 text-xs align-middle">${metaExtraHtml}</td>
                <td class="p-3 md:p-4 text-xs text-gray-600 align-middle whitespace-nowrap"><div>인스타: ${data.instaDate || '-'}</div><div>메타: ${data.metaDate || '-'}</div></td>
                <td class="p-3 md:p-4 text-xs font-bold text-gray-500 align-middle whitespace-nowrap">${data.registeredBy || '-'}</td>
                <td class="p-3 md:p-4 max-w-[130px] overflow-visible align-middle">${managersHtml}</td>
                ${adminActions}
            </tr>
        `;
        tbody.innerHTML += tr;
    });

    bindMemoTooltipEvents(tbody);

    if (totalPages > 1 && pagination) {
        pagination.classList.remove('hidden');
        let pageHtml = '';
        for (let i = 1; i <= totalPages; i++) {
            pageHtml += `<button type="button" class="client-page-btn px-3 py-1 text-xs font-bold rounded-md transition ${i === page ? 'bg-hermes text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}" data-page="${i}">${i}</button>`;
        }
        pagination.innerHTML = pageHtml;
        
        document.querySelectorAll('.client-page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                renderClientsPage(parseInt(e.target.getAttribute('data-page')));
            });
        });
    } else if (pagination) {
        pagination.classList.add('hidden');
    }

    checkAllNavBadges();
}

// 🌟 예산 관리 테이블 렌더링 (헤더 9개 열 정렬 보장 및 커스텀 마우스 호버 이벤트)
function renderBudgetTable() {
    const budgetTbody = document.getElementById('budgetTable');
    if (!budgetTbody) return;

    const tableEl = budgetTbody.closest('table');
    if (tableEl) {
        tableEl.style.minWidth = '1120px';
        const parentContainer = tableEl.parentElement;
        if (parentContainer) {
            parentContainer.classList.add('table-scroll-container');
        }
        
        const theadEl = tableEl.querySelector('thead');
        if (theadEl) {
            theadEl.innerHTML = `
                <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">클라이언트명</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">기본 계약 예산</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">누적 충전액</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">충전금액</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">충전대기</th>
                    <th class="p-3.5 md:p-4 font-bold text-blue-600 whitespace-nowrap text-left">계약 기간/마감일</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left">소진율(%)</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-left min-w-[160px]">기타(메모)</th>
                    <th class="p-3.5 md:p-4 font-bold whitespace-nowrap text-center w-24">수정</th>
                </tr>
            `;
        }
    }

    budgetTbody.innerHTML = '';

    let sumTotal = 0, sumRecharged = 0, sumSpent = 0;

    allClientsData.forEach((data, index) => {
        const total = Number(data.totalBudget) || 0;
        const recharged = Number(data.rechargedBudget) || 0;
        const used = Number(data.usedBudget) || 0;
        
        sumTotal += total;
        sumRecharged += recharged;
        sumSpent += used;

        const maxBudget = total + recharged;
        const remaining = maxBudget - used;
        const percent = maxBudget > 0 ? Math.min(100, (used / maxBudget) * 100) : 0;
        
        const formatWon = (val) => val.toLocaleString() + '원';
        const contractPeriod = data.contractPeriod || '-'; 
        const memoText = (data.memo || data.budgetMemo) ? (data.memo || data.budgetMemo) : '';

        // 🌟 잘림 없는 마우스 호버 이벤트를 지원하는 메모 요소 생성
        const memoContentHtml = memoText ? `
            <span class="memo-hover-trigger truncate block max-w-[150px] text-gray-700 font-medium cursor-pointer" data-memo="${memoText.replace(/"/g, '&quot;')}">${memoText}</span>
        ` : `<span class="text-gray-400">-</span>`;

        let budgetProgressHtml = `
            <div class="flex flex-col gap-1 w-full min-w-[120px]">
                <div class="w-full bg-gray-100 rounded-full h-2 shadow-inner overflow-hidden">
                    <div class="${percent > 90 ? 'bg-red-500' : 'bg-hermes'} h-2 rounded-full transition-all" style="width: ${percent}%"></div>
                </div>
            </div>
        `;

        const tr = `
            <tr class="hover:bg-blue-50/30 transition border-b border-gray-100 whitespace-nowrap">
                <td class="p-3.5 md:p-4 font-black text-gray-900 align-middle whitespace-nowrap">${data.name}</td>
                <td class="p-3.5 md:p-4 font-bold text-gray-700 align-middle whitespace-nowrap">${formatWon(total)}</td>
                <td class="p-3.5 md:p-4 font-bold text-blue-600 align-middle whitespace-nowrap">${formatWon(recharged)}</td>
                <td class="p-3.5 md:p-4 font-bold text-amber-600 align-middle whitespace-nowrap">${formatWon(used)}</td> 
                <td class="p-3.5 md:p-4 font-black text-hermes align-middle whitespace-nowrap">${formatWon(remaining)}</td> 
                <td class="p-3.5 md:p-4 font-bold text-blue-700 align-middle whitespace-nowrap">${contractPeriod}</td> 
                <td class="p-3.5 md:p-4 align-middle whitespace-nowrap">
                    <div class="text-xs font-bold text-gray-600 mb-1">${percent.toFixed(1)}%</div>
                    ${budgetProgressHtml}
                </td>
                <td class="p-3.5 md:p-4 text-xs font-medium text-gray-600 align-middle whitespace-nowrap min-w-[160px]">${memoContentHtml}</td>
                <td class="p-3.5 md:p-4 text-center align-middle whitespace-nowrap w-24">
                    <button type="button" class="edit-budget-btn bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-sm whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5" data-id="${data.id}"><i class="fa-solid fa-pen-to-square"></i> 수정</button>
                </td>
            </tr>
        `;
        budgetTbody.innerHTML += tr;
    });

    bindMemoTooltipEvents(budgetTbody);

    const elTotal = document.getElementById('kpiTotalBudget');
    const elRecharged = document.getElementById('kpiRechargedBudget');
    const elSpent = document.getElementById('kpiSpentBudget');
    const elRemaining = document.getElementById('kpiRemainingBudget');

    if(elTotal) elTotal.innerText = sumTotal.toLocaleString() + '원';
    if(elRecharged) elRecharged.innerText = sumRecharged.toLocaleString() + '원';
    if(elSpent) elSpent.innerText = sumSpent.toLocaleString() + '원';
    if(elRemaining) elRemaining.innerText = ((sumTotal + sumRecharged) - sumSpent).toLocaleString() + '원';
}

function openBudgetEditModal(clientId) {
    const client = clientsMap[clientId];
    if (!client) return;
    currentEditBudgetId = clientId;

    const titleEl = document.getElementById('budgetEditClientTitle');
    const totalIn = document.getElementById('edit_b_total');
    const rechargeIn = document.getElementById('edit_b_recharge');
    const usedIn = document.getElementById('edit_b_used');
    const contractIn = document.getElementById('edit_b_contract');

    if (titleEl) titleEl.innerText = client.name;
    if (totalIn) totalIn.value = client.totalBudget || 0;
    if (rechargeIn) rechargeIn.value = client.rechargedBudget || 0;
    if (usedIn) usedIn.value = client.usedBudget || 0;
    if (contractIn) contractIn.value = client.contractPeriod || '';

    // 모달 내 메모 입력 인풋창 동적 보완 (없을 경우 자동 추가)
    const formEl = document.getElementById('budgetEditForm');
    let memoIn = document.getElementById('edit_b_memo');
    if (!memoIn && formEl) {
        const btnGroup = formEl.querySelector('.flex.justify-end');
        const memoDiv = document.createElement('div');
        memoDiv.className = 'mb-3';
        memoDiv.innerHTML = `
            <label class="block text-[10px] font-bold text-gray-700 mb-1">기타 (메모)</label>
            <input type="text" id="edit_b_memo" placeholder="전달사항 및 메모 입력" class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:border-blue-500 outline-none font-medium">
        `;
        if (btnGroup) {
            formEl.insertBefore(memoDiv, btnGroup);
        } else {
            formEl.appendChild(memoDiv);
        }
        memoIn = document.getElementById('edit_b_memo');
    }

    if (memoIn) {
        memoIn.value = client.memo || client.budgetMemo || '';
    }

    if (budgetEditModal) {
        budgetEditModal.classList.remove('hidden');
        budgetEditModal.style.zIndex = "99999";
    }
}

safeAddListener('budgetEditForm', 'submit', async (e) => {
    e.preventDefault();
    if (!currentEditBudgetId) return;

    const totalIn = document.getElementById('edit_b_total');
    const rechargeIn = document.getElementById('edit_b_recharge');
    const usedIn = document.getElementById('edit_b_used');
    const contractIn = document.getElementById('edit_b_contract');
    const memoIn = document.getElementById('edit_b_memo');

    const submitBtn = budgetEditModal.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerText : '저장';
    if(submitBtn) { submitBtn.innerText = '저장 중...'; submitBtn.disabled = true; }

    try {
        const updateData = {
            totalBudget: totalIn ? Number(totalIn.value) : 0,
            rechargedBudget: rechargeIn ? Number(rechargeIn.value) : 0,
            usedBudget: usedIn ? Number(usedIn.value) : 0,
            updatedAt: new Date().toISOString()
        };

        if (contractIn) updateData.contractPeriod = contractIn.value;
        if (memoIn) {
            updateData.memo = memoIn.value;
            updateData.budgetMemo = memoIn.value;
        }

        await updateDoc(doc(db, "clients", currentEditBudgetId), updateData);
        
        budgetEditModal.classList.add('hidden');
        alert("해당 클라이언트의 정보가 업데이트되었습니다.");
        fetchClients();

    } catch (err) {
        alert("예산 수정 실패: " + err.message);
    } finally {
        if(submitBtn) { submitBtn.innerText = origText; submitBtn.disabled = false; }
    }
});

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
                    <button class="edit-lib-btn text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition whitespace-nowrap" data-id="${item.id}">수정</button>
                    <button class="delete-lib-btn text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition whitespace-nowrap" data-id="${item.id}">삭제</button>
                </div>
            ` : '';

            grid.innerHTML += `
                <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col cursor-pointer lib-card-trigger" data-id="${item.id}">
                    <div class="h-36 bg-gray-50 relative overflow-hidden flex items-center justify-center border-b border-gray-100">
                        <div class="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-transparent"></div>
                        <i class="${item.iconClass || 'fa-solid fa-file-lines text-hermes'} text-5xl group-hover:scale-110 transition duration-300"></i>
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <div class="mb-3 flex items-center justify-between">
                            <span class="inline-block px-2.5 py-1 bg-orange-50 text-hermes text-[10px] font-bold rounded-md border border-orange-100 whitespace-nowrap">${item.category || '가이드'}</span>
                            ${adminBtns}
                        </div>
                        <h3 class="font-black text-gray-900 mb-2 leading-snug group-hover:text-hermes transition break-keep">${item.title}</h3>
                        <p class="text-xs text-gray-500 mb-5 line-clamp-2 leading-relaxed flex-1 break-keep">${item.desc || ''}</p>
                        <div class="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                            <button class="text-xs font-bold text-gray-600 hover:text-hermes transition flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-book-open"></i> 상세보기</button>
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

        checkAllNavBadges();

    } catch (e) { console.error("Library fetch error:", e); }
}

async function openLibraryViewModal(id) {
    const item = libraryMap[id];
    if (!item) return;

    currentViewLibId = id;
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'library';
    const newUrl = `${window.location.pathname}?tab=${activeTab}&libId=${id}`;
    window.history.pushState({ tab: activeTab, libId: id }, '', newUrl);

    const newViewerObj = {
        name: currentUserName || "사용자",
        ip: currentClientIP,
        timestamp: new Date().toISOString()
    };
    
    const existingViewers = item.viewers || [];
    const updatedViewers = [newViewerObj, ...existingViewers].slice(0, 10);
    item.views = (item.views || 0) + 1;
    item.viewers = updatedViewers;

    try {
        await updateDoc(doc(db, "crm_library", id), { 
            views: increment(1),
            viewers: updatedViewers 
        });
    } catch (e) { console.error("Library view update error:", e); }

    if (document.getElementById('libViewCategory')) document.getElementById('libViewCategory').innerText = item.category || '가이드';
    if (document.getElementById('libViewTitle')) document.getElementById('libViewTitle').innerText = item.title;
    if (document.getElementById('libViewHtmlContent')) document.getElementById('libViewHtmlContent').innerHTML = item.htmlContent || '<p>상세 내용이 없습니다.</p>';

    const libViewCountNumEl = document.getElementById('libViewCountNum');
    if (libViewCountNumEl) {
        libViewCountNumEl.innerText = item.views;
    }

    const libViewersListContentEl = document.getElementById('libViewersListContent');
    if (libViewersListContentEl) {
        if (!item.viewers || item.viewers.length === 0) {
            libViewersListContentEl.innerHTML = '<div class="text-[11px] text-gray-400 py-1 text-center">조회 기록이 없습니다.</div>';
        } else {
            libViewersListContentEl.innerHTML = item.viewers.map(v => {
                const dateObj = new Date(v.timestamp);
                const dateStr = dateObj.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit', hour12: false });
                return `
                    <div class="flex items-center justify-between text-[11px] py-1 border-b border-gray-100 last:border-0">
                        <span class="font-bold text-gray-800">${v.name}</span>
                        <span class="font-mono text-gray-500 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">${v.ip || '127.0.0.1'}</span>
                        <span class="text-gray-400 text-[10px]">${dateStr}</span>
                    </div>
                `;
            }).join('');
        }
    }

    const libViewEditBtn = document.getElementById('libViewEditBtn');
    if (libViewEditBtn) {
        if (checkIsAdmin()) {
            libViewEditBtn.classList.remove('hidden');
            libViewEditBtn.onclick = () => {
                if (libraryViewModal) libraryViewModal.classList.add('hidden');
                openLibraryEditModal(id);
            };
        } else {
            libViewEditBtn.classList.add('hidden');
        }
    }

    const libViewFileBtn = document.getElementById('libViewFileBtn');
    if (libViewFileBtn) {
        libViewFileBtn.innerHTML = renderFileButtons(item, false);
    }

    if (libraryViewModal) {
        libraryViewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }
    logActivity("라이브러리 열람", `[${item.title}] 가이드북 HTML 열람`);
}

function openLibraryEditModal(id) {
    const item = libraryMap[id];
    if (!item) return;
    currentEditLibId = id;

    if (libraryEditModal) {
        document.getElementById('libFormCategory').value = item.category || '';
        document.getElementById('libFormIcon').value = item.iconClass || '';
        document.getElementById('libFormTitle').value = item.title || '';
        document.getElementById('libFormDesc').value = item.desc || '';
        document.getElementById('libFormHtmlContent').value = item.htmlContent || '';

        libraryEditModal.classList.remove('hidden');
        libraryEditModal.style.zIndex = "99999";
    }
}

safeAddListener('libraryForm', 'submit', async (e) => {
    e.preventDefault();
    const submitBtn = libraryEditModal.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerText : '저장 완료';
    if (submitBtn) {
        submitBtn.innerText = "저장 중...";
        submitBtn.disabled = true;
    }

    try {
        const categoryVal = document.getElementById('libFormCategory').value;
        const iconVal = document.getElementById('libFormIcon').value;
        const titleVal = document.getElementById('libFormTitle').value;
        const descVal = document.getElementById('libFormDesc').value;
        const htmlVal = document.getElementById('libFormHtmlContent').value;
        const fileInput = document.getElementById('libFormFile');

        let libData = {
            category: categoryVal,
            iconClass: iconVal,
            title: titleVal,
            desc: descVal,
            htmlContent: htmlVal,
            updatedAt: new Date().toISOString()
        };

        if (fileInput && fileInput.files.length > 0) {
            const attachedFiles = await uploadFilesToStorage(fileInput.files, "crm_library");
            libData.files = attachedFiles;
        }

        if (currentEditLibId) {
            await updateDoc(doc(db, "crm_library", currentEditLibId), libData);
            alert("라이브러리 콘텐츠가 수정되었습니다.");
        } else {
            libData.createdAt = new Date().toISOString();
            libData.views = 0;
            libData.viewers = [];
            await addDoc(collection(db, "crm_library"), libData);
            alert("새로운 콘텐츠가 등록되었습니다.");
        }

        libraryEditModal.classList.add('hidden');
        document.getElementById('libraryForm').reset();
        currentEditLibId = null;
        fetchLibraryItems();

    } catch (err) {
        alert("라이브러리 저장 실패: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        }
    }
});

// ============================================================================
// 10. 멤버 관리 / 승인 관리 / 로그 모니터링 모듈
// ============================================================================
async function fetchMembers() {
    const isAdmin = checkIsAdmin();
    if(!isAdmin) return;
    const tbody = document.getElementById('membersTable');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin text-hermes mr-2"></i> 전체 멤버 로딩 중...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">등록된 멤버가 없습니다.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const statusBadge = user.status === 'approved' 
                ? '<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold border border-blue-100 whitespace-nowrap">승인완료</span>'
                : '<span class="bg-red-50 text-red-500 px-2 py-1 rounded text-[10px] font-bold border border-red-100 whitespace-nowrap">대기중</span>';

            const tr = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100 break-keep">
                    <td class="p-3 md:p-4 font-bold text-gray-900 align-middle whitespace-nowrap">${user.name || '미설정'}</td>
                    <td class="p-3 md:p-4 text-gray-500 text-xs align-middle whitespace-nowrap">${user.email || '-'}</td>
                    <td class="p-3 md:p-4 align-middle whitespace-nowrap">${statusBadge}</td>
                    <td class="p-3 md:p-4 align-middle whitespace-nowrap">
                        <select class="role-update-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player" ${user.role==='player'?'selected':''}>Player (담당 직원)</option>
                            <option value="leader" ${user.role==='leader'?'selected':''}>리더 (노아 대표)</option>
                            <option value="admin" ${user.role==='admin'?'selected':''}>최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle whitespace-nowrap">
                        <button class="update-member-btn bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap" data-uid="${docSnap.id}" data-name="${user.name}">권한수정</button>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle whitespace-nowrap">
                        <button class="delete-member-btn bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap" data-uid="${docSnap.id}" data-name="${user.name}">강제탈퇴</button>
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
    } catch (error) { console.error("멤버 전체 로드 에러:", error); }
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
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition break-keep">
                    <td class="p-3 md:p-4 font-bold text-gray-900 align-middle whitespace-nowrap">${user.name}</td>
                    <td class="p-3 md:p-4 text-gray-500 font-medium align-middle whitespace-nowrap">${user.email}</td>
                    <td class="p-3 md:p-4 align-middle whitespace-nowrap">
                        <select class="role-select text-xs font-bold border border-gray-300 rounded p-1.5 focus:border-hermes outline-none" data-uid="${docSnap.id}">
                            <option value="player">Player (담당 직원)</option>
                            <option value="leader">리더 (노아 대표)</option>
                            <option value="admin">최상위 관리자 (Admin)</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-center align-middle whitespace-nowrap">
                        <button class="approve-btn bg-hermes hover:bg-hermes-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap" data-uid="${docSnap.id}" data-name="${user.name}">승인</button>
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

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500 font-bold"><i class="fa-solid fa-spinner animate-spin mr-2"></i> 로그 데이터 수집 중...</td></tr>';

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
                <tr class="hover:bg-gray-50 transition border-b border-gray-100 break-keep">
                    <td class="p-3 md:p-4 text-xs font-medium text-gray-500 align-middle whitespace-nowrap">${dateStr}</td>
                    <td class="p-3 md:p-4 text-xs font-bold text-gray-800 align-middle whitespace-nowrap">${log.name} (${log.email})</td>
                    <td class="p-3 md:p-4 text-xs font-mono text-gray-500 align-middle whitespace-nowrap">${log.ip || '127.0.0.1'}</td>
                    <td class="p-3 md:p-4 align-middle whitespace-nowrap"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold text-[11px] whitespace-nowrap">${log.action}</span></td>
                    <td class="p-3 md:p-4 text-xs text-gray-600 font-medium whitespace-normal align-middle break-all">${log.details || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    } catch (error) { console.error("Log error:", error); }
}

// ============================================================================
// 11. 네비게이션 및 로그인 핸들러 연동
// ============================================================================
safeAddListener('googleLoginBtn', 'click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google 로그인 에러 예외 객체:", error);
        
        if (error.code === 'auth/popup-blocked') {
            alert("브라우저 팝업이 차단되었습니다. 팝업 차단을 해제하거나 리디렉션 로그인을 진행해 주세요.");
            try {
                await signInWithRedirect(auth, provider);
            } catch (redirErr) {
                alert(`리디렉션 로그인 오류: ${redirErr.message}`);
            }
        } else if (error.code === 'auth/unauthorized-domain') {
            alert("Google Cloud Console(GCP) '승인된 자바스크립트 원본'에 도메인이 추가되었는지 점검해 주세요.");
        } else if (error.code !== 'auth/popup-closed-by-user') {
            alert(`Google 로그인 인증 실패\n(사유: [${error.code}] ${error.message})`);
        }
    }
});

safeAddListener('logoutBtn', 'click', () => signOut(auth));
safeAddListener('closePendingBtn', 'click', () => signOut(auth));

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const menu = e.currentTarget.getAttribute('data-menu');
        switchTab(menu, true);
    });
});

window.addEventListener('popstate', (e) => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentTab = urlParams.get('tab') || urlParams.get('menu') || 'dashboard';
    const taskId = urlParams.get('id');
    
    if (taskId && tasksMap[taskId]) {
        openDetailModal(taskId);
    } else {
        closeAllModals();
        switchTab(currentTab, false);
    }
});

const libraryGridEl = document.getElementById('libraryGrid');
if (libraryGridEl) {
    libraryGridEl.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-lib-btn');
        if (editBtn) {
            e.stopPropagation();
            const libId = editBtn.getAttribute('data-id');
            if (libId) openLibraryEditModal(libId);
            return;
        }

        const delBtn = e.target.closest('.delete-lib-btn');
        if (delBtn) {
            e.stopPropagation();
            const libId = delBtn.getAttribute('data-id');
            const item = libraryMap[libId];
            if (item && confirm(`[${item.title}] 라이브러리를 삭제하시겠습니까?`)) {
                deleteDoc(doc(db, "crm_library", libId)).then(() => {
                    alert("삭제되었습니다.");
                    fetchLibraryItems();
                }).catch(err => alert("삭제 실패: " + err.message));
            }
            return;
        }
    });
}