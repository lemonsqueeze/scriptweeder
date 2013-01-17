// ==UserScript==
// @description Disable javascript just on google search
// @include        http://www.google.*/webhp?*
// @include        http://www.google.*/search?*
// @include        http://www.google.*/ig?*
// @include        http://www.google.*/
// @include        http://www.google.*/#*
// @include        https://www.google.*/webhp?*
// @include        https://www.google.*/search?*
// @include        https://www.google.*/ig?*
// @include        https://www.google.*/
// @include        https://www.google.*/#*
// @include        https://encrypted.google.*/webhp?*
// @include        https://encrypted.google.*/search?*
// @include        https://encrypted.google.*/ig?*
// @include        https://encrypted.google.*/
// @include        https://encrypted.google.*/#*
// ==/UserScript==

(function() {
    
    function handle_noscript_tags()
    {
	for (var j = document.getElementsByTagName('noscript'); j[0];
	     j = document.getElementsByTagName('noscript')) 
	{
	    var nstag = document.createElement('wasnoscript');
	    nstag.innerHTML = j[0].innerText;	    
	    j[0].parentNode.replaceChild(nstag, j[0]);
	}
    }

    function beforeextscript_handler(e)
    {
	e.preventDefault();
    }

    // Handler for both inline *and* external scripts
    function beforescript_handler(e)
    {
      if (e.element.src) // external script
	  return;
      e.preventDefault();
    }    

    // block inline scripts
    window.opera.addEventListener('BeforeScript',	  beforescript_handler, false);
    
    // block external scripts (won't even download)
    window.opera.addEventListener('BeforeExternalScript', beforeextscript_handler, false);
    
    // use this one if you want <noscript> tags interpreted as if javascript was disabled in opera.
    document.addEventListener('DOMContentLoaded',  handle_noscript_tags, false);

})();
