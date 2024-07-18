console.log("viewport");


window.addEventListener('load',function(){
  //setViewport();
  function setViewport(){
      let fontsize = "15px";
      if(window.innerWidth > 800) {
        var vw = window.innerWidth/100;
        var vh = window.innerHeight/100;
        if(vw/vh > 18/9) {
          fontsize = (vw * 1.14) + "px";
        } else {
          fontsize = (vh * 2.5) + "px";
        }
        console.log("vh is " + vh);
        // set it to 15 if less than 800
      }
      document.getElementById('really').style.fontSize = fontsize;
  }
  
  window.addEventListener('resize',function(){
        //when the browser window is resized; recalculate
        //setViewport();
  });
});