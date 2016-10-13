var webpack = require('webpack');

module.exports = {
    entry: "./src/client/index.js",
    output: {
        path: __dirname + '/public',
        filename: "./bundle.js"
    },
    module: {
        loaders: [
            {
                test: /\.js?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel',
                query: {
                    presets: ['es2015', 'stage-0', 'react'],
                    plugins: ['transform-runtime']
                }
            },
            { test: /\.json$/, loaders: ["json"] },
            { test: /\.scss$/, loaders: ["style", "css", "sass"] },
            { test: /\.css$/, loaders: ["style", "css"] },
            { test: /\.(otf|eot|svg|ttf|woff|woff2).*$/, loader: 'url?limit=1048576' }
        ]
    },
    plugins: [
      new webpack.ProvidePlugin({
        'Promise': 'exports?global.Promise!es6-promise',
        'fetch': 'exports?self.fetch!whatwg-fetch'
      })
  ]
};
