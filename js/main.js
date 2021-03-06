'use strict';


/*  Globals  */

// Objects
var game = new Phaser.Game(360, 640, Phaser.AUTO);
var rng = new Phaser.RandomDataGenerator();
var audio = null;
var audioBG = null;
// Settings
var debug = (debug === undefined) ? false : debug; //True to show debugging info
var playerMaxVelocity = 200;
var highScore = 0;
var leafPaintColor = Phaser.Color.hexToColor('95b6ea');
// Main game
var LeafGame = {};


/*  Helper functions  */

var Helper ={
  relativeX: function(x) {
    // Returns the x-coordinate of the canvas based on the passed percentage
    return game.world.width * x;
  },
  relativeY: function(y) {
    // Returns the y-coordinate of the canvas based on the passed percentage
    return game.world.height * y;
  },
  getTextYBottom: function(text) {
    // Gets the y-pixel at the bottom of text. Useful for putting text underneath text
    return text.textBounds.y + text.bottom;
  }
}


/*  Objects  */

// Manages a BitmapData and paints onto it with particles
var ParticlePainter = function() {
  this.bg = null;
  this.emitter = null
  this.waterParticleSize = 5;
  this.waterParticleLifespan = 10000;
  this.waterParticleFrequency = 200;
}
ParticlePainter.prototype = {
  init: function(backgroundImage) {
    // Initializes the ParticlePainter
    // Create background
    this.bg = game.make.bitmapData(game.width, game.height);
    this.bg.addToWorld(0, 0);
    
    // Emitter
    this.emitter = game.add.emitter(Helper.relativeX(0.5), Helper.relativeY(1), 100);
    this.emitter.width = game.world.width;
    // Emitter physics
    this.emitter.enableBody = true;
    this.emitter.physicsBodyType = Phaser.Physics.ARCADE;
    this.emitter.gravity.set(0, 0);
    // Make particles
    this.emitter.makeParticles('particle');
    this.emitter.setXSpeed(-playerMaxVelocity / 10, playerMaxVelocity / 10);
    this.emitter.setYSpeed(-playerMaxVelocity, 0);
    this.emitter.flow(this.waterParticleLifespan, this.waterParticleFrequency, 1, -1);
    this.emitter.forEach(function(particle) {
      // Randomize color
      particle.color = Phaser.Color.HSLtoRGB(rng.realInRange(170, 245) / 360,
                                            rng.realInRange(15, 35) / 100,
                                            rng.realInRange(75, 98) / 100);
    });
  },
  update: function(passedFunction, context) {
    // Update particles
    this.emitter.forEachAlive(function(particle) {
      // Call the passed function on each particle
      passedFunction.call(context, particle);
      
      // Paint on background
      this.bg.circle(particle.x, particle.y, this.waterParticleSize,
                     particle.color.rgba);
    }, this);
    
    // Mark the background to be redrawn
    this.bg.dirty = true;
  },
  paintCircle: function(x, y, r, rgba) {
    // Draws a circle
    this.bg.circle(x, y, r, rgba);
    this.bg.dirty = true;
  },
  clearBitmap: function() {
    // Resets the contents of the bitmap
    this.bg.fill(255, 255, 255, 1);
    this.bg.draw(game.cache.getImage('gameBackground'), 0, 0);
  },
  clearParticles: function() {
    // Kill all particles
    this.emitter.forEach(function(particle) {
      particle.kill();
    });
  },
  resetEmitter: function() {
    // Resets the emitter
    this.emitter.frequency = this.waterParticleFrequency;
    this.emitter.on = true;
  }
}

// Manages a bitmap image as a vector field
var VectorField = function() {
  // Higher numbers is increased acceleration/speed
  // Red = x+ acceleration
  // Green = x- acceleration
  // Blue = y+ acceleration
  // Alpha = speed
  this.field = null;
  this.maxSpeed = null;
}
VectorField.prototype = {
  reset: function(newSpeed) {
    // Clears the vector field.
    // Must be called to setup the VectorField before calling any other functions
    
    // Create bitmap if it doesn't exist
    if (this.field == null) {
      this.field = game.make.bitmapData(game.width, game.height);
    }
    
    // Clear canvas
    this.field.clear();
    this.field.update();
    
    // Set speed
    this.maxSpeed = newSpeed;
  },
  add: function(image, x, y) {
    // Adds an image to the field at location x, y
    var imageObj = image;
    if (typeof image == 'string') {
      // Get image from cache if called with a string
      imageObj = game.cache.getImage(image);
    }
    
    // Set blend mode
    this.field.blendScreen();
    // Draw image
    this.field.draw(imageObj, x, y);
    // Update canvas
    this.field.update();
  },
  toWorld: function(x, y) {
    // Adds vector field bitmap to the game at location x, y
    this.field.addToWorld(x, y);
  },
  getVector: function(x, y) {
    // Gets the acceleration vector at a point
    var getX = Math.round(x);
    var getY = Math.round(y);
    
    // Bounds check
    if (x >= this.field.width) {
      getX = this.field.width - 1;
    } else if (x < 0) {
      getX = 0;
    }
    if (y >= this.field.height) {
      getY = this.field.height - 1;
    } else if (y < 0) {
      getY = 0;
    }
    
    // Convert the color to a vector and return
    return this.colorToVector(this.field.getPixel(getX, getY));
  },
  colorToVector(colorObj) {
    // Converts a color object to a vector (Phaser point)
    // Create vector and set direction
    var vector = new Phaser.Point(colorObj.r - colorObj.g, colorObj.b);
    // Set the correct magnitude
    vector.setMagnitude((colorObj.a / 255) * this.maxSpeed);
    return vector;
  }
}


/*  Game states  */

// Prepare for preload
LeafGame.Boot = function(){};
LeafGame.Boot.prototype = {
  init: function() {
    console.log('Boot: init');
    // don't allow losing browser focus to halt game
    this.stage.disableVisibilityChange = true;
  },
  preload: function() {
    console.log('Boot: preload');
    // ready the asset we need to display during preload
    this.load.path = 'assets/img/';
    this.load.image('bar', 'bar.png');
  },
  create: function() {
    // enable FPS monitoring
    if (debug) {
      game.time.advancedTiming = true;
    }
    
    this.state.start('Preloader');
  }
}

// Preload assets
LeafGame.Preloader = function() {
  this.preloadBar = null;
};
LeafGame.Preloader.prototype = {
  preload: function() {
    console.log('Preloader: preload');
    
    // Display text
    this.add.text(650, 20, 'Loading...', {fontSize: '32px', fill: 'white'});

    // Add preloader bar and set as preloader sprite (auto-crops sprite)
    this.preloadBar = this.add.sprite(Helper.relativeX(0.5) -100, Helper.relativeY(0.5),'bar');
    this.load.setPreloadSprite(this.preloadBar);

    // load a path to save us typing
    this.load.path = 'assets/img/';  
    // load image assets
    this.load.images(['leaf', 'rock1', 'rock2', 'rock3', 'rock4', 'particle', 'gameBackground', 'menuBackground'],
                     ['leaf.png', 'rock/rock1.png', 'rock/rock2.png', 'rock/rock3.png', 'rock/rock4.png', 'particle.png', 'background.png', 'menu-background.png']);
    
    // Load vector fields
    this.load.path = 'assets/img/vectorFields/'; 
    this.load.images(['vfRiver', 'vfRock'],
                     ['river.png', 'rock.png']);

    // load audio
    this.load.path = 'assets/audio/';
    // https://opengameart.org/content/ambient-mountain-river-wind-and-forest-and-waterfall
    this.load.audio('river', ['amb_river.mp3', 'amb_river.ogg']);
    this.load.audio('stream', ['amb_stream.mp3', 'amb_stream.ogg']);
    this.load.audio('drop', ['LiquidWaterDropSingle09.mp3', 'LiquidWaterDropSingle09.ogg']);
    // https://lifeformed.bandcamp.com/track/breadtime
    this.load.audio('music', ['breadtime.mp3', 'breadtime.ogg']);
  },
  create: function() {
    console.log('Preloader: create');
    // disable preload bar crop while we wait for mp3 decoding
    this.preloadBar.cropEnabled = false;
  },
  update: function() {
    // wait for first audio file to properly decode
    if(this.cache.isSoundDecoded('stream')) {
      this.state.start('Menu');
    }
  }
};

// Main menu
LeafGame.Menu = function() {
  // References
  this.inputNext = null;
  this.bg = null;
  this.playerTrail = null;
  this.leaf = null;
  this.text = [];
  this.transitionStarted = null;
  this.dropFX = null;
  this.streamFX = null;
  this.riverFX = null;
  this.dropPlayed = false;
  
  // Settings
  this.gravity = 100;
  this.initialVelocity = 10;
};
LeafGame.Menu.prototype = {
  create: function() {
    console.log('Menu: create');
    
    // Settings
    this.transitionStarted = false;
    this.dropPlayed = false;
    
    // Background
    this.bg = new ParticlePainter;
    this.bg.init();
    this.bg.bg.draw(game.cache.getImage('menuBackground'), 0, 0);
    this.bg.emitter.width = 1;
    this.bg.emitter.height = game.world.height / 4;
    this.bg.emitter.x = game.world.width;
    this.bg.emitter.y = Helper.relativeY(0.875);
    this.bg.emitter.setXSpeed(-playerMaxVelocity, 0);
    this.bg.emitter.setYSpeed(-playerMaxVelocity / 15, playerMaxVelocity / 10);
    this.bg.clearParticles(); // Remove any spawned particles before moving
    
    // Player trail
    this.playerTrail = game.make.bitmapData(game.width, game.height);
    this.playerTrail.addToWorld(0, 0);
    
    // Sprites
    this.leaf = this.add.sprite(Helper.relativeX(0.5), 0, 'leaf');
    this.leaf.anchor.set(0.5, 0.5);
    this.leaf.y = - this.leaf.height / 2;
    // Enable physics
    this.physics.enable([this.leaf], Phaser.Physics.ARCADE);
    
    // Text
    this.text[0] = this.add.text(0, 0, 'A Leaf on The Water', 
                  {font: 'bold 3em Georgia', boundsAlignH: 'center', fill: "white"});
    this.text[0].setTextBounds(0, Helper.relativeY(0.1), this.world.width);
    
    this.text[1] = this.add.text(0, 0, 'Press enter to start', 
                  {font: '2.5em Verdana', boundsAlignH: 'center'});
    this.text[1].setTextBounds(0, Helper.relativeY(0.5), this.world.width);
    
    this.text[2] = this.add.text(0, 0, 'Arrow keys to avoid rocks', 
                  {font: '2em Verdana', boundsAlignH: 'center'});
    this.text[2].setTextBounds(0, Helper.getTextYBottom(this.text[1]), this.world.width);
    
    this.text[3] = this.add.text(0, 0, 'Most rapids survived: '+ highScore, 
                  {font: '2em Verdana', boundsAlignH: 'center'});
    this.text[3].setTextBounds(0, Helper.getTextYBottom(this.text[2]), this.world.width);
    
    // Input
    this.inputNext = this.input.keyboard.addKey(Phaser.KeyCode.ENTER);
    
    // Audio
    this.dropFX = this.add.audio('drop');
    this.streamFX = this.add.audio('stream');
    this.streamFX.play('', 0, 0.35, true); // ('marker', start position, volume (0-1), loop)
    this.riverFX = this.add.audio('river');
    this.riverFX.play('', 0, 0, true); // ('marker', start position, volume (0-1), loop)
  },
  update: function() {
    // Check if player falling
    if (this.leaf.y > Helper.relativeY(1.0) - game.world.height / 4) {
      this.leaf.body.gravity.y = 0.0;
      this.leaf.body.gravity.x = -this.gravity;
      this.riverFX.fadeTo(100, 0.6);
    }
    
    // Play SFX when at appropriate height for leaf falling into water
    if (!this.dropPlayed && (this.leaf.y > Helper.relativeY(1.0) - game.world.height / 4)) {
      this.dropFX.play('', 0, 1.0, false);
      this.dropPlayed = true;
      
      // Set velocity to appear as if it fell into water
      this.leaf.body.velocity.y = 0.0;
      this.leaf.body.velocity.x = -25.0;
    }
    
    // Switch state when player off side of screen
    if (this.leaf.x < 0) {
      this.toPlay();
    }
    
    // Update player trail
    this.playerTrail.circle(this.leaf.x, this.leaf.y, this.leaf.width / 2, leafPaintColor.rgba);
    this.playerTrail.dirty = true;
    
    // Update bg
    this.bg.update(function(particle) {
      particle.body.acceleration.x = -10;
    }, this);
    
    // Switch states when button is pressed
    if (this.inputNext.justPressed()) {
      if (!this.transitionStarted) {
        // Start transition
        this.transitionStarted = true;
        // Remove text
        for (var i = 0; i < this.text.length; i++) {
          this.text[i].destroy();
        }
        
        // Fade audio
        this.streamFX.fadeTo(1000, 0);
        
        // Start leaf falling
        this.leaf.body.gravity.y = this.gravity;
        this.leaf.body.velocity.y = this.initialVelocity;
      } else {
        // Skip transition
        this.toPlay();
      }
    }
  },
  render: function() {
    if (debug) {
      // show debug info
      game.debug.text(`Debugging Phaser ${Phaser.VERSION}`, 20, 20, 'yellow');
      game.debug.text('FPS: ' + game.time.fps, 20, 580, 'yellow');
    }
  },
  toPlay: function() {
    // this.riverFX.stop();
    audio = this.riverFX;
    this.streamFX.stop();
    this.state.start('Play');
  }
}

// Play state
LeafGame.Play = function() {
  /*  References  */
  
  // Sprites
  this.leaf = null;
  this.rock = null;
  this.waterEmitter = null;
  this.painter = null;
  this.bg = null;
  // Text
  this.leafText = null;
  this.leafNumber = null;
  // Input
  this.cursors = null;
  this.inputNext = null;
  // Audio
  this.bgMusic = null;
  this.bgMusic = null;
  this.riverFX = null;
  this.vf = new VectorField();
  
  
  /*  Gameplay values  */
  
  // Water
  this.flowAcceleration = 15;
  this.maxWaterAcceleration = 75;
  // Player
  this.playerAcceleration = this.maxWaterAcceleration * 0.75;
  this.playerMaxVelocity = playerMaxVelocity;
  this.playerRapidsVelocityIncrese = 10;
  this.playerRapidsVelocity;
  // General
  this.startTimerLength = 5; //In seconds
  this.numberOfRocks = 7;
  this.percentRnadom = 0.1;
  // Spawner settings
  this.rockSpawnMinY = 0.05; //In percentage
  this.rockSpawnMaxY = 0.7; //In percentage
  this.rockSpawnRange = 0.05; //In percentage
  this.rockSpawnXPadding = 0.05; //In percentage
  
  // Gameplay flags
  this.status = {
    location: null,
    startTimer: null,
    rapidsCleared: null,
    windAcceleration: null
  };
};
LeafGame.Play.prototype = {
  create: function() {
    console.log('Play: create');
    
    // Settings
    this.playerRapidsVelocity = 65 - this.playerRapidsVelocityIncrese;
    
    // Initialize settings
    if (highScore == 0) {
      this.status.location = 'calm';
    } else {
      // Skip into if they have a high score
      this.status.location = 'rapids';
    }
    this.status.startTimer = this.time.create(false);
    this.status.rapidsCleared = 0;
    this.status.windAcceleration = 0
    
    // Create ParticlePainter
    this.painter = new ParticlePainter;
    this.painter.init();
    
    // Setup vector field
    this.vf.reset(this.maxWaterAcceleration);
    if (debug) {
      // Show vector field as a background image
      this.vf.toWorld(0, 0);
    }
    
    // Groups
    this.rock = this.add.group();
    
    // Sprites
    this.leaf = this.add.sprite(Helper.relativeX(0.5), Helper.relativeY(0.85), 'leaf');
    
    // Text
    this.leafText = this.add.text(0, 0, '', 
                  {font: '3em Verdana', boundsAlignH: 'center'});
    this.leafText.setTextBounds(0, Helper.relativeY(0.75), game.width, Helper.relativeY(0.25));
    
    this.leafNumber = this.add.text(0, 0, '', 
                    {font: '3em Verdana', boundsAlignH: 'center'});
    this.leafNumber.setTextBounds(0, Helper.getTextYBottom(this.leafText), this.world.width);
    
    // Physics
    this.physics.enable([this.leaf, this.rock], Phaser.Physics.ARCADE);
    this.leaf.body.setCircle(this.leaf.width/2);
    
    // Audio
    this.riverFX = audio;
    this.riverFX.fadeTo(100, 0.6);
    if (!audioBG) {
      // Start audio
      audioBG = this.add.audio('music');
      this.bgMusic = audioBG;
      this.bgMusic.play("", 0, 0.35, true); // ('marker', start position, volume (0-1), loop)
    } else {
      // Continue audio
      audioBG.resume();
    }
    
    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.inputNext = this.input.keyboard.addKey(Phaser.KeyCode.ENTER);
    
    // Generate first set of water
    if (highScore > 0) {
      // If already played, start at rapids
      this.newRapids();
    } else {
      this.newCalm();
    }
  },
  
  
  /*  Generate river sections  */
  
  newRapids: function() {
    // Changes board state to rapids
    
    // Make speed faster
    this.playerRapidsVelocity += this.playerRapidsVelocityIncrese;
    if (debug) {
      console.log("Score: " + this.playerRapidsVelocity);
    }
    
    // Generates a new set of rapids
    this.status['location'] = 'rapids';
    this.resetWater();
    
    // Reset PC
    this.leaf.x = Helper.relativeX(0.5);
    this.leaf.y = this.world.height + this.leaf.height;
    this.leaf.body.velocity.set(0, 0);
    
    // Spawn rocks
    var numRandom = Math.round(this.numberOfRocks * this.percentRnadom);
    var numOrdered = this.numberOfRocks - numRandom;
    // Spawn ordered
    for (var i = 1; i <= numOrdered; i++) {
      var targetY = i / numOrdered;
      var diff = this.rockSpawnMaxY - this.rockSpawnMinY;
      var yMax = Math.min(targetY * diff + this.rockSpawnRange, this.rockSpawnMaxY);
      var yMin = Math.max(targetY * diff - this.rockSpawnRange, this.rockSpawnMinY);
      this.createRock(Helper.relativeX(rng.realInRange(this.rockSpawnXPadding, 1 - this.rockSpawnXPadding)), Helper.relativeY(rng.realInRange(yMin, yMax)));
    }
    // Spawn random
    for (var i = 1; i <= numRandom; i++) {
      this.createRock(Helper.relativeX(rng.realInRange(this.rockSpawnXPadding, 1 - this.rockSpawnXPadding)), Helper.relativeY(rng.realInRange(this.rockSpawnMinY, this.rockSpawnMaxY)));
    }
    
    // Emitter settings
    this.painter.emitter.height = 1;
    this.painter.emitter.on = true;
    
    // Start timer to rapids
    this.status.startTimer.add(Math.max(this.startTimerLength - this.status.rapidsCleared, 0) * 1000, function() {
      // Called when timer done
      
      // Remove text
      this.leafText.setText('');
      this.leafNumber.setText('');
      
      // Stop the timer
      this.status.startTimer.stop();
      
      // Slow water particle emitter
      this.painter.emitter.frequency = this.painter.waterParticleFrequency * 5;
      
      // Give the player some starting momentum
      this.leaf.body.velocity.y = -this.playerRapidsVelocity;
    }, this);
    this.status.startTimer.start();
  },
  newCalm: function() {
    // Generates a new calm set of water
    
    // Init
    this.status['location'] = 'calm';
    this.resetWater();
    
    // Set emitter settings
    this.painter.emitter.height = this.world.height;
    
    // Reset PC
    this.leaf.y = this.world.height - (this.leaf.height / 2);
  },
  
  
  /*  Main game loop  */
  
  update: function() {
    // If off top
    if (this.leaf.y < -this.leaf.height
        || debug && this.cursors.up.justPressed()) {
      // Generate new set of water
      if (this.status['location'] == 'calm') {
        this.newRapids();
      } else if (this.status['location'] == 'rapids') {
        this.status.rapidsCleared++;
        this.newCalm();
      }
    }
    
    // If off sides
    if (this.leaf.x > this.world.width - this.leaf.width/2
        || this.leaf.x < 0 - this.leaf.width/2) {
      this.toMenu();
    }
    
    // Press next to skip rapids timer
    if (this.inputNext.justPressed() && this.status.startTimer.running) {
      if (this.status.location == 'rapids') {
        // Get the timer event and call its callback
        this.status.startTimer.events[0].callback.call(this.status.startTimer.events[0].callbackContext);
      }
    }
    
    // Player movement
    // Set acceleration from input
    if (this.cursors.left.isDown) {
      // Go left
      this.status.windAcceleration = -this.playerAcceleration;
    }
    if (this.cursors.right.isDown) {
      // Go right
      this.status.windAcceleration = this.playerAcceleration;
    }
    if (this.cursors.right.isUp && this.cursors.left.isUp) {
      // Do not change course
      this.status.windAcceleration = 0;
    }
    
    // Update particles
    this.painter.update(function(particle) {
      // Update speed/acceleration
      this.setWaterAcceleration(particle);
      this.setMaxSpeed(particle, this.playerMaxVelocity);
    }, this);
    
    // Paint player to the background
    this.painter.paintCircle(this.leaf.x + this.leaf.width / 2, this.leaf.y + this.leaf.height / 2, this.leaf.width / 2,
                             leafPaintColor.rgba);
    
    // Move player sprite
    this.setWaterAcceleration(this.leaf);
    this.setMaxSpeed(this.leaf, this.playerMaxVelocity);
    
    // Update time left before rapids
    if (this.status.startTimer.running
          && this.status.location == 'rapids') {
      // Force leaf off screen
      this.leaf.x = Helper.relativeX(0.5);
      this.leaf.y = this.world.height;
      
      // Update timer text
      var remaining = Math.round(this.status.startTimer.duration / 1000);
      this.leafText.setText('Approaching rapids');
      this.leafNumber.setText(remaining);
    }
    
    // Collision checking
    // If the player hits a rock
    if (this.physics.arcade.collide(this.leaf, this.rock)) {
      this.toMenu();
    }
  },
  render: function() {
    if (debug) {
      // show debug examples
      game.debug.text(`Debugging Phaser ${Phaser.VERSION}`, 20, 20, 'yellow');
      // game.debug.spriteBounds(dude);
      game.debug.text('FPS: ' + game.time.fps, 20, 580, 'yellow');
      
      // Physics
      game.debug.bodyInfo(this.leaf, 32, 50);
      game.debug.body(this.leaf);
      this.rock.forEach(function(rock) {
        game.debug.body(rock);
      });
    }
  },
  
  
  /*  Helpers  */
  
  toMenu: function() {
    // Back to the main menu
    
    // Update score
    highScore = Math.max(highScore, this.status.rapidsCleared);
    
    // Stop audio
    this.riverFX.stop();
    this.bgMusic.pause(); // Pause so we can resume from same place
    
    this.state.start('Menu');
  },
  createRock(x, y) {
    // Creates a rock obstacle
    // Add to world
    var randomRock = Math.ceil(Math.random() * 4.0);
    var rock = this.rock.create(x, y, 'rock'+randomRock);
    rock.anchor.set(0.5, 0.5);
    this.physics.arcade.enable(rock);
    rock.body.immovable = true;
    
    // Add to vector field
    var image = this.cache.getImage('vfRock');
    this.vf.add(image, x - (image.width / 2), y - (image.height / 2));
    
    return rock;
  },
  setWaterAcceleration(obj) {
    // Sets the water flow acceleration
    // Set acceleration based on the vector field
    obj.body.acceleration = this.vf.getVector(obj.x, obj.y);
    // Add river flow acceleration
    obj.body.acceleration.y -= this.flowAcceleration;
    // Add wind acceleration
    obj.body.acceleration.x += this.status.windAcceleration;
  },
  setMaxSpeed(obj, speed) {
    // Caps the velocity of an object
    var velocity = obj.body.velocity;
    if (velocity.getMagnitude() > speed) {
      velocity.setMagnitude(speed);
    }
  },
  resetWater() {
    // Basic cleanup that resets the map to a neutral state
    // Setup vector field
    this.vf.reset(this.maxWaterAcceleration);
    this.vf.add('vfRiver', 0, 0);
    
    // Kill any existing rocks
    this.rock.removeAll();
    
    // Clear background
    this.painter.clearParticles();
    this.painter.clearBitmap();
    this.painter.resetEmitter();
  }
};


/*  Start the game!  */

game.state.add('Boot', LeafGame.Boot);
game.state.add('Preloader', LeafGame.Preloader);
game.state.add('Menu', LeafGame.Menu);
game.state.add('Play', LeafGame.Play);
game.state.start('Boot');
