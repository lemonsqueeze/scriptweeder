// ==UserScript==
// @name google_nojs
// @author lemonsqueeze https://github.com/lemonsqueeze/jsarmor
// @version 1.0
// @description Disable javascript just on google search.
// @published 2013-01-09 11:00
// ==/UserScript==

(function() {
    
    var h = location.hostname;
    if (!(is_prefix("www.google.", h) ||
	  is_prefix("encrypted.google.", h)))
	return;
    
    var p = location.pathname;
    if (!(p == "/" ||
	  p == "/webhp" ||
	  p == "/search" ||	  
	  p == "/ig"))
	return;
    
    // alert("google_nojs.js:\n\nblocking javascript.");

    function is_prefix(p, str)
    {
	return (str.slice(0, p.length) == p);
    }
    
    function handle_noscript_tags()
    {
	// interpret <noscript> tags as if javascript was disabled in opera	    
	
	for (var j = document.getElementsByTagName('noscript'); j[0];
	     j = document.getElementsByTagName('noscript')) 
	{
	    var nstag = document.createElement('wasnoscript');
	    nstag.innerHTML = j[0].innerText;
	    
	    j[0].parentNode.replaceChild(nstag, j[0]);
	    // once reparenting is done, we have to get tags again
	    // otherwise it misses some. weird ...		
	}
    }

    function beforeextscript_handler(e)
    {
        if (e.element.tagName.toLowerCase() != 'script')
	{
	  alert("google_nojs.user.js: BeforeExternalScript: non <script>: " + e.element.tagName);
	  return;
        }
	
	e.preventDefault();
    }

    // Handler for both inline *and* external scripts
    function beforescript_handler(e)
    {
      if (e.element.src) // external script
	  return;
      
      e.preventDefault();
    }    

    window.opera.addEventListener('BeforeScript',	  beforescript_handler, false);
    window.opera.addEventListener('BeforeExternalScript', beforeextscript_handler, false);
    document.addEventListener('DOMContentLoaded',  handle_noscript_tags, false);

})();

