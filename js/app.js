// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmzIa1fQi7oQX6AYq7edL5xysTliJf-Zo",
    authDomain: "my-finance-tracker-f2e77.firebaseapp.com",
    projectId: "my-finance-tracker-f2e77",
    storageBucket: "my-finance-tracker-f2e77.firebasestorage.app",
    messagingSenderId: "326761442514",
    appId: "1:326761442514:web:0a314b6a263db75516510b",
    measurementId: "G-CT0B9S5E5P"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const collectionName = "transactions";

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authActionBtn = document.getElementById('auth-action-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const authTitle = document.getElementById('auth-title');
const logoutBtn = document.getElementById('logout-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const userDisplayEmail = document.getElementById('user-display-email');

const transactionForm = document.getElementById('transaction-form');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formTitle = document.getElementById('form-title');
const transactionsTableBody = document.getElementById('transactions-table-body');
const transactionsCardsList = document.getElementById('transactions-cards-list');
const bankCardsGrid = document.getElementById('bank-cards-grid');
const bankSummaryBody = document.getElementById('bank-summary-body');
const typeSummaryContainer = document.getElementById('type-summary-container');
const reportBankSelect = document.getElementById('report_bank');
const filterBankSelect = document.getElementById('filter-bank');
const reportResult = document.getElementById('report-result');

let allTransactions = [];
let editMode = false;
let currentEditId = null;
let selectedIds = new Set();
let isLoginMode = true;
let currentUserId = null;
let unsubscribeSnapshot = null;

// Search & Filter State
let searchQuery = '';
let filterType = 'all'; // 'all' | 'expense' | 'income'
let filterBank = '';
let isSelectMode = false;

// ---------------------------------------------------------
// TOAST NOTIFICATIONS
// ---------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ---------------------------------------------------------
// AUTHENTICATION & DEMO MODE HANDLING
// ---------------------------------------------------------

let isDemoMode = false;

// Check if running on file:// protocol
if (window.location.protocol === 'file:') {
    const warningEl = document.getElementById('protocol-warning');
    if (warningEl) {
        warningEl.style.display = 'block';
    }
    console.warn("Running on file:// protocol. Firebase Auth requires http:// or https://. Run ./start.sh or click 'Offline / Demo Mode'.");
}

function startDemoMode() {
    isDemoMode = true;
    currentUserId = 'local-demo-user';
    if (userDisplayEmail) {
        userDisplayEmail.textContent = 'Offline / Demo';
        userDisplayEmail.setAttribute('title', 'Running in offline localStorage mode');
    }
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    loadDemoTransactions();
    showToast("Running in Offline / Demo Mode! All features available.", "success");
}

function loadDemoTransactions() {
    const stored = localStorage.getItem('sdq_offline_transactions');
    if (stored) {
        try {
            allTransactions = JSON.parse(stored);
        } catch(e) {
            allTransactions = [];
        }
    } else {
        const today = new Date().toISOString().split('T')[0];
        allTransactions = [
            { id: 'demo-1', type: 'income', amount: 50000, date: today, description: 'Salary', bank: 'SBI', details: 'Monthly Salary' },
            { id: 'demo-2', type: 'expense', amount: 1500, date: today, description: 'Food & Dining', bank: 'CASH', details: 'Weekend Dinner' },
            { id: 'demo-3', type: 'expense', amount: 2500, date: today, description: 'Grocery', bank: 'FED', details: 'Supermarket' },
            { id: 'demo-4', type: 'expense', amount: 800, date: today, description: 'Fuel', bank: 'CASH', details: 'Petrol' }
        ];
        saveDemoTransactions();
    }
    renderAll();
}

function saveDemoTransactions() {
    localStorage.setItem('sdq_offline_transactions', JSON.stringify(allTransactions));
}

try {
    auth.onAuthStateChanged(user => {
        if (isDemoMode) return;
        if (user) {
            // User logged in
            currentUserId = user.uid;
            if (userDisplayEmail) {
                userDisplayEmail.textContent = user.email ? user.email.split('@')[0] : 'My Account';
                userDisplayEmail.setAttribute('title', user.email || 'Logged in');
            }
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
            loadTransactions();
        } else {
            // User logged out
            currentUserId = null;
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
            
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            
            allTransactions = [];
            renderAll(); // Clear UI
            resetForm();
        }
    });
} catch (e) {
    console.error("Auth initialization error:", e);
    if (window.location.protocol === 'file:') {
        const warningEl = document.getElementById('protocol-warning');
        if (warningEl) warningEl.style.display = 'block';
    }
}

authToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "Login to Finance Tracker";
        authActionBtn.querySelector('span').textContent = "Login";
        authToggleText.textContent = "Don't have an account? ";
        authToggleBtn.textContent = "Register here";
    } else {
        authTitle.textContent = "Create New Account";
        authActionBtn.querySelector('span').textContent = "Register";
        authToggleText.textContent = "Already have an account? ";
        authToggleBtn.textContent = "Login here";
    }
});

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const handleAuthError = (error) => {
        if (error.code === 'auth/operation-not-supported-in-this-environment' || window.location.protocol === 'file:') {
            const warningEl = document.getElementById('protocol-warning');
            if (warningEl) warningEl.style.display = 'block';
            showToast("Local server required. Run ./start.sh or click 'Offline / Demo Mode' below!", "error");
        } else {
            showToast(error.message, "error");
        }
    };

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                authForm.reset();
                showToast("Logged in successfully!", "success");
            })
            .catch(handleAuthError);
    } else {
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                authForm.reset();
                showToast("Account created successfully!", "success");
            })
            .catch(handleAuthError);
    }
});

googleLoginBtn.addEventListener('click', () => {
    if (window.location.protocol === 'file:') {
        const warningEl = document.getElementById('protocol-warning');
        if (warningEl) warningEl.style.display = 'block';
        showToast("Google Sign-In requires http://. Run ./start.sh or use Offline Mode.", "error");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(() => {
            showToast("Signed in with Google!", "success");
        })
        .catch(error => {
            if (error.code === 'auth/operation-not-supported-in-this-environment') {
                showToast("Google Sign-In requires http://. Run ./start.sh or use Offline Mode.", "error");
            } else if (error.code === 'auth/popup-blocked') {
                auth.signInWithRedirect(provider);
            } else {
                console.error("Google Sign-In Error", error);
                showToast(error.message, "error");
            }
        });
});

logoutBtn.addEventListener('click', () => {
    if (isDemoMode) {
        isDemoMode = false;
        currentUserId = null;
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
        allTransactions = [];
        renderAll();
        resetForm();
        showToast("Exited Offline Mode", "info");
        return;
    }

    auth.signOut()
        .then(() => showToast("Logged out", "info"))
        .catch(error => console.error("Logout error", error));
});



// ---------------------------------------------------------
// DATA FETCHING & REAL-TIME LISTENER
// ---------------------------------------------------------

function loadTransactions() {
    if (!currentUserId) return;
    
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }

    unsubscribeSnapshot = db.collection(collectionName)
        .where("userId", "==", currentUserId)
        .onSnapshot((querySnapshot) => {
            allTransactions = [];
            querySnapshot.forEach((doc) => {
                allTransactions.push({ id: doc.id, ...doc.data() });
            });

            // Sort by date descending
            allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            renderAll();
        }, (error) => {
            console.error("Error getting documents: ", error);
            showToast("Error loading data. Check Firestore rules.", "error");
        });
}

function renderAll() {
    renderTransactionsTable();
    renderStats();
    renderBankSummary();
    renderTypeSummary();
    populateBankSelect();
}


// ---------------------------------------------------------
// SEARCH & FILTER HANDLING
// ---------------------------------------------------------

function handleSearch(val) {
    searchQuery = (val || '').toLowerCase().trim();
    renderTransactionsTable();
}

function setTxFilterType(type, btn) {
    filterType = type;
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTransactionsTable();
}

function handleBankFilter(bank) {
    filterBank = bank;
    renderTransactionsTable();
}

function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    const btn = document.getElementById('btn-toggle-select');
    const text = document.getElementById('select-mode-text');
    if (isSelectMode) {
        btn.classList.add('active');
        text.textContent = 'Cancel';
    } else {
        btn.classList.remove('active');
        text.textContent = 'Select';
        clearSelection();
    }
    renderTransactionsTable();
}

function clearSelection() {
    selectedIds.clear();
    const selectAllCheck = document.getElementById('select-all');
    if (selectAllCheck) selectAllCheck.checked = false;
    updateBulkActionsBar();
    renderTransactionsTable();
}


// ---------------------------------------------------------
// RENDER TRANSACTIONS (MOBILE CARDS & DESKTOP TABLE)
// ---------------------------------------------------------

function getFilteredTransactions() {
    return allTransactions.filter(t => {
        // Type filter
        if (filterType !== 'all' && t.type !== filterType) {
            return false;
        }

        // Bank filter
        if (filterBank && t.bank !== filterBank) {
            return false;
        }

        // Search query
        if (searchQuery) {
            const desc = (t.description || '').toLowerCase();
            const bank = (t.bank || '').toLowerCase();
            const details = (t.details || '').toLowerCase();
            const amount = String(t.amount || '');
            const date = (t.date || '').toLowerCase();

            if (!desc.includes(searchQuery) && 
                !bank.includes(searchQuery) && 
                !details.includes(searchQuery) && 
                !amount.includes(searchQuery) &&
                !date.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });
}

function renderTransactionsTable() {
    const filtered = getFilteredTransactions();

    // 1. Render Mobile Cards View
    if (transactionsCardsList) {
        transactionsCardsList.innerHTML = '';
        if (filtered.length === 0) {
            transactionsCardsList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <p>No transactions found</p>
                </div>
            `;
        } else {
            filtered.forEach(t => {
                const isSelected = selectedIds.has(t.id);
                const isIncome = t.type === 'income';
                const card = document.createElement('div');
                card.className = `tx-card ${isIncome ? 'income-card' : 'expense-card'}`;
                
                const formattedDate = formatDateDisplay(t.date);
                const sign = isIncome ? '+' : '-';
                const iconSvg = isIncome 
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;

                card.innerHTML = `
                    <div class="tx-checkbox-wrap" style="${isSelectMode ? 'display: flex;' : 'display: none;'}">
                        <input type="checkbox" class="row-checkbox" data-id="${t.id}" ${isSelected ? 'checked' : ''} onchange="handleRowSelection(event, '${t.id}')">
                    </div>
                    <div class="tx-icon-badge">
                        ${iconSvg}
                    </div>
                    <div class="tx-info">
                        <div class="tx-header-row">
                            <span class="tx-category">${escapeHtml(t.description || 'Uncategorized')}</span>
                            <span class="tx-amount">${sign} ${formatCurrency(t.amount)}</span>
                        </div>
                        <div class="tx-meta-row">
                            <div class="tx-tags">
                                <span class="tx-bank-badge">${escapeHtml(t.bank || 'CASH')}</span>
                                ${t.details ? `<span class="tx-details" title="${escapeHtml(t.details)}">${escapeHtml(t.details)}</span>` : ''}
                            </div>
                            <span class="tx-date">${formattedDate}</span>
                        </div>
                    </div>
                    <div class="tx-actions no-print">
                        <button class="btn-card-action" onclick="editTransaction('${t.id}')" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-card-action delete-action" onclick="deleteTransaction('${t.id}')" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                `;
                transactionsCardsList.appendChild(card);
            });
        }
    }

    // 2. Render Desktop Table View
    if (transactionsTableBody) {
        transactionsTableBody.innerHTML = '';

        if (filtered.length === 0) {
            transactionsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">No transactions found matching your criteria.</td></tr>';
        } else {
            filtered.forEach(t => {
                const row = document.createElement('tr');
                row.className = t.type === 'income' ? 'income-row' : 'expense-row';
                const isSelected = selectedIds.has(t.id);
                const isIncome = t.type === 'income';

                row.innerHTML = `
                    <td class="no-print" style="text-align: center;">
                        <input type="checkbox" class="row-checkbox" data-id="${t.id}" ${isSelected ? 'checked' : ''} onchange="handleRowSelection(event, '${t.id}')">
                    </td>
                    <td>${t.date}</td>
                    <td><span class="${isIncome ? 'tx-bank-badge' : 'tx-bank-badge'}" style="background: ${isIncome ? 'var(--income-bg)' : 'var(--expense-bg)'}; color: ${isIncome ? 'var(--income-dark)' : 'var(--expense-dark)'};">${capitalize(t.type)}</span></td>
                    <td style="font-weight: 700; color: ${isIncome ? 'var(--income)' : 'var(--expense)'};">${isIncome ? '+' : '-'} ${formatCurrency(t.amount)}</td>
                    <td><strong>${escapeHtml(t.description || '')}</strong></td>
                    <td><span class="tx-bank-badge">${escapeHtml(t.bank || '')}</span></td>
                    <td style="color: var(--text-secondary);">${escapeHtml(t.details || '')}</td>
                    <td class="action-buttons no-print" style="text-align: center;">
                        <div class="action-menu">
                            <button type="button" class="action-btn" onclick="toggleActionDropdown(event, this)">Actions ▾</button>
                            <div class="dropdown-content">
                                <button type="button" onclick="editTransaction('${t.id}')">✏️ Edit</button>
                                <button type="button" onclick="deleteTransaction('${t.id}')" style="color: var(--expense);">🗑️ Delete</button>
                            </div>
                        </div>
                    </td>
                `;
                transactionsTableBody.appendChild(row);
            });
        }
    }

    updateBulkActionsBar();
}

function toggleActionDropdown(e, btn) {
    e.stopPropagation();
    const dropdown = btn.nextElementSibling;
    const isShowing = dropdown.classList.contains('show');
    
    // Close other dropdowns
    document.querySelectorAll('.dropdown-content.show').forEach(d => d.classList.remove('show'));
    
    if (!isShowing) {
        dropdown.classList.add('show');
    }
}

// Close dropdown on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-content.show').forEach(d => d.classList.remove('show'));
});

function handleRowSelection(event, id) {
    if (event.target.checked) {
        selectedIds.add(id);
    } else {
        selectedIds.delete(id);
    }
    
    const filtered = getFilteredTransactions();
    const selectAllCheck = document.getElementById('select-all');
    if (selectAllCheck) {
        selectAllCheck.checked = selectedIds.size === filtered.length && filtered.length > 0;
    }
    
    updateBulkActionsBar();
}

function toggleSelectAll() {
    const selectAllCheck = document.getElementById('select-all');
    const filtered = getFilteredTransactions();

    if (selectAllCheck.checked) {
        filtered.forEach(t => selectedIds.add(t.id));
    } else {
        selectedIds.clear();
    }
    renderTransactionsTable();
}

function updateBulkActionsBar() {
    const bar = document.getElementById('bulk-actions');
    const countSpan = document.getElementById('selected-count');
    
    if (selectedIds.size > 0) {
        bar.style.display = 'flex';
        countSpan.textContent = `${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''} selected`;
    } else {
        bar.style.display = 'none';
    }
}

function bulkDelete() {
    if (selectedIds.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedIds.size} transactions?`)) {
        if (isDemoMode) {
            allTransactions = allTransactions.filter(x => !selectedIds.has(x.id));
            saveDemoTransactions();
            showToast(`${selectedIds.size} transactions deleted`, "info");
            selectedIds.clear();
            const selectAllCheck = document.getElementById('select-all');
            if (selectAllCheck) selectAllCheck.checked = false;
            renderAll();
            return;
        }

        const batch = db.batch();
        selectedIds.forEach(id => {
            const ref = db.collection(collectionName).doc(id);
            batch.delete(ref);
        });
        
        batch.commit().then(() => {
            showToast(`${selectedIds.size} transactions deleted`, "info");
            selectedIds.clear();
            const selectAllCheck = document.getElementById('select-all');
            if (selectAllCheck) selectAllCheck.checked = false;
        }).catch(err => {
            console.error("Error deleting batch:", err);
            showToast("Error deleting transactions.", "error");
        });
    }
}

function showBulkEdit() {
    if (selectedIds.size === 0) return;
    
    document.getElementById('bulk-edit-count').textContent = selectedIds.size;
    document.getElementById('bulk-edit-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
}

function closeBulkEdit() {
    document.getElementById('bulk-edit-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('bulk-edit-form').reset();
}

function applyBulkEdit(e) {
    e.preventDefault();
    
    const updateType = document.getElementById('update-type-check').checked;
    const updateBank = document.getElementById('update-bank-check').checked;
    const updateDesc = document.getElementById('update-desc-check').checked;
    
    if (!updateType && !updateBank && !updateDesc) {
        showToast("Select at least one field to update.", "error");
        return;
    }
    
    const data = {};
    if (updateType) data.type = document.getElementById('bulk_transaction_type').value;
    if (updateBank) data.bank = document.getElementById('bulk_bank_name').value;
    if (updateDesc) data.description = document.getElementById('bulk_description').value.trim();

    if (isDemoMode) {
        allTransactions.forEach(t => {
            if (selectedIds.has(t.id)) {
                if (updateType) t.type = data.type;
                if (updateBank) t.bank = data.bank;
                if (updateDesc) t.description = data.description;
            }
        });
        saveDemoTransactions();
        showToast(`${selectedIds.size} transactions updated.`, "success");
        selectedIds.clear();
        const selectAll = document.getElementById('select-all');
        if (selectAll) selectAll.checked = false;
        closeBulkEdit();
        renderAll();
        return;
    }

    const batch = db.batch();
    selectedIds.forEach(id => {
        const ref = db.collection(collectionName).doc(id);
        batch.update(ref, data);
    });
    
    batch.commit().then(() => {
        showToast(`${selectedIds.size} transactions updated.`, "success");
        selectedIds.clear();
        const selectAll = document.getElementById('select-all');
        if (selectAll) selectAll.checked = false;
        closeBulkEdit();
    }).catch(err => {
        console.error("Error updating batch:", err);
        showToast("Error updating transactions.", "error");
    });
}

function renderStats() {
    let totalIncome = 0;
    let totalExpense = 0;

    allTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }
    });

    const net = totalIncome - totalExpense;

    document.getElementById('total-income').textContent = `₹ ${formatCurrency(totalIncome)}`;
    document.getElementById('total-expense').textContent = `₹ ${formatCurrency(totalExpense)}`;
    
    const netEl = document.getElementById('net-balance');
    netEl.textContent = `₹ ${formatCurrency(net)}`;
}


// ---------------------------------------------------------
// BANK SUMMARY (INTERACTIVE CARDS & TABLE)
// ---------------------------------------------------------

function renderBankSummary() {
    const bankSummary = {};

    allTransactions.forEach(t => {
        const bank = t.bank || 'CASH';
        if (!bankSummary[bank]) {
            bankSummary[bank] = { income: 0, expense: 0 };
        }

        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            bankSummary[bank].income += amount;
        } else {
            bankSummary[bank].expense += amount;
        }
    });

    const sortedBanks = Object.keys(bankSummary).sort();

    // 1. Populate Bank Cards Grid for Mobile
    if (bankCardsGrid) {
        bankCardsGrid.innerHTML = '';
        if (sortedBanks.length === 0) {
            bankCardsGrid.innerHTML = '<div class="empty-state"><p>No account activity recorded yet.</p></div>';
        } else {
            sortedBanks.forEach(bank => {
                const data = bankSummary[bank];
                const net = data.income - data.expense;
                const isPositive = net >= 0;

                const card = document.createElement('div');
                card.className = 'bank-card';
                card.style.borderTop = `4px solid ${isPositive ? 'var(--income)' : 'var(--expense)'}`;

                card.innerHTML = `
                    <div class="bank-card-header">
                        <div class="bank-name">
                            <svg viewBox="0 0 24 24"><path d="M4 10h16v10H4zM2 6l10-4 10 4v2H2z"/></svg>
                            <span>${escapeHtml(bank)}</span>
                        </div>
                        <span class="tx-bank-badge" style="background: ${isPositive ? 'var(--income-bg)' : 'var(--expense-bg)'}; color: ${isPositive ? 'var(--income-dark)' : 'var(--expense-dark)'};">
                            ${isPositive ? 'Healthy' : 'Overdrawn'}
                        </span>
                    </div>
                    <div class="bank-net-balance" style="color: ${isPositive ? 'var(--text-primary)' : 'var(--expense)'};">
                        ₹ ${formatCurrency(net)}
                    </div>
                    <div class="bank-metrics">
                        <div class="bank-metric-item">
                            <span class="bank-metric-label">In</span>
                            <span class="bank-metric-val" style="color: var(--income);">+₹${formatCurrency(data.income)}</span>
                        </div>
                        <div class="bank-metric-item" style="text-align: right;">
                            <span class="bank-metric-label">Out</span>
                            <span class="bank-metric-val" style="color: var(--expense);">-₹${formatCurrency(data.expense)}</span>
                        </div>
                    </div>
                `;
                bankCardsGrid.appendChild(card);
            });
        }
    }

    // 2. Populate Table View
    if (bankSummaryBody) {
        bankSummaryBody.innerHTML = '';

        if (sortedBanks.length === 0) {
            bankSummaryBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No data available.</td></tr>';
            return;
        }

        sortedBanks.forEach(bank => {
            const data = bankSummary[bank];
            const net = data.income - data.expense;
            const rowClass = net >= 0 ? 'income-row' : 'expense-row';

            const row = document.createElement('tr');
            row.className = rowClass;
            row.innerHTML = `
                <td><strong>${escapeHtml(bank)}</strong></td>
                <td style="color: var(--income);">₹ ${formatCurrency(data.income)}</td>
                <td style="color: var(--expense);">₹ ${formatCurrency(data.expense)}</td>
                <td style="font-weight: 700;">₹ ${formatCurrency(net)}</td>
            `;
            bankSummaryBody.appendChild(row);
        });
    }
}


// ---------------------------------------------------------
// TYPE SUMMARY (CATEGORY BREAKDOWN WITH PROGRESS METERS)
// ---------------------------------------------------------

function renderTypeSummary() {
    const summary = {};

    allTransactions.forEach(t => {
        const month = (t.date || '').substring(0, 7) || 'Unknown';
        const desc = t.description || 'Other';

        if (!summary[month]) summary[month] = { categories: {}, totalExpense: 0, totalIncome: 0 };
        if (!summary[month].categories[desc]) summary[month].categories[desc] = { income: 0, expense: 0 };

        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            summary[month].categories[desc].income += amount;
            summary[month].totalIncome += amount;
        } else {
            summary[month].categories[desc].expense += amount;
            summary[month].totalExpense += amount;
        }
    });

    const sortedMonths = Object.keys(summary).sort().reverse();
    typeSummaryContainer.innerHTML = '';

    if (sortedMonths.length === 0) {
        typeSummaryContainer.innerHTML = '<div class="empty-state"><p>No transaction history available.</p></div>';
        return;
    }

    sortedMonths.forEach(month => {
        let monthName = month;
        try {
            const monthDate = new Date(month + "-01");
            monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        } catch(e) {}

        const monthData = summary[month];
        const monthNet = monthData.totalIncome - monthData.totalExpense;

        const card = document.createElement('div');
        card.className = 'month-group-card';

        let categoriesHtml = '';
        const descs = Object.keys(monthData.categories).sort((a, b) => 
            monthData.categories[b].expense - monthData.categories[a].expense
        );

        descs.forEach(desc => {
            const data = monthData.categories[desc];
            const net = data.income - data.expense;
            const expPct = monthData.totalExpense > 0 
                ? Math.min(100, Math.round((data.expense / monthData.totalExpense) * 100)) 
                : 0;

            categoriesHtml += `
                <div class="category-stat-row">
                    <div class="category-stat-meta">
                        <span class="category-stat-name">${escapeHtml(desc)}</span>
                        <span>
                            ${data.expense > 0 ? `<span style="color: var(--expense); font-weight: 600;">-₹${formatCurrency(data.expense)}</span>` : ''}
                            ${data.income > 0 ? `<span style="color: var(--income); font-weight: 600; margin-left: 6px;">+₹${formatCurrency(data.income)}</span>` : ''}
                        </span>
                    </div>
                    ${data.expense > 0 ? `
                        <div class="category-progress-bg" title="${expPct}% of monthly expenses">
                            <div class="category-progress-fill" style="width: ${expPct}%; background: linear-gradient(90deg, #f87171, #ef4444);"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        card.innerHTML = `
            <div class="month-group-header">
                <div class="month-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${monthName}</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem; color: ${monthNet >= 0 ? 'var(--income)' : 'var(--expense)'};">
                    Net: ₹ ${formatCurrency(monthNet)}
                </div>
            </div>
            ${categoriesHtml}
        `;

        typeSummaryContainer.appendChild(card);
    });
}

function populateBankSelect() {
    const banks = new Set(allTransactions.map(t => t.bank).filter(b => b));
    const sortedBanks = Array.from(banks).sort();

    // Populate Report Bank Select
    if (reportBankSelect) {
        const currentVal = reportBankSelect.value;
        reportBankSelect.innerHTML = '<option value="">-- Select Bank --</option>';
        sortedBanks.forEach(bank => {
            const option = document.createElement('option');
            option.value = bank;
            option.textContent = bank;
            reportBankSelect.appendChild(option);
        });
        reportBankSelect.value = currentVal;
    }

    // Populate Toolbar Filter Bank Select
    if (filterBankSelect) {
        const currentFilter = filterBankSelect.value;
        filterBankSelect.innerHTML = '<option value="">All Accounts</option>';
        sortedBanks.forEach(bank => {
            const option = document.createElement('option');
            option.value = bank;
            option.textContent = bank;
            filterBankSelect.appendChild(option);
        });
        filterBankSelect.value = currentFilter;
    }
}


// ---------------------------------------------------------
// FORM HANDLING & QUICK SHORTCUTS
// ---------------------------------------------------------

function setTransactionType(type) {
    const hiddenSelect = document.getElementById('transaction_type');
    const segExpense = document.getElementById('segment-expense');
    const segIncome = document.getElementById('segment-income');
    
    hiddenSelect.value = type;
    
    if (type === 'expense') {
        segExpense.className = 'segment-btn active expense-active';
        segIncome.className = 'segment-btn';
        submitBtn.className = 'btn-expense';
        if (!editMode) {
            submitBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add Expense</span>
            `;
        }
    } else {
        segIncome.className = 'segment-btn active income-active';
        segExpense.className = 'segment-btn';
        submitBtn.className = 'btn-income';
        if (!editMode) {
            submitBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                <span>Add Income</span>
            `;
        }
    }
}

function pickCategory(category) {
    const descInput = document.getElementById('description');
    descInput.value = category;
    
    // Auto switch to income for Salary
    if (category.toLowerCase() === 'salary') {
        setTransactionType('income');
    }

    descInput.focus();
}

function pickBank(bankName) {
    const bankSelect = document.getElementById('bank_name');
    bankSelect.value = bankName;
}

function setQuickDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    document.getElementById('transaction_date').value = d.toISOString().split('T')[0];
}

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!currentUserId) {
        showToast("You must be logged in to add transactions.", "error");
        return;
    }

    const amountVal = parseFloat(document.getElementById('amount').value);
    if (isNaN(amountVal) || amountVal <= 0) {
        showToast("Please enter a valid amount.", "error");
        return;
    }

    const data = {
        type: document.getElementById('transaction_type').value,
        amount: amountVal,
        date: document.getElementById('transaction_date').value,
        description: document.getElementById('description').value.trim() || 'General',
        bank: document.getElementById('bank_name').value || 'CASH',
        details: document.getElementById('account_number').value.trim(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUserId
    };

    if (isDemoMode) {
        if (editMode && currentEditId) {
            const idx = allTransactions.findIndex(x => x.id === currentEditId);
            if (idx !== -1) {
                allTransactions[idx] = { id: currentEditId, ...data };
                saveDemoTransactions();
                showToast('Transaction updated successfully!', 'success');
                resetForm();
                renderAll();
            }
        } else {
            const newId = 'demo-' + Date.now();
            allTransactions.unshift({ id: newId, ...data });
            saveDemoTransactions();
            showToast('Transaction added successfully!', 'success');
            resetForm();
            renderAll();
        }
        return;
    }

    if (editMode && currentEditId) {
        // Update
        db.collection(collectionName).doc(currentEditId).update(data)
            .then(() => {
                showToast('Transaction updated successfully!', 'success');
                resetForm();
            })
            .catch(err => {
                console.error("Error updating document: ", err);
                showToast('Error updating transaction.', 'error');
            });
    } else {
        // Add
        db.collection(collectionName).add(data)
            .then(() => {
                showToast('Transaction added successfully!', 'success');
                resetForm();
            })
            .catch(err => {
                console.error("Error adding document: ", err);
                showToast('Error adding transaction.', 'error');
            });
    }
});

function editTransaction(id) {
    const t = allTransactions.find(x => x.id === id);
    if (!t) return;

    setTransactionType(t.type);
    document.getElementById('amount').value = t.amount;
    document.getElementById('transaction_date').value = t.date;
    document.getElementById('description').value = t.description || '';
    document.getElementById('bank_name').value = t.bank || '';
    document.getElementById('account_number').value = t.details || '';

    editMode = true;
    currentEditId = id;

    formTitle.textContent = "Update Transaction";
    submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Update Transaction</span>
    `;
    cancelBtn.style.display = "inline-flex";

    openTab('add-transaction');
    document.getElementById('amount').focus();
}

function deleteTransaction(id) {
    if (confirm("Are you sure you want to delete this transaction?")) {
        if (isDemoMode) {
            allTransactions = allTransactions.filter(x => x.id !== id);
            saveDemoTransactions();
            showToast('Transaction deleted.', 'info');
            renderAll();
            return;
        }

        db.collection(collectionName).doc(id).delete()
            .then(() => {
                showToast('Transaction deleted.', 'info');
            })
            .catch(err => {
                console.error("Error removing document: ", err);
                showToast('Error deleting transaction.', 'error');
            });
    }
}

function resetForm() {
    transactionForm.reset();
    document.getElementById('transaction_date').value = new Date().toISOString().split('T')[0];
    editMode = false;
    currentEditId = null;
    formTitle.textContent = "Add New Transaction";
    setTransactionType('expense');
    cancelBtn.style.display = "none";
}


// ---------------------------------------------------------
// REPORT GENERATION
// ---------------------------------------------------------

function generateReport(e) {
    e.preventDefault();

    const bank = reportBankSelect.value;
    const startDate = document.getElementById('report_start_date').value;
    const endDate = document.getElementById('report_end_date').value;

    if (!bank) {
        showToast("Please select an account for the report.", "error");
        return;
    }

    let filtered = allTransactions.filter(t => t.bank === bank);

    if (startDate) {
        filtered = filtered.filter(t => t.date >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(t => t.date <= endDate);
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = `
        <div class="report-header">
            <div class="report-title">SDQ Report</div>
            <div class="report-criteria">
                Account: <strong>${escapeHtml(bank)}</strong> ${startDate || endDate ? ` | Date: ${startDate || 'Start'} to ${endDate || 'End'}` : ''}
                <br><span style="font-size: 0.8rem; color: #64748b;">Generated: ${new Date().toLocaleDateString()}</span>
            </div>
        </div>
    `;

    if (filtered.length === 0) {
        html += '<p style="text-align: center; padding: 20px;">No transactions found for the selected criteria.</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Details</th>
                        <th class="text-right">Income</th>
                        <th class="text-right">Expense</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totalIncome = 0;
        let totalExpense = 0;

        filtered.forEach(t => {
            const amount = parseFloat(t.amount) || 0;
            let incomeDisp = "-", expenseDisp = "-";

            if (t.type === 'income') {
                incomeDisp = `₹ ${formatCurrency(amount)}`;
                totalIncome += amount;
            } else {
                expenseDisp = `₹ ${formatCurrency(amount)}`;
                totalExpense += amount;
            }

            html += `
                <tr>
                    <td>${t.date}</td>
                    <td>${capitalize(t.type)}</td>
                    <td>${escapeHtml(t.description || '')}</td>
                    <td>${escapeHtml(t.details || '')}</td>
                    <td class="text-right" style="color: var(--income);">${incomeDisp}</td>
                    <td class="text-right" style="color: var(--expense);">${expenseDisp}</td>
                </tr>
            `;
        });

        const net = totalIncome - totalExpense;

        html += `
                </tbody>
                <tfoot>
                    <tr class="summary-row">
                        <td colspan="4"><strong>Totals</strong></td>
                        <td class="text-right" style="color: var(--income);">₹ ${formatCurrency(totalIncome)}</td>
                        <td class="text-right" style="color: var(--expense);">₹ ${formatCurrency(totalExpense)}</td>
                    </tr>
                    <tr class="summary-row" style="background: #f1f5f9;">
                        <td colspan="4"><strong>Net Account Balance</strong></td>
                        <td colspan="2" class="text-right" style="font-size: 1.05rem; color: ${net >= 0 ? 'var(--income)' : 'var(--expense)'};">
                            ₹ ${formatCurrency(net)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    reportResult.innerHTML = html;
    // Dismiss any active toast immediately so it never appears on report
    const activeToast = document.querySelector('.toast');
    if (activeToast) activeToast.remove();
}



// ---------------------------------------------------------
// UTILITIES & HELPERS
// ---------------------------------------------------------

// Default to today's date
document.getElementById('transaction_date').value = new Date().toISOString().split('T')[0];

function formatCurrency(num) {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const year = parts[0];
            const monthIdx = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            return `${day} ${months[monthIdx] || parts[1]} ${year}`;
        }
    } catch (e) {}
    return dateStr;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
