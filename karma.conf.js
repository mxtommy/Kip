// Karma configuration file, see link for more information
// https://karma-runner.github.io/0.13/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('karma-spec-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      // Only capture console.error by default to reduce noise from console.log/warn
      captureConsole: true
    },
    // Filter browser console output shown in terminal; only show 'error'
    browserConsoleLogOptions: {
      level: 'error', // options: 'log', 'info', 'warn', 'error'
      terminal: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, 'coverage'),
      reporters: [
        { type: 'html' },
        { type: 'lcovonly' },
        { type: 'text-summary' }
      ],
      fixWebpackSourcePaths: true
    },
    reporters: ['spec', 'kjhtml', 'coverage'],
    specReporter: {
      suppressErrorSummary: false,
      suppressFailed: false,
      suppressPassed: false,
      suppressSkipped: true,
      showSpecTiming: true,
      // Don't print browser console.log/warn for specs; keep failures concise
      maxLogLines: 0
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    // In local dev, keep watching; in CI/single-run, close the browser when done
    autoWatch: !process.env.CI,
    browsers: process.env.CI ? ['ChromeHeadless'] : ['Chrome'],
    singleRun: !!process.env.CI
  });
};
