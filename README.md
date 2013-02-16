scriptkiddie
============

**noscript on steroids for opera !**

[Home page](https://github.com/lemonsqueeze/scriptkiddie/wiki) is in the wiki now. Or stay here for developper's corner.

Extension
---------

It's in the `extension` branch, but don't use it yet unless you feel like debugging it. There are [outstanding issues](http://my.opera.com/community/forums/topic.dml?id=1545262) remaining.

Other stuff
-----------

`utils/google_nojs.js`: shows how to disable javascript but still allow userjs to run on one site only without depending on scriptkiddie. This one does it for google search.

Hacking
-------

The script is put together from the different bits and pieces in the `src` directory, just type `make` to build. You'll need `perl` and `make` installed (get `cygwin` on windows).

UI layout is generated from `scriptkiddie.ui`, css from `scriptkiddie.css`. Image references in the css are turned into `data:` urls automatically, so it's a convenient tool for hacking styles (it can add `width` and `height` for images as well, see `/*img_size*/` comments in the css).

UI code lives in `ui.js`, `userjs_ui.js` manages widgets and the injected iframe, and the filtering logic is in `core.js`.
