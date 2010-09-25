(function() {
    var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc.
    var blocksitescripts=false;
    function createCookie(name, value, days, a_d, y) {
        if (!y) {
            var x = escape(location.pathname);
            x = x.replace(/\//g, '__').replace(/\./g, '--');
        }
        name = 'noscript';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        }
        else var expires = "";
        document.cookie = name + (!y ? x: '') + "=" + value + (a_d ? ' ' + a_d: '') + expires + "; path=/";
    }
    function readCookie(name, y) {
        if (!y) {
            var x = escape(location.pathname);
            x = x.replace(/\//g, '__').replace(/\./g, '--');
        }
        var nameEQ = (y == 'g' ? name: name + x) + "=";
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
        var j = readCookie('noscript') ? readCookie('noscript') : '';
        var h = readCookie('noscript', 'g') ? readCookie('noscript', 'g') : '';
        if (document.getElementById('nelbb').value == 'Block')
        {
            if (zi != '' && zi.match(/^\d{1,3}s/)) {
                f(b[b.selectedIndex], 'X');
                j = j.replace(zi, '');
                createCookie('noscript', j, ((h == '' && j == '') ? -1: 365));
            }
            else if (zi == '') {
                eraseCookie('noscript');
                for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
                    f(x, 'X');
                }
            }
            else {
                for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
                    if (zi.indexOf(x.title) != -1) {
                        f(x, 'X');
                    }
                }
                h = h.replace(zi, '');
                createCookie('noscript', h, ((h == '' && j == '') ? -1: 365), null, 'g');
            }
        }
        else {
            if (zi != '' && zi.match(/^\d{1,3}s/)) {
                f(b[b.selectedIndex]);
                createCookie('noscript', zi, 365, j);
            }
            else if (zi == '') {
                var rt = [];
                for (var i = b.length - 1; i >= 0, g = b[i]; i--) {
                    var z = i + 's';
                    if (j.indexOf(z) == -1) {
                        f(g);
                        rt[rt.length] = z;
                    }
                }

                createCookie('noscript', rt.toString().replace(/\,/g, ' '), 365, j);
            }

            else {
                for (var i = b.length - 1; i >= 0, x = b[i]; i--) {
                    if (zi.indexOf(x.title) != -1) {
                        f(x);
                    }
                }
                createCookie('noscript', zi, 365, h, 'g');
            }
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
        {
            a.value = 'Unblock';
        }
        else
        {
            a.value = 'Block';
        }
    }


    var scI = 0;
    var scA = [];
    opera.addEventListener('BeforeExternalScript',
    function(e) {
        if (e.element.tagName != 'SCRIPT') {
            return
        }
        var x = e.element.src;
        var z = readCookie('noscript');
        var v = readCookie('noscript', 'g');
        var t = document.createElement('a');
        t.href = x;
        var scE = t.hostname;
        scIi = scI + 's';
        var scIil = document.createElement('option');
        scIil.value = scI + 's';
        scIil.innerText = x;
        scIil.setAttribute('title', scE);
        if ((location.hash=='#nsoff' || window.name.match(/ nsoff/))) {
        }
        else if(myXOR(get_domain(scE) == get_domain(location.hostname),
		      ((z && z.indexOf(scIi.toString()) != -1) || (v && v.indexOf(scE) != -1))))
        {
        scA.push(scIil);
        }
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
        var r = document.createElement('input');
        r.type = 'button';
        r.style = "width:25px;height:25px;background:-o-skin('Panel Links');display:inline-block;";
        r.onclick = function() {
            var x = document.getElementById('noiframeui');
            if (x.style.display == 'none') {
                x.style.display = 'inline-block';
                if (document.getElementById('noscriptselect').disabled == false) {
                    tog();
                }
            } else {
                x.style.display = 'none';
            }
        }
        scIele.appendChild(scIui);
        scIele.appendChild(r);
        document.documentElement.appendChild(scIele);
    },
    false);
})()
