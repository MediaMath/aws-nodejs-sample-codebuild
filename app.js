var port = process.env.PORT || 3000,
    http = require('http'),
    fs = require('fs'),
    aws = require('aws-sdk'),
    t1Api = require('./t1api'),
    readonlyCount = 0,
    html = fs.readFileSync('index.html');

var log = function(entry) {
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

let scheduledReadonlyMode = function(req, res) {
    return scheduled(true, req, res);
}

let scheduledUpdateMode = function(req, res) {
    return scheduled(false, req, res);
}

let scheduled = function(readonlyMode, req, res) {
    //log(readonlyMode + ':' + req + ':' + res);
    /*log('Mode:' + readonlyMode + 
        ', Received task ' + req.headers['x-aws-sqsd-taskname'] + 
        ' scheduled at ' + req.headers['x-aws-sqsd-scheduled-at']);*/
    if (readonlyMode) {
        log('readonlyCount:'+readonlyCount);
        if (0 == readonlyCount) {
            /*let params = {
                FunctionName: funcName,
                InvokeArgs: "{}"
            };
            return aws.Lambda
                .invokeAsync(params)
                .promise()
                .then((data) => console.log("Recursed."));*/
            const techsol_config_json = {
              name: "ts-autotagcreatives-codebuild",
              client: "Quotient",
              mm_orgs: [101656],
              debug: true,
              lookbackdays: 1,
              tags: [
                {
                  tag_check_string: "z.moatads.com/quotientmediamath778352909812/moatad.js",
                  tag: "<noscript class='MOAT-quotientmediamath778352909812?moatClientLevel1=[AD_ATTR.advertiser]&amp;moatClientLevel2=[AD_ATTR.campaign]&amp;moatClientLevel3=[AD_ATTR.strategy]&amp;moatClientLevel4=[AD_ATTR.creative]&amp;moatClientSlicer1=[BID_ATTR.site]&amp;zMoatSZ=[AD_ATTR.width]x[AD_ATTR.height]'></noscript><script src='https://z.moatads.com/quotientmediamath778352909812/moatad.js#moatClientLevel1=[AD_ATTR.advertiser]&moatClientLevel2=[AD_ATTR.campaign]&moatClientLevel3=[AD_ATTR.strategy]&moatClientLevel4=[AD_ATTR.creative]&moatClientSlicer1=[BID_ATTR.site]&zMoatSZ=[AD_ATTR.width]x[AD_ATTR.height]' type='text/javascript'></script>",
                  enabled: true
                },
                {
                  tag_check_string: "s.thebrighttag.com/px?site=i54834M",
                  tag: "<img style='visibility:hidden;display:none;' height='1' width='1' src='https://s.thebrighttag.com/px?site=i54834M&referrer=ad%3Aimp&channel=MM&cr=[AD_ATTR.creative]&line=[AD_ATTR.strategy]'>",
                  enabled: false
                }
              ]
            };
            t1Api.login()
                .then(() => {
                  techsol_config_json.mm_orgs.forEach(orgId => {
                    techsol_config_json.tags.forEach(tag => {
                      const tagCheckStr = tag.tag_check_string;
                      const tagToBeAdded = tag.tag;
                      const tagEnabled = tag.enabled === "true";
                      if (tagEnabled) {
                        t1Api.getAllDisplayCreatives(/*orgId*/198794, /*'advertiser.agency.organization'*/'advertiser')
                          .then(results => {

                            for (let creative of results) {
                                log(creative);
                              /*t1api.tagCreative(creativeId, tagCheckStr, tagToBeAdded)
                                .then(() => {
                                  callback(null, { success: true });
                                })
                                .catch((error) => {
                                  callback(error, { success: false });
                                });*/
                            }
                          });
                      } else {
                        log(`mm_org "${orgId}" is "${tagEnabled ? 'enabled' : 'disabled'}" for adding tag "${tagCheckStr}"`);
                      }
                    });
                  });
                });
        }
        readonlyCount++;
    } else {
        log(`TO BE RUN IN UPDATE MODE HERE`);
    }
}

var server = http.createServer(function (req, res) {
    if (req.method === 'POST') {
        var body = '';

        req.on('data', function(chunk) {
            body += chunk;
        });

        req.on('end', function() {
            if (req.url === '/') {
                log('Received message: ' + body);
            } else if (req.url = '/scheduledReadonlyMode') {
                scheduledReadonlyMode(req, res);
            } else if (req.url = '/scheduledUpdateMode') {
                scheduledUpdateMode(req, res);
            }

            res.writeHead(200, 'OK', {'Content-Type': 'text/plain'});
            res.end();
        });
    } else {
        res.writeHead(200);
        res.write(html);
        res.end();
    }
});

// Listen on port 3000, IP defaults to 127.0.0.1
server.listen(port);

// Put a friendly message on the terminal
console.log('Server running at http://127.0.0.1:' + port + '/');
