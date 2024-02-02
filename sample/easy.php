<html>
<body>
<?php
  $payload = $_POST['name'];
  $payload2 = $_GET['name'];
  $payload3 =htmlspecialchars($payload2, ENT_QUOTES, 'UTF-8');
  echo $payload;
  if($payload2 ){
    echo $payload3;
  }
?>
</body>
</html>