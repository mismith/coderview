<?php
	//error_reporting(0);
	session_start();
	date_default_timezone_set('America/Edmonton');
	require_once('../../config.php');
	mysql_connect(DB_HOST,DB_USER,DB_PASS);
	mysql_select_db(DB_PREFIX.'coderview');
	
	header('Content-type: application/json');
	$response = array('code' => 0);
	
	try {
		if($_POST){
			if($_POST['password'] && $_POST['document_id']){
				// checking password
				$password = mysql_fetch_object(mysql_query("SELECT `id`,`password` FROM `passwords` WHERE `id` = (SELECT `password_id` FROM `documents` WHERE `id` = '".mysql_real_escape_string($_POST['document_id'])."')"));
				
				if(md5($_POST['password']) === $password->password){
					$_SESSION['authenticated_passwords'][intval($password->id)] = date('Y-m-d H:i:s');
					$response['data'][] = $_POST['document_id'];
				}else{
					throw new Exception('Password incorrect. Please try again.');
				}
			}else{
				// updating models
				foreach(array('documents','notes','comments') as $table){
					if(count($_POST[$table])){
						switch($table){
							case 'documents':
								$cols = array('bin_id','name','text','type','intake_method','password_id','password');
								break;
							case 'notes':
								$cols = array('document_id','text','from_line','from_ch','to_line','to_ch','color_id');
								break;
							case 'comments':
								$cols = array('note_id','text');
								break;
						}
						foreach($_POST[$table] as $item){
							try {
								$action = $item['action'];
								$q = "";
								$escaped = array();
								if($action == 'create' || $action == 'update'){
									foreach($cols as $k){
										if($k == 'password'){
											// add new password
											mysql_query("INSERT INTO `passwords` (`password`,`created`) VALUES ('".md5($item[$k])."','".date('Y-m-d H:i:s')."')");
											// only add the id
											$escaped['password_id'] = mysql_insert_id();
										}else{
											// prevent SQL injection
											if(isset($item[$k])) $escaped[$k] = mysql_real_escape_string($item[$k]);
										}
									}
									if(count($escaped)){
										if($action == 'create'){
											// reference current user
											if($_SESSION['user_id']) $escaped['user_id'] = mysql_real_escape_string($_SESSION['user_id']);
											// mark date created
											$escaped['created'] = date('Y-m-d H:i:s');
											// build the query
											$q = "INSERT INTO `$table` (`".join("`,`",array_keys($escaped))."`) VALUES ('".join("','",$escaped)."')";
										}else{
											// stringify 'em
											array_walk($escaped, function($v, $k){
												global $q;
												$q .= ($q?", ":"") . "`$k` = '$v'";
											});
											// build the query
											$q = "UPDATE `$table` SET $q WHERE `id` = '".$item['id']."'";
										}
									}
								}elseif($action == 'delete'){
									$q = "DELETE FROM `$table` WHERE `id` = '".$item['id']."'";
								}
								if($q){
									if($result = mysql_query($q)){
										if($action == 'create') $response['data']['created'][$item['uid']] = mysql_insert_id();
										if($escaped['password_id']) $_SESSION['authenticated_passwords'][$escaped['password_id']] = date('Y-m-d H:i:s');
									}else{
										throw new Exception(mysql_error());
									}
								}else{
									throw new Exception('No actions specified.');
								}
							}catch(Exception $e){
								$response['code'] = 200;
								$response['errors'][] = $e->getMessage();
							}
						}
					}
				}
			}
		}elseif($_GET){
			$id = mysql_real_escape_string($_GET['document_id']);
			if($id){
				$result = mysql_query("SELECT * FROM `documents` WHERE `id` = '".$id."' ORDER BY `name`");
				if($result){
					$document = mysql_fetch_assoc($result);
					
					if(!$document['password_id'] || in_array($document['password_id'], array_keys((array) $_SESSION['authenticated_passwords']))){
						$q = "";
						if(isset($_GET['comments'])){
							$q = "SELECT * FROM `comments` WHERE `note_id` IN (SELECT `id` FROM `notes` WHERE `document_id` = '".$id."')";
						}elseif(isset($_GET['notes'])){
							$q = "SELECT * FROM `notes` WHERE `document_id` = '".$id."' ORDER BY `from_line`,`from_ch`,`to_line`,`to_ch`,'text'";
						}
						if($q){
							$result = mysql_query($q);
							
							$items = array();
							while($item = mysql_fetch_assoc($result)){
								$item['text'] = htmlspecialchars($item['text']);
								$items[] = $item;
							}
							$response['data'] = $items;
						}else{
							$response['data'] = $document;
						}
					}else{
						$response['data'] = array(
							'text' => password_protected($id),
						);
						throw new Exception('Document is password protected.', 403);
					}
				}else{
					throw new Exception('Document not found.');
				}
			}else{
				throw new Exception('Document not specified.');
			}
		}
	}catch(Exception $e){
		//var_dump($e);
		$response['code'] = $e->getCode() ?: 200;
		$response['errors'][] = $e->getMessage();
	}
	
	echo json_encode($response, JSON_NUMERIC_CHECK);
	
	
	// helpers
	function password_protected($document_id){
		return '
	<form class="password_protected" method="post" action="/api/db.php">
		<fieldset class="password cv-box">
			<h3>Password Protected</h3>
			<label>
				<input type="hidden" name="document_id" value="'.$document_id.'">
				<input type="password" name="password" placeholder="Password">
			</label>
		</fieldset>
	</form>';
	}