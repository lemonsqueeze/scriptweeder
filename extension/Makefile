
DIR=JSArmor
EXT=jsarmor-$(VERSION).oex

#VERS_MAG=$(shell cat ../jsarmor.js | grep 'var version' | sed -e "s|.*v\([0-9.]\+\)'.*|\1|")
VERS_MAG=1.5
VERS_MIN=0
VERSION=$(VERS_MAG)-$(VERS_MIN)

all: $(EXT) link

$(EXT): $(DIR)/config.xml $(DIR)/includes/jsarmor.js
	-cd $(DIR) && rm *~ */*~
	cd $(DIR) && zip -r ../$@ *

$(DIR)/includes/jsarmor.js: ../jsarmor.js
	cp -p ../jsarmor.js $(DIR)/includes/jsarmor.js

link:
	-rm jsarmor.oex
	ln -s $(EXT) jsarmor.oex

clean:
	-rm *.oex *~ $(DIR)/includes/jsarmor.js
