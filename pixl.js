const randomRGBA = () => `rgba(${new Array(3).fill().map(e=>Math.floor(Math.random()*255)).concat(1.0).join(",")})`;

//Canvas ID, incremented for image saving canvases
let cvsID=0;
//Global reference to canvas and context
let ctx;
let canvas;

let isLargeScreen=null;

let mini;
let miniC;
//-> WIDTH and HEIGHT have to be even multiple of NUM_ROWS & NUM_COLS
let WIDTH = 400;
let WIDTH_BASIS = 400; //px
let HEIGHT_BASIS = 400;
let HEIGHT = 400; //px
let PREVIEW_IMAGE_BASE = 128; //px
let PREVIEW_IMAGE_SCALE = 0.25;
// -> NUM_ROWS & NUM_COLS have to be even multiple of 16
const NUM_ROWS = 16; 
const NUM_COLS = 16;
let BOX_SIDE_LENGTH = WIDTH/NUM_ROWS;

//User selected color and swatch div
let currentColor='#AAEEBB';
let currentColorDiv=null;
//Default color and canvas data array
let DEFAULT_COLOR='#FFFFFF';
let canvasData = new Array(NUM_ROWS*NUM_COLS).fill(DEFAULT_COLOR);
//Flags
let mouseDown=false;
let mouseDownAt=null;
let clickAndDrag=true;
let DRAG_DELAY_MS=50; //ms before mouse "click-and-drag" event is handled
//Indices of squares to be updated
let dirtyIndices=[];

/* Generate color palette */
function generatePalette(startColor='goldenrod') {
    let lastC=tinycolor(startColor);
    let analogues=[];
    let temp=lastC.analogous();
    analogues.push(temp[temp.length-1]);
    for (var i=0;i<10;i++) {
        if (i%2==0) { temp=analogues[i].analogous(); }
        else { temp=analogues[i].tetrad(); }
        analogues.push(temp[temp.length-1].spin(Math.random()*20));
    }
    let res=analogues.map(e=>e.toHexString());
    return res;
}

function populatePalette() {
    let pals=generatePalette();
    const P=document.getElementById('palette');
    pals.forEach((c,idx)=>{
        let chip=document.createElement('div');
        chip.classList.add('chip');
        chip.id='c_'+idx;
        chip.dataset.hex=c;
        chip.style.backgroundColor=c;
        P.appendChild(chip);
    });
}

function randomizePalette() {
    let rColor=randomRGBA();
    let randos=generatePalette(rColor);
    const P=document.querySelectorAll('div.chip')
    P.forEach((c,idx)=>{
        c.dataset.hex=randos[idx];
        c.style.backgroundColor=randos[idx];
        c.classList.remove('activeColor');
    });
    setColor(document.getElementById('c_0')); //set default color;
}

function drawGrid() {
    ctx.lineWidth = 0.5;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(0.5, 0.5); //pad and decimal place
    for (var i=0;i<=NUM_COLS*BOX_SIDE_LENGTH;i+=BOX_SIDE_LENGTH) { //i = col
    //draw vertical line HEIGHT length, x=i
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, HEIGHT);
        ctx.stroke();
        ctx.closePath();
    //draw horizontal line WIDTH length, y=i
        ctx.beginPath();
        ctx.moveTo(0, i)
        ctx.lineTo(WIDTH, i)
        ctx.stroke();
        ctx.closePath();
    }
}

function idxToRowCol(idx) {
    let row=Math.floor(idx/NUM_ROWS);
    let col=idx%NUM_COLS;
    return {row, col};
}

function coordsToIdx(X, Y) {
    let col = Math.floor(X/BOX_SIDE_LENGTH);
    let row = Math.floor(Y/BOX_SIDE_LENGTH);
    return row*NUM_ROWS+col;
}

function setData(idx, color) {
    if (dirtyIndices.includes(idx)) { return false; }
    let currentColor=canvasData[idx];
    if (!clickAndDrag) {
        if (color!==currentColor) { canvasData[idx]=color;
        } else { canvasData[idx]=DEFAULT_COLOR; }
    } else { canvasData[idx]=color; }
    dirtyIndices.push(idx);
}

const isValidCol = (col) => col>=0&&col<=NUM_COLS-1;
const isValidRow = (row) => row>=0&&row<=NUM_ROWS-1;

function colorBox(box, color) {
    const { row, col } = box;
    if (!isValidCol(col)||!isValidRow(row)) { return false; }
    ctx.fillStyle=color || currentColor;
    // ctx.globalCompositeOperation = 'multiply';
    // ctx.clearRect(col*BOX_SIDE_LENGTH, row*BOX_SIDE_LENGTH, BOX_SIDE_LENGTH, BOX_SIDE_LENGTH);
    ctx.beginPath();
    ctx.fillRect(col*BOX_SIDE_LENGTH, row*BOX_SIDE_LENGTH, BOX_SIDE_LENGTH, BOX_SIDE_LENGTH);
    ctx.closePath();
    reOutline(row, col);
}

function reOutline(row, col) {
    ctx.lineWidth = 0.5;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(0.5, 0.5); //pad and decimal place
    //draw vertical line HEIGHT length, x=i
    ctx.beginPath();
    ctx.moveTo(col*BOX_SIDE_LENGTH, row*BOX_SIDE_LENGTH);
    ctx.lineTo(col*BOX_SIDE_LENGTH, (row+1)*BOX_SIDE_LENGTH);
    ctx.stroke();
    ctx.lineTo((col+1)*BOX_SIDE_LENGTH, (row+1)*BOX_SIDE_LENGTH);
    ctx.stroke();
    ctx.lineTo((col+1)*BOX_SIDE_LENGTH, row*BOX_SIDE_LENGTH);
    ctx.stroke();
    ctx.lineTo(col*BOX_SIDE_LENGTH, row*BOX_SIDE_LENGTH);
    ctx.stroke();
    ctx.closePath();
}

function setColor(div) {
    currentColor=div.dataset.hex;
    currentColorDiv=div;
    div.classList.add('activeColor');
}

function switchColor(e) {
    let cL=e.target.classList;
    if (!cL.contains('chip')||cL.contains('activeColor')) { return false; }
    currentColorDiv.classList.remove('activeColor');
    setColor(e.target);
}

function changeColorSwatch(e) { 
    currentColor='#'+e.target.value; 
    currentColorDiv.classList.remove('activeColor');
}

/* Save Image */
function grabCanvas(width, transparent, bgColor, data) {
    cvsID++;
    let blit=document.createElement('canvas');
    blit.height=width; //px
    blit.width=blit.height;
    blit.classList.add('c-preview');
    blit.id='cvs_'+cvsID;
    let blitCtx=blit.getContext('2d');
    const cellDim=Math.ceil(width/NUM_COLS);
    
    function colorScaledBox(box, color) {
        const { row, col } = box;
        if (!isValidCol(col)||!isValidRow(row)) { return false; }
        blitCtx.fillStyle=color || currentColor;
        blitCtx.clearRect(col*cellDim, row*cellDim, cellDim, cellDim);
        blitCtx.beginPath();
        blitCtx.fillRect(col*cellDim, row*cellDim, cellDim, cellDim);
        blitCtx.closePath();
    }

    for (var i=0;i<data.length;i++) {
        let row=Math.floor(i/NUM_ROWS);
        let col=i%NUM_COLS;
        let color=data[i];
        if (transparent) {
            if (color===DEFAULT_COLOR) {
                colorScaledBox({row, col}, 'rgba(255,255,255,0)');
            } else { colorScaledBox({row, col}, color); }
        } else {
            if (color===DEFAULT_COLOR) {
                colorScaledBox({row, col}, bgColor);
            } else { colorScaledBox({row, col}, color); }
        }
    }
    return blit;
}

function getUserImageParameters(e) {
    e.preventDefault();
    let W=document.querySelector('select#pxWidth').value;
    let T=document.querySelector('input#transparent').checked;
    let BG='#'+document.querySelector('input#bgColor').value;
    let tray=document.getElementById('imageTray');
    const canvas=grabCanvas(W, T, BG, canvasData)
    let a = document.createElement('a');
    a.id='a_'+cvsID;
    a.appendChild(canvas);
    tray.prepend(canvas);
    tray.scrollLeft=0;
}

function handleSavedImageClick(e) {
    if (!e.target.classList.contains('c-preview')) { return false; }
    const canvasID='cvs_'+e.target.id.split('_')[1];
    let name=window.prompt('enter a save name');
    if (!name) { return false; }
    var saveCanvas=document.getElementById(canvasID);
    var link = document.createElement('a');
    document.body.appendChild(link);
    link.download=name+".png";
    link.href = saveCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");;
    link.click();
    document.body.removeChild(link);
}

function forceRedraw() { dirtyIndices=canvasData.map((e,idx)=>idx); }

/* Reset canvas: mark all as dirty */
function resetCanvas() {
    canvasData=canvasData.map(e=>DEFAULT_COLOR);
    dirtyIndices=canvasData.map((e,idx)=>idx);
}

/* Event Handlers and Listeners */
function handleClick(e) {
    let X=e.offsetX;
    let Y=e.offsetY;
    if ((X>=WIDTH||X<=0)||(Y>=HEIGHT||Y<=0)) { return false; }
    setData(coordsToIdx(X, Y), currentColor);
}

function handleMouseMove(e) {
    if (!mouseDown) { return false; }
    if ((Date.now()-mouseDownAt)>DRAG_DELAY_MS){
        let X=e.offsetX;
        let Y=e.offsetY;
        clickAndDrag=true;
        if ((X>=WIDTH||X<=0)||(Y>=HEIGHT||Y<=0)) { return false; }
        else { setData(coordsToIdx(X, Y), currentColor); }
    }
}

function handleMouseDown(e) {
    mouseDown=true;
    mouseDownAt=Date.now();
}

function handleMouseUp(e) {
    if (clickAndDrag) { 
        let X=e.offsetX;
        let Y=e.offsetY;
        if ((X>=WIDTH||X<=0)||(Y>=HEIGHT||Y<=0)) { return false; }
        setData(coordsToIdx(X, Y), currentColor); 
    }
    mouseDown=false;
    mouseDownAt=null;
    clickAndDrag=false;
}

function updateBackgroundColor(e) {
    let T=document.querySelector('input#transparent');
    T.checked=false;
}

function saveImage(e) {
    let saved=localStorage.getItem('pixl');
    if (!saved) { //initialize save object
        let saveObj=JSON.stringify({
            images: [canvasData]
        });
        localStorage.setItem('pixl', saveObj);
    } else { //retrieve image array and place new image at the front
        saved=JSON.parse(saved);
        let newImages=saved.images.slice();
        newImages.push(canvasData);
        let saveObj=Object.assign({}, saved, {images:newImages});
        localStorage.setItem('pixl', JSON.stringify(saveObj));
    }
    loadImages();
}

function handleSavedPaneClick(e) {
    if (e.target.classList.contains('c-preview')) { selectImage(e); }
    if (e.target.classList.contains('close')) {
        let imgIdx=Number(e.target.id.split("_")[1]);
        deleteImageByIdx(imgIdx);
        let savedPane=document.getElementById('savedImages');
        let closing=document.getElementById('container_close_'+imgIdx);
        savedPane.removeChild(closing);
        loadImages();
    }
}

function selectImage(e) {
    let saved=localStorage.getItem('pixl');
    if (!saved) { return false; }
    saved=JSON.parse(saved);
    let savedIdx=e.target.id.split("_")[1];
    canvasData=saved.images[savedIdx];
    forceRedraw();
    //close saved images pane
    document.getElementById('savedImages').style.display='none';
}

function deleteImageByIdx(imgIdx) {    
    //remove image from localStorage
    let saved=localStorage.getItem('pixl');
    if (!saved) { return false; }
    saved=JSON.parse(saved);
    let filtered=saved.images.filter((e,idx)=>idx!==imgIdx);
    let saveObj=Object.assign({}, filtered, {images:filtered});
    localStorage.setItem('pixl', JSON.stringify(saveObj));
}

function loadImages(e) {
    let sI=document.getElementById('savedImages');
    let saved=localStorage.getItem('pixl');
    if (!saved) { 
        sI.style.display='none';
        return false; 
    }
    loadedImages=JSON.parse(saved);
    sI.innerHTML='';
    loadedImages.images.map((img,idx)=>{
        let blitContainer=document.createElement('div');
        blitContainer.id='container_close_'+idx;
        blitContainer.classList.add('blit-container');
        let closeBox=document.createElement('div');
        closeBox.id='close_'+idx;
        closeBox.classList.add('close');
        blitContainer.appendChild(closeBox);
        let canvas=grabCanvas(PREVIEW_IMAGE_SCALE*128, true, null, img);
        canvas.id='close_'+idx;
        blitContainer.appendChild(canvas);
        sI.prepend(blitContainer);
    });
    sI.addEventListener('click', handleSavedPaneClick);
    sI.style.display='flex';
    sI.scrollLeft=0;
    sI.scrollTop=0;
}

function addListeners() {
    document.getElementById('imageTray').addEventListener('click', handleSavedImageClick);
    document.getElementById('getImage').addEventListener('click', getUserImageParameters);
    document.getElementById('bgColor').addEventListener('change', updateBackgroundColor);
    document.getElementById('swatch').addEventListener('change', changeColorSwatch);
    document.querySelector('button#randomPalette').addEventListener('click', randomizePalette);
    document.querySelector('button#reset').addEventListener('click', resetCanvas);
    document.getElementById('palette').addEventListener('click', switchColor);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.getElementById('saveImage').addEventListener('click', saveImage);
    document.getElementById('loadImages').addEventListener('click', loadImages);
}
/* ^^ Event Handlers & Listeners */

//main drawing loop
function drawData() {
    for (var i=0;i<dirtyIndices.length;i++) {
        let color=canvasData[dirtyIndices[i]];
        colorBox(idxToRowCol(dirtyIndices[i]), color);
    }
    dirtyIndices=[];
    requestAnimationFrame(drawData);
}

function getCanvasAndContext() {
    canvas = document.getElementById('editor');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    BOX_SIDE_LENGTH=WIDTH/NUM_ROWS;
    canvas.width=NUM_COLS*BOX_SIDE_LENGTH+1; //+1 to display border
    canvas.height=NUM_ROWS*BOX_SIDE_LENGTH+1;
    let container=document.getElementById('canvas')
    container.width=canvas.width;
    container.height=canvas.height;
}

function initEditor() {
    getCanvasAndContext();
    resetCanvas();
    addListeners();
    populatePalette();
    setColor(document.getElementById('c_0')); //set default color;
}

function redrawAtScale(n) { //scales components of screen to factor N and redraws
    WIDTH=n*WIDTH_BASIS;
    HEIGHT=n*HEIGHT_BASIS;
    PREVIEW_IMAGE_SCALE=n;
    getCanvasAndContext();
    loadImages();
    forceRedraw();
}

window.onload = function() {
    initEditor();
    drawData();

    var bigWindow = window.matchMedia("(min-width: 700px)"); // Create the query list.
    function handleOrientationChange(mql) { 
        isLargeScreen = mql.matches ? true : false;
        if (!isLargeScreen) { //transition to small screen
            redrawAtScale(0.8);  
        } else { //transition to large screen
        redrawAtScale(1);
        }
    } 
    bigWindow.addListener(handleOrientationChange); // Add the callback function as a listener to the query list.
    handleOrientationChange(bigWindow); // Run the orientation change handler once.
}