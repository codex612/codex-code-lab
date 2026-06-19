// Roblox Workspace 2D Canvas Simulator
// Renders physical blocks in an isometric 3D-shaded style on a 2D Canvas.

class RobloxSimulator {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.parts = [];
    this.gravity = 0.5;
    this.scale = 8; // Pixels per Roblox stud
    this.isAnimating = false;
    
    // Bind resize
    window.addEventListener('resize', () => this.resizeCanvas());
    this.reset();
    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 400;
    this.canvas.height = rect.height || 250;
    this.draw();
  }

  reset() {
    this.parts = [];
    // Always start with a Baseplate
    this.baseplate = {
      id: "baseplate",
      name: "Baseplate",
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: 50, y: 1, z: 50 },
      color: "#2c3e50", // Dark slate
      anchored: true,
      transparency: 0,
      shape: "Block"
    };
    this.draw();
  }

  addPart(part) {
    const defaultPart = {
      id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: "Part",
      position: { x: 0, y: 5, z: 0 },
      size: { x: 4, y: 4, z: 4 },
      color: "#ffffff",
      brickColor: "Medium stone grey",
      transparency: 0,
      anchored: false,
      shape: "Block",
      velocity: { x: 0, y: 0, z: 0 }
    };
    const newPart = { ...defaultPart, ...part };
    this.parts.push(newPart);
    this.draw();
    return newPart;
  }

  updatePartProperty(partIndex, prop, value) {
    if (this.parts[partIndex]) {
      if (prop === 'position' || prop === 'size') {
        this.parts[partIndex][prop] = { ...this.parts[partIndex][prop], ...value };
      } else {
        this.parts[partIndex][prop] = value;
      }
      this.draw();
    }
  }

  startPhysics() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const loop = () => {
      if (!this.isAnimating) return;
      this.updatePhysics();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stopPhysics() {
    this.isAnimating = false;
  }

  updatePhysics() {
    // Basic gravity step for non-anchored parts
    const dt = 0.1;
    this.parts.forEach(part => {
      if (part.anchored) return;
      
      // Apply gravity
      part.velocity.y -= this.gravity * dt;
      part.position.y += part.velocity.y;

      // Check collision with baseplate (y = 0 is the surface of the baseplate)
      const halfHeight = part.size.y / 2;
      const baseplateTop = 0; // Baseplate top is at y = 0
      
      if (part.position.y - halfHeight <= baseplateTop) {
        // Collide!
        part.position.y = baseplateTop + halfHeight;
        
        // Bounce slightly if velocity is high
        if (Math.abs(part.velocity.y) > 0.5) {
          part.velocity.y = -part.velocity.y * 0.3; // 30% bounce
        } else {
          part.velocity.y = 0;
        }
      }
    });
  }

  // Converts 3D space to 2D Screen Space
  isoProjection(x, y, z) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2 + 40; // Offset down
    
    // Isometric angles
    const angleX = Math.PI / 6; // 30 degrees
    const angleZ = Math.PI / 6;
    
    const screenX = centerX + (x - z) * Math.cos(angleX) * this.scale;
    const screenY = centerY + (x + z) * Math.sin(angleZ) * this.scale - y * this.scale;
    
    return { x: screenX, y: screenY };
  }

  // Draw a 3D isometric block
  drawBlock(position, size, colorHex, transparency) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1 - transparency;

    const { x, y, z } = position;
    const dx = size.x / 2;
    const dy = size.y / 2;
    const dz = size.z / 2;

    // 8 Vertices of the box
    const vertices = {
      bbl: this.isoProjection(x - dx, y - dy, z - dz), // back-bottom-left
      bbr: this.isoProjection(x + dx, y - dy, z - dz), // back-bottom-right
      fbl: this.isoProjection(x - dx, y - dy, z + dz), // front-bottom-left
      fbr: this.isoProjection(x + dx, y - dy, z + dz), // front-bottom-right
      btl: this.isoProjection(x - dx, y + dy, z - dz), // back-top-left
      btr: this.isoProjection(x + dx, y + dy, z - dz), // back-top-right
      ftl: this.isoProjection(x - dx, y + dy, z + dz), // front-top-left
      ftr: this.isoProjection(x + dx, y + dy, z + dz)  // front-top-right
    };

    // Parse colors for lighting
    const baseColor = colorHex || "#ffffff";
    ctx.lineJoin = "round";

    // Draw faces in order of back-to-front sorting (Top, then Left/Right depending on angle)
    // 1. Top face (Lightest, overhead sun)
    ctx.fillStyle = this.adjustColorBrightness(baseColor, 15);
    ctx.strokeStyle = this.adjustColorBrightness(baseColor, -10);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vertices.btl.x, vertices.btl.y);
    ctx.lineTo(vertices.btr.x, vertices.btr.y);
    ctx.lineTo(vertices.ftr.x, vertices.ftr.y);
    ctx.lineTo(vertices.ftl.x, vertices.ftl.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Left face (Medium shade)
    ctx.fillStyle = this.adjustColorBrightness(baseColor, -15);
    ctx.strokeStyle = this.adjustColorBrightness(baseColor, -30);
    ctx.beginPath();
    ctx.moveTo(vertices.ftl.x, vertices.ftl.y);
    ctx.lineTo(vertices.ftr.x, vertices.ftr.y);
    ctx.lineTo(vertices.fbr.x, vertices.fbr.y);
    ctx.lineTo(vertices.fbl.x, vertices.fbl.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Right face (Darkest shade)
    ctx.fillStyle = this.adjustColorBrightness(baseColor, -30);
    ctx.strokeStyle = this.adjustColorBrightness(baseColor, -45);
    ctx.beginPath();
    ctx.moveTo(vertices.ftr.x, vertices.ftr.y);
    ctx.lineTo(vertices.btr.x, vertices.btr.y);
    ctx.lineTo(vertices.bbr.x, vertices.bbr.y);
    ctx.lineTo(vertices.fbr.x, vertices.fbr.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Draw grid lines on top of baseplate
  drawBaseplateGrid() {
    const ctx = this.ctx;
    const bp = this.baseplate;
    const dy = bp.size.y / 2;
    const gridY = bp.position.y + dy;
    const halfX = bp.size.x / 2;
    const halfZ = bp.size.z / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Draw lines along X axis
    for (let z = -halfZ; z <= halfZ; z += 5) {
      const start = this.isoProjection(-halfX, gridY, z);
      const end = this.isoProjection(halfX, gridY, z);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Draw lines along Z axis
    for (let x = -halfX; x <= halfX; x += 5) {
      const start = this.isoProjection(x, gridY, -halfZ);
      const end = this.isoProjection(x, gridY, halfZ);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }

  draw() {
    if (!this.canvas) return;
    const ctx = this.ctx;
    // Clear canvas
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Baseplate
    this.drawBlock(this.baseplate.position, this.baseplate.size, this.baseplate.color, 0);
    this.drawBaseplateGrid();

    // Sort parts from back-to-front to handle proper isometric rendering overlap
    // Render parts with larger Z and smaller X first
    const sortedParts = [...this.parts].sort((a, b) => {
      // Depth sorting formula: sort by back-to-front (smaller sum of x+z is back)
      return (a.position.x + a.position.z) - (b.position.x + b.position.z);
    });

    // Draw all user parts
    sortedParts.forEach(part => {
      this.drawBlock(part.position, part.size, part.color, part.transparency);
    });
  }

  // Utility to lighten/darken colors
  adjustColorBrightness(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) {
      hex = hex.replace(/(.)/g, '$1$1');
    }
    
    // Named color mapping fallbacks
    const colorMap = {
      "red": "ff0000", "green": "00ff00", "blue": "0000ff", "white": "ffffff", "black": "000000",
      "bright red": "ff0000", "bright blue": "00a2ff", "bright yellow": "ffeb3b", "bright green": "4caf50",
      "dark stone grey": "636e72", "medium stone grey": "b2bec3"
    };

    const lowercaseHex = hex.toLowerCase();
    if (colorMap[lowercaseHex]) {
      hex = colorMap[lowercaseHex];
    } else if (!/^[0-9a-f]{6}$/i.test(hex)) {
      // Default to neutral gray if color is invalid
      hex = "b2bec3";
    }

    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);

    r = Math.min(255, Math.max(0, r + percent));
    g = Math.min(255, Math.max(0, g + percent));
    b = Math.min(255, Math.max(0, b + percent));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

// Bind to window
window.RobloxSimulator = RobloxSimulator;
