(function() {
  /**
   * Check and set a global guard variable.
   * If this content script is injected into the same page again,
   * it will do nothing next time.
   */
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;
  var drawObj = new Object();
  var drawSelection = null;
  var baseElement = null;
	var appIsOn = false;

  function init(){
    console.log("init");
    baseElement = document.createElement('div');
		baseElement.setAttribute("id", "base");
			
		baseElement.addEventListener("mousedown", drawStart, true);	
		document.body.appendChild(baseElement);
		
  }
  
	function drawStart(event){
		drawObj.startPosX = event.clientX;
		drawObj.startPosY = event.clientY;
		//event.preventDefault();
		
		if (drawSelection === "retracement"){
			var tempElement = document.createElement('div');
			tempElement.setAttribute("id", "retracement");
			baseElement.appendChild(tempElement);
			
			drawObj.element = tempElement;
		}
		if (drawSelection === "line"){		
			var	linebase = document.createElement('div');
			linebase.setAttribute("id", "linebase");
			var lineElement = document.createElement('div');
			lineElement.setAttribute("id", "line");
			var circleElement = document.createElement('div');
			circleElement.setAttribute("id", "linecircle");
			
			linebase.appendChild(circleElement);
			linebase.appendChild(lineElement);
			baseElement.appendChild(linebase);
			
			drawObj.element = lineElement;
			drawObj.circleElement = circleElement;
		}
		if (drawSelection === "arcs"){
			var arcsBaseElement = document.createElement('div');
			arcsBaseElement.setAttribute("id", "arcs");
			var circleBaseElement = document.createElement('div');
			circleBaseElement.setAttribute("id", "circlebase");
			var arcsone = document.createElement('div');
			arcsone.setAttribute("id", "circle1");
			var arcstwo = document.createElement('div');
			arcstwo.setAttribute("id", "circle2");
			var arcsthree = document.createElement('div');
			arcsthree.setAttribute("id", "circle3");
			var arcslineElement = document.createElement('div');
			arcslineElement.setAttribute("id", "arcsline");			
			circleBaseElement.appendChild(arcsone);
			circleBaseElement.appendChild(arcstwo);
			circleBaseElement.appendChild(arcsthree);
			arcsBaseElement.appendChild(circleBaseElement);
			baseElement.appendChild(arcslineElement);
			baseElement.appendChild(arcsBaseElement);
			
			drawObj.element = arcsBaseElement;
			drawObj.elementLine = arcslineElement;
		}
		if (drawSelection === "channel"){
			var	channelbase = document.createElement('div');
			channelbase.setAttribute("id", "channelbase");
			var lineElement = document.createElement('div');
			lineElement.setAttribute("id", "channelLine");
			var lineTwoElement = document.createElement('div');
			lineTwoElement.setAttribute("id", "secondChannelline");
			var secondCircleElement = document.createElement('div');
			secondCircleElement.setAttribute("id", "secondChannelCircle");
			var circleElement = document.createElement('div');
			circleElement.setAttribute("id", "channelcircle");
			
			channelbase.appendChild(circleElement);
			channelbase.appendChild(secondCircleElement);
			channelbase.appendChild(lineElement);
			channelbase.appendChild(lineTwoElement);
			baseElement.appendChild(channelbase);
			
			drawObj.element = lineElement;
			drawObj.firstCircleElement = circleElement;
			drawObj.secondChannelline = lineTwoElement;
			drawObj.secondCircleElement = secondCircleElement;
		}
    drawObj.element.style.left = drawObj.startPosX + "px";
		drawObj.element.style.top = drawObj.startPosY + "px";
		baseElement.addEventListener("mousemove", draw, true);
		baseElement.addEventListener("mouseup", drawStop, true);
	}
  
  function draw(event) {
		var currentPosX = event.clientX;
		var currentPosY = event.clientY;
		//event.preventDefault();
		if (drawSelection === "retracement") {
			var width = calculateWidth(currentPosX, drawObj.startPosX);
			var left = calculateLeft(currentPosX, drawObj.startPosX);
			var height = calculateHeight(currentPosY, drawObj.startPosY);
			var top = calculateTop(currentPosY, drawObj.startPosY, height);

			drawObj.element.style.left = left + "px";
			drawObj.element.style.top = top + "px";
			drawObj.element.style.width = width + "px";
			drawObj.element.style.height = height + "px";
		}
		if (drawSelection === "line") {
			var length = calculateLineLength(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var angle = calculateAngle(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var transform = 'rotate(' + angle + 'deg)';

			drawObj.element.style.transform = transform;
			drawObj.element.style.width = length + "px";
			
			var circleleft = calculateLeft(currentPosX-20, currentPosX);
			var circleTop = calculateTop(currentPosY-20, currentPosY, 20);
								
			drawObj.circleElement.style.left = circleleft + "px";
			drawObj.circleElement.style.top = circleTop + "px";
		}
		if (drawSelection === "arcs") {
			var length = calculateLineLength(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var angle = calculateAngle(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var transform = 'rotate(' + angle + 'deg)';

			drawObj.elementLine.style.transform = transform;
			drawObj.elementLine.style.width = length + "px";
			drawObj.elementLine.style.left = drawObj.startPosX + "px";
			drawObj.elementLine.style.top = drawObj.startPosY + "px";
			
			var centerX = calculateCircleCenterX(currentPosX, drawObj.startPosX, length);
			var centerY = calculateCircleCenterY(currentPosY, drawObj.startPosY, length);

			drawObj.element.style.width = length + "px";
			drawObj.element.style.height = length + "px";
			drawObj.element.style.left = centerX + "px";
			drawObj.element.style.top = centerY + "px";
		}
		if (drawSelection === "channel") {
			//this draws the first line
			var length = calculateLineLength(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var angle = calculateAngle(currentPosX, currentPosY, drawObj.startPosX, drawObj.startPosY);
			var transform = 'rotate(' + angle + 'deg)';
			drawObj.element.style.transform = transform;
			drawObj.element.style.width = length + "px";
			
			//this draws the first circle
			var circleleft = calculateLeft(currentPosX-15, currentPosX);
			var circleTop = calculateTop(currentPosY-15, currentPosY, 15);								
			drawObj.firstCircleElement.style.left = circleleft + "px";
			drawObj.firstCircleElement.style.top = circleTop + "px";
			
			//This draws the second line
			drawObj.secondChannelline.style.transform = transform;
			drawObj.secondChannelline.style.width = length + "px";
			drawObj.secondChannelline.style.left = drawObj.startPosX + "px";
			drawObj.secondChannelline.style.top = drawObj.startPosY+30 + "px";
			drawObj.secondChannelline.style.display = "none";
					
			//This draws the second circle
			var secondCircleleft = calculateLeft(currentPosX-15, currentPosX);
			var secondCircleTop = calculateTop(currentPosY-15, currentPosY, 15);			
			drawObj.secondCircleElement.style.left = secondCircleleft + "px";
			drawObj.secondCircleElement.style.top = secondCircleTop+30 + "px";
			drawObj.secondCircleElement.style.display = "none";
		}
}

  function drawStop(event) {
		console.log("drawStop");
		baseElement.removeEventListener("mousemove", draw, true);
		baseElement.removeEventListener("mouseup", drawStop, true);
		baseElement.removeEventListener("mousedown", drawStart, true);
		if (drawSelection === "channel") {
			drawObj.secondChannelline.style.display="initial";
			drawObj.secondCircleElement.style.display="initial";
			drawObj.firstCircleElement.addEventListener("mousedown", dragStart, true);
			drawObj.secondCircleElement.addEventListener("mousedown", dragStart, true);
		} else if (drawSelection === "line") {
      drawObj.circleElement.addEventListener("mousedown", dragStart, true);
		} else
		  drawObj.element.addEventListener("mousedown", dragStart, true);
	}

	function dragStart(event) {
		console.log("dragstart");
		drawObj.dragId = event.currentTarget.id;
		drawObj.element = document.getElementById(drawObj.dragId);
		drawObj.startPointX = event.clientX;
		drawObj.startPointY = event.clientY;

		if (event.target.id === "retracement") {
			drawObj.elStartLeft = parseInt(drawObj.element.style.left, 10);
			drawObj.elStartTop = parseInt(drawObj.element.style.top, 10);
			drawObj.elStartWidth = parseInt(drawObj.element.style.width, 10);
			drawObj.elStartHeight = parseInt(drawObj.element.style.height, 10);
		}
		if (event.target.id === "linecircle") {			
			drawObj.elStartLeft = parseInt(drawObj.element.style.left, 10);
			drawObj.elStartTop = parseInt(drawObj.element.style.top, 10);
			drawObj.line = document.getElementById("line");
			drawObj.lineStartLeft = parseInt(drawObj.line.style.left, 10);
			drawObj.lineStartTop = parseInt(drawObj.line.style.top, 10);
		}
		if (drawObj.dragId == "channelcircle") {
			drawObj.elStartLeft = parseInt(drawObj.element.style.left, 10);
			drawObj.elStartTop = parseInt(drawObj.element.style.top, 10);
			drawObj.line = document.getElementById("channelLine");
			drawObj.lineStartLeft = parseInt(drawObj.line.style.left, 10);
			drawObj.lineStartTop = parseInt(drawObj.line.style.top, 10);
			drawObj.secondline = document.getElementById("secondChannelline");
			drawObj.secondlineStartLeft = parseInt(drawObj.secondline.style.left, 10);
			drawObj.secondlineStartTop = parseInt(drawObj.secondline.style.top, 10);
			drawObj.secondCircle = document.getElementById("secondChannelCircle");
			drawObj.secondCircleLeft = parseInt(drawObj.secondCircle.style.left, 10);
			drawObj.secondCircleTop = parseInt(drawObj.secondCircle.style.top, 10);
		}
		if (drawObj.dragId == "secondChannelCircle") {
			drawObj.elStartTop = parseInt(drawObj.element.style.top, 10);
			drawObj.line = document.getElementById("secondChannelline");
			drawObj.lineStartTop = parseInt(drawObj.line.style.top, 10);
		}
		document.addEventListener("mousemove", dragGo, true);
		document.addEventListener("mouseup", dragStop, true);
	}

	function dragGo(event) {

		console.log("target:"+drawObj.dragId);
		var newPosX = event.clientX;
		var newPosY = event.clientY;
		//event.preventDefault();
		if (drawObj.dragId == "retracement") {
			drawObj.element.style.left = (drawObj.elStartLeft + newPosX - drawObj.startPointX) + "px";
			drawObj.element.style.top = (drawObj.elStartTop + newPosY - drawObj.startPointY) + "px";
			drawObj.element.style.width = drawObj.elStartWidth + "px";
			drawObj.element.style.height = drawObj.elStartHeight + "px";
		}
		if (drawObj.dragId == "linecircle") {
			//this moves circle
			drawObj.element.style.left = (drawObj.elStartLeft + newPosX - drawObj.startPointX) + "px";
			drawObj.element.style.top = (drawObj.elStartTop + newPosY - drawObj.startPointY) + "px";
			//this moves the line
			var angle = calculateAngle(newPosX, newPosY, drawObj.lineStartLeft, drawObj.lineStartTop);
			var length = calculateLineLength(newPosX, newPosY, drawObj.lineStartLeft, drawObj.lineStartTop);
			var transform = 'rotate(' + angle + 'deg)';

			drawObj.line.style.transform = transform;
			drawObj.line.style.width = length + "px";					
		}
		if (drawObj.dragId == "channelcircle") {
			//this moves the circles
			drawObj.element.style.left = (drawObj.elStartLeft + newPosX - drawObj.startPointX) + "px";
			drawObj.element.style.top = (drawObj.elStartTop + newPosY - drawObj.startPointY) + "px";
			drawObj.secondCircle.style.left = (drawObj.secondCircleLeft + newPosX - drawObj.startPointX) + "px";
			drawObj.secondCircle.style.top = (drawObj.secondCircleTop + newPosY - drawObj.startPointY) + "px";
			
			//this moves the lines
			var angle = calculateAngle(newPosX, newPosY, drawObj.lineStartLeft, drawObj.lineStartTop);
			var length = calculateLineLength(newPosX, newPosY, drawObj.lineStartLeft, drawObj.lineStartTop);
			var transform = 'rotate(' + angle + 'deg)';
			drawObj.line.style.transform = transform;
			drawObj.line.style.width = length + "px";
			
			var circleDistance = drawObj.secondCircleTop - drawObj.elStartTop;
			var secondangle = calculateAngle(newPosX, newPosY+circleDistance, drawObj.secondlineStartLeft, drawObj.secondlineStartTop);
			var secondlength = calculateLineLength(newPosX, newPosY+circleDistance, drawObj.secondlineStartLeft, drawObj.secondlineStartTop);
			var secondtransform = 'rotate(' + secondangle + 'deg)';			
			drawObj.secondline.style.transform = secondtransform;
			drawObj.secondline.style.width = secondlength + "px";
		}
		if (drawObj.dragId == "secondChannelCircle") {
			drawObj.element.style.top = (drawObj.elStartTop + newPosY - drawObj.startPointY) + "px";			
			drawObj.line.style.top = (drawObj.lineStartTop + newPosY - drawObj.startPointY) + "px";
		}
	}
	
	function dragStop(event) {
		document.removeEventListener("mousemove", dragGo, true);
		document.removeEventListener("mouseup", dragStop, true);
		//drawObj.element.removeEventListener("mousedown", dragStart, true);
	}

	function close(){
		console.log("closing baseElement");
	  try {
			document.body.removeChild(document.getElementById("base"));
		} catch (e) {
			console.log("baseElement was already dead");
		}
		baseElement = null;
		drawObj = new Object();
	}

	function calculateCircleCenterX(currentPosX, startPosX, halflength) {
    return currentPosX - halflength;
	}

	function calculateCircleCenterY(currentPosY, startPosY, halflength) {
			return (currentPosY - halflength);
	}

	function calculateAngle(currentPosX, currentPosY, startPosX, startPosY) {
			return Math.atan2(currentPosY - startPosY, currentPosX - startPosX) * 180 / Math.PI;
	}

	function calculateLineLength(currentPosX, currentPosY, startPosX, startPosY) {
			return Math.sqrt((startPosX - currentPosX) * (startPosX - currentPosX) + (startPosY - currentPosY) * (startPosY - currentPosY));
	}

	function calculateHeight(currentPosY, startPosY) {
			var temp;
			if (startPosY > currentPosY) {
					temp = (startPosY - currentPosY);
			} else {
					temp = (currentPosY - startPosY);
			}
			return temp;
	}

	function calculateTop(currentPosY, startPosY, height) {
			var temp;
			if (startPosY > currentPosY) {
					temp = startPosY - height - 1;
			} else {
					temp = currentPosY - height - 1;
			}
			return temp;
	}

	function calculateLeft(currentPosX, startPosX) {
			var temp;
			if (startPosX > currentPosX) {
					temp = currentPosX;
			} else {
					temp = startPosX;
			}
			return temp;
	}

	function calculateWidth(currentPosX, startPosX) {
			var temp;
			if (startPosX > currentPosX) {
					temp = (startPosX - currentPosX);
			} else {
					temp = (currentPosX - startPosX);
			}
			return temp;
	}


  browser.runtime.onMessage.addListener((message) => {
    console.log("Message.command on content-script: "+message.command);
    drawSelection = message.command;
		if (appIsOn) {
		    close();
				appIsOn = false;
		}

    if (drawSelection === "retracement" || drawSelection === "line" 
		       || drawSelection === "arcs" || drawSelection === "channel") {
		    init();
				appIsOn = true;
		}
		else {
			//reset
		  close();
      appIsOn = false;
		}

  });

  
})();