
#
# Used to install TinyMCE 4 into our source tree. We only include the
# non-minified, compiled output. We will do our own minification.
#
# Because we convert css -> sass as part of the installation, you need
# sass installed.
#
# [andy 14.Oct.2013]
#

# Your TeamPage source tree
SRC=~/src/traction/teampage

# Destination directory for TinyMCE 4
TINYMCE=$(SRC)/html/js/tinymce4
TINYSASS=$(SRC)/html/sass/tinymce4

# Plugin list copied from js/traction/edit/tinymce/TinyMce.js
PLUGINS=table paste charmap textcolor directionality noneditable contextmenu code fullscreen

# Files that we don't need that are removed after we install
GARBAGE=skins/lightgray/fonts themes/modern/theme.min.js 

install:
	@echo "Recreating TinyMCE 4 Installation Directories"
	-@rm -rf $(TINYMCE)
	-@mkdir $(TINYMCE)
	-@mkdir $(TINYMCE)/themes
	-@mkdir $(TINYMCE)/skins
	-@mkdir $(TINYMCE)/plugins
	-@mkdir $(TINYMCE)/src

	@echo "Installing TinyMCE 4 Core"
	cp js/tinymce/tinymce.js $(TINYMCE)/src/tinymce.js

	@echo "Installing TinyMCE 4 Skin - lightgray"
	sass-convert js/tinymce/skins/lightgray/skin.min.css $(TINYSASS)/_lightgray-skin.scss
	sass-convert js/tinymce/skins/lightgray/content.min.css $(TINYSASS)/_lightgray-content.scss

	@echo "Installing TinyMCE 4 Theme - modern"
	@cp -r js/tinymce/themes/modern $(TINYMCE)/themes

	@for plugin in $(PLUGINS); do echo "Installing TinyMCE 4 Plugin - $$plugin"; mkdir $(TINYMCE)/plugins/$$plugin; cp -r js/tinymce/plugins/$$plugin/plugin.js $(TINYMCE)/plugins/$$plugin/plugin.js; done

	@for file in $(GARBAGE); do echo "Removing $(TINYMCE)/$$file"; rm -rf $(TINYMCE)/$$file; done

	@echo "TinyMCE Installation complete. Please checkin and push the new installation to our Mercurial tree."
