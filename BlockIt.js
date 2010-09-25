// ==UserScript==
// @name BlockIt, Its like NoScript extension for firefox, but different.
// @author shoust
// @version 1.5
// @description  Best way is to describe the extension for firefox, basically NoScript is an extension for firefox that allows selective blocking/unblocking of scripts in the page, this does the same , but more, it allows blocking/unblocking of iframes,embedded content and images as well, plus by default, it keeps elements that are based on the site unblocked, so only things not based on the site are blocked.
// @include *
// ==/UserScript==

(function() {
    if (location.hash != '#nsoff' && !window.name.match(/#nsoff/) && !location.href.match(/\.(svgz?|jpe?g|js|txt|png|gif|bmp|css)$/)) {
        /*Check if the script needs to be executed. */
     var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc, makes the button to show the options in either the top or bottom of the page.
    var blocksiteresources = true;
    // This option allows blocking of all the scripts based on the site, if false, resources residing on http://my.opera.com on http://my.opera.com/community/ won't be blocked for example.
    var imgblockIt = false;
    var iframeblockIt = true;
    var mediablockIt = true;
        function createCookie(name, value, days, addition, forpage)
        /* for saving the settings to cookies. The "addition" variable is to add settings to the cookie, instead of removing the whole cookie altogether*/
        {
            if (!forpage)
            /*Saving settings for the page/pathname only,instead of the whole site*/
            {
                var x = escape(location.pathname);
                x = x.replace(/\//g, '__').replace(/\./g, '--');
            }
            if (name != 'noresource') name = 'no' + activeselect();
            if (days) {
                var date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                var expires = "; expires=" + date.toGMTString();
            } else
            var expires = "";
            document.cookie = name + (!forpage ? x: '') + "=" + value + (addition ? ' ' + addition: '') + expires + "; path=/";
        }
        function readCookie(name, forpage)
        /*For reading the settings*/
        {
            if (!forpage)
            /*Reading settings for the page/pathname only,instead of the whole site*/
            {
                var x = escape(location.pathname);
                x = x.replace(/\//g, '__').replace(/\./g, '--');
            }
            var nameEQ = (forpage == 'g' ? name: name + x) + "=";
            var ca = document.cookie.split(';');
            for (
            var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) == ' ')
                c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) == 0)
                return c.substring(nameEQ.length, c.length);
            }
            return '';
        }

        function eraseCookie(name) {
            createCookie(name + activeselect(), "", -1);
        }
        // for deleting settings

        /* To work out what elements are being selected to block at the right time*/
        function activeselect() {
            var x = document.getElementById('ujs42-_noelementselect');
            return (x ? x[x.selectedIndex].value: 'script');
        }

        /* Function to generate the element block list for the Iframes, embeds and images in the page. */
        function generatelist(name) {
            var elementz = document.selectNodes('//' + name + '[@src]');
            if (!elementz.length) {
                //if no elements on page, do nothing else.
                return;
            }
            var count = elementz.length;
            var forpage = readCookie('no' + name) ? readCookie('no' + name) : '';
            //settings for the page
            var forsite = readCookie('no' + name, 'g') ? readCookie('no' + name, 'g') : '';
            //settings for the site
            var forserverunblock = readCookie('noresource', 'g') ? readCookie('noresource', 'g') : '';
            var listselect = document.createElement('select');
            //The list of elements and their urls to block
            listselect.onchange = blocktoggle;
            listselect.id = "ujs42-_no" + name + "select";
            listselect.style = 'width:300px;display:none;margin-right:20px !important;';
            var host = location.hostname;
            for (
            var i = elementz.length - 1; i >= 0, element = elementz[i]; i--) {
                var link = document.createElement('a');
                //just a way to get the hostname without using match or indexof.
                link.href = (element.src ? element.src: element.getAttribute('src'));
                var linkhost = link.hostname;
                elemcount = i + 's';
                // unique identifier in the document's order to block the element or unblock the element.
                var listoption = document.createElement('option');
                listoption.value = elemcount;
                listoption.innerText = (element.src ? element.src: element.getAttribute('src'));
                listoption.setAttribute('title', linkhost);
                //unique server identifier to block or unblock from this server
                listoption.setAttribute('alt', element.currentStyle.display);
                if (!blocksiteresources && linkhost == host) {
                    count--;
                    // to not display elements from the same site if blocksiteresources are off.
                }
                else if (link.href.indexOf('data:') == 0) {
                    count--;
                    // to not display elements starting with data:
                }
                else if ((forpage && forpage.indexOf(elemcount.toString()) != -1) || (forsite && forsite.indexOf(linkhost) != -1) || (forserverunblock && forserverunblock.indexOf(linkhost) != -1)) {
                    // to unblock elements if they match the cookie that says to unblock them
                    showasblocked_unblocked(listoption);
                    listselect.appendChild(listoption);
                }
                else {
                    //blocks the element.
                    element.style.display = 'none';
                    showasblocked_unblocked(listoption, 'X');
                    listselect.appendChild(listoption);
                }

            }
            if (count != 0)
            {
                //if the elements that are needed to be blocked is zero, don't display option to block that list of elements.
                var elemselect = document.createElement('option');
                elemselect.innerText = (name == 'img' ? 'Images': name == 'embed' ? 'Embeds(Media)': name == 'iframe' ? 'Iframes': '') + '(' + count + ',' + elementz.length + ')';
                elemselect.value = name;
                return [elemselect,listselect];
            }
        }

        function showelementlist() {
            //this function is to toggle between the element lists to block and unblock
            var elemlist = ['img', 'embed', 'iframe', 'script'];
            var element = this.value;
            var elemselect = document.getElementById('ujs42-_no' + element + 'select');
            for (
            var i = elemlist.length - 1; i >= 0, elemtag = elemlist[i]; i--)

            if (elemtag == element) {
                elemselect.style.display = 'inline';
            } else
            if (document.getElementById('ujs42-_no' + elemtag + 'select')) {
                document.getElementById('ujs42-_no' + elemtag + 'select').style.display = 'none';
            }
            if (elemselect && elemselect.disabled == false)
            blocktoggle();
        }

        function showasblocked_unblocked(element, block, bringback, single) {
            //function to show if an element is blocked or unblocked in the UI.
            var notblocked = (element.innerText.indexOf('#X# -') == 0);
            
            var noscriptelement = document.getElementById('ujs42-_noscriptselect');
            if (!notblocked && block == 'X') {
                if ((noscriptelement && noscriptelement.style.display == 'none') || !noscriptelement && single) {
                    var highlight = document.selectSingleNode('//*[@src="' + element.innerText + '"]');
if(highlight)                    {highlight.style.outlineColor = 'red';
                    highlight.style.outlineStyle = 'dashed';
                    setTimeout(function() {
                        highlight.style.outlineStyle = 'none';
                        highlight.style.display = 'none';
                    },
                    500);
                }}
                element.innerText = '#X# -' + element.innerText;
            } else
            if (notblocked && !block) {
                element.innerText = element.innerText.substr(5);
                if ((noscriptelement && noscriptelement.style.display == 'none') || !noscriptelement && single) {
                    var highlight = document.selectSingleNode('//*[@src="' + element.innerText + '"]');
                    if(highlight){highlight.style.display = element.getAttribute('alt');
                    highlight.style.outlineColor = 'orange';
                    highlight.style.outlineStyle = 'dashed';
                    setTimeout(function() {
                        highlight.style.outlineStyle = 'none';
                    },
                    500);
                    if (single == '1') {
                        highlight.scrollIntoView(true);
                    }}
                }
            }
            if (bringback) {
                return element
            }
        }

        function block_unblock() {
            //the function to write the stuff needed to unblock to cookie.
            var optionelement = document.getElementById('ujs42-_no' + activeselect() + 'select');
            var whattoblock = (event.ctrlKey || this.value == 'Server') ? optionelement[optionelement.selectedIndex].getAttribute('title') : (event.shiftKey || this.value == 'All') ? '': optionelement.value;
            var unblockonly = event.altKey;
            var whatservertounblock = (event.ctrlKey && this.value == 'Server');
            var forpage = readCookie('no' + activeselect()) ? readCookie('no' + activeselect()) : '';
            //for the page only, doesn't affect other pages on the same site
            var forsite = readCookie('no' + activeselect(), 'g') ? readCookie('no' + activeselect(), 'g') : '';
            //for the whole site, mainly to unblock servers.
            var forserverunblock = readCookie('noresource', 'g') ? readCookie('noresource', 'g') : '';
            if (document.getElementById('ujs42-_nelbb').value == 'Block') {
                //if it is in block mode, blocks the element.
                if (whattoblock != '' && whattoblock.match(/^\d{1,3}s/)) {
                    //blocks the single element only
                    showasblocked_unblocked(optionelement[optionelement.selectedIndex], 'X', false, '1');
                    forpage = forpage.replace(whattoblock, '');
                    if(!unblockonly)createCookie('no', forpage, ((forsite == '' && forpage == '') ? -1: 365));
                } else
                if (whattoblock == '') {
                    //blocks all elements.
                    eraseCookie('no' + activeselect());
                    for (
                    var i = optionelement.length - 1; i >= 0, x = optionelement[i]; i--) {
                        showasblocked_unblocked(x, 'X',false,'2');
                    }
                } else {
                    if (!whatservertounblock) {
                        // blocks server only.
                        for (
                        var i = optionelement.length - 1; i >= 0, x = optionelement[i]; i--) {
                            if (whattoblock.indexOf(x.title) != -1) {
                                showasblocked_unblocked(x, 'X',false,'2');
                            }
                        }
                        forsite = forsite.replace(whattoblock, '');
                        if(!unblockonly)createCookie('no', forsite, ((forsite == '' && forpage == '') ? -1: 365), null, 'g');
                    }
                    else {
                        //blocks server for all resources available.
                        var elemlist = ['ujs42-_noimgselect', 'ujs42-_noembedselect', 'ujs42-_noiframeselect', 'ujs42-_noscriptselect'];
                        for (var elemlistx = elemlist.length - 1; elemlistx >= 0, elemlisth = elemlist[elemlistx]; elemlistx--) {
                            if (!document.getElementById(elemlisth)) {
                                continue;
                            }
                            else {
                                optionelement = document.getElementById(elemlisth);
                            }
                            for (
                            var i = optionelement.length - 1; i >= 0, x = optionelement[i]; i--) {
                                if (whattoblock.indexOf(x.title) != -1) {
                                    showasblocked_unblocked(x, 'X', false, '2');
                                }
                            }
                        }
                        forserverunblock = forserverunblock.replace(whattoblock, '');
                        if(!unblockonly)createCookie('noresource', forserverunblock, (forserverunblock == '' ? -1: 365), null, 'g');
                    }

                }
            } else {
                if (whattoblock != '' && whattoblock.match(/^\d{1,3}s/)) {
                    //unblocks single element only
                    showasblocked_unblocked(optionelement[optionelement.selectedIndex], false, false, '1');
                    if(!unblockonly)createCookie('no', whattoblock, 365, forpage);
                } else
                if (whattoblock == '') {
                    //unblocks all elements.
                    var rt = [];
                    for (
                    var i = optionelement.length - 1; i >= 0, g = optionelement[i]; i--) {
                        var z = i + 's';
                        if (forpage.indexOf(z) == -1) {
                            showasblocked_unblocked(g,false,false,'2');
                            rt[rt.length] = z;
                        }
                    }

                    if(!unblockonly)createCookie('no', rt.toString().replace(/\,/g, ' '), 365, forpage);
                }
                else {
                    if (!whatservertounblock) {
                        //unblocks server only.
                        for (
                        var i = optionelement.length - 1; i >= 0, x = optionelement[i]; i--) {
                            if (whattoblock.indexOf(x.title) != -1) {
                                showasblocked_unblocked(x,false,false,'2');
                            }
                        }
                        if(!unblockonly)createCookie('no', whattoblock, 365, forsite, 'g');
                    }
                    else {
                        //unblocks server for all resources available.
                        var elemlist = ['ujs42-_noimgselect', 'ujs42-_noembedselect', 'ujs42-_noiframeselect', 'ujs42-_noscriptselect'];
                        for (var elemlistx = elemlist.length - 1; elemlistx >= 0, elemlisth = elemlist[elemlistx]; elemlistx--) {
                            if (!document.getElementById(elemlisth)) {
                                continue;
                            }
                            else {
                                optionelement = document.getElementById(elemlisth);
                            }
                            for (
                            var i = optionelement.length - 1; i >= 0, x = optionelement[i]; i--) {
                                if (whattoblock.indexOf(x.title) != -1) {
                                    showasblocked_unblocked(x, false, false, '2');
                                }
                            }
                        }
                        if(!unblockonly)createCookie('noresource', whattoblock, 365, forserverunblock, 'g');
                    }
                }
            }
            blocktoggle();
        }

        function blocktoggle() {
            //toggles the block button to unblock and vice versa.
            var a = document.getElementById('ujs42-_nelbb');
            var b = document.getElementById('ujs42-_no' + activeselect() + 'select');
            if (b[b.selectedIndex].innerText.indexOf('#X# -') == 0) {
                a.value = 'Unblock';
            } else {
                a.value = 'Block';
            }
        }


        var scriptcount = 0;
        var scripturls = [];
        opera.addEventListener('BeforeExternalScript',
        function(e) {
            if (e.element.tagName != 'SCRIPT') {
                //not a script? Do nothing else
                return
            }
            var scriptsource = e.element.src;
            var forpage = readCookie('noscript');
            var forsite = readCookie('noscript', 'g');
            var forserverunblock = readCookie('noresource', 'g');
            var link = document.createElement('a');
            //same way to get hostname without needing to match
            link.href = scriptsource;
            var linkhost = link.hostname;
            scriptnumber = scriptcount + 's';
            //unique identifier for script order in the document.
            var scriptoption = document.createElement('option');
            scriptoption.value = scriptnumber;
            scriptoption.innerText = scriptsource;
            scriptoption.setAttribute('title', linkhost);
            if (!blocksiteresources && linkhost.indexOf(location.hostname) != -1) {
                //do nothing if blocksiteresources is off.
                }
            else if ((forpage && forpage.indexOf(scriptnumber.toString()) != -1) || (forsite && forsite.indexOf(linkhost) != -1) || (forserverunblock && forserverunblock.indexOf(linkhost) != -1))
            {
                //if cookie contains and "unblocks" make sure its added.
                scripturls.push(scriptoption);
            }
            else {
                //block scripts if the cookie tells them its not blocked.
                e.preventDefault();
                scripturls.push(showasblocked_unblocked(scriptoption, 'X', 'h'));
            }
            scriptcount++;
        },
        false);
        document.addEventListener('DOMContentLoaded',
        function() {
            var userinterface = document.createElement('ujs42-_noresource');
            userinterface.style = 'position:fixed;' + (cornerposition < 3 ? 'top': 'bottom') + ':1px;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px;width:20px;height:20px;background:-o-skin("Browser Window Skin");white-space:nowrap;z-index:9999;direction:ltr;border:1px solid black;';
            userinterface.id = 'ujs42-_noresourceinterface';
            //the interface for unblocking resources and blocking them
            var uibackground = document.createElement('ujs42-_noresourceui');
            //holds most of the UI elements, and centers them whenever possible
            uibackground.id = 'ujs42-_noiframeui';
            uibackground.style.display = 'none';
            uibackground.style.textAlign = 'center';
            var elementselection = document.createElement('select');
            //To select what list of elements to block.
            elementselection.id = "ujs42-_noelementselect";
            elementselection.onchange = showelementlist;
            elementselection.style.width = 'auto !important';
            elementselection.style.marginLeft = '20px !important';
            uibackground.appendChild(elementselection);
            var noscriptlist = document.createElement('select');
            //For listing all the scripts in the page, that are needed to be blocked
            noscriptlist.onchange = blocktoggle;
            noscriptlist.id = "ujs42-_noscriptselect";
            noscriptlist.style = 'width:300px;margin-right:20px !important;';
            if (scripturls.length) {
                //start to add the scripts.
                var scriptscounter = document.createElement('option');
                scriptscounter.innerText = 'Scripts' + '(' + scripturls.length + ',' + scriptcount + ')';
                //adds scripts counter to be blocked/unblocked, plus total number.
                scriptscounter.value = 'script';
                elementselection.appendChild(scriptscounter);
                for (
                var i = scripturls.length - 1; i > -1; i--) {
                    noscriptlist.appendChild(scripturls[i]);
                }
                uibackground.appendChild(noscriptlist);
            }
            //no scripts here? Don't add.
            if(imgblockIt){var x=generatelist('img');
            if(x){elementselection.appendChild(x[0]);uibackground.appendChild(x[1]);}}//to add all the other resource lists, if wished.
            if(iframeblockIt){var x=generatelist('iframe');
            if(x){elementselection.appendChild(x[0]);uibackground.appendChild(x[1]);}}
            if(mediablockIt){var x=generatelist('embed');
            if(x){elementselection.appendChild(x[0]);uibackground.appendChild(x[1]);}}
                        if (elementselection.innerHTML != '') { //no point carrying on if there aren't any resources to be unblocked.
var unblockselected = document.createElement('input');
            unblockselected.type = 'button';
            unblockselected.id = 'ujs42-_nelbb';
            unblockselected.value = 'Block';
            //button to block individual resources.
            unblockselected.onclick = block_unblock;
            uibackground.appendChild(unblockselected);
            var unblockall = document.createElement('input');
            unblockall.type = 'button';
            unblockall.value = 'All';
            //button to block all resources.
            unblockall.onclick = block_unblock;
            uibackground.appendChild(unblockall);
            var tempunblock = document.createElement('input');
            tempunblock.type = 'button';
            tempunblock.value = 'T-unblock';
            //unblocks all for tab only.
            tempunblock.title = 'Temporarily unblocks resources for tab,WARNING: page will reload, shift click for this webpage only. To turn resource blocking back on, either remove #nsoff from url and hit enter or close tab and re-open it.';
            tempunblock.onclick = function(e) {
                if (e.shiftKey) location.hash = '#nsoff';
                else window.name = window.name + '#nsoff';
                history.go(0);
            };
            uibackground.appendChild(tempunblock);
            var unblockserver = document.createElement('input');
            unblockserver.type = 'button';
            unblockserver.id = 'ujs42-_nelser';
            unblockserver.value = 'Server';
            //unblocks according to server address.
            unblockserver.onclick = block_unblock;
            uibackground.appendChild(unblockserver);
            var previewresource = document.createElement('input');
            previewresource.type = 'button';
            previewresource.id = 'ujs42-_resourcepreview'
            previewresource.value = 'Preview';
            //previews resource in new tab.
            previewresource.onclick = function() {
                var selectedelementindex = document.getElementById('ujs42-_no' + activeselect() + 'select').selectedIndex;
                var elementoption = document.getElementById('ujs42-_no' + activeselect() + 'select')[selectedelementindex].innerText;
                if (elementoption.indexOf('#X# -') == 0) {
                    window.open(elementoption.substr(5))
                } else window.open(elementoption)
            };
            uibackground.appendChild(previewresource);
            var showui = document.createElement('input');
            showui.type = 'button';
            showui.style = 'width:20px;height:20px;background:-o-skin("Panel Links");display:inline-block;position:absolute;' + (cornerposition < 3 ? 'top': 'bottom') + ':0px;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':0px;';
            //button always on to show the interface.
            showui.onclick = function() {
                if (uibackground.style.display == 'none') {
                    uibackground.style.display = 'inline-block';
                    userinterface.style.width = 'auto';
                    userinterface.style.height = 'auto';
                    if (document.getElementById('ujs42-_no' + activeselect() + 'select').disabled == false) {
                        blocktoggle();
                    }
                } else {
                    uibackground.style.display = 'none';
                    userinterface.style.width = '20px';
                    userinterface.style.height = '20px';
                }
            }
            userinterface.appendChild(uibackground);
            userinterface.appendChild(showui);
            document.documentElement.appendChild(userinterface);
            var linebreak = document.createElement('br');
            uibackground.insertBefore(linebreak, unblockselected);
if (!document.getElementById('ujs42-_noscriptselect')) {
                elementselection.onchange();
            }
            var stylesheet = document.createElement('style');
            stylesheet.innerText = '#ujs42-_noresourceinterface *{font-family:sans-serif !important}#ujs42-_noresourceinterface input[type=button],#ujs42-_noresourceinterface select{border:2px outset black !important;margin:0px !important;}#ujs42-_noresourceinterface input[type=button]:active{outline:2px inset black !important;border:0px !important;}#ujs42-_noiframeui input[type=button]{background-color:#e0e0e0 !important;margin-right:4px !important}#ujs42-_noresourceinterface select{background-color:white !important;}@media screen and (max-width: 1200px) {#ujs42-_noiframeui *{font-size:10pt !important;}#ujs42-_noscriptselect,#ujs42-_noimgselect,#ujs42-_noiframeselect,#ujs42-_noembedselect{width:300px !important}}@media screen and (max-width: 800px) {#ujs42-_noiframeui *{font-size:8pt !important;}#ujs42-_noscriptselect,#ujs42-_noimgselect,#ujs42-_noiframeselect,#ujs42-_noembedselect{width:200px !important}} @media screen and (max-width: 500px) {#ujs42-_noiframeui *{font-size:6pt !important;}#ujs42-_noscriptselect,#ujs42-_noimgselect,#ujs42-_noiframeselect,#ujs42-_noembedselect{width:150px !important} #ujs42-_noiframeui input[type=button]{margin-right:0px !important}#ujs42-_resourcepreview,#ujs42-_nelbb{padding-left:0px !important;padding-right:0px !important}}@media screen and (max-width: 270px){#ujs42-_noiframeui{display:inline-block;}#ujs42-_noresourceinterface{width:100% !important;height:auto !important;content:"BlockIt can\'t be viewed at this width";white-space:normal !important;text-align:center;}}';
            //interesting bit here, this is mainly for the script to work with most or all screen sizes, it checks the width and resizes accordingly, while keeping the main toggle button out of the way
            document.documentElement.appendChild(stylesheet);
        }},
        false);
    }
})
()
