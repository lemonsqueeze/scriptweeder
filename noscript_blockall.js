(function() {
  
  opera.addEventListener('BeforeExternalScript',
  function(e) {
        if (e.element.tagName != 'SCRIPT') {
            return
        }
	
	e.preventDefault();
    },
    false);

})()
