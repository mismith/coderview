<?php
	//error_reporting(0);
	session_start();
	date_default_timezone_set('America/Edmonton');
	require_once('../../config.murray.php');
	mysql_connect(DB_HOST,DB_USER,DB_PASS);
	mysql_select_db(DB_PREFIX.'coderview');
	
	header('Content-type: application/json');
	$response = array('code' => 0);
	$user_id = $_SESSION['user_id'] ?: NULL;
	
	try {
		if($_FILES){
			// normalize $_FILES
			$_files = array();
			foreach($_FILES as $method=>$fields) foreach($fields as $name=>$values) foreach($values as $i=>$value) $_files[$method][$i][$name] = $value;
			// add files to db
			foreach($_files as $method => $files){
				foreach($files as $file){
					$values = array(
						'user_id' => $user_id,
						'name' => mysql_real_escape_string($file['name']),
						'text' => mysql_real_escape_string(file_get_contents($file['tmp_name'])),
						'type' => mysql_real_escape_string($file['type']),
						'intake_method' => mysql_real_escape_string($method),
						'created' => date('Y-m-d H:i:s'),
					);
					mysql_query("INSERT INTO `documents` (`".join("`,`", array_keys($values))."`) VALUES ('".join("','",$values)."')");
					$response['data'][] = mysql_insert_id();
				}
			}
		}elseif($_POST['paste']){
			$values = array(
				'user_id' => $user_id,
				'name' => 'Paste'.date('YmdHis'),
				'text' => mysql_real_escape_string($_POST['paste']),
				'intake_method' => 'paste',
				'created' => date('Y-m-d H:i:s'),
			);
			mysql_query("INSERT INTO `documents` (`".join("`,`", array_keys($values))."`) VALUES ('".join("','",$values)."')");
			$response['data'][] = mysql_insert_id();
		}elseif($_POST['url']){
			$values = array(
				'user_id' => $user_id,
				'name' => mysql_real_escape_string(trim(preg_replace('@^[a-z]+:///?@', '', $_POST['url']), '/#?')),
				'text' => mysql_real_escape_string(@file_get_contents($_POST['url'])),
				'intake_method' => 'url',
				'created' => date('Y-m-d H:i:s'),
			);
			mysql_query("INSERT INTO `documents` (`".join("`,`", array_keys($values))."`) VALUES ('".join("','",$values)."')");
			$response['data'][] = mysql_insert_id();
		}
	}catch(Exception $e){
		$response['code'] = 200;
		$response['error'] = $e->getMessage();
	}
	
	echo json_encode($response, JSON_NUMERIC_CHECK);