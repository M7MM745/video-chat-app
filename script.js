const startBtn = document.getElementById('startBtn');
const localVideo = document.getElementById('localVideo');

const socket = io();
let peer;
let localStream; // سيتم ملؤه عند الحصول على البث من الكاميرا
let coinBalance = 100; // الرصيد الابتدائي
let currentRoomId; // سيُحدد عندما تنشأ الغرفة

startBtn.addEventListener('click', async () => {
    try {
        // طلب الوصول للكاميرا والميكروفون
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        // عرض البث المباشر في عنصر الفيديو
        localVideo.srcObject = stream;
        localStream = stream;
        
        startBtn.innerText = "جاري البحث عن شريك...";
    } catch (error) {
        console.error("خطأ في الوصول للكاميرا:", error);
        alert("يرجى السماح بالوصول للكاميرا للمتابعة");
    }
});

// عند العثور على شريك
socket.on('match-found', (data) => {
    const isOfferer = data.role === 'offerer';
    
    peer = new SimplePeer({
        initiator: isOfferer,
        trickle: false,
        stream: localStream // البث الذي حصلنا عليه من الكاميرا
    });

    peer.on('signal', signal => {
        socket.emit('signal', { to: data.targetId, signal });
    });

    peer.on('stream', stream => {
        document.getElementById('remoteVideo').srcObject = stream;
    });
});

socket.on('signal', data => {
    if (peer) {
        peer.signal(data.signal);
    }
});

// تحديث الواجهة عند استلام إشارة من السيرفر
socket.on('update-coins', (data) => {
    coinBalance = data.newBalance;
    document.getElementById('coinCount').innerText = coinBalance;
});

// إذا استلمنا رسالة "الرصيد نفد"
socket.on('insufficient-funds', () => {
    alert("عذراً، رصيدك نفد! يرجى الشحن للمتابعة.");
    location.reload(); // إغلاق المكالمة
});

// دالة البدء (تُستدعى عند نجاح اتصال WebRTC)
function onCallConnected() {
    if (currentRoomId) {
        socket.emit('start-call-timer', { roomId: currentRoomId });
    }
}