const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// هذا السطر ضروري ليعرف Render أي منفذ يستخدم
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // لتقديم ملفات HTML/JS

// تخزين بيانات المستخدمين (يمكن استبداله بقاعدة بيانات مثل MongoDB لاحقاً)
let users = {
    "user_123": { coins: 100, name: "Ahmed" }
};

// وظيفة خصم العملات أثناء المكالمة
function deductCoins(userId) {
    if (users[userId] && users[userId].coins > 0) {
        users[userId].coins -= 1; // خصم عملة واحدة كل دقيقة مثلاً
        return true;
    }
    return false; // الرصيد نفد!
}

// غلاف للتوضيح يمكن تغييره لاحقاً
function deductCoinsFromUser(userId) {
    return deductCoins(userId);
}

// إدارة مؤقتات المكالمات
let callIntervals = {}; // لتخزين المؤقت الخاص بكل مكالمة

function stopCall(roomId) {
    if (callIntervals[roomId]) {
        clearInterval(callIntervals[roomId]);
        delete callIntervals[roomId];
    }
}

let waitingUser = null;

io.on('connection', (socket) => {
    console.log('مستخدم متصل:', socket.id);

    // عندما يضغط المستخدم على "بدء"
    socket.on('find-match', () => {
        if (waitingUser) {
            // إذا كان هناك شخص ينتظر، نربطهما معاً
            socket.emit('match-found', { targetId: waitingUser.id, role: 'offerer' });
            waitingUser.emit('match-found', { targetId: socket.id, role: 'answerer' });
            waitingUser = null;
        } else {
            // إذا لم يوجد أحد، نضعه في قائمة الانتظار
            waitingUser = socket;
        }
    });

    // تبادل بيانات WebRTC (Signaling)
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
    });

    // عندما تبدأ المكالمة فعلياً بين الطرفين
    socket.on('start-call-timer', (data) => {
        const roomId = data.roomId;
        // من الأفضل أن نُعيّن socket.userId عند المصادقة/اتصال المستخدم في سيناريو حقيقي
        socket.userId = data.userId;

        // إعداد مؤقت يخصم عملة كل 60 ثانية
        callIntervals[roomId] = setInterval(() => {
            // منطق الخصم من قاعدة البيانات
            const hasCoins = deductCoinsFromUser(socket.userId);
            
            if (hasCoins) {
                // إرسال الرصيد الجديد للمستخدم
                socket.emit('update-coins', { newBalance: users[socket.userId].coins });
            } else {
                // إذا نفدت العملات، اقطع المكالمة فوراً
                socket.emit('insufficient-funds');
                stopCall(roomId);
            }
        }, 60000); // 60000 مللي ثانية = دقيقة واحدة
    });

    socket.on('disconnect', () => {
        // تنظيف المؤقت عند إغلاق المتصفح
        clearInterval(callIntervals[socket.id]);
    });
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});