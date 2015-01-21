async = require 'async'
_ = require  'lodash'
fs = require 'fs'
process_cache = []

module.exports = (grunt) ->
  grunt.registerMultiTask 'multicore', 'Run many Grunt tasks across multiple cores', ->
    done = @async()
    options = @options
      limit: Math.max require('os').cpus().length, 2

    files = @filesSrc

    if options.log
      spawn_options =
        stdio: 'inherit'

    child_processes = _.map files, (file, index) ->
      (next) ->
        console.log "Process #{index + 1} spawned"
        process_cache.push grunt.util.spawn
          cmd: 'grunt'
          args: ['multitask', "--child=#{file}"]
          opts: spawn_options
        , (err, result, code) ->
          if err or code > 0
            grunt.warn result.stderr or result.stdout
            grunt.log.writeln '\n' + result.stdout
          next()

    async.parallelLimit child_processes, options.limit, ->
      done()

process.on 'exit', ->
  _.each process_cache, (p) ->
    p.kill();
