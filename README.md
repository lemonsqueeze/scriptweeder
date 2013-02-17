scriptkiddie
============

**noscript on steroids for opera !**

[Home page](https://github.com/lemonsqueeze/scriptkiddie/wiki) is in the wiki now. Or stay here for developper's corner.

Extension
---------

It's in the `extension` branch, but don't use it yet unless you feel like debugging it. There are [outstanding issues](http://my.opera.com/community/forums/topic.dml?id=1545262) remaining.

Other stuff
-----------

`utils` directory has a few things which could be useful outside of this project:
  * `google_nojs.js` example showing how to disable javascript but still allow userjs to run. This one does it for google search.
  * `block_event_listeners.js` userjs to block page event listeners.
  * `event_logger.js` userjs to log all events
  * `page_event_logger.js` regular script to see what events page is getting.

`xml_macros` (tools directory) takes care of expanding xml macros. Useful if you need modularity in xml or html. Syntax is inspired from [fxmacro](http://www2.informatik.tu-muenchen.de/~perst/fxmacro/) (couldn't get it to build so ended up writing this instead).

Hacking
-------

The script is put together from the different bits and pieces in the `src` directory. You'll need some kind of unix environment with `perl` and `make` installed (for windows get `cygwin`).

Just type `make` to build. 

UI layout is generated from `scriptkiddie.ui`, css from `scriptkiddie.css`. Image references in the css are turned into `data:` urls automatically, so it's a convenient tool for hacking styles (it can add `width` and `height` automatically as well, see `/*img_size*/` comments in the css).

UI code lives in `ui.js`, `userjs_ui.js` manages widgets and the injected iframe, and the filtering logic is in `core.js`.
