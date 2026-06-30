JavaScript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
// CORS設定を追加して、どこからでも通信できるようにする
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// HTMLや画像などの静的ファイルを配置するフォルダを指定
app.use(express.static(path.join(__dirname, 'public')));

let players = { red: null, blue: null };
let timeLeft = 45;
let timerInterval = null;

function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            io.emit('timeUpdate', timeLeft);
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            io.emit('gameOver');
        }
    }, 1000);
}

io.on('connection', (socket) => {
    // 空いている役割を割り当て
    let role = 'spectator';
    if (!players.red) {
        players.red = socket.id;
        role = 'red';
    } else if (!players.blue) {
        players.blue = socket.id;
        role = 'blue';
    }

    socket.emit('assignPlayer', role);
    if (players.red && players.blue) startTimer();

    // プレイヤーの移動を同期
    socket.on('updateInput', (data) => {
        socket.broadcast.emit('playerMoved', data);
    });

    // パックとスコアの同期（赤が送信したものを全員に転送）
    socket.on('updatePuckAndScores', (data) => {
        socket.broadcast.emit('syncPuckAndScores', data);
    });

    // リトライ要求
    socket.on('requestRetry', () => {
        timeLeft = 45;
        io.emit('gameReset');
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        startTimer();
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        if (socket.id === players.red) players.red = null;
        if (socket.id === players.blue) players.blue = null;
    });
});

// Renderなどのクラウドが指定するポート、または3000番で起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});