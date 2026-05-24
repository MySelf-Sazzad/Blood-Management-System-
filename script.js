// Ami Donor - Blood Donation Management System

// ========== Data Variables ==========
var initialDonors = [];
var donors = [];
var displayedDonors = [];
var currentFilter = 'all';
var emergencyAlerts = [];
var notifications = [];
var _isSearching = false;

var defaultBloodBanks = [
    { id: 'bb1', name: 'Dhaka City Hospital Blood Bank', address: 'Dhaka, Bangladesh', phone: '+8801733278988' },
    { id: 'bb2', name: 'Square Hospital Blood Bank', address: 'Panthapath, Dhaka', phone: '+8801987654321' },
    { id: 'bb3', name: 'United Hospital Blood Bank', address: 'Gulshan, Dhaka', phone: '+8801555444333' },
    { id: 'bb4', name: 'Labaid Hospital Blood Bank', address: 'Dhanmondi, Dhaka', phone: '+8801888777666' },
    { id: 'bb5', name: 'Bangabandhu Sheikh Mujib Medical University', address: 'Shahbag, Dhaka', phone: '+8801777666555' },
    { id: 'bb6', name: 'Chittagong Medical College Hospital', address: 'Chittagong, Bangladesh', phone: '+8801666555444' },
    { id: 'bb7', name: 'Rajshahi Medical College Hospital', address: 'Rajshahi, Bangladesh', phone: '+8801555444333' },
    { id: 'bb8', name: 'Khulna Medical College Hospital', address: 'Khulna, Bangladesh', phone: '+8801444333222' },
    { id: 'bb9', name: 'Sylhet MAG Osmani Medical College', address: 'Sylhet, Bangladesh', phone: '+8801333222111' }
];

var bloodBanks = [];
var emergencyCountdownInterval = null;

// ========== Backend API Base URL ==========
const API = window.location.origin + '/api';

// ========== Helper to map Backend data to Frontend format ==========
function normalizeDonor(d) {
    return {
        id: d.id,
        userId: d.user_id,
        name: d.name,
        phone: d.phone,
        bloodGroup: d.blood_group,
        location: d.location,
        lastDonation: d.last_donation,
        registrationDate: d.registration_date,
        isActive: d.is_active === true || d.is_active === 1,
        cooldownUntil: d.cooldown_until,
        isBanned: d.is_banned === true || d.is_banned === 1,
    };
}

// ========== LocalStorage Functions (Updated for MySQL) ==========
async function loadData() {
    try {
        var donorRes = await fetch(API + '/donors/all');
        var donorData = await donorRes.json();
        if (donorData.success) {
            donors = donorData.donors.map(normalizeDonor);
        } else {
            donors = [];
        }
    } catch (e) {
        console.log("Backend not connected, working offline if possible.");
        var stored = localStorage.getItem('amidonor_donors');
        if (stored) {
            donors = JSON.parse(stored);
            donors = donors.filter(function(d) { return d.userId; });
        } else { donors = []; }
    }

    try {
        var reqRes = await fetch(API + '/emergency-requests');
        var reqData = await reqRes.json();
        emergencyAlerts = reqData.requests || [];
        emergencyAlerts.forEach(function(alert) {
            if (!alert.id) alert.id = Date.now() + Math.random();
            if (!alert.createdAt) alert.createdAt = alert.created_at;
        });
    } catch (e) {
        var storedRequests = localStorage.getItem('amidonor_requests');
        emergencyAlerts = storedRequests ? JSON.parse(storedRequests) : [];
    }

    try {
        var bankRes = await fetch(API + '/blood-banks');
        var bankData = await bankRes.json();
        bloodBanks = bankData.bloodBanks || [];
    } catch (e) {
        var storedBanks = localStorage.getItem('amidonor_bloodbanks');
        bloodBanks = storedBanks ? JSON.parse(storedBanks) : JSON.parse(JSON.stringify(defaultBloodBanks));
    }

    loadNotifications();
}

function saveData() {}
function saveRequests() {}
function saveBloodBanks() {}

// ========== Notification System ==========
function loadNotifications() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) { notifications = []; return; }
    var stored = localStorage.getItem('amidonor_notifications_' + currentUser.email);
    if (stored) { notifications = JSON.parse(stored); } else { notifications = []; saveNotifications(); }
}
function saveNotifications() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;
    localStorage.setItem('amidonor_notifications_' + currentUser.email, JSON.stringify(notifications));
}
function createNotification(bloodGroup, hospital, location, phone) {
    var notification = { id: Date.now(), type: 'blood_request', bloodGroup: bloodGroup, hospital: hospital, location: location, phone: phone, message: 'Urgent need for ' + bloodGroup + ' blood at ' + hospital + ', ' + location, timestamp: new Date().toISOString(), read: false };
    notifications.unshift(notification); saveNotifications(); updateNotificationBadge(); renderNotifications(); showNotificationToast(bloodGroup, hospital);
}
function showNotificationToast(bloodGroup, hospital) {
    var toast = document.createElement('div'); toast.className = 'notification-toast';
    toast.innerHTML = '<div class="flex items-start gap-3"><div class="bg-red-100 p-2 rounded-full flex-shrink-0"><i data-lucide="droplet" class="w-5 h-5 text-red-600"></i></div><div class="flex-1"><p class="font-bold text-gray-900 text-sm">Blood Request: ' + bloodGroup + '</p><p class="text-gray-600 text-xs mt-1">' + hospital + '</p></div><button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600 flex-shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button></div>';
    document.body.appendChild(toast); lucide.createIcons();
    setTimeout(function() { toast.classList.add('show'); }, 100);
    setTimeout(function() { toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 500); }, 5000);
}
function sendNotificationsToDonors(bloodGroup, hospital, location, phone) {
    var matchingDonors = donors.filter(function(donor) { return isDonorAvailable(donor) && donor.bloodGroup === bloodGroup; });
    if (matchingDonors.length === 0) return;
    matchingDonors.forEach(function(donor) {
        var donorNotifications = JSON.parse(localStorage.getItem('amidonor_notifications_' + donor.userId)) || [];
        var notification = { id: Date.now() + Math.random(), type: 'blood_request', bloodGroup: bloodGroup, hospital: hospital, location: location, phone: phone, message: 'Urgent need for ' + bloodGroup + ' blood at ' + hospital + ', ' + location, timestamp: new Date().toISOString(), read: false };
        donorNotifications.unshift(notification);
        localStorage.setItem('amidonor_notifications_' + donor.userId, JSON.stringify(donorNotifications));
    });
}
function toggleNotificationDropdown(event) {
    if (event) event.stopPropagation();
    var dropdown = document.getElementById('notificationDropdown');
    var dropdownMobile = document.getElementById('notificationDropdownMobile');
    dropdown.classList.toggle('hidden'); dropdownMobile.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden') || !dropdownMobile.classList.contains('hidden')) { renderNotifications(); }
}
function renderNotifications() {
    var containerDesktop = document.getElementById('notificationListDesktop');
    var containerMobile = document.getElementById('notificationListMobile');
    if (!containerDesktop || !containerMobile) return;
    if (notifications.length === 0) {
        var emptyHTML = '<div class="p-6 text-center text-gray-500"><i data-lucide="bell-off" class="w-10 h-10 mx-auto mb-2 text-gray-300"></i><p class="text-sm">No notifications yet</p></div>'; containerDesktop.innerHTML = emptyHTML; containerMobile.innerHTML = emptyHTML; lucide.createIcons(); return;
    }
    var html = notifications.map(function(notif) {
        var timeAgo = getTimeAgo(notif.timestamp);
        var bgClass = notif.read ? 'bg-white' : 'bg-red-50';
        var borderClass = notif.read ? '' : 'border-l-4 border-red-500';
        return '<div class="' + bgClass + ' p-4 hover:bg-gray-50 transition cursor-pointer ' + borderClass + '" onclick="markNotificationRead(' + notif.id + ')"><div class="flex items-start gap-3"><div class="bg-red-100 p-2 rounded-full flex-shrink-0"><i data-lucide="droplet" class="w-4 h-4 text-red-600"></i></div><div class="flex-1 min-w-0"><p class="font-semibold text-gray-900 text-sm">' + notif.message + '</p><p class="text-gray-500 text-xs mt-1">' + timeAgo + '</p><div class="flex items-center gap-2 mt-2"><span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">' + notif.bloodGroup + '</span><a href="tel:' + notif.phone + '" class="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i>Call Now</a></div></div><button onclick="event.stopPropagation(); deleteNotification(' + notif.id + ')" class="text-gray-400 hover:text-red-600 flex-shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button></div></div>';
    }).join(''); containerDesktop.innerHTML = html; containerMobile.innerHTML = html; lucide.createIcons();
}
function markNotificationRead(notifId) {
    var notif = notifications.find(function(n) { return n.id === notifId; }); if (notif) { notif.read = true; saveNotifications(); updateNotificationBadge(); renderNotifications(); }
}
function markAllNotificationsRead() { notifications.forEach(function(n) { n.read = true; }); saveNotifications(); updateNotificationBadge(); renderNotifications(); }
function deleteNotification(notifId) { notifications = notifications.filter(function(n) { return n.id !== notifId; }); saveNotifications(); updateNotificationBadge(); renderNotifications(); }
function updateNotificationBadge() {
    var unreadCount = notifications.filter(function(n) { return !n.read; }).length;
    var badgeDesktop = document.getElementById('notifBadgeDesktop');
    var badgeMobile = document.getElementById('notifBadgeMobile');
    if (unreadCount > 0) { badgeDesktop.classList.remove('hidden'); badgeDesktop.classList.add('flex'); badgeDesktop.textContent = unreadCount > 9 ? '9+' : unreadCount; badgeMobile.classList.remove('hidden'); badgeMobile.classList.add('flex'); badgeMobile.textContent = unreadCount > 9 ? '9+' : unreadCount; }
    else { badgeDesktop.classList.add('hidden'); badgeDesktop.classList.remove('flex'); badgeMobile.classList.add('hidden'); badgeMobile.classList.remove('flex'); }
}
function getTimeAgo(timestamp) {
    var now = new Date();
    var past = new Date(timestamp);
    var diffMs = now - past;
    var diffSecs = Math.floor(diffMs / 1000);
    var diffMins = Math.floor(diffSecs / 60);
    var diffHours = Math.floor(diffMins / 60);
    var diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60) return 'Just now'; if (diffMins < 60) return diffMins + ' min ago'; if (diffHours < 24) return diffHours + ' hours ago'; if (diffDays === 1) return 'Yesterday'; return diffDays + ' days ago';
}

// ========== Donor Availability ==========
function isDonorAvailable(donor) { if (donor.isActive === false) return false; if (donor.cooldownUntil && new Date(donor.cooldownUntil) > new Date()) return false; return true; }
function isDonorBanned(donor) { return donor.isBanned === true; }
function getCooldownDaysLeft(donor) { if (!donor.cooldownUntil) return 0;
    var diff = new Date(donor.cooldownUntil) - new Date(); return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))); }
function formatDate(dateString) { if (!dateString) return "Never donated"; return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }

function isCurrentUserDonor() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser')); if (!currentUser) return false; return donors.some(function(d) { return d.userId === currentUser.id; });
}
function toggleDonorButtons() {
    var registered = isCurrentUserDonor();
    var heroBtn = document.getElementById('heroRegisterBtn');
    var aboutBtn = document.getElementById('aboutBecomeDonorBtn'); if (heroBtn) heroBtn.style.display = registered ? 'none' : ''; if (aboutBtn) aboutBtn.style.display = registered ? 'none' : '';
}

// ========== Banned & Removed ==========
function getBannedEmails() {
    var stored = localStorage.getItem('amidonor_banned_emails'); return stored ? JSON.parse(stored) : [];
}
function saveBannedEmails(list) { localStorage.setItem('amidonor_banned_emails', JSON.stringify(list)); }
function isEmailBanned(email) { return getBannedEmails().indexOf(email) !== -1; }
function getRemovedDonors() {
    var stored = localStorage.getItem('amidonor_removed_donors'); return stored ? JSON.parse(stored) : [];
}
function saveRemovedDonors(list) { localStorage.setItem('amidonor_removed_donors', JSON.stringify(list)); }
function isDonorRemoved(email) {
    var removedList = getRemovedDonors();
    var found = removedList.find(function(r) { return r.email === email; }); if (!found) return false;
    var removedDate = new Date(found.removedAt);
    var threeMonthsLater = new Date(removedDate); threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3); return new Date() < threeMonthsLater;
}
function getRemovedDaysLeft(email) {
    var removedList = getRemovedDonors();
    var found = removedList.find(function(r) { return r.email === email; }); if (!found) return 0;
    var removedDate = new Date(found.removedAt); var threeMonthsLater = new Date(removedDate); threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    var diff = threeMonthsLater - new Date(); return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ========== Navigation ==========
function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(function(section) { section.classList.add('hidden'); });
    document.getElementById(sectionId).classList.remove('hidden'); document.querySelectorAll('.nav-link').forEach(function(link) { link.classList.remove('active'); });
    if (sectionId === 'dashboard') { updateDashboard(); syncRecentRequests(); }
    else if (sectionId === 'find') { searchDonors(); }
    else if (sectionId === 'home') { updateHomeStats(); toggleDonorButtons(); }
    else if (sectionId === 'profile') { loadProfile(); loadDonorControls(); }
    else if (sectionId === 'bloodbank') { renderBloodBanks(); }
    else if (sectionId === 'about') { toggleDonorButtons(); }
    document.getElementById('mobileMenu').classList.add('hidden'); window.scrollTo(0, 0); lucide.createIcons();
}
function toggleMobileMenu() { document.getElementById('mobileMenu').classList.toggle('hidden'); }
function toggleAdminMobileMenu() { document.getElementById('adminMobileMenu').classList.toggle('hidden'); }
function closeEmergencyBanner() { document.getElementById('emergencyBanner').style.display = 'none'; document.getElementById('mainNav').style.top = '0'; }

// ========== Donor Registration ==========
document.getElementById('donorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.querySelectorAll('[id$="Error"]').forEach(function(el) { el.classList.add('hidden'); });
    var isValid = true;
    var fullName = document.getElementById('fullName').value.trim();
    if (!fullName || fullName.length < 2) { document.getElementById('nameError').classList.remove('hidden'); isValid = false; }
    var phone = document.getElementById('phoneNumber').value.trim();
    if (!phone || !/^[\d\s\-\+\(\)]+$/.test(phone) || phone.length < 10) { document.getElementById('phoneError').classList.remove('hidden'); isValid = false; }
    var bloodGroup = document.getElementById('bloodGroup').value;
    if (!bloodGroup) { document.getElementById('bloodError').classList.remove('hidden'); isValid = false; }
    var location = document.getElementById('location').value.trim();
    if (!location) { document.getElementById('locationError').classList.remove('hidden'); isValid = false; }
    if (!isValid) return;

    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) { showToast('Please login first.', 'error'); return; }
    if (isEmailBanned(currentUser.email)) { showToast('Your account has been permanently banned from registering as a donor.', 'error'); return; }
    if (isDonorRemoved(currentUser.email)) { showToast('You can re-register as a donor after ' + getRemovedDaysLeft(currentUser.email) + ' days.', 'error'); return; }
    if (donors.find(function(d) { return d.userId === currentUser.id; })) { showToast('You are already registered as a donor!', 'error'); return; }

    try {
        var res = await fetch(API + '/donors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, name: fullName, phone: phone, bloodGroup: bloodGroup, location: location, lastDonation: document.getElementById('lastDonation').value || null })
        });
        var data = await res.json();
        if (data.success) {
            var newDonor = { id: Date.now(), userId: currentUser.id, name: fullName, phone: phone, bloodGroup: bloodGroup, location: location, lastDonation: document.getElementById('lastDonation').value || null, registrationDate: new Date().toISOString().split('T')[0], isActive: true, cooldownUntil: null };
            donors.unshift(newDonor);
            currentUser.isDonorRegistered = true; localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showToast('Registration successful! Thank you for becoming a donor.', 'success'); this.reset(); toggleDonorButtons();
            setTimeout(function() { showSection('profile'); }, 1000);
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) { showToast('Error connecting to server.', 'error'); }
});

// ========== Search Donors ==========
async function searchDonors() {
    if (_isSearching) return;
    _isSearching = true;
    var bloodFilter = document.getElementById('searchBloodGroup').value;
    var locationFilter = document.getElementById('searchLocation').value.toLowerCase();

    try {
        var url = API + '/donors?blood=' + encodeURIComponent(bloodFilter) + '&location=' + encodeURIComponent(locationFilter);
        var res = await fetch(url);
        var data = await res.json();

        if (data.success) {
            var filtered = data.donors.map(normalizeDonor).filter(function(donor) {
                if (!isDonorAvailable(donor) || isDonorBanned(donor)) return false;
                return true;
            });
            displayDonors(filtered);
        } else {
            displayDonors([]);
        }
    } catch (e) {
        console.log("Backend error, using local data:", e);
        var filtered = donors.filter(function(donor) {
            if (!isDonorAvailable(donor) || isDonorBanned(donor)) return false;
            var matchesBlood = !bloodFilter || donor.bloodGroup === bloodFilter;
            var matchesLocation = !locationFilter || donor.location.toLowerCase().includes(locationFilter);
            return matchesBlood && matchesLocation;
        });
        displayDonors(filtered);
    }
    _isSearching = false;
}
function filterByStatus(status) { currentFilter = status; searchDonors(); }
function quickSearch(bloodGroup) { document.getElementById('searchBloodGroup').value = bloodGroup; showSection('find'); }

// ========== Display Donors ==========
function displayDonors(donorsToShow) {
    displayedDonors = donorsToShow;
    var grid = document.getElementById('donorGrid');
    var noResults = document.getElementById('noResults');
    var countSpan = document.getElementById('resultCount');
    countSpan.textContent = donorsToShow.length;
    if (donorsToShow.length === 0) { grid.innerHTML = ''; noResults.classList.remove('hidden'); return; }
    noResults.classList.add('hidden');
    grid.style.visibility = 'hidden';
    grid.innerHTML = donorsToShow.map(function(donor) {
        return '<div class="donor-card bg-white rounded-xl shadow-md p-6 border border-gray-100 animate-fade-in"><div class="flex justify-between items-start mb-4"><div class="flex items-center gap-3"><div class="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center"><span class="text-red-600 font-bold text-lg">' + donor.bloodGroup + '</span></div><div><h3 class="font-bold text-gray-900">' + donor.name + '</h3><p class="text-sm text-gray-500 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>' + donor.location + '</p></div></div><div class="text-right flex flex-col items-end gap-1"><span class="status-badge px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">&#9679; Available</span><button onclick="openReportModal(' + donor.id + ')" class="status-badge px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition">&#9888; Report</button></div></div><button onclick="openContactModal(' + donor.id + ')" class="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"><i data-lucide="phone" class="w-4 h-4"></i>Contact Donor</button></div>';
    }).join('');
    lucide.createIcons();
    requestAnimationFrame(function() {
        grid.style.visibility = 'visible';
    });
}

// ========== Contact Modal ==========
function openContactModal(donorId) {
    var donor = displayedDonors.find(function(d) { return d.id === donorId; }); if (!donor) return; document.getElementById('modalDonorName').textContent = donor.name; document.getElementById('modalDonorPhone').textContent = donor.phone; document.getElementById('modalDonorBlood').textContent = donor.bloodGroup; document.getElementById('contactModal').classList.remove('hidden'); lucide.createIcons();
}
function closeContactModal() { document.getElementById('contactModal').classList.add('hidden'); }
document.getElementById('contactModal').addEventListener('click', function(e) { if (e.target === this) closeContactModal(); });

// ========== Dashboard ==========
function updateDashboard() {
    var total = donors.filter(function(d) { return !isDonorBanned(d); }).length;
    var active = donors.filter(function(d) { return isDonorAvailable(d) && !isDonorBanned(d); }).length;
    animateNumber('dashTotalDonors', total); animateNumber('dashActiveDonors', active); animateNumber('dashInactiveDonors', total - active);
    var recent = donors.filter(function(d) { return !isDonorBanned(d); }).slice(0, 5);
    var recentContainer = document.getElementById('recentRegistrations');
    if (recent.length === 0) { recentContainer.innerHTML = '<p class="text-gray-500 text-sm italic">No registrations yet.</p>'; return; }
    recentContainer.innerHTML = recent.map(function(donor) {
        var available = isDonorAvailable(donor); return '<div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"><div class="flex items-center gap-3"><div class="bg-red-100 w-10 h-10 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">' + donor.bloodGroup + '</div><div><p class="font-semibold text-gray-900">' + donor.name + '</p><p class="text-sm text-gray-500">' + donor.location + '</p></div></div><span class="text-xs font-medium ' + (available ? 'text-green-600' : 'text-yellow-600') + '">' + (available ? 'Active' : 'Inactive') + '</span></div>';
    }).join('');
}

function updateHomeStats() {
    document.getElementById('statTotalDonors').textContent = donors.filter(function(d) { return !isDonorBanned(d); }).length;
    document.getElementById('statActiveDonors').textContent = donors.filter(function(d) { return isDonorAvailable(d) && !isDonorBanned(d); }).length;

    var heroActiveEl = document.getElementById('heroActiveCount');
    var activeCount = donors.filter(function(d) { return isDonorAvailable(d) && !isDonorBanned(d); }).length;
    if (heroActiveEl) {
        heroActiveEl.innerText = activeCount + " Active Donor Right Now";
    }
}

function animateNumber(elementId, target) {
    var element = document.getElementById(elementId);
    var steps = 30; var increment = target / steps;
    var current = 0;
    var timer = setInterval(function() { current += increment; if (current >= target) { element.textContent = target; clearInterval(timer); } else { element.textContent = Math.floor(current); } }, 1000 / steps);
}

// ========== Toast ==========
function showToast(message, type) { type = type || 'success';
    var toast = document.createElement('div'); toast.className = 'toast';
    var iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    var iconColor = type === 'success' ? 'text-green-600' : 'text-red-600'; toast.innerHTML = '<i data-lucide="' + iconName + '" class="w-5 h-5 ' + iconColor + '"></i><span class="font-medium">' + message + '</span>'; document.body.appendChild(toast); lucide.createIcons(); setTimeout(function() { toast.classList.add('show'); }, 100); setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 3000);
}

// ========== Emergency Requests with 24h Countdown ==========
var currentAlertIndex = 0;
function getActiveAlerts() {
    var now = new Date(); return emergencyAlerts.filter(function(alert) { if (!alert.createdAt) return true;
        var elapsed = now - new Date(alert.createdAt); return elapsed < 24 * 60 * 60 * 1000; });
}
function cleanExpiredAlerts() {
    var now = new Date();
    var before = emergencyAlerts.length; emergencyAlerts = emergencyAlerts.filter(function(alert) { if (!alert.createdAt) return true;
        var elapsed = now - new Date(alert.createdAt); return elapsed < 24 * 60 * 60 * 1000; });
}
function getCountdownText(createdAt) { if (!createdAt) return '';
    var now = new Date(); var elapsed = now - new Date(createdAt);
    var remaining = (24 * 60 * 60 * 1000) - elapsed; if (remaining <= 0) return 'Expired';
    var hours = Math.floor(remaining / (1000 * 60 * 60)); var minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((remaining % (1000 * 60)) / 1000); return hours + 'h ' + minutes + 'm ' + seconds + 's remaining';
}
function syncRecentRequests() {
    var container = document.getElementById('recentRequestsContainer'); if (!container) return; container.innerHTML = ''; cleanExpiredAlerts();
    var activeAlerts = getActiveAlerts(); if (activeAlerts.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm italic">No active emergency requests.</p>'; return; } activeAlerts.forEach(function(alert) { container.insertAdjacentHTML('beforeend', '<div class="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-100 transition-all hover:shadow-md animate-fade-in"><div class="bg-red-100 p-2 rounded-full"><i data-lucide="droplet" class="w-5 h-5 text-red-600"></i></div><div class="flex-1"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-900">Urgent: ' + alert.blood + ' Blood Needed</p><p class="text-sm text-gray-600">' + alert.hospital + '</p></div><span class="bg-red-600 text-white text-[10px] px-2 py-1 rounded-full animate-pulse font-bold">URGENT</span></div><div class="mt-3 flex items-center gap-2 flex-wrap"><a href="tel:' + alert.phone + '" class="inline-flex items-center gap-2 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-md text-sm font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"><i data-lucide="phone" class="w-4 h-4"></i>Call: ' + alert.phone + '</a><span id="countdown_' + alert.id + '" class="countdown-badge"><i data-lucide="clock" class="w-3 h-3"></i> 24h 0m 0s remaining</span></div></div></div>'); }); if (window.lucide) lucide.createIcons();
}
function updateAllCountdowns() {
    var now = new Date();
    var needsRefresh = false; emergencyAlerts.forEach(function(alert) { if (!alert.createdAt) return;
        var elapsed = now - new Date(alert.createdAt); if (elapsed >= 24 * 60 * 60 * 1000) { needsRefresh = true; return; }
        var el = document.getElementById('countdown_' + alert.id); if (el) { el.innerHTML = '<i data-lucide="clock" class="w-3 h-3"></i> ' + getCountdownText(alert.createdAt); lucide.createIcons(); } }); if (needsRefresh) { cleanExpiredAlerts(); var dashboardSection = document.getElementById('dashboard'); if (dashboardSection && !dashboardSection.classList.contains('hidden')) { syncRecentRequests(); } }
}
function rotateEmergencyAlerts() {
    var textElement = document.getElementById('emergencyText'); if (!textElement) return; cleanExpiredAlerts();
    var activeAlerts = getActiveAlerts(); if (activeAlerts.length === 0) { textElement.textContent = 'No active emergencies at this time.'; return; }
    var nextAlert = activeAlerts[currentAlertIndex % activeAlerts.length]; textElement.textContent = 'Emergency: Urgent need for ' + nextAlert.blood + ' blood at ' + nextAlert.hospital + '. Contact: ' + nextAlert.phone; currentAlertIndex = (currentAlertIndex + 1) % activeAlerts.length;
}
setInterval(rotateEmergencyAlerts, 5000); setInterval(updateAllCountdowns, 1000);

var bloodForm = document.getElementById('bloodRequestForm');
if (bloodForm) {
    bloodForm.onsubmit = async function(e) {
        e.preventDefault();
        var hospital = document.getElementById('reqHospital').value.trim();
        var location = document.getElementById('reqLocation').value.trim();
        var blood = document.getElementById('reqBlood').value;
        var phone = document.getElementById('reqPhone').value.trim();
        if (!hospital || !phone) return;
        try {
            var res = await fetch(API + '/emergency-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hospital: hospital, location: location, blood: blood, phone: phone }) });
            var data = await res.json();
            if(data.success) {
                emergencyAlerts.unshift({ id: 'req_' + Date.now(), hospital: hospital, location: location, blood: blood, phone: phone, createdAt: new Date().toISOString() });
                syncRecentRequests(); currentAlertIndex = 0; rotateEmergencyAlerts();
                sendNotificationsToDonors(blood, hospital, location, phone); sendNotificationsToBloodBanks(blood, hospital, location, phone);
                var currentUser = JSON.parse(localStorage.getItem('currentUser'));
                if (currentUser) {
                    var currentDonor = donors.find(function(d) { return d.userId === currentUser.id; }); if (currentDonor && currentDonor.bloodGroup === blood && isDonorAvailable(currentDonor)) { createNotification(blood, hospital, location, phone); } }
                this.reset(); closeBloodRequestModal(); showToast('Request Posted Successfully!');
            } else { showToast(data.message, 'error'); }
        } catch(err) { showToast('Error posting request.', 'error'); }
    };
}
function openBloodRequestModal() {
    var modal = document.getElementById('bloodRequestModal'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeBloodRequestModal() {
    var modal = document.getElementById('bloodRequestModal'); if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ========== Blood Bank Functions ==========
function renderBloodBanks() {
    var grid = document.getElementById('bloodBankGrid'); if (!grid) return; grid.innerHTML = bloodBanks.map(function(bank) { return '<div class="bg-white rounded-xl shadow-md p-6 border border-gray-100 animate-fade-in"><div class="flex items-start gap-4 mb-4"><div class="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><i data-lucide="building-2" class="w-6 h-6 text-blue-600"></i></div><div><h3 class="font-bold text-gray-900">' + bank.name + '</h3><p class="text-sm text-gray-500 flex items-center gap-1 mt-1"><i data-lucide="map-pin" class="w-3 h-3"></i>' + bank.address + '</p></div></div><div class="bg-gray-50 p-3 rounded-lg mb-4"><p class="text-sm text-gray-500 mb-1">Contact</p><p class="font-bold text-gray-900">' + bank.phone + '</p></div><a href="tel:' + bank.phone + '" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"><i data-lucide="phone" class="w-4 h-4"></i>Contact Blood Bank</a></div>'; }).join(''); if (window.lucide) lucide.createIcons();
}
function sendNotificationsToBloodBanks(bloodGroup, hospital, location, phone) { bloodBanks.forEach(function(bank) {
    var bankNotifications = JSON.parse(localStorage.getItem('amidonor_notifications_' + bank.id)) || []; bankNotifications.unshift({ id: Date.now() + Math.random(), type: 'blood_request', bloodGroup: bloodGroup, hospital: hospital, location: location, phone: phone, message: 'Urgent need for ' + bloodGroup + ' blood at ' + hospital + ', ' + location, timestamp: new Date().toISOString(), read: false }); localStorage.setItem('amidonor_notifications_' + bank.id, JSON.stringify(bankNotifications)); }); }

// ========== Report System ==========
function loadReports() { return []; }
function saveReports(reports) { }

function openReportModal(donorId) { var donor = displayedDonors.find(function(d) { return d.id === donorId; }); if (!donor) return; document.getElementById('reportDonorId').value = donorId; document.getElementById('reportDonorName').textContent = donor.name; document.getElementById('reportReason').value = ''; document.getElementById('reportModal').classList.remove('hidden'); lucide.createIcons(); }
function closeReportModal() { document.getElementById('reportModal').classList.add('hidden'); }
document.getElementById('reportModal').addEventListener('click', function(e) { if (e.target === this) closeReportModal(); });

document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var donorId = parseInt(document.getElementById('reportDonorId').value);
    var reason = document.getElementById('reportReason').value.trim();
    if (!reason) return;
    var donor = displayedDonors.find(function(d) { return d.id === donorId; }); if (!donor) return;
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    try {
        var res = await fetch(API + '/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ donorId: donorId, donorName: donor.name, donorBloodGroup: donor.bloodGroup, donorPhone: donor.phone, donorLocation: donor.location, reportedBy: currentUser ? currentUser.email : 'anonymous', reportedByName: currentUser ? currentUser.name : 'Anonymous', reason: reason }) });
        var data = await res.json();
        if(data.success) { closeReportModal(); showToast('Report submitted successfully. Admin will review it.', 'success'); }
        else { showToast(data.message, 'error'); }
    } catch(err) { showToast('Error submitting report.', 'error'); }
});

// ========== Admin Panel Functions ==========
function showAdminLogin() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminAuthSection').classList.remove('hidden');
    window.location.hash = 'admin';
    lucide.createIcons();
}
function showUserLogin() {
    document.getElementById('adminAuthSection').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    window.location.hash = '';
    lucide.createIcons();
}

document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var username = document.getElementById('adminUsername').value.trim();
    var password = document.getElementById('adminPassword').value;
    try {
        var res = await fetch(API + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        var data = await res.json();
        if (data.success) {
            localStorage.setItem('adminLoggedIn', 'true');
            document.getElementById('adminAuthSection').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            showAdminSection('admindashboard');
            this.reset();
            showToast('Admin logged in successfully', 'success');
            lucide.createIcons();
        } else {
            showToast('Invalid admin credentials', 'error');
        }
    } catch(err) {
        showToast('Error connecting to server.', 'error');
    }
});

function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminAuthSection').classList.remove('hidden');
    window.location.hash = 'admin';
    lucide.createIcons();
}
function checkAdminAuth() {
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('adminAuthSection').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        showAdminSection('admindashboard');
    }
}
function showAdminSection(sectionId) { document.querySelectorAll('.admin-section').forEach(function(section) { section.classList.add('hidden'); }); document.getElementById(sectionId).classList.remove('hidden'); if (sectionId === 'admindashboard') updateAdminDashboard(); else if (sectionId === 'adminreports') loadAdminReports(); else if (sectionId === 'admindonors') loadAdminDonors(); else if (sectionId === 'adminbloodbanks') loadAdminBloodBanks(); document.getElementById('adminMobileMenu').classList.add('hidden'); lucide.createIcons(); }

async function updateAdminDashboard() {
    try {
        var res = await fetch(API + '/admin/stats');
        var data = await res.json();
        if(data.success) { document.getElementById('adminTotalUsers').textContent = data.stats.totalUsers; document.getElementById('adminActiveDonors').textContent = data.stats.activeDonors; document.getElementById('adminTotalReports').textContent = data.stats.pendingReports; document.getElementById('adminBannedUsers').textContent = data.stats.bannedUsers; }
    } catch(e) {}

    try {
        var userRes = await fetch(API + '/admin/users');
        var userData = await userRes.json();
        var users = userData.users || [];
        var container = document.getElementById('adminAllUsersList');
        if (users.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm italic">No users yet.</p>'; return; }
        container.innerHTML = users.map(function(user) {
            var donor = donors.find(function(d) { return d.userId === user.id; });
            var isBanned = isEmailBanned(user.email);
            var isRemoved = isDonorRemoved(user.email);
            var donorStatus = '', statusClass = '';
            if (isBanned) { donorStatus = 'Banned'; statusClass = 'bg-red-100 text-red-700'; } else if (isRemoved) { donorStatus = 'Removed'; statusClass = 'bg-orange-100 text-orange-700'; } else if (donor) { var available = isDonorAvailable(donor); donorStatus = available ? 'Active Donor' : 'Inactive Donor'; statusClass = available ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'; } else { donorStatus = 'Not a Donor'; statusClass = 'bg-gray-100 text-gray-700'; }
            var bloodInfo = donor ? '<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">' + donor.bloodGroup + '</span>' : '';
            return '<div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"><div class="flex items-center gap-3"><div class="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">' + (user.name ? user.name.charAt(0).toUpperCase() : 'U') + '</div><div><p class="font-semibold text-gray-900">' + user.name + ' ' + bloodInfo + '</p><p class="text-sm text-gray-500">' + user.email + ' | ' + (user.phone || 'N/A') + '</p></div></div><span class="' + statusClass + ' text-xs px-2 py-1 rounded-full font-semibold">' + donorStatus + '</span></div>';
        }).join('');
    } catch(e) {}
}

async function loadAdminReports() {
    var container = document.getElementById('adminReportsList');
    try {
        var res = await fetch(API + '/reports');
        var data = await res.json();
        var reports = data.reports || [];
        if (reports.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm italic">No reports yet.</p>'; return; }
        container.innerHTML = reports.map(function(report) {
            var statusBadge = ''; if (report.status === 'pending') statusBadge = '<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-semibold">Pending</span>'; else if (report.status === 'banned') statusBadge = '<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-semibold">Banned</span>'; else statusBadge = '<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-semibold">Dismissed</span>';
            var banBtn = ''; if (report.status === 'pending') { banBtn = '<div class="flex gap-2 mt-3"><button onclick="banDonorFromReport(' + report.id + ')" class="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition">Ban Donor</button><button onclick="dismissReport(' + report.id + ')" class="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-300 transition">Dismiss</button></div>'; }
            return '<div class="p-4 bg-gray-50 rounded-lg border border-gray-200"><div class="flex items-start justify-between mb-3"><div><p class="font-bold text-gray-900">' + report.donor_name + ' <span class="text-red-600 font-semibold">(' + report.donor_blood_group + ')</span></p><p class="text-sm text-gray-500">' + report.donor_location + ' | ' + report.donor_phone + '</p></div>' + statusBadge + '</div><div class="bg-white p-3 rounded-lg"><p class="text-sm text-gray-500 mb-1">Reported by: ' + report.reported_by_name + '</p><p class="text-sm text-gray-700 font-medium">"' + report.reason + '"</p><p class="text-xs text-gray-400 mt-1">' + getTimeAgo(report.created_at) + '</p></div>' + banBtn + '</div>';
        }).join('');
    } catch(e) { container.innerHTML = '<p class="text-gray-500 text-sm italic">Error loading reports.</p>'; }
}

async function banDonorFromReport(reportId) {
    try {
        await fetch(API + '/reports/' + reportId + '/ban', { method: 'PUT' });
        var reportsRes = await fetch(API + '/reports'); var reportsData = await reportsRes.json();
        var report = reportsData.reports.find(r => r.id === reportId);
        if (report) { await fetch(API + '/donors/' + report.donor_id + '/ban', { method: 'PUT' });
        var bannedEmails = getBannedEmails();
        var donorObj = donors.find(d => d.id === report.donor_id); if(donorObj && bannedEmails.indexOf(donorObj.userId) === -1) { bannedEmails.push(donorObj.userId); saveBannedEmails(bannedEmails); } }
        loadAdminReports(); loadData(); showToast('Donor has been permanently banned', 'success');
    } catch(e) { showToast('Error banning donor', 'error'); }
}
async function dismissReport(reportId) {
    try { await fetch(API + '/reports/' + reportId + '/dismiss', { method: 'PUT' }); loadAdminReports(); showToast('Report dismissed', 'success'); } catch(e) { showToast('Error dismissing report', 'error'); }
}

// ========== Admin Donors with Search ==========
async function loadAdminDonors(filteredDonors) {
    var container = document.getElementById('adminDonorsList');
    var donorsToShow = filteredDonors || donors;
    if (donorsToShow.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm italic">No donors found.</p>'; return; }
    container.innerHTML = donorsToShow.map(function(donor) {
        var available = isDonorAvailable(donor) && !isDonorBanned(donor);
        var banned = isDonorBanned(donor); var statusText = banned ? 'Banned' : (available ? 'Active' : 'Inactive');
        var statusClass = banned ? 'bg-red-100 text-red-700' : (available ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700');
        var actionBtns = ''; if (banned) { actionBtns = '<span class="text-xs text-gray-400">Permanently banned</span>'; } else { actionBtns = '<div class="flex gap-2"><button onclick="openBanDonorModal(' + donor.id + ')" class="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition">Ban</button><button onclick="openRemoveDonorModal(' + donor.id + ')" class="bg-orange-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-orange-600 transition">Remove</button></div>'; } return '<div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition gap-3"><div class="flex items-center gap-3"><div class="bg-red-100 w-10 h-10 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">' + donor.bloodGroup + '</div><div><p class="font-semibold text-gray-900">' + donor.name + '</p><p class="text-sm text-gray-500">' + donor.location + ' | ' + donor.phone + '</p><p class="text-xs text-gray-400">Email: ' + donor.userId + ' | Registered: ' + donor.registrationDate + '</p></div></div><div class="flex items-center gap-3"><span class="' + statusClass + ' text-xs px-2 py-1 rounded-full font-semibold">' + statusText + '</span>' + actionBtns + '</div></div>';
    }).join('');
}
async function searchAdminDonors() {
    var phoneFilter = document.getElementById('adminDonorSearchPhone').value.trim().toLowerCase();
    var bloodFilter = document.getElementById('adminDonorSearchBlood').value;
    try { var res = await fetch(API + '/donors/all?phone=' + encodeURIComponent(phoneFilter) + '&blood=' + encodeURIComponent(bloodFilter));
        var data = await res.json(); loadAdminDonors(data.donors.map(normalizeDonor)); } catch(e) { loadAdminDonors(); }
}
function clearAdminDonorSearch() { document.getElementById('adminDonorSearchPhone').value = ''; document.getElementById('adminDonorSearchBlood').value = ''; loadAdminDonors(); }

// ========== Ban Donor Confirmation Modal ==========
function openBanDonorModal(donorId) {
    var donor = donors.find(function(d) { return d.id === donorId; }); if (!donor) return; document.getElementById('banDonorId').value = donorId; document.getElementById('banDonorModalName').textContent = donor.name + ' (' + donor.bloodGroup + ')'; document.getElementById('banDonorReason').value = ''; document.getElementById('banDonorModal').classList.remove('hidden'); lucide.createIcons();
}
function closeBanDonorModal() { document.getElementById('banDonorModal').classList.add('hidden'); }
document.getElementById('banDonorModal').addEventListener('click', function(e) { if (e.target === this) closeBanDonorModal(); });

document.getElementById('banDonorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var donorId = parseInt(document.getElementById('banDonorId').value);
    var reason = document.getElementById('banDonorReason').value.trim();
    if (!reason) { showToast('Please provide a reason for banning.', 'error'); return; }
    try {
        await fetch(API + '/donors/' + donorId + '/ban', { method: 'PUT' });
        var donorObj = donors.find(d => d.id === donorId);
        if(donorObj) {
            var bannedEmails = getBannedEmails(); if (bannedEmails.indexOf(donorObj.userId) === -1) { bannedEmails.push(donorObj.userId); saveBannedEmails(bannedEmails); } }
        closeBanDonorModal(); loadData(); searchAdminDonors(); showToast('Donor has been permanently banned', 'success');
    } catch(e) { showToast('Error banning donor', 'error'); }
});

// ========== Remove Donor Confirmation Modal ==========
function openRemoveDonorModal(donorId) {
    var donor = donors.find(function(d) { return d.id === donorId; }); if (!donor) return; document.getElementById('removeDonorId').value = donorId; document.getElementById('removeDonorModalName').textContent = donor.name + ' (' + donor.bloodGroup + ')'; document.getElementById('removeDonorModal').classList.remove('hidden'); lucide.createIcons();
}
function closeRemoveDonorModal() { document.getElementById('removeDonorModal').classList.add('hidden'); }
document.getElementById('removeDonorModal').addEventListener('click', function(e) { if (e.target === this) closeRemoveDonorModal(); });

async function confirmRemoveDonor() {
    var donorId = parseInt(document.getElementById('removeDonorId').value);
    try {
        await fetch(API + '/donors/' + donorId, { method: 'DELETE' });
        var donorObj = donors.find(d => d.id === donorId);
        if(donorObj) {
            var removedList = getRemovedDonors(); removedList.push({ email: donorObj.userId, name: donorObj.name, removedAt: new Date().toISOString() }); saveRemovedDonors(removedList); }
        closeRemoveDonorModal(); loadData(); searchAdminDonors(); showToast('Donor removed. They can re-register after 3 months.', 'success');
    } catch(err) { 
    console.error('Remove Donor Error:', err);
    showToast('Error: ' + (err.message || 'Check console'), 'error'); 
}
}

// ========== Admin Blood Banks Management ==========
async function loadAdminBloodBanks() {
    var container = document.getElementById('adminBloodBanksList');
    container.innerHTML = bloodBanks.map(function(bank) {
        return '<div class="bg-white p-6 rounded-xl shadow-md border border-gray-100" id="adminBank_' + bank.id + '"><div class="flex items-start gap-4 mb-4"><div class="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><i data-lucide="building-2" class="w-6 h-6 text-blue-600"></i></div><div class="flex-1"><div class="grid md:grid-cols-1 gap-3"><div><label class="block text-xs font-medium text-gray-500 mb-1">Hospital Name</label><input type="text" id="bankName_' + bank.id + '" value="' + bank.name + '" class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"></div><div><label class="block text-xs font-medium text-gray-500 mb-1">Address</label><input type="text" id="bankAddress_' + bank.id + '" value="' + bank.address + '" class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"></div><div><label class="block text-xs font-medium text-gray-500 mb-1">Phone Number</label><input type="text" id="bankPhone_' + bank.id + '" value="' + bank.phone + '" class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"></div></div></div></div><div class="flex justify-end gap-2"><button onclick="openRemoveBloodBankModal(\'' + bank.id + '\')" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4"></i>Remove</button><button onclick="saveBloodBankEdit(\'' + bank.id + '\')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i>Save Changes</button></div></div>';
    }).join(''); if (window.lucide) lucide.createIcons();
}

async function saveBloodBankEdit(bankId) {
    var nameInput = document.getElementById('bankName_' + bankId);
    var addressInput = document.getElementById('bankAddress_' + bankId);
    var phoneInput = document.getElementById('bankPhone_' + bankId);
    if (!nameInput.value.trim() || !phoneInput.value.trim()) { showToast('Name and phone are required.', 'error'); return; }
    try {
        await fetch(API + '/blood-banks/' + bankId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameInput.value.trim(), address: addressInput.value.trim(), phone: phoneInput.value.trim() }) });
        loadData(); showToast('Blood bank updated successfully!', 'success');
    } catch(e) { showToast('Error updating blood bank', 'error'); }
}

function openRemoveBloodBankModal(bankId) {
    var bank = bloodBanks.find(function(b) { return b.id === bankId; }); if (!bank) return; document.getElementById('removeBloodBankId').value = bankId; document.getElementById('removeBloodBankModalName').textContent = bank.name; document.getElementById('removeBloodBankModal').classList.remove('hidden'); lucide.createIcons();
}
function closeRemoveBloodBankModal() { document.getElementById('removeBloodBankModal').classList.add('hidden'); }
document.getElementById('removeBloodBankModal').addEventListener('click', function(e) { if (e.target === this) closeRemoveBloodBankModal(); });

async function confirmRemoveBloodBank() {
    var bankId = document.getElementById('removeBloodBankId').value;
    try { await fetch(API + '/blood-banks/' + bankId, { method: 'DELETE' }); closeRemoveBloodBankModal(); loadData(); loadAdminBloodBanks(); showToast('Blood bank removed successfully.', 'success'); } catch(e) { showToast('Error removing blood bank', 'error'); }
}

function openAddBloodBankModal() { document.getElementById('newBankName').value = ''; document.getElementById('newBankAddress').value = ''; document.getElementById('newBankPhone').value = ''; document.getElementById('addBloodBankModal').classList.remove('hidden'); lucide.createIcons(); }
function closeAddBloodBankModal() { document.getElementById('addBloodBankModal').classList.add('hidden'); }
document.getElementById('addBloodBankModal').addEventListener('click', function(e) { if (e.target === this) closeAddBloodBankModal(); });

document.getElementById('addBloodBankForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var name = document.getElementById('newBankName').value.trim();
    var address = document.getElementById('newBankAddress').value.trim();
    var phone = document.getElementById('newBankPhone').value.trim();
    if (!name || !address || !phone) return;
    try { await fetch(API + '/blood-banks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, phone }) }); closeAddBloodBankModal(); loadData(); loadAdminBloodBanks(); showToast('New blood bank added successfully!', 'success'); } catch(e) { showToast('Error adding blood bank', 'error'); }
});

// ========== Auth System ==========
function checkAuth() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser')); if (currentUser) { document.getElementById('authSection').classList.add('hidden'); document.getElementById('mainApp').classList.remove('hidden'); showSection('home'); loadProfile(); loadDonorControls(); loadNotifications(); updateNotificationBadge(); toggleDonorButtons(); } else { document.getElementById('authSection').classList.remove('hidden'); document.getElementById('mainApp').classList.add('hidden'); }
}
function toggleAuthMode(mode) { if (mode === 'signup') { document.getElementById('loginForm').classList.add('hidden'); document.getElementById('signupForm').classList.remove('hidden'); document.getElementById('authTitle').textContent = "Create Account"; } else { document.getElementById('loginForm').classList.remove('hidden'); document.getElementById('signupForm').classList.add('hidden'); document.getElementById('authTitle').textContent = "Ami Donor"; } }

document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var name = document.getElementById('signupName').value.trim();
    var email = document.getElementById('signupEmail').value.trim();
    var phone = document.getElementById('signupPhone').value.trim();
    var password = document.getElementById('signupPassword').value;
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; } if (isEmailBanned(email)) { showToast('This email has been permanently banned.', 'error'); return; }
    try {
        var res = await fetch(API + '/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, password }) });
        var data = await res.json();
        if (data.success) { localStorage.setItem('currentUser', JSON.stringify(data.user)); this.reset(); checkAuth(); showToast('Account Created!'); } else { showToast(data.message, 'error'); }
    } catch(err) { showToast('Error creating account.', 'error'); }
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var identifier = document.getElementById('loginIdentifier').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!identifier || !password) { showToast('Please fill in all fields.', 'error'); return; }
    try {
        var res = await fetch(API + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
        var data = await res.json();
        if (data.success) { localStorage.setItem('currentUser', JSON.stringify(data.user)); this.reset(); checkAuth(); showToast('Logged in successfully'); } else { showToast(data.message, 'error'); }
    } catch(err) { 
    console.error('Login Error Details:', err);
    showToast('Error: ' + (err.message || 'Check console'), 'error'); 
}
});

function logout() { localStorage.removeItem('currentUser'); checkAuth(); }

// ========== Profile Management ==========
function loadProfile() { var currentUser = JSON.parse(localStorage.getItem('currentUser')); if (!currentUser) return; var nameInput = document.getElementById('profileName'); var emailInput = document.getElementById('profileEmail'); var phoneInput = document.getElementById('profilePhone'); var addressInput = document.getElementById('profileAddress'); if (nameInput) nameInput.value = currentUser.name || ""; if (emailInput) emailInput.value = currentUser.email || ""; if (phoneInput) phoneInput.value = currentUser.phone || ""; if (addressInput) addressInput.value = currentUser.address || ""; var dispName = document.getElementById('displayProfileName'); var dispEmail = document.getElementById('displayProfileEmail'); if (dispName) dispName.innerText = currentUser.name; if (dispEmail) dispEmail.innerText = currentUser.email; }

document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault(); var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    try {
        var res = await fetch(API + '/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentUser.id, name: document.getElementById('profileName').value.trim(), email: document.getElementById('profileEmail').value.trim(), phone: document.getElementById('profilePhone').value.trim(), address: document.getElementById('profileAddress').value.trim() }) });
        var data = await res.json();
        if(data.success) { currentUser.name = document.getElementById('profileName').value.trim(); currentUser.email = document.getElementById('profileEmail').value.trim(); currentUser.phone = document.getElementById('profilePhone').value.trim(); currentUser.address = document.getElementById('profileAddress').value.trim(); localStorage.setItem('currentUser', JSON.stringify(currentUser)); loadProfile(); showToast("Profile updated successfully!"); } else { showToast(data.message, 'error'); }
    } catch(err) { showToast('Error updating profile.', 'error'); }
});

document.getElementById('passwordForm').addEventListener('submit', async function(e) {
    e.preventDefault(); var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    try {
        var res = await fetch(API + '/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentUser.id, currentPassword: document.getElementById('currentPassword').value, newPassword: document.getElementById('newPassword').value }) });
        var data = await res.json();
        if(data.success) { document.getElementById('currentPassword').value = ""; document.getElementById('newPassword').value = ""; document.getElementById('confirmPassword').value = ""; showToast("Password changed successfully!"); } else { showToast(data.message, 'error'); }
    } catch(err) { showToast('Error changing password.', 'error'); }
});

// ========== Donor Status Management ==========
function loadDonorControls() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser')); if (!currentUser) return;
    var donor = donors.find(function(d) { return d.userId === currentUser.id; });
    var toggle = document.getElementById('statusToggle');
    var cooldownMsg = document.getElementById('cooldownMessage');
    var donatedBtn = document.getElementById('donatedBtn'); if (!donor) { if (toggle) { toggle.checked = false; toggle.disabled = true; } if (donatedBtn) { donatedBtn.disabled = true; donatedBtn.classList.add('bg-gray-400', 'cursor-not-allowed'); donatedBtn.classList.remove('bg-red-500', 'hover:bg-red-600'); } if (cooldownMsg) { cooldownMsg.classList.remove('hidden'); cooldownMsg.innerText = 'Register as a donor first to manage status.'; cooldownMsg.style.color = '#6B7280'; } return; }
    var isOnCooldown = donor.cooldownUntil && new Date(donor.cooldownUntil) > new Date(); if (toggle) { toggle.checked = !isOnCooldown && donor.isActive === true; toggle.disabled = isOnCooldown; } if (donatedBtn) { donatedBtn.disabled = isOnCooldown; if (isOnCooldown) { donatedBtn.classList.add('bg-gray-400', 'cursor-not-allowed'); donatedBtn.classList.remove('bg-red-500', 'hover:bg-red-600'); } else { donatedBtn.classList.remove('bg-gray-400', 'cursor-not-allowed'); donatedBtn.classList.add('bg-red-500', 'hover:bg-red-600'); } } if (cooldownMsg) { if (isOnCooldown) { cooldownMsg.classList.remove('hidden'); cooldownMsg.style.color = ''; cooldownMsg.innerText = 'You are on cooldown. ' + getCooldownDaysLeft(donor) + ' days remaining. Reactivate after ' + new Date(donor.cooldownUntil).toLocaleDateString() + '.'; } else { cooldownMsg.classList.add('hidden'); } }
}

async function handleStatusToggle() {
    var toggle = document.getElementById('statusToggle');
    var currentUser = JSON.parse(localStorage.getItem('currentUser')); if (!currentUser) return;
    var donor = donors.find(function(d) { return d.userId === currentUser.id; }); if (!donor) { showToast('Please register as a donor first.', 'error'); toggle.checked = false; return; } if (donor.cooldownUntil && new Date(donor.cooldownUntil) > new Date()) { showToast('Cannot activate during 90-day cooldown.', 'error'); toggle.checked = false; return; } try { await fetch(API + '/donors/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, isActive: toggle.checked }) }); donor.isActive = toggle.checked; showToast(toggle.checked ? 'You are now visible in Find Donor.' : 'You are now hidden from Find Donor.', toggle.checked ? 'success' : 'info'); } catch(e) { showToast('Error updating status.', 'error'); }
}

// ========== Already Donated Modal Functions ==========
function handleDonatedClick() {
    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    var donor = donors.find(function(d) { return d.userId === currentUser.id; });
    if (!donor) {
        showToast('Please register as a donor first.', 'error');
        return;
    }

    if (donor.cooldownUntil && new Date(donor.cooldownUntil) > new Date()) {
        showToast('You are already on cooldown. ' + getCooldownDaysLeft(donor) + ' days remaining.', 'error');
        return;
    }

    document.getElementById('donatedModalUserName').textContent = donor.name + ' (' + donor.bloodGroup + ')';
    document.getElementById('donatedAgreeCheckbox').checked = false;
    updateDonatedConfirmButton();
    document.getElementById('donatedConfirmModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeDonatedConfirmModal() {
    document.getElementById('donatedConfirmModal').classList.add('hidden');
}

document.getElementById('donatedConfirmModal').addEventListener('click', function(e) {
    if (e.target === this) closeDonatedConfirmModal();
});

document.getElementById('donatedAgreeCheckbox').addEventListener('change', function() {
    updateDonatedConfirmButton();
});

function updateDonatedConfirmButton() {
    var checkbox = document.getElementById('donatedAgreeCheckbox');
    var btn = document.getElementById('confirmDonatedBtn');
    if (checkbox.checked) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:bg-red-700');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('hover:bg-red-700');
    }
}

async function confirmDonatedAction() {
    var checkbox = document.getElementById('donatedAgreeCheckbox');
    if (!checkbox.checked) {
        showToast('Please agree to the terms first.', 'error');
        return;
    }

    var currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    try {
        var res = await fetch(API + '/donors/donated', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });

        var data = await res.json();
        if (data.success) {
            var donor = donors.find(function(d) { return d.userId === currentUser.id; });
            if (donor) {
                var cooldownDate = new Date();
                cooldownDate.setDate(cooldownDate.getDate() + 90);
                donor.isActive = false;
                donor.cooldownUntil = cooldownDate.toISOString();
                donor.lastDonation = new Date().toISOString().split('T')[0];
            }

            closeDonatedConfirmModal();
            loadDonorControls();
            showToast("Donation confirmed! Your profile is now on 90-day cooldown.", "success");
        } else {
            showToast(data.message || 'Error updating donation status.', 'error');
        }
    } catch(e) {
        console.error('Donation confirmation error:', e);
        showToast('Error connecting to server.', 'error');
    }
}

// ========== Helpers ==========
function debounce(func, wait) {
    var timeout; return function() {
        var later = function() { clearTimeout(timeout); func(); }; clearTimeout(timeout); timeout = setTimeout(later, wait); };
}
function togglePassword(inputId, eyeElement) {
    var input = document.getElementById(inputId);
    var icon = eyeElement.querySelector('i'); if (input.type === 'password') { input.type = 'text'; icon.setAttribute('data-lucide', 'eye-off'); } else { input.type = 'password'; icon.setAttribute('data-lucide', 'eye'); } lucide.createIcons();
}

document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeContactModal(); closeBloodRequestModal(); closeReportModal(); closeAddBloodBankModal(); closeBanDonorModal(); closeRemoveDonorModal(); closeRemoveBloodBankModal(); closeDonatedConfirmModal(); } });
document.addEventListener('click', function(e) {
    var bellDesktop = document.getElementById('notificationBellDesktop');
    var bellMobile = document.getElementById('notificationBellMobile'); if (bellDesktop && !bellDesktop.contains(e.target)) { if (document.getElementById('notificationDropdown')) document.getElementById('notificationDropdown').classList.add('hidden'); } if (bellMobile && !bellMobile.contains(e.target)) { if (document.getElementById('notificationDropdownMobile')) document.getElementById('notificationDropdownMobile').classList.add('hidden'); }
    var mobileMenu = document.getElementById('mobileMenu'); if (mobileMenu && !mobileMenu.classList.contains('hidden')){ var menuBtn = document.getElementById('mobileMenuBtn'); if (!mobileMenu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) { mobileMenu.classList.add('hidden'); } }
});

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();

    if (window.location.hash === '#admin') {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('adminAuthSection').classList.remove('hidden');
        checkAdminAuth();
    } else {
        checkAuth();
        checkAdminAuth();
    }

    lucide.createIcons(); syncRecentRequests(); rotateEmergencyAlerts();
    document.getElementById('searchBloodGroup').addEventListener('change', searchDonors);
    document.getElementById('searchLocation').addEventListener('input', debounce(searchDonors, 300));
});

window.addEventListener('hashchange', function() {
    if (window.location.hash === '#admin') {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('adminAuthSection').classList.remove('hidden');
        checkAdminAuth();
        lucide.createIcons();
    }
});
