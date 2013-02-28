
DIR=scriptweeder
EXT=scriptweeder-$(VERSION).oex

#VERS_MAG=$(shell cat ../scriptweeder.js | grep 'var version' | sed -e "s|.*v\([0-9.]\+\)'.*|\1|")
VERS_MAG=1.5
VERS_MIN=0
VERSION=$(VERS_MAG)-$(VERS_MIN)

all: $(EXT)

$(EXT): $(DIR)/config.xml $(DIR)/index.html $(DIR)/includes/scriptweeder.js 
	@echo Generating $@
	@-cd $(DIR) && rm *~ */*~ > /dev/null 2>&1
	@cd $(DIR) && zip -r ../$@ *

$(DIR)/includes/scriptweeder.js: ../scriptweeder.js
	@echo Generating $@
	@-mkdir $(DIR)/includes > /dev/null 2>&1
	@cat $< | sed -e 's|var version_type = "userjs"|var version_type = "extension"|' > $@

clean:
	-rm *.oex *~ $(DIR)/includes/scriptweeder.js

FORCE:
