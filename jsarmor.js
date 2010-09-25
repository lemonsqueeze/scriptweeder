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
    
    function eraseCookie(name) {
        createCookie(name, "", -1);
    }

    function reload_page()
    { history.go(0); }
    
    // block_all, filtered, allow_all    
    var mode = readCookie('noscript_mode', 'g');
    if (mode == '') { mode = 'block_all'; }

    function set_mode(new_mode, reload)
    {
      mode = new_mode;
      if (new_mode == 'filtered' && !readCookie('noscript', 'g'))
	allow_domain(current_domain);
      createCookie('noscript_mode', mode, 365, null, 'g');
      set_icon_style(button_image, mode);
      show_hide_menu(false);
      reload_page();
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

    function allow_domain(domain)
    {
      var h = readCookie('noscript', 'g') ? readCookie('noscript', 'g') : '';
      createCookie('noscript', domain, 365, h, 'g');
    }

    function block_domain(domain)
    {
      var h = readCookie('noscript', 'g') ? readCookie('noscript', 'g') : '';
      h = h.replace(domain, '');
      createCookie('noscript', h, (h == '' ? -1: 365), null, 'g');      
    }
    
    function cus() {
        var b = document.getElementById('noscriptselect');
        var zi = (event.ctrlKey || this.value == 'Server') ? b[b.selectedIndex].getAttribute('title') : (event.shiftKey || this.value == 'All') ? '': b.value;

        if (document.getElementById('nelbb').value == 'Block')
        {
	  // block server
	  for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
	    if (zi.indexOf(x.title) != -1) {
	      f(x, 'X');
	    }
	  }
	  block_domain(zi);
        }
        else
	{
	  for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
	    if (zi.indexOf(x.title) != -1) {
	      f(x);
	    }
	  }
	  allow_domain(zi);
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

    function filtered_mode_should_allow(scr_domain) {
      var v = readCookie('noscript', 'g');
      return (v && v.indexOf(scr_domain) != -1);
    }
    
    function should_allow(scr_domain) {
      if (mode == 'block_all') { return false; }
      if (mode == 'filtered') { return filtered_mode_should_allow(scr_domain); }
      if (mode == 'allow_all') { return true; }
      alert('should not be reached!');
    }

    function new_icon(mode)
    {
      var icon = document.createElement('img');
      set_icon_style(icon, mode);
      return icon;
    }
    
    var button_image = new_icon(mode);
    
    function set_icon_style(img, mode) {
      var icon;      
      if (mode == 'block_all') {
	// icon = "Blocked";
	// icon = "High Assurance Security Button Skin";
	icon = "Smiley Tongue";
      }      
      if (mode == 'filtered') {
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

    function add_menu_item(nsmenu, text, indent, f, icon) {
      // FIXME: add icon
      var item = document.createElement('p');
      item.style = "margin-top:0px; margin-bottom:0px;" +
        (indent ? "padding-left:" + (indent * 10) + "px;": "");
//      item.style.backgroundColor = 'transparent';
      // FIXME; make text non selectable
      item.text = text;
      if (f)
      {
	item.onmouseover = function(){ this.style.backgroundColor = '#dddddd'; };
	item.onmouseout  = function(){ this.style.backgroundColor = 'transparent'; };
	item.onclick = f;
      }
      // make text non selectable
      item.onmousedown = function(){ return false; };
      if (icon)
        { nsmenu.appendChild(icon); }
      nsmenu.appendChild(item);
      return item;
    }

    var nsmenu;
    function create_menu()
    {
	nsmenu = document.createElement('div');		
	nsmenu.align = 'left';
	nsmenu.style="border-width: 2px; border-style: outset; border-color: gray; background:#abb9ca;";
        nsmenu.style.display = 'none';

	nsmenu.onmouseout = function(e) {

	  if (!e) var e = window.event;
	  // object we're moving out of
	  // var tg = (window.event) ? e.srcElement : e.target;
	  // if (tg != nsmenu) // moving out of one its children.
	  //  return; we actually need that case!
	  
	  // e.relatedTarget: object we're moving to.
	  var reltg = e.relatedTarget;
	  while (reltg != nsmenu && reltg.nodeName != 'HTML')
	    reltg= reltg.parentNode
	  if (reltg == nsmenu) return; // moving out of the div into a child layer
	  
	  show_hide_menu(false);
	};
	
//	nsmenu.border = '1';
//	nsmenu.style = 'border-spacing:0; border-top-color:#dddddd; border-left-color:#dddddd; border-bottom-color:#888888; border-right-color:#888888;';

//	nsmenu.style = 'border-top-color:#dddddd; border-left-color:#dddddd; border-bottom-color:#888888; border-right-color:#888888; border-top-width:2px;';

	add_menu_item(nsmenu, "Choose Mode:");
	add_menu_item(nsmenu, "block all", 2, function(){ set_mode('block_all'); }, new_icon('block_all'));
	add_menu_item(nsmenu, "filtered", 2, function(){ set_mode('filtered'); }, new_icon('filtered'));

	for (var i = 0; i < domains.length; i++)
	{
	  var ba = 'allow ';
	  var d = domains[i];
	  var f = function() { allow_domain(this.domain); set_mode('filtered'); };
	  if (filtered_mode_should_allow(d))
	    {
	      ba = 'block ';
	      f = function() { block_domain(this.domain); set_mode('filtered'); };
	    }
	  var item = add_menu_item(nsmenu, ba + d, 4, f);
	  item.domain = d;
	}
	
	add_menu_item(nsmenu, "allow all", 2, function(){ set_mode('allow_all'); }, new_icon('allow_all'));

	var td = document.getElementById('td_nsmenu');
	td.appendChild(nsmenu);	
    }

    function show_hide_menu(show, toggle)
    {
      if (!nsmenu)
	create_menu();
      var d = (show ? 'inline-block' : 'none');
      if (toggle) 
        { d = (nsmenu.style.display == 'none' ? 'inline-block' : 'none'); }
      nsmenu.style.display = d;
    }
    
    // array of arrays: scripts[0] has all the scripts for domain domains[0] etc
    var scripts = [];
    var domains = [];
    function add_script(url, domain)
    {
      for (var i = 0; i < domains.length; i++)
      {
	if (domains[i] == domain)
	{
	  scripts[i].push(url);
	  return;
	}
      }

      domains.push(domain);
      scripts.push([]);
      scripts[i].push(url);      
    }

    var scI = 0;
    var scA = [];

    var blocked_current_domain = 0;
    var loaded_current_domain = 0;
    var total_current_domain = 0;
    
    var blocked_external = 0;
    var loaded_external = 0;
    var total_external = 0;
    
    opera.addEventListener('BeforeExternalScript',
    function(e) {
        if (e.element.tagName != 'SCRIPT') {
	  alert("non 'SCRIPT' tagname: " + e.element.tagName);
	  return;
        }

	// find out which scripts are actually loaded,
	// this way we can find out if *something else* is blocking (blocked content, hosts file ...)
	// awesome!
	e.element.onload = function(le) {
//	  alert("in load handler! script:" + le.target.src);

	  var t = document.createElement('a');
	  t.href = le.target.src;
	  var scE = get_domain(t.hostname);
	  if (scE == current_domain) { loaded_current_domain++; }
	  else { loaded_external++; }
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
	
	if (scE == current_domain) {
	  total_current_domain++;
	  if (!allowed) { blocked_current_domain++; }
	} else {
	  total_external++;
	  if (!allowed) { blocked_external++; }
	}

	add_script(x, scE);
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
//        var scIele = document.createElement('cusnoiframe');
	var scIele = document.createElement('table');
	scIele.border = 0;
	scIele.cellSpacing = 0;
	scIele.cellPadding = 0;	
	// background:-o-skin("Browser Window Skin")
//        scIele.style = 'position:fixed;' + (cornerposition < 3 ? 'top': 'bottom') + ':1px;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px;width:auto;height:auto;background:transparent;white-space:nowrap;z-index:9999;direction:ltr;';
        scIele.style = 'position:fixed;' + (cornerposition < 3 ? 'top': 'bottom') + ':1px;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px;width:auto;height:auto;background:transparent;white-space:nowrap;z-index:9999;direction:ltr;';
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

        var tooltip = "Scripts on current page: [" + current_domain + "] " + blocked_current_domain;
	if (blocked_current_domain != total_current_domain)
	  {  tooltip += "/" + total_current_domain; }
	tooltip += " blocked";
	if (loaded_current_domain)
	  { tooltip += " (" + loaded_current_domain + " loaded)"; }

        tooltip += ", [External] " + blocked_external;
	if (blocked_external != total_external)
	  {  tooltip += "/" + total_external; }
	tooltip += " blocked";
	if (loaded_external)
	  { tooltip += " (" + loaded_external + " loaded)"; }
	r.title = tooltip;
	
	r.appendChild(button_image);
    
        r.onclick = function() {
	  if (event.shiftKey)
	  { // cycle through the modes
	    // FIXME: should wait until shift is released to reload page
	    if (mode == 'block_all') { set_mode('filtered'); }
	    else if (mode == 'filtered') { set_mode('allow_all'); }
	    else if (mode == 'allow_all') { set_mode('block_all'); }
	    return;
	  }

//	  if (event.ctrlKey)
	  if (1)
	  { // show/hide extended ui
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
	}

	r.onmouseover = function() { show_hide_menu(true); };
	
	var tr = document.createElement('tr');
	var td = document.createElement('td');
	td.id = 'td_nsmenu';
	td.align = 'right';

	tr.appendChild(td);
        scIele.appendChild(tr);

	var tr = document.createElement('tr');
	var td = document.createElement('td');
	td.align = 'right';	
	td.appendChild(scIui);
	td.appendChild(r);
	tr.appendChild(td);
        scIele.appendChild(tr);
	
//        scIele.appendChild(nsmenu);       	
//        scIele.appendChild(scIui);
//        scIele.appendChild(r);
        document.documentElement.appendChild(scIele);
    },
    false);
})()
