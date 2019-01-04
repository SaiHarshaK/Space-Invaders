// make connection
var socket = io.connect("http://localhost:4000"); // front end socket

var body = document.getElementById("body");
var canvas = document.getElementById("space");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");
const interval = 20; // fps ~ 60
var tmr; // for setInterval

background = {
  stars: [],
  createStars: function() {
    for (let i = 0; i < canvas.width; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random()
      });
    }
  },

  updateStars: function() {
    for (let i = 0; i < this.stars.length; i++) {
      this.stars[i].r = Math.random();
    }
  },

  draw: function() {
    ctx.fillStyle = "white";
    for (let i = 0; i < this.stars.length; i++) {
      let s = this.stars[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
};

spaceship = {
  x: canvas.width / 2 - 25,
  y: canvas.height - 150,
  width: 30,
  height: 46,
  left: false,
  right: false,
  speed: 3,
  lives: 3,
  img: undefined,
  score: 0,
  fire: new Audio("/assets/fire.mp3"),
  explode: new Audio("/assets/ship_explode.mp3"),

  setup: function() {
    this.img = new Image(this.width, this.height);
    this.img.src = "/assets/spaceship.png";
  },

  draw: function() {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  },

  update: function() {
    if (this.x > 0 && this.left) this.x -= this.speed;
    if (this.x + this.width < canvas.width && this.right) this.x += this.speed;
  }
};

enemies = {
  x: (13 * canvas.width) / 40 - 15,
  y: (5 * canvas.height) / 24 - 10, // x & y are the coords of left most point of enemies as a whole
  width: canvas.width / 20,
  height: canvas.height / 20,
  gap: 5,
  speed: 1,
  coords: [],

  spawn: function() {
    // 5x7 blocks for now
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 7; j++) {
        this.coords.push({
          x: this.x,
          y: this.y
        });
        this.x += this.width + this.gap;
      }
      this.x -= 7 * (this.width + this.gap);
      this.y += this.height + this.gap;
    }
    if (Math.random() < 0.5) this.speed = -this.speed;
  },

  draw: function() {
    ctx.fillStyle = "green";
    for (let i = 0; i < this.coords.length; i++) {
      const c = this.coords[i];
      ctx.fillRect(c.x, c.y, this.width, this.height);
    }
  },

  update: function() {
    for (let i = 0; i < this.coords.length; i++) {
      this.coords[i].x -= this.speed;
      if (this.coords[i].x < 0) {
        if (this.speed > 0) this.coords[i].x += this.speed;
        else this.coords[i].x -= this.speed;
        this.speed = -this.speed;
      } else if (this.coords[i].x + this.width > canvas.width) {
        if (this.speed > 0) this.coords[i].x -= this.speed;
        else this.coords[i].x += this.speed;
        this.speed = -this.speed;
      }
    }
  }
};

enemyCounter = {
  fireRate: 0.001,
  counterRocket: [],
  speed: 1,
  width: 7,
  height: 5,

  draw: function() {
    for (let i = 0; i < this.counterRocket.length; i++) {
      let cr = this.counterRocket[i];
      ctx.fillStyle = "blue";
      ctx.fillRect(cr.x, cr.y, this.width, this.height);
      // update the next position of the attack
      cr.y += this.speed;
      if (cr.y > canvas.height) this.counterRocket.splice(i--, 1);
    }
  },

  update: function() {
    const c = enemies.coords;
    // enemies shoot their own weapons
    for (let i = 0; i < c.length; i++) {
      if (Math.random() < this.fireRate) {
        this.counterRocket.push({
          x: c[i].x + enemies.width / 2,
          y: c[i].y + enemies.height
        });
      } else continue;
    }
  }
};

weapon = {
  // x: spaceship.x + spaceship.width / 2 - 1,
  // y: spaceship.y - 3,
  width: 4,
  height: 3,
  speed: 2,
  rocket: [],
  cooldown: 700,
  timeOfFire: null,

  shootMissile: function() {
    if (
      this.timeOfFire === null ||
      new Date().valueOf() - this.timeOfFire > this.cooldown
    ) {
      this.timeOfFire = new Date().valueOf();
      this.rocket.push({
        x: spaceship.x + spaceship.width / 2 - 1,
        y: spaceship.y - 3
      });
      if (!options.m) {
        spaceship.fire.currentTime = 0;
        spaceship.fire.play();
      }
    } else return;
  },

  draw: function() {
    for (let i = 0; i < this.rocket.length; i++) {
      let r = this.rocket[i];
      ctx.fillStyle = "red";
      ctx.fillRect(r.x, r.y, this.width, this.height);
    }
  },

  update: function() {
    for (let i = 0; i < this.rocket.length; i++) {
      let r = this.rocket[i];
      r.y -= this.speed;
      // check if rocket needs to be removed
      if (r.y < 0) {
        this.rocket.splice(i--, 1);
      }
    }
  }
};

checkCollision = {
  enemies: function() {
    let coods = enemies.coords;
    let rocket = weapon.rocket;
    const width = enemies.width;
    const height = enemies.height;
    for (let i = 0; i < coods.length; i++) {
      for (let k = 0; k < rocket.length; k++) {
        const r = rocket[k];
        const e = coods[i];
        if (this.check(r, e, width, height)) {
          // remove that enemy and rocket
          rocket.splice(k--, 1);
          coods.splice(i--, 1);
          spaceship.score += 50;
        }
      }
    }
  },

  spaceship: function() {
    let s = {};
    s.x = spaceship.x;
    s.y = spaceship.y;
    let rocket = enemyCounter.counterRocket;
    const hitboxSize = [];
    const hitbox = [];

    //4 hitbox
    hitbox.push(
      {
        x: s.x + 13,
        y: s.y
      },
      {
        x: s.x + 10,
        y: s.y + 14
      },
      {
        x: s.x,
        y: s.y + 29
      },
      {
        x: s.x + 10,
        y: s.y + 14
      }
    );
    hitboxSize.push(
      {
        w: 4, // width
        h: 14 // height
      },
      {
        w: 10,
        h: 15
      },
      {
        w: 30,
        h: 9
      },
      {
        w: 24,
        h: 6
      }
    );

    //check for hit
    loop1: for (let i = 0; i < rocket.length; i++) {
      const r = rocket[i];
      for (let j = 0; j < 4; j++) {
        if (this.check(r, hitbox[j], hitboxSize[j].w, hitboxSize[j].h)) {
          spaceship.lives--;
          if (!options.m) {
            spaceship.explode.currentTime = 0;
            spaceship.explode.play();
            if (spaceship.lives > 0) options.giveBreak();
          }
          rocket.splice(i, 1);
          break loop1;
        }
      }
    }
  },

  check: function(wpn, tgt, width, height) {
    if (
      ((wpn.x > tgt.x && wpn.x < tgt.x + width) ||
        (wpn.x + weapon.width > tgt.x &&
          wpn.x + weapon.width < tgt.x + width)) &&
      ((wpn.y > tgt.y && wpn.y < tgt.y + height) ||
        (wpn.y + weapon.height > tgt.y &&
          wpn.y + weapon.height < tgt.y + height))
    )
      return true;
    else return false;
  }
};

options = {
  m: false, // mute
  p: false, // pause
  i: false, // instructions
  gameTimeStart: undefined, // defined when game starts
  gameTimeEnd: undefined, // defined when game ends

  showLives: function() {
    ctx.font = "50px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "start";
    ctx.baseline = "top";
    ctx.fillText("Lives : ", 20, canvas.height - 15);
    let x = 150,
      y = canvas.height - 42;
    let img = spaceship.img;
    for (let i = 0; i < spaceship.lives; i++) {
      x += 40;
      ctx.drawImage(img, x, y, 20, 30);
    }
  },

  score: function() {
    ctx.font = "50px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "start";
    ctx.baseline = "top";
    ctx.fillText("Score:", canvas.width - 300, canvas.height - 15);
    ctx.font = "40px Impact";
    ctx.fillText(spaceship.score, canvas.width - 140, canvas.height - 15);
  },

  help: function() {
    ctx.font = "20px Impact";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.baseline = "top";
    ctx.fillText(
      "Toggle: Pause (p) | Mute (m) | Instructions (i)",
      canvas.width / 2,
      canvas.height - 15
    );
  },

  pause: function() {
    if (this.i) return; // pause by i, unpause only by i
    this.p = !this.p;
    if (this.p) clearInterval(tmr);
    else tmr = setInterval(update, interval);
  },

  instructions: function() {
    if (this.p) return; // pause by p, unpause only with p
    if (this.i) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      background.updateStars();
      background.draw();
      countdown.heading();
      //instructions
      ctx.font = "15px Impact";
      ctx.fillStyle = "green";
      ctx.textAlign = "center";
      ctx.fillText(
        "Use arrow keys to move left or right to dodge incoming attacks.",
        canvas.width / 2,
        canvas.height / 2 + 50
      );
      ctx.fillText(
        "Press Space to shoot.",
        canvas.width / 2,
        canvas.height / 2 + 70
      );
      ctx.fillText(
        "Your goal is destroy all the enemies before your lives reaches 0.",
        canvas.width / 2,
        canvas.height / 2 + 90
      );
      this.help();
      tmr = setInterval(function() {
        options.instructions();
      }, interval);
    } else {
      clearInterval(tmr);
      tmr = setInterval(update, interval);
    }
  },

  mute: function() {
    this.m = !this.m;
    if (this.m) {
      spaceship.fire.pause();
      spaceship.explode.pause();
    }
  },

  checkEnd: function() {
    if (spaceship.lives === 0) {
      clearInterval(tmr);
      options.gameTimeEnd = new Date().valueOf();
      tmr = setInterval(function() {
        options.gameOver();
      }, interval);
    } else if (enemies.coords.length === 0) {
      clearInterval(tmr);
      this.gameTimeEnd = new Date().valueOf();
      tmr = setInterval(function() {
        options.win();
      }, interval);
    }
  },

  win: function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.updateStars();
    background.draw();
    ctx.font = "50px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText("You Win", canvas.width / 2, canvas.height / 2 + 50);
    ctx.font = "30px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText(
      "You Scored: " +
        spaceship.score +
        "  in Time: " +
        Math.floor((this.gameTimeEnd - this.gameTimeStart) / 1000),
      canvas.width / 2,
      canvas.height / 2 + 100
    );
  },

  gameOver: function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.updateStars();
    background.draw();
    ctx.font = "50px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
    ctx.font = "30px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText(
      "You Scored: " +
        spaceship.score +
        "   in Time: " +
        Math.floor((this.gameTimeEnd - this.gameTimeStart) / 1000),
      canvas.width / 2,
      canvas.height / 2 + 70
    );
  },

  time: function() {
    ctx.font = "20px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText(
      "Time: " +
        Math.floor((new Date().valueOf() - options.gameTimeStart) / 1000),
      canvas.width - 100,
      50
    );
  },

  giveBreak: function() {
    clearInterval(tmr);
    this.pause();
    setTimeout(function() {
      options.pause();
    }, 1500);
  }
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  background.draw();
  spaceship.draw();
  weapon.draw();
  enemyCounter.draw();
  enemies.draw();
  options.showLives();
  options.score();
  options.help();
  options.time();
}

function update() {
  background.updateStars();
  spaceship.update();
  checkCollision.enemies();
  checkCollision.spaceship();
  weapon.update();
  enemies.update();
  enemyCounter.update();
  draw();
  options.checkEnd();
}

countdown = {
  startGame: false,
  time: 3,
  started: new Date().valueOf(),

  heading: function() {
    ctx.font = "bold 70px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText("SPACE INVADERS", canvas.width / 2, canvas.height / 2);
  },

  timer: function() {
    ctx.font = "30px Impact";
    ctx.fillStyle = "green";
    ctx.textAlign = "center";
    ctx.fillText(
      "Game starts in " + this.time + "...",
      canvas.width / 2,
      canvas.height / 2 + 50
    );
  },

  update: function() {
    if (!this.startGame) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      background.updateStars();
      background.draw();
      countdown.heading();
      countdown.timer();
      this.time = 3 - Math.floor((new Date().valueOf() - this.started) / 1000);
      if (this.time <= 0) this.startGame = true;
    } else {
      clearInterval(tmr);
      options.gameTimeStart = new Date().valueOf();
      tmr = setInterval(update, interval);
    }
  }
};

function initialize() {
  background.createStars();
  enemies.spawn();
  spaceship.setup();
  tmr = setInterval(function() {
    countdown.update();
  }, interval);
}

initialize();

onKeyDown = evt => {
  if (!countdown.startGame || options.p) return;
  if (evt.keyCode === 32) weapon.shootMissile(); // space
  if (evt.keyCode === 37) spaceship.left = true; // left arrow key
  if (evt.keyCode === 39) spaceship.right = true; // right arrow key
  if (evt.keyCode === 73) {
    options.i = !options.i;
    clearInterval(tmr);
    options.instructions();
  } // i
  if (evt.keyCode === 77) options.mute(); // m
  if (evt.keyCode === 80) options.pause(); // p
};

onKeyUp = evt => {
  if (evt.keyCode === 37) spaceship.left = false; // left arrow key
  if (evt.keyCode === 39) spaceship.right = false; // right arrow key
};

body.addEventListener("keydown", onKeyDown);
body.addEventListener("keyup", onKeyUp);
