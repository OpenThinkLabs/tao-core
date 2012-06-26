<?php

/**
 * Dedicated database wrapper used for database creation.
 * Its purpose is to establish a connection with a database
 * and load a given SQL file containing with an appropriate
 * implementation of SQLParser.
 * 
 * 
 * @see ADOConnection
 * @see tao_install_utils_SpConnector
 * @author Bertrand CHEVRIER <bertrand.chevrier@tudor.lu>
 * @author Jerome BOGAERTS <jerome.bogaerts@tudor.lu>
 *
 */
class tao_install_utils_DbCreator extends tao_install_utils_DbConnector{
	
	private $sqlParser;
	
	public function __construct( $host = 'localhost', $user = 'root', $pass = '', $driver = 'mysql', $dbName = ""){
		parent::__construct($host, $user, $pass, $driver, $dbName);
		$this->setSQLParser(new tao_install_utils_SimpleSQLParser());
	}
	
	public function getSQLParser(){
		return $this->sqlParser;
	}
	
	public function setSQLParser($sqlParser){
		$this->sqlParser = $sqlParser;
	}
	
	/**
	 * Load a given SQL file containing simple statements.
	 * SQL files containing Stored Procedure or Function declarations
	 * are not supported. Use tao_install_utils_SpConnector instead.
	 * 
	 * @param string $file path to the SQL file
	 * @param array repalce variable to replace into the file: array keys are search with {} around
	 * @throws tao_install_utils_Exception
	 */
	public function load($file, $replace = array())
	{
		$parser = $this->getSQLParser();
		$parser->setFile($file);
		$parser->parse();
		
		//make replacements
		foreach ($parser->getStatements() as $statement){
			//make replacements
			$finalStatement = $statement;
			foreach($replace as $key => $value){
				$finalStatement = str_replace('{'.strtoupper($key).'}', $value, $statement);
			}
			
			return $this->adoConnection->Execute($finalStatement);
		}
	}
}
?>