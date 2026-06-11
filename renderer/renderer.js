const petRoot = document.getElementById("pet-root");
const scene = document.getElementById("scene");
const pet = document.getElementById("pet");
const petArea = document.getElementById("pet-area");
const petMotionLayer = document.getElementById("pet-motion-layer");
const spritePet = document.getElementById("sprite-pet");
const speechBubble = document.getElementById("speech-bubble");
const bubbleText = document.getElementById("bubble-text");
const thoughtDots = document.getElementById("thought-dots");

let petConfig = {
  name: "流萤",
  lines: [
    "今天也要好好学习哦。",
    "不要急，我们一步一步来。"
  ],
  reminders: {
    enabled: false,
    items: []
  }
};

const EXPRESSION_IMAGES = {
  normal: "../assets/character.png",
  happy: "../assets/character_happy.png",
  thinking: "../assets/character_thinking.png",
  sleepy: "../assets/character_sleepy.png"
};

let currentExpression = "normal";

/*
  baseExpression 鏄€滄墜鍔ㄩ€夋嫨鐨勫父椹昏〃鎯呪€濄€?
  渚嬪浣犲彸閿€変簡鈥滃洶鍥扳€濓紝baseExpression 灏辨槸 sleepy銆?
  鐐瑰嚮璇磋瘽鏃跺彲浠ヤ复鏃?thinking锛屼絾缁撴潫鍚庝細鍥炲埌 sleepy锛岃€屼笉鏄浐瀹氬洖 normal銆?
*/
let baseExpression = "normal";
let expressionTimer = null;
let isUsingFallbackImage = false;

let mouseDownX = 0;
let mouseDownY = 0;

let dragStartSceneX = 0;
let dragStartSceneY = 0;

let sceneX = 900;
let sceneY = 120;

let isMouseDown = false;
let hasMoved = false;
let bubbleTimer = null;

let spriteTimer = null;
let spritePlayToken = 0;
let currentSpriteFrame = 0;

let currentPetWidth = 180;
let currentBubbleText = "";

const BASE_PET_WIDTH = 180;
const CLICK_MOVE_DISTANCE = 6;

const EDGE_SNAP_DISTANCE = 70;
const EDGE_SNAP_MARGIN = 8;

const SPRITE_CONFIG = {
  wave: {
    src: "../assets/sprites/wave.png",
    frameWidth: 1024,
    frameHeight: 1536,
    frames: 5,
    fps: 5,
    loop: false
  }
};

let reminderTimers = [];
let remindersRuntimeEnabled = true;

let lastMouseIgnore = true;

let petHitCanvas = null;
let petHitCtx = null;
let petHitReady = false;

const IDLE_MOTION_CLASSES = [
  "idle-motion-normal",
  "idle-motion-happy",
  "idle-motion-thinking",
  "idle-motion-sleepy"
];

function getFallbackPetHitRect(rect) {
  return {
    left: rect.left + rect.width * 0.18,
    top: rect.top + rect.height * 0.10,
    right: rect.right - rect.width * 0.10,
    bottom: rect.bottom
  };
}

async function initPet() {
  try {
    buildPetHitCanvas();
    resetSceneInitialPosition();

    petConfig = await window.petAPI.getPetConfig();
    console.log("璇诲彇鍒版瀹犻厤缃細", petConfig);

    remindersRuntimeEnabled = petConfig.reminders?.enabled === true;

    setExpression("normal");
    showLine(`${petConfig.name} 已上线。`);

    startReminderSystem();

    window.petAPI.setMouseIgnore(true);
    lastMouseIgnore = true;
  } catch (error) {
    console.error("读取桌宠配置失败：", error);
    showLine("配置读取失败，但我还是在。");
  }
}

function resetSceneInitialPosition() {
  const maxX = Math.max(20, window.innerWidth - 390);
  const maxY = Math.max(20, window.innerHeight - 320);

  sceneX = Math.min(900, maxX);
  sceneY = Math.min(120, maxY);

  setScenePosition(sceneX, sceneY);
}

function setScenePosition(x, y) {
  sceneX = Math.round(x);
  sceneY = Math.round(y);

  petRoot.style.setProperty("--scene-x", `${sceneX}px`);
  petRoot.style.setProperty("--scene-y", `${sceneY}px`);
}

function getSceneSize() {
  const rect = scene.getBoundingClientRect();

  return {
    width: rect.width || 360,
    height: rect.height || 260
  };
}

function snapSceneToLeftOrBottomEdge() {
  const size = getSceneSize();

  let nextX = sceneX;
  let nextY = sceneY;

  const leftDistance = sceneX;
  const bottomDistance = window.innerHeight - (sceneY + size.height);

  if (leftDistance <= EDGE_SNAP_DISTANCE) {
    nextX = EDGE_SNAP_MARGIN;
  }

  if (bottomDistance <= EDGE_SNAP_DISTANCE) {
    nextY = window.innerHeight - size.height - EDGE_SNAP_MARGIN;
  }

  setScenePosition(nextX, nextY);
}

function moveSceneToLeftBottom() {
  const size = getSceneSize();

  const nextX = EDGE_SNAP_MARGIN;
  const nextY = window.innerHeight - size.height - EDGE_SNAP_MARGIN;

  setScenePosition(nextX, nextY);
}

function normalizeExpressionName(expressionName) {
  if (EXPRESSION_IMAGES[expressionName]) {
    return expressionName;
  }

  return "normal";
}

function updateIdleMotionByExpression(expressionName) {
  if (!petMotionLayer) return;

  petMotionLayer.classList.remove(...IDLE_MOTION_CLASSES);

  const motionClass = `idle-motion-${expressionName}`;

  if (IDLE_MOTION_CLASSES.includes(motionClass)) {
    petMotionLayer.classList.add(motionClass);
  } else {
    petMotionLayer.classList.add("idle-motion-normal");
  }
}

/*
  琛ㄦ儏鍒囨崲鏍稿績鍑芥暟銆?

  setExpression("thinking");
  琛ㄧず鎵嬪姩鍒囨崲涓烘€濊€冿紝涔嬪悗浼氫竴鐩翠繚鎸佹€濊€冦€?

  setExpression("thinking", { temporary: true, durationMs: 3500 });
  琛ㄧず涓存椂鎬濊€冿紝鏃堕棿缁撴潫鍚庡洖鍒?baseExpression銆?
*/
function setExpression(expressionName, options = {}) {
  const nextExpression = normalizeExpressionName(expressionName);
  const isTemporary = options.temporary === true;
  const durationMs = Number(options.durationMs || 0);

  if (expressionTimer) {
    clearTimeout(expressionTimer);
    expressionTimer = null;
  }

  if (!isTemporary) {
    baseExpression = nextExpression;
  }

  currentExpression = nextExpression;
  isUsingFallbackImage = false;

  pet.src = EXPRESSION_IMAGES[nextExpression];
  updateIdleMotionByExpression(nextExpression);

  if (isTemporary && durationMs > 0) {
    const restoreExpression = baseExpression;

    expressionTimer = setTimeout(() => {
      setExpression(restoreExpression);
    }, durationMs);
  }
}

function setTemporaryExpression(expressionName, durationMs = 3500) {
  setExpression(expressionName, {
    temporary: true,
    durationMs
  });
}

function restoreBaseExpressionSoon(delayMs = 300) {
  if (expressionTimer) {
    clearTimeout(expressionTimer);
  }

  expressionTimer = setTimeout(() => {
    setExpression(baseExpression);
  }, delayMs);
}

function handleExpressionImageError() {
  if (isUsingFallbackImage) {
    return;
  }

  isUsingFallbackImage = true;
  console.warn(`琛ㄦ儏鍥剧墖涓嶅瓨鍦紝宸插洖閫€鍒版櫘閫氬浘锛?{currentExpression}`);

  pet.src = EXPRESSION_IMAGES.normal;
}

pet.addEventListener("error", handleExpressionImageError);

if (pet.complete) {
  buildPetHitCanvas();
} else {
  pet.addEventListener("load", () => {
    buildPetHitCanvas();
  });
}

pet.addEventListener("load", () => {
  buildPetHitCanvas();
});

function buildPetHitCanvas() {
  if (!pet.naturalWidth || !pet.naturalHeight) {
    return;
  }

  try {
    petHitCanvas = document.createElement("canvas");
    petHitCanvas.width = pet.naturalWidth;
    petHitCanvas.height = pet.naturalHeight;

    petHitCtx = petHitCanvas.getContext("2d");
    petHitCtx.clearRect(0, 0, petHitCanvas.width, petHitCanvas.height);
    petHitCtx.drawImage(pet, 0, 0);

    petHitReady = true;

    console.log("角色透明像素检测已准备好。");
  } catch (error) {
    petHitReady = false;
    petHitCanvas = null;
    petHitCtx = null;

    console.warn("角色透明像素检测初始化失败，将使用备用点击范围：", error);
  }
}

/*
  绋冲畾鎷栧姩鐗堬細
  涓嶇Щ鍔?Electron 绐楀彛锛屽彧绉诲姩 #scene銆?
*/
petRoot.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;

  event.preventDefault();

  stopSpriteMotion();

  window.petAPI.setMouseIgnore(false);
  lastMouseIgnore = false;

  isMouseDown = true;
  hasMoved = false;

  mouseDownX = event.screenX;
  mouseDownY = event.screenY;

  dragStartSceneX = sceneX;
  dragStartSceneY = sceneY;

  setTemporaryExpression("thinking", 0);

  petRoot.classList.add("dragging-pet");

  speechBubble.classList.remove("show");
  speechBubble.classList.add("dragging");
});

petRoot.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  if (isMouseDown) {
    cancelMouseDrag();
  }

  window.petAPI.showContextMenu();
});

document.addEventListener("mousemove", (event) => {
  /*
    淇濋櫓淇锛?
    濡傛灉绋嬪簭浠ヤ负榧犳爣杩樻寜鐫€锛屼絾绯荤粺鍛婅瘔鎴戜滑宸﹂敭宸茬粡鏉惧紑锛?
    璇存槑 mouseup 涓簡銆傝繖閲岀珛鍒荤粨鏉熸嫋鍔紝闃叉娴佽悿璺熺潃榧犳爣璺戙€?
  */
  if (isMouseDown && event.buttons !== 1) {
    finishMouseDrag(event);
    return;
  }

  if (!isMouseDown) {
    updateMouseIgnoreState(event.clientX, event.clientY);
    return;
  }

  const dx = event.screenX - mouseDownX;
  const dy = event.screenY - mouseDownY;

  if (Math.abs(dx) > CLICK_MOVE_DISTANCE || Math.abs(dy) > CLICK_MOVE_DISTANCE) {
    hasMoved = true;
  }

  setScenePosition(dragStartSceneX + dx, dragStartSceneY + dy);
});

document.addEventListener("mouseup", (event) => {
  finishMouseDrag(event);
}, true);

window.addEventListener("mouseup", (event) => {
  finishMouseDrag(event);
}, true);

document.addEventListener("mouseleave", () => {
  if (isMouseDown) return;

  setMouseIgnoreIfChanged(true);
});

window.addEventListener("blur", () => {
  if (!isMouseDown) return;

  cancelMouseDrag();
});

function cancelMouseDrag() {
  isMouseDown = false;
  hasMoved = false;

  speechBubble.classList.remove("dragging");
  petRoot.classList.remove("dragging-pet");

  stopSpriteMotion();
  restoreBaseExpressionSoon(200);
  setMouseIgnoreIfChanged(true);
}

function finishMouseDrag(event) {
  if (!isMouseDown) return;

  const wasMoved = hasMoved;

  /*
    鍏堝叧闂嫋鍔ㄧ姸鎬併€?
    杩欐牱 showRandomLine / 琛ㄦ儏鍒囨崲 / idle 鍔ㄧ敾瑙﹀彂鏃讹紝
    涓嶄細鍐嶈璇垽涓烘鍦ㄦ嫋鍔ㄣ€?
  */
  isMouseDown = false;
  hasMoved = false;

  speechBubble.classList.remove("show");
  speechBubble.classList.remove("dragging");

  petRoot.classList.remove("dragging-pet");

  if (!wasMoved) {
    showRandomLine();
  } else {
    snapSceneToLeftOrBottomEdge();
    restoreBaseExpressionSoon(300);
  }

  if (
    event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number"
  ) {
    updateMouseIgnoreState(event.clientX, event.clientY);
  } else {
    setMouseIgnoreIfChanged(true);
  }
}

window.petAPI.onGlobalCursorMove((data) => {
  if (!data || data.insideWindow !== true) {
    if (!isMouseDown) {
      setMouseIgnoreIfChanged(true);
    }
    return;
  }

  updateMouseIgnoreState(data.x, data.y);
});

if (window.petAPI.onPetAction) {
  window.petAPI.onPetAction((actionName) => {
    handlePetAction(actionName);
  });
}

function handlePetAction(actionName) {
  if (actionName === "talk") {
    showRandomLine();
    return;
  }

  if (actionName === "reset-position") {
    resetSceneInitialPosition();
    showLine("我回到默认位置啦。");
    return;
  }

  if (actionName === "snap-left-bottom") {
    moveSceneToLeftBottom();
    showLine("我到左下角啦。");
    return;
  }

  if (actionName === "toggle-reminders") {
    toggleReminderSystem();
    return;
  }

  if (actionName === "expression-normal") {
    setExpression("normal");
    showLine("我恢复普通状态啦。");
    return;
  }

  if (actionName === "expression-happy") {
    setExpression("happy");
    showLine("嘿嘿，我很开心。");
    return;
  }

  if (actionName === "expression-thinking") {
    setExpression("thinking");
    showLine("我正在认真思考。");
    return;
  }

  if (actionName === "expression-sleepy") {
    setExpression("sleepy");
    showLine("有点困困的……");
    return;
  }
}

function updateMouseIgnoreState(mouseX, mouseY) {
  if (isMouseDown) {
    setMouseIgnoreIfChanged(false);
    return;
  }

  const insidePetVisiblePixel = isInsidePetVisiblePixel(mouseX, mouseY);
  const insideBubble = isInsideBubbleVisibleArea(mouseX, mouseY);

  const shouldAcceptMouse = insidePetVisiblePixel || insideBubble;
  const shouldIgnoreMouse = !shouldAcceptMouse;

  setMouseIgnoreIfChanged(shouldIgnoreMouse);
}

function isInsidePetVisiblePixel(mouseX, mouseY) {
  const rect = pet.getBoundingClientRect();

  if (
    mouseX < rect.left ||
    mouseX > rect.right ||
    mouseY < rect.top ||
    mouseY > rect.bottom
  ) {
    return false;
  }

  if (!petHitReady || !petHitCtx || !petHitCanvas) {
    return isInsideRect(mouseX, mouseY, getFallbackPetHitRect(rect));
  }

  const imageX = Math.floor(
    ((mouseX - rect.left) / rect.width) * petHitCanvas.width
  );

  const imageY = Math.floor(
    ((mouseY - rect.top) / rect.height) * petHitCanvas.height
  );

  if (
    imageX < 0 ||
    imageX >= petHitCanvas.width ||
    imageY < 0 ||
    imageY >= petHitCanvas.height
  ) {
    return false;
  }

  try {
    const pixel = petHitCtx.getImageData(imageX, imageY, 1, 1).data;
    const alpha = pixel[3];

    return alpha > 12;
  } catch (error) {
    console.warn("透明像素检测失败，使用备用点击范围：", error);
    return isInsideRect(mouseX, mouseY, getFallbackPetHitRect(rect));
  }
}

function isInsideBubbleVisibleArea(mouseX, mouseY) {
  const bubbleIsShowing = speechBubble.classList.contains("show");

  if (!bubbleIsShowing) {
    return false;
  }

  const bubbleRect = speechBubble.getBoundingClientRect();

  const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
  const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;
  const bubbleRadiusX = bubbleRect.width / 2;
  const bubbleRadiusY = bubbleRect.height / 2;

  const normalizedX = (mouseX - bubbleCenterX) / bubbleRadiusX;
  const normalizedY = (mouseY - bubbleCenterY) / bubbleRadiusY;

  const insideCloud =
    normalizedX * normalizedX + normalizedY * normalizedY <= 1.15;

  if (insideCloud) {
    return true;
  }

  if (!thoughtDots) {
    return false;
  }

  const dots = thoughtDots.querySelectorAll(".thought-dot");

  for (const dot of dots) {
    const dotRect = dot.getBoundingClientRect();

    const centerX = dotRect.left + dotRect.width / 2;
    const centerY = dotRect.top + dotRect.height / 2;
    const radius = Math.max(dotRect.width, dotRect.height) / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;

    if (dx * dx + dy * dy <= radius * radius) {
      return true;
    }
  }

  return false;
}

function setMouseIgnoreIfChanged(shouldIgnoreMouse) {
  if (shouldIgnoreMouse === lastMouseIgnore) {
    return;
  }

  lastMouseIgnore = shouldIgnoreMouse;
  window.petAPI.setMouseIgnore(shouldIgnoreMouse);
}

function isInsideRect(x, y, rect) {
  return (
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

/* =========================
   Sprite 鍔ㄤ綔绯荤粺
========================= */

function stopSpriteMotion() {
  spritePlayToken += 1;

  if (spriteTimer) {
    clearInterval(spriteTimer);
    spriteTimer = null;
  }

  currentSpriteFrame = 0;

  if (spritePet) {
    spritePet.style.display = "none";
    spritePet.style.backgroundImage = "";
    spritePet.style.backgroundPosition = "0px 0px";
  }

  pet.classList.remove("sprite-hidden");

  if (petMotionLayer) {
    petMotionLayer.classList.remove("sprite-playing");
  }
}

function playSpriteMotion(motionName = "wave", fallbackMotion = "hop") {
  const sprite = SPRITE_CONFIG[motionName];

  if (!spritePet || !sprite) {
    playPetMotion(fallbackMotion);
    return;
  }

  const token = spritePlayToken + 1;
  spritePlayToken = token;

  if (spriteTimer) {
    clearInterval(spriteTimer);
    spriteTimer = null;
  }

  const testImage = new Image();

  testImage.onload = () => {
    if (token !== spritePlayToken) return;

    currentSpriteFrame = 0;

    /*
      鍏抽敭淇锛?
      涓嶈兘鐢?pet.getBoundingClientRect().height銆?
      鍥犱负 getBoundingClientRect() 鎷垮埌鐨勬槸宸茬粡琚?sceneScale 缂╂斁鍚庣殑楂樺害銆?
      sprite 鏈韩鍦?#scene 閲岄潰锛屽悗闈㈣繕浼氳 sceneScale 鍐嶇缉鏀句竴娆★紝
      鎵€浠ヤ細瀵艰嚧杩蜂綘鏇村皬銆佸ぇ鍙锋洿澶с€?

      杩欓噷鏀圭敤 offsetHeight / clientHeight銆?
      瀹冩嬁鍒扮殑鏄湭缁忚繃 transform scale 鐨勫竷灞€楂樺害銆?
    */
    const realFrameWidth = Math.round(testImage.naturalWidth / sprite.frames);
    const realFrameHeight = testImage.naturalHeight;

    const unscaledPetHeight = Math.round(
      pet.offsetHeight || pet.clientHeight || 258
    );

    /*
      杩欓噷鎶?sprite 鏄剧ず鍒板拰褰撳墠绔嬬粯鐨勬湭缂╂斁楂樺害涓€鑷淬€?
      鐒跺悗鐢?#scene 鐨?scale 缁熶竴鎺у埗杩蜂綘/灏?姝ｅ父/澶с€?
      杩欐牱涓嶄細閲嶅缂╂斁銆?
    */
    const visualHeight = unscaledPetHeight;
    const visualWidth = Math.round(
      visualHeight * realFrameWidth / realFrameHeight
    );

    pet.classList.add("sprite-hidden");

    if (petMotionLayer) {
      petMotionLayer.classList.add("sprite-playing");
    }

    spritePet.style.display = "block";
    spritePet.style.width = `${visualWidth}px`;
    spritePet.style.height = `${visualHeight}px`;
    spritePet.style.backgroundImage = `url("${sprite.src}")`;
    spritePet.style.backgroundSize =
      `${visualWidth * sprite.frames}px ${visualHeight}px`;

    updateSpriteFrame(visualWidth);

    spriteTimer = setInterval(() => {
      if (token !== spritePlayToken) {
        clearInterval(spriteTimer);
        spriteTimer = null;
        return;
      }

      currentSpriteFrame += 1;

      if (currentSpriteFrame >= sprite.frames) {
        if (sprite.loop) {
          currentSpriteFrame = 0;
        } else {
          stopSpriteMotion();
          return;
        }
      }

      updateSpriteFrame(visualWidth);
    }, 1000 / sprite.fps);
  };

  testImage.onerror = () => {
    if (token !== spritePlayToken) return;

    console.warn(`没有找到 sprite 动作图：${sprite.src}，已回退为 CSS 小动作。`);
    stopSpriteMotion();
    playPetMotion(fallbackMotion);
  };

  testImage.src = sprite.src;
}

function updateSpriteFrame(frameWidth) {
  const x = -currentSpriteFrame * frameWidth;

  if (spritePet) {
    spritePet.style.backgroundPosition = `${x}px 0px`;
  }
}

/* =========================
   CSS 灏忓姩浣?
========================= */

function playPetMotion(motionName = "hop") {
  const motionTarget = petArea || pet;
  const className = `pet-motion-${motionName}`;

  motionTarget.classList.remove("pet-motion-hop");
  motionTarget.classList.remove("pet-motion-wiggle");

  void motionTarget.offsetWidth;

  motionTarget.classList.add(className);

  setTimeout(() => {
    motionTarget.classList.remove(className);
  }, 650);
}

/* =========================
   鍙拌瘝绯荤粺
========================= */

function showRandomLine() {
  const lines = petConfig.lines || [];

  if (lines.length === 0) {
    showLine("我还没有台词呢。", {
      expression: "thinking",
      expressionDurationMs: 3500,
      motion: "wave"
    });
    return;
  }

  const randomIndex = Math.floor(Math.random() * lines.length);
  const line = lines[randomIndex];

  /*
    鐐瑰嚮璇磋瘽锛?
    1. 涓存椂鍒囨崲涓烘€濊€?
    2. 鏈?wave.png 鏃舵挱鏀炬尌鎵?sprite
    3. 娌℃湁 wave.png 鏃跺洖閫€涓鸿交杞昏烦涓€涓?
  */
  showLine(line, {
    expression: "thinking",
    expressionDurationMs: 3500,
    motion: "wave"
  });
}

/*
  showLine 榛樿涓嶅己鍒跺垏琛ㄦ儏銆?
  鍙湁 options.expression 瀛樺湪鏃讹紝鎵嶄复鏃跺垏鎹㈣〃鎯呫€?
*/
function showLine(line, options = {}) {
  let displayLine = line;

  if (Array.from(displayLine).length > 32) {
    displayLine = Array.from(displayLine).slice(0, 32).join("") + "……";
  }

  currentBubbleText = displayLine;

  updateCloudSizeByText(displayLine);

  bubbleText.textContent = displayLine;
  speechBubble.classList.add("show");

  if (options.expression) {
    setTemporaryExpression(
      options.expression,
      options.expressionDurationMs || 3500
    );
  }

  if (options.motion === "wave") {
    playSpriteMotion("wave", "hop");
  } else if (options.motion) {
    playPetMotion(options.motion);
  }

  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }

  bubbleTimer = setTimeout(() => {
    speechBubble.classList.remove("show");
  }, 3500);
}

function getTextVisualLength(text) {
  return Array.from(text).reduce((sum, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) {
      return sum + 1;
    }

    if (/[A-Z0-9]/i.test(char)) {
      return sum + 0.58;
    }

    return sum + 0.4;
  }, 0);
}

function updateCloudSizeByText(text) {
  const visualLength = getTextVisualLength(text);

  let cloudWidth;

  if (visualLength <= 4) {
    cloudWidth = 88;
  } else if (visualLength <= 8) {
    cloudWidth = 108;
  } else if (visualLength <= 14) {
    cloudWidth = 130;
  } else if (visualLength <= 22) {
    cloudWidth = 158;
  } else {
    cloudWidth = 182;
  }

  let heightRatio;

  if (visualLength <= 8) {
    heightRatio = 0.56;
  } else if (visualLength <= 18) {
    heightRatio = 0.58;
  } else {
    heightRatio = 0.60;
  }

  const cloudHeight = Math.round(cloudWidth * heightRatio);

  petRoot.style.setProperty("--cloud-width", `${cloudWidth}px`);
  petRoot.style.setProperty("--cloud-height", `${cloudHeight}px`);
}

/* =========================
   鎻愰啋绯荤粺
========================= */

function startReminderSystem() {
  stopReminderSystem();

  const reminders = petConfig.reminders;

  if (!reminders || reminders.enabled !== true || remindersRuntimeEnabled !== true) {
    console.log("提醒功能未开启。");
    return;
  }

  const items = reminders.items || [];

  if (items.length === 0) {
    console.log("没有配置提醒内容。");
    return;
  }

  items.forEach((item) => {
    const firstDelaySeconds = Number(item.firstDelaySeconds || 60);
    const intervalMinutes = Number(item.intervalMinutes || 30);

    const firstDelayMs = firstDelaySeconds * 1000;
    const intervalMs = intervalMinutes * 60 * 1000;

    const firstTimer = setTimeout(() => {
      showReminderLine(item);

      const intervalTimer = setInterval(() => {
        showReminderLine(item);
      }, intervalMs);

      reminderTimers.push(intervalTimer);
    }, firstDelayMs);

    reminderTimers.push(firstTimer);

    console.log(
      `已启动提醒：${item.name || "未命名提醒"}，${firstDelaySeconds} 秒后首次提醒，之后每 ${intervalMinutes} 分钟提醒一次。`
    );
  });
}

function stopReminderSystem() {
  reminderTimers.forEach((timer) => {
    clearTimeout(timer);
    clearInterval(timer);
  });

  reminderTimers = [];
}

function toggleReminderSystem() {
  remindersRuntimeEnabled = !remindersRuntimeEnabled;

  if (remindersRuntimeEnabled) {
    startReminderSystem();
    showLine("提醒功能已开启。");
  } else {
    stopReminderSystem();
    showLine("提醒功能已关闭。");
  }
}

function showReminderLine(item) {
  const lines = item.lines || [];

  if (lines.length === 0) {
    showLine("该休息一下啦。", {
      expression: "thinking",
      expressionDurationMs: 3500,
      motion: "wiggle"
    });
    return;
  }

  const randomIndex = Math.floor(Math.random() * lines.length);
  const line = lines[randomIndex];

  showLine(line, {
    expression: "thinking",
    expressionDurationMs: 3500,
    motion: "wiggle"
  });
}

/* =========================
   灏哄鍙樺寲
========================= */

window.petAPI.onSetPetWidth((width) => {
  currentPetWidth = width;

  const sceneScale = width / BASE_PET_WIDTH;

  petRoot.style.setProperty("--scene-scale", sceneScale);

  pet.style.width = `${BASE_PET_WIDTH}px`;
  petRoot.style.setProperty("--pet-width", `${BASE_PET_WIDTH}px`);

  if (currentBubbleText) {
    updateCloudSizeByText(currentBubbleText);
  } else {
    updateCloudSizeByText("娴佽悿");
  }
});

window.addEventListener("resize", () => {
  setScenePosition(sceneX, sceneY);
});

initPet();
