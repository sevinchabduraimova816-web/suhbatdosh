/**
 * WebRTC P2P Videoaloqa dasturi (Signaling: Fayl & Matn orqali)
 * ICE Server: Google Open STUN Server (stun:stun.l.google.com:19302)
 * Qo'shimchalar: PWA, Web Share API, Kamera almashtirish (Flip Camera), SDP nusxalash/joylash
 */

// =============================================================================
// Konfiguratsiya
// =============================================================================
const rtcConfig = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

// =============================================================================
// Global O'zgaruvchilar
// =============================================================================
let localStream = null;
let screenStream = null;
let peerConnection = null;
let currentFacingMode = 'user'; // 'user' (oldi) yoki 'environment' (orqa)

let lastOfferData = null;
let lastAnswerData = null;
let deferredInstallPrompt = null;

// DOM elementlari
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localPlaceholder = document.getElementById('localPlaceholder');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const videoSection = document.getElementById('videoSection');

// Status va Log
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const logsContainer = document.getElementById('logsContainer');
const btnClearLogs = document.getElementById('btnClearLogs');
const toastContainer = document.getElementById('toastContainer');
const btnInstallApp = document.getElementById('btnInstallApp');

// Boshqaruv tugmalari
const btnStartMedia = document.getElementById('btnStartMedia');
const btnToggleAudio = document.getElementById('btnToggleAudio');
const btnToggleVideo = document.getElementById('btnToggleVideo');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const btnShareScreen = document.getElementById('btnShareScreen');
const btnHangup = document.getElementById('btnHangup');
const btnFullscreen = document.getElementById('btnFullscreen');

const iconMicOn = document.getElementById('iconMicOn');
const iconMicOff = document.getElementById('iconMicOff');
const iconVideoOn = document.getElementById('iconVideoOn');
const iconVideoOff = document.getElementById('iconVideoOff');

// Tablar va Signaling
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Caller
const btnCreateOffer = document.getElementById('btnCreateOffer');
const btnShareOffer = document.getElementById('btnShareOffer');
const btnCopyOffer = document.getElementById('btnCopyOffer');
const callerDropZone = document.getElementById('callerDropZone');
const answerFileInput = document.getElementById('answerFileInput');
const btnPasteAnswer = document.getElementById('btnPasteAnswer');

// Callee
const calleeDropZone = document.getElementById('calleeDropZone');
const offerFileInput = document.getElementById('offerFileInput');
const btnPasteOffer = document.getElementById('btnPasteOffer');
const btnDownloadAnswerManual = document.getElementById('btnDownloadAnswerManual');
const btnShareAnswer = document.getElementById('btnShareAnswer');
const btnCopyAnswer = document.getElementById('btnCopyAnswer');

// =============================================================================
// Yordamchi Funksiyalar (UI & Logs)
// =============================================================================

function addLog(message, type = 'info') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-msg">${message}</span>
    `;

    logsContainer.appendChild(entry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, 3800);
}

function updateConnectionStatus(state) {
    statusDot.className = 'status-dot';

    switch (state) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'Ulangan (Online)';
            break;
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Ulanmoqda...';
            break;
        case 'disconnected':
        case 'failed':
            statusDot.classList.add('error');
            statusText.textContent = 'Aloqa uzildi';
            break;
        case 'closed':
            statusText.textContent = 'Yakunlandi';
            break;
        default:
            statusText.textContent = 'Tayyor';
            break;
    }
}

function downloadFile(content, fileName, contentType = 'application/json') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 150);
}

/**
 * Web Share API orqali fayl yoki matnni boshqa ilovalarga (Telegram, WhatsApp) ulashish
 */
async function shareData(fileName, jsonString, title) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: title,
                text: `${title} fayli (WebRTC P2P aloqa)`,
                files: [file]
            });
            showToast('Fayl ulashildi!', 'success');
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Share xatosi:', err);
            }
        }
    } else if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: jsonString
            });
            showToast('Ulashildi!', 'success');
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Share xatosi:', err);
            }
        }
    }

    // Agar Web Share ishlamasa, fayl sifatida yuklab beramiz
    downloadFile(jsonString, fileName);
    showToast('Fayl yuklab olindi (Ulashish bu brauzerda qo\'llab-quvvatlanmadi)', 'info');
}

// =============================================================================
// Media Oqimlarini Boshqarish (Kamera & Mikrofon)
// =============================================================================

async function startLocalMedia() {
    if (localStream) return localStream;

    try {
        addLog('Kamera va mikrofon so\'ralmoqda...', 'info');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        localStream = stream;
        localVideo.srcObject = stream;
        localPlaceholder.classList.add('hidden');

        btnStartMedia.disabled = true;
        btnStartMedia.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Kamera yoniq</span>
        `;
        btnToggleAudio.disabled = false;
        btnToggleVideo.disabled = false;
        btnFlipCamera.disabled = false;
        btnShareScreen.disabled = false;
        btnHangup.disabled = false;

        addLog('Mahalliy kamera va mikrofon yoqildi', 'success');
        showToast('Kamera va mikrofon tayyor', 'success');
        return stream;
    } catch (err) {
        addLog(`Kameraga ulanishda xatolik: ${err.message}`, 'error');
        showToast('Kameraga ruxsat berilmadi', 'error');
        throw err;
    }
}

/**
 * Oldi va Orqa kamerani almashtirish (Flip Camera)
 */
async function flipCamera() {
    if (!localStream) return;

    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    addLog(`Kamera almashtirilmoqda: ${currentFacingMode === 'user' ? 'Oldi' : 'Orqa'}...`, 'info');

    // Eski video trekni to'xtatish
    const oldVideoTrack = localStream.getVideoTracks()[0];
    if (oldVideoTrack) oldVideoTrack.stop();

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        localStream.removeTrack(oldVideoTrack);
        localStream.addTrack(newVideoTrack);

        localVideo.srcObject = localStream;
        localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';

        // WebRTC ulanishidagi trekni yangilash
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        }

        showToast(`${currentFacingMode === 'user' ? 'Oldi' : 'Orqa'} kamera faollashdi`, 'info');
    } catch (err) {
        addLog(`Kamerani almashtirib bo'lmadi: ${err.message}`, 'warning');
        showToast('Kamerani almashtirib bo\'lmadi', 'warning');
    }
}

function toggleAudio() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (audioTrack.enabled) {
            iconMicOn.classList.remove('hidden');
            iconMicOff.classList.add('hidden');
            btnToggleAudio.classList.remove('active');
            addLog('Mikrofon yoqildi', 'info');
        } else {
            iconMicOn.classList.add('hidden');
            iconMicOff.classList.remove('hidden');
            btnToggleAudio.classList.add('active');
            addLog('Mikrofon o\'chirildi (Mute)', 'warning');
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        if (videoTrack.enabled) {
            iconVideoOn.classList.remove('hidden');
            iconVideoOff.classList.add('hidden');
            btnToggleVideo.classList.remove('active');
            localPlaceholder.classList.add('hidden');
            addLog('Kamera videosi yoqildi', 'info');
        } else {
            iconVideoOn.classList.add('hidden');
            iconVideoOff.classList.remove('hidden');
            btnToggleVideo.classList.add('active');
            localPlaceholder.classList.remove('hidden');
            addLog('Kamera videosi o\'chirildi', 'warning');
        }
    }
}

async function toggleScreenShare() {
    if (!peerConnection) {
        showToast('Avval ulanish taklifini yarating yoki yuklang', 'warning');
        return;
    }

    if (screenStream) {
        stopScreenShare();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStream = stream;
        const screenTrack = stream.getVideoTracks()[0];

        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(screenTrack);
        }
        localVideo.srcObject = screenStream;
        localVideo.style.transform = 'none';
        btnShareScreen.classList.add('active');
        addLog('Ekran ulashilmoqda', 'success');

        screenTrack.onended = () => stopScreenShare();
    } catch (err) {
        addLog(`Ekran ulashish bekor qilindi: ${err.message}`, 'warning');
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    btnShareScreen.classList.remove('active');

    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerConnection ? peerConnection.getSenders().find(s => s.track && s.track.kind === 'video') : null;
        if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
        }
        localVideo.srcObject = localStream;
        localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
        addLog('Kameraga qaytildi', 'info');
    }
}

// To'liq ekran
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        videoSection.requestFullscreen().catch(err => {
            console.warn('Fullscreen xatosi:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// =============================================================================
// WebRTC Ulanish Mantig'i
// =============================================================================

function createPeerConnection() {
    if (peerConnection) {
        peerConnection.close();
    }

    addLog('Google STUN bilan RTCPeerConnection yaratilmoqda...', 'info');
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
        addLog('Suhbatdoshdan video/audio oqimi qabul qilindi!', 'success');
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remotePlaceholder.classList.add('hidden');
        }
    };

    peerConnection.onconnectionstatechange = () => {
        addLog(`Ulanish holati: ${peerConnection.connectionState}`, 'info');
        updateConnectionStatus(peerConnection.connectionState);

        if (peerConnection.connectionState === 'connected') {
            showToast('Suhbatdosh bilan P2P aloqa o\'rnatildi!', 'success');
        } else if (peerConnection.connectionState === 'failed') {
            showToast('Ulanish amalga oshmadi', 'error');
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        addLog(`ICE holati: ${peerConnection.iceConnectionState}`, 'info');
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        addLog('Mahalliy treklar ulanishga biriktirildi', 'info');
    }

    return peerConnection;
}

function waitForIceGatheringComplete(pc) {
    return new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
        }

        const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }
        };

        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
        }, 3500);
    });
}

// =============================================================================
// Signaling Mantig'i (Offer & Answer)
// =============================================================================

// 1. Taklif (Offer) yaratish
async function handleCreateOffer() {
    try {
        btnCreateOffer.disabled = true;
        btnCreateOffer.innerHTML = `<span>Taklif tayyorlanmoqda...</span>`;

        if (!localStream) {
            await startLocalMedia();
        }

        const pc = createPeerConnection();
        updateConnectionStatus('connecting');

        addLog('WebRTC Offer yaratilmoqda...', 'info');
        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        await pc.setLocalDescription(offer);
        addLog('Google STUN serveridan ICE nomzodlari yig\'ilmoqda...', 'info');

        await waitForIceGatheringComplete(pc);

        lastOfferData = {
            type: pc.localDescription.type,
            sdp: pc.localDescription.sdp,
            createdAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(lastOfferData, null, 2);
        downloadFile(jsonStr, 'offer.json');

        btnShareOffer.disabled = false;
        btnCopyOffer.disabled = false;

        addLog('offer.json muvaffaqiyatli shakllandi va yuklab olindi!', 'success');
        showToast('offer.json tayyor! Suhbatdoshga yuboring.', 'success');

        btnCreateOffer.disabled = false;
        btnCreateOffer.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Qayta yuklab olish (offer.json)</span>
        `;
    } catch (err) {
        addLog(`Offer yaratishda xatolik: ${err.message}`, 'error');
        showToast('Taklif yaratib bo\'lmadi: ' + err.message, 'error');
        btnCreateOffer.disabled = false;
        btnCreateOffer.innerHTML = `<span>Taklif yaratish (offer.json)</span>`;
    }
}

// 2. Taklifni qabul qilib Answer yaratish
async function handleProcessOffer(fileContent) {
    try {
        let offerData;
        try {
            offerData = JSON.parse(fileContent);
        } catch (e) {
            throw new Error('Fayl to\'g\'ri JSON formatida emas');
        }

        if (!offerData || offerData.type !== 'offer' || !offerData.sdp) {
            throw new Error('Yaroqli WebRTC Offer ma\'lumoti topilmadi');
        }

        addLog('offer.json qabul qilindi. Javob tayyorlanmoqda...', 'info');

        if (!localStream) {
            await startLocalMedia();
        }

        const pc = createPeerConnection();
        updateConnectionStatus('connecting');

        await pc.setRemoteDescription(new RTCSessionDescription({
            type: offerData.type,
            sdp: offerData.sdp
        }));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        addLog('Google STUN dan ICE nomzodlari yig\'ilmoqda...', 'info');
        await waitForIceGatheringComplete(pc);

        lastAnswerData = {
            type: pc.localDescription.type,
            sdp: pc.localDescription.sdp,
            createdAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(lastAnswerData, null, 2);
        downloadFile(jsonStr, 'answer.json');

        btnDownloadAnswerManual.disabled = false;
        btnShareAnswer.disabled = false;
        btnCopyAnswer.disabled = false;
        calleeDropZone.classList.add('success');

        addLog('answer.json shakllandi va yuklab olindi!', 'success');
        showToast('answer.json yuklandi! Uni qaytaring.', 'success');
    } catch (err) {
        addLog(`Offer qabul qilishda xatolik: ${err.message}`, 'error');
        showToast('Xatolik: ' + err.message, 'error');
    }
}

// 3. Answer ni o'rnatish
async function handleProcessAnswer(fileContent) {
    try {
        if (!peerConnection) {
            throw new Error('Avval taklif (Offer) yaratishingiz kerak!');
        }

        let answerData;
        try {
            answerData = JSON.parse(fileContent);
        } catch (e) {
            throw new Error('Fayl to\'g\'ri JSON formatida emas');
        }

        if (!answerData || answerData.type !== 'answer' || !answerData.sdp) {
            throw new Error('Yaroqli WebRTC Answer ma\'lumoti topilmadi');
        }

        addLog('answer.json o\'qildi. Aloqa o\'rnatilmoqda...', 'info');

        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: answerData.type,
            sdp: answerData.sdp
        }));

        callerDropZone.classList.add('success');
        addLog('Javob o\'rnatildi. P2P ulanish faollashmoqda!', 'success');
        showToast('Javob qabul qilindi! Ulanmoqda...', 'success');
    } catch (err) {
        addLog(`Answer o'rnatishda xatolik: ${err.message}`, 'error');
        showToast('Xatolik: ' + err.message, 'error');
    }
}

function readFile(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target.result);
    reader.onerror = () => showToast('Faylni o\'qishda xatolik', 'error');
    reader.readAsText(file);
}

function hangupCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }

    remoteVideo.srcObject = null;
    remotePlaceholder.classList.remove('hidden');

    updateConnectionStatus('closed');
    callerDropZone.classList.remove('success');
    calleeDropZone.classList.remove('success');

    btnHangup.disabled = true;
    btnShareScreen.disabled = true;
    btnShareScreen.classList.remove('active');

    addLog('Aloqa to\'xtatildi', 'warning');
    showToast('Qo\'ng\'iroq yakunlandi', 'info');
}

// =============================================================================
// Hodisalarni Bog'lash (Event Listeners)
// =============================================================================

// Tablar
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
    });
});

// Tugmalar
btnStartMedia.addEventListener('click', startLocalMedia);
btnToggleAudio.addEventListener('click', toggleAudio);
btnToggleVideo.addEventListener('click', toggleVideo);
btnFlipCamera.addEventListener('click', flipCamera);
btnShareScreen.addEventListener('click', toggleScreenShare);
btnHangup.addEventListener('click', hangupCall);
btnFullscreen.addEventListener('click', toggleFullscreen);

// Taklif yaratish
btnCreateOffer.addEventListener('click', handleCreateOffer);

// Offer Ulashish & Nusxa olish
btnShareOffer.addEventListener('click', () => {
    if (lastOfferData) {
        shareData('offer.json', JSON.stringify(lastOfferData, null, 2), 'WebRTC Taklifi (Offer)');
    }
});

btnCopyOffer.addEventListener('click', async () => {
    if (lastOfferData) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(lastOfferData));
            showToast('Offer kodi xotiraga nusxalandi!', 'success');
        } catch {
            showToast('Nusxalab bo\'lmadi', 'error');
        }
    }
});

// Answer Ulashish, Nusxa olish & Qayta yuklash
btnDownloadAnswerManual.addEventListener('click', () => {
    if (lastAnswerData) {
        downloadFile(JSON.stringify(lastAnswerData, null, 2), 'answer.json');
        showToast('answer.json yuklandi', 'info');
    }
});

btnShareAnswer.addEventListener('click', () => {
    if (lastAnswerData) {
        shareData('answer.json', JSON.stringify(lastAnswerData, null, 2), 'WebRTC Javobi (Answer)');
    }
});

btnCopyAnswer.addEventListener('click', async () => {
    if (lastAnswerData) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(lastAnswerData));
            showToast('Answer kodi nusxalandi!', 'success');
        } catch {
            showToast('Nusxalab bo\'lmadi', 'error');
        }
    }
});

// Xotiradan joylash (Paste)
btnPasteAnswer.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        handleProcessAnswer(text);
    } catch (err) {
        showToast('Xotiradan o\'qib bo\'lmadi: ' + err.message, 'warning');
    }
});

btnPasteOffer.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        handleProcessOffer(text);
    } catch (err) {
        showToast('Xotiradan o\'qib bo\'lmadi: ' + err.message, 'warning');
    }
});

// Loglarni tozalash
btnClearLogs.addEventListener('click', () => {
    logsContainer.innerHTML = '';
    addLog('Jurnal tozalandi', 'info');
});

// Drag & Drop
function setupDropZone(dropZone, fileInput, onFileSelected) {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            readFile(files[0], onFileSelected);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            readFile(files[0], onFileSelected);
        }
    });
}

setupDropZone(callerDropZone, answerFileInput, handleProcessAnswer);
setupDropZone(calleeDropZone, offerFileInput, handleProcessOffer);

// =============================================================================
// PWA & Service Worker
// =============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker ro\'yxatdan o\'tdi'))
            .catch(err => console.warn('Service Worker xatosi:', err));
    });
}

// "Ilovani o'rnatish" tugmasini boshqarish
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstallApp.classList.remove('hidden');
});

btnInstallApp.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            showToast('Ilova o\'rnatilmoqda...', 'success');
        }
        deferredInstallPrompt = null;
        btnInstallApp.classList.add('hidden');
    }
});

addLog('Dastur tayyor. Google STUN: stun.l.google.com:19302', 'info');
