const gulp = require('gulp');
const concat = require('gulp-concat');
const htmlmin = require('gulp-htmlmin');
const cleanCss = require('gulp-clean-css');
const webpack = require('webpack-stream');
const replace = require('gulp-replace');
const fs = require('fs');
const path = require('path');

const PATHS = {
    src: 'src/server/views',
    dist: 'dist',
    entryJs: 'src/server/views/js/shadow-entry.js',
    outputFile: 'vg-coder-bundle.js'
};

// 1. Bundle & Minify CSS
let cssContent = '';
gulp.task('css', function() {
    return gulp.src([
        `${PATHS.src}/dashboard.css`,
        `${PATHS.src}/css/*.css`
    ])
    .pipe(concat('bundle.css'))
    .pipe(cleanCss())
    .on('data', function(file) {
        cssContent = file.contents.toString();
    });
});

// 2. Bundle & Minify HTML
let htmlContent = '';
gulp.task('html', function() {
    return gulp.src(`${PATHS.src}/dashboard.html`)
    .pipe(htmlmin({ 
        collapseWhitespace: true, 
        removeComments: true,
        removeRedundantAttributes: true,
        minifyCSS: true,
        minifyJS: true
    }))
    .pipe(replace(/<link rel="stylesheet".*?>/g, ''))
    .pipe(replace(/<script.*?>.*?<\/script>/g, ''))
    .on('data', function(file) {
        htmlContent = file.contents.toString();
    });
});

// 3. Bundle JS using Webpack
let jsContent = '';
gulp.task('js', function() {
    return gulp.src(PATHS.entryJs)
    .pipe(webpack({
        mode: 'production',
        output: { filename: 'bundle.js' },
        resolve: { extensions: ['.js'] }
    }))
    .on('data', function(file) {
        jsContent = file.contents.toString();
    });
});

// 4. Build Final Injector
gulp.task('build', gulp.series('css', 'html', 'js', function(done) {
    const finalScript = `
(function() {
    const CONTAINER_ID = 'vg-coder-shadow-host';
    if (document.getElementById(CONTAINER_ID)) {
        console.log('VG Coder already injected');
        return;
    }

    // 1. Host Element (Full screen overlay, pointer-events: none allows clicking through)
    const host = document.createElement('div');
    host.id = CONTAINER_ID;
    // z-index extremely high to be on top of everything
    host.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:2147483647; pointer-events:none;";
    document.body.appendChild(host);

    // 2. Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });
    window.__VG_CODER_ROOT__ = shadow;

    // 3. Inject CSS
    const style = document.createElement('style');
    style.textContent = \`${cssContent.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
    shadow.appendChild(style);

    // 4. Inject HTML Wrapper
    // Initial State: Hidden (0x0), but pointer-events: auto to receive clicks when expanded
    const wrapper = document.createElement('div');
    wrapper.id = 'vg-app-root';
    wrapper.style.cssText = "pointer-events: auto; position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: hidden; background: var(--ios-bg, #F2F2F7); display: flex; flex-direction: column; transition: opacity 0.3s ease;";
    wrapper.innerHTML = \`${htmlContent.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
    shadow.appendChild(wrapper);

    // 5. Run App Logic
    try {
        ${jsContent}
    } catch (e) {
        console.error('VG Coder Start Error:', e);
    }
})();
    `;

    if (!fs.existsSync(PATHS.dist)) fs.mkdirSync(PATHS.dist);
    fs.writeFileSync(path.join(PATHS.dist, PATHS.outputFile), finalScript);
    
    console.log('--------------------------------------------------');
    console.log(`✅ Build Complete: ${path.join(PATHS.dist, PATHS.outputFile)}`);
    console.log('--------------------------------------------------');
    done();
}));

gulp.task('default', gulp.series('build'));
