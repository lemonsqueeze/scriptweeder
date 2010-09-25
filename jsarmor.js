(function() {
    var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc.
    var blocksitescripts=false;
    
    function createCookie(name, value, days, a_d, y) {
// only calls with y='g'
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        }
        else var expires = "";
        document.cookie = name + "=" + value + (a_d ? ' ' + a_d: '') + expires + "; path=/";
    }

    function readCookie(name, y) {
// only calls with y='g'
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return '';
    }

    // block_all, allow_current_domain, allow_all    
    var mode = readCookie('noscript_mode', 'g');
    if (mode == '') { mode = 'block_all'; }

    function eraseCookie(name) {
        createCookie(name, "", -1);
    }

    function f(x, y, z) {
        var r = (x.innerText.indexOf('#X# -') == 0);
        if (!r && y == 'X')
        {
            x.innerText = '#X# -' + x.innerText;
        }
        else if (r && !y)
        {
            x.innerText = x.innerText.substr(5);
        }
        if (z) {
            return x
        }
    }

    function cus() {
        var b = document.getElementById('noscriptselect');
        var zi = (event.ctrlKey || this.value == 'Server') ? b[b.selectedIndex].getAttribute('title') : (event.shiftKey || this.value == 'All') ? '': b.value;

        var h = readCookie('noscript', 'g') ? readCookie('noscript', 'g') : '';
        if (document.getElementById('nelbb').value == 'Block')
        {
	  // block server
	  for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
	    if (zi.indexOf(x.title) != -1) {
	      f(x, 'X');
	    }
	  }
	  h = h.replace(zi, '');
	  createCookie('noscript', h, (h == '' ? -1: 365), null, 'g');
        }
        else
	{
	  for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
	    if (zi.indexOf(x.title) != -1) {
	      f(x);
	    }
	  }
	  createCookie('noscript', zi, 365, h, 'g');
	}
        tog();
    }


    function myXOR(a,b) {
	  return ( a || b ) && !( a && b );
    }

    function get_domain(h) {
      var i = h.lastIndexOf(".");
      var j = h.lastIndexOf(".", i-1);
      if (j != -1)
	{ return h.slice(j+1); }
      else
	{ return h; }
    }

    function tog() {
        var a = document.getElementById('nelbb');
        var b = document.getElementById('noscriptselect');
        if (b[b.selectedIndex].innerText.indexOf('#X# -') == 0)
        { a.value = 'Unblock'; }
        else
        { a.value = 'Block'; }
    }

    var current_domain = get_domain(location.hostname);
    
    function should_allow(scr_domain) {
      var v = readCookie('noscript', 'g');
      if (mode == 'block_all') { return false; }
      if (mode == 'allow_current_domain') {
	return ((scr_domain == current_domain) ||
		(v && v.indexOf(scr_domain) != -1));
      }
      if (mode == 'allow_all') { return true; }
      alert('should not be reached!');
    }

    function set_icon_style(img) {
      var icon;      
      if (mode == 'block_all') {
	// icon = "Blocked";
	// icon = "High Assurance Security Button Skin";
	icon = "Smiley Tongue";
      }      
      if (mode == 'allow_current_domain') {
//	icon = "Feed Mark as read";
	icon = "Smiley Cool";
      }
//      { icon = "Panel Links"; }
      if (mode == 'allow_all') {
	// icon = "No Security";
	icon = "Smiley Cry";
      }

      img.style = "width:22px;height:22px;background:-o-skin('" + icon + "');display:inline-block;";
      // r.style = "background:-o-skin('" + icon + "');display:inline-block;";
    }

    var scI = 0;
    var scA = [];

    var blocked_current_domain = 0;
    var total_current_domain = 0;
    var blocked_external = 0;
    var total_external = 0;
    
    opera.addEventListener('BeforeExternalScript',
    function(e) {
        if (e.element.tagName != 'SCRIPT') {
	  alert("non 'SCRIPT' tagname: " + e.element.tagName);
	  return;
        }
        var x = e.element.src;

        var t = document.createElement('a');
        t.href = x;
        var scE = get_domain(t.hostname);
        scIi = scI + 's';
        var scIil = document.createElement('option');
        scIil.value = scI + 's';
        scIil.innerText = x;
        scIil.setAttribute('title', scE);
        if ((location.hash=='#nsoff' || window.name.match(/ nsoff/)))
	{ return; }

	var allowed = should_allow(scE);
	
	if (get_domain(scE) == current_domain) {
	  total_current_domain++;
	  if (!allowed) { blocked_current_domain++; }
	} else {
	  total_external++;
	  if (!allowed) { blocked_external++; }
	}
	
        if (allowed)
        { scA.push(scIil); }
        else {
	  e.preventDefault();
	  scA.push(f(scIil, 'X', 'h'));
        }
        scI++;
    },
    false);
    
    document.addEventListener('DOMContentLoaded',
    function() {
        if (!scA.length) {
            return
        }
        var scIele = document.createElement('cusnoiframe');
        scIele.style = 'position:fixed;' + (cornerposition < 3 ? 'top': 'bottom') + ':1px;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px;width:auto;height:auto;background:-o-skin("Browser Window Skin");white-space:nowrap;z-index:9999;direction:ltr;';
        var scIui = document.createElement('noifui');
        scIui.id = 'noiframeui';
        scIui.style.display = 'none';
        //scIui.appendChild(document.createElement('br'));
        var scIop = document.createElement('select');
        scIop.onchange = tog;
        scIop.id = "noscriptselect";
        scIop.style = 'width:300px !important;';
        for (var i = scA.length - 1; i > -1; i--)
        {
            scIop.appendChild(scA[i]);
        }
        if (scIop.innerHTML == '') {
            scIop.disabled = true;
        }
        scIui.appendChild(scIop);
        var scIbut0 = document.createElement('input');
        scIbut0.type = 'button';
        scIbut0.id = 'nelbb';
        scIbut0.value = 'Block';
        scIbut0.onclick = cus;
        scIui.appendChild(scIbut0);
        var scIbut1 = document.createElement('input');
        scIbut1.type = 'button';
        scIbut1.value = 'All';
        scIbut1.onclick = cus;
        scIui.appendChild(scIbut1);
        if(location.hash!='#nsoff'){var scIbut3 = document.createElement('input');
        scIbut3.type = 'button';
        scIbut3.value = 'T-unblock';
        scIbut3.title = 'Temporarily unblocks scripts for tab,WARNING: page will reload, shift click for this webpage only. To turn script blocking back on, either remove #nsoff from url and hit enter or close tab and re-open it.';
        scIbut3.onclick = function(e){if(e.shiftKey)location.hash='#nsoff';else window.name=window.name+' nsoff';history.go(0);};
        scIui.appendChild(scIbut3);}
        var scIbut4 = document.createElement('input');
        scIbut4.type = 'button';
        scIbut4.id= 'nelser';
        scIbut4.value = 'Server';
        scIbut4.onclick = cus;
        scIui.appendChild(scIbut4);
        var r = document.createElement('button');

	var tooltip = "Scripts blocked: ";
	tooltip += current_domain + " [" + blocked_current_domain +
	  (blocked_current_domain == total_current_domain ? '' : "/" + total_current_domain) + "]";
	tooltip += ", External: [" + blocked_external + 
	  (blocked_external == total_external ? '' : "/" + total_external) + "]";
	r.title = tooltip;
	
	var img = document.createElement('img');
	r.appendChild(img);
	set_icon_style(img);

        r.onclick = function() {
	  if (event.ctrlKey)
	  { // show/hide ui
	    var x = document.getElementById('noiframeui');
	    if (x.style.display == 'none') {
	      x.style.display = 'inline-block';
	      if (document.getElementById('noscriptselect').disabled == false) {
		tog();
	      }
            } else {
	    x.style.display = 'none';
            }
	    return;
	  }	

	  // normal click, change mode
	     if (mode == 'block_all') { mode = 'allow_current_domain'; }
	else if (mode == 'allow_current_domain') { mode = 'allow_all'; }
	else if (mode == 'allow_all') { mode = 'block_all'; }
	     createCookie('noscript_mode', mode, 365, null, 'g');
	     set_icon_style(img);
	}
	
        scIele.appendChild(scIui);
        scIele.appendChild(r);
        document.documentElement.appendChild(scIele);
    },
    false);
})()
