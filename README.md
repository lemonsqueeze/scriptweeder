v1.44
jsarmor
=======

**noscript on steroids for opera !**

Background
----------

Web pages have the ability to embed javascript programs in them to turn browsing into a more interactive experience. Javascript is one of the most important components in shaping user experience on the internet today. It is an incredibly powerful language, and as such can also be dangerous in the wrong hands. Unfortunately it's become widely abused as users have no control over it by default. Disabling javascript entirely isn't ideal as many sites stop working then, so a more flexible solution is called for.

jsarmor
-------

Like [noscript](http://noscript.net), `jsarmor` gives the user control back over which scripts should be loaded in a page. Unlike noscript however, that's [all it does](http:// "It won't go hunting after flash content, throw a million settings at you, make coffee, or call your mother"). I embarked on this project because as a user i wasn't thrilled with what was available for opera. The two main reasons for its existence are to provide:
* an interface that's a treat to use, right under your hand
* filtering logic that is both powerful yet easy to use.

It's got a few nice features i haven't found elsewhere, see [features](#features) below or just give it a try.

As it turns out, i'm a happy user now: it seems a good balance has been found. All the usual nuisances are blocked by default, pages just load fast ! And with `relaxed mode` pretty much every site just works. Enjoy !

Use this [thread](http://my.opera.com/community/forums/topic.dml?id=1544682) for feedback: wishes, problem, just post it. I make no promises, but will see what can be done. In particular, if you find something with `relaxed mode` it'll be very helpful to improve it. Stuff like:
* your favorite site doesn't work there by default, but `allow all` fixes it.
* or opposite, something's getting allowed that really shouldn't be.

Oh, and don't use the extension in the repository, it's not ready yet.

An options menu should be coming shortly with import/export settings and whitelist editor among other things.

Where to go next
----------------

* [installation](https://github.com/lemonsqueeze/jsarmor/wiki/installation)

* [first run](https://github.com/lemonsqueeze/jsarmor/wiki/first-run)

* [overview of the interface](https://github.com/lemonsqueeze/jsarmor/wiki/playing-with-the-interface)

(sorry, doc is work in progress right now ...)

Features
--------

* zero click interface, just mouse over!

* different modes of filtering:
  * `block all`: disable javascript
  * `filtered`:  same origin
  * `relaxed`:   just make it work !
  * `allow all`: load everything

* disable javascript but allow userjs and extensions to run.

* per page/site/domain/global settings for flexibility.

* global whitelist.

* scripts urls and status


Extension
---------

There is an extension in the repository, but don't use it yet unless you feel like debugging it. There are [outstanding issues](http://my.opera.com/community/forums/topic.dml?id=1545262) remaining.

Other stuff
-----------

`utils/google_nojs.js`: example showing how to disable javascript but still allow userjs to run on one site only without depending on jsarmor. This one does it for google search.
