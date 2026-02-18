// ===== ADMIN DASHBOARD LOGIC (Firebase-driven) =====

let allDoctors = [];
let allTokens = [];
let allLeaveRequests = [];
let currentTokenFilter = 'all';

// ===== SECTION NAVIGATION =====
function showAdminSection(section) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) event.target.closest('.sidebar-link').classList.add('active');
}

// ===== INIT: Listen to Firebase data =====
document.addEventListener('DOMContentLoaded', () => {
    listenDoctors(onDoctorsUpdate);
    listenTodayTokens(onTokensUpdate);
    listenLeaveRequests(onLeaveUpdate);
    loadSettingsUI();
});

// ===== DOCTORS =====
function onDoctorsUpdate(doctors) {
    allDoctors = doctors;
    renderDoctorsTable();
    renderDepartments();
    updateOverviewStats();
}

function renderDoctorsTable() {
    const container = document.getElementById('doctorsTableContainer');
    if (allDoctors.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">👨‍⚕️</div><h3>No doctors added yet</h3><p>Click "Add Doctor" to add your first doctor.</p></div>';
        return;
    }
    let html = '<div class="table-container"><table class="table"><thead><tr><th>Doctor</th><th>Department</th><th>Room</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    allDoctors.forEach(doc => {
        const initials = doc.name.replace('Dr. ', '').split(' ').map(w => w[0]).join('');
        const statusBadge = doc.status === 'active'
            ? '<span class="badge badge-success"><span class="dot"></span> Active</span>'
            : '<span class="badge badge-danger">On Leave</span>';
        html += `<tr>
      <td><div class="flex items-center gap-md"><div class="doctor-avatar" style="width:36px;height:36px;font-size:0.8rem;">${initials}</div><strong>${doc.name}</strong></div></td>
      <td>${doc.department}</td>
      <td>${doc.room || '—'}</td>
      <td>${doc.capacity || '—'}</td>
      <td>${statusBadge}</td>
      <td><div class="flex gap-sm">
        <button class="btn btn-sm btn-secondary" onclick="openEditDoctor('${doc.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="handleDeleteDoctor('${doc.id}', '${doc.name}')">Delete</button>
      </div></td>
    </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function handleAddDoctor(e) {
    e.preventDefault();
    const slotsRaw = document.getElementById('docSlots').value;
    const slots = slotsRaw.split(',').map(s => s.trim()).filter(s => s);
    const data = {
        name: document.getElementById('docName').value.trim(),
        department: document.getElementById('docDepartment').value,
        room: document.getElementById('docRoom').value.trim(),
        capacity: parseInt(document.getElementById('docCapacity').value),
        slots: slots
    };
    addDoctor(data).then(() => {
        closeModal('addDoctorModal');
        document.getElementById('addDoctorForm').reset();
        showToast('success', 'Doctor Added', data.name + ' has been added successfully.');
    }).catch(err => {
        showToast('error', 'Error', 'Failed to add doctor: ' + err.message);
    });
}

function openEditDoctor(docId) {
    const doc = allDoctors.find(d => d.id === docId);
    if (!doc) return;
    document.getElementById('editDocId').value = docId;
    document.getElementById('editDocName').value = doc.name;
    document.getElementById('editDocDepartment').value = doc.department;
    document.getElementById('editDocRoom').value = doc.room || '';
    document.getElementById('editDocCapacity').value = doc.capacity || 15;
    document.getElementById('editDocSlots').value = (doc.slots || []).join(', ');
    document.getElementById('editDocStatus').value = doc.status || 'active';
    openModal('editDoctorModal');
}

function handleEditDoctor(e) {
    e.preventDefault();
    const docId = document.getElementById('editDocId').value;
    const slotsRaw = document.getElementById('editDocSlots').value;
    const slots = slotsRaw.split(',').map(s => s.trim()).filter(s => s);
    const data = {
        name: document.getElementById('editDocName').value.trim(),
        department: document.getElementById('editDocDepartment').value,
        room: document.getElementById('editDocRoom').value.trim(),
        capacity: parseInt(document.getElementById('editDocCapacity').value),
        slots: slots,
        status: document.getElementById('editDocStatus').value
    };
    updateDoctor(docId, data).then(() => {
        closeModal('editDoctorModal');
        showToast('success', 'Doctor Updated', data.name + ' has been updated.');
    }).catch(err => {
        showToast('error', 'Error', 'Failed to update: ' + err.message);
    });
}

function handleDeleteDoctor(docId, name) {
    if (!confirm('Are you sure you want to delete ' + name + '? This cannot be undone.')) return;
    deleteDoctor(docId).then(() => {
        showToast('warning', 'Doctor Removed', name + ' has been deleted.');
    }).catch(err => {
        showToast('error', 'Error', 'Failed to delete: ' + err.message);
    });
}

// ===== TOKENS =====
function onTokensUpdate(tokens) {
    allTokens = tokens;
    renderTokensTable();
    renderRecentTokens();
    updateOverviewStats();
}

function renderTokensTable() {
    const container = document.getElementById('tokensTableContainer');
    let filtered = allTokens;
    if (currentTokenFilter !== 'all') {
        filtered = allTokens.filter(t => t.status === currentTokenFilter);
    }

    // Update tab counts
    document.getElementById('tabAll').textContent = '(' + allTokens.length + ')';
    document.getElementById('tabWaiting').textContent = '(' + allTokens.filter(t => t.status === 'waiting').length + ')';
    document.getElementById('tabServing').textContent = '(' + allTokens.filter(t => t.status === 'serving').length + ')';
    document.getElementById('tabCompleted').textContent = '(' + allTokens.filter(t => t.status === 'completed').length + ')';
    document.getElementById('tabCancelled').textContent = '(' + allTokens.filter(t => t.status === 'cancelled').length + ')';

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎫</div><h3>No tokens found</h3><p>No tokens match the current filter.</p></div>';
        return;
    }

    let html = '<div class="table-container"><table class="table" id="tokensTable"><thead><tr><th>Token</th><th>Patient</th><th>Phone</th><th>Doctor</th><th>Dept</th><th>Time</th><th>Status</th></tr></thead><tbody>';
    filtered.sort((a, b) => b.bookedAt - a.bookedAt);
    filtered.forEach(t => {
        const statusMap = {
            'waiting': '<span class="badge badge-warning">Waiting</span>',
            'serving': '<span class="badge badge-success"><span class="dot"></span> Serving</span>',
            'completed': '<span class="badge badge-neutral">Completed</span>',
            'cancelled': '<span class="badge badge-danger">Cancelled</span>'
        };
        html += `<tr>
      <td><strong>${t.tokenNumber}</strong></td>
      <td>${t.patientName}</td>
      <td>${t.patientPhone}</td>
      <td>${t.doctorName || '—'}</td>
      <td>${t.department}</td>
      <td>${t.timeSlot}</td>
      <td>${statusMap[t.status] || t.status}</td>
    </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function filterTokensByStatus(status, btn) {
    currentTokenFilter = status;
    document.querySelectorAll('#tokenTabs .tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTokensTable();
}

function filterTokensTable() {
    const q = document.getElementById('tokenSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#tokensTable tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function renderRecentTokens() {
    const container = document.getElementById('recentTokensList');
    if (allTokens.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎫</div><h3>No tokens yet</h3><p>Tokens will appear here as patients book them.</p></div>';
        return;
    }
    const recent = [...allTokens].sort((a, b) => b.bookedAt - a.bookedAt).slice(0, 8);
    let html = '<div class="queue-list">';
    recent.forEach(t => {
        const icons = { waiting: '⏳', serving: '▶', completed: '✅', cancelled: '❌' };
        const badges = {
            waiting: '<span class="badge badge-warning">Waiting</span>',
            serving: '<span class="badge badge-success"><span class="dot"></span> Serving</span>',
            completed: '<span class="badge badge-neutral">Completed</span>',
            cancelled: '<span class="badge badge-danger">Cancelled</span>'
        };
        html += `<div class="queue-item">
      <div style="font-size:1.3rem;">${icons[t.status] || '🎫'}</div>
      <div class="token-info"><div class="token-patient">${t.tokenNumber} — ${t.patientName}</div><div class="token-time">${t.doctorName || ''} — ${t.department} — ${t.timeSlot}</div></div>
      ${badges[t.status] || ''}
    </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ===== LEAVE REQUESTS =====
function onLeaveUpdate(requests) {
    allLeaveRequests = requests;
    renderLeaveRequests();
    const pending = requests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('leaveCountBadge');
    if (pending > 0) { badge.textContent = pending; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
}

function renderLeaveRequests() {
    const container = document.getElementById('leaveRequestsList');
    if (allLeaveRequests.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>No leave requests</h3><p>Leave requests from doctors will appear here.</p></div>';
        return;
    }
    let html = '<div class="queue-list">';
    allLeaveRequests.forEach(r => {
        const typeBadge = r.type === 'emergency' ? '<span class="badge badge-danger">Emergency</span>' : '<span class="badge badge-info">Planned</span>';
        const statusColor = r.status === 'pending' ? 'var(--status-warning)' : r.status === 'approved' ? 'var(--status-success)' : 'var(--status-danger)';
        const initials = (r.doctorName || 'DR').replace('Dr. ', '').split(' ').map(w => w[0]).join('');
        let actions = '';
        if (r.status === 'pending') {
            actions = `<div class="flex gap-sm"><button class="btn btn-sm btn-success" onclick="handleApproveLeave('${r.id}', '${r.doctorId}')">✓ Approve</button><button class="btn btn-sm btn-danger" onclick="handleRejectLeave('${r.id}')">✕ Reject</button></div>`;
        } else {
            const sb = r.status === 'approved' ? '<span class="badge badge-success">Approved</span>' : '<span class="badge badge-danger">Rejected</span>';
            actions = sb;
        }
        html += `<div class="queue-item" style="border-left:4px solid ${statusColor};">
      <div class="doctor-avatar" style="width:42px;height:42px;font-size:0.85rem;">${initials}</div>
      <div class="token-info">
        <div class="token-patient">${r.doctorName || 'Doctor'} ${typeBadge}</div>
        <div class="token-time">Date: ${r.date} — Session: ${r.session || 'Full Day'}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">"${r.reason || ''}"</div>
      </div>
      ${actions}
    </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function handleApproveLeave(requestId, doctorId) {
    approveLeave(requestId, doctorId).then(() => {
        showToast('success', 'Leave Approved', 'Doctor status set to On Leave.');
    });
}

function handleRejectLeave(requestId) {
    rejectLeave(requestId).then(() => {
        showToast('warning', 'Leave Rejected', 'The leave request has been rejected.');
    });
}

// ===== DEPARTMENTS =====
function renderDepartments() {
    const grid = document.getElementById('departmentsGrid');
    const deptMap = {};
    allDoctors.forEach(doc => {
        if (!deptMap[doc.department]) deptMap[doc.department] = { doctors: 0, active: 0 };
        deptMap[doc.department].doctors++;
        if (doc.status === 'active') deptMap[doc.department].active++;
    });
    const deptEmojis = { 'General Medicine': '🩺', 'Cardiology': '❤️', 'Orthopedics': '🦴', 'Pediatrics': '👶', 'Dermatology': '🧴', 'ENT': '👂', 'Neurology': '🧠', 'Ophthalmology': '👁️' };
    const entries = Object.entries(deptMap);
    if (entries.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🏢</div><h3>No departments yet</h3><p>Add doctors to see department breakdown.</p></div>';
        return;
    }
    grid.innerHTML = entries.map(([dept, info]) => {
        const pct = info.doctors > 0 ? Math.round((info.active / info.doctors) * 100) : 0;
        return `<div class="card schedule-card">
      <div style="font-size:2rem;margin-bottom:var(--space-md);">${deptEmojis[dept] || '🏥'}</div>
      <h4>${dept}</h4>
      <p style="margin-top:var(--space-sm);">${info.doctors} Doctor${info.doctors > 1 ? 's' : ''} • ${info.active} Active</p>
      <div style="margin-top:var(--space-md);"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">${pct}% available</div></div>
    </div>`;
    }).join('');
}

// ===== OVERVIEW STATS =====
function updateOverviewStats() {
    document.getElementById('statTotalTokens').textContent = allTokens.length;
    document.getElementById('statActiveDoctors').textContent = allDoctors.filter(d => d.status === 'active').length;
    document.getElementById('statWaiting').textContent = allTokens.filter(t => t.status === 'waiting').length;
    document.getElementById('statCompleted').textContent = allTokens.filter(t => t.status === 'completed').length;
}

// ===== SETTINGS =====
function loadSettingsUI() {
    loadSettings(settings => {
        document.getElementById('settingClinicName').value = settings.clinicName || '';
        document.getElementById('settingCapacity').value = settings.defaultCapacity || 15;
        document.getElementById('settingAvgTime').value = settings.avgConsultation || 12;
        document.getElementById('settingAutoCancel').value = settings.autoCancel || 15;
    });
}

function handleSaveSettings() {
    const data = {
        clinicName: document.getElementById('settingClinicName').value,
        defaultCapacity: parseInt(document.getElementById('settingCapacity').value),
        avgConsultation: parseInt(document.getElementById('settingAvgTime').value),
        autoCancel: parseInt(document.getElementById('settingAutoCancel').value)
    };
    saveSettings(data).then(() => {
        showToast('success', 'Settings Saved', 'System settings updated successfully.');
    });
}
