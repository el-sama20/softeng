/**
 * EFETEBE AQUA & AGRICULTURAL CORPORATION - Payroll System
 * Handles state, navigation, and calculations.
 */

// --- State Management ---
const state = {
    employees: JSON.parse(localStorage.getItem('payflow_employees')) || [],
    currentView: 'dashboard',
    selectedEmployeeId: null,
    currentWeekStart: null, // Set in init
    FIXED_DAILY_RATE: 450
};

// --- Utilities ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

const getMonday = (d) => {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
};

const formatDate = (d) => {
    return d.toISOString().split('T')[0];
};

const saveState = () => {
    localStorage.setItem('payflow_employees', JSON.stringify(state.employees));
    app.render(); // Re-render on state change
};

const formatCurrency = (amount) => {
    return '₱' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
};

const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// --- App Controller ---
const app = {
    init: () => {
        app.render();
        // Determine initial view based on actions or default
    },

    navigate: (viewId) => {
        state.currentView = viewId;

        // UI Updates for Navigation
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId === 'details' ? 'details' : viewId}`).classList.add('active');

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (viewId !== 'details') {
            const navBtn = document.querySelector(`button[onclick="app.navigate('${viewId}')"]`);
            if (navBtn) navBtn.classList.add('active');
        }

        // Specific View logic
        if (viewId === 'dashboard') {
            document.getElementById('page-title').innerText = 'Dashboard';
            app.renderDashboard();
        } else if (viewId === 'employees') {
            document.getElementById('page-title').innerText = 'Employees';
            app.renderEmployeeList();
        } else if (viewId === 'payroll') {
            document.getElementById('page-title').innerText = 'Payroll Summary';
            app.renderPayroll();
        } else if (viewId === 'details') {
            document.getElementById('page-title').innerText = 'Employee Details';
            app.renderEmployeeDetails(state.selectedEmployeeId);
        }
    },

    openModal: (modalId) => {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal: (modalId) => {
        document.getElementById(modalId).classList.remove('active');
    },

    // --- Actions ---

    handleAddEmployee: (e) => {
        e.preventDefault();
        const form = e.target;
        const newEmployee = {
            id: generateId(),
            name: form.name.value,
            role: form.role.value,
            contact: form.contact.value,
            address: form.address.value,
            dailyRate: parseFloat(form['daily-rate'].value) || 0,
            joinedDate: new Date().toISOString(),
            workLogs: []
        };
        state.employees.push(newEmployee);
        saveState();
        form.reset();
        app.closeModal('add-employee-modal');
        app.navigate('employees'); // Switch to list view to see new employee
    },

    viewEmployee: (id) => {
        state.selectedEmployeeId = id;
        app.navigate('details');
    },

    handleAddWorkLog: (e) => {
        e.preventDefault();
        const form = e.target;
        const empId = state.selectedEmployeeId;
        const employee = state.employees.find(e => e.id === empId);

        if (employee) {
            const newLog = {
                id: generateId(),
                date: form.date.value, // YYYY-MM-DD
                description: form.description.value,
                amount: state.FIXED_DAILY_RATE
            };
            employee.workLogs.push(newLog);
            // Sort logs by date descending
            employee.workLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

            saveState();
            form.reset();
            app.closeModal('add-work-modal');
            app.renderEmployeeDetails(empId); // Refresh details view
        }
    },

    deleteEmployee: (id) => {
        if (confirm('Are you sure you want to remove this employee? This action cannot be undone.')) {
            state.employees = state.employees.filter(e => e.id !== id);
            saveState();
            app.navigate('employees');
        }
    },

    deleteWorkLog: (empId, logId) => {
        const employee = state.employees.find(e => e.id === empId);
        if (employee) {
            employee.workLogs = employee.workLogs.filter(l => l.id !== logId);
            saveState();
            app.renderEmployeeDetails(empId);
        }
    },

    changeWeek: (offset) => {
        const d = new Date(state.currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        state.currentWeekStart = d;
        app.renderWeeklyWork();
    },

    toggleWorkType: (empId, dateStr, type) => {
        const employee = state.employees.find(e => e.id === empId);
        if (!employee) return;

        let log = employee.workLogs.find(l => l.date === dateStr);
        let workTypes = [];

        if (log) {
            const match = log.description.match(/Work: (.*)/);
            if (match && match[1]) {
                workTypes = match[1].split(', ');
            }
        }

        // Toggle logic
        if (workTypes.includes(type)) {
            workTypes = workTypes.filter(t => t !== type);
        } else {
            workTypes.push(type);
            workTypes.sort();
        }

        // Update Data
        if (workTypes.length === 0) {
            if (log) {
                employee.workLogs = employee.workLogs.filter(l => l.id !== log.id);
            }
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

        // --- Partial DOM Update (No full re-render) ---

        // 1. Update Checkbox UI
        const checkEl = document.getElementById(`check-${empId}-${dateStr}-${type}`);
        if (checkEl) {
            checkEl.classList.toggle('checked');
        }

        // 2. Update Dropdown Button Text
        const btnEl = document.getElementById(`btn-${empId}-${dateStr}`);
        if (btnEl) {
            const span = btnEl.querySelector('span');
            span.innerText = workTypes.length > 0 ? workTypes.join(', ') : 'Select';
        }

        // 3. Update Weekly Total for this Row (re-calculate from all logs in current week)
        // We know the current week's logs for this employee
        // Current dates are calculated in renderWeeklyWork, but we can do a quick sum here
        // Or simpler: iterate active DOM cells? No, stick to data.

        // We need the range of the current week to sum correctly
        const start = new Date(state.currentWeekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        let weeklyTotal = 0;
        // Re-fetch employee logs to ensure latest state
        // Simple filter: date between start and end (inclusive)
        // Convert to YYYY-MM-DD for comparison
        // Actually, we can just use the same logic as renderWeeklyWork if we had the dates
        // Let's just generate the 7 dates strings
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dStr = formatDate(d);
            const dayLog = employee.workLogs.find(l => l.date === dStr);
            if (dayLog) weeklyTotal += dayLog.amount;
        }

        const totalEl = document.getElementById(`total-${empId}`);
        if (totalEl) totalEl.innerText = formatCurrency(weeklyTotal);

        // app.renderWeeklyWork(); // Removed to keep dropdown open
    },

    // --- Rendering ---

    render: () => {
        // Re-renders current view
        app.navigate(state.currentView);

        // Global Click Listener for Dropdowns (ensure single bind)
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

                // Monthly Calculation
                if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
                    monthlyPayroll += log.amount;
                }

                // Weekly Calculation (Simple check matching current week number)
                if (getWeekNumber(logDate) === currentWeek && logDate.getFullYear() === currentYear) {
                    weeklyPayroll += log.amount;
                }

                recentLogs.push({
                    empName: emp.name,
                    ...log
                });
            });
        });

        // Top 5 recent logs
        recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const top5 = recentLogs.slice(0, 5);

        // Update DOM
        document.getElementById('dash-total-employees').innerText = totalEmployees;
        document.getElementById('dash-weekly-payroll').innerText = formatCurrency(weeklyPayroll);
        document.getElementById('dash-monthly-payroll').innerText = formatCurrency(monthlyPayroll);

        const tbody = document.getElementById('recent-logs-body');
        tbody.innerHTML = '';
        if (top5.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">No work logs yet.</td></tr>';
        } else {
            top5.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.empName}</td>
                    <td>${log.date}</td>
                    <td>${log.description}</td>
                    <td style="color: var(--secondary); font-weight: 600;">${formatCurrency(log.amount)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    renderEmployeeList: () => {
        const grid = document.getElementById('employee-grid');
        grid.innerHTML = '';

        const searchInput = document.getElementById('employee-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        // Filter employees
        const filtered = state.employees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm) ||
            emp.role.toLowerCase().includes(searchTerm)
        );

        if (state.employees.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#999;">No employees found. Click "Add Employee" to get started.</p>';
            return;
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#999;">No employees match your search.</p>';
            return;
        }

        filtered.forEach(emp => {
            const card = document.createElement('div');
            card.className = 'employee-card';
            card.onclick = (e) => {
                // Prevent navigating if delete button is clicked
                if (!e.target.closest('.btn-delete')) {
                    app.viewEmployee(emp.id);
                }
            };

            // Calculate total earnings
            const total = emp.workLogs.reduce((sum, log) => sum + log.amount, 0);

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
                <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <small style="color:#999">Total Earnings</small>
                        <div style="font-weight:700; color:var(--primary);">${formatCurrency(total)}</div>
                    </div>
                    <button class="btn btn-delete" style="color: #ef4444; background:none; padding:0.5rem;" onclick="app.deleteEmployee('${emp.id}')">
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
            const totalEarnings = emp.workLogs.reduce((sum, log) => sum + log.amount, 0);
            grandTotal += totalEarnings;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.name}</strong></td>
                <td>${emp.role}</td>
                <td>${emp.workLogs.length} days</td>
                <td style="color: var(--secondary); font-weight: 600;">${formatCurrency(totalEarnings)}</td>
            `;
            tbody.appendChild(tr);
        });

        if (state.employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">No employees found.</td></tr>';
        }

        document.getElementById('payroll-grand-total').innerText = formatCurrency(grandTotal);
    },

    toggleDropdown: (id, event) => {
        if (event) event.stopPropagation();
        // Close others
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
            `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;

        // 1. Generate Header Rows (Mon 10/23, Tue 10/24 ...)
        const headerRow = document.getElementById('weekly-header-row');
        headerRow.innerHTML = '<th>Employee</th>';

        const currentDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = formatDate(d);
            currentDates.push({ dateObj: d, dateStr: dateStr });

            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayDate = d.getDate();
            headerRow.innerHTML += `<th>${dayName} ${dayDate}</th>`;
        }
        headerRow.innerHTML += '<th>Total</th>';

        // 2. Generate Body
        const tbody = document.getElementById('weekly-table-body');
        tbody.innerHTML = '';

        const workTypes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

        // FILTER LOGIC
        const searchInput = document.getElementById('weekly-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = state.employees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm)
        );

        if (state.employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#999">No employees found.</td></tr>';
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#999">No employees match your search.</td></tr>';
            return;
        }

        filtered.forEach(emp => {
            const tr = document.createElement('tr');

            // Employee Name Cell
            const nameTd = document.createElement('td');
            nameTd.innerHTML = `<div><strong>${emp.name}</strong><br><small style="color:#999">${emp.role}</small></div>`;
            tr.appendChild(nameTd);

            let weeklyTotal = 0;

            // Day Cells
            currentDates.forEach(dayInfo => {
                const td = document.createElement('td');

                // Check if log exists
                const log = emp.workLogs.find(l => l.date === dayInfo.dateStr);

                // Parse active types
                let activeTypes = [];
                if (log && log.description.startsWith('Work: ')) {
                    activeTypes = log.description.substring(6).split(', ');
                    weeklyTotal += log.amount;
                } else if (log) {
                    // Backward compatibility or manual logs
                    weeklyTotal += log.amount;
                }

                // Dropdown Structure
                const dropdownId = `dropdown-${emp.id}-${dayInfo.dateStr}`;
                const btnText = activeTypes.length > 0 ? activeTypes.join(', ') : 'Select';
                const btnClass = activeTypes.length > 0 ? 'dropdown-btn active-selection' : 'dropdown-btn';

                // Inline SVG for arrow
                const arrowIcon = `<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1L5 5L9 1"/></svg>`;

                const dropdownHtml = `
                    <div class="dropdown-wrapper">
                        <button class="dropdown-btn" id="btn-${emp.id}-${dayInfo.dateStr}" onclick="app.toggleDropdown('${dropdownId}', event)">
                            <span>${btnText}</span>
                            ${arrowIcon}
                        </button>
                        <div id="${dropdownId}" class="dropdown-content">
                            ${workTypes.map(type => `
                                <div class="check-item ${activeTypes.includes(type) ? 'checked' : ''}" 
                                     id="check-${emp.id}-${dayInfo.dateStr}-${type}"
                                     onclick="app.toggleWorkType('${emp.id}', '${dayInfo.dateStr}', '${type}')">
                                    ${type}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

                td.innerHTML = dropdownHtml;
                tr.appendChild(td);
            });

            // Total Column
            const totalTd = document.createElement('td');
            totalTd.id = `total-${emp.id}`;
            totalTd.innerText = formatCurrency(weeklyTotal);
            tr.appendChild(totalTd);

            tbody.appendChild(tr);
        });
    },

    renderEmployeeDetails: (id) => {
        const emp = state.employees.find(e => e.id === id);
        if (!emp) return app.navigate('employees');

        document.getElementById('detail-name').innerText = emp.name;
        document.getElementById('detail-role').innerText = emp.role;
        document.getElementById('detail-contact').innerText = `Contact: ${emp.contact || 'N/A'}`;
        document.getElementById('detail-address').innerText = `Address: ${emp.address || 'N/A'}`;
        document.getElementById('detail-daily-rate').innerText = formatCurrency(emp.dailyRate);

        const total = emp.workLogs.reduce((sum, log) => sum + log.amount, 0);
        document.getElementById('detail-total-earnings').innerText = formatCurrency(total);

        const tbody = document.getElementById('employee-logs-body');
        tbody.innerHTML = '';

        if (emp.workLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">No work logs for this employee.</td></tr>';
        } else {
            emp.workLogs.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.date}</td>
                    <td>${log.description}</td>
                    <td>${formatCurrency(log.amount)}</td>
                    <td>
                        <button class="btn" style="color:#ef4444; padding:0.2rem 0.5rem;" onclick="app.deleteWorkLog('${emp.id}', '${log.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
};

// Start App
app.init();
