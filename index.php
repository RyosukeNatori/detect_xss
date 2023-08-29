<html>

<body>
  <?php
  $query = $_GET['q'];

  if ($query) {
    $query = $_GET['q'];
    echoHello($query);
    echo '<div>' . $query . '</div>';
    if ($query == 'h') {
      echoHelloWorld($query);
    }
  }

  function echoHello($query)
  {
    echo '<div>Hello</div>';
    $two = substr($query, 2, 1);
  }
  ?>
  <div></div>
  <?php
  if ($query) {
    echoHello($query);
    echo '<div>' . $query . '</div>';
  }

  function echoHelloWorld($query)
  {
    echoHello($query);
    echo '<div>Hello World</div>';
    $two = substr($query, 2, 1);
  }
  ?>
</body>

</html>