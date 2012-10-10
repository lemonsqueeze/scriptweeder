
#VERS_MAG=$(shell cat ../jsarmor.js | grep 'var version' | sed -e "s|.*v\([0-9.]\+\)'.*|\1|")
VERS_MAG=0.1
VERS_MIN=1
VERSION=$(VERS_MAG)-$(VERS_MIN)


all: jsarmor-$(VERSION).oex link

jsarmor-$(VERSION).oex: JSArmor/config.xml JSArmor/includes/jsarmor.js
	-cd JSArmor && rm *~ */*~
	cd JSArmor && zip -r ../jsarmor-$(VERSION).oex *

JSArmor/includes/jsarmor.js: ../jsarmor.js
	cp -p ../jsarmor.js JSArmor/includes/jsarmor.js

link:
	-rm jsarmor.oex
	ln -s jsarmor-$(VERSION).oex jsarmor.oex

clean:
	-rm *.oex *~ JSArmor/includes/jsarmor.js
