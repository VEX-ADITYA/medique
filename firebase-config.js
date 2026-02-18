// ===== FIREBASE CONFIGURATION =====
// 🔴 REPLACE THESE WITH YOUR FIREBASE PROJECT CONFIG
// Go to: https://console.firebase.google.com → Your Project → Project Settings → Web App → Config

const firebaseConfig = {
    apiKey: "AIzaSyD7Kb1XcFTAD1jeLrQzPq_7IR8gAr4L_5k",
    authDomain: "mediqueue-80838.firebaseapp.com",
    databaseURL: "https://mediqueue-80838-default-rtdb.firebaseio.com",
    projectId: "mediqueue-80838",
    storageBucket: "mediqueue-80838.firebasestorage.app",
    messagingSenderId: "803363516762",
    appId: "1:803363516762:web:301c327509c745d13f0363"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== DATABASE HELPER FUNCTIONS =====

// --- DOCTORS ---
function addDoctor(doctorData) {
    const newRef = db.ref('doctors').push();
    doctorData.createdAt = Date.now();
    doctorData.status = 'active';
    return newRef.set(doctorData).then(() => newRef.key);
}

function updateDoctor(doctorId, data) {
    return db.ref('doctors/' + doctorId).update(data);
}

function deleteDoctor(doctorId) {
    return db.ref('doctors/' + doctorId).remove();
}

function listenDoctors(callback) {
    db.ref('doctors').on('value', snapshot => {
        const doctors = [];
        snapshot.forEach(child => {
            doctors.push({ id: child.key, ...child.val() });
        });
        callback(doctors);
    });
}

function getDoctorsByDepartment(department, callback) {
    db.ref('doctors').orderByChild('department').equalTo(department).on('value', snapshot => {
        const doctors = [];
        snapshot.forEach(child => {
            const doc = { id: child.key, ...child.val() };
            if (doc.status === 'active') doctors.push(doc);
        });
        callback(doctors);
    });
}

// --- TOKENS ---
function getNextTokenNumber(callback) {
    const today = new Date().toISOString().split('T')[0];
    db.ref('tokens').orderByChild('date').equalTo(today).once('value', snapshot => {
        const count = snapshot.numChildren();
        callback('T-' + String(count + 1).padStart(3, '0'));
    });
}

function checkDuplicateToken(phone, doctorId, date, callback) {
    db.ref('tokens').orderByChild('date').equalTo(date).once('value', snapshot => {
        let isDuplicate = false;
        snapshot.forEach(child => {
            const token = child.val();
            if (token.patientPhone === phone && token.doctorId === doctorId && token.status !== 'cancelled') {
                isDuplicate = true;
            }
        });
        callback(isDuplicate);
    });
}

function bookToken(tokenData) {
    const newRef = db.ref('tokens').push();
    tokenData.bookedAt = Date.now();
    tokenData.status = 'waiting';
    return newRef.set(tokenData).then(() => newRef.key);
}

function updateTokenStatus(tokenId, status) {
    return db.ref('tokens/' + tokenId).update({ status: status });
}

function listenTodayTokens(callback) {
    const today = new Date().toISOString().split('T')[0];
    db.ref('tokens').orderByChild('date').equalTo(today).on('value', snapshot => {
        const tokens = [];
        snapshot.forEach(child => {
            tokens.push({ id: child.key, ...child.val() });
        });
        callback(tokens);
    });
}

function listenDoctorTokens(doctorId, callback) {
    const today = new Date().toISOString().split('T')[0];
    db.ref('tokens').orderByChild('date').equalTo(today).on('value', snapshot => {
        const tokens = [];
        snapshot.forEach(child => {
            const token = { id: child.key, ...child.val() };
            if (token.doctorId === doctorId) tokens.push(token);
        });
        callback(tokens);
    });
}

function listenPatientTokens(phone, callback) {
    db.ref('tokens').orderByChild('patientPhone').equalTo(phone).on('value', snapshot => {
        const tokens = [];
        snapshot.forEach(child => {
            tokens.push({ id: child.key, ...child.val() });
        });
        tokens.sort((a, b) => b.bookedAt - a.bookedAt);
        callback(tokens);
    });
}

// --- LEAVE REQUESTS ---
function submitLeaveRequest(leaveData) {
    const newRef = db.ref('leaveRequests').push();
    leaveData.status = 'pending';
    leaveData.createdAt = Date.now();
    return newRef.set(leaveData).then(() => newRef.key);
}

function listenLeaveRequests(callback) {
    db.ref('leaveRequests').on('value', snapshot => {
        const requests = [];
        snapshot.forEach(child => {
            requests.push({ id: child.key, ...child.val() });
        });
        requests.sort((a, b) => b.createdAt - a.createdAt);
        callback(requests);
    });
}

function approveLeave(requestId, doctorId) {
    return Promise.all([
        db.ref('leaveRequests/' + requestId).update({ status: 'approved' }),
        db.ref('doctors/' + doctorId).update({ status: 'on-leave' })
    ]);
}

function rejectLeave(requestId) {
    return db.ref('leaveRequests/' + requestId).update({ status: 'rejected' });
}

// --- SETTINGS ---
function loadSettings(callback) {
    db.ref('settings').once('value', snapshot => {
        callback(snapshot.val() || {
            clinicName: 'City Hospital OPD',
            avgConsultation: 12,
            autoCancel: 15,
            defaultCapacity: 15
        });
    });
}

function saveSettings(data) {
    return db.ref('settings').set(data);
}
