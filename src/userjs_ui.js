function(){   // fake line, keep_editor_happy

    /********************************* Core ui *********************************/

    // whether to show scriptkiddie ui inside frames / iframes
    var default_show_ui_in_iframes = false;

    // use stored custom style ?
    var enable_custom_style = true;

    /********************************* Style *********************************/

    // inject style as plain text with a <style> element.
    function new_style(str)
    {
	var el = idoc.createElement('style');
	el.type = 'text/css';
	el.media = 'screen';
	el.appendChild(idoc.createTextNode(str));
	idoc.head.appendChild(el);
	return el;
    }

    /****************************** Widget API *************************/

    // layout of interface used in scriptkiddie's iframe
    function init_layout()
    {
	// allow uppercase widget names, will be convenient later on...
	var tmp = widgets;
	for (var i in widgets)
	    tmp[i.toUpperCase()] = widgets[i];
	widgets = tmp;	
    }

    // create ui elements from html layout. this one is for normal (single node) widgets.
    // nested widgets are created as well unless they have the "lazy" attribute.
    function new_widget(name, init_proxy)
    {
	var wrap = new_wrapped_widget(name, init_proxy);
	assert(wrap.children.length <= 1,
	       "new_widget(" + name + "):\n" +
	       "this isn't a single node widget, call new_wrapped_widget() instead !");
	return wrap.firstChild;
    }

    // widgets with the "lazy" attribute are not created until this is called.
    function wakeup_lazy_widgets(tree)
    {
	create_nested_widgets(tree, true);
    }

    
    /**************************** Internal widget functions ***********************/

    // same as new_widget() but returns the <widget> wrapper. this is necessary if
    // the widget is actually a forest... (.forest is set on the div in this case)
    // init_proxy function is used to pass arguments to widget_init()
    function new_wrapped_widget(name, init_proxy)
    {
	name = name.toLowerCase();
	var layout = widgets[name].layout;
	assert(layout, "new_widget(" + name + "): the layout for this widget is missing!");
	
	// otherwise create a new one...
	var d = idoc.createElement('foo');
	d.innerHTML = layout;
	var wrap = d.firstChild;	// the <widget> element
	assert(wrap, "new_widget(" + name + "):\n" +
	             "couldn't create this guy, not defined anywhere.");	
	if (wrap.children.length > 1)
	    wrap.forest = true;

	setup_widget_event_handlers(wrap, name);
	create_nested_widgets(wrap, false);
	call_oninit_handlers(wrap);	
	init_widget(wrap, wrap.firstChild, name, init_proxy);	
	return wrap;
    }
        
    // copy attributes from placeholder (or use args_func if available), and call init handler if needed:
    // if widget "foo" has the 'init' attribute, then foo_init(widget) is called.
    // we could call function foo_init() automatically if it exists, but that would open a nice hole:
    // if the page's scripts have such a handler and we didn't define one, now it'd get called !
    function init_widget(wrap, content, name, init_proxy)
    {
	var widget = (content ? content : wrap);
	if (wrap.children.length > 1) // call init on the wrapper for forest widgets.
	    widget = wrap;
	
	if (!wrap.hasAttribute('init'))
	    return;
	if (init_proxy)
	    init_proxy(widget);
	else // no proxy ? widget_init() takes no args then, call it directly.
	    (widgets[name].init)(widget);
    }

    function call_oninit_handlers(widget)
    {
	foreach_node(widget, function(node)
	{
	    if (node.oninit)
		(node.oninit)(node);
	    node.oninit = null;  // don't let it get called again.
	});
    }    
    
    function is_widget_placeholder(widget)
    {
	return (widgets[widget.tagName] != null);
    }

    function eval_attributes(ph)
    {
	if (!ph)
	    return;

	foreach(ph.attributes, function(a)
	{
	    if (a.value.charAt(0) == "`")  // "`" means eval attribute 
		ph[a.name] = eval(a.value.slice(1));
	    else
		ph[a.name] = a.value;
	});
    }
    
    function get_init_proxy(placeholder)
    {
	var name = placeholder.tagName.toLowerCase();
	var call_init = widgets[name].init_proxy;	
	if (!call_init)
	    return null;
	
	return function(widget)
	{
	    eval_attributes(placeholder);
	    call_init(widget, placeholder);
	};
    }
    
    function create_nested_widgets(widget, ignore_lazy)
    {
	// NodeLists are live so we can't walk and change the tree at the same time.
	// so get all the nodes to replace first, then do it.
	var from = [], to = [];
	foreach_node(widget, function(n)
        {
	    if (!is_widget_placeholder(n) ||
		(!ignore_lazy && n.hasAttribute('lazy')))
		return;
	    from.push(n);
	    to.push(new_wrapped_widget(n.tagName, get_init_proxy(n)));
	});

	for (var i = 0; i < to.length; i++)
	    replace_wrapped_widget(to[i], from[i]);
    }

    function wrapped_widget_name(wrapped)
    {
	return wrapped.getAttribute('name');
    }
    
    function replace_wrapped_widget(to, from)
    {
	// sanity check ...
	assert(!from.children.length, "found a <" + wrapped_widget_name(to) +
	       "> placeholder widget with children, this really shouldn't be happening !");
	    
	if (!to.firstChild) // empty widget ...
	{
	    from.parentNode.removeChild(from);
	    return;
	}
	    
	if (!to.forest) // simple case: only one node
	{
	    from.parentNode.replaceChild(to.firstChild, from);
	    return;
	}

	while (to.children.length)
	    from.parentNode.insertBefore(to.firstChild, from);
	from.parentNode.removeChild(from);
    }

    // replace placeholder with actual widget    
    function replace_widget(to, from)
    {
	replace_wrapped_widget(to.parentNode, from);
    }

    // if we load some html like <div onclick="f"> it won't work because the handler
    // will get evaluated in global context, which we do not own as userjs script.
    // so we have a little plumbing to do here ...
    // handler values can be left empty: <div onclick> means <div onclick="widgetname_onclick()">
    function setup_widget_event_handlers(widget, name)
    {
	foreach_node_down(widget, function(node)
        {
	    foreach(node.attributes, function(a)
	    {
		if (is_prefix('on', a.name))  // onclick onmouseover etc
		{
		    if (a.value != "")
			node[a.name] = eval(a.value);
		    else
			node[a.name] = eval(name + "_" + a.name);
		}
	    });
	});
    }


    /**************************** Injected iframe logic ***********************/

    // interface style used in scriptkiddie's iframe
    function init_style()
    {	
	// use custom style ?
	var use_custom = (enable_custom_style && !rescue_mode());
	var style = (use_custom ? global_setting('css') : '');
	style = (style == '' ? builtin_style : style);

	// style patches
	if (use_custom)
	    style += '\n' + global_setting('style');
	new_style(style);
    }

    function populate_iframe()
    {
	iframe.contentWindow.name = 'scriptkiddie_iframe';
	iwin = iframe.contentWindow;
	idoc = iwin.document;

	// set doctype, we want strict mode, not quirks mode!
	idoc.open();
	idoc.write("<!DOCTYPE HTML>\n<html><head></head><body></body></html>");
	idoc.close();

	init_style();
	init_layout();
	start_ui();
    }

    function resize_iframe()
    {
	var content = idoc.body.firstChild;
	var width = content.scrollWidth;
	var height = content.scrollHeight;
	
	// submenu uses absolute positioning, need to take it into account.
	if (submenu)
	{
	    var e = submenu;	    
	    if (e.offsetLeft < 0)
	    {
		width += -e.offsetLeft;
		e.style.left = 0;
	    }
	    width = max(width, e.offsetLeft + e.realwidth);
	    if (e.offsetTop < 0)
	    {
		height += -e.offsetTop;
		e.style.top = 0;
	    }
	    height = max(height, e.realheight);
	}

	// extra space for menu shadows
	if (ui_hpos == 'left')
	    width += 30;
	if (ui_vpos == 'top')
	    height += 30;
	
	iframe.style.width = width + 'px';
	iframe.style.height = height + 'px';
    }    	    
    
    var iframe;
    var idoc;
    var iwin;
    function create_iframe()
    {
	iframe = document.createElement('iframe');
	iframe.id = 'scriptkiddie_iframe';
	iframe.style = "position:fixed !important;background:transparent !important;white-space:nowrap !important;z-index:2147483647 !important;direction:ltr !important;font-family:sans-serif !important; font-size:small !important; margin-bottom:0px !important;" +
 "width: 1px !important; height: 1px !important;"   +
	"margin-top: 0px !important; margin-right: 0px !important; margin-bottom: 0px !important; margin-left: 0px !important; padding-top: 0px !important; padding-right: 0px !important; padding-bottom: 0px !important; padding-left: 0px !important; border-top-width: 0px !important; border-right-width: 0px !important; border-bottom-width: 0px !important; border-left-width: 0px !important; border-top-style: none !important; border-right-style: none !important; border-bottom-style: none !important; border-left-style: none !important; background-color: transparent !important; visibility: visible !important; content: normal !important; outline-width: medium !important; outline-style: none !important; background-image: none !important; min-width: 0px !important; min-height: 0px !important; " +
        // useful for layout debugging
	(debug_mode ? "border: 1px solid #CCC !important; " : "") +
	ui_vpos + ':1px !important;' + ui_hpos + ':1px !important;';
	iframe.scrolling="no";
	iframe.allowtransparency="true";
	
	iframe.onload = populate_iframe;
	document.body.appendChild(iframe);
    }

}   // keep_editor_happy