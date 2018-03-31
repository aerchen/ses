'use strict'

const RejectEnvs = ['staging', 'production']
module.exports = function (req, res, next) {

    res.badRequest = function(err) {
        console.warn(`${req.headers.__requestid} send bad request: `, err)
        res.status(400).json(err)
    }

    res.serverError = function(err) {
        console.error(`${req.headers.__requestid} send server error: `, err)
        if(RejectEnvs.indexOf(process.env.NODE_ENV) > -1
            || _.isUndefined(err)
        )
            res.status(500).end()
        else
            res.status(500).json(err)
    }

    res.reject = function(err) {
        if(err && err.errcode) res.badRequest(err)
        else res.serverError(err)
    }

    res.resolve = function() {
        console.log(`${req.headers.__requestid} respond: `, arguments)
        if(!arguments.length)
            res.status(204).end()
        else if(arguments.length === 2
            && 'number' === typeof arguments[0])
            res.status(arguments[0]).json(arguments[1])
        else
            res.json(arguments[0])
    }

    next()
}

