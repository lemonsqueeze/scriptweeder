
DIR=JSArmor
EXT=jsarmor-$(VERSION).oex

#VERS_MAG=$(shell cat ../jsarmor.js | grep 'var version' | sed -e "s|.*v\([0-9.]\+\)'.*|\1|")
VERS_MAG=1.5
VERS_MIN=0
VERSION=$(VERS_MAG)-$(VERS_MIN)

all: $(EXT) link

$(EXT): $(DIR)/config.xml $(DIR)/includes/jsarmor.js
	@echo Generating $@
	@-cd $(DIR) && rm *~ */*~ > /dev/null 2>&1
	@cd $(DIR) && zip -r ../$@ *

$(DIR)/includes/jsarmor.js: ../jsarmor.js
	@echo Generating $@
	@-mkdir $(DIR)/includes > /dev/null 2>&1
	@cat $< | sed -e 's|var version_type = "userjs"|var version_type = "extension"|' > $@

link:
	-rm jsarmor.oex
	ln -s $(EXT) jsarmor.oex

clean:
	-rm *.oex *~ $(DIR)/includes/jsarmor.js
