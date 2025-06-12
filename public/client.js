const socket = io();
const board = document.getElementById('board');
const statusDiv = document.getElementById('status');
const playAgainBtn = document.getElementById('play-again');
let mySymbol = null;
let myTurn = false;

function resetBoard() {
    board.querySelectorAll('.cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('disabled');
    });
}

function startGame(symbol, opponent) {
    mySymbol = symbol;
    myTurn = symbol === 'X';
    statusDiv.textContent = myTurn ? 'Jsi na tahu. Protihráč: ' + opponent : 'Čekáš na soupeře... Protihráč: ' + opponent;
    resetBoard();
    playAgainBtn.style.display = 'none';
}

socket.emit('join', window.nickname);

socket.on('waiting', () => {
    statusDiv.textContent = 'Čekám na soupeře...';
});

socket.on('gameStart', ({ symbol, opponent }) => {
    startGame(symbol, opponent);
});

board.addEventListener('click', e => {
    if (!myTurn) return;
    if (e.target.classList.contains('cell') && !e.target.textContent) {
        const index = e.target.dataset.index;
        socket.emit('move', index);
    }
});

socket.on('move', ({ index, symbol, nextTurn }) => {
    const cell = board.querySelector(`[data-index="${index}"]`);
    if (cell) cell.textContent = symbol;
    myTurn = nextTurn === mySymbol;
    statusDiv.textContent = myTurn ? 'Jsi na tahu.' : 'Čekáš na soupeře...';
});

socket.on('gameover', ({ winner }) => {
    if (winner === null) {
        statusDiv.textContent = 'Remíza!';
    } else if (winner === window.nickname) {
        statusDiv.textContent = 'Vyhrál jsi!';
    } else {
        statusDiv.textContent = `Vyhrál: ${winner}`;
    }
    board.querySelectorAll('.cell').forEach(cell => cell.classList.add('disabled'));
    playAgainBtn.style.display = 'block';
});

socket.on('opponent_left', () => {
    statusDiv.textContent = 'Soupeř odešel. Hra ukončena.';
    board.querySelectorAll('.cell').forEach(cell => cell.classList.add('disabled'));
    playAgainBtn.style.display = 'block';
});

playAgainBtn.addEventListener('click', () => {
    socket.emit('playAgain');
    playAgainBtn.style.display = 'none';
    statusDiv.textContent = 'Čekám na soupeře...';
    resetBoard();
});