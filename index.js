const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// player
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
    width: 40,
    height: 40,
    speed: 6,
    dx: 0
};

// bullets
const bullets = [];

// enemies
const enemies = [];
const enemySpeed = 2;

// score + timer
let score = 0;
let timeLeft = 30;
let gameRunning = true;

function drawPlayer() {
    ctx.fillStyle = "skyblue";
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawBullets() {
    ctx.fillStyle = "yellow";
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
}

function updateBullets() {
    bullets.forEach((b, index) => {
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(index, 1);
    });
}

function spawnEnemy() {
    const size = 40;
    enemies.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size
    });
}

function drawEnemies() {
    ctx.fillStyle = "red";
    enemies.forEach(e => ctx.fillRect(e.x, e.y, e.size, e.size));
}

function updateEnemies() {
    enemies.forEach((e, eIndex) =>{
        e.y += enemySpeed;

        // if enemy hits bottom
        if (e.y > canvas.height) {
            score -= 2;
            enemies.splice(eIndex, 1);
        }

        // collision with bullets
        bullets.forEach((b, bIndex) => {
            if (
                b.x < e.x + e.size &&
                b.x + b.width > e.x &&
                b.y < e.y + e.size &&
                b.y + b.height > e.y
            ) {
                score += 5;
                enemies.splice(eIndex, 1);
                bullets.splice(bIndex, 1);
            }
        });
    });
}

function updatePlayer() {
    player.x += player.dx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

function fireBullet() {
    bullets.push({
        x: player.x + player.width / 2 - 3,
        y: player.y,
        width: 6,
        height: 15,
        speed: 8
    });
}

function update() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    drawBullets();
    drawEnemies();

    updatePlayer();
    updateBullets();
    updateEnemies();

    document.getElementById("scoreDisplay").innerText = `Score: ${score}`;

    requestAnimationFrame(update);
}

// timer
const timer = setInterval(() => {
    timeLeft--;
    document.getElementById("timerDisplay").innerText = `Time: ${timeLeft}`;
    if (timeLeft <= 0) {
        gameRunning = false;
        clearInterval(timer);
        alert(`Game Over! Final Score: ${score}`);
    }
}, 1000);

// enemy spawn rate
setInterval(() => {
    if (gameRunning) spawnEnemy();
}, 900);

// controls
document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") player.dx = -player.speed;
    if (e.key === "ArrowRight") player.dx = player.speed;
    if (e.key === " ") fireBullet();
});

document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
});

update();