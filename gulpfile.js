var gulp = require('gulp');
var sftp = require('gulp-sftp');
var wiredep = require('wiredep').stream;
var mainBowerFiles = require('main-bower-files');

// gulp-handlebars
var handlebars = require('gulp-handlebars');
var wrap = require('gulp-wrap');
var declare = require('gulp-declare');
var concat = require('gulp-concat');

var browserSync = require('browser-sync');
var reload = browserSync.reload;

var bc = "bower_components/"

var dest = "dest";
var files = ["*.html", "css/*.css", "js/*.js"].concat(mainBowerFiles());
var fonts = [ bc + "bootstrap/dist/fonts/*" ];

// bower task handles index.html
gulp.task('default', ['fonts', 'templates'], function() {
    gulp.src(files, {base: '.'})
    .pipe(wiredep())
    .pipe(gulp.dest(dest));
});

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

gulp.task('clean', function() {
});

// watch files for changes and reload
gulp.task('serve', ["default"], function() {
  browserSync({
    server: {
      baseDir: dest
    }
  });

  gulp.watch([files].concat(['templates/*.hbs']), {cwd: "."}, ["reload"]);
});

gulp.task('reload', ["default"], function() {
    reload();
});

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
