
#MAKE=make
MAKE=make --no-print-directory

all: build_extension

build_extension: scriptweeder.js
	@cd extension && $(MAKE)

scriptweeder.js: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

# Using the dev environment to make custom styles easily
custom.style: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

clean:
	@-rm scriptweeder.js
	@cd src && $(MAKE) clean
	@cd extension && $(MAKE) clean

FORCE:
