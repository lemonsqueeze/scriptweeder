
DIR=scriptweeder
EXT=scriptweeder-$(VERSION).oex

#VERS_MAG=$(shell cat ../scriptweeder.js | grep 'var version' | sed -e "s|.*v\([0-9.]\+\)'.*|\1|")
VERSION=1.5.7

all: $(EXT)

$(EXT): $(DIR)/config.xml $(DIR)/index.html $(DIR)/includes/scriptweeder.js 
	@echo Generating $@
	@-cd $(DIR) && rm *~ */*~ > /dev/null 2>&1
	@cd $(DIR) && zip -r ../$@ *

# add version
$(DIR)/config.xml: Makefile
	@echo Generating $@
	@cat $(DIR)/config.xml | sed -e 's|^\(<widget .*\)version="[^"]*"|\1version="$(VERSION)"|' > $(DIR)/config.xml.tmp
	@mv $(DIR)/config.xml.tmp $(DIR)/config.xml

$(DIR)/includes/scriptweeder.js: ../scriptweeder.js
	@echo Generating $@
	@-mkdir $(DIR)/includes > /dev/null 2>&1
	@cat $< | sed -e 's|var version_type = "userjs"|var version_type = "extension"|' |  \
		  sed -e 's|var version_number = ".*"|var version_number = "$(VERSION)"|'> $@

clean:
	-rm *.oex *~ $(DIR)/includes/scriptweeder.js

FORCE:
