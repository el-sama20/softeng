/**
 * EFETEBE AQUA & AGRICULTURAL CORPORATION - Payroll System
 * Handles state, navigation, and calculations.
 */

const currencyFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
});

const STORAGE_KEYS = {
    employees: 'payflow_employees',
    payrollPeriods: 'payflow_payroll_periods',
    settings: 'payflow_settings',
    isLoggedIn: 'payflow_is_logged_in',
    currentAdminId: 'payflow_current_admin_id',
    admins: 'payflow_admins',
    auditLogs: 'payflow_audit_logs'
};

const SETTINGS_FIELD_CONFIG = {
    'weekly-payroll': {
        inputId: 'settings-weekly-payroll',
        editBtnId: 'settings-edit-weekly-payroll',
        updateBtnId: 'settings-update-weekly-payroll',
        stateKey: 'weeklyPayrollAmount',
        normalize: (value) => Math.max(0, parseFloat(value) || 0),
        label: 'Work day amount'
    },
    'profile-name': {
        inputId: 'settings-profile-name',
        editBtnId: 'settings-edit-profile-name',
        updateBtnId: 'settings-update-profile-name',
        stateKey: 'profileName',
        normalize: (value) => value.toString().trim() || 'Admin User',
        adminKey: 'name',
        label: 'Profile name'
    },
    'profile-role': {
        inputId: 'settings-profile-role',
        editBtnId: 'settings-edit-profile-role',
        updateBtnId: 'settings-update-profile-role',
        stateKey: 'profileRole',
        normalize: (value) => value.toString().trim() || 'Administrator',
        adminKey: 'role',
        label: 'Profile role'
    }
};

// --- State Management ---
const state = {
    employees: [],
    payrollPeriods: [],
    admins: [],
    auditLogs: [],
    currentView: 'dashboard',
    selectedEmployeeId: null,
    currentWeekStart: null,
    currentAdminId: null,
    activeModalId: null,
    lastFocusedElement: null,
    isLoggedIn: true,
    authView: 'login',
    authNotice: {
        message: '',
        type: 'info'
    },
    settings: {
        weeklyPayrollAmount: 0,
        profileName: 'Admin User',
        profileRole: 'Administrator',
        lastUpdatedAt: null
    },
    FIXED_DAILY_RATE: 450,
    WORK_TYPES: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    toastTimer: null
};

const getConfiguredWorkAmount = (employee = null) => {
    const configuredAmount = Number(state.settings.weeklyPayrollAmount) || 0;
    if (configuredAmount > 0) return configuredAmount;
    if (employee && Number(employee.dailyRate) > 0) return Number(employee.dailyRate);
    return state.FIXED_DAILY_RATE;
};

const getEffectiveLogAmount = (employee, log) => {
    if (!log) return 0;
    if (log.amount !== undefined && log.amount !== null && log.amount !== '') {
        const storedAmount = Number(log.amount);
        return Number.isFinite(storedAmount) ? Math.max(0, storedAmount) : 0;
    }
    return getConfiguredWorkAmount(employee);
};

// --- Utilities ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

const PAYROLL_PERIOD_DAYS = 6;

const getPayrollWeekStart = (d) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
};

const formatDate = (d) => {
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const formatDisplayDate = (dateStr) => shortDateFormatter.format(parseDateInputValue(dateStr) || new Date(dateStr));
const formatWeekdayDate = (d) => weekdayFormatter.format(d);
const formatDateTime = (dateStr) => dateStr ? dateTimeFormatter.format(new Date(dateStr)) : 'Not yet saved';

const saveState = () => {
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(state.employees));
    localStorage.setItem(STORAGE_KEYS.payrollPeriods, JSON.stringify(state.payrollPeriods));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    app.render();
};

const saveSessionState = () => {
    localStorage.setItem(STORAGE_KEYS.isLoggedIn, state.isLoggedIn ? '1' : '0');
    if (state.currentAdminId) {
        localStorage.setItem(STORAGE_KEYS.currentAdminId, state.currentAdminId);
    } else {
        localStorage.removeItem(STORAGE_KEYS.currentAdminId);
    }
};

const saveAdminState = () => {
    localStorage.setItem(STORAGE_KEYS.admins, JSON.stringify(state.admins));
};

const saveAuditState = () => {
    localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(state.auditLogs));
};

const formatCurrency = (amount) => currencyFormatter.format(Number(amount) || 0);

const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const createEmptyState = (message, colspan = 4) =>
    `<tr><td colspan="${colspan}" class="empty-state">${message}</td></tr>`;

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[char]));

const getWorkTypesFromDescription = (description) => {
    const match = String(description || '').match(/^Work:\s*(.*)$/);
    if (!match || !match[1]) return [];
    return match[1].split(',').map(item => item.trim()).filter(Boolean);
};

const renderWorkTypeChips = (workTypes) => workTypes
    .map(type => `<span class="work-type-pill">${escapeHTML(type)}</span>`)
    .join('');

const getEmployeeRoleOptions = () => [...new Set(state.employees
    .map(emp => (emp.role || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

const isValidMobileNumber = (value) => /^09\d{9}$/.test(value);

const getEmployeeStatus = (employee) =>
    employee && employee.status === 'inactive' ? 'inactive' : 'active';

const isEmployeeActive = (employee) => getEmployeeStatus(employee) === 'active';

const normalizeEmployeeName = (value) =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const createBackupFileName = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `efetebe-payroll-backup-${stamp}.json`;
};

const createPayrollExportFileName = (extension) => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `efetebe-payroll-summary-${stamp}.${extension}`;
};

const escapeCSVValue = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseDateInputValue = (dateStr) => {
    const parts = String(dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

const getWeekRange = (referenceDate = new Date()) => {
    const start = getPayrollWeekStart(referenceDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + PAYROLL_PERIOD_DAYS - 1);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const formatWeekRangeLabel = (start, end) =>
    `${formatWeekdayDate(start)} - ${formatWeekdayDate(end)}`;

const getPayrollPeriodId = (start, end, type = 'weekly') =>
    `${type}:${formatDate(start)}:${formatDate(end)}`;

const isDateWithinRange = (dateStr, start, end) => {
    const date = parseDateInputValue(dateStr);
    if (!date) return false;
    return date >= start && date <= end;
};

const isRestDay = (dateStr) => {
    const date = parseDateInputValue(dateStr);
    return date ? date.getDay() === 6 : false;
};

const isSalaryDay = (date = new Date()) => new Date(date).getDay() === 5;
const isValidReimbursementDate = (dateStr) => Boolean(dateStr && isSalaryDay(dateStr));

const isFuturePayrollPeriod = (referenceDate) => {
    const selectedStart = getPayrollWeekStart(referenceDate);
    const currentStart = getPayrollWeekStart(new Date());
    selectedStart.setHours(0, 0, 0, 0);
    currentStart.setHours(0, 0, 0, 0);
    return selectedStart > currentStart;
};

const isPastPayrollPeriod = (referenceDate) => {
    const selectedStart = getPayrollWeekStart(referenceDate);
    const currentStart = getPayrollWeekStart(new Date());
    selectedStart.setHours(0, 0, 0, 0);
    currentStart.setHours(0, 0, 0, 0);
    return selectedStart < currentStart;
};

const isCurrentPayrollLog = (log) => {
    const logDate = parseDateInputValue(log && log.date);
    if (!logDate) return false;

    const { start, end } = getWeekRange();
    return logDate >= start && logDate <= end;
};

const getCurrentWeekLogsTotal = () => {
    const { start, end } = getWeekRange();

    return state.employees.reduce((sum, emp) => {
        const empWeekTotal = emp.workLogs.reduce((empSum, log) => {
            const logDate = parseDateInputValue(log.date);
            if (!logDate) return empSum;
            return logDate >= start && logDate <= end ? empSum + getEffectiveLogAmount(emp, log) : empSum;
        }, 0);
        return sum + empWeekTotal;
    }, 0);
};

const getCurrentMonthLogsTotal = (referenceDate = new Date()) => {
    const month = referenceDate.getMonth();
    const year = referenceDate.getFullYear();

    return state.employees.reduce((sum, emp) => {
        const empMonthTotal = emp.workLogs.reduce((empSum, log) => {
            const logDate = parseDateInputValue(log.date);
            if (!logDate) return empSum;

            const sameMonth = logDate.getMonth() === month && logDate.getFullYear() === year;
            return sameMonth ? empSum + getEffectiveLogAmount(emp, log) : empSum;
        }, 0);
        return sum + empMonthTotal;
    }, 0);
};

const getPageSubtitle = (viewId) => {
    const totalEmployees = state.employees.length;
    const totalLogs = state.employees.reduce((sum, emp) => sum + emp.workLogs.length, 0);

    if (viewId === 'dashboard') return 'Overview of payroll activity and workforce data.';
    if (viewId === 'employees') return `${totalEmployees} employee${totalEmployees === 1 ? '' : 's'} in the system.`;
    if (viewId === 'payroll') return 'Summary of total earnings by employee.';
    if (viewId === 'weekly') return 'Manage Sunday-Friday attendance. Friday is salary day and Saturday is rest day.';
    if (viewId === 'settings') return 'Update the work day amount used for payroll calculations.';
    if (viewId === 'details') return `${totalLogs} total work log${totalLogs === 1 ? '' : 's'} recorded.`;
    return '';
};

const app = {
    init: async () => {
        state.currentWeekStart = getPayrollWeekStart(new Date());
        await app.loadInitialData();
        app.bindModalEvents();
        app.render();
    },

    loadInitialData: async () => {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.employees) || '[]');
        const localPayrollPeriods = JSON.parse(localStorage.getItem(STORAGE_KEYS.payrollPeriods) || '[]');
        const localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
        const localAdmins = JSON.parse(localStorage.getItem(STORAGE_KEYS.admins) || '[]');
        const localAuditLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLogs) || '[]');
        const storedLoginState = localStorage.getItem(STORAGE_KEYS.isLoggedIn);
        const storedCurrentAdminId = localStorage.getItem(STORAGE_KEYS.currentAdminId);
        let cleanedInvalidReimbursements = false;

        state.employees = Array.isArray(local)
            ? local.map(item => {
                const name = (item.name || '').toString().trim();
                const nameParts = name.split(/\s+/).filter(Boolean);
                const firstName = (item.firstName || nameParts[0] || 'Employee').toString().trim();
                const lastName = (item.lastName || nameParts.slice(1).join(' ')).toString().trim();

                return {
                    ...item,
                    firstName,
                    lastName,
                    name: name || `${firstName} ${lastName}`.trim(),
                    role: (item.role || 'Worker').toString().trim(),
                    contact: (item.contact || '').toString().trim(),
                    address: (item.address || '').toString().trim(),
                    status: item.status === 'inactive' ? 'inactive' : 'active',
                    inactiveAt: item.status === 'inactive' ? item.inactiveAt || null : null,
                    workLogs: Array.isArray(item.workLogs)
                        ? item.workLogs.map(log => {
                            const hasValidReimbursement = Boolean(log.reimbursed && isValidReimbursementDate(log.reimbursedAt));
                            if (log.reimbursed && !hasValidReimbursement) cleanedInvalidReimbursements = true;

                            return {
                                ...log,
                                reimbursed: hasValidReimbursement,
                                reimbursedAt: hasValidReimbursement ? log.reimbursedAt : null,
                                reimbursedBy: hasValidReimbursement ? log.reimbursedBy || '' : '',
                                reimbursementPeriodId: hasValidReimbursement ? log.reimbursementPeriodId || null : null
                            };
                        })
                        : []
                };
            })
            : [];
        state.payrollPeriods = Array.isArray(localPayrollPeriods)
            ? localPayrollPeriods
                .filter(item => item && typeof item === 'object' && item.id && item.startDate && item.endDate)
                .map(item => {
                    const hasValidReimbursement = item.status === 'reimbursed' && isValidReimbursementDate(item.reimbursedAt);
                    if (item.status === 'reimbursed' && !hasValidReimbursement) cleanedInvalidReimbursements = true;

                    return {
                        id: item.id,
                        type: item.type || 'weekly',
                        startDate: item.startDate,
                        endDate: item.endDate,
                        salaryDate: item.salaryDate || item.endDate,
                        totalAmount: Number(item.totalAmount) || 0,
                        logCount: Number(item.logCount) || 0,
                        status: hasValidReimbursement ? 'reimbursed' : 'pending',
                        reimbursedAt: hasValidReimbursement ? item.reimbursedAt : null,
                        reimbursedBy: hasValidReimbursement ? item.reimbursedBy || '' : ''
                    };
                })
            : [];
        if (cleanedInvalidReimbursements) {
            localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(state.employees));
            localStorage.setItem(STORAGE_KEYS.payrollPeriods, JSON.stringify(state.payrollPeriods));
        }
        if (localSettings && typeof localSettings === 'object') {
            state.settings = { ...state.settings, ...localSettings };
        }
        state.admins = Array.isArray(localAdmins)
            ? localAdmins
                .filter(item => item && typeof item === 'object' && item.id && item.username)
                .map(item => ({
                    id: item.id,
                    name: (item.name || 'Admin User').toString().trim() || 'Admin User',
                    role: (item.role || 'Administrator').toString().trim() || 'Administrator',
                    username: item.username.toString().trim(),
                    password: (item.password || '').toString(),
                    createdAt: item.createdAt || new Date().toISOString()
                }))
            : [];
        state.auditLogs = Array.isArray(localAuditLogs)
            ? localAuditLogs
                .filter(item => item && typeof item === 'object' && item.action && item.createdAt)
                .map(item => ({
                    id: item.id || generateId(),
                    action: item.action.toString(),
                    details: (item.details || '').toString(),
                    actor: (item.actor || 'System').toString(),
                    createdAt: item.createdAt
                }))
                .slice(0, 250)
            : [];

        state.settings.weeklyPayrollAmount = Math.max(0, Number(state.settings.weeklyPayrollAmount) || 0);
        state.settings.profileName = (state.settings.profileName || 'Admin User').toString().trim() || 'Admin User';
        state.settings.profileRole = (state.settings.profileRole || 'Administrator').toString().trim() || 'Administrator';
        const updatedAt = state.settings.lastUpdatedAt ? new Date(state.settings.lastUpdatedAt) : null;
        state.settings.lastUpdatedAt = updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString() : null;

        const hasAdmins = state.admins.length > 0;
        const activeAdmin = state.admins.find(admin => admin.id === storedCurrentAdminId) || null;
        const shouldRestoreSession = storedLoginState === '1' && Boolean(activeAdmin);

        if (shouldRestoreSession && activeAdmin) {
            state.isLoggedIn = true;
            state.currentAdminId = activeAdmin.id;
            state.authView = 'login';
            state.authNotice.message = '';
            state.authNotice.type = 'info';
            app.syncActiveAdminProfile();
        } else {
            state.isLoggedIn = false;
            state.currentAdminId = null;
            state.authView = 'login';
            state.authNotice.message = '';
            state.authNotice.type = 'info';
        }

        saveSessionState();
    },

    getCurrentAdmin: () => {
        if (!state.currentAdminId) return null;
        return state.admins.find(admin => admin.id === state.currentAdminId) || null;
    },

    logAudit: (action, details = '') => {
        const activeAdmin = app.getCurrentAdmin();
        state.auditLogs.unshift({
            id: generateId(),
            action,
            details,
            actor: activeAdmin ? activeAdmin.name : state.settings.profileName || 'System',
            createdAt: new Date().toISOString()
        });
        state.auditLogs = state.auditLogs.slice(0, 250);
        saveAuditState();
        if (state.currentView === 'settings') app.renderAuditTrail();
    },

    syncActiveAdminProfile: () => {
        const activeAdmin = app.getCurrentAdmin();
        if (!activeAdmin) return;
        state.settings.profileName = (activeAdmin.name || 'Admin User').toString().trim() || 'Admin User';
        state.settings.profileRole = (activeAdmin.role || 'Administrator').toString().trim() || 'Administrator';
    },

    setAuthNotice: (message, type = 'info') => {
        state.authNotice.message = message || '';
        state.authNotice.type = type;

        const noticeEl = document.getElementById('auth-notice');
        if (!noticeEl) return;

        noticeEl.innerText = state.authNotice.message;
        noticeEl.classList.toggle('show', Boolean(state.authNotice.message));
        noticeEl.classList.toggle('error', type === 'error');
        noticeEl.classList.toggle('info', type !== 'error');
    },

    showAuthView: (viewId) => {
        const fallbackView = 'login';
        const nextView = viewId === 'register' || viewId === 'login' ? viewId : fallbackView;
        state.authView = nextView;
        if (state.authView === 'register') {
            app.setAuthNotice('', 'info');
        } else {
            app.setAuthNotice('', 'info');
        }
        app.renderAuth();
    },

    renderAuth: () => {
        const authGateEl = document.getElementById('auth-gate');
        const loginCardEl = document.getElementById('auth-login-card');
        const registerCardEl = document.getElementById('auth-register-card');
        const activeAuthView = state.authView === 'register' ? 'register' : 'login';
        state.authView = activeAuthView;

        document.body.classList.toggle('auth-mode', !state.isLoggedIn);

        if (authGateEl) authGateEl.classList.toggle('active', !state.isLoggedIn);
        if (loginCardEl) loginCardEl.classList.toggle('active', activeAuthView === 'login');
        if (registerCardEl) registerCardEl.classList.toggle('active', activeAuthView === 'register');
        app.setAuthNotice(state.authNotice.message, state.authNotice.type);
    },

    bindModalEvents: () => {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('mousedown', (event) => {
                if (event.target === modal) app.closeModal(modal.id);
            });
        });

        document.addEventListener('keydown', (event) => {
            const activeModal = state.activeModalId ? document.getElementById(state.activeModalId) : null;
            if (!activeModal || !activeModal.classList.contains('active')) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                app.closeModal(activeModal.id);
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = Array.from(activeModal.querySelectorAll(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(el => el.offsetParent !== null);

            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    },

    togglePasswordVisibility: (inputId, button) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        if (button) {
            button.setAttribute('aria-pressed', String(!isVisible));
            button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
            button.innerHTML = `<i class="fa-solid ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
        }
        input.focus();
    },

    handleLogin: (e) => {
        e.preventDefault();
        const form = e.target;
        const username = form.username.value.trim();
        const password = form.password.value;
        app.setAuthNotice('', 'info');

        if (state.admins.length === 0) {
            app.setAuthNotice('No admin account found. Please register first.', 'error');
            app.toast('No registered admin account yet.');
            return;
        }

        const matchedAdmin = state.admins.find(admin =>
            admin.username.toLowerCase() === username.toLowerCase()
        );

        if (!matchedAdmin || matchedAdmin.password !== password) {
            app.setAuthNotice('Invalid username or password. Please try again.', 'error');
            app.toast('Invalid username or password.');
            return;
        }

        state.currentAdminId = matchedAdmin.id;
        state.isLoggedIn = true;
        state.authView = 'login';
        app.setAuthNotice('', 'info');
        app.syncActiveAdminProfile();
        saveSessionState();
        form.reset();
        saveState();
        app.logAudit('Admin login', `${matchedAdmin.name} signed in.`);
        app.navigate('dashboard');
        app.toast(`Welcome back, ${matchedAdmin.name}!`);
    },

    handleRegister: (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.name.value.trim();
        const role = 'Administrator';
        const username = form.username.value.trim();
        const password = form.password.value;
        const confirmPassword = form['confirm-password'].value;
        app.setAuthNotice('', 'info');

        if (!name || !username || !password) {
            app.setAuthNotice('Complete all required fields.', 'error');
            app.toast('Complete all required fields.');
            return;
        }

        if (password.length < 6) {
            app.setAuthNotice('Password must be at least 6 characters.', 'error');
            app.toast('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            app.setAuthNotice('Passwords do not match.', 'error');
            app.toast('Passwords do not match.');
            return;
        }

        const usernameTaken = state.admins.some(admin =>
            admin.username.toLowerCase() === username.toLowerCase()
        );

        if (usernameTaken) {
            app.setAuthNotice('Username already exists. Choose another one.', 'error');
            app.toast('Username already exists.');
            return;
        }

        const newAdmin = {
            id: generateId(),
            name,
            role,
            username,
            password,
            createdAt: new Date().toISOString()
        };

        state.admins.push(newAdmin);
        saveAdminState();

        state.currentAdminId = newAdmin.id;
        state.isLoggedIn = true;
        state.authView = 'login';
        app.setAuthNotice('', 'info');
        state.settings.profileName = newAdmin.name;
        state.settings.profileRole = newAdmin.role;
        state.settings.lastUpdatedAt = new Date().toISOString();

        saveSessionState();
        form.reset();
        saveState();
        app.logAudit('Admin registered', `Created admin account for ${name}.`);
        app.navigate('dashboard');
        app.toast(`Welcome, ${newAdmin.name}! Your admin account is ready.`);
    },

    updatePageContext: (viewId) => {
        const subtitle = document.getElementById('page-subtitle');
        if (subtitle) subtitle.innerText = getPageSubtitle(viewId);
    },

    toast: (message) => {
        const toastEl = document.getElementById('app-toast');
        if (!toastEl) return;
        toastEl.innerText = message;
        toastEl.classList.add('show');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => {
            toastEl.classList.remove('show');
        }, 2200);
    },

    navigate: (viewId) => {
        if (!state.isLoggedIn) return;
        const targetView = viewId;
        state.currentView = targetView;

        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const viewEl = document.getElementById(`view-${targetView === 'details' ? 'details' : targetView}`);
        if (viewEl) viewEl.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (targetView !== 'details') {
            document.querySelectorAll(`button[onclick="app.navigate('${targetView}')"], button[onclick="app.navigateMobile('${targetView}')"]`)
                .forEach(btn => btn.classList.add('active'));
        }

        if (targetView === 'dashboard') {
            document.getElementById('page-title').innerText = 'Dashboard';
            app.renderDashboard();
        } else if (targetView === 'employees') {
            document.getElementById('page-title').innerText = 'Employees';
            app.renderEmployeeList();
        } else if (targetView === 'payroll') {
            document.getElementById('page-title').innerText = 'Payroll Summary';
            app.renderPayroll();
        } else if (targetView === 'weekly') {
            document.getElementById('page-title').innerText = 'Work Week DTR';
            app.renderWeeklyWork();
        } else if (targetView === 'settings') {
            document.getElementById('page-title').innerText = 'Settings';
            app.renderSettings();
        } else if (targetView === 'details') {
            document.getElementById('page-title').innerText = 'Employee Details';
            app.renderEmployeeDetails(state.selectedEmployeeId);
        }

        app.updatePageContext(targetView);
    },

    navigateMobile: (viewId) => {
        app.navigate(viewId);
        const offcanvasEl = document.getElementById('mobileNav');
        if (offcanvasEl && window.bootstrap && bootstrap.Offcanvas) {
            bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).hide();
        }
    },

    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        state.lastFocusedElement = document.activeElement;
        state.activeModalId = modalId;
        modal.classList.add('active');
        document.body.classList.add('modal-open');

        const focusTarget = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        if (focusTarget) focusTarget.focus();
    },

    openProfileSettingsModal: () => {
        app.renderProfileSettings();
        app.openModal('profile-settings-modal');
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove('active');
        if (state.activeModalId === modalId) state.activeModalId = null;
        if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');

        if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
            state.lastFocusedElement.focus();
        }
    },

    // --- Actions ---
    setSettingsFieldMode: (fieldName, isEditing) => {
        const config = SETTINGS_FIELD_CONFIG[fieldName];
        if (!config) return;

        const input = document.getElementById(config.inputId);
        const editBtn = document.getElementById(config.editBtnId);
        const updateBtn = document.getElementById(config.updateBtnId);

        if (input) input.disabled = !isEditing;
        if (editBtn) editBtn.disabled = isEditing;
        if (updateBtn) updateBtn.disabled = !isEditing;

        if (isEditing && input) {
            input.focus();
            if (typeof input.select === 'function') input.select();
        }
    },

    enableSettingsField: (fieldName) => {
        app.setSettingsFieldMode(fieldName, true);
    },

    getReimbursedPeriodForDate: (dateStr) => {
        const date = parseDateInputValue(dateStr);
        if (!date) return null;

        return state.payrollPeriods.find(period => {
            if (period.status !== 'reimbursed') return false;
            if (!isValidReimbursementDate(period.reimbursedAt)) return false;
            const start = parseDateInputValue(period.startDate);
            const end = parseDateInputValue(period.endDate);
            if (!start || !end) return false;
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
        }) || null;
    },

    isPayrollDateLocked: (dateStr) => {
        const date = parseDateInputValue(dateStr);
        if (!date) return false;
        return Boolean(app.getReimbursedPeriodForDate(dateStr) || isPastPayrollPeriod(date));
    },

    isLogLocked: (log) => Boolean(log && (
        (log.reimbursed && isValidReimbursementDate(log.reimbursedAt)) ||
        app.isPayrollDateLocked(log.date)
    )),

    getPayrollPeriodSummary: (referenceDate = new Date()) => {
        const { start, end } = getWeekRange(referenceDate);
        const id = getPayrollPeriodId(start, end);
        const startDate = formatDate(start);
        const endDate = formatDate(end);
        const savedPeriod = state.payrollPeriods.find(period => period.id === id) || null;
        const logs = [];

        state.employees.forEach(employee => {
            employee.workLogs.forEach(log => {
                if (!isDateWithinRange(log.date, start, end)) return;
                logs.push({ employee, log, amount: getEffectiveLogAmount(employee, log) });
            });
        });

        const totalAmount = logs.reduce((sum, item) => sum + item.amount, 0);
        const allLogsLocked = logs.length > 0 && logs.every(({ log }) => app.isLogLocked(log));
        const inferredLockedLog = logs.find(({ log }) => app.isLogLocked(log));
        const inferredLockedPeriod = inferredLockedLog ? app.getReimbursedPeriodForDate(inferredLockedLog.log.date) : null;
        const status = savedPeriod && savedPeriod.status === 'reimbursed'
            ? 'reimbursed'
            : (allLogsLocked ? 'reimbursed' : 'pending');

        return {
            id,
            start,
            end,
            startDate,
            endDate,
            label: formatWeekRangeLabel(start, end),
            salaryDate: endDate,
            status,
            reimbursedAt: savedPeriod ? savedPeriod.reimbursedAt : (inferredLockedLog ? inferredLockedLog.log.reimbursedAt || inferredLockedPeriod?.reimbursedAt || null : null),
            reimbursedBy: savedPeriod ? savedPeriod.reimbursedBy : (inferredLockedLog ? inferredLockedLog.log.reimbursedBy || inferredLockedPeriod?.reimbursedBy || '' : ''),
            totalAmount,
            logCount: logs.length,
            logs
        };
    },

    getCurrentPayrollPeriodSummary: () => app.getPayrollPeriodSummary(new Date()),

    applyWorkDayAmountToCurrentPayroll: () => {
        let updatedCount = 0;

        state.employees.forEach(employee => {
            employee.workLogs.forEach(log => {
                if (!log.description || app.isLogLocked(log) || !isCurrentPayrollLog(log)) return;
                log.amount = getConfiguredWorkAmount(employee);
                updatedCount += 1;
            });
        });

        return updatedCount;
    },

    markCurrentPayrollReimbursed: () => {
        const summary = app.getCurrentPayrollPeriodSummary();
        if (!isSalaryDay()) {
            app.toast(`Payroll can only be marked reimbursed on Friday salary day (${formatDisplayDate(summary.salaryDate)}).`);
            return;
        }

        if (summary.status === 'reimbursed') {
            app.toast('This payroll period is already reimbursed.');
            return;
        }

        if (summary.logCount === 0) {
            app.toast('No work logs in the current payroll period.');
            return;
        }

        const confirmed = confirm(`Mark ${summary.label} payroll as reimbursed?\n\nTotal: ${formatCurrency(summary.totalAmount)}\nLogs: ${summary.logCount}\n\nThis will lock these work logs from future rate changes.`);
        if (!confirmed) return;

        const reimbursedAt = new Date().toISOString();
        const activeAdmin = app.getCurrentAdmin();
        const reimbursedBy = activeAdmin ? activeAdmin.name : state.settings.profileName;
        const period = {
            id: summary.id,
            type: 'weekly',
            startDate: summary.startDate,
            endDate: summary.endDate,
            salaryDate: summary.salaryDate,
            totalAmount: summary.totalAmount,
            logCount: summary.logCount,
            status: 'reimbursed',
            reimbursedAt,
            reimbursedBy
        };

        const existingIndex = state.payrollPeriods.findIndex(item => item.id === summary.id);
        if (existingIndex >= 0) {
            state.payrollPeriods[existingIndex] = period;
        } else {
            state.payrollPeriods.push(period);
        }

        summary.logs.forEach(({ log }) => {
            log.reimbursed = true;
            log.reimbursedAt = reimbursedAt;
            log.reimbursedBy = reimbursedBy;
            log.reimbursementPeriodId = summary.id;
        });

        saveState();
        app.logAudit('Payroll reimbursed', `${summary.label} reimbursed for ${formatCurrency(summary.totalAmount)} across ${summary.logCount} log${summary.logCount === 1 ? '' : 's'}.`);
        app.toast('Current payroll marked as reimbursed and locked.');
    },

    updateSettingsField: (fieldName) => {
        const config = SETTINGS_FIELD_CONFIG[fieldName];
        if (!config) return;

        const input = document.getElementById(config.inputId);
        if (!input) return;

        const nextValue = config.normalize(input.value);
        state.settings[config.stateKey] = nextValue;
        input.value = nextValue;
        const updatedCurrentPayrollCount = fieldName === 'weekly-payroll'
            ? app.applyWorkDayAmountToCurrentPayroll()
            : 0;

        if (config.adminKey && state.currentAdminId) {
            const activeAdmin = app.getCurrentAdmin();
            if (activeAdmin) {
                activeAdmin[config.adminKey] = nextValue;
                saveAdminState();
            }
        }

        state.settings.lastUpdatedAt = new Date().toISOString();
        saveState();
        app.logAudit('Settings updated', `${config.label} changed to ${fieldName === 'weekly-payroll' ? formatCurrency(nextValue) : nextValue}.`);
        if (fieldName === 'profile-name' || fieldName === 'profile-role') {
            app.renderProfileSettings();
        } else {
            app.setSettingsFieldMode(fieldName, false);
        }

        const message = fieldName === 'weekly-payroll'
            ? `${config.label} updated for unreimbursed current payroll${updatedCurrentPayrollCount ? ` (${updatedCurrentPayrollCount} log${updatedCurrentPayrollCount === 1 ? '' : 's'})` : ''}. Past records kept.`
            : `${config.label} updated.`;
        app.toast(message);
    },

    resetSettingsForm: () => {
        app.renderSettings();
        app.toast('Settings form reset.');
    },

    resetProfileSettingsForm: () => {
        app.renderProfileSettings();
        app.toast('Profile form reset.');
    },

    getBackupPayload: () => ({
        app: 'efetebe-payroll',
        version: 1,
        exportedAt: new Date().toISOString(),
        employees: state.employees,
        payrollPeriods: state.payrollPeriods,
        settings: state.settings,
        admins: state.admins,
        auditLogs: state.auditLogs
    }),

    exportBackup: () => {
        app.logAudit('Backup exported', `Exported ${state.employees.length} employee record${state.employees.length === 1 ? '' : 's'}.`);
        const payload = app.getBackupPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = createBackupFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        app.toast('Backup file exported.');
    },

    openImportBackupPicker: () => {
        const input = document.getElementById('backup-import-input');
        if (!input) return;
        input.value = '';
        input.click();
    },

    importBackup: async (event) => {
        const input = event.target;
        const file = input && input.files ? input.files[0] : null;
        if (!file) return;

        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            if (!payload || payload.app !== 'efetebe-payroll') {
                throw new Error('This is not an EFETEBE payroll backup file.');
            }

            if (!Array.isArray(payload.employees) || !Array.isArray(payload.payrollPeriods) || !Array.isArray(payload.admins)) {
                throw new Error('Backup file is missing required payroll data.');
            }

            const confirmed = confirm(`Import backup from ${payload.exportedAt ? formatDateTime(payload.exportedAt) : file.name}?\n\nThis replaces current employees, payroll history, settings, admin accounts, and audit logs.`);
            if (!confirmed) return;

            const previousAdmin = app.getCurrentAdmin();
            state.employees = payload.employees;
            state.payrollPeriods = payload.payrollPeriods;
            state.settings = { ...state.settings, ...(payload.settings || {}) };
            state.admins = payload.admins;
            state.auditLogs = Array.isArray(payload.auditLogs) ? payload.auditLogs.slice(0, 250) : [];

            const restoredAdmin = previousAdmin
                ? state.admins.find(admin => admin.username === previousAdmin.username)
                : null;
            const fallbackAdmin = state.admins[0] || null;
            state.currentAdminId = restoredAdmin ? restoredAdmin.id : (fallbackAdmin ? fallbackAdmin.id : null);
            state.isLoggedIn = Boolean(state.currentAdminId);

            saveAdminState();
            saveAuditState();
            saveSessionState();
            saveState();
            app.logAudit('Backup imported', `Imported backup file ${file.name}.`);
            app.toast('Backup imported successfully.');
            app.navigate(state.isLoggedIn ? 'settings' : 'dashboard');
        } catch (error) {
            app.toast(error.message || 'Backup import failed.');
        } finally {
            if (input) input.value = '';
        }
    },

    sanitizePhoneInput: (input) => {
        if (!input) return;
        input.value = input.value.replace(/\D/g, '').slice(0, 11);
        if (!input.value || isValidMobileNumber(input.value)) {
            input.setCustomValidity('');
        } else {
            input.setCustomValidity('Enter an 11-digit mobile number that starts with 09.');
        }
    },

    logout: () => {
        if (!state.isLoggedIn) return;
        if (!confirm('Log out of this payroll session?')) return;
        state.isLoggedIn = false;
        state.currentAdminId = null;
        state.authView = 'login';
        state.authNotice.type = 'info';
        saveSessionState();
        const offcanvasEl = document.getElementById('mobileNav');
        if (offcanvasEl && window.bootstrap && bootstrap.Offcanvas) {
            bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).hide();
        }
        app.logAudit('Admin logout', 'Signed out of the payroll session.');
        const loginForm = document.querySelector('#auth-login-card form');
        if (loginForm) loginForm.reset();
        app.renderAuth();
        app.toast('You have been successfully logged out.');
    },

    handleAddEmployee: (e) => {
        e.preventDefault();
        const form = e.target;
        const contactInput = form.contact;
        const firstName = form['first-name'].value.trim();
        const lastName = form['last-name'].value.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        app.sanitizePhoneInput(contactInput);

        if (!firstName || !lastName) {
            app.toast('Enter both first name and last name.');
            return;
        }

        if (!isValidMobileNumber(contactInput.value.trim())) {
            contactInput.reportValidity();
            app.toast('Contact number must be 11 digits and start with 09.');
            return;
        }

        const duplicateEmployee = state.employees.find(emp =>
            normalizeEmployeeName(emp.name) === normalizeEmployeeName(fullName)
        );

        if (duplicateEmployee) {
            const wasInactive = !isEmployeeActive(duplicateEmployee);
            if (wasInactive) {
                duplicateEmployee.status = 'active';
                duplicateEmployee.inactiveAt = null;
                duplicateEmployee.updatedAt = new Date().toISOString();
                saveState();
                app.logAudit('Employee reactivated', `${duplicateEmployee.name} was reactivated during duplicate add.`);
            }

            form.reset();
            app.closeModal('add-employee-modal');
            state.selectedEmployeeId = duplicateEmployee.id;
            app.navigate('details');
            app.toast(wasInactive
                ? `${duplicateEmployee.name} was already registered and has been reactivated.`
                : `${duplicateEmployee.name} is already registered.`);
            return;
        }

        const dailyRateInput = form['daily-rate'];
        const newEmployee = {
            id: generateId(),
            firstName,
            lastName,
            name: fullName,
            role: form.role.value.trim(),
            contact: contactInput.value.trim(),
            address: form.address.value.trim(),
            status: 'active',
            inactiveAt: null,
            dailyRate: dailyRateInput ? parseFloat(dailyRateInput.value) || 0 : getConfiguredWorkAmount(),
            joinedDate: new Date().toISOString(),
            workLogs: []
        };
        state.employees.push(newEmployee);
        saveState();
        app.logAudit('Employee added', `${newEmployee.name} was added as ${newEmployee.role}.`);
        form.reset();
        app.closeModal('add-employee-modal');
        app.toast('Employee added successfully.');
        app.navigate('employees');
    },

    viewEmployee: (id) => {
        state.selectedEmployeeId = id;
        app.navigate('details');
    },

    openEditEmployeeModal: (id) => {
        const employee = state.employees.find(emp => emp.id === id);
        const modal = document.getElementById('edit-employee-modal');
        if (!employee || !modal) return;

        const form = modal.querySelector('form');
        if (!form) return;

        form['edit-employee-id'].value = employee.id;
        form['first-name'].value = employee.firstName || '';
        form['last-name'].value = employee.lastName || '';
        form.role.value = employee.role || '';
        form.contact.value = employee.contact || '';
        form.address.value = employee.address || '';
        app.sanitizePhoneInput(form.contact);
        app.openModal('edit-employee-modal');
    },

    handleEditEmployee: (e) => {
        e.preventDefault();
        const form = e.target;
        const employee = state.employees.find(emp => emp.id === form['edit-employee-id'].value);
        if (!employee) {
            app.toast('Employee record was not found.');
            return;
        }

        const contactInput = form.contact;
        const firstName = form['first-name'].value.trim();
        const lastName = form['last-name'].value.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        app.sanitizePhoneInput(contactInput);

        if (!firstName || !lastName) {
            app.toast('Enter both first name and last name.');
            return;
        }

        if (!isValidMobileNumber(contactInput.value.trim())) {
            contactInput.reportValidity();
            app.toast('Contact number must be 11 digits and start with 09.');
            return;
        }

        employee.firstName = firstName;
        employee.lastName = lastName;
        employee.name = fullName;
        employee.role = form.role.value.trim();
        employee.contact = contactInput.value.trim();
        employee.address = form.address.value.trim();
        employee.updatedAt = new Date().toISOString();

        saveState();
        app.logAudit('Employee updated', `${employee.name} profile was updated.`);
        app.closeModal('edit-employee-modal');
        app.toast('Employee updated.');
        if (state.currentView === 'details') {
            app.renderEmployeeDetails(employee.id);
        } else {
            app.renderEmployeeList();
        }
    },

    toggleEmployeeStatus: (id) => {
        const employee = state.employees.find(emp => emp.id === id);
        if (!employee) return;

        const nextStatus = isEmployeeActive(employee) ? 'inactive' : 'active';
        const actionLabel = nextStatus === 'inactive' ? 'mark this employee inactive' : 'reactivate this employee';
        if (!confirm(`Are you sure you want to ${actionLabel}?`)) return;

        employee.status = nextStatus;
        employee.inactiveAt = nextStatus === 'inactive' ? new Date().toISOString() : null;
        employee.updatedAt = new Date().toISOString();
        saveState();
        app.logAudit(nextStatus === 'inactive' ? 'Employee marked inactive' : 'Employee reactivated', `${employee.name} is now ${nextStatus}.`);
        app.toast(nextStatus === 'inactive' ? 'Employee marked inactive.' : 'Employee reactivated.');

        if (state.currentView === 'details') {
            app.renderEmployeeDetails(employee.id);
        } else {
            app.renderEmployeeList();
        }
    },

    handleAddWorkLog: (e) => {
        e.preventDefault();
        const form = e.target;
        const empId = state.selectedEmployeeId;
        const employee = state.employees.find(emp => emp.id === empId);

        if (!employee) return;
        if (!isEmployeeActive(employee)) {
            app.toast('Inactive employees cannot receive new work logs. Reactivate the employee first.');
            return;
        }
        const dateStr = form.date.value;

        if (isRestDay(dateStr)) {
            app.toast('Saturday is the rest day and is not included in payroll.');
            return;
        }

        if (app.isPayrollDateLocked(dateStr)) {
            app.toast('This payroll period is reimbursed and locked.');
            return;
        }

        if (employee.workLogs.some(log => log.date === dateStr)) {
            app.toast('This employee already has a work log for that date. Edit it in Work Week DTR.');
            return;
        }

        const newLog = {
            id: generateId(),
            date: dateStr,
            description: form.description.value.trim(),
            amount: getConfiguredWorkAmount(employee)
        };
        employee.workLogs.push(newLog);
        employee.workLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

        saveState();
        app.logAudit('Work log added', `${employee.name} work log added for ${formatDisplayDate(dateStr)}.`);
        form.reset();
        app.closeModal('add-work-modal');
        app.toast('Work log saved.');
        app.renderEmployeeDetails(empId);
    },

    deleteEmployee: (id) => {
        const employee = state.employees.find(emp => emp.id === id);
        if (employee && employee.workLogs.length > 0) {
            app.toast('Employees with payroll history cannot be deleted.');
            return;
        }

        if (confirm('Are you sure you want to remove this employee? This action cannot be undone.')) {
            state.employees = state.employees.filter(emp => emp.id !== id);
            saveState();
            app.logAudit('Employee deleted', `${employee.name} was deleted before payroll history was added.`);
            app.toast('Employee deleted.');
            app.navigate('employees');
        }
    },

    deleteWorkLog: (empId, logId) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;
        const log = employee.workLogs.find(item => item.id === logId);
        if (app.isLogLocked(log)) {
            app.toast('Reimbursed work logs are locked.');
            return;
        }
        employee.workLogs = employee.workLogs.filter(log => log.id !== logId);
        saveState();
        app.logAudit('Work log deleted', `${employee.name} work log for ${formatDisplayDate(log.date)} was removed.`);
        app.toast('Work log removed.');
        app.renderEmployeeDetails(empId);
    },

    changeWeek: (offset) => {
        const d = new Date(state.currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        if (isFuturePayrollPeriod(d)) {
            app.toast('Next payroll week DTR opens when that week starts.');
            return;
        }
        if (isPastPayrollPeriod(d) || app.getPayrollPeriodSummary(d).status === 'reimbursed') {
            app.toast('That payroll week is already completed and reimbursed.');
            return;
        }
        state.currentWeekStart = d;
        app.renderWeeklyWork();
    },

    openDTRModal: (empId = '', dateStr = '') => {
        const modal = document.getElementById('add-dtr-modal');
        const empSelect = document.getElementById('dtr-employee');
        const dateInput = document.getElementById('dtr-date');
        if (!modal || !empSelect || !dateInput) return;

        const activeEmployees = state.employees.filter(isEmployeeActive);
        if (activeEmployees.length === 0) {
            app.toast('No active employees available for DTR.');
            return;
        }

        empSelect.innerHTML = activeEmployees
            .map(emp => `<option value="${escapeHTML(emp.id)}">${escapeHTML(emp.name)} (${escapeHTML(emp.role)})</option>`)
            .join('');

        const requestedEmployee = activeEmployees.find(emp => emp.id === empId);
        const defaultEmpId = requestedEmployee ? requestedEmployee.id : activeEmployees[0].id;
        const defaultDate = dateStr || formatDate(new Date());
        const roleOptions = getEmployeeRoleOptions();
        const natureGrid = document.getElementById('nature-grid');

        if (isRestDay(defaultDate)) {
            app.toast('Saturday is the rest day and is not included in payroll.');
            return;
        }

        if (app.isPayrollDateLocked(defaultDate)) {
            app.toast('This payroll period is reimbursed and locked.');
            return;
        }

        if (defaultEmpId) empSelect.value = defaultEmpId;
        dateInput.value = defaultDate;

        if (natureGrid) {
            natureGrid.innerHTML = roleOptions.length
                ? roleOptions.map(role => `
                    <label class="nature-option">
                        <input type="checkbox" name="nature" value="${escapeHTML(role)}">
                        <span>${escapeHTML(role)}</span>
                    </label>
                `).join('')
                : '<p class="nature-empty">Add employee roles first.</p>';
        }

        const employee = state.employees.find(emp => emp.id === defaultEmpId);
        const existingLog = employee ? employee.workLogs.find(log => log.date === defaultDate) : null;
        const selectedWorkTypes = getWorkTypesFromDescription(existingLog ? existingLog.description : '');
        document.querySelectorAll('#add-dtr-modal input[name="nature"]').forEach(rb => {
            rb.checked = selectedWorkTypes.includes(rb.value);
        });

        app.openModal('add-dtr-modal');
    },

    setDTRStatus: (empId, dateStr, checked) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;

        if (isRestDay(dateStr)) {
            app.toast('Saturday is the rest day and is not included in payroll.');
            return;
        }

        if (app.isPayrollDateLocked(dateStr)) {
            app.toast('This payroll period is reimbursed and locked.');
            return;
        }

        if (checked) {
            app.openDTRModal(empId, dateStr);
            return;
        }

        employee.workLogs = employee.workLogs.filter(log => log.date !== dateStr);
        saveState();
        app.toast('DTR record removed.');
        app.renderWeeklyWork();
    },

    handleAddDTRRecord: (e) => {
        e.preventDefault();
        const form = e.target;
        const empId = form['dtr-employee'].value;
        const dateStr = form['dtr-date'].value;
        const selectedNature = Array.from(form.querySelectorAll('input[name="nature"]:checked')).map(rb => rb.value);

        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;
        if (!isEmployeeActive(employee)) {
            app.toast('Inactive employees cannot receive new DTR records. Reactivate the employee first.');
            return;
        }
        if (isRestDay(dateStr)) {
            app.toast('Saturday is the rest day and is not included in payroll.');
            return;
        }
        if (app.isPayrollDateLocked(dateStr)) {
            app.toast('This payroll period is reimbursed and locked.');
            return;
        }

        let rate = 0;
        let desc = '';
        if (selectedNature.length > 0) {
            rate = getConfiguredWorkAmount(employee);
            desc = `Work: ${selectedNature.join(', ')}`;
        }

        const existingLog = employee.workLogs.find(log => log.date === dateStr);
        if (app.isLogLocked(existingLog)) {
            app.toast('Reimbursed work logs are locked.');
            return;
        }

        if (existingLog) {
            existingLog.description = desc;
            existingLog.amount = rate;
        } else {
            employee.workLogs.push({
                id: generateId(),
                date: dateStr,
                description: desc,
                amount: rate
            });
        }

        employee.workLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveState();
        app.logAudit('DTR saved', `${employee.name} DTR saved for ${formatDisplayDate(dateStr)}.`);
        app.closeModal('add-dtr-modal');
        app.toast('DTR record saved.');
        app.renderWeeklyWork();
    },

    toggleWorkType: (empId, dateStr, type) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;
        if (!isEmployeeActive(employee)) {
            app.toast('Inactive employees cannot receive new DTR records. Reactivate the employee first.');
            return;
        }
        if (isRestDay(dateStr)) {
            app.toast('Saturday is the rest day and is not included in payroll.');
            return;
        }
        if (app.isPayrollDateLocked(dateStr)) {
            app.toast('This payroll period is reimbursed and locked.');
            return;
        }

        let log = employee.workLogs.find(item => item.date === dateStr);
        if (app.isLogLocked(log)) {
            app.toast('Reimbursed work logs are locked.');
            return;
        }
        let workTypes = [];

        if (log) {
            workTypes = getWorkTypesFromDescription(log.description);
        }

        if (workTypes.includes(type)) {
            workTypes = workTypes.filter(item => item !== type);
        } else {
            workTypes.push(type);
            workTypes.sort();
        }

        if (workTypes.length === 0) {
            if (log) employee.workLogs = employee.workLogs.filter(item => item.id !== log.id);
        } else {
            const desc = `Work: ${workTypes.join(', ')}`;
            if (log) {
                log.description = desc;
                log.amount = getConfiguredWorkAmount(employee);
            } else {
                employee.workLogs.push({
                    id: generateId(),
                    date: dateStr,
                    description: desc,
                    amount: getConfiguredWorkAmount(employee)
                });
            }
        }

        saveState();
    },

    render: () => {
        app.renderProfile();
        app.renderAuth();
        if (state.isLoggedIn) {
            app.navigate(state.currentView);
        }

        window.onclick = (event) => {
            if (!event.target.closest('.dropdown-wrapper')) {
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
            }
        };
    },

    renderDashboard: () => {
        const totalEmployees = state.employees.filter(isEmployeeActive).length;
        const weeklyPayroll = getCurrentWeekLogsTotal();
        const monthlyPayroll = getCurrentMonthLogsTotal();
        const recentLogs = [];

        state.employees.forEach(emp => {
            emp.workLogs.forEach(log => {
                recentLogs.push({ empName: emp.name, ...log, amount: getEffectiveLogAmount(emp, log) });
            });
        });

        recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const top5 = recentLogs.slice(0, 5);
        const weeklyValueToDisplay = weeklyPayroll;

        document.getElementById('dash-total-employees').innerText = totalEmployees;
        document.getElementById('dash-weekly-payroll').innerText = formatCurrency(weeklyValueToDisplay);
        const weekLabel = document.getElementById('dash-week-label');
        if (weekLabel) {
            const { start, end } = getWeekRange();
            weekLabel.innerText = `${formatWeekRangeLabel(start, end)} · Friday salary day`;
        }
        document.getElementById('dash-monthly-payroll').innerText = formatCurrency(monthlyPayroll);
        const monthLabel = document.getElementById('dash-month-label');
        if (monthLabel) monthLabel.innerText = `${monthFormatter.format(new Date())} actual logs`;

        const tbody = document.getElementById('recent-logs-body');
        tbody.innerHTML = '';
        if (top5.length === 0) {
            tbody.innerHTML = createEmptyState('No work logs yet. Add your first DTR or work log to start tracking.', 4);
            return;
        }

        top5.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.empName}</td>
                <td>${formatDisplayDate(log.date)}</td>
                <td>${log.description}</td>
                <td style="color: var(--success); font-weight: 700;">${formatCurrency(log.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderProfile: () => {
        const nameEl = document.getElementById('profile-name');
        const roleEl = document.getElementById('profile-role');
        if (nameEl) nameEl.innerText = state.settings.profileName;
        if (roleEl) roleEl.innerText = state.settings.profileRole;
    },

    renderProfileSettings: () => {
        const profileNameInput = document.getElementById('settings-profile-name');
        const profileRoleInput = document.getElementById('settings-profile-role');

        if (profileNameInput) profileNameInput.value = state.settings.profileName;
        if (profileRoleInput) profileRoleInput.value = state.settings.profileRole;

        app.setSettingsFieldMode('profile-name', false);
        app.setSettingsFieldMode('profile-role', false);
    },

    renderSettings: () => {
        const weeklyPayrollInput = document.getElementById('settings-weekly-payroll');
        const currentWeekTotalEl = document.getElementById('settings-current-week-total');
        const totalEmployeesEl = document.getElementById('settings-total-employees');
        const totalLogsEl = document.getElementById('settings-total-logs');
        const lastUpdatedEl = document.getElementById('settings-last-updated');

        if (weeklyPayrollInput) weeklyPayrollInput.value = Number(state.settings.weeklyPayrollAmount || 0);
        if (currentWeekTotalEl) currentWeekTotalEl.innerText = formatCurrency(getCurrentWeekLogsTotal());
        if (totalEmployeesEl) totalEmployeesEl.innerText = String(state.employees.length);
        if (totalLogsEl) {
            const logCount = state.employees.reduce((sum, emp) => sum + emp.workLogs.length, 0);
            totalLogsEl.innerText = String(logCount);
        }
        if (lastUpdatedEl) lastUpdatedEl.innerText = formatDateTime(state.settings.lastUpdatedAt);

        app.setSettingsFieldMode('weekly-payroll', false);
        app.renderAuditTrail();
    },

    renderAuditTrail: () => {
        const tbody = document.getElementById('audit-log-body');
        const countEl = document.getElementById('audit-count');
        if (countEl) countEl.innerText = `${state.auditLogs.length} record${state.auditLogs.length === 1 ? '' : 's'}`;
        if (!tbody) return;

        tbody.innerHTML = '';
        const recentLogs = state.auditLogs.slice(0, 50);
        if (recentLogs.length === 0) {
            tbody.innerHTML = createEmptyState('No audit records yet. New activity will appear here.', 4);
            return;
        }

        recentLogs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHTML(formatDateTime(log.createdAt))}</td>
                <td><strong>${escapeHTML(log.action)}</strong></td>
                <td>${escapeHTML(log.details || 'No details')}</td>
                <td>${escapeHTML(log.actor || 'System')}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderEmployeeFilters: (selectedRole = '') => {
        const roleFilter = document.getElementById('employee-role-filter');
        if (!roleFilter) return;

        const roles = getEmployeeRoleOptions();

        roleFilter.innerHTML = `
            <option value="">All roles</option>
            ${roles.map(role => `<option value="${escapeHTML(role)}">${escapeHTML(role)}</option>`).join('')}
        `;
        roleFilter.value = roles.includes(selectedRole) ? selectedRole : '';
    },

    renderEmployeeList: () => {
        const tbody = document.getElementById('employee-list-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchInput = document.getElementById('employee-search');
        const roleFilter = document.getElementById('employee-role-filter');
        const statusFilter = document.getElementById('employee-status-filter');
        const sortSelect = document.getElementById('employee-sort');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let selectedRole = roleFilter ? roleFilter.value : '';
        const selectedStatus = statusFilter ? statusFilter.value : 'active';
        const sortMode = sortSelect ? sortSelect.value : 'name-asc';

        app.renderEmployeeFilters(selectedRole);
        selectedRole = roleFilter ? roleFilter.value : '';

        const getEmployeeTotal = (emp) =>
            emp.workLogs.reduce((sum, log) => sum + getEffectiveLogAmount(emp, log), 0);

        const filtered = state.employees
            .filter(emp => {
                const matchesSearch = emp.name.toLowerCase().includes(searchTerm) ||
                    emp.role.toLowerCase().includes(searchTerm);
                const matchesRole = !selectedRole || emp.role === selectedRole;
                const matchesStatus = !selectedStatus || getEmployeeStatus(emp) === selectedStatus;
                return matchesSearch && matchesRole && matchesStatus;
            })
            .sort((a, b) => {
                if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
                if (sortMode === 'role-asc') return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
                if (sortMode === 'earnings-desc') return getEmployeeTotal(b) - getEmployeeTotal(a);
                if (sortMode === 'newest') return new Date(b.joinedDate || 0) - new Date(a.joinedDate || 0);
                return a.name.localeCompare(b.name);
            });

        if (state.employees.length === 0) {
            tbody.innerHTML = createEmptyState('No employees yet. Click "Add Employee" to get started.', 7);
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = createEmptyState('No employees match your current search or filter.', 7);
            return;
        }

        filtered.forEach(emp => {
            const tr = document.createElement('tr');
            tr.className = 'employee-list-row';
            tr.onclick = (e) => {
                if (!e.target.closest('button')) app.viewEmployee(emp.id);
            };

            const total = getEmployeeTotal(emp);
            const hasPayrollHistory = emp.workLogs.length > 0;
            const employeeStatus = getEmployeeStatus(emp);
            const statusLabel = employeeStatus === 'inactive' ? 'Inactive' : 'Active';
            const statusActionLabel = employeeStatus === 'inactive' ? 'Reactivate' : 'Mark inactive';
            const statusActionIcon = employeeStatus === 'inactive' ? 'fa-user-check' : 'fa-user-slash';

            tr.innerHTML = `
                <td>
                    <div class="employee-list-name">
                        <div class="emp-avatar"><i class="fa-solid fa-user"></i></div>
                        <div>
                            <strong>${escapeHTML(emp.name)}</strong>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(emp.role)}</td>
                <td>${escapeHTML(emp.contact || 'N/A')}</td>
                <td>${escapeHTML(emp.address || 'N/A')}</td>
                <td><span class="status-chip employee-status-chip status-${employeeStatus}">${statusLabel}</span></td>
                <td class="employee-list-total">${formatCurrency(total)}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" class="btn btn-secondary" onclick="app.openEditEmployeeModal('${emp.id}')" title="Edit employee" aria-label="Edit ${escapeHTML(emp.name)}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="app.toggleEmployeeStatus('${emp.id}')" title="${statusActionLabel}" aria-label="${statusActionLabel} ${escapeHTML(emp.name)}">
                            <i class="fa-solid ${statusActionIcon}"></i>
                        </button>
                        <button type="button" class="btn ${hasPayrollHistory ? 'btn-locked' : 'btn-delete'}" onclick="app.deleteEmployee('${emp.id}')" ${hasPayrollHistory ? 'disabled' : ''} title="${hasPayrollHistory ? 'Locked because this employee has payroll history' : 'Delete employee'}" aria-label="${hasPayrollHistory ? 'Employee locked' : `Delete ${escapeHTML(emp.name)}`}">
                        <i class="fa-solid ${hasPayrollHistory ? 'fa-lock' : 'fa-trash'}"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    getPayrollSummary: () => {
        const rows = state.employees.map(emp => {
            const totalEarnings = emp.workLogs.reduce((sum, log) => sum + getEffectiveLogAmount(emp, log), 0);
            return {
                name: emp.name,
                role: emp.role,
                daysWorked: emp.workLogs.length,
                totalEarnings
            };
        });

        return {
            rows,
            grandTotal: rows.reduce((sum, row) => sum + row.totalEarnings, 0),
            totalDays: rows.reduce((sum, row) => sum + row.daysWorked, 0)
        };
    },

    getPayrollHistory: () => state.payrollPeriods
        .filter(period => period.status === 'reimbursed')
        .map(period => {
            const start = parseDateInputValue(period.startDate);
            const end = parseDateInputValue(period.endDate);
            return {
                ...period,
                label: start && end ? formatWeekRangeLabel(start, end) : `${period.startDate} - ${period.endDate}`,
                totalAmount: Number(period.totalAmount) || 0,
                logCount: Number(period.logCount) || 0
            };
        })
        .sort((a, b) => {
            const dateA = new Date(a.reimbursedAt || a.salaryDate || a.endDate || 0);
            const dateB = new Date(b.reimbursedAt || b.salaryDate || b.endDate || 0);
            return dateB - dateA;
        }),

    getMonthlyPayrollHistory: (weeklyHistory = app.getPayrollHistory()) => {
        const groups = new Map();

        weeklyHistory.forEach(period => {
            const basisDate = parseDateInputValue(period.salaryDate || period.endDate || period.startDate);
            if (!basisDate) return;

            const key = `${basisDate.getFullYear()}-${String(basisDate.getMonth() + 1).padStart(2, '0')}`;
            const periodStart = parseDateInputValue(period.startDate);
            const periodEnd = parseDateInputValue(period.endDate);
            const reimbursedAt = period.reimbursedAt ? new Date(period.reimbursedAt) : null;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    monthStart: new Date(basisDate.getFullYear(), basisDate.getMonth(), 1),
                    totalAmount: 0,
                    logCount: 0,
                    periodCount: 0,
                    earliestStart: periodStart,
                    latestEnd: periodEnd,
                    latestReimbursedAt: reimbursedAt,
                    admins: new Set()
                });
            }

            const group = groups.get(key);
            group.totalAmount += Number(period.totalAmount) || 0;
            group.logCount += Number(period.logCount) || 0;
            group.periodCount += 1;
            if (period.reimbursedBy) group.admins.add(period.reimbursedBy);
            if (periodStart && (!group.earliestStart || periodStart < group.earliestStart)) group.earliestStart = periodStart;
            if (periodEnd && (!group.latestEnd || periodEnd > group.latestEnd)) group.latestEnd = periodEnd;
            if (reimbursedAt && (!group.latestReimbursedAt || reimbursedAt > group.latestReimbursedAt)) group.latestReimbursedAt = reimbursedAt;
        });

        return Array.from(groups.values())
            .map(group => {
                const admins = Array.from(group.admins);
                const coveredRange = group.earliestStart && group.latestEnd
                    ? `${shortDateFormatter.format(group.earliestStart)} - ${shortDateFormatter.format(group.latestEnd)}`
                    : 'No covered dates';

                return {
                    type: 'monthly',
                    label: monthFormatter.format(group.monthStart),
                    coveredRange,
                    totalAmount: group.totalAmount,
                    logCount: group.logCount,
                    periodCount: group.periodCount,
                    reimbursedBy: admins.length <= 1 ? (admins[0] || 'Admin') : `${admins.length} admins`,
                    latestReimbursedAt: group.latestReimbursedAt ? group.latestReimbursedAt.toISOString() : null,
                    sortDate: group.monthStart
                };
            })
            .sort((a, b) => b.sortDate - a.sortDate);
    },

    exportPayrollCSV: () => {
        const { rows, grandTotal, totalDays } = app.getPayrollSummary();
        const periodSummary = app.getCurrentPayrollPeriodSummary();
        const generatedAt = dateTimeFormatter.format(new Date());
        const activeAdmin = app.getCurrentAdmin();
        const generatedBy = activeAdmin ? activeAdmin.name : state.settings.profileName;
        const periodStatus = periodSummary.status === 'reimbursed'
            ? `Reimbursed${periodSummary.reimbursedAt ? ` on ${formatDateTime(periodSummary.reimbursedAt)}` : ''}`
            : 'Pending reimbursement';

        const csvRows = [
            ['EFETEBE AQUA & AGRICULTURAL CORP.'],
            ['Payroll Summary'],
            ['Generated', generatedAt],
            ['Generated by', generatedBy],
            ['Current period', periodSummary.label],
            ['Salary day', formatDisplayDate(periodSummary.salaryDate)],
            ['Period status', periodStatus],
            [],
            ['Employee Name', 'Role', 'Days Worked', 'Total Earnings']
        ];

        if (rows.length) {
            rows.forEach(row => {
                csvRows.push([
                    row.name,
                    row.role,
                    row.daysWorked,
                    Number(row.totalEarnings || 0).toFixed(2)
                ]);
            });
        } else {
            csvRows.push(['No payroll records found.', '', '', '']);
        }

        csvRows.push([]);
        csvRows.push(['Grand Total', '', totalDays, Number(grandTotal || 0).toFixed(2)]);

        const csv = `\uFEFF${csvRows.map(row => row.map(escapeCSVValue).join(',')).join('\r\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = createPayrollExportFileName('csv');
        link.click();
        URL.revokeObjectURL(url);
        app.toast('Payroll CSV exported.');
    },

    exportPayrollPDF: () => {
        const { rows, grandTotal, totalDays } = app.getPayrollSummary();
        const periodSummary = app.getCurrentPayrollPeriodSummary();
        const generatedAt = dateTimeFormatter.format(new Date());
        const activeAdmin = app.getCurrentAdmin();
        const generatedBy = activeAdmin ? activeAdmin.name : state.settings.profileName;
        const periodStatus = periodSummary.status === 'reimbursed'
            ? `Reimbursed${periodSummary.reimbursedAt ? ` on ${formatDateTime(periodSummary.reimbursedAt)}` : ''}`
            : 'Pending reimbursement';

        const rowsMarkup = rows.length
            ? rows.map(row => `
                <tr>
                    <td>${escapeHTML(row.name)}</td>
                    <td>${escapeHTML(row.role)}</td>
                    <td>${row.daysWorked}</td>
                    <td>${escapeHTML(formatCurrency(row.totalEarnings))}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="empty">No payroll records found.</td></tr>';

        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            app.toast('Allow pop-ups to export the payroll PDF.');
            return;
        }

        reportWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Payroll Summary PDF</title>
                <style>
                    @page { margin: 18mm; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        color: #0f172a;
                        font-family: "Inter", "Segoe UI", sans-serif;
                        background: #fff;
                    }
                    .report {
                        width: 100%;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        gap: 24px;
                        border-bottom: 3px solid #0f766e;
                        padding-bottom: 16px;
                        margin-bottom: 22px;
                    }
                    .eyebrow {
                        color: #0f766e;
                        font-size: 12px;
                        font-weight: 800;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                    }
                    h1 {
                        margin: 6px 0 4px;
                        font-size: 30px;
                    }
                    .meta {
                        color: #475569;
                        font-size: 13px;
                        line-height: 1.7;
                        text-align: right;
                    }
                    .summary {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .summary-card {
                        border: 1px solid #dbe7e5;
                        border-radius: 14px;
                        padding: 14px;
                        background: #f8fbfa;
                    }
                    .summary-card span {
                        display: block;
                        color: #64748b;
                        font-size: 12px;
                        font-weight: 700;
                        margin-bottom: 6px;
                    }
                    .summary-card strong {
                        color: #0f766e;
                        font-size: 22px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #0f766e;
                        color: #fff;
                        text-align: left;
                        font-size: 12px;
                        letter-spacing: 0.04em;
                        text-transform: uppercase;
                    }
                    th, td {
                        border: 1px solid #dbe7e5;
                        padding: 10px 12px;
                    }
                    td {
                        font-size: 13px;
                    }
                    td:last-child,
                    th:last-child {
                        text-align: right;
                    }
                    tfoot td {
                        font-size: 15px;
                        font-weight: 800;
                        background: #ecfdf5;
                    }
                    .empty {
                        color: #64748b;
                        text-align: center !important;
                    }
                    .note {
                        margin-top: 18px;
                        color: #64748b;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <main class="report">
                    <section class="header">
                        <div>
                            <div class="eyebrow">EFETEBE AQUA & AGRICULTURAL CORP.</div>
                            <h1>Payroll Summary</h1>
                            <p>Employee totals and grand total payroll report.</p>
                        </div>
                        <div class="meta">
                            <div><strong>Generated:</strong> ${escapeHTML(generatedAt)}</div>
                            <div><strong>Generated by:</strong> ${escapeHTML(generatedBy)}</div>
                            <div><strong>Current period:</strong> ${escapeHTML(periodSummary.label)}</div>
                            <div><strong>Salary day:</strong> ${escapeHTML(formatDisplayDate(periodSummary.salaryDate))}</div>
                            <div><strong>Period status:</strong> ${escapeHTML(periodStatus)}</div>
                        </div>
                    </section>
                    <section class="summary">
                        <div class="summary-card">
                            <span>Total Employees</span>
                            <strong>${rows.length}</strong>
                        </div>
                        <div class="summary-card">
                            <span>Total Days Worked</span>
                            <strong>${totalDays}</strong>
                        </div>
                        <div class="summary-card">
                            <span>Grand Total Payroll</span>
                            <strong>${escapeHTML(formatCurrency(grandTotal))}</strong>
                        </div>
                    </section>
                    <table>
                        <thead>
                            <tr>
                                <th>Employee Name</th>
                                <th>Role</th>
                                <th>Days Worked</th>
                                <th>Total Earnings</th>
                            </tr>
                        </thead>
                        <tbody>${rowsMarkup}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">Grand Total</td>
                                <td>${escapeHTML(formatCurrency(grandTotal))}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <p class="note">Payroll totals use the saved amount on each work log. Rate changes update only the current payroll period and future entries, so past reimbursed payroll remains unchanged.</p>
                </main>
            </body>
            </html>
        `);
        reportWindow.document.close();
        reportWindow.focus();
        setTimeout(() => reportWindow.print(), 250);
        app.toast('Payroll PDF report opened.');
    },

    renderCurrentPayrollPeriod: () => {
        const summary = app.getCurrentPayrollPeriodSummary();
        const rangeEl = document.getElementById('payroll-period-range');
        const noteEl = document.getElementById('payroll-period-note');
        const totalEl = document.getElementById('payroll-period-total');
        const countEl = document.getElementById('payroll-period-log-count');
        const statusEl = document.getElementById('payroll-period-status');
        const reimburseBtn = document.getElementById('payroll-reimburse-btn');

        if (rangeEl) rangeEl.innerText = summary.label;
        if (totalEl) totalEl.innerText = formatCurrency(summary.totalAmount);
        if (countEl) countEl.innerText = `${summary.logCount} work log${summary.logCount === 1 ? '' : 's'}`;

        if (statusEl) {
            const isReimbursed = summary.status === 'reimbursed';
            statusEl.innerText = isReimbursed ? 'Reimbursed' : 'Pending';
            statusEl.classList.toggle('status-paid', isReimbursed);
            statusEl.classList.toggle('status-pending', !isReimbursed);
        }

        if (noteEl) {
            if (summary.status === 'reimbursed') {
                noteEl.innerText = `Locked by ${summary.reimbursedBy || 'Admin'} on ${formatDateTime(summary.reimbursedAt)}.`;
            } else if (!isSalaryDay()) {
                noteEl.innerText = `Reimbursement opens on Friday salary day (${formatDisplayDate(summary.salaryDate)}). Saturday is rest day.`;
            } else {
                noteEl.innerText = `Friday salary day. Mark this Sunday-Friday payroll as reimbursed once payment is released.`;
            }
        }

        if (reimburseBtn) {
            const disabled = summary.status === 'reimbursed' || summary.logCount === 0 || !isSalaryDay();
            reimburseBtn.disabled = disabled;
            reimburseBtn.innerHTML = summary.status === 'reimbursed'
                ? '<i class="fa-solid fa-lock"></i> Reimbursed'
                : (isSalaryDay()
                    ? '<i class="fa-solid fa-circle-check"></i> Mark as Reimbursed'
                    : '<i class="fa-solid fa-calendar-day"></i> Available Friday');
        }
    },

    renderPayrollHistory: (resetPeriodFilter = false) => {
        const weeklyHistory = app.getPayrollHistory();
        const filterEl = document.getElementById('payroll-history-filter');
        const periodFilterEl = document.getElementById('payroll-history-period-filter');
        const headerRow = document.getElementById('payroll-history-header-row');
        const historyMode = filterEl && filterEl.value === 'monthly' ? 'monthly' : 'weekly';
        const allHistory = historyMode === 'monthly'
            ? app.getMonthlyPayrollHistory(weeklyHistory)
            : weeklyHistory;
        const periodKey = historyMode === 'monthly' ? 'key' : 'id';
        const allPeriodLabel = historyMode === 'monthly' ? 'All months' : 'All weeks';

        let selectedPeriod = resetPeriodFilter ? 'all' : (periodFilterEl ? periodFilterEl.value : 'all');
        if (periodFilterEl) {
            const hasSelectedPeriod = selectedPeriod === 'all' || allHistory.some(period => period[periodKey] === selectedPeriod);
            if (!hasSelectedPeriod) selectedPeriod = 'all';

            periodFilterEl.innerHTML = `<option value="all">${allPeriodLabel}</option>`;
            allHistory.forEach(period => {
                const option = document.createElement('option');
                option.value = period[periodKey];
                option.textContent = period.label;
                periodFilterEl.appendChild(option);
            });
            periodFilterEl.value = selectedPeriod;
        }

        const history = selectedPeriod === 'all'
            ? allHistory
            : allHistory.filter(period => period[periodKey] === selectedPeriod);
        const tbody = document.getElementById('payroll-history-body');
        const totalEl = document.getElementById('payroll-history-total');
        const countEl = document.getElementById('payroll-history-count');
        const countLabelEl = document.getElementById('payroll-history-count-label');
        const historyTotal = history.reduce((sum, period) => sum + period.totalAmount, 0);

        if (totalEl) totalEl.innerText = formatCurrency(historyTotal);
        if (countEl) countEl.innerText = String(history.length);
        if (countLabelEl) countLabelEl.innerText = historyMode === 'monthly' ? 'Months' : 'Periods';
        if (headerRow) {
            headerRow.innerHTML = historyMode === 'monthly'
                ? `
                    <th>Payroll Month</th>
                    <th>Covered Dates</th>
                    <th>Released By</th>
                    <th>Work Logs</th>
                    <th>Total</th>
                `
                : `
                    <th>Payroll Period</th>
                    <th>Salary Day</th>
                    <th>Reimbursed By</th>
                    <th>Work Logs</th>
                    <th>Total</th>
                `;
        }
        if (!tbody) return;

        if (history.length === 0) {
            tbody.innerHTML = createEmptyState(
                historyMode === 'monthly'
                    ? 'No monthly history yet. Reimbursed weekly payrolls will be grouped by month here.'
                    : 'No reimbursed payroll history yet. Mark a Friday payroll as reimbursed to save it here.',
                5
            );
            return;
        }

        tbody.innerHTML = '';
        history.forEach(period => {
            const tr = document.createElement('tr');
            if (historyMode === 'monthly') {
                tr.innerHTML = `
                    <td>
                        <div class="history-period-cell">
                            <strong>${escapeHTML(period.label)}</strong>
                            <small>${period.periodCount} reimbursed week${period.periodCount === 1 ? '' : 's'}</small>
                        </div>
                    </td>
                    <td>${escapeHTML(period.coveredRange)}</td>
                    <td>${escapeHTML(period.reimbursedBy)}</td>
                    <td>${period.logCount} log${period.logCount === 1 ? '' : 's'}</td>
                    <td>${escapeHTML(formatCurrency(period.totalAmount))}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td>
                        <div class="history-period-cell">
                            <strong>${escapeHTML(period.label)}</strong>
                            <small>${period.reimbursedAt ? `Reimbursed ${escapeHTML(formatDateTime(period.reimbursedAt))}` : 'Reimbursed'}</small>
                        </div>
                    </td>
                    <td>${escapeHTML(formatDisplayDate(period.salaryDate || period.endDate))}</td>
                    <td>${escapeHTML(period.reimbursedBy || 'Admin')}</td>
                    <td>${period.logCount} log${period.logCount === 1 ? '' : 's'}</td>
                    <td>${escapeHTML(formatCurrency(period.totalAmount))}</td>
                `;
            }
            tbody.appendChild(tr);
        });
    },

    renderPayroll: () => {
        const tbody = document.getElementById('payroll-table-body');
        tbody.innerHTML = '';

        const { rows, grandTotal } = app.getPayrollSummary();
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHTML(row.name)}</strong></td>
                <td>${escapeHTML(row.role)}</td>
                <td>${row.daysWorked} day${row.daysWorked === 1 ? '' : 's'}</td>
                <td style="color: var(--success); font-weight: 700;">${formatCurrency(row.totalEarnings)}</td>
            `;
            tbody.appendChild(tr);
        });

        if (rows.length === 0) {
            tbody.innerHTML = createEmptyState('No employees found.', 4);
        }

        document.getElementById('payroll-grand-total').innerText = formatCurrency(grandTotal);
        app.renderCurrentPayrollPeriod();
        app.renderPayrollHistory();
    },

    toggleDropdown: (id, event) => {
        if (event) event.stopPropagation();
        document.querySelectorAll('.dropdown-content').forEach(el => {
            if (el.id !== id) el.classList.remove('show');
        });
        const dropdown = document.getElementById(id);
        if (dropdown) dropdown.classList.toggle('show');
    },

    renderWeeklyWork: () => {
        if (isFuturePayrollPeriod(state.currentWeekStart) || isPastPayrollPeriod(state.currentWeekStart)) {
            state.currentWeekStart = getPayrollWeekStart(new Date());
        }

        const summary = app.getPayrollPeriodSummary(state.currentWeekStart);
        const { start, end } = summary;
        const prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
        const prevSummary = app.getPayrollPeriodSummary(prevStart);
        const nextStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);

        const prevBtn = document.getElementById('weekly-prev-btn');
        if (prevBtn) {
            const prevLocked = isPastPayrollPeriod(prevStart) || prevSummary.status === 'reimbursed';
            prevBtn.disabled = prevLocked;
            prevBtn.title = prevLocked ? 'Previous payroll week is already completed and reimbursed.' : 'Previous payroll week';
        }

        const nextBtn = document.getElementById('weekly-next-btn');
        if (nextBtn) {
            nextBtn.disabled = isFuturePayrollPeriod(nextStart);
            nextBtn.title = nextBtn.disabled ? 'Next payroll week opens when that week starts.' : 'Next payroll week';
        }

        const dateRangeEl = document.getElementById('weekly-date-range');
        if (dateRangeEl) dateRangeEl.innerText = `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`;

        const captionEl = document.getElementById('weekly-date-caption');
        if (captionEl) captionEl.innerText = `Sunday-Friday payroll. Salary day is ${formatDisplayDate(summary.salaryDate)}; Saturday is rest day.`;

        const periodStateEl = document.getElementById('weekly-period-state');
        if (periodStateEl) {
            const isReimbursed = summary.status === 'reimbursed';
            periodStateEl.innerText = isReimbursed ? 'Reimbursed and locked' : 'Open period';
            periodStateEl.classList.toggle('status-paid', isReimbursed);
            periodStateEl.classList.toggle('status-pending', !isReimbursed);
        }

        const headerRow = document.getElementById('weekly-header-row');
        headerRow.innerHTML = '<th>Employee</th>';

        const currentDates = [];
        for (let i = 0; i < PAYROLL_PERIOD_DAYS; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = formatDate(d);
            currentDates.push({ dateObj: d, dateStr });
            headerRow.innerHTML += `<th><span>${formatWeekdayDate(d)}</span><small>${i === PAYROLL_PERIOD_DAYS - 1 ? 'Salary day' : 'Work day'}</small></th>`;
        }
        headerRow.innerHTML += '<th>Payroll Earnings</th>';

        const tbody = document.getElementById('weekly-table-body');
        tbody.innerHTML = '';

        const searchInput = document.getElementById('weekly-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeEmployees = state.employees.filter(isEmployeeActive);
        const filtered = activeEmployees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm) || emp.role.toLowerCase().includes(searchTerm)
        );

        const getEmployeeWeekTotal = (emp) => currentDates.reduce((sum, dayInfo) => {
            const log = emp.workLogs.find(item => item.date === dayInfo.dateStr);
            return log ? sum + getEffectiveLogAmount(emp, log) : sum;
        }, 0);

        const visibleTotal = filtered.reduce((sum, emp) => sum + getEmployeeWeekTotal(emp), 0);
        const salaryDayEl = document.getElementById('weekly-salary-day');
        const visibleTotalEl = document.getElementById('weekly-visible-total');
        const visibleCountEl = document.getElementById('weekly-visible-count');

        if (salaryDayEl) salaryDayEl.innerText = formatDisplayDate(summary.salaryDate);
        if (visibleTotalEl) visibleTotalEl.innerText = formatCurrency(visibleTotal);
        if (visibleCountEl) visibleCountEl.innerText = String(filtered.length);

        if (state.employees.length === 0) {
            tbody.innerHTML = createEmptyState('No employees found.', PAYROLL_PERIOD_DAYS + 2);
            return;
        }

        if (activeEmployees.length === 0) {
            tbody.innerHTML = createEmptyState('No active employees found. Reactivate an employee before adding DTR records.', PAYROLL_PERIOD_DAYS + 2);
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = createEmptyState('No employees match your search.', PAYROLL_PERIOD_DAYS + 2);
            return;
        }

        filtered.forEach(emp => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.innerHTML = `<div class="weekly-employee-cell"><strong>${escapeHTML(emp.name)}</strong><small>${escapeHTML(emp.role)}</small></div>`;
            tr.appendChild(nameTd);

            const weeklyTotal = getEmployeeWeekTotal(emp);
            currentDates.forEach(dayInfo => {
                const td = document.createElement('td');
                const log = emp.workLogs.find(item => item.date === dayInfo.dateStr);

                const isLocked = Boolean(app.isPayrollDateLocked(dayInfo.dateStr) || app.isLogLocked(log));
                const workTypes = getWorkTypesFromDescription(log ? log.description : '');
                const hasWorkTypes = workTypes.length > 0;
                const isSetNature = !hasWorkTypes;
                const chipContent = isLocked && log
                    ? '<span class="work-chip-label">Reimbursed</span>'
                    : (hasWorkTypes ? renderWorkTypeChips(workTypes) : '<span class="work-chip-label">Set nature</span>');
                const chipTitle = isLocked && log
                    ? 'Reimbursed'
                    : (hasWorkTypes ? workTypes.join(', ') : 'Set nature');
                td.innerHTML = `
                    <div class="weekly-work-cell">
                        <button class="work-chip ${isLocked ? 'btn-reimbursed' : (isSetNature ? 'btn-set-nature' : 'btn-secondary')}"
                            onclick="app.openDTRModal('${emp.id}', '${dayInfo.dateStr}')" title="${escapeHTML(chipTitle)}" ${isLocked ? 'disabled' : ''}>
                            ${chipContent}
                        </button>
                    </div>
                `;
                tr.appendChild(td);
            });

            const totalTd = document.createElement('td');
            totalTd.className = 'weekly-total-cell';
            totalTd.innerText = formatCurrency(weeklyTotal);
            tr.appendChild(totalTd);
            tbody.appendChild(tr);
        });
    },

    renderEmployeeDetails: (id) => {
        const emp = state.employees.find(item => item.id === id);
        if (!emp) return app.navigate('employees');

        document.getElementById('detail-name').innerText = emp.name;
        document.getElementById('detail-role').innerText = emp.role;
        const employeeStatus = getEmployeeStatus(emp);
        const isActive = employeeStatus === 'active';
        const detailStatusEl = document.getElementById('detail-status');
        if (detailStatusEl) detailStatusEl.innerText = `Status: ${isActive ? 'Active' : 'Inactive'}`;
        document.getElementById('detail-contact').innerText = `Contact: ${emp.contact || 'N/A'}`;
        document.getElementById('detail-address').innerText = `Address: ${emp.address || 'N/A'}`;
        document.getElementById('detail-daily-rate').innerText = formatCurrency(getConfiguredWorkAmount(emp));

        const statusActionBtn = document.getElementById('detail-status-action');
        if (statusActionBtn) {
            statusActionBtn.innerHTML = isActive
                ? '<i class="fa-solid fa-user-slash"></i> Mark Inactive'
                : '<i class="fa-solid fa-user-check"></i> Reactivate';
            statusActionBtn.classList.toggle('btn-inactive', isActive);
            statusActionBtn.classList.toggle('btn-success-soft', !isActive);
        }

        const logWorkBtn = document.getElementById('detail-log-work-btn');
        if (logWorkBtn) {
            logWorkBtn.disabled = !isActive;
            logWorkBtn.title = isActive ? 'Log work for this employee' : 'Reactivate this employee before logging new work.';
        }

        const total = emp.workLogs.reduce((sum, log) => sum + getEffectiveLogAmount(emp, log), 0);
        document.getElementById('detail-total-earnings').innerText = formatCurrency(total);

        const tbody = document.getElementById('employee-logs-body');
        tbody.innerHTML = '';

        if (emp.workLogs.length === 0) {
            tbody.innerHTML = createEmptyState('No work logs for this employee.', 4);
            return;
        }

        emp.workLogs.forEach(log => {
            const tr = document.createElement('tr');
            const isLocked = app.isLogLocked(log);
            tr.innerHTML = `
                <td>${formatDisplayDate(log.date)}</td>
                <td>${escapeHTML(log.description)} ${isLocked ? '<span class="status-chip status-paid log-status-chip">Reimbursed</span>' : ''}</td>
                <td>${formatCurrency(getEffectiveLogAmount(emp, log))}</td>
                <td>
                    <button class="btn ${isLocked ? 'btn-locked' : 'btn-delete'}" style="padding:0.35rem 0.55rem;" onclick="app.deleteWorkLog('${emp.id}', '${log.id}')" ${isLocked ? 'disabled' : ''}>
                        <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-trash'}"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

app.init();
