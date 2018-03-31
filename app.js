'use strict'

process.chdir(__dirname)

const _ = require('lodash')
const async = require('async')
const EventEmitter = require('events')
const express = require('express')
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const yaml = require('js-yaml')
const swagger = require('swagger-tools')
const utils = require('./utils')

global._ = _ 
global.async = async 
global.Promise = Promise
global.config = utils.configloader()
Promise.promisifyAll(utils)

class Service extends EventEmitter {
    constructor(config) {
        super()
        this.config = config
        this.hooks = {}
    }

    async lift() {
        this.log = utils.initLogger(config.logger)
        console.log('logger load success')

        let swaggerString = fs.readFileSync('./api/swagger/swagger.yaml')
        let swaggerSchema = yaml.safeLoad(swaggerString)
        console.log('swagger schema load success')

        _.forEach(utils.includeAll({
            depth: 1,
            dirname: path.join(process.cwd(), 'api/services')
        }), (service, name) => {
            if(_.isObject(service))
                global[name] = Promise.promisifyAll(service)
        })
        console.log('servcies load success')

        let hooks = utils.includeAll({
            depth: 1,
            dirname: path.join(process.cwd(), 'api/hooks')
        })

        hooks.orm = function(ctx) {
            return {
                initialize:  function(cb) {
                    ctx.models = {}
                    _.forEach(utils.includeAll({
                        depth: 1,
                        dirname: path.join(process.cwd(), 'api/models')
                    }), (model, name) => {
                        global[name] = ctx.models[name] = model
                    })
                    cb()
                }
            }
        }

        console.log(`${_.keys(hooks).length} hook start to load`)
        await Promise.map(_.keys(hooks), name => {
            let hook = hooks[name](this)
            return new Promise((resolve, reject) => {
                let timer = setTimeout(() => {
                    reject(`hook ${name} take too much time`)
                }, config.hookTimeout || 3000)
                hook.initialize((err) => {
                    clearTimeout(timer)
                    if(err) return reject(err)

                    console.log(`hook:${name}:loaded`)
                    Promise.promisifyAll(hook)
                    this.hooks[name] = hook
                    this.emit(`hook:${name}:loaded`, name)
                    resolve()
                })
            })
        })
        console.log('hooks load success')

        let server = express()
		server.get('/health', (req, res) => res.end())
        swagger.initializeMiddleware(swaggerSchema, middleware => {
            console.log('swagger init success')
            server.use(middleware.swaggerMetadata())

            let middlewares = utils.includeAll({
                depth: 1,
                dirname: path.join(process.cwd(), 'api/middlewares')
            })

            server.use(middlewares.responses)
            server.use('/v1/*', middlewares.requestValidator)
            server.use('/device-svc/*', middlewares.requestValidator)
            server.use(middlewares.routers)

            // Route validated requests to serverropriate controller
            server.use(middleware.swaggerRouter({
                useStubs: false,
                controllers: './api/controllers'
            }))

            // Serve the Swagger documents and Swagger UI
            //   http://localhost:3000/docs => Swagger UI default
            //   http://localhost:3000/dist => Swagger UI updated
            //   http://localhost:3000/api-docs => Swagger document
            server.use(middleware.swaggerUi({
                swaggerUi: '/dist',
            }))

            // Start the server
            server.listen(config.port, config.host, () => {
                this.server = server
                console.log('listening', config.host, config.port)
            })
        })
    }

    after(events, cb) {
        let index = 0
        events.forEach(et => {
            this.once(et, () => {
                if(++index === events.length) cb()
            })
        })
    }
}
module.exports = Service

global.App = new Service(config)
App.lift().catch(err => {
    console.error('lift App fail', err)
    process.exit()
})

process.on('SIGINT', function() {
    console.error('SIGINT', arguments)
    if(App.hooks.discover)
        App.hooks.discover.client.deinit()
    process.exit()
})

process.on('uncaughtException',  function() {
    console.error('Exception', arguments)
    if(App.hooks.discover)
        App.hooks.discover.client.deinit()
    process.exit()
})



