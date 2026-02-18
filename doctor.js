// ===== DOCTOR PORTAL LOGIC (Firebase-driven) =====

let selectedDoctorId = null;
let selectedDoctorData = null;
let doctorTokens = [];
let currentServingId = null;

// ===== SECTION NAVIGATION =====
function showDoctorSection(section) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) event.target.closest('.sidebar-link').classList.add('active');

    // Show placeholder if no doctor selected
    if (!selectedDoctorId && section !== 'no-doctor') {
        showToast('warning', 'Select Profile', 'Please select your doctor profile from the sidebar.');
    }
}

// ===== LOAD DOCTOR LIST INTO SELECTOR =====
document.addEventListener('DOMContentLoaded', function () {
    listenDoctors(function (doctors) {
        const selector = document.getElementById('doctorSelector');
        selector.innerHTML = '<option value="">Choose your profile...</option>';
        doctors.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.name + ' — ' + doc.department;
            selector.appendChild(opt);
        });
    });
});

// ===== SELECT DOCTOR PROFILE =====
function selectDoctor() {
    const docId = document.getElementById('doctorSelector').value;
    if (!docId) return;

    selectedDoctorId = docId;

    // Fetch doctor data
    db.ref('doctors/' + docId).once('value', function (snap) {
        selectedDoctorData = snap.val();
        if (!selectedDoctorData) return;

        // Update sidebar profile
        const initials = selectedDoctorData.name.replace('Dr. ', '').split(' ').map(w => w[0]).join('');
        document.getElementById('docAvatar').textContent = initials;
        document.getElementById('docPortalName').textContent = selectedDoctorData.name;
        document.getElementById('docPortalDept').textContent = selectedDoctorData.department + ' — Room ' + (selectedDoctorData.room || '—');

        // Show queue section
        document.getElementById('section-no-doctor').classList.add('hidden');
        document.getElementById('section-queue').classList.remove('hidden');

        // Load schedule
        renderSchedule();

        // Listen to my tokens
        listenDoctorTokens(docId, onDoctorTokensUpdate);

        // Load my leave requests
        loadMyLeaveRequests();

        showToast('success', 'Profile Loaded', 'Welcome, ' + selectedDoctorData.name);
    });
}

// ===== QUEUE MANAGEMENT =====
function onDoctorTokensUpdate(tokens) {
    doctorTokens = tokens;
    renderQueue();
    updateQueueStats();
}

function renderQueue() {
    const container = document.getElementById('queueList');
    const waiting = doctorTokens.filter(t => t.status === 'waiting');
    const serving = doctorTokens.filter(t => t.status === 'serving');
    const completed = doctorTokens.filter(t => t.status === 'completed');

    currentServingId = serving.length > 0 ? serving[0].id : null;
    document.getElementById('completeBtn').disabled = !currentServingId;

    if (doctorTokens.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No patients yet</h3><p>Tokens will appear as patients book with you.</p></div>';
        return;
    }

    let html = '';

    // Currently serving
    if (serving.length > 0) {
        const s = serving[0];
        html += '<div class="card" style="border-left:4px solid var(--status-success);margin-bottom:var(--space-md);">'
            + '<div class="flex items-center gap-md"><div style="font-size:1.5rem;">🟢</div>'
            + '<div class="flex-1"><div style="font-weight:700;font-size:1.1rem;color:var(--status-success);">NOW SERVING</div>'
            + '<div style="font-size:1.3rem;font-weight:800;margin-top:4px;">' + s.tokenNumber + ' — ' + s.patientName + '</div>'
            + '<div style="color:var(--text-muted);margin-top:2px;">' + s.timeSlot + (s.symptoms ? ' — ' + s.symptoms : '') + '</div></div></div></div>';
    }

    // Waiting
    if (waiting.length > 0) {
        html += '<h4 style="margin:var(--space-md) 0 var(--space-sm);">⏳ Waiting (' + waiting.length + ')</h4><div class="queue-list">';
        waiting.forEach((t, i) => {
            html += '<div class="queue-item"><div style="font-size:1.1rem;font-weight:700;color:var(--text-muted);width:28px;">' + (i + 1) + '</div>'
                + '<div class="token-info"><div class="token-patient">' + t.tokenNumber + ' — ' + t.patientName + '</div>'
                + '<div class="token-time">' + t.timeSlot + (t.symptoms ? ' — ' + t.symptoms : '') + '</div></div>'
                + '<span class="badge badge-warning">Waiting</span>'
                + '<button class="btn btn-sm btn-danger" onclick="skipToken(\'' + t.id + '\', \'' + t.tokenNumber + '\')">Skip</button></div>';
        });
        html += '</div>';
    }

    // Completed
    if (completed.length > 0) {
        html += '<h4 style="margin:var(--space-lg) 0 var(--space-sm);">✅ Completed (' + completed.length + ')</h4><div class="queue-list">';
        completed.forEach(t => {
            html += '<div class="queue-item" style="opacity:0.6;"><div style="font-size:1.1rem;">✅</div>'
                + '<div class="token-info"><div class="token-patient">' + t.tokenNumber + ' — ' + t.patientName + '</div>'
                + '<div class="token-time">' + t.timeSlot + '</div></div>'
                + '<span class="badge badge-neutral">Done</span></div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function updateQueueStats() {
    const serving = doctorTokens.filter(t => t.status === 'serving');
    const waiting = doctorTokens.filter(t => t.status === 'waiting');
    const completed = doctorTokens.filter(t => t.status === 'completed');
    document.getElementById('qStatServing').textContent = serving.length > 0 ? serving[0].tokenNumber : '—';
    document.getElementById('qStatWaiting').textContent = waiting.length;
    document.getElementById('qStatCompleted').textContent = completed.length;
    document.getElementById('qStatTotal').textContent = doctorTokens.length;
}

// ===== CONTROL ACTIONS =====
function callNextPatient() {
    const waiting = doctorTokens.filter(t => t.status === 'waiting');
    if (waiting.length === 0) {
        showToast('info', 'No Patients', 'No more patients in the waiting queue.');
        return;
    }

    // If someone is currently serving, complete them first
    if (currentServingId) {
        updateTokenStatus(currentServingId, 'completed');
    }

    // Set first waiting to serving
    const next = waiting[0];
    updateTokenStatus(next.id, 'serving').then(function () {
        showToast('info', 'Calling Patient', next.patientName + ' (' + next.tokenNumber + ') is being called.');
    });
}

function completeCurrent() {
    if (!currentServingId) return;
    updateTokenStatus(currentServingId, 'completed').then(function () {
        showToast('success', 'Completed', 'Consultation marked as completed.');
    });
}

function skipToken(tokenId, tokenNumber) {
    if (!confirm('Skip ' + tokenNumber + '? Token will be cancelled.')) return;
    updateTokenStatus(tokenId, 'cancelled').then(function () {
        showToast('warning', 'Skipped', tokenNumber + ' has been skipped.');
    });
}

// ===== SCHEDULE =====
function renderSchedule() {
    const container = document.getElementById('scheduleInfo');
    if (!selectedDoctorData) return;

    const slots = selectedDoctorData.slots || [];
    let html = '<div class="card card-flat"><h4 style="margin-bottom:var(--space-md);">' + selectedDoctorData.name + ' — Time Slots</h4>'
        + '<p style="color:var(--text-muted);margin-bottom:var(--space-md);">Room ' + (selectedDoctorData.room || '—') + ' — Capacity: ' + (selectedDoctorData.capacity || '—') + ' patients/day</p>';

    if (slots.length === 0) {
        html += '<p style="color:var(--text-muted);">No slots configured. Contact admin to set up your schedule.</p>';
    } else {
        html += '<div class="schedule-slots">';
        slots.forEach(s => {
            html += '<div class="schedule-slot"><span class="slot-time">' + s + '</span><span class="slot-capacity">Available</span></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ===== LEAVE =====
function handleLeaveSubmit(e) {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDoctorData) {
        showToast('error', 'Select Profile', 'Please select your doctor profile first.');
        return;
    }

    const leaveData = {
        doctorId: selectedDoctorId,
        doctorName: selectedDoctorData.name,
        date: document.getElementById('leaveDate').value,
        type: document.getElementById('leaveType').value,
        session: document.getElementById('leaveSession').value,
        reason: document.getElementById('leaveReason').value.trim()
    };

    submitLeaveRequest(leaveData).then(function () {
        showToast('success', 'Leave Submitted', 'Your leave request has been submitted for admin approval.');
        document.getElementById('leaveForm').reset();
    }).catch(function (err) {
        showToast('error', 'Error', 'Failed to submit: ' + err.message);
    });
}

function loadMyLeaveRequests() {
    if (!selectedDoctorId) return;
    listenLeaveRequests(function (requests) {
        const myRequests = requests.filter(r => r.doctorId === selectedDoctorId);
        const container = document.getElementById('myLeaveRequests');

        if (myRequests.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>No leave requests yet</h3></div>';
            return;
        }

        let html = '<div class="queue-list">';
        myRequests.forEach(r => {
            const statusBadge = r.status === 'pending'
                ? '<span class="badge badge-warning">Pending</span>'
                : r.status === 'approved'
                    ? '<span class="badge badge-success">Approved</span>'
                    : '<span class="badge badge-danger">Rejected</span>';
            html += '<div class="queue-item">'
                + '<div style="font-size:1.2rem;">📅</div>'
                + '<div class="token-info"><div class="token-patient">' + r.date + ' — ' + (r.session || 'Full Day') + '</div>'
                + '<div class="token-time">' + (r.type === 'emergency' ? '🚨 Emergency' : '📋 Planned') + ' — ' + (r.reason || '') + '</div></div>'
                + statusBadge + '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    });
}
