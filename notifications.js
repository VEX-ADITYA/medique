// ===== NOTIFICATION HELPERS =====

// --- EMAIL via EmailJS ---
// 🔴 SETUP REQUIRED:
// 1. Go to https://www.emailjs.com/ and create free account
// 2. Create email service (Gmail, Outlook, etc.)
// 3. Create email template with variables: {{to_name}}, {{to_email}}, {{token_number}}, {{doctor_name}}, {{department}}, {{time_slot}}, {{date}}
// 4. Replace the IDs below

const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';

function sendEmailNotification(tokenData) {
    if (typeof emailjs === 'undefined') {
        console.warn('EmailJS not loaded. Skipping email.');
        return Promise.resolve();
    }

    const templateParams = {
        to_name: tokenData.patientName,
        to_email: tokenData.patientEmail,
        token_number: tokenData.tokenNumber,
        doctor_name: tokenData.doctorName,
        department: tokenData.department,
        time_slot: tokenData.timeSlot,
        date: tokenData.date,
        message: `Your token ${tokenData.tokenNumber} is confirmed with ${tokenData.doctorName} (${tokenData.department}) at ${tokenData.timeSlot} on ${tokenData.date}. Please arrive 10 minutes early.`
    };

    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY)
        .then(() => {
            console.log('Email sent successfully');
            showToast('success', 'Email Sent', `Confirmation email sent to ${tokenData.patientEmail}`);
        })
        .catch(err => {
            console.error('Email failed:', err);
            showToast('error', 'Email Failed', 'Could not send confirmation email.');
        });
}

// --- WHATSAPP via wa.me ---
function sendWhatsAppNotification(tokenData) {
    const phone = tokenData.patientPhone.replace(/[^0-9]/g, '');
    // Add country code if not present
    const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone;

    const message = encodeURIComponent(
        `🏥 *MediQueue - Token Confirmation*\n\n` +
        `✅ Your token has been booked successfully!\n\n` +
        `🎫 Token: *${tokenData.tokenNumber}*\n` +
        `👨‍⚕️ Doctor: *${tokenData.doctorName}*\n` +
        `🏢 Department: *${tokenData.department}*\n` +
        `🕐 Time: *${tokenData.timeSlot}*\n` +
        `📅 Date: *${tokenData.date}*\n\n` +
        `Please arrive 10 minutes before your slot.\n` +
        `Track your queue live at our display board.\n\n` +
        `— City Hospital OPD`
    );

    const waUrl = `https://wa.me/${phoneWithCode}?text=${message}`;
    window.open(waUrl, '_blank');

    showToast('info', 'WhatsApp', 'WhatsApp message window opened. Please send to confirm.');
}

// --- SEND ALL NOTIFICATIONS ---
function sendAllNotifications(tokenData) {
    // Send email
    sendEmailNotification(tokenData);

    // Send WhatsApp (slight delay so email toast shows first)
    setTimeout(() => {
        sendWhatsAppNotification(tokenData);
    }, 1000);
}

// --- CANCELLATION NOTIFICATION ---
function sendCancellationWhatsApp(tokenData, reason) {
    const phone = tokenData.patientPhone.replace(/[^0-9]/g, '');
    const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone;

    const message = encodeURIComponent(
        `🏥 *MediQueue - Appointment Update*\n\n` +
        `❌ Your token *${tokenData.tokenNumber}* has been cancelled.\n\n` +
        `👨‍⚕️ Doctor: *${tokenData.doctorName || 'N/A'}*\n` +
        `📅 Date: *${tokenData.date}*\n` +
        `📝 Reason: ${reason}\n\n` +
        `Please rebook your appointment.\n\n` +
        `— City Hospital OPD`
    );

    const waUrl = `https://wa.me/${phoneWithCode}?text=${message}`;
    window.open(waUrl, '_blank');
}
