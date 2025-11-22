// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game state
let gameState = "menu"; // menu, playing, levelComplete, gameOver
let level = 1;
let score = 0;
let health = 100;

// Upgrades
const upgrades = {
    damage: 1,
    fireRate: 1,
    bulletSpeed: 1,
    multiShot: false
};

// Game objects
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
    width: 40,
    height: 40,
    speed: 6,
    dx: 0
};

const bullets = [];
const enemies = [];
const keys = {};
let lastShot = 0;
let enemiesDestroyed = 0;
let enemiesSpawned = 0;
let animationId = null;
let spawnTimer = 0;
let lastTime = Date.now();
let enemySpawnInterval = null;

// Level configuration
function getLevelConfig(lvl) {
    return {
        enemiesRequired: 10 + (lvl * 5),
        enemySpeed: 1.5 + (lvl * 0.3),
        enemyHealth: lvl,
        spawnRate: Math.max(600, 1200 - (lvl * 100)),
        enemyDamage: 5 + (lvl * 2)
    };
}

// Drawing functions
function drawPlayer() {
    ctx.fillStyle = "#4FC3F7";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.strokeStyle = "#0288D1";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y, player.width, player.height);
    
    // Player core
    ctx.fillStyle = "#00BCD4";
    ctx.fillRect(player.x + 15, player.y + 15, 10, 10);
}

function drawBullets() {
    bullets.forEach(b => {
        ctx.fillStyle = "#FFEB3B";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#FFEB3B";
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.shadowBlur = 0;
    });
}

function drawEnemies() {
    enemies.forEach(e => {
        // Enemy body
        ctx.fillStyle = e.health > 1 ? "#F44336" : "#FF5722";
        ctx.fillRect(e.x, e.y, e.size, e.size);
        
        // Enemy details
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
        const y = (i * 217.3 + time * 0.01) % canvas.height;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
        ctx.fillRect(x, y, 1, 1);
    }
}

function drawUI() {
    const config = getLevelConfig(level);
    
    ctx.fillStyle = "#FFF";
    ctx.font = "14px monospace";
    ctx.fillText(`Level: ${level}`, 10, 20);
    ctx.fillText(`Score: ${score}`, 10, 40);
    ctx.fillText(`Enemies: ${enemiesDestroyed}/${config.enemiesRequired}`, 10, 60);
    
    // Health bar
    ctx.fillStyle = "#333";
    ctx.fillRect(canvas.width - 210, 10, 200, 20);
    ctx.fillStyle = health > 50 ? "#4CAF50" : health > 25 ? "#FF9800" : "#F44336";
    ctx.fillRect(canvas.width - 210, 10, 200 * (health / 100), 20);
    ctx.strokeStyle = "#FFF";
    ctx.strokeRect(canvas.width - 210, 10, 200, 20);
    ctx.fillStyle = "#FFF";
    ctx.fillText(`HP: ${health}`, canvas.width - 200, 25);
}

// Update functions
function updatePlayer() {
    player.x += player.dx;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        if (bullets[i].y < -bullets[i].height) {
            bullets.splice(i, 1);
        }
    }
}

function updateEnemies() {
    const config = getLevelConfig(level);
    
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        const e = enemies[eIndex];
        e.y += e.speed;

        // Enemy reaches bottom
        if (e.y > canvas.height) {
            health -= config.enemyDamage;
            enemies.splice(eIndex, 1);
            
            if (health <= 0) {
                health = 0;
                endGame();
            }
            continue;
        }

        // Bullet collision
        for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
            const b = bullets[bIndex];
            
            if (
                b.x < e.x + e.size &&
                b.x + b.width > e.x &&
                b.y < e.y + e.size &&
                b.y + b.height > e.y
            ) {
                e.health -= upgrades.damage;
                bullets.splice(bIndex, 1);
                
                if (e.health <= 0) {
                    score += (10 * level);
                    enemies.splice(eIndex, 1);
                    enemiesDestroyed++;
                    
                    if (enemiesDestroyed >= config.enemiesRequired) {
                        completeLevel();
                    }
                }
                break;
            }
        }
    }
}

function fireBullet() {
    const now = Date.now();
    const fireDelay = 300 / upgrades.fireRate;
    
    if (now - lastShot > fireDelay) {
        const bulletSpeed = 8 + (upgrades.bulletSpeed * 2);
        
        if (upgrades.multiShot) {
            // Triple shot
            [-15, 0, 15].forEach(offset => {
                bullets.push({
                    x: player.x + player.width / 2 - 3 + offset,
                    y: player.y,
                    width: 6,
                    height: 15,
                    speed: bulletSpeed
                });
            });
        } else {
            bullets.push({
                x: player.x + player.width / 2 - 3,
                y: player.y,
                width: 6,
                height: 15,
                speed: bulletSpeed
            });
        }
        
        lastShot = now;
    }
}

function spawnEnemy() {
    const config = getLevelConfig(level);
    const size = 40;
    
    enemies.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size,
        health: config.enemyHealth,
        maxHealth: config.enemyHealth,
        speed: config.enemySpeed
    });
    
    enemiesSpawned++;
}

// Game loop
function gameLoop() {
    if (gameState !== "playing") return;
    
    const now = Date.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw everything
    drawStarfield(now);
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawUI();

    // Update everything
    updatePlayer();
    updateBullets();
    updateEnemies();

    // Auto-fire if space is held
    if (keys[" "]) {
        fireBullet();
    }

    animationId = requestAnimationFrame(gameLoop);
}

// Screen management
function showScreen(screenName) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(screenName + "Screen").classList.add("active");
}

function startGame() {
    gameState = "playing";
    level = 1;
    score = 0;
    health = 100;
    upgrades.damage = 1;
    upgrades.fireRate = 1;
    upgrades.bulletSpeed = 1;
    upgrades.multiShot = false;
    
    resetLevel();
    showScreen("game");
    lastTime = Date.now();
    gameLoop();
    startEnemySpawning();
}

function resetLevel() {
    enemiesDestroyed = 0;
    enemiesSpawned = 0;
    bullets.length = 0;
    enemies.length = 0;
    spawnTimer = 0;
    player.x = canvas.width / 2 - 20;
}

function startEnemySpawning() {
    if (enemySpawnInterval) {
        clearInterval(enemySpawnInterval);
    }
    
    const config = getLevelConfig(level);
    enemySpawnInterval = setInterval(() => {
        if (gameState === "playing" ) {
            spawnEnemy();
        }
    }, config.spawnRate);
}

function completeLevel() {
    gameState = "levelComplete";
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (enemySpawnInterval) {
        clearInterval(enemySpawnInterval);
    }
    
    document.getElementById("levelCompleteScore").textContent = `Score: ${score}`;
    updateUpgradeButtons();
    showScreen("levelComplete");
}

function endGame() {
    gameState = "gameOver";
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (enemySpawnInterval) {
        clearInterval(enemySpawnInterval);
    }
    
    document.getElementById("finalScore").textContent = `Final Score: ${score}`;
    document.getElementById("finalLevel").textContent = `Reached Level: ${level}`;
    showScreen("gameOver");
}

function selectUpgrade(upgradeName) {
    if (upgradeName === "multiShot") {
        upgrades.multiShot = true;
    } else {
        upgrades[upgradeName]++;
    }
    
    level++;
    health = 100;
    resetLevel();
    gameState = "playing";
    showScreen("game");
    lastTime = Date.now();
    gameLoop();
    startEnemySpawning();
}

function updateUpgradeButtons() {
    // Update damage button
    const damageBtn = document.querySelector('[data-upgrade="damage"]');
    document.getElementById("damageLevel").textContent = `Level ${upgrades.damage}/5`;
    damageBtn.disabled = upgrades.damage >= 5;
    
    // Update fire rate button
    const fireRateBtn = document.querySelector('[data-upgrade="fireRate"]');
    document.getElementById("fireRateLevel").textContent = `Level ${upgrades.fireRate}/5`;
    fireRateBtn.disabled = upgrades.fireRate >= 5;
    
    // Update bullet speed button
    const bulletSpeedBtn = document.querySelector('[data-upgrade="bulletSpeed"]');
    document.getElementById("bulletSpeedLevel").textContent = `Level ${upgrades.bulletSpeed}/5`;
    bulletSpeedBtn.disabled = upgrades.bulletSpeed >= 5;
    
    // Update multi-shot button
    const multiShotBtn = document.querySelector('[data-upgrade="multiShot"]');
    document.getElementById("multiShotLevel").textContent = upgrades.multiShot ? "Unlocked" : "Locked";
    multiShotBtn.disabled = upgrades.multiShot;
}

// Event listeners
document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("restartButton").addEventListener("click", startGame);

document.querySelectorAll(".upgrade-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const upgrade = e.currentTarget.getAttribute("data-upgrade");
        selectUpgrade(upgrade);
    });
});

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    
    if (e.key === "ArrowLeft") {
        player.dx = -player.speed;
    }
    if (e.key === "ArrowRight") {
        player.dx = player.speed;
    }
    if (e.key === " ") {
        e.preventDefault();
    }
});

document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        player.dx = 0;
    }
});