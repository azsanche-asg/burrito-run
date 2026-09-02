(() => {
  "use strict";

  const canvas = document.querySelector("#game-canvas");
  const context = canvas.getContext("2d");
  const overlay = document.querySelector("#game-overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayMessage = document.querySelector("#overlay-message");
  const actionButton = document.querySelector("#action-button");
  const scoreLabel = document.querySelector("#score");
  const bestScoreLabel = document.querySelector("#best-score");
  const biomeLabel = document.querySelector("#biome-label");
  const cargoLabel = document.querySelector("#cargo-label");
  const rescueLabel = document.querySelector("#rescue-label");
  const destinationLabel = document.querySelector("#destination-label");
  const eventToast = document.querySelector("#event-toast");
  const pauseOverlay = document.querySelector("#pause-overlay");
  const pauseButton = document.querySelector("#pause-button");
  const resumeButton = document.querySelector("#resume-button");
  const soundButton = document.querySelector("#sound-button");
  const motionButton = document.querySelector("#motion-button");
  const recordButton = document.querySelector("#record-button");
  const recordingResult = document.querySelector("#recording-result");
  const recordingPreview = document.querySelector("#recording-preview");
  const recordingDownload = document.querySelector("#recording-download");
  const recordingDismiss = document.querySelector("#recording-dismiss");
  const recordingSummary = document.querySelector("#recording-summary");
  const recordingStatus = document.querySelector("#recording-status");
  const statRunsLabel = document.querySelector("#stat-runs");
  const statRescuesLabel = document.querySelector("#stat-rescues");
  const statDestinationsLabel = document.querySelector("#stat-destinations");

  const VIEW = Object.freeze({ width: 960, height: 540, groundY: 422 });
  const MAX_CARGO = 3;
  const HAZARD_HIT_FADE = 0.55;
  const RECORDING_DURATION = 60_000;
  const BIOMES = Object.freeze([
    {
      name: "Desert",
      skyTop: "#f9d99c",
      skyBottom: "#f4b75c",
      distant: "#d98255",
      near: "#a84f38",
      earth: "#d8924e",
      trail: "#e7ae69",
      edge: "#9f5439",
      destination: "oasis",
      destinationLabel: "Oasis pond",
    },
    {
      name: "Canyon",
      skyTop: "#f5c994",
      skyBottom: "#df8757",
      distant: "#b96049",
      near: "#743b35",
      earth: "#b86745",
      trail: "#d78c58",
      edge: "#703a32",
      destination: "appleTree",
      destinationLabel: "Apple grove",
    },
    {
      name: "Farmland",
      skyTop: "#cfe6de",
      skyBottom: "#f1c875",
      distant: "#8daa79",
      near: "#5e7f59",
      earth: "#9e7848",
      trail: "#d8a565",
      edge: "#695037",
      destination: "carrotFarm",
      destinationLabel: "Carrot farm",
    },
  ]);
  const COLORS = Object.freeze({
    skyTop: "#f9d99c",
    skyBottom: "#f4b75c",
    sun: "#ffd76a",
    distantMesa: "#d98255",
    nearMesa: "#a84f38",
    earth: "#d8924e",
    earthDark: "#9f5439",
    trail: "#e7ae69",
    trailMark: "#bd7349",
    cactus: "#47744b",
    cactusDark: "#31583b",
    donkey: "#8e7567",
    donkeyDark: "#5e493f",
    muzzle: "#c9aa91",
    mane: "#3e322d",
    saddle: "#b54b34",
    cargo: "#e3b764",
  });

  const SPRITE_SOURCES = Object.freeze({
    donkey: "assets/sprites/burrito-donkey-atlas.png",
    hazards: "assets/sprites/desert-hazards-atlas.png",
    story: "assets/sprites/story-rewards-atlas.png",
    paisano: "assets/sprites/paisano-sleeping.png",
    sombrero: "assets/sprites/paisano-sombrero.png",
  });

  const spriteAtlases = {
    donkey: null,
    hazards: null,
    story: null,
    paisano: null,
    sombrero: null,
  };

  const audio = {
    enabled: true,
    context: null,
    recordingDestination: null,
  };

  const recording = {
    recorder: null,
    stream: null,
    chunks: [],
    mimeType: "",
    startedAt: 0,
    endsAt: 0,
    timer: 0,
    countdown: 0,
    objectUrl: "",
  };

  const CAREER_STORAGE_KEY = "burrito-run:career:v1";
  const career = {
    best: 0,
    runs: 0,
    totalDistance: 0,
    totalScore: 0,
    totalRescues: 0,
    destinations: 0,
    cargoRecovered: 0,
  };

  const donkey = {
    x: 142,
    y: 0,
    width: 78,
    height: 66,
    velocityY: 0,
    grounded: true,
  };

  const game = {
    state: "ready",
    elapsed: 0,
    distance: 0,
    bonusScore: 0,
    best: 0,
    speed: 355,
    worldScroll: 0,
    nextObstacleIn: 1.35,
    nextPickupIn: 3.8,
    nextPaisanoDistance: 48,
    nextDestinationDistance: 90,
    obstacles: [],
    pickups: [],
    paisanos: [],
    destination: null,
    biomeIndex: 0,
    previousBiomeIndex: 0,
    biomeTransition: 0,
    cargo: 3,
    rescues: 0,
    carryingPaisano: false,
    invulnerableTime: 0,
    celebrationTime: 0,
    toastTime: 0,
    particles: [],
    flashTime: 0,
    flashColor: "#fff4c7",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    lastFrame: 0,
    shakeTime: 0,
  };

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW.width * pixelRatio;
    canvas.height = VIEW.height * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
  }

  function resetDonkey() {
    donkey.y = VIEW.groundY - donkey.height;
    donkey.velocityY = 0;
    donkey.grounded = true;
  }

  async function loadSpriteAssets() {
    const entries = Object.entries(SPRITE_SOURCES);
    for (const [name, source] of entries) {
      try {
        spriteAtlases[name] = await loadSpriteAtlas(source);
      } catch {
        spriteAtlases[name] = null;
      }
    }
  }

  function loadSpriteAtlas(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => {
        try {
          resolve(removeConnectedBackdrop(image));
        } catch (error) {
          reject(error);
        }
      });
      image.addEventListener("error", reject);
      image.src = source;
    });
  }

  function removeConnectedBackdrop(image) {
    const output = document.createElement("canvas");
    output.width = image.naturalWidth;
    output.height = image.naturalHeight;
    const outputContext = output.getContext("2d", { willReadFrequently: true });
    outputContext.drawImage(image, 0, 0);

    const pixels = outputContext.getImageData(0, 0, output.width, output.height);
    const data = pixels.data;
    const visited = new Uint8Array(output.width * output.height);
    const queue = new Int32Array(output.width * output.height);
    let head = 0;
    let tail = 0;

    const visit = (x, y) => {
      if (x < 0 || y < 0 || x >= output.width || y >= output.height) return;
      const pixelIndex = y * output.width + x;
      if (visited[pixelIndex]) return;
      visited[pixelIndex] = 1;

      const dataIndex = pixelIndex * 4;
      const red = data[dataIndex];
      const green = data[dataIndex + 1];
      const blue = data[dataIndex + 2];
      const brightest = Math.max(red, green, blue);
      const darkest = Math.min(red, green, blue);

      if (darkest < 210 || brightest - darkest > 24) return;
      queue[tail] = pixelIndex;
      tail += 1;
    };

    for (let x = 0; x < output.width; x += 1) {
      visit(x, 0);
      visit(x, output.height - 1);
    }
    for (let y = 0; y < output.height; y += 1) {
      visit(0, y);
      visit(output.width - 1, y);
    }

    while (head < tail) {
      const pixelIndex = queue[head];
      head += 1;
      data[pixelIndex * 4 + 3] = 0;

      const x = pixelIndex % output.width;
      const y = Math.floor(pixelIndex / output.width);
      visit(x - 1, y);
      visit(x + 1, y);
      visit(x, y - 1);
      visit(x, y + 1);
    }

    outputContext.putImageData(pixels, 0, 0);
    const optimized = document.createElement("canvas");
    optimized.width = Math.round(output.width * 0.5);
    optimized.height = Math.round(output.height * 0.5);
    const optimizedContext = optimized.getContext("2d");
    optimizedContext.imageSmoothingEnabled = true;
    optimizedContext.imageSmoothingQuality = "high";
    optimizedContext.drawImage(output, 0, 0, optimized.width, optimized.height);
    output.width = 1;
    output.height = 1;
    return optimized;
  }

  function resetGame() {
    game.elapsed = 0;
    game.distance = 0;
    game.bonusScore = 0;
    game.speed = 355;
    game.worldScroll = 0;
    game.nextObstacleIn = 1.45;
    game.nextPickupIn = 3.8;
    game.nextPaisanoDistance = 48;
    game.nextDestinationDistance = 90;
    game.obstacles = [];
    game.pickups = [];
    game.paisanos = [];
    game.destination = null;
    game.biomeIndex = 0;
    game.previousBiomeIndex = 0;
    game.biomeTransition = 0;
    game.cargo = 3;
    game.rescues = 0;
    game.carryingPaisano = false;
    game.invulnerableTime = 0;
    game.celebrationTime = 0;
    game.toastTime = 0;
    game.particles = [];
    game.flashTime = 0;
    game.shakeTime = 0;
    eventToast.classList.remove("is-visible", "is-warning");
    pauseOverlay.hidden = true;
    pauseButton.disabled = true;
    pauseButton.textContent = "Pause";
    pauseButton.setAttribute("aria-pressed", "false");
    resetDonkey();
    updateHud();
  }

  function startGame(jumpImmediately = false) {
    resetGame();
    game.state = "running";
    overlay.hidden = true;
    pauseButton.disabled = false;
    canvas.focus({ preventScroll: true });
    if (jumpImmediately) jump();
  }

  function endGame() {
    game.state = "gameover";
    game.best = Math.max(game.best, currentScore());
    recordCompletedRun();
    game.shakeTime = 0.28;
    game.flashTime = 0.22;
    game.flashColor = "#7d2d22";
    pauseButton.disabled = true;
    pauseOverlay.hidden = true;
    playSound("gameover");
    updateHud();

    overlayKicker.textContent = "Cargo down, courage up";
    overlayTitle.textContent = "Dust yourself off";
    const paisanoWord = game.rescues === 1 ? "paisano" : "paisanos";
    overlayMessage.textContent = `You traveled ${Math.floor(game.distance)} meters and rescued ${game.rescues} ${paisanoWord}. The trail is ready for another try.`;
    actionButton.textContent = "Run again";

    window.setTimeout(() => {
      if (game.state === "gameover") {
        overlay.hidden = false;
        actionButton.focus({ preventScroll: true });
      }
    }, 320);
  }

  function jump() {
    if (!donkey.grounded || game.state !== "running") return;
    donkey.velocityY = -850;
    donkey.grounded = false;
    emitParticles(donkey.x + 18, VIEW.groundY - 2, "dust", 5);
    playSound("jump");
  }

  function handleAction() {
    ensureAudio();
    if (game.state === "paused") {
      resumeGame();
      return;
    }
    if (game.state === "ready" || game.state === "gameover") {
      startGame(true);
      return;
    }
    jump();
  }

  function update(delta) {
    if (game.state !== "running") return;

    game.elapsed += delta;
    game.speed = Math.min(600, 355 + game.elapsed * 5.8);
    game.distance += game.speed * delta * 0.025;
    game.worldScroll += game.speed * delta;
    game.invulnerableTime = Math.max(0, game.invulnerableTime - delta);
    game.celebrationTime = Math.max(0, game.celebrationTime - delta);
    game.biomeTransition = Math.max(0, game.biomeTransition - delta);
    game.flashTime = Math.max(0, game.flashTime - delta);
    updateToast(delta);
    updateParticles(delta);

    const destinationDue = game.distance >= game.nextDestinationDistance;
    maybeSpawnDestination();
    if (!game.destination && !destinationDue) updateProceduralSpawns(delta);

    const wasGrounded = donkey.grounded;
    donkey.velocityY += 2250 * delta;
    donkey.y += donkey.velocityY * delta;

    const floor = VIEW.groundY - donkey.height;
    if (donkey.y >= floor) {
      donkey.y = floor;
      donkey.velocityY = 0;
      donkey.grounded = true;
      if (!wasGrounded) {
        emitParticles(donkey.x + 35, VIEW.groundY, "dust", 7);
        playSound("land");
      }
    }

    for (const obstacle of game.obstacles) {
      obstacle.x -= (game.speed + obstacle.extraSpeed) * delta;
      if (obstacle.hit) {
        obstacle.hitTime = Math.max(0, obstacle.hitTime - delta);
      }
    }

    updateStoryObjects(delta);

    const donkeyHitbox = {
      x: donkey.x + 10,
      y: donkey.y + 10,
      width: donkey.width - 20,
      height: donkey.height - 14,
    };

    for (const obstacle of game.obstacles) {
      if (obstacle.hit) continue;
      const obstacleHitbox = {
        x: obstacle.x + 5,
        y: obstacle.y + 4,
        width: obstacle.width - 10,
        height: obstacle.height - 4,
      };

      if (
        game.invulnerableTime <= 0 &&
        rectanglesOverlap(donkeyHitbox, obstacleHitbox)
      ) {
        handleHazardHit(obstacle);
        break;
      }
    }

    game.obstacles = game.obstacles.filter(
      (obstacle) =>
        (!obstacle.hit || obstacle.hitTime > 0) && obstacle.x > -160,
    );
    updateHud();
  }

  function updateProceduralSpawns(delta) {
    game.nextObstacleIn -= delta;
    game.nextPickupIn -= delta;

    const pickupsHaveClearedSpawnLane = game.pickups.every(
      (pickup) => pickup.x < VIEW.width - 280,
    );
    if (
      game.nextObstacleIn <= 0 &&
      game.paisanos.length === 0 &&
      pickupsHaveClearedSpawnLane
    ) {
      spawnObstacle();
      const speedFactor = (game.speed - 355) / 245;
      const minimumGap = 1.05 - speedFactor * 0.16;
      game.nextObstacleIn = minimumGap + Math.random() * 0.7;
    }

    if (game.nextPickupIn <= 0 && laneIsClear(210)) {
      spawnPickup();
      game.nextPickupIn = 5.2 + Math.random() * 4;
    }

    if (
      game.distance >= game.nextPaisanoDistance &&
      game.paisanos.length === 0 &&
      !game.carryingPaisano &&
      laneIsClear(270)
    ) {
      spawnPaisano();
      game.nextPaisanoDistance += 95 + Math.random() * 55;
      game.nextObstacleIn = Math.max(game.nextObstacleIn, 1.7);
    }
  }

  function updateStoryObjects(delta) {
    for (const pickup of game.pickups) pickup.x -= game.speed * delta;
    for (const paisano of game.paisanos) paisano.x -= game.speed * delta;

    if (game.destination) {
      game.destination.x -= game.speed * 0.78 * delta;
      if (
        !game.destination.reached &&
        game.destination.x < donkey.x + donkey.width - 8
      ) {
        reachDestination();
      }
      if (game.destination.x + game.destination.width < -80) {
        game.destination = null;
        game.nextObstacleIn = Math.max(game.nextObstacleIn, 1.25);
      }
    }

    const donkeyHitbox = getDonkeyHitbox();
    for (const pickup of game.pickups) {
      if (rectanglesOverlap(donkeyHitbox, pickup)) collectPickup(pickup);
    }

    for (const paisano of game.paisanos) {
      const closeEnough =
        paisano.x < donkey.x + donkey.width &&
        paisano.x + paisano.width > donkey.x;
      if (closeEnough) rescuePaisano(paisano);
    }

    game.pickups = game.pickups.filter(
      (pickup) => !pickup.collected && pickup.x > -80,
    );
    game.paisanos = game.paisanos.filter(
      (paisano) => paisano.x > -120,
    );
  }

  function getDonkeyHitbox() {
    return {
      x: donkey.x + 10,
      y: donkey.y + 10,
      width: donkey.width - 20,
      height: donkey.height - 14,
    };
  }

  function handleHazardHit(obstacle) {
    if (game.cargo <= 0) {
      endGame();
      return;
    }

    game.cargo -= 1;
    game.invulnerableTime = 1.5;
    game.shakeTime = 0.32;
    game.flashTime = 0.18;
    game.flashColor = "#9e3f2e";
    obstacle.hit = true;
    obstacle.hitTime = HAZARD_HIT_FADE;
    emitParticles(donkey.x + 66, donkey.y + 34, "damage", 12);
    playSound("hit");
    showToast(`Cargo lost — ${game.cargo} remaining`, "warning", 2.1);
  }

  function laneIsClear(minimumGap) {
    return !game.obstacles.some(
      (obstacle) => obstacle.x > VIEW.width - minimumGap,
    );
  }

  function spawnObstacle() {
    const biomeName = BIOMES[game.biomeIndex].name;
    const pools = {
      Desert: ["single", "armed", "double", "prickly", "rock", "snake"],
      Canyon: ["rock", "snake", "tumbleweed", "armed", "roadrunner"],
      Farmland: ["rock", "tumbleweed", "roadrunner", "prickly"],
    };
    const unlocked = pools[biomeName].filter((variant) => {
      if (game.distance < 35) return !["snake", "roadrunner", "tumbleweed"].includes(variant);
      if (game.distance < 75) return variant !== "roadrunner";
      return true;
    });
    const variant = unlocked[Math.floor(Math.random() * unlocked.length)];
    const dimensions = {
      single: { width: 28, height: 72 },
      armed: { width: 50, height: 78 },
      double: { width: 58, height: 68 },
      prickly: { width: 72, height: 55 },
      rock: { width: 58, height: 42 },
      snake: { width: 58, height: 40 },
      roadrunner: { width: 64, height: 48 },
      tumbleweed: { width: 54, height: 54 },
    }[variant];

    game.obstacles.push({
      x: VIEW.width + 30,
      y: VIEW.groundY - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
      variant,
      extraSpeed:
        variant === "roadrunner" ? 72 : variant === "tumbleweed" ? 24 : 0,
    });
  }

  function spawnPickup() {
    const type = game.cargo < MAX_CARGO ? "cargo" : "provisions";
    const size = type === "cargo" ? 42 : 38;
    const elevated = type === "provisions" && Math.random() > 0.35;
    game.pickups.push({
      type,
      x: VIEW.width + 45,
      y: elevated ? VIEW.groundY - 112 : VIEW.groundY - size - 4,
      width: size,
      height: size,
      collected: false,
    });
  }

  function collectPickup(pickup) {
    pickup.collected = true;
    if (pickup.type === "cargo") {
      game.cargo = Math.min(MAX_CARGO, game.cargo + 1);
      game.bonusScore += 35;
      career.cargoRecovered += 1;
      saveCareerProgress();
      emitParticles(pickup.x, pickup.y, "cargo", 11);
      playSound("cargo");
      showToast("Cargo recovered · +35", "success", 1.8);
      return;
    }

    game.bonusScore += 25;
    emitParticles(pickup.x, pickup.y, "provisions", 10);
    playSound("provisions");
    showToast("Trail provisions · +25", "success", 1.6);
  }

  function spawnPaisano() {
    game.paisanos.push({
      x: VIEW.width + 45,
      y: VIEW.groundY - 48,
      width: 88,
      height: 48,
    });
    showToast("Sleeping paisano ahead — bring him along", "success", 2.2);
  }

  function rescuePaisano(paisano) {
    game.paisanos = game.paisanos.filter((candidate) => candidate !== paisano);
    game.carryingPaisano = true;
    game.rescues += 1;
    game.bonusScore += 60;
    emitParticles(paisano.x + 44, paisano.y + 22, "rescue", 16);
    playSound("rescue");
    showToast("Paisano aboard · sombrero secured · +60", "success", 2.3);
  }

  function maybeSpawnDestination() {
    if (game.destination || game.distance < game.nextDestinationDistance) return;
    if (
      game.obstacles.length > 0 ||
      game.pickups.length > 0 ||
      game.paisanos.length > 0
    ) {
      return;
    }
    const biome = BIOMES[game.biomeIndex];
    const dimensions = {
      oasis: { width: 210, height: 105 },
      appleTree: { width: 150, height: 165 },
      carrotFarm: { width: 190, height: 125 },
    }[biome.destination];

    game.destination = {
      type: biome.destination,
      label: biome.destinationLabel,
      x: VIEW.width + 30,
      y: VIEW.groundY - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
      reached: false,
    };
    showToast(`${biome.destinationLabel} ahead`, "success", 2.4);
  }

  function reachDestination() {
    const destination = game.destination;
    destination.reached = true;
    game.bonusScore += 100;
    game.cargo = Math.min(MAX_CARGO, game.cargo + 1);
    game.celebrationTime = 1.5;
    game.previousBiomeIndex = game.biomeIndex;
    game.biomeIndex = (game.biomeIndex + 1) % BIOMES.length;
    game.biomeTransition = 1.6;
    game.flashTime = 0.32;
    game.flashColor = "#fff1a8";
    game.nextDestinationDistance += 180;
    career.destinations += 1;
    saveCareerProgress();
    updateCareerLabels();
    const deliveredPaisano = game.carryingPaisano;
    game.carryingPaisano = false;
    game.nextPaisanoDistance = Math.max(
      game.nextPaisanoDistance,
      game.distance + 45,
    );
    emitParticles(donkey.x + 42, donkey.y + 18, "celebration", 30);
    playSound("destination");
    showToast(
      `${destination.label} reached · +100${deliveredPaisano ? " · paisano delivered" : ""} · ${BIOMES[game.biomeIndex].name} next`,
      "success",
      3,
    );
  }

  function rectanglesOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function currentScore() {
    return Math.floor(game.distance) + game.bonusScore;
  }

  function loadCareerProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY));
      if (saved && typeof saved === "object") {
        for (const key of Object.keys(career)) {
          if (Number.isFinite(saved[key]) && saved[key] >= 0) {
            career[key] = Math.floor(saved[key]);
          }
        }
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
    game.best = career.best;
    updateCareerLabels();
  }

  function saveCareerProgress() {
    try {
      localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
    } catch {
      // The current run remains fully playable when persistence is unavailable.
    }
  }

  function recordCompletedRun() {
    career.best = game.best;
    career.runs += 1;
    career.totalDistance += Math.floor(game.distance);
    career.totalScore += currentScore();
    career.totalRescues += game.rescues;
    saveCareerProgress();
    updateCareerLabels();
  }

  function updateCareerLabels() {
    statRunsLabel.textContent = String(career.runs);
    statRescuesLabel.textContent = String(career.totalRescues);
    statDestinationsLabel.textContent = String(career.destinations);
  }

  function updateHud() {
    scoreLabel.textContent = padScore(currentScore());
    bestScoreLabel.textContent = padScore(game.best);
    biomeLabel.textContent = BIOMES[game.biomeIndex].name;
    cargoLabel.textContent = `${game.cargo} / ${MAX_CARGO}`;
    rescueLabel.textContent = String(game.rescues);
    const destination = BIOMES[game.biomeIndex];
    const remaining = Math.max(
      0,
      Math.ceil(game.nextDestinationDistance - game.distance),
    );
    destinationLabel.textContent = game.destination && !game.destination.reached
      ? `${game.destination.label} · in sight`
      : `${destination.destinationLabel} · ${remaining}m`;
  }

  function showToast(message, kind = "success", duration = 1.8) {
    eventToast.textContent = message;
    eventToast.classList.toggle("is-warning", kind === "warning");
    eventToast.classList.add("is-visible");
    game.toastTime = duration;
  }

  function updateToast(delta) {
    if (game.toastTime <= 0) return;
    game.toastTime = Math.max(0, game.toastTime - delta);
    if (game.toastTime === 0) eventToast.classList.remove("is-visible");
  }

  function pauseGame() {
    if (game.state !== "running") return;
    game.state = "paused";
    pauseOverlay.hidden = false;
    pauseButton.textContent = "Resume";
    pauseButton.setAttribute("aria-pressed", "true");
    eventToast.classList.remove("is-visible");
    resumeButton.focus({ preventScroll: true });
  }

  function resumeGame() {
    if (game.state !== "paused") return;
    game.state = "running";
    pauseOverlay.hidden = true;
    pauseButton.textContent = "Pause";
    pauseButton.setAttribute("aria-pressed", "false");
    game.lastFrame = performance.now();
    canvas.focus({ preventScroll: true });
    playSound("resume");
  }

  function togglePause() {
    if (game.state === "paused") resumeGame();
    else pauseGame();
  }

  function ensureAudio() {
    if (!audio.enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audio.context) audio.context = new AudioContextClass();
    if (audio.context.state === "suspended") audio.context.resume();
  }

  function playTone(frequency, duration, options = {}) {
    if (!audio.enabled || !audio.context) return;
    const start = audio.context.currentTime + (options.delay || 0);
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        options.endFrequency,
        start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.045, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.context.destination);
    if (audio.recordingDestination) {
      gain.connect(audio.recordingDestination);
    }
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playSound(name) {
    if (!audio.enabled || !audio.context) return;
    const sounds = {
      jump: [
        { frequency: 280, endFrequency: 520, duration: 0.09, type: "triangle" },
      ],
      land: [{ frequency: 105, duration: 0.045, volume: 0.025, type: "sine" }],
      hit: [
        { frequency: 145, endFrequency: 72, duration: 0.2, type: "sawtooth" },
      ],
      cargo: [
        { frequency: 440, duration: 0.08, type: "triangle" },
        { frequency: 660, duration: 0.12, delay: 0.08, type: "triangle" },
      ],
      provisions: [
        { frequency: 520, duration: 0.07, type: "sine" },
        { frequency: 780, duration: 0.1, delay: 0.07, type: "sine" },
      ],
      rescue: [
        { frequency: 392, duration: 0.09, type: "triangle" },
        { frequency: 523, duration: 0.1, delay: 0.08, type: "triangle" },
        { frequency: 659, duration: 0.14, delay: 0.16, type: "triangle" },
      ],
      destination: [
        { frequency: 330, duration: 0.14, type: "triangle" },
        { frequency: 440, duration: 0.15, delay: 0.1, type: "triangle" },
        { frequency: 554, duration: 0.16, delay: 0.2, type: "triangle" },
        { frequency: 660, duration: 0.25, delay: 0.3, type: "triangle" },
      ],
      gameover: [
        { frequency: 220, endFrequency: 125, duration: 0.28, type: "triangle" },
        { frequency: 110, duration: 0.3, delay: 0.18, type: "sine" },
      ],
      resume: [{ frequency: 440, duration: 0.08, volume: 0.03, type: "sine" }],
    };
    for (const tone of sounds[name] || []) {
      playTone(tone.frequency, tone.duration, tone);
    }
  }

  function toggleSound() {
    audio.enabled = !audio.enabled;
    soundButton.setAttribute("aria-pressed", String(audio.enabled));
    soundButton.textContent = audio.enabled ? "Sound on" : "Sound off";
    if (audio.enabled) {
      ensureAudio();
      playTone(520, 0.08, { volume: 0.03, type: "sine" });
    }
  }

  function toggleMotion() {
    game.reducedMotion = !game.reducedMotion;
    document.body.classList.toggle("calm-mode", game.reducedMotion);
    motionButton.setAttribute("aria-pressed", String(game.reducedMotion));
    motionButton.textContent = game.reducedMotion ? "Calm on" : "Calm off";
    if (game.reducedMotion) game.particles = [];
  }

  function recordingIsSupported() {
    return (
      typeof canvas.captureStream === "function" &&
      "MediaRecorder" in window &&
      "MediaStream" in window
    );
  }

  function preferredRecordingMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function formatRecordingTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function clearRecordingTimers() {
    window.clearTimeout(recording.timer);
    window.clearInterval(recording.countdown);
    recording.timer = 0;
    recording.countdown = 0;
  }

  function releaseRecordingPreview() {
    if (!recording.objectUrl) return;
    recordingPreview.pause();
    recordingPreview.removeAttribute("src");
    recordingPreview.load();
    URL.revokeObjectURL(recording.objectUrl);
    recording.objectUrl = "";
  }

  function dismissRecording() {
    releaseRecordingPreview();
    recordingResult.hidden = true;
    recordingStatus.textContent = "";
  }

  function updateRecordingCountdown() {
    const remainingMilliseconds = Math.max(0, recording.endsAt - performance.now());
    const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
    const time = formatRecordingTime(remainingSeconds);
    recordButton.textContent = `Stop · ${time}`;
    recordingStatus.textContent = `Recording locally · ${time} remaining`;
  }

  function resetRecordingButton() {
    recordButton.setAttribute("aria-pressed", "false");
    recordButton.textContent = "Record 1 min";
  }

  function stopRecording() {
    if (!recording.recorder || recording.recorder.state === "inactive") return;
    clearRecordingTimers();
    resetRecordingButton();
    recordingStatus.textContent = "Finishing your recording…";
    recording.recorder.stop();
  }

  function finishRecording() {
    const recorder = recording.recorder;
    const elapsed = Math.min(
      RECORDING_DURATION,
      Math.max(0, performance.now() - recording.startedAt),
    );
    const mimeType = recorder?.mimeType || recording.mimeType || "video/webm";
    const blob = new Blob(recording.chunks, { type: mimeType });

    for (const track of recording.stream?.getTracks() || []) track.stop();
    audio.recordingDestination = null;
    recording.recorder = null;
    recording.stream = null;
    recording.chunks = [];

    if (blob.size === 0) {
      recordingStatus.textContent = "The browser could not save this recording.";
      return;
    }

    releaseRecordingPreview();
    recording.objectUrl = URL.createObjectURL(blob);
    recordingPreview.src = recording.objectUrl;
    recordingDownload.href = recording.objectUrl;
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    recordingDownload.download = `burrito-run-${timestamp}.${extension}`;

    const duration = formatRecordingTime(Math.max(1, Math.round(elapsed / 1000)));
    const megabytes = (blob.size / (1024 * 1024)).toFixed(1);
    recordingSummary.textContent = `${duration} · ${megabytes} MB · local only; download to keep`;
    recordingResult.hidden = false;
    recordingStatus.textContent = "Recording ready to preview or download.";
  }

  function startRecording() {
    if (!recordingIsSupported()) {
      recordingStatus.textContent = "Recording is not supported in this browser.";
      return;
    }

    if (recording.recorder?.state === "recording") {
      stopRecording();
      return;
    }

    dismissRecording();
    ensureAudio();
    if (["ready", "gameover"].includes(game.state)) startGame(false);
    else if (game.state === "paused") resumeGame();

    try {
      const canvasStream = canvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks()];

      if (audio.enabled && audio.context) {
        audio.recordingDestination = audio.context.createMediaStreamDestination();
        tracks.push(...audio.recordingDestination.stream.getAudioTracks());
      }

      recording.stream = new MediaStream(tracks);
      recording.mimeType = preferredRecordingMimeType();
      const options = { videoBitsPerSecond: 2_500_000 };
      if (recording.mimeType) options.mimeType = recording.mimeType;
      if (tracks.some((track) => track.kind === "audio")) {
        options.audioBitsPerSecond = 128_000;
      }

      recording.recorder = new MediaRecorder(recording.stream, options);
      recording.chunks = [];
      recording.startedAt = performance.now();
      recording.endsAt = recording.startedAt + RECORDING_DURATION;

      recording.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) recording.chunks.push(event.data);
      });
      recording.recorder.addEventListener("stop", finishRecording, { once: true });
      recording.recorder.addEventListener("error", () => stopRecording(), {
        once: true,
      });
      recording.recorder.start(1000);

      recordButton.setAttribute("aria-pressed", "true");
      updateRecordingCountdown();
      recording.countdown = window.setInterval(updateRecordingCountdown, 250);
      recording.timer = window.setTimeout(stopRecording, RECORDING_DURATION);
      canvas.focus({ preventScroll: true });
    } catch {
      for (const track of recording.stream?.getTracks() || []) track.stop();
      audio.recordingDestination = null;
      recording.recorder = null;
      recording.stream = null;
      resetRecordingButton();
      recordingStatus.textContent = "The browser could not start recording.";
    }
  }

  function emitParticles(x, y, kind, count) {
    if (game.reducedMotion) return;
    const palettes = {
      dust: ["#e8bc7e", "#d79a5b", "#f4d6a1"],
      damage: ["#a94e37", "#e0a24f", "#734232"],
      cargo: ["#f2bd43", "#8da760", "#fff0a0"],
      provisions: ["#df6038", "#6c994e", "#f4b947"],
      rescue: ["#3f8a7a", "#f2bd43", "#fff1bd"],
      celebration: ["#dc5d35", "#3c8f88", "#f5bd3d", "#fff2b6"],
    };
    const colors = palettes[kind] || palettes.dust;
    for (let index = 0; index < count; index += 1) {
      const life = 0.45 + Math.random() * 0.55;
      game.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (kind === "celebration" ? 210 : 120),
        vy: -45 - Math.random() * (kind === "celebration" ? 190 : 105),
        gravity: kind === "dust" ? 80 : 260,
        life,
        maxLife: life,
        size: 2.5 + Math.random() * 4.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        square: kind === "celebration",
      });
    }
  }

  function updateParticles(delta) {
    for (const particle of game.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += particle.gravity * delta;
      particle.life -= delta;
    }
    game.particles = game.particles.filter((particle) => particle.life > 0);
  }

  function registerOfflineSupport() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        // Network-only play remains available if registration is blocked.
      });
    });
  }

  function padScore(score) {
    return String(score).padStart(5, "0");
  }

  function getBiomePalette() {
    const current = BIOMES[game.biomeIndex];
    if (game.biomeTransition <= 0) return current;
    const previous = BIOMES[game.previousBiomeIndex];
    const progress = 1 - game.biomeTransition / 1.6;
    return {
      ...current,
      skyTop: mixHex(previous.skyTop, current.skyTop, progress),
      skyBottom: mixHex(previous.skyBottom, current.skyBottom, progress),
      distant: mixHex(previous.distant, current.distant, progress),
      near: mixHex(previous.near, current.near, progress),
      earth: mixHex(previous.earth, current.earth, progress),
      trail: mixHex(previous.trail, current.trail, progress),
      edge: mixHex(previous.edge, current.edge, progress),
    };
  }

  function mixHex(from, to, amount) {
    const clamped = Math.max(0, Math.min(1, amount));
    const fromValue = Number.parseInt(from.slice(1), 16);
    const toValue = Number.parseInt(to.slice(1), 16);
    const channels = [16, 8, 0].map((shift) => {
      const start = (fromValue >> shift) & 255;
      const end = (toValue >> shift) & 255;
      return Math.round(start + (end - start) * clamped);
    });
    return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  }

  function draw() {
    context.save();
    if (game.shakeTime > 0 && !game.reducedMotion) {
      const strength = game.shakeTime * 12;
      context.translate(
        (Math.random() - 0.5) * strength,
        (Math.random() - 0.5) * strength,
      );
    }

    drawSky();
    drawSun();
    drawClouds();
    drawMesas();
    drawGround();
    drawTrailDetails();
    drawStoryObjects();
    drawObstacles();
    context.save();
    if (
      game.invulnerableTime > 0 &&
      Math.floor(game.invulnerableTime * 12) % 2 === 0
    ) {
      context.globalAlpha = 0.36;
    }
    drawDonkey();
    context.restore();
    drawDust();
    drawParticles();
    context.restore();
    drawFlash();
  }

  function drawSky() {
    const biome = getBiomePalette();
    const gradient = context.createLinearGradient(0, 0, 0, VIEW.groundY);
    gradient.addColorStop(0, biome.skyTop);
    gradient.addColorStop(1, biome.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.groundY);
  }

  function drawSun() {
    context.save();
    context.globalAlpha = 0.9;
    context.fillStyle = COLORS.sun;
    context.beginPath();
    context.arc(770, 106, 54, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.17;
    context.beginPath();
    context.arc(770, 106, 75, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawClouds() {
    const cloudOffset = game.reducedMotion
      ? 0
      : (game.elapsed * game.speed * 0.018) % 1120;
    drawCloud(170 - cloudOffset, 102, 0.78);
    drawCloud(670 - cloudOffset, 184, 0.56);
    drawCloud(1110 - cloudOffset, 82, 0.7);
  }

  function drawCloud(x, y, scale) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = "rgba(255, 248, 222, 0.58)";
    context.beginPath();
    context.ellipse(0, 8, 42, 17, 0, 0, Math.PI * 2);
    context.ellipse(-23, 2, 22, 18, 0, 0, Math.PI * 2);
    context.ellipse(8, -4, 29, 24, 0, 0, Math.PI * 2);
    context.ellipse(32, 5, 21, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMesas() {
    const biome = BIOMES[game.biomeIndex];
    const palette = getBiomePalette();
    const visualScroll = game.reducedMotion ? 0 : game.worldScroll;
    const distantOffset = (visualScroll * 0.12) % 300;
    context.fillStyle = palette.distant;
    context.globalAlpha = 0.58;
    const distantDrawer = biome.name === "Farmland" ? drawHillStrip : drawMesaStrip;
    const distantHeight = biome.name === "Canyon" ? 104 : 82;
    distantDrawer(-300 - distantOffset, 309, 300, distantHeight);
    distantDrawer(-distantOffset, 309, 300, distantHeight);
    distantDrawer(300 - distantOffset, 309, 300, distantHeight);
    distantDrawer(600 - distantOffset, 309, 300, distantHeight);
    distantDrawer(900 - distantOffset, 309, 300, distantHeight);

    const nearOffset = (visualScroll * 0.27) % 420;
    context.globalAlpha = 0.82;
    context.fillStyle = palette.near;
    const nearDrawer = biome.name === "Farmland" ? drawHillStrip : drawMesaStrip;
    const nearHeight = biome.name === "Canyon" ? 92 : 72;
    nearDrawer(-420 - nearOffset, 374, 420, nearHeight);
    nearDrawer(-nearOffset, 374, 420, nearHeight);
    nearDrawer(420 - nearOffset, 374, 420, nearHeight);
    nearDrawer(840 - nearOffset, 374, 420, nearHeight);
    context.globalAlpha = 1;
  }

  function drawMesaStrip(x, baseline, width, height) {
    context.beginPath();
    context.moveTo(x, baseline);
    context.lineTo(x + width * 0.12, baseline - height * 0.34);
    context.lineTo(x + width * 0.25, baseline - height * 0.38);
    context.lineTo(x + width * 0.32, baseline - height * 0.74);
    context.lineTo(x + width * 0.54, baseline - height * 0.74);
    context.lineTo(x + width * 0.6, baseline - height * 0.45);
    context.lineTo(x + width * 0.76, baseline - height * 0.4);
    context.lineTo(x + width, baseline);
    context.closePath();
    context.fill();
  }

  function drawHillStrip(x, baseline, width, height) {
    context.beginPath();
    context.moveTo(x, baseline);
    context.quadraticCurveTo(
      x + width * 0.22,
      baseline - height,
      x + width * 0.48,
      baseline - height * 0.45,
    );
    context.quadraticCurveTo(
      x + width * 0.73,
      baseline - height * 1.1,
      x + width,
      baseline,
    );
    context.closePath();
    context.fill();
  }

  function drawGround() {
    const biome = getBiomePalette();
    context.fillStyle = biome.earth;
    context.fillRect(0, VIEW.groundY - 5, VIEW.width, VIEW.height - VIEW.groundY + 5);
    context.fillStyle = biome.trail;
    context.fillRect(0, VIEW.groundY + 12, VIEW.width, 75);
    context.fillStyle = biome.edge;
    context.fillRect(0, VIEW.groundY - 5, VIEW.width, 7);
  }

  function drawTrailDetails() {
    const trackOffset = game.worldScroll % 64;
    context.fillStyle = "rgba(127, 73, 48, 0.32)";
    for (let x = -70 - trackOffset; x < VIEW.width + 70; x += 64) {
      context.beginPath();
      context.ellipse(x, VIEW.groundY + 29, 13, 3, -0.08, 0, Math.PI * 2);
      context.fill();
    }

    const pebbleOffset = (game.worldScroll * 0.8) % 105;
    context.fillStyle = "rgba(119, 68, 43, 0.2)";
    for (let x = -105 - pebbleOffset; x < VIEW.width + 80; x += 105) {
      context.beginPath();
      context.arc(x, VIEW.groundY + 101, 3, 0, Math.PI * 2);
      context.arc(x + 19, VIEW.groundY + 94, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawObstacles() {
    for (const obstacle of game.obstacles) {
      context.save();
      if (obstacle.hit) {
        context.globalAlpha = Math.max(0, obstacle.hitTime / HAZARD_HIT_FADE);
      }
      if (["single", "armed", "double", "prickly"].includes(obstacle.variant)) {
        drawCactus(obstacle);
      } else {
        drawCreatureHazard(obstacle);
      }
      context.restore();
    }
  }

  function drawCreatureHazard(obstacle) {
    if (!spriteAtlases.hazards) {
      context.fillStyle = obstacle.variant === "rock" ? "#a84f38" : "#76583c";
      context.beginPath();
      context.ellipse(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        obstacle.width / 2,
        obstacle.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      return;
    }

    const frameColumn = {
      rock: 0,
      snake: 1,
      roadrunner: 2,
      tumbleweed: 3,
    }[obstacle.variant];
    const render = {
      rock: { x: -11, y: -21, width: 80, height: 66 },
      snake: { x: -11, y: -29, width: 80, height: 72 },
      roadrunner: { x: -12, y: -25, width: 90, height: 76 },
      tumbleweed: { x: -8, y: -9, width: 70, height: 66 },
    }[obstacle.variant];
    drawAtlasFrame(
      spriteAtlases.hazards,
      frameColumn,
      1,
      obstacle.x + render.x,
      obstacle.y + render.y,
      render.width,
      render.height,
    );
  }

  function drawStoryObjects() {
    if (game.destination) drawDestination(game.destination);
    for (const paisano of game.paisanos) drawPaisano(paisano);
    for (const pickup of game.pickups) drawPickup(pickup);
  }

  function drawDestination(destination) {
    if (!spriteAtlases.story) {
      context.fillStyle = "rgba(69, 116, 75, 0.7)";
      roundedRect(
        destination.x,
        destination.y,
        destination.width,
        destination.height,
        18,
      );
      context.fill();
      return;
    }

    const render = {
      oasis: { column: 0, x: -8, y: -28, width: 230, height: 142 },
      appleTree: { column: 1, x: -10, y: -10, width: 170, height: 180 },
      carrotFarm: { column: 2, x: -10, y: -20, width: 210, height: 150 },
    }[destination.type];
    drawAtlasFrame(
      spriteAtlases.story,
      render.column,
      1,
      destination.x + render.x,
      destination.y + render.y,
      render.width,
      render.height,
    );
  }

  function drawPaisano(paisano) {
    if (!spriteAtlases.paisano) {
      context.fillStyle = "#4f7465";
      roundedRect(paisano.x, paisano.y + 15, paisano.width, 28, 14);
      context.fill();
      context.fillStyle = "#d8a13e";
      context.beginPath();
      context.ellipse(paisano.x + 64, paisano.y + 15, 27, 8, -0.08, 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.drawImage(
      spriteAtlases.paisano,
      paisano.x - 13,
      paisano.y - 20,
      116,
      83,
    );
  }

  function drawPickup(pickup) {
    if (!spriteAtlases.story) {
      context.fillStyle = pickup.type === "cargo" ? COLORS.cargo : "#d36038";
      context.beginPath();
      context.arc(
        pickup.x + pickup.width / 2,
        pickup.y + pickup.height / 2,
        pickup.width / 2,
        0,
        Math.PI * 2,
      );
      context.fill();
      return;
    }

    const column = pickup.type === "cargo" ? 0 : 3;
    const row = pickup.type === "cargo" ? 0 : 1;
    drawAtlasFrame(
      spriteAtlases.story,
      column,
      row,
      pickup.x - 8,
      pickup.y - 8,
      pickup.width + 16,
      pickup.height + 16,
    );
  }

  function drawAtlasFrame(atlas, column, row, x, y, width, height) {
    const frameWidth = atlas.width / 4;
    const frameHeight = atlas.height / 2;
    context.drawImage(
      atlas,
      column * frameWidth,
      row * frameHeight,
      frameWidth,
      frameHeight,
      x,
      y,
      width,
      height,
    );
  }

  function drawCactus(obstacle) {
    if (spriteAtlases.hazards) {
      drawCactusSprite(obstacle);
      return;
    }

    const { x, y, width, height, variant } = obstacle;
    context.save();
    context.translate(x, y);
    context.fillStyle = COLORS.cactusDark;
    roundedRect(width * 0.35 + 3, 3, width * 0.3, height, 8);
    context.fill();
    context.fillStyle = COLORS.cactus;
    roundedRect(width * 0.35, 0, width * 0.3, height, 8);
    context.fill();

    if (variant === "armed") {
      drawCactusArm(width * 0.4, height * 0.46, -1, 19);
      drawCactusArm(width * 0.61, height * 0.27, 1, 15);
    } else if (variant === "double") {
      context.fillStyle = COLORS.cactusDark;
      roundedRect(width * 0.69, height * 0.24 + 3, width * 0.2, height * 0.76, 7);
      context.fill();
      context.fillStyle = COLORS.cactus;
      roundedRect(width * 0.66, height * 0.24, width * 0.2, height * 0.76, 7);
      context.fill();
      drawCactusArm(width * 0.4, height * 0.43, -1, 14);
    }

    context.strokeStyle = "rgba(255, 238, 174, 0.34)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width * 0.46, 8);
    context.lineTo(width * 0.46, height - 8);
    context.stroke();
    context.restore();
  }

  function drawCactusSprite(obstacle) {
    const atlas = spriteAtlases.hazards;
    const frameWidth = atlas.width / 4;
    const frameHeight = atlas.height / 2;
    const frameColumn = {
      single: 0,
      armed: 1,
      double: 2,
      prickly: 3,
    }[obstacle.variant];
    const render = {
      single: { x: -40, y: -8, width: 108, height: 86 },
      armed: { x: -14, y: -7, width: 76, height: 86 },
      double: { x: -17, y: -27, width: 94, height: 98 },
      prickly: { x: -13, y: -55, width: 98, height: 112 },
    }[obstacle.variant];

    context.drawImage(
      atlas,
      frameColumn * frameWidth,
      0,
      frameWidth,
      frameHeight,
      obstacle.x + render.x,
      obstacle.y + render.y,
      render.width,
      render.height,
    );
  }

  function drawCactusArm(stemX, stemY, direction, armLength) {
    context.strokeStyle = COLORS.cactus;
    context.lineWidth = 11;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(stemX, stemY + 12);
    context.lineTo(stemX + direction * armLength, stemY + 12);
    context.lineTo(stemX + direction * armLength, stemY - 4);
    context.stroke();
  }

  function drawDonkey() {
    if (spriteAtlases.donkey) {
      drawDonkeySprite();
      drawCarriedSombrero();
      return;
    }

    const runCycle = Math.sin(game.elapsed * (game.speed / 22));
    const bob = donkey.grounded && game.state === "running" ? Math.abs(runCycle) * 2 : 0;
    const x = donkey.x;
    const y = donkey.y - bob;

    context.save();
    context.translate(x, y);
    if (!donkey.grounded) {
      context.translate(donkey.width / 2, donkey.height / 2);
      context.rotate(Math.max(-0.11, Math.min(0.08, donkey.velocityY / 8000)));
      context.translate(-donkey.width / 2, -donkey.height / 2);
    }

    drawDonkeyTail(runCycle);
    drawDonkeyLegs(runCycle);

    context.fillStyle = COLORS.donkey;
    context.beginPath();
    context.ellipse(35, 34, 29, 19, -0.04, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = COLORS.saddle;
    roundedRect(19, 19, 32, 16, 5);
    context.fill();
    context.fillStyle = "#813323";
    context.fillRect(23, 33, 5, 12);
    context.fillRect(44, 33, 5, 12);

    context.fillStyle = COLORS.cargo;
    roundedRect(24, 9, 24, 16, 4);
    context.fill();
    context.strokeStyle = "#7d5634";
    context.lineWidth = 2;
    context.strokeRect(28, 12, 16, 10);

    drawDonkeyHead();
    context.restore();
    drawCarriedSombrero();
  }

  function drawCarriedSombrero() {
    if (!game.carryingPaisano) return;
    const bob =
      donkey.grounded && game.state === "running"
        ? Math.abs(Math.sin(game.elapsed * (game.speed / 22))) * 2
        : 0;

    if (spriteAtlases.sombrero) {
      context.drawImage(
        spriteAtlases.sombrero,
        donkey.x - 5,
        donkey.y - 14 - bob,
        48,
        32,
      );
      return;
    }

    context.save();
    context.translate(donkey.x + 17, donkey.y - 4 - bob);
    context.fillStyle = "#d9a13a";
    context.beginPath();
    context.ellipse(0, 0, 23, 6, -0.08, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, -5, 9, 10, -0.08, Math.PI, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#9e3f2e";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, -1, 11, 4, -0.08, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawDonkeySprite() {
    const atlas = spriteAtlases.donkey;
    const frameWidth = atlas.width / 4;
    const frameHeight = atlas.height / 2;
    let column = 2;
    let row = 1;

    if (game.celebrationTime > 0 && donkey.grounded) {
      column = 3;
      row = 1;
    } else if (game.state === "running" && donkey.grounded) {
      column = Math.floor(game.elapsed * (game.speed / 34)) % 4;
      row = 0;
    } else if (!donkey.grounded) {
      column = 0;
      row = 1;
    } else if (game.state === "gameover") {
      column = 1;
      row = 1;
    }

    const bob =
      donkey.grounded && game.state === "running"
        ? Math.abs(Math.sin(game.elapsed * (game.speed / 22))) * 2
        : 0;

    context.drawImage(
      atlas,
      column * frameWidth,
      row * frameHeight,
      frameWidth,
      frameHeight,
      donkey.x - 14,
      donkey.y - 36 - bob,
      112,
      112,
    );
  }

  function drawDonkeyTail(runCycle) {
    context.strokeStyle = COLORS.donkeyDark;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(11, 31);
    context.quadraticCurveTo(-1, 34, 2, 45 + runCycle * 3);
    context.stroke();
    context.fillStyle = COLORS.mane;
    context.beginPath();
    context.ellipse(3, 47 + runCycle * 3, 5, 7, 0.3, 0, Math.PI * 2);
    context.fill();
  }

  function drawDonkeyLegs(runCycle) {
    const legSwing = donkey.grounded ? runCycle * 6 : 4;
    context.strokeStyle = COLORS.donkeyDark;
    context.lineWidth = 7;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(21, 44);
    context.lineTo(18 - legSwing, 60);
    context.moveTo(34, 45);
    context.lineTo(35 + legSwing, 61);
    context.moveTo(46, 44);
    context.lineTo(43 + legSwing, 61);
    context.moveTo(57, 41);
    context.lineTo(60 - legSwing, 58);
    context.stroke();
  }

  function drawDonkeyHead() {
    context.fillStyle = COLORS.donkey;
    context.beginPath();
    context.ellipse(63, 25, 18, 20, -0.2, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = COLORS.donkey;
    context.beginPath();
    context.ellipse(55, 3, 6, 15, -0.36, 0, Math.PI * 2);
    context.ellipse(69, 2, 6, 16, 0.28, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d4a58e";
    context.beginPath();
    context.ellipse(55, 3, 2, 10, -0.36, 0, Math.PI * 2);
    context.ellipse(69, 2, 2, 11, 0.28, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = COLORS.muzzle;
    context.beginPath();
    context.ellipse(72, 33, 14, 10, -0.08, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = COLORS.mane;
    context.beginPath();
    context.moveTo(47, 12);
    context.lineTo(42, 19);
    context.lineTo(48, 20);
    context.lineTo(43, 27);
    context.lineTo(51, 27);
    context.closePath();
    context.fill();

    context.fillStyle = "#241d1a";
    context.beginPath();
    context.arc(68, 21, 2.2, 0, Math.PI * 2);
    context.arc(78, 31, 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(68.6, 20.4, 0.7, 0, Math.PI * 2);
    context.fill();
  }

  function drawDust() {
    if (game.reducedMotion || !donkey.grounded || game.state !== "running") return;
    const phase = (game.elapsed * 5) % 1;
    context.save();
    context.globalAlpha = 0.34 * (1 - phase);
    context.fillStyle = "#f5d39a";
    context.beginPath();
    context.arc(donkey.x + 8 - phase * 28, VIEW.groundY + 1 - phase * 7, 5 + phase * 7, 0, Math.PI * 2);
    context.arc(donkey.x - 2 - phase * 18, VIEW.groundY + 2, 3 + phase * 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawParticles() {
    if (game.reducedMotion) return;
    context.save();
    for (const particle of game.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      if (particle.square) {
        context.fillRect(
          particle.x - particle.size / 2,
          particle.y - particle.size / 2,
          particle.size,
          particle.size,
        );
      } else {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawFlash() {
    if (game.reducedMotion || game.flashTime <= 0) return;
    context.save();
    context.globalAlpha = Math.min(0.18, game.flashTime * 0.6);
    context.fillStyle = game.flashColor;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.roundRect(x, y, width, height, safeRadius);
  }

  function frame(timestamp) {
    if (!game.lastFrame) game.lastFrame = timestamp;
    const delta = Math.min((timestamp - game.lastFrame) / 1000, 0.035);
    game.lastFrame = timestamp;

    if (game.state === "running" && game.shakeTime > 0) {
      game.shakeTime = Math.max(0, game.shakeTime - delta);
    }
    update(delta);
    draw();
    window.requestAnimationFrame(frame);
  }

  actionButton.addEventListener("click", () => handleAction());
  pauseButton.addEventListener("click", () => {
    ensureAudio();
    togglePause();
  });
  resumeButton.addEventListener("click", () => {
    ensureAudio();
    resumeGame();
  });
  soundButton.addEventListener("click", toggleSound);
  motionButton.addEventListener("click", toggleMotion);
  recordButton.addEventListener("click", startRecording);
  recordingDismiss.addEventListener("click", dismissRecording);

  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === actionButton) return;
    event.preventDefault();
    handleAction();
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction();
  });

  window.addEventListener("keydown", (event) => {
    if (["KeyP", "Escape"].includes(event.code)) {
      if (!["running", "paused"].includes(game.state)) return;
      event.preventDefault();
      if (event.repeat) return;
      togglePause();
      return;
    }

    if (event.code === "KeyM") {
      event.preventDefault();
      if (!event.repeat) toggleSound();
      return;
    }

    if (event.code === "KeyC") {
      event.preventDefault();
      if (!event.repeat) toggleMotion();
      return;
    }

    const jumpKeys = ["Space", "ArrowUp", "KeyW"];
    if (!jumpKeys.includes(event.code)) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (event.repeat) return;
    handleAction();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("storage", (event) => {
    if (event.key === CAREER_STORAGE_KEY) loadCareerProgress();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "running") pauseGame();
    game.lastFrame = performance.now();
  });

  document.body.classList.toggle("calm-mode", game.reducedMotion);
  motionButton.setAttribute("aria-pressed", String(game.reducedMotion));
  motionButton.textContent = game.reducedMotion ? "Calm on" : "Calm off";
  if (!recordingIsSupported()) {
    recordButton.disabled = true;
    recordButton.textContent = "Recording unavailable";
  }
  loadCareerProgress();
  registerOfflineSupport();
  resizeCanvas();
  resetGame();
  loadSpriteAssets();
  draw();
  window.requestAnimationFrame(frame);
})();
