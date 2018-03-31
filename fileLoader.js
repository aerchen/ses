'use strict'

const _ = require('lodash')
const includeAll = require('include-all')

module.exports.includeAll = function(opts) { 
    let options = {
        filter		:  /(.+)\.js$/,
        excludeDirs : /^\.(git|svn)$/
    }
    _.merge(options, opts)

    let files = includeAll(options)
    _.each(files, function(file, filename) {
        if(_.isUndefined(file)) delete files[filename]
    })
    return files
}

