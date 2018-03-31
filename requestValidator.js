'use strict';
const validate = require('jsonschema').validate;
const uid = require('uid2')

module.exports = function(req, res, next) {
    if(!('object' === typeof req.swagger
        && req.swagger.operationPath))
        return res.status(404).end()

    if(!req.headers.__requestid)
        req.headers.__requestid = `internal_` + uid(8)
    console.log(req.headers.__requestid, req.method,
        req.originalUrl, req.query, req.body)

    let err = null
    let keys = _.keys(req.swagger.params)
    for(let key of keys) {
        let param = req.swagger.params[key]
        let schema = param.schema
        let valid = validate(param.value, schema.schema || schema)
        if(!valid.valid) {
            if(!['staging', 'production'].includes(process.env.NODE_ENV))
                console.warn(key, param.value, valid)

            let error = valid.errors[0]
            let keys = error.property.split('.')
            if(_.startsWith(keys[0], 'instance'))
                keys[0] = keys[0].replace('instance', key)
            else
                keys[0] = key
            if(error.name === 'required') {
                if(error.argument) keys.push(error.argument)
                err = config.errcode.Missing(keys.join('.'))
            }
            else {
                err = config.errcode.Format(keys.join('.'))
                let id = keys[keys.length - 1]
                if(id === 'productId')
                    err = config.errcode.UNKNOWN_TYPE
                else if(id === 'did')
                    err = config.errcode.UnknownDevice
            }
            break
        }
    }
    if(err) res.badRequest(err)
    else next()
};

