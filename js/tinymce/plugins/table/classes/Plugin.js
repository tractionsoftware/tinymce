/**
 * Plugin.js
 *
 * Copyright, Moxiecode Systems AB
 * Released under LGPL License.
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/**
 * This class contains all core logic for the table plugin.
 *
 * @class tinymce.tableplugin.Plugin
 * @private
 */
define("tinymce/tableplugin/Plugin", [
	"tinymce/tableplugin/TableGrid",
	"tinymce/tableplugin/Quirks",
	"tinymce/tableplugin/CellSelection",
	"tinymce/util/Tools",
	"tinymce/dom/TreeWalker",
	"tinymce/Env",
	"tinymce/PluginManager"
], function(TableGrid, Quirks, CellSelection, Tools, TreeWalker, Env, PluginManager) {
	var each = Tools.each;

	function Plugin(editor) {
		var winMan, clipboardRows, self = this; // Might be selected cells on reload

                // ----------------------------------------------------------------------
		// This block borrowed from the textcolor plugin, with an extra row added and a clear button

		function mapColors() {
			var i, colors = [], colorMap;

			colorMap = editor.settings.textcolor_map || [
				"000000", "Black",
				"993300", "Burnt orange",
				"333300", "Dark olive",
				"003300", "Dark green",
				"003366", "Dark azure",
				"000080", "Navy Blue",
				"333399", "Indigo",
				"333333", "Very dark gray",

				"800000", "Maroon",
				"FF6600", "Orange",
				"808000", "Olive",
				"008000", "Green",
				"008080", "Teal",
				"0000FF", "Blue",
				"666699", "Grayish blue",
				"808080", "Gray",

				"FF0000", "Red",
				"FF9900", "Amber",
				"99CC00", "Yellow green",
				"339966", "Sea green",
				"33CCCC", "Turquoise",
				"3366FF", "Royal blue",
				"800080", "Purple",
				"999999", "Medium gray",

				"FF00FF", "Magenta",
				"FFCC00", "Gold",
				"FFFF00", "Yellow",
				"00FF00", "Lime",
				"00FFFF", "Aqua",
				"00CCFF", "Sky blue",
				"993366", "Brown",
				"C0C0C0", "Silver",

				"FF99CC", "Pink",
				"FFCC99", "Peach",
				"FFFF99", "Light yellow",
				"CCFFCC", "Pale green",
				"CCFFFF", "Pale cyan",
				"99CCFF", "Light sky blue",
				"CC99FF", "Plum",
				"EEEEEE", "Light gray",

				"FFDDEE", "",
				"FFEEDD", "",
				"FFFFDD", "",
				"EEFFEE", "",
				"EEFFFF", "",
				"DDEEFF", "",
				"EEDDFF", "",
				"FFFFFF", "White",

				"", "",
			];

			for (i = 0; i < colorMap.length; i += 2) {
				colors.push({
					text: colorMap[i + 1],
					color: colorMap[i]
				});
			}

			return colors;
		}

		function renderColorPicker() {
			var ctrl = this, colors, color, html, last, rows, cols, x, y, i;

			colors = mapColors();

			html = '<table class="mce-grid mce-grid-border mce-colorbutton-grid" role="presentation" cellspacing="0"><tbody>';
			last = colors.length - 1;
			cols = editor.settings.textcolor_cols || 8;
			rows = editor.settings.textcolor_rows || (colors.length / cols + ((colors.length % cols === 0) ? 0 : 1));

			for (y = 0; y < rows; y++) {
				html += '<tr>';

				for (x = 0; x < cols; x++) {
					i = y * cols + x;

					if (i > last) {
						html += '<td></td>';
					} else {
						color = colors[i];
						html += (
							'<td>' +
								'<div id="' + ctrl._id + '-' + i + '"' +
								' data-mce-color="' + color.color + '"' +
								' class="' + (color.color ? 'mce-colorbutton-cell' : 'mce-colorbutton-cell-transparent') + '"' +
								' role="option"' +
								' tabIndex="-1"' +
								' style="' + (color.color ? 'background-color: #' + color.color : '') + '"' +
								(color.text ? ' title="' + color.text + '">' : '') +
								'</div>' +
								'</td>'
						);
					}
				}

				html += '</tr>';
			}

			html += '</tbody></table>';

			return html;
		}

		function onPanelClick(e) {
			var buttonCtrl = this.parent(), value = e.target.getAttribute('data-mce-color');

			if (typeof value != "undefined") {
				buttonCtrl.hidePanel();
				if (value) {
					value = '#' + value;
				}
				buttonCtrl.color(value);
			}
		}

	        function onButtonClick() {
                        this.showPanel();
	        }

		/**
		 * Automatically adds the type, panel, and onclick for a color button that acts as an input.
		 */
		function colorInput(settings) {
			settings.type = 'colorbutton';
			settings.panel = { html: renderColorPicker, onclick: onPanelClick };
			settings.onclick = onButtonClick;
			return settings;
		}

                // ----------------------------------------------------------------------

		function removePxSuffix(size) {
			return size ? size.replace(/px$/, '') : "";
		}

		function addSizeSuffix(size) {
			if (/^[0-9]+$/.test(size)) {
				size += "px";
			}

			return size;
		}

		function unApplyAlign(elm) {
			each('left center right'.split(' '), function(name) {
				editor.formatter.remove('align' + name, {}, elm);
			});
		}

		function tableDialog() {
			var dom = editor.dom, tableElm, data, createNewTable;

			tableElm = editor.dom.getParent(editor.selection.getStart(), 'table');
			createNewTable = false;

			data = {
				bgcolor: dom.getStyle(tableElm, 'backgroundColor') || dom.getAttrib(tableElm, 'bgcolor'),
				bordercolor: dom.getStyle(tableElm, 'borderLeftColor') || dom.getAttrib(tableElm, 'bordercolor'),
				width: removePxSuffix(dom.getStyle(tableElm, 'width') || dom.getAttrib(tableElm, 'width')),
				height: removePxSuffix(dom.getStyle(tableElm, 'height') || dom.getAttrib(tableElm, 'height')),
				cellspacing: dom.getAttrib(tableElm, 'cellspacing'),
				cellpadding: dom.getAttrib(tableElm, 'cellpadding'),
				borderwidth: removePxSuffix(dom.getStyle(tableElm, 'borderLeftWidth') || dom.getAttrib(tableElm, 'border')),
				caption: !!dom.select('caption', tableElm)[0]
			};

			each('left center right'.split(' '), function(name) {
				if (editor.formatter.matchNode(tableElm, 'align' + name)) {
					data.align = name;
				}
			});

			editor.windowManager.open({
				title: "Table properties",
				items: {
					type: 'form',
					layout: 'grid',
					columns: 2,
					spacingH: 50,
					data: data,
					defaults: {
						type: 'textbox',
						maxWidth: 50
					},
					items: [
						createNewTable ? {label: 'Cols', name: 'cols', disabled: true} : null,
						createNewTable ? {label: 'Rows', name: 'rows', disabled: true} : null,
						{label: 'Width', name: 'width'},
						{label: 'Height', name: 'height'},
						{label: 'Cell spacing', name: 'cellspacing'},
						{label: 'Cell padding', name: 'cellpadding'},
						{label: 'Caption', name: 'caption', type: 'checkbox'},
						{
							label: 'Alignment',
							minWidth: 90,
							name: 'align',
							type: 'listbox',
							text: 'None',
							maxWidth: null,
							values: [
								{text: 'None', value: ''},
								{text: 'Left', value: 'left'},
								{text: 'Center', value: 'center'},
								{text: 'Right', value: 'right'}
							]
						},
						colorInput({label: 'Border color', name: 'bordercolor'}),
						{label: 'Border width', name: 'borderwidth'},
						colorInput({label: 'Background color', name: 'bgcolor'})
					]
				},

				onsubmit: function() {
					var data = this.toJSON(), captionElm;

					editor.undoManager.transact(function() {
						editor.dom.setAttribs(tableElm, {
							cellspacing: data.cellspacing,
							cellpadding: data.cellpadding
						});

						editor.dom.setStyles(tableElm, {
							'background-color': data.bgcolor,
							width: addSizeSuffix(data.width),
							height: addSizeSuffix(data.height)
						});

						var borderwidth;
						if (data.borderwidth) {
							borderwidth = parseInt(removePxSuffix(data.borderwidth), 10);
						}
						else {
							borderwidth = data.bordercolor ? 1 : 0;
						}
						if (borderwidth > 0) {
							editor.dom.setStyles(tableElm, {
								border: addSizeSuffix(borderwidth) + ' solid ' +
									(data.bordercolor || '#000')
							});
						}
						else {
							editor.dom.setStyles(tableElm, {
								border: ''
							});
						}
                                                
						// Toggle caption on/off
						captionElm = dom.select('caption', tableElm)[0];

						if (captionElm && !data.caption) {
							dom.remove(captionElm);
						}

						if (!captionElm && data.caption) {
							captionElm = dom.create('caption');
							captionElm.innerHTML = !Env.ie ? '<br data-mce-bogus="1"/>' : '\u00a0';
							tableElm.insertBefore(captionElm, tableElm.firstChild);
						}

						unApplyAlign(tableElm);
						if (data.align) {
							editor.formatter.apply('align' + data.align, {}, tableElm);
						}

						editor.focus();
						editor.addVisual();
					});
				}
			});
		}

		function mergeDialog(grid, cell) {
			editor.windowManager.open({
				title: "Merge cells",
				body: [
					{label: 'Cols', name: 'cols', type: 'textbox', size: 10},
					{label: 'Rows', name: 'rows', type: 'textbox', size: 10}
				],
				onsubmit: function() {
					var data = this.toJSON();

					editor.undoManager.transact(function() {
						grid.merge(cell, data.cols, data.rows);
					});
				}
			});
		}

		function cellDialog() {
			var dom = editor.dom, cellElm, data, cells = [];

			// Get selected cells or the current cell
			cells = editor.dom.select('td.mce-item-selected,th.mce-item-selected');
			cellElm = editor.dom.getParent(editor.selection.getStart(), 'td,th');
			if (!cells.length && cellElm) {
				cells.push(cellElm);
			}

			cellElm = cellElm || cells[0];

			data = {
				bgcolor: dom.getStyle(cellElm, 'backgroundColor') || dom.getAttrib(cellElm, 'bgcolor'),
				bordercolor: dom.getStyle(cellElm, 'borderLeftColor') || dom.getAttrib(cellElm, 'bordercolor'),
				width: removePxSuffix(dom.getStyle(cellElm, 'width') || dom.getAttrib(cellElm, 'width')),
				height: removePxSuffix(dom.getStyle(cellElm, 'height') || dom.getAttrib(cellElm, 'height')),
				scope: dom.getAttrib(cellElm, 'scope')
			};

			data.type = cellElm.nodeName.toLowerCase();

			each('left center right'.split(' '), function(name) {
				if (editor.formatter.matchNode(cellElm, 'align' + name)) {
					data.align = name;
				}
			});

			editor.windowManager.open({
				title: "Cell properties",
				items: {
					type: 'form',
					data: data,
					layout: 'grid',
					columns: 2,
					spacingH: 50,
					defaults: {
						type: 'textbox',
						maxWidth: 50
					},
					items: [
						colorInput({label: 'Background Color', name: 'bgcolor'}),
						colorInput({label: 'Border Color', name: 'bordercolor'}),
						{label: 'Width', name: 'width'},
						{label: 'Height', name: 'height'},
						{
							label: 'Cell type',
							name: 'type',
							type: 'listbox',
							text: 'None',
							minWidth: 90,
							maxWidth: null,
							menu: [
								{text: 'Cell', value: 'td'},
								{text: 'Header cell', value: 'th'}
							]
						},
						{
							label: 'Scope',
							name: 'scope',
							type: 'listbox',
							text: 'None',
							minWidth: 90,
							maxWidth: null,
							menu: [
								{text: 'None', value: ''},
								{text: 'Row', value: 'row'},
								{text: 'Column', value: 'col'},
								{text: 'Row group', value: 'rowgroup'},
								{text: 'Column group', value: 'colgroup'}
							]
						},
						{
							label: 'Alignment',
							name: 'align',
							type: 'listbox',
							text: 'None',
							minWidth: 90,
							maxWidth: null,
							values: [
								{text: 'None', value: ''},
								{text: 'Left', value: 'left'},
								{text: 'Center', value: 'center'},
								{text: 'Right', value: 'right'}
							]
						}
					]
				},

				onsubmit: function() {
					var data = this.toJSON();

					editor.undoManager.transact(function() {
						each(cells, function(cellElm) {
							editor.dom.setAttrib(cellElm, 'scope', data.scope);

							editor.dom.setStyles(cellElm, {
								'background-color': data.bgcolor,
								border: data.bordercolor ? '1px solid ' + data.bordercolor : '',
								width: addSizeSuffix(data.width),
								height: addSizeSuffix(data.height)
							});

							// Switch cell type
							if (data.type && cellElm.nodeName.toLowerCase() != data.type) {
								cellElm = dom.rename(cellElm, data.type);
							}

							// Apply/remove alignment
							unApplyAlign(cellElm);
							if (data.align) {
								editor.formatter.apply('align' + data.align, {}, cellElm);
							}
						});

						editor.focus();
					});
				}
			});
		}

		function rowDialog() {
			var dom = editor.dom, tableElm, cellElm, rowElm, data, rows = [];

			tableElm = editor.dom.getParent(editor.selection.getStart(), 'table');
			cellElm = editor.dom.getParent(editor.selection.getStart(), 'td,th');

			each(tableElm.rows, function(row) {
				each(row.cells, function(cell) {
					if (dom.hasClass(cell, 'mce-item-selected') || cell == cellElm) {
						rows.push(row);
						return false;
					}
				});
			});

			rowElm = rows[0];

			data = {
				bgcolor: dom.getStyle(rowElm, 'backgroundColor') || dom.getAttrib(rowElm, 'bgcolor'),
				height: removePxSuffix(dom.getStyle(rowElm, 'height') || dom.getAttrib(rowElm, 'height')),
				scope: dom.getAttrib(rowElm, 'scope')
			};

			data.type = rowElm.parentNode.nodeName.toLowerCase();

			each('left center right'.split(' '), function(name) {
				if (editor.formatter.matchNode(rowElm, 'align' + name)) {
					data.align = name;
				}
			});

			editor.windowManager.open({
				title: "Row properties",
				items: {
					type: 'form',
					data: data,
					columns: 2,
					spacingH: 50,
					defaults: {
						type: 'textbox'
					},
					items: [
						colorInput({label: 'Background Color', name: 'bgcolor'}),
						{
							type: 'listbox',
							name: 'type',
							label: 'Row type',
							text: 'None',
							maxWidth: null,
							menu: [
								{text: 'Header', value: 'thead'},
								{text: 'Body', value: 'tbody'},
								{text: 'Footer', value: 'tfoot'}
							]
						},
						{
							type: 'listbox',
							name: 'align',
							label: 'Alignment',
							text: 'None',
							maxWidth: null,
							menu: [
								{text: 'None', value: ''},
								{text: 'Left', value: 'left'},
								{text: 'Center', value: 'center'},
								{text: 'Right', value: 'right'}
							]
						},
						{label: 'Height', name: 'height'}
					]
				},

				onsubmit: function() {
					var data = this.toJSON(), tableElm, oldParentElm, parentElm;

					editor.undoManager.transact(function() {
						var toType = data.type;

						each(rows, function(rowElm) {
							editor.dom.setAttrib(rowElm, 'scope', data.scope);

							editor.dom.setStyles(rowElm, {
								'background-color': data.bgcolor,
								height: addSizeSuffix(data.height)
							});

							if (toType != rowElm.parentNode.nodeName.toLowerCase()) {
								tableElm = dom.getParent(rowElm, 'table');

								oldParentElm = rowElm.parentNode;
								parentElm = dom.select(toType, tableElm)[0];
								if (!parentElm) {
									parentElm = dom.create(toType);
									if (tableElm.firstChild) {
										tableElm.insertBefore(parentElm, tableElm.firstChild);
									} else {
										tableElm.appendChild(parentElm);
									}
								}

								parentElm.appendChild(rowElm);

								if (!oldParentElm.hasChildNodes()) {
									dom.remove(oldParentElm);
								}
							}

							// Apply/remove alignment
							unApplyAlign(rowElm);
							if (data.align) {
								editor.formatter.apply('align' + data.align, {}, rowElm);
							}
						});

						editor.focus();
					});
				}
			});
		}

		function cmd(command) {
			return function() {
				editor.execCommand(command);
			};
		}

		function insertTable(cols, rows) {
			var y, x, html, defaultTableStyle = "border: 1px solid #808080;", defaultTdStyle = "border: 1px solid #999999;";

			function styleAttributes(defaultStyle) {
				return ' style="' + defaultStyle + '" data-mce-style="' + defaultStyle + '"';
			}

			html = '<table' + styleAttributes(defaultTableStyle) + '><tbody>';

			for (y = 0; y < rows; y++) {
				html += '<tr>';

				for (x = 0; x < cols; x++) {
					html += '<td' + styleAttributes(defaultTdStyle) + '>' + (Env.ie ? " " : '<br>') + '</td>';
				}

				html += '</tr>';
			}

			html += '</tbody></table>';

			editor.insertContent(html);
		}

		function handleDisabledState(ctrl, selector) {
			function bindStateListener() {
				ctrl.disabled(!editor.dom.getParent(editor.selection.getStart(), selector));

				editor.selection.selectorChanged(selector, function(state) {
					ctrl.disabled(!state);
				});
			}

			if (editor.initialized) {
				bindStateListener();
			} else {
				editor.on('init', bindStateListener);
			}
		}

		function postRender() {
			/*jshint validthis:true*/
			handleDisabledState(this, 'table');
		}

		function postRenderCell() {
			/*jshint validthis:true*/
			handleDisabledState(this, 'td,th');
		}

		function generateTableGrid() {
			var html = '';

			html = '<table role="presentation" class="mce-grid mce-grid-border">';

			for (var y = 0; y < 10; y++) {
				html += '<tr>';

				for (var x = 0; x < 10; x++) {
					html += '<td><a href="#" data-mce-index="' + x + ',' + y + '"></a></td>';
				}

				html += '</tr>';
			}

			html += '</table>';

			html += '<div class="mce-text-center">0 x 0</div>';

			return html;
		}

		editor.addMenuItem('inserttable', {
			text: 'Insert table',
			icon: 'table',
			context: 'table',
			onhide: function() {
				editor.dom.removeClass(this.menu.items()[0].getEl().getElementsByTagName('a'), 'mce-active');
			},
			menu: [
				{
					type: 'container',
					html: generateTableGrid(),

					onmousemove: function(e) {
						var x, y, target = e.target;

						if (target.nodeName == 'A') {
							var table = editor.dom.getParent(target, 'table');
							var pos = target.getAttribute('data-mce-index');
							var rel = e.control.parent().rel;

							if (pos != this.lastPos) {
								pos = pos.split(',');

								pos[0] = parseInt(pos[0], 10);
								pos[1] = parseInt(pos[1], 10);

								if (e.control.isRtl() || rel == 'tl-tr') {
									for (y = 9; y >= 0; y--) {
										for (x = 0; x < 10; x++) {
											editor.dom.toggleClass(
												table.rows[y].childNodes[x].firstChild,
												'mce-active',
												x >= pos[0] && y <= pos[1]
											);
										}
									}

									pos[0] = 9 - pos[0];
									table.nextSibling.innerHTML = pos[0] + ' x '+ (pos[1] + 1);
								} else {
									for (y = 0; y < 10; y++) {
										for (x = 0; x < 10; x++) {
											editor.dom.toggleClass(
												table.rows[y].childNodes[x].firstChild,
												'mce-active',
												x <= pos[0] && y <= pos[1]
											);
										}
									}

									table.nextSibling.innerHTML = (pos[0] + 1) + ' x '+ (pos[1] + 1);
								}

								this.lastPos = pos;
							}
						}
					},

					onclick: function(e) {
						if (e.target.nodeName == 'A' && this.lastPos) {
							e.preventDefault();

							insertTable(this.lastPos[0] + 1, this.lastPos[1] + 1);

							// TODO: Maybe rework this?
							this.parent().cancel(); // Close parent menu as if it was a click
						}
					}
				}
			]
		});

		editor.addMenuItem('tableprops', {
			text: 'Table properties',
			context: 'table',
			onPostRender: postRender,
			onclick: tableDialog
		});

		editor.addMenuItem('deletetable', {
			text: 'Delete table',
			context: 'table',
			onPostRender: postRender,
			cmd: 'mceTableDelete'
		});

		editor.addMenuItem('cell', {
			separator: 'before',
			text: 'Cell',
			context: 'table',
			menu: [
				{text: 'Cell properties', onclick: cmd('mceTableCellProps'), onPostRender: postRenderCell},
				{text: 'Merge cells', onclick: cmd('mceTableMergeCells'), onPostRender: postRenderCell},
				{text: 'Split cell', onclick: cmd('mceTableSplitCells'), onPostRender: postRenderCell}
			]
		});

		editor.addMenuItem('row', {
			text: 'Row',
			context: 'table',
			menu: [
				{text: 'Insert row before', onclick: cmd('mceTableInsertRowBefore'), onPostRender: postRenderCell},
				{text: 'Insert row after', onclick: cmd('mceTableInsertRowAfter'), onPostRender: postRenderCell},
				{text: 'Delete row', onclick: cmd('mceTableDeleteRow'), onPostRender: postRenderCell},
				{text: 'Row properties', onclick: cmd('mceTableRowProps'), onPostRender: postRenderCell},
				{text: '-'},
				{text: 'Cut row', onclick: cmd('mceTableCutRow'), onPostRender: postRenderCell},
				{text: 'Copy row', onclick: cmd('mceTableCopyRow'), onPostRender: postRenderCell},
				{text: 'Paste row before', onclick: cmd('mceTablePasteRowBefore'), onPostRender: postRenderCell},
				{text: 'Paste row after', onclick: cmd('mceTablePasteRowAfter'), onPostRender: postRenderCell}
			]
		});

		editor.addMenuItem('column', {
			text: 'Column',
			context: 'table',
			menu: [
				{text: 'Insert column before', onclick: cmd('mceTableInsertColBefore'), onPostRender: postRenderCell},
				{text: 'Insert column after', onclick: cmd('mceTableInsertColAfter'), onPostRender: postRenderCell},
				{text: 'Delete column', onclick: cmd('mceTableDeleteCol'), onPostRender: postRenderCell}
			]
		});

		var menuItems = [];
		each("inserttable tableprops deletetable | cell row column".split(' '), function(name) {
			if (name == '|') {
				menuItems.push({text: '-'});
			} else {
				menuItems.push(editor.menuItems[name]);
			}
		});

		editor.addButton("table", {
			type: "menubutton",
			title: "Table",
			menu: menuItems
		});

		// Select whole table is a table border is clicked
		if (!Env.isIE) {
			editor.on('click', function(e) {
				e = e.target;

				if (e.nodeName === 'TABLE') {
					editor.selection.select(e);
					editor.nodeChanged();
				}
			});
		}

		self.quirks = new Quirks(editor);

		editor.on('Init', function() {
			winMan = editor.windowManager;
			self.cellSelection = new CellSelection(editor);
		});

		// Register action commands
		each({
			mceTableSplitCells: function(grid) {
				grid.split();
			},

			mceTableMergeCells: function(grid) {
				var rowSpan, colSpan, cell;

				cell = editor.dom.getParent(editor.selection.getStart(), 'th,td');
				if (cell) {
					rowSpan = cell.rowSpan;
					colSpan = cell.colSpan;
				}

				if (!editor.dom.select('td.mce-item-selected,th.mce-item-selected').length) {
					mergeDialog(grid, cell);
				} else {
					grid.merge();
				}
			},

			mceTableInsertRowBefore: function(grid) {
				grid.insertRow(true);
			},

			mceTableInsertRowAfter: function(grid) {
				grid.insertRow();
			},

			mceTableInsertColBefore: function(grid) {
				grid.insertCol(true);
			},

			mceTableInsertColAfter: function(grid) {
				grid.insertCol();
			},

			mceTableDeleteCol: function(grid) {
				grid.deleteCols();
			},

			mceTableDeleteRow: function(grid) {
				grid.deleteRows();
			},

			mceTableCutRow: function(grid) {
				clipboardRows = grid.cutRows();
			},

			mceTableCopyRow: function(grid) {
				clipboardRows = grid.copyRows();
			},

			mceTablePasteRowBefore: function(grid) {
				grid.pasteRows(clipboardRows, true);
			},

			mceTablePasteRowAfter: function(grid) {
				grid.pasteRows(clipboardRows);
			},

			mceTableDelete: function(grid) {
				grid.deleteTable();
			}
		}, function(func, name) {
			editor.addCommand(name, function() {
				var grid = new TableGrid(editor);

				if (grid) {
					func(grid);
					editor.execCommand('mceRepaint');
					self.cellSelection.clear();
				}
			});
		});

		// Register dialog commands
		each({
			mceInsertTable: function() {
				tableDialog();
			},

			mceTableRowProps: rowDialog,
			mceTableCellProps: cellDialog
		}, function(func, name) {
			editor.addCommand(name, function(ui, val) {
				func(val);
			});
		});
	}

	PluginManager.add('table', Plugin);
});
