// Converted to p5 instance mode for embedding in the assignment website.
// Container: #p5-fan-cat-canvas

var fanCatSketch = function(p) {
  // Pixel Fan Cat
  // Hold mouse to turn on the fan.
  // Release mouse to stop.

  let fanSpeed = 0;
  let bladeAngle = 0;

  let windPower = 0;
  let catFly = 0;

  let sweatDrops = [];
  let windLines = [];

  p.setup = function() {
    let canvas = p.createCanvas(760, 460);
    canvas.parent("p5-fan-cat-canvas");
    p.pixelDensity(2);
    p.noSmooth();

    for (let i = 0; i < 6; i++) {
      sweatDrops.push({
        x: p.random(505, 595),
        y: p.random(190, 245),
        s: p.random(3, 5),
        spd: p.random(0.45, 0.9)
      });
    }

    for (let i = 0; i < 28; i++) {
      windLines.push({
        x: p.random(220, 560),
        y: p.random(170, 300),
        len: p.random(18, 55),
        spd: p.random(2, 6)
      });
    }
  };

  p.draw = function() {
    p.background(246, 244, 235);
    drawPixelGrid();

    let isOn = p.mouseIsPressed;

    let targetFanSpeed = isOn ? 0.36 : 0;
    fanSpeed = p.lerp(fanSpeed, targetFanSpeed, 0.08);
    bladeAngle += fanSpeed;

    let targetWind = isOn ? 1 : 0;
    windPower = p.lerp(windPower, targetWind, 0.08);

    let targetCatFly = isOn ? 1 : 0;
    catFly = p.lerp(catFly, targetCatFly, 0.07);

    drawTitle(isOn);
    drawInstructionArrow();

    drawFan(190, 255, isOn);
    drawWind();

    drawCat(535, 255, catFly, isOn);
    drawSweat(isOn);

    drawStatusText(isOn);
  };

  function drawPixelGrid() {
    p.push();
    p.stroke(215, 211, 200, 70);
    p.strokeWeight(1);

    let grid = 22;

    for (let x = 0; x <= p.width; x += grid) {
      p.line(x, 0, x, p.height);
    }

    for (let y = 0; y <= p.height; y += grid) {
      p.line(0, y, p.width, y);
    }

    p.pop();
  }

  function drawTitle(isOn) {
    p.push();

    p.textFont("monospace");
    p.textSize(16);
    p.noStroke();

    p.fill(30);
    p.text(" ", 28, 34);

    p.fill(isOn ? p.color(255, 80, 120) : p.color(90));
    p.text(isOn ? "fan mode: ON" : "fan mode: OFF", 28, 58);

    p.pop();
  }

  function drawInstructionArrow() {
    p.push();

    p.textFont("monospace");
    p.textSize(18);
    p.fill(20);
    p.noStroke();

    p.text("CLICK + HOLD", 120, 88);

    p.stroke(20);
    p.strokeWeight(4);
    p.noFill();

    p.line(175, 100, 175, 130);
    p.line(175, 130, 160, 116);
    p.line(175, 130, 190, 116);

    p.pop();
  }

  function drawStatusText(isOn) {
    p.push();

    p.textFont("monospace");
    p.textSize(13);
    p.noStroke();

    if (isOn) {
      p.fill(255, 80, 120);
      p.text("WIND!!! CAT LAUNCHING...", 28, p.height - 28);
    } else {
      p.fill(90);
      p.text("hold mouse to power the tiny fan", 28, p.height - 28);
    }

    p.pop();
  }

  function drawFan(x, y, isOn) {
    p.push();
    p.translate(x, y);

    p.stroke(20);
    p.strokeWeight(6);
    p.line(0, 56, 0, 108);
    p.line(-36, 112, 36, 112);

    p.fill(238);
    p.stroke(20);
    p.strokeWeight(5);
    p.ellipse(0, 0, 112, 112);

    p.stroke(40, 40, 40, 90);
    p.strokeWeight(2);
    p.noFill();

    for (let r = 28; r <= 52; r += 12) {
      p.ellipse(0, 0, r * 2, r * 2);
    }

    for (let a = 0; a < p.TWO_PI; a += p.PI / 6) {
      p.line(0, 0, p.cos(a) * 54, p.sin(a) * 54);
    }

    p.push();
    p.rotate(bladeAngle);

    p.noStroke();

    let bladeColor = isOn ? p.color(120, 190, 255) : p.color(80, 120, 160);
    p.fill(bladeColor);

    for (let i = 0; i < 4; i++) {
      p.rotate(p.HALF_PI);

      p.beginShape();
      p.vertex(0, -8);
      p.vertex(45, -18);
      p.vertex(52, -2);
      p.vertex(22, 14);
      p.vertex(0, 8);
      p.endShape(p.CLOSE);
    }

    p.pop();

    p.fill(isOn ? p.color(255, 90, 150) : p.color(50));
    p.stroke(20);
    p.strokeWeight(3);
    p.ellipse(0, 0, 22, 22);

    p.pop();
  }

  function drawWind() {
    p.push();

    if (windPower < 0.03) {
      p.pop();
      return;
    }

    p.stroke(80, 150, 255, 120 * windPower);
    p.strokeWeight(2);
    p.noFill();

    for (let lineObj of windLines) {
      lineObj.x += lineObj.spd * windPower;

      if (lineObj.x > 620) {
        lineObj.x = 235;
        lineObj.y = p.random(165, 310);
        lineObj.len = p.random(18, 55);
      }

      let wave = p.sin(p.frameCount * 0.12 + lineObj.y * 0.05) * 6;

      p.line(
        lineObj.x,
        lineObj.y + wave,
        lineObj.x + lineObj.len,
        lineObj.y + wave + p.random(-1, 1)
      );
    }

    p.pop();
  }

  function drawCat(baseX, baseY, flyAmount, isOn) {
    p.push();

    let flyX = flyAmount * 78;
    let flyY = flyAmount * -18 + p.sin(p.frameCount * 0.25) * flyAmount * 6;
    let tilt = flyAmount * 0.28;

    p.translate(baseX + flyX, baseY + flyY);
    p.rotate(tilt);

    if (isOn) {
      drawCatTrail(-40, 26);
    }

    p.stroke(20);
    p.strokeWeight(5);
    p.fill(255, 205, 160);

    p.beginShape();
    p.vertex(-50, 8);
    p.vertex(-42, -32);
    p.vertex(-18, -50);
    p.vertex(-7, -28);
    p.vertex(18, -30);
    p.vertex(34, -52);
    p.vertex(45, -22);
    p.vertex(54, 8);
    p.vertex(42, 36);
    p.vertex(10, 48);
    p.vertex(-24, 45);
    p.vertex(-48, 28);
    p.endShape(p.CLOSE);

    p.noStroke();
    p.fill(255, 145, 155);
    p.triangle(-33, -27, -18, -39, -14, -22);
    p.triangle(28, -27, 36, -40, 39, -20);

    p.fill(20);
    p.ellipse(-18, 0, 7, 11);
    p.ellipse(20, 0, 7, 11);

    p.noFill();
    p.stroke(20);
    p.strokeWeight(3);
    p.arc(2, 18, 24, 14, p.PI, p.TWO_PI);

    p.strokeWeight(2);
    p.line(-22, 15, -48, 10);
    p.line(-22, 22, -50, 24);
    p.line(22, 15, 48, 10);
    p.line(22, 22, 50, 24);

    p.stroke(20);
    p.strokeWeight(5);
    p.noFill();

    if (isOn) {
      p.line(-45, 28, -80, 38);
      p.line(-80, 38, -92, 30);
    } else {
      p.line(-45, 28, -65, 40);
      p.line(-65, 40, -72, 36);
    }

    p.pop();
  }

  function drawCatTrail(x, y) {
    p.push();

    p.noStroke();
    p.fill(60, 130, 255, 55);

    for (let i = 0; i < 4; i++) {
      p.ellipse(x - i * 18, y + i * 3, 16 - i * 2, 8);
    }

    p.pop();
  }

  function drawSweat(isOn) {
    if (isOn) return;

    p.push();

    p.noStroke();
    p.fill(80, 150, 255, 180);

    for (let d of sweatDrops) {
      d.y += d.spd;

      if (d.y > 275) {
        d.y = p.random(190, 230);
        d.x = p.random(505, 595);
      }

      p.rect(d.x, d.y, d.s, d.s * 1.6);
      p.rect(d.x + d.s * 0.3, d.y + d.s * 1.1, d.s * 0.5, d.s * 0.5);
    }

    p.pop();
  }
};

new p5(fanCatSketch);
