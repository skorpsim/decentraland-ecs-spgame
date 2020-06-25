import utils from "../../node_modules/decentraland-ecs-utils/index"



// Copyright (c) 2020 Simon Hodrus. All rights reserved. Licensed under the MIT license.

// [IMPROVEMENTS]
// - more dynamic with getters and setters
// - clearer structured with async await on tile swap
// - may create own Tile class from Entity instead of using a custom component

/**
 * Enum for 3D asset file type.
 */
export enum AssetFileType                                                                           // file type ending of the assets  
{
    glTF,
    glb
}

/**
 * Interface for puzzle setup with the location string of the image file.
 */
export interface SPImageSetup extends SPSetup
{
    image: string;                                                                                  // image file location string. Image is split into the puzzle tiles   
    textureMaterial?: Material;                                                                     // basic texture material, the texture is added to this material
    boxMaterial?: Material;                                                                         // basic material of the tile corpus
}

/**
 * Interface for puzzle setup with predefined puzzle tile assets.
 */
export interface SPTileAssetsSetup extends SPSetup
{
    assetRoot: string;                                                                              // tile asset root string, this string is followed by the one-dimensional index  
    assetType: AssetFileType;                                                                       // tile asset type, glTF or glb
}

/**
 * Interface for basic puzzle setup.
 * 
 * @remarks
 * Defines `puzzleShape` e.g. 4x4 (rows/columns),
 * `tileDistance` distance between the center points of two tiles along the x and y axis,
 * `puzzleTransform` the transform component for the puzzle itself,
 * `tileTransform` displacment and resizing transform component for each individual tile,
 * `addToEngine` should the game be added on setup => default is true,
 * `startShuffle` should the game be shuffled (already started) on setup => default is false
 */
interface SPSetup 
{
    puzzleShape: Vector2;                                                                           // two-dimensional shape of the puzzle tiles x => rows y => columns  
    tileDistance: Vector2;                                                                          // distance between the center points of two tiles along the x and y axis. Therfore there is no need for quadratic tiles
                                                                                                    // [Note] is a game wiht a full gird => fractional tiles possible? Should be in case the tile removed is one of the tiles with the max size
    puzzleTransform?: Transform;  	                                                                // transform component for the tiles parent entity (puzzle). If not set => default 
    tileTransform?: Transform;                                                                      // transform applied to each tile individually
    addToEngine?: boolean;                                                                          // default is true and will add the game with initial state directly to the engine
    startShuffle?: boolean;                                                                         // start the game and shuffle its components => default is false
    fixedShuffle?: number[];                                                                        // instead of a randomized shuffle a fixed shuffle is applied. The array must contain all indices of the tiles starting from 0
}

/**
 * Interface for optional game state actions.
 * 
 * @remarks
 * Defines:
 * `start` invoked when the game is started, right before shuffling,
 * `finish` invoked when the game has ended sucessfully,
 * `willMove` invoked when a tile is going to move,
 * `willStall` invoked when a tile can not move
 */
export interface SPGameActions 
{
    start?: () => void;                                                                             // methode invoked when the game is started, right before shuffling
    finish?: () => void;                                                                            // methode invoked when the game has ended sucessfully
    willMove?: () => void;                                                                          // methode invoked when a tile that is able to move was clicked 
    willStall?: () => void;                                                                         // methode invoked when a tile that is not able to move was clicked
}

/**
 * Interface containing the game state.
 * 
 * @remarks
 * Defines:
 * `tiles` contains all the tile entities ordered by the one-dimensional (flattened) index,
 * `isRunning` game state,
 * `lockedInput` input lock state,
 */
interface ISPGameState 
{
    tiles: Entity[];                                                                                // contains all the tiles ordered by the one-dimensional (flattened) index
    isRunning: boolean;                                                                             // game state
    lockedInput: boolean;                                                                           // input lock state
}

/**
 * Custom component to define slide puzzle tile attributes
 * 
 * @remarks
 * Defines and stores the initial location and the current 
 * location inside puzzle grid.
 */
@Component('sPTile')
export class SPTile {
    index: number = -1;                                                                             // the one-dimensional tile index
    gridOrigin: Vector2 = Vector2.Zero();                                                           // the origin two-dimensional index in the puzzle matrix x => rows, y => columns
    gridCurrent: Vector2 = Vector2.Zero();                                                          // the current two-dimensional index in the puzzle matrix x => rows, y => columns
}



/**
 * the slide puzzle game class
 * 
 * @remarks
 * Contains the full game logic.
 */
export class SPGame implements ISPGameState
{
    public puzzle: Entity;                                                                          // parent entity of the tiles

    /* Derived from ISPGameState */
    public tiles: Entity[];                                                                         // contains all tile entities. The index is the origin position
    public isRunning: boolean;                                                                      // game state
    public lockedInput: boolean;                                                                    // input lock state

    /* Derived from SPSetup */
    public puzzleShape: Vector2;                                                                    // two-dimensional shape of the puzzle tiles
    public tileDist: Vector2;                                                                       // distance between the center points of two tiles along the y and y axis
    public tileCnt: number;                                                                         // total number of tiles according to puzzle shape
    private fixedShuffleArr: number[] | undefined | null;                                           // instead of a randomized shuffle a fixed shuffle is applied. The array must contain all indices of the tiles starting from 0

    /* Will be derived from SPGameActions */
    private start: () => void;                                                                      // methode invoked when the game is started, right before shuffling
    private finish: () => void;                                                                     // methode invoked when the game has ended sucessfully  
    private willMove: () => void;                                                                   // methode invoked when a tile that is able to move was clicked 
    private willStall: () => void;                                                                  // methode invoked when a tile that is not able to move was clicked

    /* SPImageSetup specific */
    private texMaterial: Material | null;                                                           // texture material for SPImageSetup initialization
    private boxMaterial: Material | null;                                                           // box material for the tile corpus
    private boxShape: BoxShape = new BoxShape();                                                    // recycle BoxShape for all entities

    

    /* constructores */
    constructor(setup: SPTileAssetsSetup, actions?: SPGameActions);
    constructor(setup: SPImageSetup, actions?: SPGameActions);
    constructor(setup: SPSetup, actions?: SPGameActions) 
    {
        this.init(setup, actions);
    }


    /**
     * Initialize the puzzle based on setup interface
     * 
     * @param setup - setup interface object, either SPImageSetup or SPTileAssetsSetup
     * @param actions - optional actions that are invoked on defined game states
     */
    private init(setup: SPSetup, actions?: SPGameActions) : void
    {
        this.isRunning = false;                                                                     // init game state
        this.lockedInput = false;                                                                   // init game state                                                           

        this.start = actions?.start ?? this.dummy;                                                  // set game state actions based on parameter or use dummy function
        this.finish = actions?.finish ?? this.dummy;
        this.willMove = actions?.willMove ?? this.dummy;
        this.willStall = actions?.willStall ?? this.dummy;
        

        if((setup.puzzleShape.x + setup.puzzleShape.y) % 1 !== 0)                                   // check setup: are the puzzle shape valures integer?
            throw new Error("the puzzle shape must contain only integer values");
        
        if(setup.puzzleShape.x < 2 || setup.puzzleShape.y < 2)                                      // check setup: is puzzle shape valid?
            throw new Error("the puzzle shape is faulty");
        
        if(setup.tileDistance.x <= 0 || setup.tileDistance.y <= 0)                                  // check setup: is tile distance valid?
            throw new Error("the puzzle tile distances are faulty");
        
        this.puzzleShape = setup.puzzleShape;                                                     
        this.tileDist = setup.tileDistance;
        this.tileCnt = setup.puzzleShape.x * setup.puzzleShape.y;                                   // total tile count derived from puzzle shape

        if(setup.fixedShuffle)                                                                      // set fixed shuffle in case a fixed shuffle array is used 
            this.setfixedShuffleArr(setup.fixedShuffle);
        
        const imageSetup = setup as SPImageSetup;                                                   // convert setup to SPImageSetup to check type guards
        if(imageSetup.image)                                                                        // type guard => init variables in case of SPImageSetup 
        {
            const texture = new Texture(imageSetup.image);                                          // texture from image
            this.texMaterial = imageSetup.textureMaterial ??  new Material();                       // new material or the material from the user setup is used for the tile top
            this.texMaterial.albedoTexture = texture;                                               // set the texture to the material
            this.boxMaterial = imageSetup.boxMaterial ?? new Material();                            // new Material or Material from  the user setup is used for the tile corpus
        }

        this.tiles = new Array<Entity>();                                                           
        this.puzzle = new Entity();
        this.puzzle.addComponent(setup.puzzleTransform ?? new Transform());                         // setup puzzle transformation with default transformation or user setup

        for (let n = 0; n < this.tileCnt; n++) {                                                    // setup every tile

            const tile = new Entity();                                                              // create new tile entity                                                          
            const row: number = Math.floor(n / setup.puzzleShape.y);                                // calculate the row number from the initialization index
            const column: number = n % setup.puzzleShape.y;                                         // calculate the column number from the initialization index
            
            const tileComp = new SPTile();
            tileComp.index = n;                                                                     // set the one-dimensional index
            tileComp.gridOrigin = new Vector2(row, column);                                         // setup the puzzle grid origin position
            tileComp.gridCurrent = new Vector2(row, column);                                        // setup the puzzle grid current position

            const tileSortPos =  new Vector3(-tileComp.gridCurrent.y * this.tileDist.y, 0, tileComp.gridCurrent.x * this.tileDist.x);   // calculate the 3d transformation based on the 2d grid position
            if(setup.tileTransform?.position)                                                       // add used defined tile transformation
                tileSortPos.addInPlace(setup.tileTransform.position);

            const transform = (setup.tileTransform) ? new Transform({position: tileSortPos, rotation: setup.tileTransform.rotation, scale: setup.tileTransform.scale}) 
                : new Transform({position: tileSortPos});                                           // setup default transformation or default + user defined transformation
            
            tile.addComponent(transform);                                                           // add transform component
            tile.addComponent(tileComp);                                                            // add tile specific component

            if(imageSetup.image)                                                                    
                this.setupWithImage(tile, n, imageSetup);                                           // setup with image asset in case of SPImageetup type
            else
                this.setupWithAssets(tile, n, setup as SPTileAssetsSetup);                          // setup with glTF assets in case of SPTileAssetsSetup type
        
            this.tiles.push(tile);                                                                  // add new tile to te tiles array
            tile.setParent(this.puzzle);                                                            // make tile a child of the puzzle
        }

        if(setup.startShuffle)                                                                      // start game in case a initial shuffle is requested
            this.gamePlay();

        if(setup.addToEngine ?? true)                                                               // add the puzzle to the engine or let the user add the entity later
            engine.addEntity(this.puzzle);
    }

    /**
     * Reshuffle the puzzle based on fixes shuffle or a new randomized shuffle
     * 
     * @param arr - fixed shuffle array containing the shuffled tile indices
     * @public
     */
    public reShuffle(fixedShuffleArr?: number[]): void
    {
        
        this.isRunning = false;                                                                     // stop the current game
        
        if(fixedShuffleArr)                                                                         // instead of a randomized shuffle a fixed shuffle is applied. The array must contain all indices of the tiles starting from 0                                                  
            this.setfixedShuffleArr(fixedShuffleArr);                                               // check the fixed shuffle and apply
        else
            this.fixedShuffleArr = fixedShuffleArr;                                                 // reset and randomize again in case of undefined

        this.gamePlay();                                                                            // restart the game                          
    }

    /**
     * Resolve the puzzle
     * 
     * @public
     */
    public resolve(): void
    {
        this.isRunning = false;                                                                     // stop the current game
        this.tiles.map(x =>                                                                         // for each tile call the reposition methode that places the tile on the origin index location
            { this.repositionTile(x, x.getComponent(SPTile).index)
        });
        
        this.voidTileVisibility(true);                                                              // reset the void tile visibilizy
    }

    /**
     * Check and set the fixed shuffle array provided in setup
     * 
     * @param arr - fixed shuffle array containing the shuffled tile indices
     */
    private setfixedShuffleArr(arr: number[]): void
    {
        const comperator: number[] = Array(this.tileCnt);                                           // comperator array, will contain 0 to tileCnt-1 0 => all indices
        //shuffleArr = this.shuffle([...Object.keys(Array(this.tileCnt))]);                         // Array.keys() is currently not supported by decentraland and Objecxt.keys() does not work the same on an Array with not yet defined items
        for (let n: number = 0; n < this.tileCnt; n++) {                                            // fill the array with the origin indices
            comperator[n] = n;
        }

        const arrSort = [...arr].sort((n1, n2) => n1 - n2);                                         // cloned and sorted instance of input array

        if(arr.toString() === comperator.toString())                                                // compare string representations => make sure that the input array is shuffled 
            throw new Error("the provided fixed shuffle array does not contain a shuffle"); 

        if(arrSort.toString() !== comperator.toString())                                            // compare string representations => make sure that the input array contains all tile indices 
            throw new Error("the provided fixed shuffle array does not contain all required tile indices"); 

        if(!this.permutationProof(arr))                                                             // make sure that the input array is solvable
            throw new Error("the provided fixed shuffle array does not provide a solvable shuffle"); 

        this.fixedShuffleArr = arr;                                                                 // the input array is valid => set the fixed shuffle array  
    }

    /**
     * Set the void tile visibility
     * 
     * @param enable - visible => true
     */
    private voidTileVisibility(enable: boolean): void
    {
        const voidTile = this.tiles[this.tileCnt - 1];                                              // tile that is removed (not visible) to enable movement of the remaining tiles
        
        if(enable && !voidTile.alive)                                                               // add to engine in case visibility is requested and entity is not already added
            engine.addEntity(voidTile);
        else if(!enable && voidTile.alive)                                                          // remove from engine in case visibility isn't requested and entity is added
            engine.removeEntity(voidTile);
    }

    /**
     * Setup a tile appearance based on SPTileAssetsSetup
     * 
     * @param tile - the tile entity that is setup
     * @param num - the current index
     * @param assetSetup - setup data 
     */
    private setupWithAssets(tile:Entity, num: number, assetSetup: SPTileAssetsSetup) : Entity
    {
        // get the current tile glTF asset data based on the assetRoot string the current tile index and the asset type
        tile.addComponent(new GLTFShape(`${assetSetup.assetRoot}${num}.${AssetFileType[assetSetup.assetType]}`));
        tile.addComponent(new OnPointerDown((e) => this.tileParentClick(e)));
        return tile;
    }

    /**
     * Setup a tile appearance based on SPImageSetup
     * 
     * @param tile - the tile entity that is setup
     * @param num - the current index
     * @param imageSetup - setup data 
     */
    private setupWithImage(tile:Entity, num: number, imageSetup: SPImageSetup) : Entity
    {
        const tileBox = new Entity();                                                               // the tile building block
        const tileTop = new Entity();                                                               // the tile image

        const row: number = Math.floor(num / imageSetup.puzzleShape.y);                             // row number of the current tile derived from index
        const column: number = num % imageSetup.puzzleShape.y;                                      // column number of the current tile derived from index

        const yfrac = column / imageSetup.puzzleShape.y;                                            // left side y(column) coordinate of the tiles image area
        const yfrac1 = (column +1) / imageSetup.puzzleShape.y;                                      // right side y(column) coordinate of the tiles image area

        const xfrac =  (imageSetup.puzzleShape.x -1 - row) / imageSetup.puzzleShape.x;              // top side x(row) coordinate of the tiles image area
        const xfrac1 = (imageSetup.puzzleShape.x - row) / imageSetup.puzzleShape.x;                 // bottom side x(row) coordinate of the tiles image area

        const textureplane = new PlaneShape()                                                       // create plane shape and add texture fragmet to it
        textureplane.uvs = [ 
            yfrac, xfrac,  yfrac1, xfrac,  yfrac1, xfrac1,  yfrac, xfrac1,                          // tile points (bottom-left) (bottom-right) (top-right) (top-left) 
            0,0,  0,0,  0,0,  0,0                                                                   // back side 
        ]

        tileTop.addComponent(                                                                       // position and rotate the texture to fit the parent alignment
        new Transform({
            position: new Vector3(0, 0.505, 0),
            rotation: Quaternion.Euler(270, 0, 0),
        }))
        tileTop.addComponent(textureplane);                                                         // set plane shape to the tile top
        tileTop.addComponent(new OnPointerDown((e) => this.tileChildClick(e, 2)));                  // add the click handler to the child entity

        if(this.texMaterial)
            tileTop.addComponent(this.texMaterial);                                                 // add texture material to tile top                                

        tileBox.addComponent(this.boxShape);                                                        // reuse boxshape for all tiles
        tileBox.addComponent(new OnPointerDown((e) => this.tileChildClick(e, 1)));                  // add the click handler to the child entity

        if(this.boxMaterial)
            tileBox.addComponent(this.boxMaterial);                                                 // add material to the tile corpus 

                                                                                                    // tile => tileBox => tileTop
        tileBox.setParent(tile);                                                                    // set parent child relationship
        tileTop.setParent(tileBox);                                                                 // set parent child relationship
        return tile;
    }

    /**
     * Tile click call in case the tile is cklicked directly
     * 
     * @param e - click event
     */
    private tileParentClick(e: InputEventResult)
    {
        this.gamePlay(entityFromClick(e));                                                          // call game action for the clicked tile
    }

    /**
     * Tile click call in case the tile children are clicked
     * 
     * @param e - click event
     */
    private tileChildClick(e: InputEventResult, iteration: number)                                  
    {
        const child: Entity | undefined = entityFromClick(e);
        
        if(child)
        {
            const parent = getParent(child, iteration);                                             // get the tile from the child entities                               
            if(parent)
                this.gamePlay(parent as Entity);                                                    // call game action for the clicked tile
        }
    }

    /**
     * Main game function. Is called when user interacts with
     * the puzzle.
     * 
     * @param tile - the tile the user interacted with
     */
    private gamePlay(tile?: Entity): void
    {
        const voidTile = this.tiles[this.tileCnt - 1];                                              // tile that is removed (not visible) to enable movement of the remaining tiles 

        if(!this.isRunning)
        {                                                                                           // the game hasn't started yet
            this.start();                                                                           // invoke ste start action
            this.voidTileVisibility(false);                                                         // set the last tile (voidTile) invisible

            const shuffleArr: number[] = this.getShuffleArray();                                    // shuffle the tile indices in a random manner but keep the shuffle solvable 
            
            this.tiles.map(x =>                                                                     // for each tile call the reposition methode that places the tile on the shuffled index location
                { this.repositionTile(x, shuffleArr.indexOf(x.getComponent(SPTile).index))
            });

            this.isRunning = true;                                                                  // set game state to running
        }
        else if(!this.lockedInput && tile)
        {                                                                                           // the game is already running and a tile has been clicked
            const vtComp = voidTile.getComponent(SPTile);                                           // get puzzle tile component for voidTile
            const tComp = tile.getComponent(SPTile);                                                // get puzzle tile component for the clicked tile
            const vec =  vtComp.gridCurrent.subtract(tComp.gridCurrent);                            // get relative vector between both tiles
            
            if(vec.lengthSquared() === 1.0)                                                         // in case the vector has a length of 1 the clicked tile is movable
            {
                this.willMove();                                                                    // invoke willMove action
                this.gameTurn(tile, voidTile);                                                      // swap the positions of the clicked tile and the invisbile voidTile
            }
            else                                                                                    // tiles are not at close quaters
                this.willStall();                                                                   // invoke willStall action
        }        
    }

    /**
     * Tile reposition without animationc according to target index.
     * 
     * @param tile - the tile to be repositioned
     * @param newGridIndex - the targeted index position
     */
    private repositionTile(tile: Entity, newGridIndex:number)
    {
        const tileComp = tile.getComponent(SPTile);                                                 // get puzzle tile component
        const tileTransform = tile.getComponent(Transform);                                         // get entity transform component 

        const row: number = Math.floor(newGridIndex / this.puzzleShape.y);                          // calculate new row based on one-dimensional index
        const column: number = newGridIndex % this.puzzleShape.y;                                   // calculate new column based on one-dimensional index

        const newGridCurrent = new Vector2(row, column);                                            // new two-dimensional grid position
        const vec = newGridCurrent.subtract(tileComp.gridCurrent).multiplyInPlace(this.tileDist);   // calculate the resulting transformation vector 

        tileTransform.position.x += -vec.y;                                                         // add the resulting transformation vector component to the current transformation. Adding ensures that all offsets are keept. (-) because the grid axis is negative in comparison to the belonging world axis
        tileTransform.position.z += vec.x;                                                          // add the resulting transformation vector component to the current transformation. Adding ensures that all offsets are keept.

        tileComp.gridCurrent = newGridCurrent;                                                      // store the new position in the puzzle tile attributes
    }

    /**
     * Swaps two tiles and checks puzzle for completion. 
     * Movement of `t` is animated. Movement of `vt` is not animated.
     * 
     * @param t - tile, the tile whose movements are animated
     * @param vt - voidTile, the tile taht is repositioned without animation
     */
    private gameTurn(t: Entity, vt: Entity)
    {
        const tComp = t.getComponent(SPTile);                                                       // get puzzle tile component of the visible tile
        const vtComp = vt.getComponent(SPTile);                                                     // get puzzle tile component of the invisible tile

        let tOldPos = t.getComponent(Transform).position.clone();                                   // store old transformation of t in a new object before new transformation is applied.
        let tNewPos = vt.getComponent(Transform).position.clone();                                  // store old transformation of vt in a new object before new transformation is applied.  
            
        this.lockedInput = true;                                                                    // lock user inputs while a tile movement is processed
        t.addComponent(new utils.MoveTransformComponent(tOldPos, tNewPos, 0.2, () => {              // move the visible tile t with animation to the position of the invisible tile vt
            const tTemp = tComp.gridCurrent.clone();                                                // it is a swap therefore store the old grid position of t 
            tComp.gridCurrent = vtComp.gridCurrent.clone();                                         // the animation has finished therefore set the new gridCurrent to vt's gridCurrent 

            vt.getComponent(Transform).position = tOldPos;                                          // vt is still on its old position; no need to animate; set the old position of t as the new position
            vtComp.gridCurrent = tTemp;                                                             // positions were swapped update the gridCurrent of vt
            this.checkAndFinish();                                                                  // tiles were moved => therefore check puzzle for completion
            this.lockedInput = false;                                                               // tile movment has finished => user input is reactivated
        }, utils.InterpolationType.EASEINQUAD));
    }

    /**
     * Check puzzle for completion and finish the current game in case
     * every tile is on its origin position.
     * 
     * @return 
     * returns true in case the puzzle is complete
     */
    private checkAndFinish() : boolean
    {
        const voidTile = this.tiles[this.tileCnt - 1];                                              // tile that is removed (not visible) to enable movement of the remaining tiles 
        let result: boolean = false;                                                                // result of the completion check

        if (this.checkTilePosition(voidTile))                                                       // only check in case voidTile is in place
        {
            const uncheckedTiles: Entity[] = this.tiles.slice(0, this.tileCnt -2);                  // get all remaining tiles that still need to be checked 
            result = (uncheckedTiles.map(x => this.checkTilePosition(x))).every(x => x === true);   // check tile position all remaining tiles

            if(result)                                                                              // puzzle is completed
            {
                this.finish();                                                                      // invoke finish action
                this.voidTileVisibility(true);                                                      // reset the visibility of the voidTile
                this.isRunning = false;                                                             // finish the game by resetting the game state
            }
        }

        return result;
    }

    /**
     * Check tile position with the origin position.
     * 
     * @param tile - the tile that is checked
     * @return 
     * returns true in case the tile is placed on its origin.
     */
    private checkTilePosition(tile: Entity) : boolean
    {
        const tileComp = tile.getComponent(SPTile);                                                 // get the stored puzzle tile attributes
        return ((tileComp.gridCurrent.x === tileComp.gridOrigin.x) &&                               // check position
                (tileComp.gridCurrent.y === tileComp.gridOrigin.y));
    }

    /**
     * Shuffles array items in place. ES6 version
     * 
     * @param arr - an array containing the items.
    */
    private shuffle<T>(arr: T[]) : T[] 
    {
        for (let i = arr.length - 1; i > 0; i--) 
        {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Get a solvable randomized array containging the tile indices.
     * 
     * @remarks
     * randomizing the tiles is not always solvable. There is a 50% chance to get a solvable variation.
     * See https://mathworld.wolfram.com/15Puzzle.html
     * 
     * @return
     * solvable randomized array containging the tile indices.
    */
    private getShuffleArray() : number[] 
    {
        let isSolvable: boolean = false;                                                            
        
        if(this.fixedShuffleArr)                                                                    // use fixed shuffle array instead of randomized array in case a fixed shuffle array was provides 
            return this.fixedShuffleArr;
        
        const shuffleArr:number[] = Array(this.tileCnt);                                            // create a new empty array for the shuffled tile indices
        
        while(!isSolvable)                                                                          // reshuffle unitl a solvable shuffle array has been found
        {
            //shuffleArr = this.shuffle([...Object.keys(Array(this.tileCnt))]);                     // Array.keys() is currently not supported by decentraland
            for (let n: number = 0; n < this.tileCnt; n++) {                                        // fill the array with the origin indices
                shuffleArr[n] = n;
            }
            this.shuffle(shuffleArr);                                                               // shuffle the array items
            isSolvable = this.permutationProof(shuffleArr);                                         // do the solvability proof
        }
        return shuffleArr;                                                                          // return the solvable shuffled indices array
    }

    /**
     * Solvability proof for a randomized tile placement based on the indices array.
     * 
     * @remarks
     * randomizing the tiles is not always solvable. There is a 50% chance to get a solvable variation.
     * See http://kevingong.com/Math/SixteenPuzzle.html#proof
     * 
     * @return
     * true in case of valid solvability
    */
    private permutationProof(arr: number[]) : boolean 
    {
        const voidIndex: number = arr.length - 1;                                                   // index number of the void tile
        const permutationArr: number[] = Array(0);
        for (let n: number = 1; n < voidIndex; n++)                                                 // for the permutation proof the first index and last index are not relevant
        {
            const arrLen: number = ((arr.slice(0, arr.indexOf(n))).filter( i => i < n)).length;     // slice array; to contain the current index and all previous
                                                                                                    // filter for smaller values than the current index
                                                                                                    // calculate length => count the indices in the subarray that are smaller than the current index
            permutationArr.push(n - arrLen);                                                        // add permutation

        }
        const permutationSum: number = permutationArr.reduce((pv, cv) => pv+cv, 0);                 // calculate array sum
        const rowIndex: number = Math.floor(arr.indexOf(voidIndex) / this.puzzleShape.y);           // row index of the void tile
        const rowBottomCnt = this.puzzleShape.x - rowIndex;                                         // row count, counten from bottom, starts with 1

        
        if(this.puzzleShape.y % 2 === 1)                                                            // column count is odd
            return (permutationSum % 2 === 0);                                                      // solvable in case permutation proof is even
        else
            return ((permutationSum + rowBottomCnt) % 2 === 1);          
    }

    /**
     * Empty dummy function.
     * 
     * @remarks
     * used as default for game state specific actions 
     */
    private dummy(): void 
    {
        // may play a standard sound
    }
}



/**
 * Get Entity from OnPointer down 
 */
function entityFromClick(e: InputEventResult) : Entity | undefined
{
    if(e.hit)
        return engine.entities[e.hit.entityId] as Entity;
    return undefined;
}

/**
 * Get parent of an entity based on the iteration level
 * 
 * @remark iteration 2 => get parent of the current entities parent
 */
function getParent(ent: Entity, iteration: number) : IEntity | null | undefined
{
    if(iteration < 1)
        throw new Error("Parent iteration can not be less than 1")

    let curParent: IEntity |null | undefined = ent.getParent();
    for (let n: number = 1; n < iteration; n++)
        curParent = curParent?.getParent();
    return curParent;
}
