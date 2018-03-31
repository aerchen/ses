'use strict'
const _ = require('lodash'), 
      fs = require('fs'),
      path = require('path');

module.exports.configloader = function (context) {
    context = context || {};
    let appPath = context.appPath || process.cwd();

    let configDir = path.resolve(appPath, 'config');
    let configFiles = fs.readdirSync(configDir);

    let env = context.env || process.env.NODE_ENV || 'development';
    let envConfigFile = `${configDir}/env/${env}`;

    let config = {};
    let envConfig = {};
    let localConfig = {};

    configFiles.forEach(file => {
        if(!_.endsWith(file, '.js')) return;
        let fileContent = loadFile(path.resolve(configDir, file));
        if(file === 'local.js')
            localConfig = fileContent;
        else
            _.merge(config, fileContent);
    });
    envConfig = loadFile(envConfigFile);

    _.merge(config, envConfig);
    _.merge(config, localConfig);

    return config;
};

function loadFile(filePath) {
    let content = null;
    try {
        content = require(filePath);
    }
    catch(e) {
        console.warn(`Failed to require ${filePath}, error ${e}`);
    }
    return content;
}


