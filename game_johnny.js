// ====================================
// CANVAS + CONTEXTO
// ====================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const shootSound = document.getElementById("shootSound");
shootSound.volume = 0.4; 


// ====================================
// GAME STATE
// ====================================
let gameState = "menu"; 
let level = 1;
let score = 0;
let health = 100;
let animationId = null;
let enemySpawnInterval = null;
let lastTime = Date.now();
let gamePaused = false;

// ====================================
// PLAYER / BULLETS / ENEMIES
// ====================================
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
    width: 40,
    height: 40,
    speed: 6,
    dx: 0,
    blinking: false,
    blinkTimer: 0
};

const upgrades = {
    damage: 1,
    fireRate: 1,
    bulletSpeed: 1,
    multiShot: false
};

const bullets = [];
const enemies = [];
const keys = {};

let lastShot = 0;
let enemiesDestroyed = 0;

// ====================================
// LEVEL CONFIG
// ====================================
function getLevelConfig(lvl) {
    return {
        enemiesRequired: 10 + (lvl * 5),
        enemySpeed: 1.5 + (lvl * 0.3),
        enemyHealth: lvl,
        spawnRate: Math.max(600, 1200 - lvl * 100),
        enemyDamage: 8 + lvl * 2
    };
}

// ====================================
// DRAW FUNCTIONS
// ====================================
function drawPlayer() {
    let colorBody = "#4FC3F7";   // azul normal
    let colorOutline = "#0288D1";
    let colorCore = "#00BCD4";

    if (player.blinking) {
        player.blinkTimer--;

        // alternar entre azul y blanco
        let blinkOn = (player.blinkTimer % 10) < 5;
        if (blinkOn) {
            colorBody = "#FFFFFF";  // blanco
            colorOutline = "#FFFFFF";  
            colorCore = "#FFFFFF";
        }

        if (player.blinkTimer <= 0) {
            player.blinking = false;
        }
    }

    // Body
    ctx.fillStyle = colorBody;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Outline
    ctx.strokeStyle = colorOutline;
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y, player.width, player.height);

    // Core (centro)
    ctx.fillStyle = colorCore;
    ctx.fillRect(player.x + 15, player.y + 15, 10, 10);
}

function drawBullets() {
    bullets.forEach(b => {
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(b.x, b.y, b.width, b.height);
    });
}

function drawEnemies() {
    enemies.forEach(e => {
        ctx.fillStyle = e.health > 1 ? "#F44336" : "#FF5722";
        ctx.fillRect(e.x, e.y, e.size, e.size);

        // Enemy face
        ctx.fillStyle = "#B71C1C";
        ctx.fillRect(e.x + 10, e.y + 10, 20, 5);
        ctx.fillRect(e.x + 10, e.y + 25, 20, 5);

        // Health bar
        if (e.health < e.maxHealth) {
            ctx.fillStyle = "#333";
            ctx.fillRect(e.x, e.y - 8, e.size, 4);
            ctx.fillStyle = "#4CAF50";
            ctx.fillRect(e.x, e.y - 8, e.size * (e.health / e.maxHealth), 4);
        }
    });
}

function drawStarfield(time) {
    for (let i = 0; i < 50; i++) {
        const x = (i * 137.5) % canvas.width;
        const y = (i * 217.3 + time * 0.1) % canvas.height;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawUI() {
    const cfg = getLevelConfig(level);

    ctx.fillStyle = "#FFF";
    ctx.font = "16px monospace";

    ctx.fillText(`Level: ${level}`, 10, 20);
    ctx.fillText(`Score: ${score}`, 10, 40);
    ctx.fillText(`Enemies: ${enemiesDestroyed}/${cfg.enemiesRequired}`, 10, 60);

    // Health bar
    ctx.fillStyle = "#333";
    ctx.fillRect(canvas.width - 210, 10, 200, 20);

    ctx.fillStyle =
        health > 50 ? "#4CAF50" :
        health > 25 ? "#FF9800" :
        "#F44336";

    ctx.fillRect(canvas.width - 210, 10, 200 * (health / 100), 20);

    ctx.strokeStyle = "#FFF";
    ctx.strokeRect(canvas.width - 210, 10, 200, 20);
}

// ====================================
// UPDATE FUNCTIONS
// ====================================
function updatePlayer() {
    player.x += player.dx;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function updateBullets() {
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < -20) bullets.splice(i, 1);
    });
}

function updateEnemies() {
    const cfg = getLevelConfig(level);

    enemies.forEach((e, i) => {
        e.y += e.speed;

        // Enemy hits bottom
        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            damagePlayer(cfg.enemyDamage);
            return;
        }

        // Collisions
        bullets.forEach((b, bi) => {
            if (
                b.x < e.x + e.size &&
                b.x + b.width > e.x &&
                b.y < e.y + e.size &&
                b.y + b.height > e.y
            ) {
                e.health -= upgrades.damage;
                bullets.splice(bi, 1);

                if (e.health <= 0) {
                    enemies.splice(i, 1);
                    enemiesDestroyed++;
                    score += 10 * level;

                    if (enemiesDestroyed >= cfg.enemiesRequired) {
                        completeLevel();
                    }
                }
            }
        });
    });
}

// ====================================
// DAMAGE / BLINK EFFECT
// ====================================
function damagePlayer(amount) {
    health -= amount;

    player.blinking = true;
    player.blinkTimer = 30;

    if (health <= 0) {
        health = 0;
        endGame();
    }
}

// ====================================
// SHOOTING
// ====================================
function fireBullet() {
    const now = Date.now();
    const delay = 300 / upgrades.fireRate;

    if (now - lastShot < delay) return;
    lastShot = now;

    // Reproduce sonido SIN LAG (reinicia playback rápido)
    shootSound.currentTime = 0;
    shootSound.play().catch(() => {});

    const baseSpeed = 8 + upgrades.bulletSpeed * 2;

    if (upgrades.multiShot) {
        [-15, 0, 15].forEach(offset => {
            bullets.push({
                x: player.x + player.width / 2 - 3 + offset,
                y: player.y,
                width: 6,
                height: 15,
                speed: baseSpeed
            });
        });
    } else {
        bullets.push({
            x: player.x + player.width / 2 - 3,
            y: player.y,
            width: 6,
            height: 15,
            speed: baseSpeed
        });
    }
}


// ====================================
// ENEMY SPAWNING
// ====================================
function spawnEnemy() {
    const cfg = getLevelConfig(level);

    const size = 40;

    enemies.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        size,
        speed: cfg.enemySpeed,
        health: cfg.enemyHealth,
        maxHealth: cfg.enemyHealth
    });
}

function startEnemySpawning() {
    if (enemySpawnInterval) clearInterval(enemySpawnInterval);

    const cfg = getLevelConfig(level);

    enemySpawnInterval = setInterval(() => {
        if (gameState === "playing") spawnEnemy();
    }, cfg.spawnRate);
}

// ====================================
// GAME LOOP
// ====================================
function gameLoop() {
    if (gameState !== "playing") return;

    const now = Date.now();
    lastTime = now;

    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStarfield(now);
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawUI();

    updatePlayer();
    updateBullets();
    updateEnemies();

    if (keys[" "]) fireBullet();

    animationId = requestAnimationFrame(gameLoop);
}

// ====================================
// SCREEN + LEVEL CONTROL
// ====================================
function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(name + "Screen").classList.add("active");
}

function startGame() {
    const music = document.getElementById("bgMusic");
    music.volume = 0.35; 
    music.play().catch(() => {});
    level = 1;
    score = 0;
    health = 100;
    upgrades.damage = 1;
    upgrades.fireRate = 1;
    upgrades.bulletSpeed = 1;
    upgrades.multiShot = false;

    resetLevel();
    showScreen("game");

    gameState = "playing";
    gamePaused = false;

    lastTime = Date.now();
    startEnemySpawning();
    gameLoop();
}

function resetLevel() {
    bullets.length = 0;
    enemies.length = 0;
    enemiesDestroyed = 0;
    player.x = canvas.width / 2 - 20;
}

function completeLevel() {
    gameState = "levelComplete";
    cancelAnimationFrame(animationId);
    clearInterval(enemySpawnInterval);

    document.getElementById("levelCompleteScore").textContent = `Score: ${score}`;
    updateUpgradeButtons();

    showScreen("levelComplete");
}

function endGame() {
    gameState = "gameOver";
    cancelAnimationFrame(animationId);
    clearInterval(enemySpawnInterval);

    document.getElementById("finalScore").textContent = `Final Score: ${score}`;
    document.getElementById("finalLevel").textContent = `Reached Level: ${level}`;

    showScreen("gameOver");
}

function selectUpgrade(name) {
    if (name === "multiShot") {
        upgrades.multiShot = true;
    } else {
        upgrades[name]++;
    }

    level++;
    health = 100;

    resetLevel();

    gameState = "playing";
    showScreen("game");

    lastTime = Date.now();
    startEnemySpawning();
    gameLoop();
}

function updateUpgradeButtons() {
    document.getElementById("damageLevel").textContent = `Level ${upgrades.damage}/5`;
    document.querySelector('[data-upgrade="damage"]').disabled = upgrades.damage >= 5;

    document.getElementById("fireRateLevel").textContent = `Level ${upgrades.fireRate}/5`;
    document.querySelector('[data-upgrade="fireRate"]').disabled = upgrades.fireRate >= 5;

    document.getElementById("bulletSpeedLevel").textContent = `Level ${upgrades.bulletSpeed}/5`;
    document.querySelector('[data-upgrade="bulletSpeed"]').disabled = upgrades.bulletSpeed >= 5;

    document.getElementById("multiShotLevel").textContent = upgrades.multiShot ? "Unlocked" : "Locked";
    document.querySelector('[data-upgrade="multiShot"]').disabled = upgrades.multiShot;
}

// ====================================
// PAUSE / RESUME / RESTART / MENU
// ====================================
function pauseGame() {
    if (gameState !== "playing") return;

    gamePaused = true;
    gameState = "paused";

    cancelAnimationFrame(animationId);
    clearInterval(enemySpawnInterval);

    document.getElementById("pauseBtn").textContent = "Resume";
    document.getElementById("bgMusic").pause();

}

function resumeGame() {
    if (gameState !== "paused") return;

    gamePaused = false;
    gameState = "playing";

    document.getElementById("pauseBtn").textContent = "Pause";

    lastTime = Date.now();
    startEnemySpawning();
    gameLoop();
    document.getElementById("bgMusic").play().catch(() => {});

}

function togglePause() {
    if (gameState !== "playing" && gameState !== "paused") return;

    if (gamePaused) resumeGame();
    else pauseGame();
}

function restartLevelButton() {
    cancelAnimationFrame(animationId);
    clearInterval(enemySpawnInterval);

    gamePaused = false;
    gameState = "playing";

    resetLevel();
    lastTime = Date.now();
    startEnemySpawning();
    gameLoop();
    document.getElementById("bgMusic").play().catch(() => {});
}

function returnToMenu() {
    cancelAnimationFrame(animationId);
    clearInterval(enemySpawnInterval);

    score = 0;
    level = 1;
    health = 100;

    gamePaused = false;
    gameState = "menu";

    document.getElementById("pauseBtn").textContent = "Pause";

    showScreen("menu");
    document.getElementById("bgMusic").pause();
}

// ====================================
// EVENT LISTENERS
// ====================================
document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("restartButton").addEventListener("click", startGame);

// Upgrades
document.querySelectorAll(".upgrade-btn").forEach(btn => {
    btn.addEventListener("click", e => {
        const upgrade = e.currentTarget.getAttribute("data-upgrade");
        selectUpgrade(upgrade);
    });
});

// TOP BUTTONS
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("restartLevelBtn").addEventListener("click", restartLevelButton);
document.getElementById("menuBtn").addEventListener("click", returnToMenu);

// Keyboard
document.addEventListener("keydown", e => {
    keys[e.key] = true;

    if (e.key === "ArrowLeft") player.dx = -player.speed;
    if (e.key === "ArrowRight") player.dx = player.speed;
});

document.addEventListener("keyup", e => {
    keys[e.key] = false;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
});

// Canvas click = toggle pause
canvas.addEventListener("click", () => {
    if (gameState === "playing" || gameState === "paused") togglePause();
});
