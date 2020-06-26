**This file is currently unter development and will be updated shortly**

# Overview

Deploy highly customisable slide puzzle games to your Decentraland scene's.  

## This game module allows for  

* Any quadratic and non-quadratic puzzle shapes from (2 x 2) to (m x n)
* Setup with a single image or predefined 3d assets (glTF, glb)
* Quadratic and non-quadratic tile shapes
* Callback functions for game state changes and user interaction
* Customization of the tile appearance and layout
* Settable start conditions on scene entry (shuffled or resolved, alive)
* Random tile shuffle or fixed user defined shuffle  

## Possible applications

* hide a secret message or code
* play with non-fungible token (NFTs)
* unlock areas or new levels
* interactive how to solve tutorial

Slide puzzle games are mostly known for the most popular variants like 15 puzzle or 8 puzzle. The 15 puzzle for example consists of 15 tiles that are placed in a 4x4 box leaving one position out of the 16 empty. The goal is to reposition the tiles from a given arbitrary starting arrangement by sliding them one at a time.

# Setup

## Installation

Install it as an `npm` package. Run this command in your scene's project folder:

```
npm i decentraland-ecs-spgame
```

## Integration

Make the game components available to your TypeScript file by adding the following statment to the top of your file.  

```ts
import sp from "../node_modules/decentraland-ecs-spgame/index"
```

In your TypeScript file, write `sp.` and let the suggestions of your IDE show the available module components.

# Usage