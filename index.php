<?php
	session_start();
	date_default_timezone_set('America/Edmonton');
	require_once('../config.php');
	mysql_connect(DB_HOST,DB_USER,DB_PASS);
	mysql_select_db(DB_PREFIX.'coderview');
	
	// @DEBUG
	//unset($_SESSION['authenticated_passwords']);
	//unset($_SESSION['user_id']);
	
	class AnonUser {
		private static $salt = 'MlJ1ktAHv%l%>CL{wD4l?c$|w@gme0%57^-~X|+Xd$fJFw[D`Rdy$zWP`Z-/gy/f';
		
		public static function factory($id = NULL, $hash = NULL){
			return new self($id, $hash);
		}
		public function __construct($id = NULL, $hash = NULL){
			if($id && ($user = self::read($id))){
				if($id == $_SESSION['user_id'] || self::validate($user, $hash)) return $user;
			}
			return self::create();
		}
		
		private static function read($user_id){
			$result = mysql_query("SELECT * FROM `users` WHERE `id` = '".mysql_real_escape_string($user_id)."'");
			return $result ? mysql_fetch_object($result) : FALSE;
		}
		private static function create(){
			mysql_query("INSERT INTO `users` (`created`) VALUES (NOW())");
			$user = self::read(mysql_insert_id());
			$user->hash = self::hash($user->id, $user->created);
			self::save($user->id, $user->hash, TRUE);
			return $user;
		}
		private static function save($user_id, $hash, $update_db = FALSE){
			$expires = time()+60*60*24*60;
			setcookie('user_id', $_SESSION['user_id'] = $user_id, $expires);
			setcookie('hash', $hash, $expires);
			
			$result = TRUE;
			if($update_db) $result = mysql_query("UPDATE `users` SET `anonymous_hash` = '".mysql_real_escape_string($hash)."' WHERE `id` = '".mysql_real_escape_string($user_id)."'");
			
			return $result;
		}
		
		private static function hash($user_id, $created){
			return md5(join($user_id.$created, explode('|',self::$salt)));
		}
		public static function validate($user, $hash){
			return $user->anonymous_hash == $hash;
		}
	}
	
	$U = AnonUser::factory($_SESSION['user_id'] ? $_SESSION['user_id'] : $_COOKIE['user_id'], $_COOKIE['hash']);
	
	$state = array(
		'bin_id'      => $_GET['bin_id'],
		'document_id' => $_GET['document_id'],
	);
	
	$colors = array();
	$result = mysql_query("SELECT * FROM `colors`");
	while($color = mysql_fetch_object($result)) $colors[] = $color;
	
	$documents = array();
	if($state['bin_id']){
		$result = mysql_query("SELECT * FROM `documents` WHERE `bin_id` = '".$state['bin_id']."'");
		$selected = FALSE;
		while($row = mysql_fetch_object($result)){
			$row->selected = ($row->id == $state['document_id']);
			if($row->selected) $selected = TRUE;
			
			$documents[$row->id] = $row;
		}
		if(!$selected && count($documents)){ // make sure a tab is selected if none specified
			$document = current($documents);
			$document->selected = TRUE;
		}
	}elseif($state['document_id']){
		$document = mysql_fetch_object(mysql_query("SELECT * FROM `documents` WHERE `id` = '".$state['document_id']."'"));
		$document->selected = TRUE;
		$documents[$document->id] = $document;
	}
/*
	foreach($documents as $document){
		if($document->password_id) $document->password_protected = !in_array($document->id, array_keys((array) $_SESSION['authenticated_passwords']));
	}
*/
	header('Content-type: text/html; charset=UTF-8'); // appease Google PageSpeed
?><!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>coderview</title>
	
	<link rel="stylesheet" href="/assets/css/style.css" type="text/css">
	<link rel="shortcut icon" href="/assets/img/favicon.png" type="image/png">
	<style type="text/css"><?php foreach($colors as $i=>$color) echo '.cv-color-'.$i.'{background-color:rgb('.$color->rgb.')}' ?></style>
	<link href="http://fonts.googleapis.com/css?family=Telex|Inconsolata" rel="stylesheet" type="text/css">
	
	<meta name="viewport" content="width=320, user-scalable=no">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-status-bar-style" content="black">
</head>
<body>

<div id="columns">
	<section id="content">
		<header id="header">
			<h1><a href="/">code<span class="cv-color-4">r</span>view</a></h1>
			<ul id="tabs">
				<li class="tab add selected" data-cv-id="new" title="New Document"><span>+</span></li>
			</ul>
		</header>
		<section id="documents">
			<article class="document new" data-cv-id="new">
				<form id="intake" method="post" action="/api/intake.php">
					<ul id="intakes">
						<li class="intake cv-box drag">
							<label>
								<span class="cv-glyph">move</span>
								<span>Drag & Drop</span>
							</label>
						</li>
						<li class="intake cv-box upload">
							<label>
								<span class="cv-glyph">upload</span>
								<span>Upload</span>
								<input type="file" name="files[]" multiple>
							</label>
						</li>
						<li class="intake cv-box paste">
							<label>
								<span class="cv-glyph">clipboard</span>
								<span>Copy & Paste</span>
							</label>
						</li>
						<li class="intake cv-box url">
							<label>
								<span class="cv-glyph">web</span>
								<input type="url" name="url" placeholder="URL">
							</label>
						</li>
					</ul>
				</form>
			</article>
		</section>
	</section>
	<aside id="sidebar" class="">
		<form id="db" method="post" action="/api/db.php">
			<header>
				<button class="colors">
					<ul id="colors"><?php
						foreach($colors as $i=>$color) echo '<li class="color cv-color-'.$i.($i==4?' selected':'').'" data-id="'.$i.'"></li>';
					?></ul>
				</button>
				<button class="settings">
					<span class="user authed hidden"><span class="cv-glyph">twitter</span> micinesmith</span>
					<span class="unauthed cv-glyph">usercog</span>
				</button>
			</header>
			<section id="notes">
				<ul class="notes new" data-cv-id="new">
					<li>
						<h3>Heading Title</h3>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
						<h3>Heading Title</h3>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
						<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
					</li>
				</ul>
			</section>
			<section id="share" class="cv-prompt collapsed">
				<fieldset>
					<label>
						<span>Bin</span>
						<input type="text" value="http://cdr.vu/b1/d1">
					</label>
					<label>
						<span>Document</span>
						<input type="text" value="http://cdr.vu/d1">
					</label>
				</fieldset>
			</section>
			<section id="lock" class="cv-prompt collapsed">
				<fieldset>
					<label>
						<span>New Password:</span>
						<input type="password" name="password">
					</label>
				</fieldset>
			</section>
			<section id="unlock" class="cv-prompt collapsed">
				<fieldset>
					<label>
						<span>Password:</span>
						<input type="password" name="password">
					</label>
				</fieldset>
			</section>
			<section id="delete" class="cv-prompt collapsed">
				<fieldset>
					<div>
						<span>Are you sure?</span>
						<button><span class="cv-glyph">no</span></button>
						<button><span class="cv-glyph">yes</span></button>
					</div>
				</fieldset>
			</section>
			<footer class="document">
				<button class="save"><span class="cv-glyph">save</span> Save</button>
				<button class="fork"><span class="cv-glyph">fork</span> Fork</button>
				<button class="share"><span class="cv-glyph">share</span> Share</button>
				<button class="password"><span class="cv-glyph"><span>key</span><span>unlock</span></span></button>
				<button class="delete"><span class="cv-glyph">trash</span></button>
			</footer>
		</form>
	</aside>
	<aside id="settings" class="collapsed">
		<form id="auth" method="post" action="/api/db.php">
			<div class="authed" style="margin-right:44px;">
				<input type="email" name="email" placeholder="Email">
				<input type="password" name="password" placeholder="Password">
				<button class="forgot" title="Forgot your password?">?</button>
			</div>
			<div class="connect authed">
				<span><small>or</small> Login with:</span>
				<button title="GitHub"><span class="cv-glyph">github</span></button>
				<button title="Stack Overflow"><span class="cv-glyph">stackoverflow</span></button>
				<button title="Reddit"><span class="cv-glyph">reddit</span></button>
				<button title="Google Plus"><span class="cv-glyph">gplus</span></button>
				<button title="Facebook"><span class="cv-glyph">facebook</span></button>
				<button title="Twitter"><span class="cv-glyph">twitter</span></button>
			</div>
			<div class="unauthed hidden">
				<button title="Logout"><span class="cv-glyph">exit</span> Logout</button>
			</div>
		</form>
		<div class="preferences authed hidden">
			<h3>User Interface</h3>
			<fieldset>
				<label>
					<input type="checkbox" id="sticky-tabs">
					<span>Always Show Tabs</span>
				</label>
			</fieldset>
		</div>
		<div class="notifications authed hidden">
			<h3>Notifications</h3>
			<fieldset>
				<div>
					<span>Event</span>
					<em>Never</em>
					<em>Daily</em>
					<em>Weekly</em>
				</div>
				<label>
					<span>Comments</span>
					<input type="radio" name="notfication[comment]" value="0">
					<input type="radio" name="notfication[comment]" value="1" checked>
					<input type="radio" name="notfication[comment]" value="2">
				</label>
				<label>
					<span>Forks</span>
					<input type="radio" name="notfication[fork]" value="0">
					<input type="radio" name="notfication[fork]" value="1" checked>
					<input type="radio" name="notfication[fork]" value="2">
				</label>
			</fieldset>
		</div>
	</aside>
</div>
<canvas id="canvas"></canvas>

<script src="//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
<script src="/assets/js/jquery.elastic.min.js"></script>
<script src="/assets/js/core.js"></script>
<script>
$(function(){
	cv.ui.colors = {<?php foreach($colors as $i=>$color) echo $i.':"'.$color->rgb.'",'; ?>};
	cv.state.object = <?php echo json_encode($state); ?>;
	
<?php if(count($documents)) foreach($documents as $document){ ?>
	cv.ui.addTab(cv.dom.createTab(<?php echo json_encode(array('id' => $document->id, 'name' => $document->name)); ?>), <?php echo $document->selected ? 'false' : 'true'; ?>, true);
<?php } ?>
});
</script>
</body>
</html>