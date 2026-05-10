const ROWS = 5;
const COLS = 9;
const TARGET_ZOMBIES = 20;
const CELL_GAP = 6;

const PLANTS = {
  sunflower: {
    name: "向日葵",
    cost: 50,
    maxHp: 90,
    cooldown: 4200,
    sunInterval: 7600,
    sunValue: 25
  },
  peashooter: {
    name: "豌豆射手",
    cost: 100,
    maxHp: 110,
    cooldown: 5200,
    shootInterval: 1350,
    damage: 25
  }
};

const ZOMBIE = {
  maxHp: 160,
  speed: 13,
  attackDamage: 18,
  attackInterval: 850,
  spawnInterval: 3100
};

const state = {
  running: true,
  selectedPlant: null,
  sun: 150,
  plants: [],
  zombies: [],
  peas: [],
  suns: [],
  spawned: 0,
  killed: 0,
  lastTime: 0,
  lastSpawn: 0,
  lastSkySun: 0,
  cooldownReady: {
    sunflower: 0,
    peashooter: 0
  }
};

const yard = document.querySelector("#yard");
const sunCount = document.querySelector("#sunCount");
const killCount = document.querySelector("#killCount");
const spawnCount = document.querySelector("#spawnCount");
const targetCount = document.querySelector("#targetCount");
const gameStatus = document.querySelector("#gameStatus");
const restartButton = document.querySelector("#restartButton");
const seedCards = Array.from(document.querySelectorAll(".seed-card"));
const shell = document.querySelector(".game-shell");

targetCount.textContent = TARGET_ZOMBIES;

function makeCell(row, col) {
  const cell = document.createElement("button");
  cell.className = "cell";
  cell.type = "button";
  cell.dataset.row = row;
  cell.dataset.col = col;
  cell.setAttribute("aria-label", `${row + 1} 行 ${col + 1} 列草坪`);
  cell.addEventListener("click", () => plantAt(row, col));
  yard.appendChild(cell);
}

function buildGrid() {
  yard.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      makeCell(row, col);
    }
  }
}

function getYardMetrics() {
  const rect = yard.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    cellWidth: (rect.width - CELL_GAP * (COLS - 1)) / COLS,
    cellHeight: (rect.height - CELL_GAP * (ROWS - 1)) / ROWS
  };
}

function cellCenter(row, col) {
  const metrics = getYardMetrics();
  return {
    x: col * (metrics.cellWidth + CELL_GAP) + metrics.cellWidth / 2,
    y: row * (metrics.cellHeight + CELL_GAP) + metrics.cellHeight / 2
  };
}

function setStatus(text) {
  gameStatus.textContent = text;
}

function canAfford(type) {
  return state.sun >= PLANTS[type].cost;
}

function isReady(type, now = performance.now()) {
  return now >= state.cooldownReady[type];
}

function updateHud(now = performance.now()) {
  sunCount.textContent = state.sun;
  killCount.textContent = state.killed;
  spawnCount.textContent = state.spawned;

  seedCards.forEach((card) => {
    const type = card.dataset.plant;
    const plant = PLANTS[type];
    const remaining = Math.max(0, state.cooldownReady[type] - now);
    const progress = remaining > 0 ? Math.min(100, (remaining / plant.cooldown) * 100) : 0;
    card.classList.toggle("selected", state.selectedPlant === type);
    card.classList.toggle("disabled", !state.running || !canAfford(type) || remaining > 0);
    card.querySelector(".cooldown-bar").style.width = `${progress}%`;
  });
}

function selectPlant(type) {
  if (!state.running) return;

  if (!canAfford(type)) {
    setStatus(`阳光不足，${PLANTS[type].name} 需要 ${PLANTS[type].cost} 阳光。`);
    return;
  }

  if (!isReady(type)) {
    setStatus(`${PLANTS[type].name} 正在冷却。`);
    return;
  }

  state.selectedPlant = type;
  setStatus(`已选择 ${PLANTS[type].name}，点击空草坪种植。`);
  updateHud();
}

function plantAt(row, col) {
  if (!state.running || !state.selectedPlant) return;

  if (state.plants.some((plant) => plant.row === row && plant.col === col)) {
    setStatus("这个格子已经有植物了。选择其他草坪。");
    return;
  }

  const type = state.selectedPlant;
  const config = PLANTS[type];

  if (!canAfford(type) || !isReady(type)) {
    updateHud();
    return;
  }

  const position = cellCenter(row, col);
  const element = document.createElement("div");
  element.className = `plant ${type}`;
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.innerHTML = type === "peashooter" ? '<span class="mouth"></span>' : "";

  const healthBar = document.createElement("span");
  healthBar.className = "health-bar";
  healthBar.innerHTML = '<span class="health-fill"></span>';
  element.appendChild(healthBar);
  yard.appendChild(element);

  state.plants.push({
    id: crypto.randomUUID(),
    type,
    row,
    col,
    x: position.x,
    y: position.y,
    hp: config.maxHp,
    maxHp: config.maxHp,
    element,
    lastAction: performance.now() + 900
  });

  state.sun -= config.cost;
  state.cooldownReady[type] = performance.now() + config.cooldown;
  state.selectedPlant = null;
  setStatus(`${config.name} 已种下。`);
  updateHud();
}

function spawnZombie(now) {
  if (state.spawned >= TARGET_ZOMBIES) return;
  if (now - state.lastSpawn < ZOMBIE.spawnInterval) return;

  const row = Math.floor(Math.random() * ROWS);
  const metrics = getYardMetrics();
  const y = cellCenter(row, COLS - 1).y;
  const x = metrics.width + 34;
  const element = document.createElement("div");
  element.className = "zombie";
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.innerHTML = '<span class="eye"></span><span class="legs"></span><span class="health-bar"><span class="health-fill"></span></span>';
  yard.appendChild(element);

  state.zombies.push({
    id: crypto.randomUUID(),
    row,
    x,
    y,
    hp: ZOMBIE.maxHp,
    maxHp: ZOMBIE.maxHp,
    element,
    lastAttack: 0
  });

  state.spawned += 1;
  state.lastSpawn = now;
  updateHud(now);
}

function createSun(x, y, targetY, source) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = source === "plant" ? "produced-sun" : "falling-sun";
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.setAttribute("aria-label", "收集阳光");
  yard.appendChild(element);

  const sun = {
    id: crypto.randomUUID(),
    x,
    y,
    targetY,
    value: 25,
    ttl: 9000,
    age: 0,
    source,
    element
  };

  element.addEventListener("click", () => collectSun(sun.id));
  state.suns.push(sun);
}

function collectSun(id) {
  const index = state.suns.findIndex((sun) => sun.id === id);
  if (index === -1) return;
  const [sun] = state.suns.splice(index, 1);
  sun.element.remove();
  state.sun += sun.value;
  setStatus(`收集了 ${sun.value} 阳光。`);
  updateHud();
}

function spawnSkySun(now) {
  if (now - state.lastSkySun < 7200) return;
  const metrics = getYardMetrics();
  const x = 55 + Math.random() * Math.max(80, metrics.width - 120);
  const targetY = 55 + Math.random() * Math.max(120, metrics.height - 120);
  createSun(x, -20, targetY, "sky");
  state.lastSkySun = now;
}

function plantActions(now) {
  state.plants.forEach((plant) => {
    const config = PLANTS[plant.type];

    if (plant.type === "sunflower" && now - plant.lastAction >= config.sunInterval) {
      createSun(plant.x + 8, plant.y - 26, plant.y - 26, "plant");
      plant.lastAction = now;
    }

    if (plant.type === "peashooter" && now - plant.lastAction >= config.shootInterval) {
      const target = state.zombies
        .filter((zombie) => zombie.row === plant.row && zombie.x > plant.x)
        .sort((a, b) => a.x - b.x)[0];

      if (target) {
        shootPea(plant, config.damage);
        plant.lastAction = now;
      }
    }
  });
}

function shootPea(plant, damage) {
  const element = document.createElement("span");
  element.className = "pea";
  element.style.left = `${plant.x + 34}px`;
  element.style.top = `${plant.y - 8}px`;
  yard.appendChild(element);

  state.peas.push({
    id: crypto.randomUUID(),
    row: plant.row,
    x: plant.x + 34,
    y: plant.y - 8,
    damage,
    element
  });
}

function updatePeas(dt) {
  const metrics = getYardMetrics();

  state.peas.slice().forEach((pea) => {
    pea.x += 265 * dt;

    const hit = state.zombies.find((zombie) => zombie.row === pea.row && Math.abs(zombie.x - pea.x) < 24);
    if (hit) {
      hit.hp -= pea.damage;
      removePea(pea.id);
      updateHealth(hit);
      return;
    }

    if (pea.x > metrics.width + 40) {
      removePea(pea.id);
      return;
    }

    pea.element.style.left = `${pea.x}px`;
  });
}

function updateZombies(now, dt) {
  state.zombies.slice().forEach((zombie) => {
    const blockingPlant = state.plants
      .filter((plant) => plant.row === zombie.row && Math.abs(plant.x - zombie.x) < 34)
      .sort((a, b) => b.x - a.x)[0];

    if (blockingPlant) {
      if (now - zombie.lastAttack >= ZOMBIE.attackInterval) {
        blockingPlant.hp -= ZOMBIE.attackDamage;
        zombie.lastAttack = now;
        updateHealth(blockingPlant);
      }
    } else {
      zombie.x -= ZOMBIE.speed * dt;
      zombie.element.style.left = `${zombie.x}px`;
    }

    if (zombie.hp <= 0) {
      removeZombie(zombie.id);
      state.killed += 1;
      updateHud(now);
    }

    if (zombie.x < 10) {
      finish(false);
    }
  });
}

function updateSuns(dt) {
  state.suns.slice().forEach((sun) => {
    sun.age += dt * 1000;
    if (sun.source === "sky" && sun.y < sun.targetY) {
      sun.y = Math.min(sun.targetY, sun.y + 42 * dt);
      sun.element.style.top = `${sun.y}px`;
    }

    if (sun.age > sun.ttl) {
      removeSun(sun.id);
    }
  });
}

function removePea(id) {
  const index = state.peas.findIndex((pea) => pea.id === id);
  if (index === -1) return;
  const [pea] = state.peas.splice(index, 1);
  pea.element.remove();
}

function removeZombie(id) {
  const index = state.zombies.findIndex((zombie) => zombie.id === id);
  if (index === -1) return;
  const [zombie] = state.zombies.splice(index, 1);
  zombie.element.remove();
}

function removeSun(id) {
  const index = state.suns.findIndex((sun) => sun.id === id);
  if (index === -1) return;
  const [sun] = state.suns.splice(index, 1);
  sun.element.remove();
}

function cleanupDeadPlants() {
  state.plants.slice().forEach((plant) => {
    if (plant.hp <= 0) {
      const index = state.plants.findIndex((candidate) => candidate.id === plant.id);
      if (index !== -1) state.plants.splice(index, 1);
      plant.element.remove();
      setStatus(`${PLANTS[plant.type].name} 被僵尸吃掉了。`);
    }
  });
}

function updateHealth(entity) {
  const fill = entity.element.querySelector(".health-fill");
  if (!fill) return;
  fill.style.width = `${Math.max(0, (entity.hp / entity.maxHp) * 100)}%`;
  fill.style.background = entity.hp / entity.maxHp < 0.35 ? "#d84835" : "#53d660";
}

function checkWin() {
  if (state.spawned === TARGET_ZOMBIES && state.killed === TARGET_ZOMBIES) {
    finish(true);
  }
}

function finish(won) {
  if (!state.running) return;
  state.running = false;
  state.selectedPlant = null;
  shell.classList.toggle("game-won", won);
  shell.classList.toggle("game-over", !won);
  restartButton.hidden = false;
  setStatus(won ? "胜利！你击退了全部僵尸。" : "失败！僵尸突破了防线。 ");
  updateHud();
}

function tick(now) {
  if (!state.lastTime) state.lastTime = now;
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;

  if (state.running) {
    spawnZombie(now);
    spawnSkySun(now);
    plantActions(now);
    updatePeas(dt);
    updateZombies(now, dt);
    updateSuns(dt);
    cleanupDeadPlants();
    checkWin();
  }

  updateHud(now);
  requestAnimationFrame(tick);
}

function resetGame() {
  state.running = true;
  state.selectedPlant = null;
  state.sun = 150;
  state.plants = [];
  state.zombies = [];
  state.peas = [];
  state.suns = [];
  state.spawned = 0;
  state.killed = 0;
  state.lastTime = 0;
  state.lastSpawn = 0;
  state.lastSkySun = 0;
  state.cooldownReady = {
    sunflower: 0,
    peashooter: 0
  };

  shell.classList.remove("game-won", "game-over");
  restartButton.hidden = true;
  buildGrid();
  setStatus("选择植物卡片，然后点击草坪种植。");
  updateHud();
}

seedCards.forEach((card) => {
  card.addEventListener("click", () => selectPlant(card.dataset.plant));
});

restartButton.addEventListener("click", resetGame);

buildGrid();
updateHud();
requestAnimationFrame(tick);
