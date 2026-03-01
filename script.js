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

// --- State Management ---
const state = {
    employees: [],
    currentView: 'dashboard',
    selectedEmployeeId: null,
    currentWeekStart: null,
    FIXED_DAILY_RATE: 450,
    WORK_TYPES: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    toastTimer: null
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

const saveState = () => {
    localStorage.setItem('payflow_employees', JSON.stringify(state.employees));
    app.render();
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

const getPageSubtitle = (viewId) => {
    const totalEmployees = state.employees.length;
    const totalLogs = state.employees.reduce((sum, emp) => sum + emp.workLogs.length, 0);

    if (viewId === 'dashboard') return 'Overview of payroll activity and workforce data.';
    if (viewId === 'employees') return `${totalEmployees} employee${totalEmployees === 1 ? '' : 's'} in the system.`;
    if (viewId === 'payroll') return 'Summary of total earnings by employee.';
    if (viewId === 'weekly') return 'Manage daily attendance and nature-of-work records.';
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
        const local = JSON.parse(localStorage.getItem('payflow_employees') || '[]');
        state.employees = Array.isArray(local) ? local : [];
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
        state.currentView = viewId;

        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const viewEl = document.getElementById(`view-${viewId === 'details' ? 'details' : viewId}`);
        if (viewEl) viewEl.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (viewId !== 'details') {
            document.querySelectorAll(`button[onclick="app.navigate('${viewId}')"], button[onclick="app.navigateMobile('${viewId}')"]`)
                .forEach(btn => btn.classList.add('active'));
        }

        if (viewId === 'dashboard') {
            document.getElementById('page-title').innerText = 'Dashboard';
            app.renderDashboard();
        } else if (viewId === 'employees') {
            document.getElementById('page-title').innerText = 'Employees';
            app.renderEmployeeList();
        } else if (viewId === 'payroll') {
            document.getElementById('page-title').innerText = 'Payroll Summary';
            app.renderPayroll();
        } else if (viewId === 'weekly') {
            document.getElementById('page-title').innerText = 'Work Week DTR';
            app.renderWeeklyWork();
        } else if (viewId === 'details') {
            document.getElementById('page-title').innerText = 'Employee Details';
            app.renderEmployeeDetails(state.selectedEmployeeId);
        }

        app.updatePageContext(viewId);
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
            amount: state.FIXED_DAILY_RATE
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

        const rate = Number(employee.dailyRate) > 0 ? Number(employee.dailyRate) : state.FIXED_DAILY_RATE;
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
                log.amount = state.FIXED_DAILY_RATE;
            } else {
                employee.workLogs.push({
                    id: generateId(),
                    date: dateStr,
                    description: desc,
                    amount: state.FIXED_DAILY_RATE
                });
            }
        }

        saveState();
    },

    // --- Rendering ---
    render: () => {
        app.navigate(state.currentView);

        window.onclick = (event) => {
            if (!event.target.closest('.dropdown-wrapper')) {
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
            }
        };
    },

    renderDashboard: () => {
        const totalEmployees = state.employees.length;
        let weeklyPayroll = 0;
        let monthlyPayroll = 0;
        const now = new Date();
        const currentWeek = getWeekNumber(now);
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const recentLogs = [];

        state.employees.forEach(emp => {
            emp.workLogs.forEach(log => {
                const logDate = new Date(log.date);
                if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) monthlyPayroll += Number(log.amount) || 0;
                if (getWeekNumber(logDate) === currentWeek && logDate.getFullYear() === currentYear) weeklyPayroll += Number(log.amount) || 0;
                recentLogs.push({ empName: emp.name, ...log });
            });
        });

        recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const top5 = recentLogs.slice(0, 5);

        document.getElementById('dash-total-employees').innerText = totalEmployees;
        document.getElementById('dash-weekly-payroll').innerText = formatCurrency(weeklyPayroll);
        document.getElementById('dash-monthly-payroll').innerText = formatCurrency(monthlyPayroll);

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

            const total = emp.workLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);

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
            const totalEarnings = emp.workLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
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
                if (log) weeklyTotal += Number(log.amount) || 0;

                const natureText = log && log.description ? log.description.replace('Work: ', '') : 'Set nature';
                td.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.35rem;">
                        <input type="checkbox" ${log ? 'checked' : ''}
                            onchange="app.setDTRStatus('${emp.id}', '${dayInfo.dateStr}', this.checked)">
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
        document.getElementById('detail-daily-rate').innerText = formatCurrency(emp.dailyRate);

        const total = emp.workLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
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
                <td>${formatCurrency(log.amount)}</td>
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
