import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const speedValue = document.querySelector("#speed-value");
const cameraValue = document.querySelector("#camera-value");
const sectorValue = document.querySelector("#sector-value");
const cameraToggleButton = document.querySelector("#camera-toggle");
const touchButtons = Array.from(document.querySelectorAll("[data-key]"));
const isMobile = window.matchMedia("(max-width: 720px)").matches;
const maxPixelRatio = isMobile ? 1.1 : 1.5;
const textureResolution = isMobile ? 256 : 512;
const starCount = isMobile ? 2800 : 5200;
const starSize = isMobile ? 5.5 : 7;
const milkyWayRingCount = isMobile ? 12 : 18;
const nebulaCount = isMobile ? 7 : 12;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030713, 0.00022);

function createGlowTexture(innerColor = "#ffffff", outerColor = "rgba(255,255,255,0)") {
  const size = isMobile ? 64 : 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.28, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.24)");
  gradient.addColorStop(1, outerColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const starGlowTexture = createGlowTexture("#ffffff");
const nebulaTexture = createGlowTexture("#8ed8ff", "rgba(75, 0, 130, 0)");

function createNoiseTexture(size, drawPixel) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const color = drawPixel(x, y, size);
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = color[3] ?? 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBumpTexture(size, drawValue) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const value = drawValue(x, y, size);
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function pickPlanetProfile(index, isEarthLike) {
  if (isEarthLike) {
    return {
      kind: "earth",
      baseA: [26, 71, 156],
      baseB: [54, 146, 224],
      detail: [72, 166, 72],
      cloud: [236, 244, 255],
      emissive: 0x1a4f9a,
      bumpScale: 0.08,
      roughness: 0.82,
      metalness: 0.02,
    };
  }

  const profiles = [
    {
      kind: "rocky",
      baseA: [135, 98, 66],
      baseB: [186, 131, 84],
      detail: [99, 73, 46],
      emissive: 0x2f1608,
      bumpScale: 0.12,
      roughness: 0.95,
      metalness: 0.01,
    },
    {
      kind: "cloudy",
      baseA: [196, 169, 120],
      baseB: [231, 207, 152],
      detail: [158, 119, 82],
      emissive: 0x3f2916,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.01,
    },
    {
      kind: "mars",
      baseA: [165, 77, 54],
      baseB: [209, 116, 77],
      detail: [106, 52, 34],
      emissive: 0x40160e,
      bumpScale: 0.09,
      roughness: 0.92,
      metalness: 0.01,
    },
    {
      kind: "gas",
      baseA: [174, 126, 62],
      baseB: [221, 177, 97],
      detail: [132, 89, 34],
      emissive: 0x503316,
      bumpScale: 0.03,
      roughness: 0.75,
      metalness: 0.02,
    },
  ];

  return profiles[index % profiles.length];
}

function createPlanetMaps(profile) {
  const map = createNoiseTexture(textureResolution, (x, y, size) => {
    const nx = x / size;
    const ny = y / size;

    if (profile.kind === "earth") {
      const continentA = Math.sin((nx * 4.6 + ny * 2.2) * Math.PI);
      const continentB = Math.cos((nx * 7.8 - ny * 3.9) * Math.PI);
      const continentC = Math.sin((nx * 13.5 + ny * 9.4) * Math.PI);
      const continentMask = continentA * 0.45 + continentB * 0.35 + continentC * 0.2;
      const polarFade = Math.abs(ny - 0.5) * 1.85;
      const isLand = continentMask - polarFade * 0.18 > 0.15;

      if (isLand) {
        const lushness = Math.sin((nx * 18 + ny * 11) * Math.PI) * 0.5 + 0.5;
        return [
          Math.round(THREE.MathUtils.lerp(44, 92, lushness)),
          Math.round(THREE.MathUtils.lerp(118, 176, lushness)),
          Math.round(THREE.MathUtils.lerp(40, 86, lushness)),
          255,
        ];
      }

      const current = Math.sin((nx * 12 - ny * 8) * Math.PI) * 0.5 + 0.5;
      return [
        Math.round(THREE.MathUtils.lerp(profile.baseA[0], profile.baseB[0], current)),
        Math.round(THREE.MathUtils.lerp(profile.baseA[1], profile.baseB[1], current)),
        Math.round(THREE.MathUtils.lerp(profile.baseA[2], profile.baseB[2], current)),
        255,
      ];
    }

    const bands = Math.sin(ny * Math.PI * (profile.kind === "gas" ? 18 : 9));
    const swirls =
      Math.sin((nx * 16 + ny * 10) * Math.PI) * 0.5 +
      Math.cos((nx * 7 - ny * 13) * Math.PI) * 0.5;
    const grain = Math.sin((nx * 53 + ny * 71) * Math.PI) * 0.5 + 0.5;
    const mask = THREE.MathUtils.clamp(0.5 + bands * 0.24 + swirls * 0.18 + grain * 0.14, 0, 1);

    const r = THREE.MathUtils.lerp(profile.baseA[0], profile.baseB[0], mask);
    const g = THREE.MathUtils.lerp(profile.baseA[1], profile.baseB[1], mask);
    const b = THREE.MathUtils.lerp(profile.baseA[2], profile.baseB[2], mask);

    const detailMix = Math.max(0, Math.sin((nx * 22 - ny * 17) * Math.PI) * 0.5 + 0.5);
    return [
      Math.round(THREE.MathUtils.lerp(r, profile.detail[0], detailMix * 0.25)),
      Math.round(THREE.MathUtils.lerp(g, profile.detail[1], detailMix * 0.25)),
      Math.round(THREE.MathUtils.lerp(b, profile.detail[2], detailMix * 0.25)),
      255,
    ];
  });

  const bumpMap = createBumpTexture(textureResolution, (x, y, size) => {
    const nx = x / size;
    const ny = y / size;
    const base = Math.sin((nx * 25 + ny * 11) * Math.PI) * 0.5 + 0.5;
    const secondary = Math.cos((nx * 41 - ny * 37) * Math.PI) * 0.5 + 0.5;
    return Math.round((base * 0.65 + secondary * 0.35) * 255);
  });

  return { map, bumpMap };
}

function createCloudTexture() {
  return createNoiseTexture(textureResolution, (x, y, size) => {
    const nx = x / size;
    const ny = y / size;
    const band = Math.sin((ny * 18 + nx * 3) * Math.PI) * 0.5 + 0.5;
    const noise = Math.cos((nx * 39 - ny * 27) * Math.PI) * 0.5 + 0.5;
    const alpha = THREE.MathUtils.clamp((band * 0.55 + noise * 0.45 - 0.62) * 255, 0, 210);
    return [240, 246, 255, alpha];
  });
}

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  4000
);
camera.position.set(0, 12, 26);

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.maxDistance = 120;
controls.minDistance = 8;

const ambientLight = new THREE.AmbientLight(0x89aaff, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff1bf, 1.7);
sunLight.position.set(180, 110, 60);
scene.add(sunLight);

const fillLight = new THREE.PointLight(0x77d8ff, 1.5, 420, 2);
fillLight.position.set(-180, -30, -80);
scene.add(fillLight);

const ship = new THREE.Group();
const shipBody = new THREE.Group();
ship.add(shipBody);
ship.scale.setScalar(isMobile ? 2.2 : 1.9);
scene.add(ship);

const shipMaterial = new THREE.MeshStandardMaterial({
  color: 0xdfe8ff,
  emissive: 0x17315a,
  metalness: 0.88,
  roughness: 0.22,
});

const hull = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.9, 5.8, 6, 12),
  shipMaterial
);
hull.rotation.z = -Math.PI / 2;
shipBody.add(hull);

const nose = new THREE.Mesh(
  new THREE.ConeGeometry(1.15, 3.6, 14),
  new THREE.MeshStandardMaterial({
    color: 0xf4f7ff,
    emissive: 0x24477d,
    metalness: 0.92,
    roughness: 0.16,
  })
);
nose.position.x = 4.3;
nose.rotation.z = -Math.PI / 2;
shipBody.add(nose);

const canopy = new THREE.Mesh(
  new THREE.SphereGeometry(0.92, 14, 14),
  new THREE.MeshPhysicalMaterial({
    color: 0x7fdfff,
    transparent: true,
    transmission: 0.65,
    opacity: 0.92,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1,
  })
);
canopy.position.set(1.1, 0.58, 0);
canopy.scale.set(1.45, 0.72, 0.98);
shipBody.add(canopy);

const spine = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 0.28, 0.34),
  shipMaterial
);
spine.position.set(-0.3, 0.72, 0);
shipBody.add(spine);

const wingGeometry = new THREE.BoxGeometry(3.8, 0.16, 2.3);
const leftWing = new THREE.Mesh(wingGeometry, shipMaterial);
leftWing.position.set(-0.55, -0.18, 2.2);
leftWing.rotation.y = 0.28;
leftWing.rotation.z = 0.08;
shipBody.add(leftWing);

const rightWing = leftWing.clone();
rightWing.position.z = -2.2;
rightWing.rotation.y = -0.28;
rightWing.rotation.z = -0.08;
shipBody.add(rightWing);

function addWingTricolor(wing, side) {
  const stripeGeometry = new THREE.BoxGeometry(3.55, 0.03, 0.64);
  const saffron = new THREE.Mesh(
    stripeGeometry,
    new THREE.MeshBasicMaterial({ color: 0xff9933 })
  );
  saffron.position.set(0, 0.1, side * 0.62);
  wing.add(saffron);

  const white = new THREE.Mesh(
    stripeGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  white.position.set(0, 0.1, side * 0.02);
  wing.add(white);

  const green = new THREE.Mesh(
    stripeGeometry,
    new THREE.MeshBasicMaterial({ color: 0x138808 })
  );
  green.position.set(0, 0.1, side * -0.58);
  wing.add(green);

  const chakra = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a5fb4 })
  );
  chakra.rotation.x = Math.PI / 2;
  chakra.position.set(0.1, 0.11, 0);
  wing.add(chakra);
}

addWingTricolor(leftWing, 1);
addWingTricolor(rightWing, -1);

const finGeometry = new THREE.BoxGeometry(1.5, 1.6, 0.16);
const dorsalFin = new THREE.Mesh(finGeometry, shipMaterial);
dorsalFin.position.set(-2.6, 1.05, 0);
dorsalFin.rotation.z = 0.32;
shipBody.add(dorsalFin);

const lowerFin = dorsalFin.clone();
lowerFin.position.y = -1.02;
lowerFin.rotation.z = -0.32;
shipBody.add(lowerFin);

const engineMaterial = new THREE.MeshStandardMaterial({
  color: 0xa3ecff,
  emissive: 0x55ddff,
  emissiveIntensity: 1.9,
  metalness: 0.2,
  roughness: 0.45,
});

const engineGlow = new THREE.Mesh(
  new THREE.CylinderGeometry(0.52, 0.66, 1.15, 24),
  engineMaterial
);
engineGlow.rotation.z = Math.PI / 2;
engineGlow.position.set(-3.9, 0, 0);
shipBody.add(engineGlow);

const engineHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: starGlowTexture,
    color: 0x74eaff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
  })
);
engineHalo.position.set(-4.5, 0, 0);
engineHalo.scale.set(3.8, 2.1, 1);
shipBody.add(engineHalo);

const accentMaterial = new THREE.MeshBasicMaterial({ color: 0x7ee7ff });
const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.18), accentMaterial);
accentStrip.position.set(0.8, 0.05, 0);
shipBody.add(accentStrip);

const indiaStripeSaffron = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 0.12, 0.18),
  new THREE.MeshBasicMaterial({ color: 0xff9933 })
);
indiaStripeSaffron.position.set(0.25, 0.3, 0);
shipBody.add(indiaStripeSaffron);

const indiaStripeWhite = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 0.08, 0.18),
  new THREE.MeshBasicMaterial({ color: 0xf8fbff })
);
indiaStripeWhite.position.set(0.25, 0.14, 0);
shipBody.add(indiaStripeWhite);

const indiaStripeGreen = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 0.12, 0.18),
  new THREE.MeshBasicMaterial({ color: 0x138808 })
);
indiaStripeGreen.position.set(0.25, -0.02, 0);
shipBody.add(indiaStripeGreen);

const chakra = new THREE.Mesh(
  new THREE.TorusGeometry(0.18, 0.03, 10, 28),
  new THREE.MeshBasicMaterial({ color: 0x1a5fb4 })
);
chakra.position.set(0.5, 0.14, 0.12);
chakra.rotation.y = Math.PI / 2;
shipBody.add(chakra);

const finTipMaterial = new THREE.MeshBasicMaterial({ color: 0xff9933 });
const finTipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.88, 0.06), finTipMaterial);
finTipLeft.position.set(-2.95, 1.18, 0);
finTipLeft.rotation.z = 0.32;
shipBody.add(finTipLeft);

const finTipRight = finTipLeft.clone();
finTipRight.position.y = -1.16;
finTipRight.rotation.z = -0.32;
shipBody.add(finTipRight);

const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const radius = 450 + Math.random() * 2200;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.55;
  starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
}
starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3)
);

const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0xffffff,
    map: starGlowTexture,
    size: starSize,
    sizeAttenuation: true,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
  })
);
scene.add(stars);

const milkyWay = new THREE.Group();
scene.add(milkyWay);

for (let i = 0; i < milkyWayRingCount; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(520 + i * 14, 15 + i * 2.2, 12, 56),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.58 + i * 0.003, 0.7, 0.55),
      transparent: true,
      opacity: 0.035,
    })
  );
  ring.rotation.x = Math.PI * 0.43;
  ring.rotation.y = Math.PI * 0.16;
  ring.position.y = -120 + i * 2.7;
  milkyWay.add(ring);
}

function createGalaxyCluster({ position, color, scale, count }) {
  const cluster = new THREE.Group();
  cluster.position.copy(position);

  for (let i = 0; i < count; i += 1) {
    const swirl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nebulaTexture,
        color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.18,
      })
    );
    const angle = (i / count) * Math.PI * 2;
    const radius = scale * (0.25 + Math.random() * 0.75);
    swirl.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * scale * 0.22,
      Math.sin(angle) * radius * 0.45
    );
    const swirlScale = scale * (0.6 + Math.random() * 0.7);
    swirl.scale.set(swirlScale, swirlScale * 0.55, 1);
    cluster.add(swirl);
  }

  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starGlowTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    })
  );
  core.scale.set(scale * 0.95, scale * 0.95, 1);
  cluster.add(core);

  return cluster;
}

const galaxyClusters = [
  createGalaxyCluster({
    position: new THREE.Vector3(-920, 260, -1500),
    color: 0x90bcff,
    scale: 120,
    count: isMobile ? 5 : 8,
  }),
  createGalaxyCluster({
    position: new THREE.Vector3(1180, -180, -1850),
    color: 0xffa0d9,
    scale: 150,
    count: isMobile ? 6 : 10,
  }),
  createGalaxyCluster({
    position: new THREE.Vector3(420, 420, -1350),
    color: 0x9ef7d6,
    scale: 90,
    count: isMobile ? 4 : 7,
  }),
];

galaxyClusters.forEach((cluster) => scene.add(cluster));

function createConstellation(points, color) {
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.34,
  });
  const positions = [];
  points.forEach((point) => positions.push(point.x, point.y, point.z));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const line = new THREE.Line(geometry, lineMaterial);

  const markers = new THREE.Group();
  points.forEach((point) => {
    const starMarker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starGlowTexture,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      })
    );
    starMarker.position.copy(point);
    starMarker.scale.setScalar(isMobile ? 8 : 11);
    markers.add(starMarker);
  });

  const constellation = new THREE.Group();
  constellation.add(line);
  constellation.add(markers);
  return constellation;
}

const constellations = [
  createConstellation(
    [
      new THREE.Vector3(-180, 190, -520),
      new THREE.Vector3(-145, 222, -530),
      new THREE.Vector3(-102, 207, -545),
      new THREE.Vector3(-72, 168, -560),
      new THREE.Vector3(-34, 185, -578),
    ],
    0x8eb6ff
  ),
  createConstellation(
    [
      new THREE.Vector3(210, 135, -640),
      new THREE.Vector3(248, 164, -655),
      new THREE.Vector3(292, 146, -680),
      new THREE.Vector3(330, 173, -700),
      new THREE.Vector3(366, 149, -728),
    ],
    0xffd58d
  ),
  createConstellation(
    [
      new THREE.Vector3(40, -120, -480),
      new THREE.Vector3(88, -92, -510),
      new THREE.Vector3(126, -136, -536),
      new THREE.Vector3(170, -104, -565),
    ],
    0x9df4d2
  ),
];

constellations.forEach((constellation) => scene.add(constellation));

function createSolarSystem({
  position,
  starColor,
  planetColors,
  orbitBase,
  scale,
  name = "System",
  earthLikeIndex = -1,
}) {
  const system = new THREE.Group();
  system.position.copy(position);
  system.userData.name = name;

  const star = new THREE.Mesh(
    new THREE.SphereGeometry(scale * 5.5, 20, 20),
    new THREE.MeshStandardMaterial({
      color: starColor,
      emissive: starColor,
      emissiveIntensity: 1.35,
      roughness: 0.95,
    })
  );
  system.add(star);

  const starGlow = new THREE.PointLight(starColor, 2.2, 240 * scale, 2);
  system.add(starGlow);

  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starGlowTexture,
      color: starColor,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.62,
    })
  );
  corona.scale.setScalar(scale * 24);
  system.add(corona);

  const planetPivots = [];

  planetColors.forEach((color, index) => {
    const pivot = new THREE.Group();
    const orbitRadius = orbitBase + index * scale * 10.5;
    const isEarthLike = index === earthLikeIndex;
    const profile = pickPlanetProfile(index, isEarthLike);
    const { map, bumpMap } = createPlanetMaps(profile);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(orbitRadius, 0.09 * scale, 6, 72),
      new THREE.MeshBasicMaterial({
        color: 0x5670b4,
        transparent: true,
        opacity: 0.18,
      })
    );
    orbit.rotation.x = Math.PI / 2;
    system.add(orbit);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(scale * (1.5 + index * 0.35), 24, 24),
      new THREE.MeshStandardMaterial({
        color,
        map,
        bumpMap,
        bumpScale: profile.bumpScale,
        emissive: profile.emissive,
        emissiveIntensity: 0.14,
        metalness: profile.metalness,
        roughness: profile.roughness,
      })
    );
    planet.position.x = orbitRadius;
    pivot.add(planet);
    pivot.userData.orbitRadius = orbitRadius;
    pivot.userData.index = index;
    if (index === earthLikeIndex) {
      pivot.userData.isEarthLike = true;
      planet.userData.label = "Earth";
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(scale * (1.68 + index * 0.35), 18, 18),
      new THREE.MeshBasicMaterial({
        color: isEarthLike ? 0x6cc8ff : color,
        transparent: true,
        opacity: isEarthLike ? 0.2 : 0.12,
        side: THREE.BackSide,
      })
    );
    planet.add(atmosphere);

    if (isEarthLike) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(scale * (1.58 + index * 0.35), 18, 18),
        new THREE.MeshStandardMaterial({
          map: createCloudTexture(),
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        })
      );
      planet.add(clouds);
      pivot.userData.clouds = clouds;
    }

    if (index === 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(scale * 3.4, scale * 0.24, 8, 52),
        new THREE.MeshStandardMaterial({
          color: 0xe5dbb0,
          transparent: true,
          opacity: 0.58,
          roughness: 0.86,
          metalness: 0.04,
        })
      );
      ring.rotation.x = 1.25;
      planet.add(ring);
      pivot.userData.ring = ring;
    }

    if (index === 2) {
      const moonPivot = new THREE.Group();
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(scale * 0.42, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xd9e0f2,
          roughness: 1,
        })
      );
      moon.position.set(scale * 4.4, 0, 0);
      moonPivot.add(moon);
      planet.add(moonPivot);
      pivot.userData.moonPivot = moonPivot;
    }

    system.add(pivot);
    planetPivots.push({
      pivot,
      speed: 0.08 + index * 0.03,
      planet,
      spin: 0.4 + index * 0.12,
    });
  });

  return { system, planetPivots, star };
}

const systems = [
  createSolarSystem({
    position: new THREE.Vector3(0, 0, 0),
    starColor: 0xffe29a,
    planetColors: [0xc79a62, 0xd9c38b, 0x4d8cff, 0xc95e40, 0xdfb167],
    orbitBase: 22,
    scale: 1.5,
    name: "Solar System",
    earthLikeIndex: 2,
  }),
  createSolarSystem({
    position: new THREE.Vector3(-250, 60, -420),
    starColor: 0xff8da1,
    planetColors: [0x7db0ff, 0xa687ff, 0xf9a84f, 0x9effca, 0xff93b7],
    orbitBase: 20,
    scale: 1.2,
    name: "Crimson System",
  }),
  createSolarSystem({
    position: new THREE.Vector3(310, -90, -650),
    starColor: 0x8dc7ff,
    planetColors: [0xffd66b, 0x6fe9ff, 0xff82b2, 0x9ec5ff],
    orbitBase: 15,
    scale: 1.1,
    name: "Helios Drift",
  }),
  createSolarSystem({
    position: new THREE.Vector3(-560, -140, -920),
    starColor: 0xb7b2ff,
    planetColors: [0x84d7ff, 0xc8a7ff, 0xffbf6f, 0x79f0bc, 0xff8f8f],
    orbitBase: 18,
    scale: 1.05,
    name: "Saraswati Veil",
  }),
  createSolarSystem({
    position: new THREE.Vector3(690, 120, -1120),
    starColor: 0xffc98d,
    planetColors: [0x7fb8ff, 0xd9e087, 0xff9d7f, 0x9f8cff, 0x80ffd7, 0xffd76e],
    orbitBase: 17,
    scale: 1,
    name: "Indus Crown",
  }),
  createSolarSystem({
    position: new THREE.Vector3(120, 260, -1380),
    starColor: 0x9cd5ff,
    planetColors: [0xffdc7a, 0x84ffe1, 0xaf97ff, 0xff8ab3],
    orbitBase: 16,
    scale: 0.95,
    name: "Aravalli Expanse",
  }),
];

systems.forEach(({ system }) => scene.add(system));

const homeSystem = systems[0];
const earthPivot = homeSystem.planetPivots.find((entry) => entry.pivot.userData.isEarthLike);
if (earthPivot) {
  earthPivot.pivot.rotation.y = 1.15;
}

const nebulae = new THREE.Group();
scene.add(nebulae);

for (let i = 0; i < nebulaCount; i += 1) {
  const spriteMaterial = new THREE.SpriteMaterial({
    map: nebulaTexture,
    color: new THREE.Color().setHSL(0.58 + Math.random() * 0.18, 0.65, 0.62),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.2,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(
    THREE.MathUtils.randFloatSpread(1600),
    THREE.MathUtils.randFloatSpread(520),
    -350 - Math.random() * 1200
  );
  const scale = 180 + Math.random() * 260;
  sprite.scale.set(scale, scale * 0.58, 1);
  nebulae.add(sprite);
}

const keys = new Set();
let isThirdPerson = true;
const velocity = new THREE.Vector3(0, 0, 0);
const forward = new THREE.Vector3();
const side = new THREE.Vector3();
const up = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const shipEuler = new THREE.Euler(0, 0, 0, "YXZ");

function setCameraMode(nextThirdPerson) {
  isThirdPerson = nextThirdPerson;
  controls.enabled = !isThirdPerson;
  cameraValue.textContent = isThirdPerson ? "Third Person" : "Free Camera";
  if (cameraToggleButton) {
    cameraToggleButton.textContent = isThirdPerson ? "Camera: Chase" : "Camera: Free";
  }
}

if (earthPivot) {
  const earthWorldPosition = new THREE.Vector3();
  earthPivot.planet.getWorldPosition(earthWorldPosition);
  ship.position.copy(earthWorldPosition).add(new THREE.Vector3(18, 8, 14));
} else {
  ship.position.set(24, 10, 82);
}
controls.target.copy(ship.position);

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyC" && !event.repeat) {
    setCameraMode(!isThirdPerson);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
});

function activateTouchKey(event) {
  const button = event.currentTarget;
  keys.add(button.dataset.key);
  button.classList.add("is-active");
  event.preventDefault();
}

function deactivateTouchKey(event) {
  const button = event.currentTarget;
  keys.delete(button.dataset.key);
  button.classList.remove("is-active");
  event.preventDefault();
}

touchButtons.forEach((button) => {
  button.addEventListener("pointerdown", activateTouchKey);
  button.addEventListener("pointerup", deactivateTouchKey);
  button.addEventListener("pointercancel", deactivateTouchKey);
  button.addEventListener("pointerleave", (event) => {
    if (event.buttons === 0) {
      deactivateTouchKey(event);
    }
  });
});

if (cameraToggleButton) {
  cameraToggleButton.addEventListener("click", () => {
    setCameraMode(!isThirdPerson);
  });
}

setCameraMode(true);

function updateSector() {
  const { x, y, z } = ship.position;
  const sunDistance = ship.position.distanceTo(homeSystem.system.position);

  if (sunDistance < 120) {
    sectorValue.textContent = "Solar System";
    return;
  }

  if (z > -80) {
    sectorValue.textContent = "Orion Reach";
    return;
  }

  if (x < -120 && z < -250) {
    sectorValue.textContent = "Crimson Verge";
    return;
  }

  if (x > 180 && z < -500) {
    sectorValue.textContent = "Helios Drift";
    return;
  }

  if (y < -50) {
    sectorValue.textContent = "Umbra Shelf";
    return;
  }

  sectorValue.textContent = "Perseus Crossing";
}

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.032);
  const elapsed = clock.elapsedTime;
  const turnLeft = keys.has("KeyA") || keys.has("ArrowLeft");
  const turnRight = keys.has("KeyD") || keys.has("ArrowRight");
  const thrustForward = keys.has("KeyW") || keys.has("ArrowUp");
  const thrustBackward = keys.has("KeyS") || keys.has("ArrowDown");

  if (turnLeft) shipEuler.y += 1.15 * delta;
  if (turnRight) shipEuler.y -= 1.15 * delta;
  if (keys.has("KeyQ")) shipEuler.z += 1.55 * delta;
  if (keys.has("KeyE")) shipEuler.z -= 1.55 * delta;

  shipEuler.x = THREE.MathUtils.lerp(shipEuler.x, 0, delta * 1.5);
  ship.quaternion.setFromEuler(shipEuler);

  forward.set(1, 0, 0).applyQuaternion(ship.quaternion).normalize();
  side.set(0, 0, 1).applyQuaternion(ship.quaternion).normalize();
  up.set(0, 1, 0).applyQuaternion(ship.quaternion).normalize();

  if (thrustForward) {
    velocity.addScaledVector(forward, 110 * delta);
  }
  if (thrustBackward) {
    velocity.addScaledVector(forward, -60 * delta);
  }
  if (keys.has("KeyR")) {
    velocity.addScaledVector(up, 42 * delta);
  }
  if (keys.has("KeyF")) {
    velocity.addScaledVector(up, -42 * delta);
  }

  velocity.multiplyScalar(1 - delta * 0.22);
  velocity.clampLength(0, 260);
  ship.position.addScaledVector(velocity, delta);

  const bankTarget = (turnLeft ? 0.4 : 0) - (turnRight ? 0.4 : 0);
  shipBody.rotation.z = THREE.MathUtils.lerp(
    shipBody.rotation.z,
    bankTarget,
    delta * 2.8
  );

  engineGlow.scale.y = 1 + velocity.length() * 0.018 + Math.sin(elapsed * 18) * 0.08;
  engineGlow.material.emissiveIntensity = 1.4 + velocity.length() * 0.03;
  engineHalo.scale.set(
    3.8 + velocity.length() * 0.045,
    2.1 + velocity.length() * 0.018,
    1
  );
  engineHalo.material.opacity = 0.75 + velocity.length() * 0.003;

  stars.rotation.y += delta * 0.006;
  milkyWay.rotation.z += delta * 0.01;
  nebulae.rotation.y -= delta * 0.008;

  systems.forEach(({ planetPivots, star }, index) => {
    star.scale.setScalar(1 + Math.sin(elapsed * (0.9 + index * 0.2)) * 0.04);

    planetPivots.forEach(({ pivot, planet, speed, spin }) => {
      pivot.rotation.y += delta * speed;
      planet.rotation.y += delta * spin;
      if (pivot.userData.clouds) {
        pivot.userData.clouds.rotation.y += delta * 0.18;
      }
      if (pivot.userData.ring) {
        pivot.userData.ring.rotation.z = Math.sin(elapsed * 0.3) * 0.08;
      }
      if (pivot.userData.moonPivot) {
        pivot.userData.moonPivot.rotation.y += delta * 1.6;
      }
    });
  });

  if (isThirdPerson) {
    desiredCameraPosition
      .copy(ship.position)
      .addScaledVector(forward, -18)
      .addScaledVector(up, 7);
    camera.position.lerp(desiredCameraPosition, 1 - Math.pow(0.004, delta));

    desiredLookAt.copy(ship.position).addScaledVector(forward, 28);
    camera.lookAt(desiredLookAt);
  } else {
    controls.target.lerp(ship.position, 1 - Math.pow(0.002, delta));
    controls.update();
  }

  speedValue.textContent = velocity.length().toFixed(1);
  updateSector();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
