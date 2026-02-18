// ===== PATIENT PORTAL LOGIC (Firebase-driven) =====

let cachedDoctors = [];

// ===== SECTION NAVIGATION =====
function showSection(section) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) event.target.closest('.sidebar-link').classList.add('active');
}

// ===== FETCH DOCTORS FROM FIREBASE =====
function fetchDoctorsForDept() {
    const dept = document.getElementById('department').value;
    const doctorSelect = document.getElementById('doctor');
    const slotSelect = document.getElementById('timeSlot');

    doctorSelect.innerHTML = '<option value="">Loading doctors...</option>';
    slotSelect.innerHTML = '<option value="">Select a doctor first</option>';

    if (!dept) {
        doctorSelect.innerHTML = '<option value="">Select a department first</option>';
        return;
    }

    getDoctorsByDepartment(dept, function (doctors) {
        cachedDoctors = doctors;
        doctorSelect.innerHTML = '<option value="">Select Doctor</option>';

        if (doctors.length === 0) {
            doctorSelect.innerHTML = '<option value="">No doctors available in this department</option>';
            return;
        }

        doctors.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            const slotCount = doc.slots ? doc.slots.length : 0;
            opt.textContent = doc.name + (slotCount > 0 ? ' (' + slotCount + ' slots)' : ' (No slots)');
            if (slotCount === 0) opt.disabled = true;
            doctorSelect.appendChild(opt);
        });
    });
}

function updateSlots() {
    const docId = document.getElementById('doctor').value;
    const slotSelect = document.getElementById('timeSlot');
    slotSelect.innerHTML = '<option value="">Select Time Slot</option>';

    if (!docId) return;

    const doc = cachedDoctors.find(d => d.id === docId);
    if (doc && doc.slots) {
        doc.slots.forEach(slot => {
            const opt = document.createElement('option');
            opt.value = slot;
            opt.textContent = slot;
            slotSelect.appendChild(opt);
        });
    }
}

// ===== BOOK TOKEN =====
function handleBooking(e) {
    e.preventDefault();

    const btn = document.getElementById('bookBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Checking...';

    const phone = document.getElementById('patientPhone').value.trim();
    const docId = document.getElementById('doctor').value;
    const dept = document.getElementById('department').value;
    const slot = document.getElementById('timeSlot').value;
    const today = new Date().toISOString().split('T')[0];
    const doc = cachedDoctors.find(d => d.id === docId);

    if (!doc) {
        showToast('error', 'Error', 'Please select a valid doctor.');
        btn.disabled = false;
        btn.textContent = '🎫 Book Token Now';
        return;
    }

    // Duplicate check: same phone + same doctor + same date
    checkDuplicateToken(phone, docId, today, function (isDuplicate) {
        if (isDuplicate) {
            showToast('error', 'Duplicate Booking!', 'You already have an active token with ' + doc.name + ' for today. Cannot book again.');
            btn.disabled = false;
            btn.textContent = '🎫 Book Token Now';
            return;
        }

        // Get next token number and book
        getNextTokenNumber(function (tokenNumber) {
            const tokenData = {
                tokenNumber: tokenNumber,
                patientName: document.getElementById('patientName').value.trim(),
                patientPhone: phone,
                patientEmail: document.getElementById('patientEmail').value.trim(),
                doctorId: docId,
                doctorName: doc.name,
                department: dept,
                timeSlot: slot,
                date: today,
                symptoms: document.getElementById('symptoms').value.trim()
            };

            bookToken(tokenData).then(function () {
                // Show success modal
                document.getElementById('bookedTokenNumber').textContent = tokenNumber;
                document.getElementById('bookedDoctorName').textContent = doc.name;
                document.getElementById('bookedTimeSlot').textContent = slot + ' — ' + dept;
                openModal('bookingSuccessModal');

                showToast('success', 'Token Booked!', 'Your token ' + tokenNumber + ' has been confirmed.');

                // Send notifications (email + WhatsApp)
                sendAllNotifications(tokenData);

                // Reset form
                document.getElementById('bookingForm').reset();
                btn.disabled = false;
                btn.textContent = '🎫 Book Token Now';
            }).catch(function (err) {
                showToast('error', 'Booking Failed', 'Could not book token: ' + err.message);
                btn.disabled = false;
                btn.textContent = '🎫 Book Token Now';
            });
        });
    });
}

// ===== MY TOKENS LOOKUP =====
function lookupMyTokens() {
    const phone = document.getElementById('lookupPhone').value.trim();
    if (!phone) {
        showToast('warning', 'Enter Phone', 'Please enter your phone number to search.');
        return;
    }

    const container = document.getElementById('myTokensList');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto var(--space-md);"></div><h3>Searching...</h3></div>';

    listenPatientTokens(phone, function (tokens) {
        if (tokens.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No tokens found</h3><p>No bookings found for this phone number.</p></div>';
            return;
        }

        let html = '<div class="queue-list">';
        tokens.forEach(t => {
            const icons = { waiting: '⏳', serving: '▶', completed: '✅', cancelled: '❌' };
            const badges = {
                waiting: '<span class="badge badge-warning">Waiting</span>',
                serving: '<span class="badge badge-success"><span class="dot"></span> Serving</span>',
                completed: '<span class="badge badge-neutral">Completed</span>',
                cancelled: '<span class="badge badge-danger">Cancelled</span>'
            };
            const actions = t.status === 'waiting'
                ? '<button class="btn btn-sm btn-danger" onclick="cancelMyToken(\'' + t.id + '\', \'' + t.tokenNumber + '\')">Cancel</button>'
                : '';
            html += '<div class="queue-item">'
                + '<div style="font-size:1.4rem;">' + (icons[t.status] || '🎫') + '</div>'
                + '<div class="token-info">'
                + '<div class="token-patient">' + t.tokenNumber + ' — ' + t.doctorName + '</div>'
                + '<div class="token-time">' + t.department + ' — ' + t.timeSlot + ' — ' + t.date + '</div>'
                + '</div>'
                + (badges[t.status] || '')
                + actions
                + '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    });
}

function cancelMyToken(tokenId, tokenNumber) {
    if (!confirm('Cancel token ' + tokenNumber + '? This cannot be undone.')) return;
    updateTokenStatus(tokenId, 'cancelled').then(function () {
        showToast('warning', 'Token Cancelled', tokenNumber + ' has been cancelled.');
    });
}

// ===== VIEW DOCTORS =====
document.addEventListener('DOMContentLoaded', function () {
    listenDoctors(function (doctors) {
        renderDoctorCards(doctors);
    });
});

function renderDoctorCards(doctors) {
    const grid = document.getElementById('doctorsGrid');
    if (!doctors || doctors.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">👨‍⚕️</div><h3>No doctors available</h3><p>Doctors will appear here once added by the admin.</p></div>';
        return;
    }

    grid.innerHTML = '';
    doctors.forEach(doc => {
        const initials = doc.name.replace('Dr. ', '').split(' ').map(w => w[0]).join('');
        const isOnLeave = doc.status === 'on-leave';
        const card = document.createElement('div');
        card.className = 'card schedule-card';
        card.setAttribute('data-name', doc.name.toLowerCase());
        card.setAttribute('data-dept', (doc.department || '').toLowerCase());

        let slotsHtml = '';
        if (isOnLeave) {
            slotsHtml = '<span class="badge badge-danger" style="margin-top:var(--space-md);">On Leave Today</span>';
        } else if (doc.slots && doc.slots.length > 0) {
            slotsHtml = '<div class="schedule-slots" style="margin-top:var(--space-md);">'
                + doc.slots.slice(0, 4).map(s => '<div class="schedule-slot"><span class="slot-time">' + s + '</span><span class="slot-capacity">Available</span></div>').join('')
                + (doc.slots.length > 4 ? '<div style="font-size:0.82rem;color:var(--text-muted);text-align:center;margin-top:4px;">+' + (doc.slots.length - 4) + ' more slots</div>' : '')
                + '</div>';
        } else {
            slotsHtml = '<p style="color:var(--text-muted);margin-top:var(--space-md);font-size:0.88rem;">No slots configured</p>';
        }

        card.innerHTML = '<div class="doctor-info">'
            + '<div class="doctor-avatar">' + initials + '</div>'
            + '<div><div class="doctor-name">' + doc.name + '</div>'
            + '<div class="doctor-specialty">' + (doc.department || '') + ' — Room ' + (doc.room || '—') + '</div></div>'
            + '</div>' + slotsHtml;

        grid.appendChild(card);
    });
}

function filterDoctorCards() {
    const q = document.getElementById('doctorSearch').value.toLowerCase();
    document.querySelectorAll('#doctorsGrid .schedule-card').forEach(card => {
        const name = card.getAttribute('data-name') || '';
        const dept = card.getAttribute('data-dept') || '';
        card.style.display = (name.includes(q) || dept.includes(q)) ? '' : 'none';
    });
}
