// Block listeners set on page elements.
// To block all page listeners, page scripts should be blocked otherwise
// they can window.addEventListener() and these won't be blocked.

(function()
{
    function handler(event)
    {
        var e = event.event;
        var name = 'on' + e.type; // onload, onclick etc
	
        [ e.currentTarget, e.target ].forEach(function(n)
        {
            if (n && event.listener == n[name]) // click listener == element.onclick etc
            {
                event.preventDefault();
                n[name] = null;         // don't bother us again.
            }
        });
    }
    
    window.opera.addEventListener('BeforeEventListener', handler, false);

}());
