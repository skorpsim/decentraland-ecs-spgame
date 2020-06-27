# Sliding puzzles for Decentraland!

![](https://github.com/skorpsim/https://github.com/skorpsim/decentraland-ecs-spgame/raw/master/images/spgame.png)

## Overview

Deploy highly customisable sliding puzzle games to your Decentraland scene's.  

### This game module allows for  

* Any quadratic and non-quadratic puzzle shapes from (2 x 2) to (m x n)
* Setup with a single image or predefined 3d assets (glTF, glb)
* Quadratic and non-quadratic tile shapes
* Callback functions for game state changes and user interaction
* Customization of the tile appearance and layout
* Settable start conditions on scene entry (shuffled or resolved, alive)
* Random tile shuffle or fixed user defined shuffle  

### Possible applications

* hide a secret message or code
* play with non-fungible token (NFTs)
* unlock areas or new levels
* interactive how to solve tutorial

Sliding puzzle games are mostly known for the most popular variants like 15 puzzle or 8 puzzle. The 15 puzzle for example consists of 15 tiles that are placed in a 4x4 box leaving one position out of the 16 empty. The goal is to reposition the tiles from a given arbitrary starting arrangement by sliding them one at a time.

## Setup

### Installation

Install with `npm` package manager. Run this command in your scene's project folder.

```
npm i decentraland-ecs-spgame
```

### Integration

Make the game components available to your TypeScript file by adding the following statement to the top of your file.  

```ts
import sp from "../node_modules/decentraland-ecs-spgame/index"
```

In your TypeScript file, write `sp.` and let the suggestions of your IDE show the available module components.

## Usage

The imported namespace `sp` will contain the sliding puzzle game class  `SPGame`. The class provides two constructors.

### Constructors

**1. Setup with an image file => `SPImageSetup` interface**

```ts
var puzzle = new sp.SPGame(
  {
    image: "textures/example.png",          // image source
    puzzleShape: new Vector2(2,3),          // tile rows(x), columns(y)
    tileDistance: new Vector2(1.02, 1.02),  // center distance along the x and y axis
  });
```

optional specific parameters

```ts
    textureMaterial?: Material;              // texture is applied to this material
    boxMaterial?: Material;                  // material of the tile corpus
```

optional general parameters

```ts
    puzzleTransform?: Transform;             // transform of the puzzle entity
    tileTransform?: Transform;               // transform of the tiles
    addToEngine?: boolean;                   // setup adds puzzle to engine
    startShuffle?: boolean;                  // shuffled on player entry
    fixedShuffle?: number[];                 // fixed shuffle instead of randomized
```

**2. Setup with predefined 3d assets (glTF, glb) => `SPTileAssetsSetup` interface**

```ts
var puzzle = new sp.SPGame(
  {
    assetRoot: "models/tile_",              // root string of asset source
    assetType: sp.AssetFileType.glTF,       // file type of 3d assets
    puzzleShape: new Vector2(2,3),          // tile rows(x), columns(y)
    tileDistance: new Vector2(1.02, 1.02),  // center distance along the x and y axis
  });
```

optional general parameters

```ts
    puzzleTransform?: Transform;             // transform of the puzzle entity
    tileTransform?: Transform;               // transform of the tiles
    addToEngine?: boolean;                   // setup adds puzzle to engine
    startShuffle?: boolean;                  // shuffled on player entry
    fixedShuffle?: number[];                 // fixed shuffle instead of randomized
```

**Optional constructor parameter `SPGameActions`**

`SPGameActions` contains optional callback functions for game state changes and user interaction. The the following callback attributes are provided.

```ts
    start?: () => void;                      // game starts, before shuffling
    finish?: () => void;                     // puzzle is completed
    willMove?: () => void;                   // movable tile was clicked
    willStall?: () => void;                  // unmovable tile was clicked
```

### Example

Create a new folder `textures` in the root folder of your Decentraland project.  
Put an image `example.png` in the new `textures` folder.

This example code creates a (2 x 3) puzzle, with 2 rows and 3 columns, based on a local image file. We used a fixed shuffle where only the last two tiles will be swapped. The  game will invoke the function `playMySound()` when the puzzle was solved by the user.

```ts
import sp from "../node_modules/decentraland-ecs-spgame/index"

var puzzle = new sp.SPGame(
  {
    image: "textures/example.png",
    puzzleShape: new Vector2(2,3),
    tileDistance: new Vector2(1.02, 1.02),
    puzzleTransform: new Transform({position: new Vector3(8, 0.2, 1)}),
    tileTransform: new Transform({scale: new Vector3(1, 0.1, 1)}),
    startShuffle: true,
    fixedShuffle: [0, 1, 2, 3, 5, 4],
  },
  {
    finish: playMySound
  });


function playMySound(): void
{ 
  // ...
}
```

## Troubleshooting

The module will throw errors in case the setup data is faulty.  
`puzzleShape` must be at least (2 x 2) and the shape values must be integers.  
`tileDistance` must be greater than 0 for each axis.  
`fixedShuffle` the fixed shuffle array must contain all tile indices (0 .. tileCount-1). The fixed shuffle can not be unshuffled and the shuflle must be solvable. Note: A randomized tile shuffle is not always solvable. See [Link](http://kevingong.com/Math/SixteenPuzzle.html#proof) for further information.
