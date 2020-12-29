let apiGateway = require('./src/apiGateway')
let s3 = require('./src/s3bucket')
let lambda = require('./src/lambda')
;(async () => {
  try {
    await apiGateway.destroy();
    await lambda.destroy();
    await s3.destroy();
  }catch(err){
    console.log(err)
  }
})();