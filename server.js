const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

let waitingPlayer = null;
let games = {};
const leaderboard = [];

app.get('/', (req, res) => res.render('index'));
app.get('/game', (req, res) => {
    const nickname = req.query.nickname;
    if (!nickname) return res.redirect('/');
    res.render('game', { nickname });
});
app.get('/leaderboard', (req, res) => res.json(leaderboard));

io.on('connection', socket => {
    socket.on('join', nickname => {
        socket.nickname = nickname;
        if (waitingPlayer) {
            // Start game
            const room = socket.id + '#' + waitingPlayer.id;
            socket.join(room);
            waitingPlayer.join(room);
            games[room] = {
                board: Array(9).fill(null),
                turn: 'X',
                players: [
                    { socket: waitingPlayer, nickname: waitingPlayer.nickname, symbol: 'X' },
                    { socket: socket, nickname: nickname, symbol: 'O' }
                ],
                startTime: Date.now()
            };
            waitingPlayer.emit('gameStart', { symbol: 'X', opponent: nickname });
            socket.emit('gameStart', { symbol: 'O', opponent: waitingPlayer.nickname });
            waitingPlayer.room = room;
            socket.room = room;
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting');
        }
    });

    socket.on('move', index => {
        const room = socket.room;
        if (!room || !games[room]) return;
        const game = games[room];
        if (game.board[index]) return;
        const player = game.players.find(p => p.socket === socket);
        if (game.turn !== player.symbol) return;
        game.board[index] = player.symbol;
        game.turn = player.symbol === 'X' ? 'O' : 'X';
        io.to(room).emit('move', { index, symbol: player.symbol, nextTurn: game.turn });
        // Check for win/draw
        const winCombos = [
            [0,1,2],[3,4,5],[6,7,8],
            [0,3,6],[1,4,7],[2,5,8],
            [0,4,8],[2,4,6]
        ];
        const winner = winCombos.find(combo =>
            combo.every(i => game.board[i] === player.symbol)
        );
        if (winner) {
            io.to(room).emit('gameover', { winner: player.nickname });
            leaderboard.push({ player: player.nickname, time: Date.now() - game.startTime });
            leaderboard.sort((a, b) => a.time - b.time);
            if (leaderboard.length > 10) leaderboard.length = 10;
            delete games[room];
        } else if (game.board.every(cell => cell)) {
            io.to(room).emit('gameover', { winner: null });
            delete games[room];
        }
    });

    socket.on('playAgain', () => {
        socket.room = null;
        socket.nickname = socket.nickname || "Hráč";
        socket.emit('waiting');
        if (waitingPlayer) {
            const nickname = socket.nickname;
            const room = socket.id + '#' + waitingPlayer.id;
            socket.join(room);
            waitingPlayer.join(room);
            games[room] = {
                board: Array(9).fill(null),
                turn: 'X',
                players: [
                    { socket: waitingPlayer, nickname: waitingPlayer.nickname, symbol: 'X' },
                    { socket: socket, nickname: nickname, symbol: 'O' }
                ],
                startTime: Date.now()
            };
            waitingPlayer.emit('gameStart', { symbol: 'X', opponent: nickname });
            socket.emit('gameStart', { symbol: 'O', opponent: waitingPlayer.nickname });
            waitingPlayer.room = room;
            socket.room = room;
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        if (socket.room && games[socket.room]) {
            socket.to(socket.room).emit('opponent_left');
            delete games[socket.room];
        }
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));