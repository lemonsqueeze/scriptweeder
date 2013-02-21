
#MAKE=make
MAKE=make --no-print-directory

scriptkiddie.js: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

# Using the dev environment to make style patches easily:
# - Start with a clean git repository (no changes)
# - Add your style patch rules at the end of scriptkiddie.css (don't change anything else !)
#   Add extra images to img/ directory and reference them with url('../img/whacky_image.png').
#   To test changes, just type 'make' and try the generated scriptkiddie.js.
#   Right now you're actually changing the default style, so either use rescue mode or
#     reset custom styles with "Options->Back to default".
# - Type 'make style_patch' once you're happy with the changes. 
#   style patch is ready in style.patch.css !
style_patch: style.patch.css

style.patch.css: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

clean:
	@cd src && $(MAKE) clean

FORCE:
