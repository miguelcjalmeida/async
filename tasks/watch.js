let gulp = require('gulp')

module.exports = gulp.task('watch', ['test'], () =>
  gulp.watch(['src/**/*', 'tests/**/*'], ['test']))
