// gulp itself
var gulp = require('gulp');

// sftp
var sftp = require('gulp-sftp');

// wiredep
var wiredep = require('wiredep').stream;
var mainBowerFiles = require('main-bower-files');

// gulp-handlebars
var handlebars = require('gulp-handlebars');
var wrap = require('gulp-wrap');
var declare = require('gulp-declare');
var concat = require('gulp-concat');

// BrowserSync
var browserSync = require('browser-sync');
var reload = browserSync.reload;

// Variables

var bc = "bower_components/"

var dest = "dest";
var files = ["*.html", "css/*.css", "js/*.js"].concat(mainBowerFiles());
var fonts = [ bc + "bootstrap/dist/fonts/*" ];

// default
gulp.task('default', ['fonts', 'templates'], function() {
    gulp.src(files, {base: '.'})
    .pipe(wiredep())
    .pipe(gulp.dest(dest));
});

// copy fonts
gulp.task('fonts', function(){
    gulp.src(fonts, {base: '.'})
    .pipe(gulp.dest(dest));
})

// 99% https://github.com/lazd/gulp-handlebars#gulpfilejs
gulp.task('templates', function(){
  gulp.src('templates/*.hbs')
    .pipe(handlebars())
    .pipe(wrap('Handlebars.template(<%= contents %>)'))
    .pipe(declare({
      namespace: 'Templates',
      noRedeclare: true, // Avoid duplicate declarations
    }))
    .pipe(concat('templates.js'))
    .pipe(gulp.dest(dest, { base: '.' }));
});

// BrowserSync; Watch files for changes and reload
gulp.task('serve', ["default"], function() {
  browserSync({
    server: {
      baseDir: dest
    }
  });

  gulp.watch([files].concat(['templates/*.hbs']), {cwd: "."}, ["reload"]);
});

// Reload BrowerSync browsers
gulp.task('reload', ["default"], function() {
    reload();
});

// Publish to production
gulp.task('produce', ['default'], function(){
    return gulp.src(files.concat(fonts), {base: '.'})
    .pipe(wiredep())
    .pipe(gulp.dest(dest))
    .pipe(sftp({
        host: 'joinout.de',
        user: 'joinou',
        remotePath: '/public_html/joinoutDE/studienplan5-new'
    }))
});

// Publish to staging
gulp.task('stage', ['default'], function(){
    return gulp.src(files.concat(fonts), {base: '.'})
    .pipe(wiredep())
    .pipe(gulp.dest(dest))
    .pipe(sftp({
        host: 'joinout.de',
        user: 'joinou',
        remotePath: '/public_html/joinoutDE/studienplan5-new/stg'
    }))
});
