'use strict';
var padStdio = require('pad-stdio');
var async = require('async');
var cint = require('cint');
var cpCache = [];

module.exports = function (grunt) {
  grunt.registerMultiTask('multicore', 'Run many Grunt tasks across multiple cores', function () {
    var spawnOptions;
    var cb = this.async();
    var options = this.options({
      limit: Math.max(require('os').cpus().length, 2)
    });
    // Set the tasks based on the config format
    var tasks = this.data.tasks || this.data;
    var target = this.target;
    var taskNames = [];

    // Ensure tasks (or task targets) are an array of strings.
    if (grunt.util.kindOf(tasks) === 'object') {
      if (tasks.options) {
        delete tasks.options;
      }
      taskNames = Object.keys(tasks).map(function (taskName) {
        return target + ':' + taskName;
      });
    }
    else if (grunt.util.kindOf(tasks) === 'array') {
      tasks.forEach(function (task) {
        if (grunt.util.kindOf(task) === 'string') {
          grunt.util.error('Task arrays must be strings.');
        }
      });
    }
    else {
      grunt.util.error('Tasks have not been provided.');
    }

    // Optionally log the task output
    if (options.log) {
      spawnOptions = { stdio: 'inherit' };
    }

    var childTaskChunks = cint.chunk(taskNames, options.limit);

    // Create child tasks for each chunk
    var taskFuncs = childTaskChunks.map(function (taskChunk) {
      return function (next) {
        var cp = grunt.util.spawn({
          grunt: true,
          args: ['multicore-child:' + encodeURIComponent(JSON.stringify(taskChunk))],
          opts: spawnOptions
        }, function (err, result, code) {
          if (err || code > 0) {
            grunt.warn(result.stderr || result.stdout);
          }
          grunt.log.writeln('\n' + result.stdout);

          next();
        });

        cpCache.push(cp);
      }
    });

    padStdio.stdout('    ');
    async.parallelLimit(taskFuncs, options.limit, function () {
      padStdio.stdout();
      cb();
    });
  });

  grunt.registerTask('multicore-child', 'Multicore child task', function (taskJSON) {
    var tasks = JSON.parse(decodeURIComponent(taskJSON));
    grunt.task.run(tasks);
  });
};

// Make sure all child processes are killed when grunt exits
process.on('exit', function () {
  cpCache.forEach(function (el) {
    el.kill();
  });
});
