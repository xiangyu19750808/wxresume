const express = require(express);
const app = express();
app.use(express.json());

app.post(/test, (req, res) => {
  console.log(Body:, req.body);
  res.json({body: req.body});
});

app.listen(3001, () => console.log(Test on 3001));
