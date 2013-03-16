/*
var CoderView = function(){
	var cv = this;
	
	this.Model = function(db){
		
	};
	this.Document = function(db){
		
	};
	this.Note = function(db){
		this.db = db;
		this.uid = ++cv.uid;
		this.$note = $(
		'<li class="note'+(db.action=='create'?' new':'')+' cv-color-'+db.color_id+'">' +
			'<textarea>'+(db.text || '')+'</textarea>' +
			'<button class="delete" tabindex="-1">&times;</button>' +
			'<button class="reply" tabindex="-1">&crarr;</button>' +
			'<ul class="comments"></ul>' +
		'</li>');
	};
};
*/


$(function(){
	var canvas     = $('#canvas')[0],
		context    = canvas.getContext('2d');
	
	window.cv = {
		uid:        0,
		$tabs:      $('#tabs'),
		$documents: $('#documents'),
		$notes:     $('#notes'),
		// tabs
		tabs: {
			'new': {
				$tab:      $('#tabs .tab.new'),
				$document: $('#documents .document.new'),
				$notes:    $('#notes .notes.new'),
				document:  undefined,
			}
		},
		_tab: undefined,
		tab: function(uid){
			return this.tabs[uid || this._tab];
		},
		// forms
		intake: {},
		// drawing
		markup: {
			connect: function(note){
				if(!note || !note.$note || !note.$marker) return false;
				
				// get coordinates for drawing
				var from = note.$note.offset(),
					to = note.$marker.last().offset(),
					opacity = 1;
				
				from.x = from.left;
				from.y = from.top + 2;
				from.h = note.$note.outerHeight() - 4;
				to.x = to.left + note.$marker.last().outerWidth();
				to.y = to.top;
				
				var halfX = to.x + (from.x - to.x)/2,
					min = 100,
					max = canvas.height - 100,
					reach = 200;
				
				// faeout when out of view
				if(to.y < min || to.y > max){
					if(to.y < 0 || to.y > canvas.height){
						note.$note.addClass('offscreen');
					}
					// fade line out as they move further out of view
					if(to.y < min){
						opacity = min - (to.y < 0 ? -Math.abs(to.y) : to.y);
					}else{
						opacity = to.y - max;
					}
					opacity = (reach - opacity) / reach * .5;
				}else{
					note.$note.removeClass('offscreen');
				}
				// draw it
				context.beginPath();
				context.moveTo(from.x, from.y);
				context.lineTo(from.x, from.y + from.h);
				context.bezierCurveTo(halfX, from.y + from.h, halfX, to.y, to.x, to.y + 2);
				context.lineTo(to.x, to.y);
				context.bezierCurveTo(halfX, to.y, halfX, from.y, from.x, from.y);
				context.fillStyle = 'rgba('+cv.ui.colors[note.db.color_id]+',' + Math.min(Math.max(0, opacity), .5) + ')';
				context.fill();
			},
			refresh: function(){
				context.clearRect(0, 0, canvas.width, canvas.height);
				
				if(cv.tab() && cv.tab().document){
					$.each(cv.tab().document.notes, function(){
						if(this.$marker) cv.markup.connect(this);
					});
				}
				
				context.clearRect(0, 0, canvas.width, cv.$documents.offset().top);
			},
		},
		// db interaction
		api: {
			loadDocument: function(document_id, success){
				$.ajax({
					url: '/api/db.php',
					type: 'get',
					data: {document_id: document_id},
					dataType: 'json',
					success: function(json){
						if(!json.code){
							if(json.data){
								if(typeof success == 'function') success(json.data);
							}
						}else if(json.code == 403){
							// document is password protected
							// show password form
							var tab = cv.tab();
							tab.$document.html(json.data.text).find('[type=password]').focus();
						}else{
							console.error(json.errors); // @TODO
						}
					}
				})
			},
			loadNotes: function(document_id){
				$.ajax({
					url: '/api/db.php',
					type: 'get',
					data: {notes: true, document_id: document_id},
					dataType: 'json',
					success: function(json){
						if(!json){
							// reset
							cv.tab().document.notes = [];
							cv.tab().document.$note.html('');
							
							// add new
							$.each(json, function(){
								this.from = {line: parseInt(this.from_line), ch: parseInt(this.from_ch)};
								this.to = {line: parseInt(this.to_line), ch: parseInt(this.to_ch)};
								
								var note = cv.dom.createNote(this, cv.tab().document);
								note.$marker = cv.ui.addMarker(note);
								cv.ui.addNote(note);
								
								cv.markup.refresh();
							});
							
							// then add comments
							cv.api.loadComments(cv.document_id);
						}
					}
				})
			},
			loadComments: function(document_id){
				$.ajax({
					url: '/api/db.php',
					type: 'get',
					data: {comments: true, document_id: document_id},
					dataType: 'json',
					success: function(json){
						if(!json.count){
							$.each(json, function(){
								var note = cv.dom.findNotes(this.note_id, 'id')[0],
									comment = cv.dom.createComment(this, note);
								
								note.$note.find('.comments').append(comment.$comment);
								
								comment.$comment.find('textarea').elastic(); // @ADDON
								
								cv.markup.refresh();
							});
						}
					}
				})
			},
		},
		// element handling
		dom: {
			createTab: function(db){
				var tab = {
					uid:  db.id || ++cv.uid,
					$tab: db.$tab || $('<li class="tab" data-cv-id="'+db.id+'" title="'+db.name+'">' +
								'<span>'+db.name+'</span><button class="close">&times;</button>' +
							'</li>'),
					$document: db.$document || $('<article class="document" data-cv-id="'+db.id+'"></article>'),
					$notes:    db.$notes || $('<ul class="notes" data-cv-id="'+db.id+'"></ul>'),
					document:  db.document,
				};
				cv.tabs[tab.uid] = tab;
				
				return tab;
			},
			createDocument: function(db, tab){
				db = db || {};
				
				var document = {
					$code: $('<pre class="cv-code" contenteditable><code>'+
						(db.text ? db.text.replace(/[<&]/g,function(c){ return c=='<'?'&lt;':'&amp;'; }) : '')
						.split('\n').join('</code><code>')+'</code></pre>'),
					uid:   ++cv.uid,
					db:    db,
					notes: [],
				};
				tab.document = document;
				
				return document;
			},
			createNote: function(db, document){
				db = db || {};
				db.color_id = db.color_id || cv.ui.color_id;
				
				var note = {
					$note: $('<li class="note'+(db.action=='create'?' new':'')+' cv-color-'+db.color_id+'">' +
								'<textarea>'+(db.text || '')+'</textarea>' +
								'<button class="delete" tabindex="-1">&times;</button>' +
								'<button class="reply" tabindex="-1">&crarr;</button>' +
								'<ul class="comments"></ul>' +
							'</li>'),
					uid:      ++cv.uid,
					db:       db,
					comments: [],
				};
				document.notes.push(note);
				
				return note;
			},
			createComment: function(db, note){
				db = db || {};
				
				var comment = {
					$comment: $('<li class="comment'+(db.action=='create'?' new':'')+'">' +
									'<textarea>'+(db.text || '')+'</textarea>' +
									'<button class="delete" tabindex="-1">&times;</button>' +
								'</li>'),
					uid: ++cv.uid,
					db:  db,
				};
				note.comments.push(comment);
				
				return comment;
			},
			findNotes: function(value, key){
				var notes = [];
				if(key === undefined) key = '$note';
				$.each(cv.tab().document.notes, function(){
					if((key=='id' && this.db.id == value) || (key !='id' && this[key][0] === value[0])){
						notes.push(this);
					}
				});
				return $(notes);
			},
/*
			editNote: function(value, key){
				this.findNotes(value, key).each(function(){
					this.$note.addClass('editing');
					this.$note.find('> textarea').removeAttr('readonly').focus().select();
				});
			},
*/
			deleteNote: function(value, key){
				this.findNotes(value, key).each(function(){
					this.db.action = 'delete';
					this.$note.slideUp(200, function(){ $(this).remove(); });
					this.$marker.remove(); // @TODO: pop off wrapper but keep contents
				});
			},
			findComment: function($comment){
				var comment;
				$.each(cv.tab().document.notes, function(){
					if(this.comments){
						$.each(this.comments, function(){
							if(this.$comment[0] === $comment[0]){
								comment = this;
								return false;
							}
						});
					}
				});
				return comment;
			},
			deleteComment: function($comment){
				var comment = this.findComment($comment);
				
				if(comment){
					comment.db.action = 'delete';
					comment.$comment.slideUp(200, function(){ $(this).remove(); });
				}
			},
		},
		// user interface
		ui: {
			colors: {},
			color_id: 4, // yellow
			markRange: function(range, color_id, classes){
				try {
					var span = document.createElement('span');
					span.className = 'cv-marker cv-color-'+(color_id || this.color_id)+(classes ? ' '+classes : '');
					range.surroundContents(span);
				}catch(e){
					console.log(e.message); // @TODO
				}
				return span;
			},
			range2pos: function(node, offset){
				var line   = 0,
					ch     = offset,
					parent = node;
				
				do{
					var sibling = parent;
					while(sibling = sibling.previousSibling) ch += $(sibling).text().length;
				}while((parent = parent.parentNode) && parent.tagName !== 'CODE');
				
				var sibling = parent;
				while(sibling = sibling.previousSibling) line++;
				
				return {line: line, ch: ch, node: node, offset: offset, parent: parent};
			},
			pos2range: function(line, ch){
				var offset = ch,
					parent = cv.tab().document.$code[0].childNodes[line],
					node   = parent.firstChild;
				
				do{
					if(offset > $(node).text().length) offset -= $(node).text().length; else break;
				}while(node = node.nextSibling);
				
				return {line: line, ch: ch, node: node, offset: offset, parent: parent};
			},
			addMarker: function(note){
				var from, to, range, $marker;
				if(note instanceof Selection){
					range = note.getRangeAt(0);
					from  = this.range2pos(range.startContainer, range.startOffset);
					to    = this.range2pos(range.endContainer, range.endOffset);
					note  = {db: {}};
				}else{
					range = document.createRange();
					from = this.pos2range(note.db.from.line, note.db.from.ch);
					to   = this.pos2range(note.db.to.line, note.db.to.ch);
					
					range.setStart(from.node, from.offset);
					range.setEnd(to.node, to.offset);
				}
				
				// swap if necessary
				if(from.line > to.line){
					var tmp = from;
					from = to;
					to = tmp;
					delete tmp;
				}
				
				// add marker
				if(from.node === to.node || from.parent === to.parent){
					var span = this.markRange(range, note.db.color_id, (from.ch == to.ch ? 'cv-bookmark' : ''));
					
					$marker = $(span);
				}else{
					if(from.node.parentNode.tagName == 'CODE' && to.node.parentNode.tagName == 'CODE'){
						var i = to.line, 
							line = $(to.node).closest('code')[0],
							markers = [];
						
						do {
							var subrange = document.createRange();
							subrange.selectNodeContents(line);
							if(i == from.line) subrange.setStart(from.node, this.pos2range(from.line, from.ch).offset);
							if(i == to.line) subrange.setEnd(to.node, this.pos2range(to.line, to.ch).offset);
							markers.push(this.markRange(subrange, note.db.color_id));
							
							i--;
						} while (line !== $(from.node).closest('code')[0] && (line = line.previousSibling));
						
						$marker = $(markers);
					}else{
						console.warn('Can\'t cross select'); // @TODO
					}
				}
				return $marker;
			},
			addTab: function(tab, noSwitch, noAnimation){
				tab = tab || {};
				
				cv.$documents.append(tab.$document.addClass('hidden'));
				cv.$notes.append(tab.$notes.addClass('hidden'));
				tab.$tab.insertAfter('#tabs .add');
				
				if(!noSwitch){
					cv.ui.switchTab(tab.uid);
					if(!noAnimation) tab.$tab.slideUp(0).slideDown(200);
				}
			},
			switchTab: function(uid){
				cv._tab = uid;
				var tab = cv.tab();
				tab.$tab.addClass('selected').siblings().removeClass('selected');
				tab.$document.removeClass('hidden').siblings().addClass('hidden');
				tab.$notes.removeClass('hidden').siblings().addClass('hidden');
				
				if(!tab.loaded){
					cv.api.loadDocument(tab.uid, function(db){
						var document = cv.dom.createDocument(db, tab);
						cv.ui.addDocument(document, tab);
						cv.api.loadNotes(tab.uid);
					});
					tab.loaded = true;
				}
				if(tab.uid != 'new') cv.state.replace({document_id: tab.uid});
				cv.markup.refresh();
			},
			closeTab: function(uid){
				var tab = cv.tab(uid);
				
				tab.$tab.slideUp(200, function(){
					$(this).remove();
				});
				tab.$document.remove();
				tab.$notes.remove();
				
				if(uid == cv.tab().uid){
					var next = tab.$tab.prev().attr('data-cv-id');
					cv.ui.switchTab(next);
				}
				delete tab;
			},
			addDocument: function(document, tab){
				tab = tab || cv.tab();
				
				tab.$document.html(document.$code);
			},
			addNote: function(note, tab){
				tab = tab || cv.tab();
				
				tab.$notes.append(note.$note);
				note.$note.slideUp(0).slideDown(200, function(){
					cv.markup.refresh();
				}).find('textarea').elastic().focus();
			},
			addComment: function(comment, note){
				note.$comments.append(comment.$comment);
				$comment.slideUp(0).slideDown(200, function(){
					cv.markup.refresh();
				}).find('textarea').elastic().focus();
			},
			// scrolling
			scrollContent: function(top, matchNotesTop){
				var $content = $('#content');
				
				$content.stop().animate({scrollTop: top <= 0 ? 0 : top - (matchNotesTop || 0) + $content.find('#header').outerHeight()});
			},
			scrollNotes: function(pos){
				// @TODO
			},
		},
		// url updating
		state: {
			object: {
				bin_id: null,
				document_id: null,
			},
			toURI: function(o){
				o = o || this.object;
				var uri = '';
				
				if(o.bin_id) uri += '/b'+o.bin_id;
				if(o.document_id) uri += '/d'+o.document_id;
				
				return uri;
			},
			replace: function(o){
				this.object = $.extend(this.object, o);
				history.replaceState(this.object, null, cv.state.toURI())
			},
		},
	};
	
	// initialize 'new' tab
	cv.dom.createTab({
		id:        'new',
		$tab:      cv.$tabs.children().last(),
		$document: cv.$documents.children().last(),
		$notes:    cv.$notes.children().last(),
	});
	
	$(document)
		// tabs
		.on('click', '#tabs .tab .close', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			var id = $(this).closest('.tab').attr('data-cv-id');
			cv.ui.closeTab(id);
		})
		.on('click', '#tabs .tab', function(e){
			e.preventDefault();
			
			$(this).addClass('selected').siblings('.selected').removeClass('selected');
			cv.ui.switchTab($(this).attr('data-cv-id'));
		})
		.on('dblclick', '#tabs .tab:not(.add)', function(e){
			e.preventDefault();
			var $this = $(this);
				$span = $this.find('span'),
				$input = $this.find('input');
			
			if(!$input.length) $input = $('<input type="text" name="name" />').insertAfter($span);
			$this.addClass('editing');
			$input.val($span.text()).focus();
		})
		.on('blur', '#tabs .tab input', function(){
			var $tab = $(this).closest('.tab');
			
			$tab.removeClass('editing');
			$tab.find('span').text($(this).val());
		})
		// markers
		.on('keypress', '#content .cv-code', function(e){
			var note = cv.dom.createNote({
					action: 'create',
					document_id: cv.document_id,
				}, cv.tab().document);
			
			var sel = window.getSelection();
			note.$marker = cv.ui.addMarker(sel);
			sel.removeAllRanges();
			cv.ui.addNote(note);
			
			cv.markup.refresh();	
		})
		.on('click', '#content .cv-marker', function(e){
			console.log(e); // @TODO
			cv.ui.scrollNotes(e.pageY);
		})
		
		// sidebar
		.on('click', '#sidebar button', function(e){
			e.preventDefault(); // @TEMP
		})
		// header
		.on('click', '#sidebar header', function(e){
			cv.ui.scrollContent(0);
		})
		.on('click', '#sidebar header button.color', function(e){
			e.preventDefault();
			e.stopPropagation();
		})
		.on('click', '#colors .color', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			$(this).addClass('selected').siblings('.selected').removeClass('selected');
			cv.ui.color_id = $(this).attr('data-id');
		})
		.on('click', '#sidebar header button.settings', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			if($(this).hasClass('active')){
				$(this).removeClass('active');
				$('#settings').addClass('collapsed');
			}else{
				$(this).addClass('active').siblings('.active').trigger('click');
				$('#settings').removeClass('collapsed').find(':input:first').focus();
			}
		})
		.on('change', '#sticky-tabs', function(){
			if($(this).is(':checked')){
				$('body').addClass('sticky-tabs');
			}else{
				$('body').removeClass('sticky-tabs');
			}
		})
		.on('click', '#sidebar footer button.share', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			if($(this).hasClass('active')){
				$(this).removeClass('active');
				$('#share').addClass('collapsed');
			}else{
				$(this).addClass('active').siblings('.active').trigger('click');
				$('#share').removeClass('collapsed');
			}
		})
		.on('click', '#sidebar footer button.password', function(e){
			e.preventDefault();
			
			var unlocked = !$(this).hasClass('unlock');
			
			if($(this).hasClass('active')){
				$(this).removeClass('active');
				$('#' + (unlocked ? '' : 'un') + 'lock').addClass('collapsed');
			}else{
				$(this).addClass('active').siblings('.active').trigger('click');
				$('#' + (unlocked ? '' : 'un') + 'lock').removeClass('collapsed').find(':input').focus();
			}
		})
		.on('blur', '#lock input', function(){
			$('#lock').addClass('collapsed');
			$('#sidebar footer button.password').removeClass('active').addClass('unlock');
		})
		.on('blur', '#unlock input', function(){
			$('#unlock').addClass('collapsed');
			$('#sidebar footer button.password').removeClass('active').removeClass('unlock');
		})
		.on('click', '#sidebar footer button.delete', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			if($(this).hasClass('active')){
				$(this).removeClass('active');
				$('#delete').addClass('collapsed');
			}else{
				$(this).addClass('active').siblings('.active').trigger('click');
				$('#delete').removeClass('collapsed').find(':input').last().focus();
			}
		})
		// settings
		.on('submit', '#auth', function(e){
			e.preventDefault();
			
			$('.authed, .unauthed').toggleClass('hidden'); // @TODO
		})
		// notes
		.on('click focus', '#notes .note', function(){
			var $this = $(this),
				note = cv.dom.findNotes($this)[0];
			
			//cv.ui.scrollContent(cv.tab().document.charCoords(note.db.from, 'local').top, $this.offset().top);
		})
		.on('change', '#notes .note > textarea', function(){
			// mark as dirty
			var $this = $(this),
				item = cv.dom.findNotes($this.closest('.note'))[0];
			if(!item.db.action) item.db.action = 'update';
		})
/*
		.on('click', '#notes .note > .edit', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			cv.dom.editNote($(this).closest('.note'));
		})
*/
		.on('click', '#notes .note > .delete', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			cv.dom.deleteNote($(this).closest('.note'));
		})
		.on('click', '#notes .note > .reply', function(e){
			e.preventDefault();
			
			var note = cv.dom.findNotes($(this).closest('.note'))[0],
				$comment = note.$comments.find('.comment.new');
			
			if(!$comment.length){ // only add a new comment box if one isn't already there
				var comment = cv.dom.createComment({action:'create'}, note); 
				cv.ui.addComment(comment, note);
			}else{
				$comment.find('textarea').focus()
			}
		})
		.on('click', '#notes .note .comments .comment > .delete', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			cv.dom.deleteComment($(this).closest('.comment'));
		})
		.on('change', '#notes .note .comments .comment > textarea', function(){
			// mark as dirty
			var $this = $(this),
				item = cv.dom.findComment($this.closest('.comment'));
			
			if(!item.db.action) item.db.action = 'update';
		})
		.on('blur', '#notes .note .comments .comment > textarea', function(){
			var $this = $(this);
			if(!$this.val()) cv.dom.deleteComment($this.parent());
		})
		
		// form submit
		.on('submit', 'form#db', function(e){
			e.preventDefault();
			
			// generate data object
			var db = {documents: [], notes: [], comments: []};
			if(cv.tab().document.db.action){
				db.documents.push(cv.tab().document.db);
			}
			$.each(cv.tab().document.notes, function(){
				var note = this.db;
				if(note.action){
					note.from_line = note.from.line;
					note.from_ch   = note.from.ch;
					note.to_line   = note.to.line;
					note.to_ch     = note.to.ch;
					note.uid       = this.uid;
					note.text	   = this.$note.find('textarea').val();
					db.notes.push(note);
				}
				if(this.comments){
					$.each(this.comments, function(){
						var comment = this.db;
						if(comment.action){
							comment.uid     = this.uid;
							comment.note_id = note.id;
							comment.text	= this.$comment.find('textarea').val();
							db.comments.push(comment);
						}
					});
				}
			});
			// submit ajax
			if(db.documents.length || db.notes.length || db.comments.length){
				$.ajax({
					url: '/api/db.php',
					type: 'post',
					data: db,
					dataType: 'json',
					success: function(json){
						if(!json.code){
							alert('Saved!');
							
							cv.api.loadNotes();
						}else{
							// @TODO: error
							alert('Error');
						}
					},
					error: function(){
						alert('XHR Error');
					}
				});
			}else{
				alert('Nothing to save!');
			}
		})
		.on('keydown', function(e){
			if(e.ctrlKey && e.keyCode == 83 /* s */){
				e.preventDefault();
				$('form#note').submit();
			}
		})
		
		// password protection
		.on('submit', 'form.password_protected', function(e){
			e.preventDefault();
			
			var $this = $(this),
				$password = $this.find('.password');
			
			$this.addClass('loading');
			$password.removeClass('invalid');
			
			$.ajax({
				url: '/api/db.php',
				type: 'post',
				data: $this.serialize(),
				dataType: 'json',
				success: function(json){
					if(!json.code && json.data){
						$.each(json.data, function(){
							cv.tab(this).loaded = false;
							cv.ui.switchTab(this);
						});
					}else{
						$password.addClass('invalid');
					}
				},
				error: function(){
					$password.addClass('invalid');
				},
				complete: function(){
					$this.removeClass('loading');
					$this[0].reset();
				}
			});
		})
		// new documents / intake
		.on('submit', 'form#intake', function(e){
			e.preventDefault();
			
			var $this = $(this);
			
			$this.addClass('loading');
			
			$.ajax($.extend({
				url: '/api/intake.php',
				type: 'post',
				data: $this.serialize(),
				dataType: 'json',
				success: function(json){
					if(!json.code && json.data){
						$.each(json.data, function(){
							cv.api.loadDocument(this);
						});
						
					}else{
						// @TODO: error
						alert('Error');
					}
				},
				error: function(){
					alert('XHR Error');
				},
				complete: function(){
					$this.removeClass('loading');
					$this[0].reset();
				}
			}, cv.intake));
			cv.intake = {};
		})
		.on('paste', function(e){
			if(!$(e.target).is(':input')){
				e.preventDefault();
				e.stopPropagation();
				
				cv.intake = {
					data: {paste: e.originalEvent.clipboardData.getData('text')},
				};
				$('form#intake').submit();
			}
		})
		.on('change', 'form#intake input[type=file]', function(e){
			var data = new FormData();
			$.each(this.files, function(i, file){
				//var reader = new FileReader();
				//reader.readAsDataURL(this);
				data.append('upload[]', this);
			});
			
			cv.intake = {
				contentType: false,
				processData: false,
				data: data,
			};
			$('form#intake').submit();
		})
		.on('drop', function(e){
			e.preventDefault();
			e.stopPropagation();
			
			var data = new FormData();
			$.each(e.originalEvent.dataTransfer.files, function(){
				//var reader = new FileReader();
				//reader.readAsDataURL(this);
				data.append('drag[]', this);
			});
			
			cv.intake = {
				contentType: false,
				processData: false,
				data: data,
			};
			$('form#intake').submit();
		})
		.on('dragenter dragover', function(e){
			e.preventDefault();
			e.stopPropagation();
		});
	
	// keep canvas current
	$('#content, #documents, #notes').on('scroll', function(){
		cv.markup.refresh();
	});
	$(window).bind('resize', function(){
		canvas.width = $('#content').outerWidth();
		canvas.height = $(document).height();
		cv.markup.refresh();
	}).resize();
	
});