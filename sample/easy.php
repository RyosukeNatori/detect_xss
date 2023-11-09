<html>

<body>
  <?php
  $text = `cat /tmp/tainted.txt`;
  $echoString = $text;
  if ($echoString) {
    echo '<div>' . $echoString . '</div>';
  }
  print_r($text);
  ?>
</body>

</html>