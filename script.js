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

const STORAGE_KEYS = {
    employees: 'payflow_employees',
    settings: 'payflow_settings',
    isLoggedIn: 'payflow_is_logged_in',
    currentAdminId: 'payflow_current_admin_id',
    admins: 'payflow_admins'
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
    admins: [],
    currentView: 'dashboard',
    selectedEmployeeId: null,
    currentWeekStart: null,
    currentAdminId: null,
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
    const configuredAmount = Number(state.settings.weeklyPayrollAmount) || 0;
    if (configuredAmount > 0) return configuredAmount;
    const storedAmount = Number(log.amount) || 0;
    return storedAmount > 0 ? storedAmount : getConfiguredWorkAmount(employee);
};

// --- Utilities ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

const getMonday = (d) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDate = (d) => d.toISOString().split('T')[0];
const formatDisplayDate = (dateStr) => shortDateFormatter.format(new Date(dateStr));
const formatWeekdayDate = (d) => weekdayFormatter.format(d);
const formatDateTime = (dateStr) => dateStr ? dateTimeFormatter.format(new Date(dateStr)) : 'Not yet saved';

const saveState = () => {
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(state.employees));
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

const formatCurrency = (amount) => currencyFormatter.format(Number(amount) || 0);

const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const createEmptyState = (message, colspan = 4) =>
    `<tr><td colspan="${colspan}" class="empty-state">${message}</td></tr>`;

const getCurrentWeekLogsTotal = () => {
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();

    return state.employees.reduce((sum, emp) => {
        const empWeekTotal = emp.workLogs.reduce((empSum, log) => {
            const logDate = new Date(log.date);
            const sameWeek = getWeekNumber(logDate) === currentWeek && logDate.getFullYear() === currentYear;
            return sameWeek ? empSum + getEffectiveLogAmount(emp, log) : empSum;
        }, 0);
        return sum + empWeekTotal;
    }, 0);
};

const getPageSubtitle = (viewId) => {
    const totalEmployees = state.employees.length;
    const totalLogs = state.employees.reduce((sum, emp) => sum + emp.workLogs.length, 0);

    if (viewId === 'dashboard') return 'Overview of payroll activity and workforce data.';
    if (viewId === 'employees') return `${totalEmployees} employee${totalEmployees === 1 ? '' : 's'} in the system.`;
    if (viewId === 'payroll') return 'Summary of total earnings by employee.';
    if (viewId === 'weekly') return 'Manage daily attendance and nature-of-work records.';
    if (viewId === 'settings') return 'Update work day amount and profile information.';
    if (viewId === 'details') return `${totalLogs} total work log${totalLogs === 1 ? '' : 's'} recorded.`;
    return '';
};

// --- App Controller ---
const app = {
    init: async () => {
        state.currentWeekStart = getMonday(new Date());
        await app.loadInitialData();
        app.render();
    },

    loadInitialData: async () => {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.employees) || '[]');
        const localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
        const localAdmins = JSON.parse(localStorage.getItem(STORAGE_KEYS.admins) || '[]');
        const storedLoginState = localStorage.getItem(STORAGE_KEYS.isLoggedIn);
        const storedCurrentAdminId = localStorage.getItem(STORAGE_KEYS.currentAdminId);

        state.employees = Array.isArray(local) ? local : [];
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
        if (modal) modal.classList.add('active');
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
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

    updateSettingsField: (fieldName) => {
        const config = SETTINGS_FIELD_CONFIG[fieldName];
        if (!config) return;

        const input = document.getElementById(config.inputId);
        if (!input) return;

        const nextValue = config.normalize(input.value);
        state.settings[config.stateKey] = nextValue;

        if (config.adminKey && state.currentAdminId) {
            const activeAdmin = app.getCurrentAdmin();
            if (activeAdmin) {
                activeAdmin[config.adminKey] = nextValue;
                saveAdminState();
            }
        }

        state.settings.lastUpdatedAt = new Date().toISOString();
        saveState();
        app.toast(`${config.label} updated.`);
    },

    resetSettingsForm: () => {
        app.renderSettings();
        app.toast('Settings form reset.');
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
        const loginForm = document.querySelector('#auth-login-card form');
        if (loginForm) loginForm.reset();
        app.renderAuth();
        app.toast('You have been successfully logged out.');
    },

    handleAddEmployee: (e) => {
        e.preventDefault();
        const form = e.target;
        const newEmployee = {
            id: generateId(),
            name: form.name.value.trim(),
            role: form.role.value.trim(),
            contact: form.contact.value.trim(),
            address: form.address.value.trim(),
            dailyRate: parseFloat(form['daily-rate'].value) || 0,
            joinedDate: new Date().toISOString(),
            workLogs: []
        };
        state.employees.push(newEmployee);
        saveState();
        form.reset();
        app.closeModal('add-employee-modal');
        app.toast('Employee added successfully.');
        app.navigate('employees');
    },

    viewEmployee: (id) => {
        state.selectedEmployeeId = id;
        app.navigate('details');
    },

    handleAddWorkLog: (e) => {
        e.preventDefault();
        const form = e.target;
        const empId = state.selectedEmployeeId;
        const employee = state.employees.find(emp => emp.id === empId);

        if (!employee) return;

        const newLog = {
            id: generateId(),
            date: form.date.value,
            description: form.description.value.trim(),
            amount: getConfiguredWorkAmount(employee)
        };
        employee.workLogs.push(newLog);
        employee.workLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

        saveState();
        form.reset();
        app.closeModal('add-work-modal');
        app.toast('Work log saved.');
        app.renderEmployeeDetails(empId);
    },

    deleteEmployee: (id) => {
        if (confirm('Are you sure you want to remove this employee? This action cannot be undone.')) {
            state.employees = state.employees.filter(emp => emp.id !== id);
            saveState();
            app.toast('Employee deleted.');
            app.navigate('employees');
        }
    },

    deleteWorkLog: (empId, logId) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;
        employee.workLogs = employee.workLogs.filter(log => log.id !== logId);
        saveState();
        app.toast('Work log removed.');
        app.renderEmployeeDetails(empId);
    },

    changeWeek: (offset) => {
        const d = new Date(state.currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        state.currentWeekStart = d;
        app.renderWeeklyWork();
    },

    openDTRModal: (empId = '', dateStr = '') => {
        const modal = document.getElementById('add-dtr-modal');
        const empSelect = document.getElementById('dtr-employee');
        const dateInput = document.getElementById('dtr-date');
        if (!modal || !empSelect || !dateInput) return;

        empSelect.innerHTML = state.employees
            .map(emp => `<option value="${emp.id}">${emp.name} (${emp.role})</option>`)
            .join('');

        const defaultEmpId = empId || (state.employees[0] ? state.employees[0].id : '');
        const defaultDate = dateStr || formatDate(new Date());

        if (defaultEmpId) empSelect.value = defaultEmpId;
        dateInput.value = defaultDate;

        document.querySelectorAll('#add-dtr-modal input[name="nature"]').forEach(cb => {
            cb.checked = false;
        });

        const employee = state.employees.find(emp => emp.id === defaultEmpId);
        const existingLog = employee ? employee.workLogs.find(log => log.date === defaultDate) : null;
        if (existingLog && existingLog.description.startsWith('Work: ')) {
            const selected = existingLog.description.substring(6).split(', ');
            document.querySelectorAll('#add-dtr-modal input[name="nature"]').forEach(cb => {
                cb.checked = selected.includes(cb.value);
            });
        }

        app.openModal('add-dtr-modal');
    },

    setDTRStatus: (empId, dateStr, checked) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;

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
        const selectedNature = Array.from(form.querySelectorAll('input[name="nature"]:checked')).map(cb => cb.value);

        if (selectedNature.length === 0) {
            alert('Select at least one nature of work.');
            return;
        }

        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;

        const rate = getConfiguredWorkAmount(employee);
        const desc = `Work: ${selectedNature.sort().join(', ')}`;
        const existingLog = employee.workLogs.find(log => log.date === dateStr);

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
        app.closeModal('add-dtr-modal');
        app.toast('DTR record saved.');
        app.renderWeeklyWork();
    },

    toggleWorkType: (empId, dateStr, type) => {
        const employee = state.employees.find(emp => emp.id === empId);
        if (!employee) return;

        let log = employee.workLogs.find(item => item.date === dateStr);
        let workTypes = [];

        if (log) {
            const match = log.description.match(/Work: (.*)/);
            if (match && match[1]) {
                workTypes = match[1].split(', ');
            }
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

    // --- Rendering ---
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
        const totalEmployees = state.employees.length;
        const weeklyPayroll = getCurrentWeekLogsTotal();
        const recentLogs = [];

        state.employees.forEach(emp => {
            emp.workLogs.forEach(log => {
                recentLogs.push({ empName: emp.name, ...log, amount: getEffectiveLogAmount(emp, log) });
            });
        });

        recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const top5 = recentLogs.slice(0, 5);
        const weeklyValueToDisplay = weeklyPayroll;
        const monthlyValueToDisplay = weeklyValueToDisplay * 4;

        document.getElementById('dash-total-employees').innerText = totalEmployees;
        document.getElementById('dash-weekly-payroll').innerText = formatCurrency(weeklyValueToDisplay);
        document.getElementById('dash-monthly-payroll').innerText = formatCurrency(monthlyValueToDisplay);

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

    renderSettings: () => {
        const weeklyPayrollInput = document.getElementById('settings-weekly-payroll');
        const profileNameInput = document.getElementById('settings-profile-name');
        const profileRoleInput = document.getElementById('settings-profile-role');
        const currentWeekTotalEl = document.getElementById('settings-current-week-total');
        const totalEmployeesEl = document.getElementById('settings-total-employees');
        const totalLogsEl = document.getElementById('settings-total-logs');
        const lastUpdatedEl = document.getElementById('settings-last-updated');

        if (weeklyPayrollInput) weeklyPayrollInput.value = Number(state.settings.weeklyPayrollAmount || 0);
        if (profileNameInput) profileNameInput.value = state.settings.profileName;
        if (profileRoleInput) profileRoleInput.value = state.settings.profileRole;
        if (currentWeekTotalEl) currentWeekTotalEl.innerText = formatCurrency(getCurrentWeekLogsTotal());
        if (totalEmployeesEl) totalEmployeesEl.innerText = String(state.employees.length);
        if (totalLogsEl) {
            const logCount = state.employees.reduce((sum, emp) => sum + emp.workLogs.length, 0);
            totalLogsEl.innerText = String(logCount);
        }
        if (lastUpdatedEl) lastUpdatedEl.innerText = formatDateTime(state.settings.lastUpdatedAt);

        Object.keys(SETTINGS_FIELD_CONFIG).forEach((fieldName) => {
            app.setSettingsFieldMode(fieldName, false);
        });
    },

    renderEmployeeList: () => {
        const grid = document.getElementById('employee-grid');
        grid.innerHTML = '';

        const searchInput = document.getElementById('employee-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const filtered = state.employees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm) || emp.role.toLowerCase().includes(searchTerm)
        );

        if (state.employees.length === 0) {
            grid.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">No employees yet. Click "Add Employee" to get started.</p>';
            return;
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">No employees match your search.</p>';
            return;
        }

        filtered.forEach(emp => {
            const card = document.createElement('div');
            card.className = 'employee-card';
            card.onclick = (e) => {
                if (!e.target.closest('.btn-delete')) app.viewEmployee(emp.id);
            };

            const total = emp.workLogs.reduce((sum, log) => sum + getEffectiveLogAmount(emp, log), 0);

            card.innerHTML = `
                <div class="card-header">
                    <div class="emp-avatar">
                        <i class="fa-solid fa-user"></i>
                    </div>
                </div>
                <div class="emp-info">
                    <h3>${emp.name}</h3>
                    <p>${emp.role}</p>
                </div>
                <div style="margin-top: auto; padding-top: 0.8rem; border-top: 1px solid #edf2f1; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <small style="color:#64748b">Total Earnings</small>
                        <div style="font-weight:800; color:var(--primary);">${formatCurrency(total)}</div>
                    </div>
                    <button class="btn btn-delete" onclick="app.deleteEmployee('${emp.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    renderPayroll: () => {
        const tbody = document.getElementById('payroll-table-body');
        tbody.innerHTML = '';

        let grandTotal = 0;
        state.employees.forEach(emp => {
            const totalEarnings = emp.workLogs.reduce((sum, log) => sum + getEffectiveLogAmount(emp, log), 0);
            grandTotal += totalEarnings;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.name}</strong></td>
                <td>${emp.role}</td>
                <td>${emp.workLogs.length} day${emp.workLogs.length === 1 ? '' : 's'}</td>
                <td style="color: var(--success); font-weight: 700;">${formatCurrency(totalEarnings)}</td>
            `;
            tbody.appendChild(tr);
        });

        if (state.employees.length === 0) {
            tbody.innerHTML = createEmptyState('No employees found.', 4);
        }

        document.getElementById('payroll-grand-total').innerText = formatCurrency(grandTotal);
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
        const start = new Date(state.currentWeekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        document.getElementById('weekly-date-range').innerText =
            `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`;

        const headerRow = document.getElementById('weekly-header-row');
        headerRow.innerHTML = '<th>Employee</th>';

        const currentDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = formatDate(d);
            currentDates.push({ dateObj: d, dateStr });
            headerRow.innerHTML += `<th>${formatWeekdayDate(d)}</th>`;
        }
        headerRow.innerHTML += '<th>Weekly Earnings</th>';

        const tbody = document.getElementById('weekly-table-body');
        tbody.innerHTML = '';

        const searchInput = document.getElementById('weekly-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filtered = state.employees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm) || emp.role.toLowerCase().includes(searchTerm)
        );

        if (state.employees.length === 0) {
            tbody.innerHTML = createEmptyState('No employees found.', 9);
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = createEmptyState('No employees match your search.', 9);
            return;
        }

        filtered.forEach(emp => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.innerHTML = `<div><strong>${emp.name}</strong><br><small style="color:#64748b">${emp.role}</small></div>`;
            tr.appendChild(nameTd);

            let weeklyTotal = 0;
            currentDates.forEach(dayInfo => {
                const td = document.createElement('td');
                const log = emp.workLogs.find(item => item.date === dayInfo.dateStr);
                if (log) weeklyTotal += getEffectiveLogAmount(emp, log);

                const natureText = log && log.description ? log.description.replace('Work: ', '') : 'Set nature';
                td.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.35rem;">
                        <button class="btn btn-secondary" style="padding:0.25rem 0.45rem; font-size:0.72rem;"
                            onclick="app.openDTRModal('${emp.id}', '${dayInfo.dateStr}')">
                            ${natureText}
                        </button>
                    </div>
                `;
                tr.appendChild(td);
            });

            const totalTd = document.createElement('td');
            totalTd.style.fontWeight = '800';
            totalTd.style.color = 'var(--success)';
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
        document.getElementById('detail-contact').innerText = `Contact: ${emp.contact || 'N/A'}`;
        document.getElementById('detail-address').innerText = `Address: ${emp.address || 'N/A'}`;
        document.getElementById('detail-daily-rate').innerText = formatCurrency(getConfiguredWorkAmount(emp));

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
            tr.innerHTML = `
                <td>${formatDisplayDate(log.date)}</td>
                <td>${log.description}</td>
                <td>${formatCurrency(getEffectiveLogAmount(emp, log))}</td>
                <td>
                    <button class="btn btn-delete" style="padding:0.35rem 0.55rem;" onclick="app.deleteWorkLog('${emp.id}', '${log.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

app.init();
