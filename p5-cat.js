// p5-cat.js
// Instance mode version
// Container: #p5-cat-canvas
// Image file: cat.png

var peekabooSketch = function(p) {
  let catImg;

  let glass = {
    x: 230,
    y: 130,
    w: 300,
    h: 200
  };

  let catY;
  let catW;
  let catH;

  // Cat size / stretch
  let catScaleW = 0.075;
  let catScaleH = 0.09;

  // Pixel effect
  let pixelSize = 14;
  let blockSize = 14;

  // Offscreen graphics, created once
  let low;
  let catLayer;

  // Motion path
  let path = [];
  let segmentIndex = 0;
  let segmentStartFrame = 0;

  p.preload = function() {
    catImg = p.loadImage("cat.png");
  };

  p.setup = function() {
    let canvas = p.createCanvas(760, 460);
    canvas.parent("p5-cat-canvas");

    // Use 1 for better speed inside webpage.
    // Change to 2 if you want sharper retina rendering.
    p.pixelDensity(1);

    p.imageMode(p.CENTER);

    catW = catImg.width * catScaleW;
    catH = catImg.height * catScaleH;

    catY = glass.y + glass.h / 2;

    low = p.createGraphics(
      p.max(1, p.floor(catW / pixelSize)),
      p.max(1, p.floor(catH / pixelSize))
    );

    catLayer = p.createGraphics(p.width, p.height);

    let centerX = glass.x + glass.w / 2;
    let leftX = glass.x - catW * 0.25;
    let rightX = glass.x + glass.w + catW * 0.25;

    path = [
      { from: centerX, to: centerX, duration: 35 },
      { from: centerX, to: leftX, duration: 115 },
      { from: leftX, to: centerX, duration: 105 },
      { from: centerX, to: rightX, duration: 125 },
      { from: rightX, to: centerX, duration: 110 }
    ];

    segmentIndex = 0;
    segmentStartFrame = p.frameCount;
  };

  p.draw = function() {
    p.background(247, 247, 247);
    drawGridBackground();

    let catX = getCatX();

    drawClearCat(catX, catY, catW, catH);
    drawPixelGlassCatInsideFrame(catX, catY, catW, catH);
    drawFigmaSelectionBox();
    drawPeekabooText(catX);
    drawLabel();
  };

  function getCatX() {
    let seg = path[segmentIndex];
    let t = (p.frameCount - segmentStartFrame) / seg.duration;

    if (t >= 1) {
      segmentIndex = (segmentIndex + 1) % path.length;
      segmentStartFrame = p.frameCount;
      seg = path[segmentIndex];
      t = 0;
    }

    let easedT = easeInOutCubic(t);
    return p.lerp(seg.from, seg.to, easedT);
  }

  function drawClearCat(x, y, w, h) {
    p.push();

    p.tint(255, 250);
    p.image(catImg, x, y, w, h);
    p.noTint();

    p.pop();
  }

  function drawPixelGlassCatInsideFrame(x, y, w, h) {
    p.push();

    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.rect(glass.x, glass.y, glass.w, glass.h);
    p.drawingContext.clip();

    p.noStroke();
    p.fill(247, 247, 247, 176);
    p.rect(glass.x, glass.y, glass.w, glass.h);

    // Low-res pixelated source.
    low.clear();
    low.image(catImg, 0, 0, low.width, low.height);

    // Reuse full-size pixel cat layer.
    catLayer.clear();
    catLayer.imageMode(p.CENTER);
    catLayer.noSmooth();
    catLayer.tint(255, 235);
    catLayer.image(low, x, y, w, h);
    catLayer.noTint();

    // This is the expensive part.
    // Lower number = faster / sharper. Higher number = blurrier / slower.
    catLayer.filter(p.BLUR, 0.8);

    p.imageMode(p.CORNER);
    p.noSmooth();
    p.tint(255, 235);

    p.image(
      catLayer,
      glass.x,
      glass.y,
      glass.w,
      glass.h,
      glass.x,
      glass.y,
      glass.w,
      glass.h
    );

    p.noTint();
    p.smooth();

    drawPixelGridTexture();
    drawGlassGloss();

    p.drawingContext.restore();

    p.imageMode(p.CENTER);
    p.pop();
  }

  function drawPixelGridTexture() {
    p.push();

    let block = blockSize;

    p.stroke(255, 255, 255, 28);
    p.strokeWeight(0.45);

    for (let x = glass.x; x <= glass.x + glass.w; x += block) {
      p.line(x, glass.y, x, glass.y + glass.h);
    }

    for (let y = glass.y; y <= glass.y + glass.h; y += block) {
      p.line(glass.x, y, glass.x + glass.w, y);
    }

    // Subtle broken scan marks.
    // This random each frame gives texture, but keep count low.
    p.stroke(30, 30, 30, 12);
    p.strokeWeight(0.55);

    for (let i = 0; i < 8; i++) {
      let yy = p.random(glass.y, glass.y + glass.h);
      let x1 = p.random(glass.x, glass.x + glass.w * 0.75);
      let x2 = x1 + p.random(12, 40);
      p.line(x1, yy, x2, yy + p.random(-1, 1));
    }

    p.pop();
  }

  function drawGlassGloss() {
    p.push();

    p.noStroke();

    for (let i = 0; i < 20; i++) {
      let alpha = p.map(i, 0, 19, 13, 0);
      p.fill(255, 255, 255, alpha);
      let x = glass.x + i * 16;

      p.quad(
        x,
        glass.y,
        x + 42,
        glass.y,
        x - 28,
        glass.y + glass.h,
        x - 70,
        glass.y + glass.h
      );
    }

    p.fill(255, 255, 255, 10);
    p.rect(glass.x, glass.y, glass.w, glass.h);

    p.pop();
  }

  function drawFigmaSelectionBox() {
    p.push();

    let blue = p.color(24, 145, 255);

    p.noFill();
    p.stroke(blue);
    p.strokeWeight(1.4);
    p.rect(glass.x, glass.y, glass.w, glass.h);

    let s = 12;
    drawHandle(glass.x, glass.y, s, blue);
    drawHandle(glass.x + glass.w, glass.y, s, blue);
    drawHandle(glass.x, glass.y + glass.h, s, blue);
    drawHandle(glass.x + glass.w, glass.y + glass.h, s, blue);

    p.pop();
  }

  function drawHandle(x, y, s, blue) {
    p.push();

    p.rectMode(p.CENTER);
    p.fill(255);
    p.stroke(blue);
    p.strokeWeight(1.6);
    p.rect(x, y, s, s);

    p.pop();
  }

  function drawPeekabooText(catX) {
    p.push();

    let pink = p.color(255, 90, 190);

    p.textFont("Courier New");
    p.textStyle(p.BOLD);
    p.textSize(20);
    p.noStroke();
    p.fill(pink);

    let wobble = p.sin(p.frameCount * 0.12) * 3;

    // Cat comes out from the left side.
    if (catX < glass.x - catW * 0.05) {
      p.text("peeka!", glass.x - 130, glass.y + 65 + wobble);
    }

    // Cat comes out from the right side.
    if (catX > glass.x + glass.w + catW * 0.05) {
      p.text("boo!", glass.x + glass.w + 32, glass.y + glass.h - 35 + wobble);
    }

    p.pop();
  }

  function drawGridBackground() {
    p.push();

    let gridSize = 48;

    p.stroke(215, 215, 215, 85);
    p.strokeWeight(0.55);

    for (let x = 0; x <= p.width; x += gridSize) {
      p.line(x, 0, x, p.height);
    }

    for (let y = 0; y <= p.height; y += gridSize) {
      p.line(0, y, p.width, y);
    }

    p.stroke(228, 228, 228, 50);
    p.strokeWeight(0.35);

    for (let x = gridSize / 2; x <= p.width; x += gridSize) {
      p.line(x, 0, x, p.height);
    }

    for (let y = gridSize / 2; y <= p.height; y += gridSize) {
      p.line(0, y, p.width, y);
    }

    p.pop();
  }

  function drawLabel() {
    p.push();

    p.fill(120, 120, 120, 145);
    p.noStroke();
    p.textFont("monospace");
    p.textSize(12);

    p.text(
      "FROSTED CAT FIELD / selected object with pixel-glass visibility",
      28,
      p.height - 28
    );

    p.pop();
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - p.pow(-2 * t + 2, 3) / 2;
  }
};

new p5(peekabooSketch);